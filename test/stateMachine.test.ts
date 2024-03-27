import { join } from 'path';
import { App, Stack, Duration, aws_dynamodb as dynamodb } from 'aws-cdk-lib';
import { extractStateMachineAsls } from './helpers/extractStateMachineAsls';
import { TestStateMachineLocal } from './helpers/TestStateMachineLocal';
import { StateMachine } from '../src/constructs/stateMachine';

let testStateMachineLocal: TestStateMachineLocal;

beforeAll(async () => {
  const app = new App();
  const testingStack = new Stack(app, 'TestingStack');
  const newsletterTable = new dynamodb.Table(testingStack, 'NewsletterTable', {
    partitionKey: { name: 'email', type: dynamodb.AttributeType.STRING },
  });
  new StateMachine(testingStack, 'StateMachine', {
    newsletterTable,
    fromEmailAddress: 'test@example.com',
    confirmationLinkExpirationTime: Duration.minutes(5),
  });
  const definition = extractStateMachineAsls(testingStack)[0];

  testStateMachineLocal = new TestStateMachineLocal({
    stateMachineName: 'StateMachineNewsletter',
    definition,
    mockConfigPath: join(__dirname, './fixtures/stateMachine.mocks.json'),
  });

  await testStateMachineLocal.setup();
}, 30_000);

afterAll(async () => {
  await testStateMachineLocal.teardown();
}, 20_000);

describe('invalid requests', () => {
  it.concurrent.each`
    type              | testCase
    ${'subscribe'}    | ${'InvalidRequestSubscribe'}
    ${'unsubscribe'}  | ${'InvalidRequestUnsubscribe'}
  `('should skip the execution', async ({ type, testCase }) => {
    const { output } = await testStateMachineLocal.execute(testCase, {
      email: 'myname@example.com',
      confirmationEndpoint: 'https://example.com',
      type,
    });

    expect(output).toEqual({
      status: 'SKIPPED',
    });
  }, 10_000);
});
