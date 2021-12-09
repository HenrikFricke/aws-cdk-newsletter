import {
  Aws,
  Duration,
  App,
  Stack,
  StackProps,
  RemovalPolicy,
  aws_dynamodb as dynamodb,
  aws_lambda_nodejs as lambdaNodeJs,
  aws_iam as iam,
  aws_stepfunctions_tasks as tasks,
  aws_stepfunctions as sfn,
  aws_apigateway as apigateway,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface NewsletterStackProps extends StackProps {
  fromEmailAddress: string;
  subscribedUrl: string;
  unsubscribedUrl: string;
  errorUrl: string;
}

export class NewsletterStack extends Stack {
  constructor(scope: Construct, id: string, props: NewsletterStackProps) {
    super(scope, id, props);

    /*
    ** Storage
    */
    const newsletterTable = new dynamodb.Table(this, 'NewsletterTable', {
      partitionKey: { name: 'email', type: dynamodb.AttributeType.STRING },
      removalPolicy: RemovalPolicy.DESTROY,
    });

    /*
    ** Step Function
    */
    const emailConfirmationFunction = new lambdaNodeJs.NodejsFunction(this, 'emailConfirmation', {
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

    const subscribe = new tasks.DynamoPutItem(this, 'Subscribe', {
      table: newsletterTable,
      item: {
        email: tasks.DynamoAttributeValue.fromString(sfn.JsonPath.stringAt('$.email')),
        createdAt: tasks.DynamoAttributeValue.fromString(sfn.JsonPath.stringAt('$$.State.EnteredTime')),
      },
    });

    const unsubscribe = new tasks.DynamoDeleteItem(this, 'Unsubscribe', {
      table: newsletterTable,
      key: { email: tasks.DynamoAttributeValue.fromString(sfn.JsonPath.stringAt('$.email')) },
    });

    const sendEmailConfirmation = new tasks.LambdaInvoke(this, 'SendEmailConfirmation', {
      lambdaFunction: emailConfirmationFunction,
      integrationPattern: sfn.IntegrationPattern.WAIT_FOR_TASK_TOKEN,
      timeout: Duration.days(1),
      payload: sfn.TaskInput.fromObject({
        email: sfn.JsonPath.stringAt('$.email'),
        confirmationEndpoint: sfn.JsonPath.stringAt('$.confirmationEndpoint'),
        token: sfn.JsonPath.taskToken,
        type: sfn.JsonPath.stringAt('$.type'),
      }),
      resultPath: '$.sendEmailConfirmation',
    });

    const stateMachine = new sfn.StateMachine(this, 'Newsletter', {
      definition: sendEmailConfirmation.next(
        new sfn.Choice(this, 'SubscribeOrUnsubscribe?')
          .when(
            sfn.Condition.stringEquals('$.type', 'SUBSCRIBE'),
            subscribe,
          )
          .when(
            sfn.Condition.stringEquals('$.type', 'UNSUBSCRIBE'),
            unsubscribe,
          ),
      ),
    });

    /*
    ** API
    */
    const api = new apigateway.RestApi(this, 'NewsletterApi');

    const integrationRole = new iam.Role(this, 'ApiIntegrationRole', {
      assumedBy: new iam.ServicePrincipal('apigateway.amazonaws.com'),
    });
    stateMachine.grantTaskResponse(integrationRole);
    stateMachine.grantStartExecution(integrationRole);

    const integrationResponses = [
      {
        statusCode: '200',
        responseTemplates: {
          'application/json': JSON.stringify({ ok: true }),
        },
      },
    ];

    const methodOptions = {
      methodResponses: [{ statusCode: '200' }],
    };

    const subscribeOrUnsubscribeIntegration = new apigateway.AwsIntegration({
      service: 'states',
      action: 'StartExecution',
      options: {
        credentialsRole: integrationRole,
        integrationResponses,
        requestTemplates: {
          'application/json': JSON.stringify({
            stateMachineArn: stateMachine.stateMachineArn,
            input: JSON.stringify({
              email: '$input.params(\'email\')',
              confirmationEndpoint: 'https://$context.domainName/$context.stage/confirm',
              type: '$context.resourcePath.substring(1).toUpperCase()',
            }),
          }),
        },
      },
    });

    api.root.addResource('subscribe').addMethod(
      'POST',
      subscribeOrUnsubscribeIntegration,
      methodOptions,
    );

    api.root.addResource('unsubscribe').addMethod(
      'POST',
      subscribeOrUnsubscribeIntegration,
      methodOptions,
    );

    api.root.addResource('confirm').addMethod(
      'GET',
      new apigateway.AwsIntegration({
        service: 'states',
        action: 'SendTaskSuccess',
        options: {
          credentialsRole: integrationRole,
          requestTemplates: {
            'application/json': JSON.stringify({
              taskToken: '$util.base64Decode($input.params(\'token\'))',
              output: '{}',
            }),
          },
          integrationResponses: [
            {
              statusCode: '301',
              responseTemplates: {
                'application/json': `
                  #set ($type = $input.params('type'))
                  #if( $type == 'subscribe' )
                    #set($context.responseOverride.header.location = "${props.subscribedUrl}")
                  #elseif( $type == 'unsubscribe' )
                    #set($context.responseOverride.header.location = "${props.unsubscribedUrl}")
                  #else
                    #set($context.responseOverride.header.location = "${props.errorUrl}")
                  #end
                `,
              },
            },
          ],
        },
      }),
      {
        methodResponses: [{
          statusCode: '301',
        }],
      },
    );
  }
}

const app = new App();

new NewsletterStack(app, 'aws-cdk-newsletter', {
  fromEmailAddress: 'henrik.fricke@superluminar.io',
  subscribedUrl: 'https://example.com/subscribed',
  unsubscribedUrl: 'https://example.com/unsubscribed',
  errorUrl: 'https://example.com/ohno',
  env: {
    region: 'eu-central-1',
  },
});

app.synth();