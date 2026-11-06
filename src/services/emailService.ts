const EMAILJS_ENDPOINT =
  'https://api.emailjs.com/api/v1.0/email/send';

export const EMAILJS_CONFIG = {
  publicKey: 'zrqiU_Pb_ZfWPFNmb',
  serviceId: 'service_x5j443l',
  templateId: 'template_f1arceh',
} as const;

const VISIBLE_TO_EMAIL = 'csharehub@gmail.com';

const VISIBLE_TO_NAME = 'CSHARE Congregation Members';

export interface EmergencyEmailRecipient {
  id: string;
  name: string;
  email: string;
}

export interface EmergencyEmailInput {
  recipients: EmergencyEmailRecipient[];
  subject: string;
  message: string;
  senderName?: string;
  replyTo?: string;
}

export async function sendEmergencyEmail(
  input: EmergencyEmailInput,
): Promise<void> {
  const visibleTo = VISIBLE_TO_EMAIL.trim().toLowerCase();

  if (!visibleTo) {
    throw new Error(
      'No visible To email address is configured.',
    );
  }

  const recipientEmails = Array.from(
    new Set(
      input.recipients
        .map(recipient =>
          recipient.email.trim().toLowerCase(),
        )
        .filter(Boolean),
    ),
  );

  if (recipientEmails.length === 0) {
    throw new Error(
      'No valid recipient email addresses were provided.',
    );
  }

  const blindCopies = recipientEmails.filter(
    email => email !== visibleTo,
  );

  const templateParams = {
    to_email: visibleTo,
    to_name: VISIBLE_TO_NAME,
    bcc_email: blindCopies.join(', '),
    subject: input.subject,
    message: input.message,
    from_name:
      input.senderName || 'CSHARE Administration',
    reply_to:
      input.replyTo || visibleTo,
  };

  const response = await fetch(EMAILJS_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      service_id: EMAILJS_CONFIG.serviceId,
      template_id: EMAILJS_CONFIG.templateId,
      user_id: EMAILJS_CONFIG.publicKey,
      template_params: templateParams,
    }),
  });

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(
      `EmailJS HTTP ${response.status}: ${
        responseText || 'Unknown EmailJS error'
      }`,
    );
  }
}