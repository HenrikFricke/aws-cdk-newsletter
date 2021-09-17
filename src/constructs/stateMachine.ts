import * as path from 'path';
import * as lambda from '@aws-cdk/aws-lambda-nodejs';
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
        confirmed: tasks.DynamoAttributeValue.fromBoolean(false),
      },
    });

    const unsubscribe = new tasks.DynamoDeleteItem(this, 'Unsubscribe', {
      table: props.storage.newsletterTable,
      key: { email: tasks.DynamoAttributeValue.fromString(sfn.JsonPath.stringAt('$.email')) },
    });

    const doNothing = new sfn.Pass(this, 'Do nothing');

    const sendEmailConfirmationLambda = new lambda.NodejsFunction(this, 'SendEmailConfirmationLambda', {
      entry: path.join(__dirname, '../functions/sendEmailConfirmation.ts'),
    });

    const sendEmailConfirmation = new tasks.LambdaInvoke(this, 'Send Email Confirmation', {
      lambdaFunction: sendEmailConfirmationLambda,
      integrationPattern: sfn.IntegrationPattern.WAIT_FOR_TASK_TOKEN,
      payload: sfn.TaskInput.fromObject({
        token: sfn.JsonPath.taskToken,
      }),
    });

    const subscribeOrUnsubscribe = new sfn.Choice(this, 'Subscribe or Unsubscribe?')
      .when(
        sfn.Condition.and(
          sfn.Condition.stringEquals('$.type', 'SUBSCRIBE'),
          sfn.Condition.isNotPresent('$.subscription.Item'),
        ),
        subscribe.next(sendEmailConfirmation),
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
