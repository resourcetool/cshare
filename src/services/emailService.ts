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
}

/**
 * Sends one email through EmailJS.
 *
 * No EmailJS npm package is required.
 * This uses the EmailJS REST API directly.
 */
export async function sendEmergencyEmail(
  input: EmergencyEmailInput,
): Promise<void> {
  const response = await fetch(EMAILJS_ENDPOINT, {
    method: 'POST',

    headers: {
      'Content-Type': 'application/json',
    },

    body: JSON.stringify({
      service_id: EMAILJS_CONFIG.serviceId,
      template_id: EMAILJS_CONFIG.templateId,
      user_id: EMAILJS_CONFIG.publicKey,

      template_params: {
        to_email: input.recipient.email,
        to_name: input.recipient.name,
        subject: input.subject,
        message: input.message,
      },
    }),
  });

  // EmailJS may return useful diagnostic information
  // in the response body when something goes wrong.
  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(
      `EmailJS HTTP ${response.status}: ${
        responseText || 'Unknown EmailJS error'
      }`,
    );
  }
}

/**
 * EmailJS has a rate limit, so we wait between requests
 * when sending to multiple recipients.
 */
export const EMAIL_SEND_INTERVAL_MS = 1100;

export function wait(ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}