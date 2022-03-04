import { App, CfnOutput, Duration, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Api, ApiProps } from './constructs/api';
import { StateMachine, StateMachineProps } from './constructs/stateMachine';
import { Storage } from './constructs/storage';

export type NewsletterStackProps = StackProps & Pick<ApiProps, 'redirectUrls'> & Omit<StateMachineProps, 'newsletterTable'>;

export class NewsletterStack extends Stack {
  constructor(scope: Construct, id: string, props: NewsletterStackProps) {
    super(scope, id, props);

    const storage = new Storage(this, 'Storage');

    const stateMachine = new StateMachine(this, 'StateMachine', {
      newsletterTable: storage.newsletterTable,
      ...props,
    });

    const api = new Api(this, 'Api', {
      stateMachine,
      ...props,
    });

    new CfnOutput(this, 'ApiEndpoint', {
      value: api.api.url,
    });
  }
}

const app = new App();

new NewsletterStack(app, 'aws-cdk-newsletter', {
  fromEmailAddress: 'henrikfricke@web.de',
  confirmationLinkExpirationTime: Duration.days(1),
  redirectUrls: {
    subscribed: 'https://example.com/subscribed',
    unsubscribed: 'https://example.com/unsubscribed',
    expired: 'https://example.com/expired',
    error: 'https://example.com/ohno',
  },
});

app.synth();