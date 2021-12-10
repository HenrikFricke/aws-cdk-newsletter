# aws-cdk-newsletter
> Functionless example with AWS Step Functions

## High Level

The project demonstrates a newsletter subscription service with serverless technologies. The service consists of a simple HTTP API and a state machine in the background. The state machine takes care of sending the email, waiting for the subscription confirmation, and storing the email address in a database.

On a technical level, the example uses AWS Step Functions to implement the state machine using AWS Lambda functions and AWS service integrations. Ultimately, the email addresses get stored in a DynamoDB table.

## State Machine

### Execution Payload

The state machine expects a JSON payload with the following structure:

```json
{
  "email": "myname@example.com",
  "confirmationEndpoint": "https://XXXXXXXXXX.execute-api.eu-central-1.amazonaws.com/prod/confirm",
  "type": "subscribe"
}
```

The `type` can be either `subscribe` or `unsubscribe`.

### Diagram

![step functions flow diagram](./docs/stepfunctions_graph.svg)

Tasks:
- **GetEmail**: DynamoDB _GetItem_ request for `email` in execution payload.
- **IsValidRequest**: The state machine proceeds to _SendEmailConfirmation_ if the email address doesn't exist for a subscription request or does exist to cancel the subscription.
- **SendEmailConfirmation**: The task invokes an AWS Lambda function to send a confirmation email via SES. The state machine waits until a successful callback or times out.
- **SubscribeOrUnsubscribe?**: The choice task reads the `type` in the execution payload and triggers a _Subscribe_ or _Unsubscribe_ task.
- **Subscribe**: DynamoDB _PutItem_ request to store the email address.
- **Unsubscribe**: DynamoDB _DeleteItem_ request to delete the email address.
- **Do nothing**: Task to stop the execution immediately.

## Usage

⚠️ AWS SES requires a verified email address to send emails. It is a manual step not covered by the CDK stack. Make sure you have a verified email address in your account. See [documentation](https://docs.aws.amazon.com/ses/latest/DeveloperGuide/verify-email-addresses.html).

⚠️ AWS credentials in the terminal are required for the deployment. See [documentation](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-configure.html).

Let's get started:
```sh
# Clone the repository
$ > git clone git@github.com:HenrikFricke/aws-cdk-newsletter.git
$ > cd aws-cdk-newsletter

# Install dependencies
$ > npm install
```

Before the deployment, go to `src/main.ts`, scroll down and update the `fromEmailAddress` value. You need to use the verified email address for SES.

Next, deploy the stack:
```sh
$ > npm run deploy
```

After the deployment, get the API endpoint from the stack output and subscribe to the newsletter:
```sh
$ > curl -X POST https://XXXXXXXXXX.execute-api.eu-central-1.amazonaws.com/prod/subscribe\?email\=YOUR_EMAIL_ADDRESS
```

Check your mailbox and click on the confirmation link. Ideally, you should find your email address in the DynamoDB table. 

It's also possible to unsubscribe:
```sh
$ > curl -X POST https://XXXXXXXXXX.execute-api.eu-central-1.amazonaws.com/prod/unsubscribe\?email\=YOUR_EMAIL_ADDRESS
```

Again, click on the link in the email to confirm the step.

That's it! 🥳