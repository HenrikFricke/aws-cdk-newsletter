import '@aws-cdk/assert/jest';
import { App, Duration } from 'aws-cdk-lib';
import { NewsletterStack } from '../src/main';

test('Snapshot', () => {
  const app = new App();
  const stack = new NewsletterStack(app, 'test', {
    fromEmailAddress: 'henrikfricke@web.de',
    confirmationLinkExpirationTime: Duration.days(1),
    redirectUrls: {
      subscribed: 'https://example.com/subscribed',
      unsubscribed: 'https://example.com/unsubscribed',
      expired: 'https://example.com/expired',
      error: 'https://example.com/ohno',
    },
  });

  expect(app.synth().getStackArtifact(stack.artifactId).template).toMatchSnapshot();
});