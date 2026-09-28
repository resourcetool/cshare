/**
 * CSHARE emergency email delivery through EmailJS.
 *
 * These are EmailJS public/client-side identifiers. No Firebase write is made
 * when an emergency email is sent.
 */
const EMAILJS_ENDPOINT = 'https://api.emailjs.com/api/v1.0/email/send';

export const EMAILJS_CONFIG = {
  publicKey: 'Rebgj-ozSdLuQoOUr',
  serviceId: 'service_3ktp01l',
  templateId: ':template_9y0k4ch',
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

export async function sendEmergencyEmail(input: EmergencyEmailInput): Promise<void> {
  const response = await fetch(EMAILJS_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      service_id: EMAILJS_CONFIG.serviceId,
      template_id: EMAILJS_CONFIG.templateId,
      user_id: EMAILJS_CONFIG.publicKey,
      template_params: {
        to_email: input.recipient.email,
        to_name: input.recipient.name,
        recipient_name: input.recipient.name,
        subject: input.subject,
        message: input.message,
        from_name: input.senderName ?? 'CSHARE Administration',
        reply_to: input.replyTo ?? '',
      },
    }),
  });

  if (!response.ok) {
    const detail = (await response.text()).trim();
    throw new Error(detail || `EmailJS returned HTTP ${response.status}.`);
  }
}

/** EmailJS documents a 1 request/second sending limit. */
export const EMAIL_SEND_INTERVAL_MS = 1100;

export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
