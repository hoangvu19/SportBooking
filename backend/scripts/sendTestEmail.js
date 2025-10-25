#!/usr/bin/env node
// Simple test script to send an email using SMTP settings from backend/.env
// Usage:
//   node scripts/sendTestEmail.js recipient@example.com
// or set RECIPIENT env var

require('dotenv').config();
const nodemailer = require('nodemailer');

async function main() {
  const argv = process.argv.slice(2);
  const recipient = argv[0] || process.env.RECIPIENT || 'phamdhoangvu1@dtu.edu.vn';

  const host = (process.env.SMTP_HOST || '').trim();
  const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : undefined;
  const user = (process.env.SMTP_USER || '').trim();
  const pass = (process.env.SMTP_PASS || '').replace(/\s+/g, '').trim();
  const from = process.env.SMTP_FROM || user || `no-reply@${host || 'localhost'}`;

  console.log('Sending test email to:', recipient);

  // Build transport options similar to server helper
  let transportOptions = null;
  if (user && pass && (user.toLowerCase().endsWith('@gmail.com') || (host && host.includes('gmail')))) {
    transportOptions = { service: 'gmail', auth: { user, pass } };
  } else if (user && pass && host) {
    transportOptions = { host, port: port || 465, secure: (port || 465) === 465, auth: { user, pass }, tls: { rejectUnauthorized: false } };
  }

  try {
    let transporter;
    if (transportOptions) {
      transporter = nodemailer.createTransport(transportOptions);
      console.log('Verifying transporter...');
      await transporter.verify();
      console.log('Transporter verified (config OK)');
    } else {
      // No SMTP configured — create Ethereal test account
      console.log('No SMTP configured — creating Ethereal test account');
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: testAccount.smtp.host,
        port: testAccount.smtp.port,
        secure: testAccount.smtp.secure,
        auth: { user: testAccount.user, pass: testAccount.pass }
      });
    }

    const info = await transporter.sendMail({
      from,
      to: recipient,
      subject: 'SportBooking - Test email',
      text: `This is a test email sent from your local SportBooking backend at ${new Date().toISOString()}`,
      html: `<p>This is a <b>test email</b> sent from your local SportBooking backend at ${new Date().toISOString()}</p>`
    });

    console.log('Message sent. MessageId:', info && info.messageId);
    const preview = nodemailer.getTestMessageUrl(info);
    if (preview) {
      console.log('Preview URL (Ethereal):', preview);
    } else {
      console.log('No Ethereal preview URL — email sent via real SMTP (check recipient inbox/spam)');
    }
    process.exit(0);
  } catch (err) {
    console.error('Failed to send test email:', err && (err.message || err));
    process.exit(2);
  }
}

main();
