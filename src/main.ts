import * as cdk from '@aws-cdk/core';
import { Api } from './constructs/api';
import { StateMachine } from './constructs/stateMachine';
import { Storage } from './constructs/storage';

export class NewsletterStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props: cdk.StackProps = {}) {
    super(scope, id, props);

    const storage = new Storage(this, 'Storage');

    const stateMachine = new StateMachine(this, 'StateMachine', {
      storage,
    });

    new Api(this, 'NewsletterApi', {
      stateMachine: stateMachine.stateMachine,
    });
  }
}

const app = new cdk.App();

new NewsletterStack(app, 'newsletter-dev', {
  env: {
    region: 'eu-central-1',
  },
});

app.synth();