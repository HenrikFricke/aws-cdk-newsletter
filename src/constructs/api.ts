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

    const confirmIntegrationRole = new iam.Role(this, 'ConfirmIntegrationRole', {
      assumedBy: new iam.ServicePrincipal('apigateway.amazonaws.com'),
    });
    props.stateMachine.grantTaskResponse(confirmIntegrationRole);

    const api = new apigateway.RestApi(this, 'NewsletterApi');

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
                'application/json': JSON.stringify({ done: true }),
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
      },
    );
  }
}
