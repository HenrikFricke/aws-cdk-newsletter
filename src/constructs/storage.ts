import { RemovalPolicy, aws_dynamodb as dynamodb } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export class Storage extends Construct {
  public newsletterTable: dynamodb.Table;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.newsletterTable = new dynamodb.Table(this, 'NewsletterTable', {
      partitionKey: { name: 'email', type: dynamodb.AttributeType.STRING },
      removalPolicy: RemovalPolicy.DESTROY,
    });
  }
}