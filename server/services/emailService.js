function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendVerificationEmail(email, code) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    console.error('[EMAIL] BREVO_API_KEY not set');
    return { sent: false, error: 'Email service not configured' };
  }

  const senderEmail = process.env.EMAIL_FROM || 'betsking02@gmail.com';
  const senderName = process.env.EMAIL_FROM_NAME || 'BetKing';

  console.log(`[EMAIL] Sending verification to ${email} via Brevo`);

  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender: { name: senderName, email: senderEmail },
        to: [{ email: email }],
        subject: 'BetKing - Email Verification Code',
        htmlContent: `
          <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; background: #0f1923; color: #fff; border-radius: 12px; overflow: hidden;">
            <div style="background: linear-gradient(135deg, #1a2c38, #213743); padding: 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffd700; font-size: 28px;">&#9813; BetKing</h1>
              <p style="color: #b1bad3; margin-top: 8px; font-size: 14px;">Email Verification</p>
            </div>
            <div style="padding: 30px; text-align: center;">
              <p style="color: #b1bad3; font-size: 15px; margin-bottom: 20px;">Enter this code to verify your email address:</p>
              <div style="background: #213743; border: 2px solid #00e701; border-radius: 10px; padding: 20px; display: inline-block; letter-spacing: 8px; font-size: 32px; font-weight: bold; color: #00e701;">
                ${code}
              </div>
              <p style="color: #7a8a9e; font-size: 13px; margin-top: 20px;">This code expires in <strong>10 minutes</strong>.</p>
              <p style="color: #7a8a9e; font-size: 12px; margin-top: 16px;">If you didn't create an account on BetKing, you can ignore this email.</p>
            </div>
            <div style="background: #0e1b28; padding: 16px; text-align: center;">
              <p style="color: #5a6a7e; font-size: 11px; margin: 0;">BetKing | Online Betting & Casino | Play Responsibly</p>
            </div>
          </div>
        `,
      }),
    });

    const data = await res.json();

    if (res.ok) {
      console.log(`[EMAIL] SUCCESS - sent to ${email}, messageId: ${data.messageId}`);
      return { sent: true };
    } else {
      console.error(`[EMAIL] FAILED -`, data);
      return { sent: false, error: data.message || 'Email send failed' };
    }
  } catch (err) {
    console.error(`[EMAIL] FAILED - ${err.message}`);
    return { sent: false, error: err.message };
  }
}

async function testEmailConfig() {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    return { ok: false, error: 'BREVO_API_KEY not set' };
  }

  try {
    // Check Brevo account info to verify the API key works
    const res = await fetch('https://api.brevo.com/v3/account', {
      headers: { 'api-key': apiKey },
    });
    const data = await res.json();
    if (res.ok) {
      return { ok: true, service: 'Brevo', email: data.email };
    }
    return { ok: false, error: data.message || 'Invalid API key' };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

module.exports = { generateCode, sendVerificationEmail, testEmailConfig };
