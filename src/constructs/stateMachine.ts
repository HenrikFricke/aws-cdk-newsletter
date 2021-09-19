import * as sns from '@aws-cdk/aws-sns';
import * as subscriptions from '@aws-cdk/aws-sns-subscriptions';
import * as sfn from '@aws-cdk/aws-stepfunctions';
import * as tasks from '@aws-cdk/aws-stepfunctions-tasks';
import * as cdk from '@aws-cdk/core';
import { Storage } from './storage';

export interface StateMachineProps {
  storage: Storage;
}

export class StateMachine extends cdk.Construct {
  public stateMachine: sfn.StateMachine;

  constructor(scope: cdk.Construct, id: string, props: StateMachineProps) {
    super(scope, id);

    const emailConfirmationTopic = new sns.Topic(this, 'EmailConfirmationTopic');
    emailConfirmationTopic.addSubscription(new subscriptions.EmailSubscription('henrik.fricke@superluminar.io'));

    const getSubscription = new tasks.DynamoGetItem(this, 'Get Subscription', {
      table: props.storage.newsletterTable,
      key: { email: tasks.DynamoAttributeValue.fromString(sfn.JsonPath.stringAt('$.email')) },
      resultPath: '$.subscription',
    });

    const subscribe = new tasks.DynamoPutItem(this, 'Subscribe', {
      table: props.storage.newsletterTable,
      item: {
        email: tasks.DynamoAttributeValue.fromString(sfn.JsonPath.stringAt('$.email')),
        createdAt: tasks.DynamoAttributeValue.fromString(new Date().toISOString()),
      },
    });

    const unsubscribe = new tasks.DynamoDeleteItem(this, 'Unsubscribe', {
      table: props.storage.newsletterTable,
      key: { email: tasks.DynamoAttributeValue.fromString(sfn.JsonPath.stringAt('$.email')) },
    });

    const doNothing = new sfn.Pass(this, 'Do nothing');

    const sendEmailConfirmation = new tasks.SnsPublish(this, 'Send Email Confirmation', {
      topic: emailConfirmationTopic,
      integrationPattern: sfn.IntegrationPattern.WAIT_FOR_TASK_TOKEN,
      timeout: cdk.Duration.days(1),
      message: sfn.TaskInput.fromObject({
        token: sfn.JsonPath.taskToken,
      }),
      resultPath: '$.sendEmailConfirmation',
    });

    const subscribeOrUnsubscribe = new sfn.Choice(this, 'Subscribe or Unsubscribe?')
      .when(
        sfn.Condition.and(
          sfn.Condition.stringEquals('$.type', 'SUBSCRIBE'),
          sfn.Condition.isNotPresent('$.subscription.Item'),
        ),
        sendEmailConfirmation.next(subscribe),
      )
      .when(
        sfn.Condition.and(
          sfn.Condition.stringEquals('$.type', 'UNSUBSCRIBE'),
          sfn.Condition.isPresent('$.subscription.Item'),
        ),
        unsubscribe,
      )
      .otherwise(doNothing);

    this.stateMachine = new sfn.StateMachine(this, 'Newsletter', {
      definition: getSubscription.next(subscribeOrUnsubscribe),
    });
  }
}
