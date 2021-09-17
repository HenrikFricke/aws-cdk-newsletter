export interface Event {
  token: string;
}

export function handler(event: Event):void {
  console.log('RAW', JSON.stringify(event));
  console.log('Base64', Buffer.from(event.token).toString('base64'));

  // TODO: send email
}