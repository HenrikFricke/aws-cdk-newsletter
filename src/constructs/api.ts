import * as apigateway from '@aws-cdk/aws-apigateway';
import * as iam from '@aws-cdk/aws-iam';
import * as sfn from '@aws-cdk/aws-stepfunctions';
import * as cdk from '@aws-cdk/core';

export interface ApiProps {
  stateMachine: sfn.StateMachine;
}

export class Api extends cdk.Construct {
  constructor(scope: cdk.Construct, id: string, props: ApiProps) {
    super(scope, id);

    // IAM roles for AWS integrations
    const confirmIntegrationRole = new iam.Role(this, 'ConfirmIntegrationRole', {
      assumedBy: new iam.ServicePrincipal('apigateway.amazonaws.com'),
    });
    props.stateMachine.grantTaskResponse(confirmIntegrationRole);

    const subscribeOrUnsubscribeIntegrationRole = new iam.Role(this, 'SubscribeOrUnsubscribeIntegrationRole', {
      assumedBy: new iam.ServicePrincipal('apigateway.amazonaws.com'),
    });
    props.stateMachine.grantStartExecution(subscribeOrUnsubscribeIntegrationRole);

    // API definition
    const api = new apigateway.RestApi(this, 'NewsletterApi');

    const requestValidator = new apigateway.RequestValidator(this, 'SubscribeValidator', {
      restApi: api,
      validateRequestParameters: true,
      validateRequestBody: true,
    });

    const subscriptionInputModel = api.addModel('SubscriptionInputModel', {
      contentType: 'application/json',
      modelName: 'SubscriptionInputModel',
      schema: {
        schema: apigateway.JsonSchemaVersion.DRAFT4,
        title: 'subscriptionInputModel',
        type: apigateway.JsonSchemaType.OBJECT,
        properties: {
          email: {
            type: apigateway.JsonSchemaType.STRING,
            format: 'email',
          },
        },
      },
    });

    api.root.addResource('confirm').addMethod(
      'POST',
      new apigateway.AwsIntegration({
        service: 'states',
        action: 'SendTaskSuccess',
        options: {
          credentialsRole: confirmIntegrationRole,
          integrationResponses: [
            {
              statusCode: '200',
              responseTemplates: {
                'application/json': JSON.stringify({ ok: true }),
              },
            },
          ],
          requestTemplates: {
            'application/json': JSON.stringify({
              taskToken: '$util.base64Decode($input.params(\'token\'))',
              output: '{}',
            }),
          },
        },
      }),
      {
        methodResponses: [{ statusCode: '200' }],
        requestValidator,
        requestParameters: {
          'method.request.querystring.token': true,
        },
      },
    );

    api.root.addResource('subscribe').addMethod(
      'POST',
      new apigateway.AwsIntegration({
        service: 'states',
        action: 'StartExecution',
        options: {
          credentialsRole: subscribeOrUnsubscribeIntegrationRole,
          integrationResponses: [
            {
              statusCode: '200',
              responseTemplates: {
                'application/json': JSON.stringify({ ok: true }),
              },
            },
          ],
          requestTemplates: {
            'application/json': JSON.stringify({
              stateMachineArn: props.stateMachine.stateMachineArn,
              input: JSON.stringify({
                email: '$input.params(\'email\')',
                type: 'SUBSCRIBE',
              }),
            }),
          },
        },
      }),
      {
        methodResponses: [{ statusCode: '200' }],
        requestValidator,
        requestModels: {
          'application/json': subscriptionInputModel,
        },
      },
    );

    api.root.addResource('unsubscribe').addMethod(
      'POST',
      new apigateway.AwsIntegration({
        service: 'states',
        action: 'StartExecution',
        options: {
          credentialsRole: subscribeOrUnsubscribeIntegrationRole,
          integrationResponses: [
            {
              statusCode: '200',
              responseTemplates: {
                'application/json': JSON.stringify({ ok: true }),
              },
            },
          ],
          requestTemplates: {
            'application/json': JSON.stringify({
              stateMachineArn: props.stateMachine.stateMachineArn,
              input: JSON.stringify({
                email: '$input.params(\'email\')',
                type: 'UNSUBSCRIBE',
              }),
            }),
          },
        },
      }),
      {
        methodResponses: [{ statusCode: '200' }],
        requestValidator,
        requestModels: {
          'application/json': subscriptionInputModel,
        },
      },
    );
  }
}
