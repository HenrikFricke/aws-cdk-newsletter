const { AwsCdkTypeScriptApp, NodePackageManager } = require('projen');

const project = new AwsCdkTypeScriptApp({
  // Project config
  name: 'aws-cdk-newsletter',
  description: 'Functionless example with AWS Step Functions',
  authorName: 'Henrik Fricke',
  authorEmail: 'henrikfricke@web.de',
  authorUrl: 'https://yetanother.blog',
  license: 'MIT',
  defaultReleaseBranch: 'main',

  // CDK config
  cdkVersion: '1.95.2',
  cdkVersion: '2.0.0',
  constructsVersion: '10.0.0',
  packageManager: NodePackageManager.NPM,

  // Dependencies
  devDeps: [
    'constructs',
    'aws-cdk-lib',
    '@types/node',
    'esbuild@0',
  ],
  deps: [
    '@aws-sdk/client-sesv2',
  ],
});

project.synth();