import * as dynamodb from '@aws-cdk/aws-dynamodb';
import * as cdk from '@aws-cdk/core';

export class Storage extends cdk.Construct {
  public newsletterTable: dynamodb.Table;

  constructor(scope: cdk.Construct, id: string) {
    super(scope, id);

    this.newsletterTable = new dynamodb.Table(this, 'NewsletterTable', {
      partitionKey: { name: 'email', type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
  }
}
