const nodemailer = require('nodemailer');
const dns = require('dns');
const { promisify } = require('util');

const resolve4 = promisify(dns.resolve4);

let transporter = null;
let gmailIPv4 = null;

async function getGmailIPv4() {
  if (!gmailIPv4) {
    try {
      const addresses = await resolve4('smtp.gmail.com');
      gmailIPv4 = addresses[0];
      console.log(`[EMAIL] Resolved smtp.gmail.com to IPv4: ${gmailIPv4}`);
    } catch (err) {
      console.error('[EMAIL] Failed to resolve smtp.gmail.com:', err.message);
      return null;
    }
  }
  return gmailIPv4;
}

async function getTransporter() {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) return null;

  if (!transporter) {
    const ip = await getGmailIPv4();
    if (!ip) return null;

    console.log(`[EMAIL] Creating transporter -> ${ip}:465 for ${process.env.GMAIL_USER}`);
    transporter = nodemailer.createTransport({
      host: ip,
      port: 465,
      secure: true,
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
      tls: {
        servername: 'smtp.gmail.com',
        rejectUnauthorized: true,
      },
    });
  }
  return transporter;
}

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendVerificationEmail(email, code) {
  console.log(`[EMAIL] Attempting to send verification to ${email}`);

  const t = await getTransporter();
  if (!t) {
    console.error('[EMAIL] No transporter - credentials missing or DNS failed');
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
    const info = await t.sendMail(mailOptions);
    console.log(`[EMAIL] SUCCESS - sent to ${email}, messageId: ${info.messageId}`);
    return { sent: true };
  } catch (err) {
    console.error(`[EMAIL] FAILED - ${err.code || ''} ${err.message}`);
    transporter = null;
    gmailIPv4 = null;
    return { sent: false, error: err.message };
  }
}

async function testEmailConfig() {
  const t = await getTransporter();
  if (!t) {
    return { ok: false, error: 'Credentials not set or DNS resolution failed' };
  }
  try {
    await t.verify();
    return { ok: true, user: process.env.GMAIL_USER, ip: gmailIPv4 };
  } catch (err) {
    transporter = null;
    gmailIPv4 = null;
    return { ok: false, error: err.message, code: err.code, ip: gmailIPv4 };
  }
}

module.exports = { generateCode, sendVerificationEmail, testEmailConfig };
