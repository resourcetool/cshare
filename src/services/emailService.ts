
const EMAILJS_ENDPOINT =
  'https://api.emailjs.com/api/v1.0/email/send';

export const EMAILJS_CONFIG = {
  publicKey: 'zrqiU_Pb_ZfWPFNmb',
  serviceId: 'service_x5j443l',
  templateId: 'template_f1arceh',
} as const;

// CHANGE THIS to the congregation email address
// that should appear in the visible To field.
const VISIBLE_TO_EMAIL = 'your-congregation-email@example.com';

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
  // Validate the visible recipient address.
  const visibleTo = VISIBLE_TO_EMAIL.trim().toLowerCase();

  if (!visibleTo || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(visibleTo)) {
    throw new Error(
      'Please configure a valid congregation email address in VISIBLE_TO_EMAIL.',
    );
  }

  // Collect and remove duplicate recipient addresses.
  const recipientEmails = Array.from(
    new Set(
      input.recipients
        .map(recipient => recipient.email.trim().toLowerCase())
        .filter(email =>
          /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
        ),
    ),
  );

  if (recipientEmails.length === 0) {
    throw new Error(
      'No valid recipient email addresses were provided.',
    );
  }

  // Exclude the visible To address from BCC to prevent duplication.
  const blindCopies = recipientEmails.filter(
    email => email !== visibleTo,
  );

  if (blindCopies.length === 0) {
    throw new Error(
      'No congregation members remain in BCC after excluding the visible To address.',
    );
  }

  const templateParams = {
    to_email: visibleTo,
    to_name: VISIBLE_TO_NAME,
    bcc_email: blindCopies.join(', '),
    subject: input.subject,
    message: input.message,
    from_name:
      input.senderName?.trim() || 'CSHARE Administration',
    reply_to: input.replyTo?.trim() || visibleTo,
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
