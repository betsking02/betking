const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (!transporter && process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });
  }
  return transporter;
}

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendVerificationEmail(email, code) {
  const t = getTransporter();
  if (!t) {
    console.warn('Gmail credentials not configured - email not sent');
    return { sent: false, error: 'Email service not configured' };
  }

  const mailOptions = {
    from: `"BetKing" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: 'BetKing - Email Verification Code',
    html: `
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
          <p style="color: #5a6a7e; font-size: 11px; margin: 0;">BetKing - Demo Platform | No real money involved</p>
        </div>
      </div>
    `,
  };

  try {
    await t.sendMail(mailOptions);
    console.log(`Verification email sent to ${email}`);
    return { sent: true };
  } catch (err) {
    console.error('Email send failed:', err.message);
    return { sent: false, error: err.message };
  }
}

module.exports = { generateCode, sendVerificationEmail };
