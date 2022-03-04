import { SFN, DescribeExecutionCommandOutput } from '@aws-sdk/client-sfn';
import { waitUntil } from 'async-wait-until';
import { GenericContainer, StartedTestContainer } from 'testcontainers';

export interface TestStateMachineLocalConfig {
  definition: string;
  stateMachineName: string;
  mockConfigPath: string;
}

export interface ExecutionResult<O> {
  status: DescribeExecutionCommandOutput['status'];
  output: O;
}

export class TestStateMachineLocal {
  private config: TestStateMachineLocalConfig;
  private container: StartedTestContainer | undefined;
  private sfnClient: SFN | undefined;
  private stateMachineArn: string | undefined;

  constructor(config: TestStateMachineLocalConfig) {
    this.config = config;
  }

  async setup() {
    this.container = await new GenericContainer('amazon/aws-stepfunctions-local')
      .withExposedPorts(8083)
      .withBindMount(this.config.mockConfigPath, '/home/stateMachine.mocks.json', 'ro')
      .withEnv('SFN_MOCK_CONFIG', '/home/stateMachine.mocks.json')
      .start();

    this.sfnClient = new SFN({
      endpoint: `http://localhost:${this.container.getMappedPort(8083)}`,
      region: 'local',
      credentials: {
        accessKeyId: '',
        secretAccessKey: '',
      },
    });

    const { stateMachineArn } = await this.sfnClient.createStateMachine({
      definition: this.config.definition,
      name: this.config.stateMachineName,
      roleArn: 'arn:aws:iam::123456789012:role/service-role/DummyRole',
    });

    this.stateMachineArn = stateMachineArn;
  }

  async execute<I, O>(testCase: string, input: I): Promise<ExecutionResult<O>> {
    const startExeuctionResult = await this.sfnClient?.startExecution({
      stateMachineArn: `${this.stateMachineArn}#${testCase}`,
      input: JSON.stringify(input),
    });

    let describeExecutionResult: DescribeExecutionCommandOutput | undefined;
    await waitUntil(async () => {
      describeExecutionResult = await this.sfnClient?.describeExecution({
        executionArn: startExeuctionResult?.executionArn,
      });

      return describeExecutionResult?.status !== 'RUNNING';
    });

    return {
      status: describeExecutionResult?.status,
      output: JSON.parse(describeExecutionResult?.output || '{}'),
    };
  }

  async teardown() {
    await this.container?.stop();
  }
}