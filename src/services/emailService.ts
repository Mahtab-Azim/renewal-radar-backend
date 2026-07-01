import nodemailer from 'nodemailer';
import { env } from '../config/env';

// Create a transporter using SMTP settings if provided, otherwise default to a mock console logger
let transporter: nodemailer.Transporter | null = null;

if (env.smtp.user && env.smtp.pass) {
  transporter = nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    auth: {
      user: env.smtp.user,
      pass: env.smtp.pass,
    },
  });
  console.log('✅ Email service initialized with SMTP credentials.');
} else {
  console.log('ℹ️ Email service initialized in Mock/Console-only mode (No SMTP credentials provided).');
}

export const sendEmail = async (to: string, subject: string, html: string): Promise<boolean> => {
  try {
    if (transporter) {
      const info = await transporter.sendMail({
        from: env.smtp.from,
        to,
        subject,
        html,
      });
      console.log(`✉️ Email successfully sent to ${to}. Message ID: ${info.messageId}`);
      return true;
    } else {
      console.log(`[MOCK EMAIL] To: ${to}`);
      console.log(`[MOCK EMAIL] Subject: ${subject}`);
      console.log(`[MOCK EMAIL] Body (HTML):\n${html}\n----------------------------------------`);
      return true;
    }
  } catch (error) {
    console.error('❌ Failed to send email:', error);
    return false;
  }
};

// Template helper for renewal reminder
export const getReminderEmailHtml = (
  userName: string | null,
  itemName: string,
  category: string,
  expiryDate: Date,
  daysRemaining: number
): string => {
  const formattedDate = new Date(expiryDate).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
      <h2 style="color: #4f46e5; text-align: center;">Renewal Radar Reminder</h2>
      <p>Hello ${userName || 'User'},</p>
      <p>This is a friendly reminder that your subscription/item is expiring soon.</p>
      
      <div style="background-color: #f3f4f6; padding: 15px; border-radius: 6px; margin: 20px 0;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 5px 0; font-weight: bold; color: #374151; width: 120px;">Item:</td>
            <td style="padding: 5px 0; color: #4b5563;">${itemName}</td>
          </tr>
          <tr>
            <td style="padding: 5px 0; font-weight: bold; color: #374151;">Category:</td>
            <td style="padding: 5px 0; color: #4b5563;">${category}</td>
          </tr>
          <tr>
            <td style="padding: 5px 0; font-weight: bold; color: #374151;">Expiry Date:</td>
            <td style="padding: 5px 0; color: #ef4444; font-weight: bold;">${formattedDate}</td>
          </tr>
          <tr>
            <td style="padding: 5px 0; font-weight: bold; color: #374151;">Time Left:</td>
            <td style="padding: 5px 0; color: #ef4444; font-weight: bold;">${daysRemaining} day(s)</td>
          </tr>
        </table>
      </div>
      
      <p style="text-align: center; margin-top: 30px;">
        <a href="#" style="background-color: #4f46e5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">View on Renewal Radar</a>
      </p>
      
      <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 30px 0;" />
      <p style="font-size: 12px; color: #9ca3af; text-align: center;">This is an automated email from Renewal Radar. Please do not reply directly.</p>
    </div>
  `;
};
