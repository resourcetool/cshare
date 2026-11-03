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
  recipients: EmergencyEmailRecipient[];
  subject: string;
  message: string;
  senderName?: string;
  replyTo?: string;
}

export async function sendEmergencyEmail( input: EmergencyEmailInput, ): Promise<void> {
  const recipientEmails = Array.from(
    new Set(
      input.recipients
        .map(recipient => recipient.email.trim().toLowerCase())
        .filter(Boolean),
    ),
  );

  if (recipientEmails.length === 0) {
    throw new Error('No valid recipient email addresses were provided.');
  }

  // Use the sender as the visible To address. All congregation recipients
  // are placed in BCC so their addresses remain private. If the sender is
  // also a selected recipient, they are not duplicated in BCC.
  const visibleTo =
    input.replyTo?.trim() || recipientEmails[0];
  const blindCopies = recipientEmails.filter(
    email => email !== visibleTo.toLowerCase(),
  );

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
          to_email: visibleTo,
          bcc_email: blindCopies.join(', '),
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
      `EmailJS HTTP ${response.status}: ${ responseText || 'Unknown EmailJS error' }`,
    );
  }
}
