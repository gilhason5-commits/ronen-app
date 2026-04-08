/**
 * Shared Twilio WhatsApp helper.
 * Uses ContentSid (approved templates) for all outbound messages.
 */

const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const FROM = `whatsapp:${process.env.TWILIO_PHONE_NUMBER}`;

// Template SIDs
export const TEMPLATES = {
  ARRIVE_TODAY:              'HX62c0b5da0411f3fa4ce3e7db287321b8', // "מגיע היום?"
  NO_ANSWER_ESC:             'HXe4763fc016f5e2e1600d909d53d8228c', // אסקלציה - לא ענה
  MANAGER_UNAVAILABLE_ESC:   'HX1b5558913e7e01ae8a6df5429626caaa', // עובד לא זמין → מנהלת
  TASK_ESCALATION:           'HX65d2161eeee74063f64295eb7e926c19', // משימה לא בוצעה
  CEO_ESC_FINAL:             'HXa898286c3885aeb4e986bdefd224572f', // אסקלציה סופית למנכ"ל
  TASK_REMINDER:             process.env.TWILIO_CONTENT_SID || 'HX621b3679fb5f5f6fff0087b68b7f031b', // תזכורת משימה
};

/**
 * Send a WhatsApp template message.
 * @param {string} to - E.164 phone number
 * @param {string} contentSid - Twilio Content SID (HX...)
 * @param {object} variables - template variables e.g. {"1": "value"}
 */
export async function sendWhatsApp(to, contentSid, variables = {}) {
  const body = new URLSearchParams({
    From: FROM,
    To: `whatsapp:${to}`,
    ContentSid: contentSid,
  });

  if (Object.keys(variables).length > 0) {
    body.append('ContentVariables', JSON.stringify(variables));
  }

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${ACCOUNT_SID}:${AUTH_TOKEN}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    }
  );

  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Twilio error');
  return data;
}
