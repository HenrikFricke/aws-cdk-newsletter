import { join } from 'path';
import { Aws, Duration, aws_lambda_nodejs as lambdaNodeJs, aws_iam as iam, aws_stepfunctions_tasks as tasks, aws_stepfunctions as sfn } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Storage } from './storage';

export interface StateMachineProps {
  storage: Storage;
  fromEmailAddress: string;
  confirmationLinkExpirationTime: Duration;
}

export class StateMachine extends Construct {
  public stateMachine: sfn.StateMachine;

  constructor(scope: Construct, id: string, props: StateMachineProps) {
    super(scope, id);

    const getEmail = new tasks.DynamoGetItem(this, 'GetEmail', {
      table: props.storage.newsletterTable,
      key: {
        email: tasks.DynamoAttributeValue.fromString(sfn.JsonPath.stringAt('$.email')),
      },
      resultPath: '$.emailItem',
    });

    const subscribe = new tasks.DynamoPutItem(this, 'Subscribe', {
      table: props.storage.newsletterTable,
      item: {
        email: tasks.DynamoAttributeValue.fromString(sfn.JsonPath.stringAt('$.email')),
        createdAt: tasks.DynamoAttributeValue.fromString(sfn.JsonPath.stringAt('$$.State.EnteredTime')),
      },
    });

    const unsubscribe = new tasks.DynamoDeleteItem(this, 'Unsubscribe', {
      table: props.storage.newsletterTable,
      key: { email: tasks.DynamoAttributeValue.fromString(sfn.JsonPath.stringAt('$.email')) },
    });

    const emailConfirmationFunction = new lambdaNodeJs.NodejsFunction(this, 'emailConfirmation', {
      entry: join(__dirname, '../functions/emailConfirmation.ts'),
      environment: {
        FROM_EMAIL_ADDRESS: props.fromEmailAddress,
      },
    });
    emailConfirmationFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: ['ses:SendEmail'],
      resources: [
        `arn:aws:ses:${Aws.REGION}:${Aws.ACCOUNT_ID}:identity/*`,
      ],
    }));

    const sendEmailConfirmation = new tasks.LambdaInvoke(this, 'SendEmailConfirmation', {
      lambdaFunction: emailConfirmationFunction,
      integrationPattern: sfn.IntegrationPattern.WAIT_FOR_TASK_TOKEN,
      heartbeat: props.confirmationLinkExpirationTime,
      payload: sfn.TaskInput.fromObject({
        email: sfn.JsonPath.stringAt('$.email'),
        confirmationEndpoint: sfn.JsonPath.stringAt('$.confirmationEndpoint'),
        token: sfn.JsonPath.taskToken,
        type: sfn.JsonPath.stringAt('$.type'),
      }),
      resultPath: '$.sendEmailConfirmation',
    });

    const isValidRequest = sfn.Condition.or(
      sfn.Condition.and(sfn.Condition.stringEquals('$.type', 'subscribe'), sfn.Condition.isNotPresent('$.emailItem.Item')),
      sfn.Condition.and(sfn.Condition.stringEquals('$.type', 'unsubscribe'), sfn.Condition.isPresent('$.emailItem.Item')),
    );

    const doNothing = new sfn.Pass(this, 'Do nothing');

    this.stateMachine = new sfn.StateMachine(this, 'Newsletter', {
      definition: getEmail
        .next(new sfn.Choice(this, 'IsValidRequest?')
          .when(isValidRequest,
            sendEmailConfirmation
              .next(new sfn.Choice(this, 'SubscribeOrUnsubscribe?')
                .when(sfn.Condition.stringEquals('$.type', 'subscribe'), subscribe)
                .when(sfn.Condition.stringEquals('$.type', 'unsubscribe'), unsubscribe),
              ),
          )
          .otherwise(doNothing),
        ),
    });
  }
}