const { AwsCdkTypeScriptApp, NodePackageManager } = require('projen');

const project = new AwsCdkTypeScriptApp({
  cdkVersion: '1.95.2',
  defaultReleaseBranch: 'main',
  name: 'aws-cdk-newsletter',
  packageManager: NodePackageManager.NPM,
  cdkDependencies: [
    '@aws-cdk/aws-dynamodb',
    '@aws-cdk/aws-stepfunctions',
    '@aws-cdk/aws-stepfunctions-tasks',
    '@aws-cdk/aws-lambda-nodejs',
    '@aws-cdk/aws-apigateway',
    '@aws-cdk/aws-iam',
  ],
  deps: [
    'aws-sdk',
  ],
  devDeps: [
    '@types/node',
    '@types/aws-lambda',
    '@types/aws-sdk',
    'esbuild@0',
  ],
});

project.synth();