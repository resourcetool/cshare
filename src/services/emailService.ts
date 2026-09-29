const EMAILJS_ENDPOINT =
  'https://api.emailjs.com/api/v1.0/email/send';

export const EMAILJS_CONFIG = {
  publicKey: 'Rebgj-ozSdLuQoOUr',
  serviceId: 'service_3ktp01l',
  templateId: 'template_9y0k4ch',
} as const;

export interface EmergencyEmailRecipient {
  id: string;
  name: string;
  email: string;
}

export interface EmergencyEmailInput {
  recipient: EmergencyEmailRecipient;
  subject: string;
  message: string;
  senderName?: string;
  replyTo?: string;
}

export async function sendEmergencyEmail(
  input: EmergencyEmailInput,
): Promise<void> {
  const response = await fetch(
    EMAILJS_ENDPOINT,
    {
      method: 'POST',
      headers: {
        'Content-Type':
          'application/json',
      },
      body: JSON.stringify({
        service_id:
          EMAILJS_CONFIG.serviceId,
        template_id:
          EMAILJS_CONFIG.templateId,
        user_id:
          EMAILJS_CONFIG.publicKey,

        template_params: {
          to_email:
            input.recipient.email,
          to_name:
            input.recipient.name,
          subject:
            input.subject,
          message:
            input.message,

          // These are included in case
          // you decide to use them in the
          // EmailJS template later.
          from_name:
            input.senderName ??
            'CSHARE Administration',
          reply_to:
            input.replyTo ?? '',
        },
      }),
    },
  );

  const responseText =
    await response.text();

  if (!response.ok) {
    throw new Error(
      `EmailJS HTTP ${response.status}: ${
        responseText ||
        'Unknown EmailJS error'
      }`,
    );
  }
}

export const EMAIL_SEND_INTERVAL_MS = 1100;

export function wait(
  ms: number,
): Promise<void> {
  return new Promise(resolve => {
    setTimeout(
      resolve,
      ms,
    );
  });
}