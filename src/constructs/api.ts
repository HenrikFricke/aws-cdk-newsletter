import { aws_iam as iam, aws_apigateway as apigateway } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { StateMachine } from './stateMachine';

export interface ApiProps {
  stateMachine: StateMachine;
  redirectUrls: {
    subscribed: string;
    unsubscribed: string;
    expired: string;
    error: string;
  };
}

export class Api extends Construct {
  public api: apigateway.RestApi;

  constructor(scope: Construct, id: string, props: ApiProps) {
    super(scope, id);

    this.api = new apigateway.RestApi(this, 'NewsletterApi');

    const integrationRole = new iam.Role(this, 'ApiIntegrationRole', {
      assumedBy: new iam.ServicePrincipal('apigateway.amazonaws.com'),
    });
    props.stateMachine.stateMachine.grantTaskResponse(integrationRole);
    props.stateMachine.stateMachine.grantStartExecution(integrationRole);

    const methodOptions = { methodResponses: [{ statusCode: '200' }] };

    const subscribeOrUnsubscribeIntegration = new apigateway.AwsIntegration({
      service: 'states',
      action: 'StartExecution',
      options: {
        credentialsRole: integrationRole,
        requestTemplates: {
          'application/json': JSON.stringify({
            stateMachineArn: props.stateMachine.stateMachine.stateMachineArn,
            input: JSON.stringify({
              email: '$input.params(\'email\')',
              confirmationEndpoint: 'https://$context.domainName/$context.stage/confirm',
              type: '$context.resourcePath.substring(1)',
            }),
          }),
        },
        integrationResponses: [
          {
            statusCode: '200',
            responseTemplates: {
              'application/json': JSON.stringify({ ok: true }),
            },
          },
        ],
      },
    });

    this.api.root.addResource('subscribe').addMethod(
      'POST',
      subscribeOrUnsubscribeIntegration,
      methodOptions,
    );

    this.api.root.addResource('unsubscribe').addMethod(
      'POST',
      subscribeOrUnsubscribeIntegration,
      methodOptions,
    );

    this.api.root.addResource('confirm').addMethod(
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
                  #if( $input.path('$.message') == "Task Timed Out: 'Provided task does not exist anymore'" )
                    #set($context.responseOverride.header.location = "${props.redirectUrls.expired}")
                  #elseif( $type == 'subscribe' )
                    #set($context.responseOverride.header.location = "${props.redirectUrls.subscribed}")
                  #elseif( $type == 'unsubscribe' )
                    #set($context.responseOverride.header.location = "${props.redirectUrls.unsubscribed}")
                  #else
                    #set($context.responseOverride.header.location = "${props.redirectUrls.error}")
                  #end
                `,
              },
            },
          ],
        },
      }),
      {
        methodResponses: [{ statusCode: '301' }],
      },
    );
  }
}