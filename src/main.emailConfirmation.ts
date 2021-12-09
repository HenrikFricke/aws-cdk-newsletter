import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';

const sesClient = new SESv2Client({});

interface Event {
  email: string;
  confirmationEndpoint: string;
  token: string;
  type: 'SUBSCRIBE' | 'UNSUBSCRIBE';
}

export async function handler(event: Event): Promise<void> {
  const fromEmailAddress = process.env.FROM_EMAIL_ADDRESS;
  const token = Buffer.from(event.token).toString('base64');

  const subjects = {
    SUBSCRIBE: 'Welcome to our fancy newsletter',
    UNSUBSCRIBE: 'We are sorry to see you go :(',
  };

  await sesClient.send(
    new SendEmailCommand({
      FromEmailAddress: fromEmailAddress,
      Destination: {
        ToAddresses: [
          event.email,
        ],
      },
      Content: {
        Simple: {
          Subject: {
            Data: subjects[event.type],
            Charset: 'UTF-8',
          },
          Body: {
            Text: {
              Data: `Please click on the link: ${event.confirmationEndpoint}?token=${token}`,
              Charset: 'UTF-8',
            },
          },
        },
      },
    }),
  );
}