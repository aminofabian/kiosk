import { Resend } from 'resend';

if (!process.env.RESEND_API_KEY) {
  throw new Error('RESEND_API_KEY is not set');
}

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'noreply@kiosk.co.ke';
const APP_NAME = process.env.APP_NAME || 'POS System';

export async function sendPasswordResetEmail(
  email: string,
  resetToken: string,
  resetUrl: string
): Promise<void> {
  try {
    console.log(`Attempting to send password reset email to: ${email}`);
    console.log(`From email: ${FROM_EMAIL}`);
    console.log(`Reset URL: ${resetUrl}`);
    
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `Reset Your ${APP_NAME} Password`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Reset Your Password</title>
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(to right, #059669, #0d9488); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 24px;">Password Reset Request</h1>
            </div>
            <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb;">
              <p style="margin-top: 0;">Hello,</p>
              <p>We received a request to reset your password for your ${APP_NAME} account.</p>
              <p>Click the button below to reset your password:</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(to right, #059669, #0d9488); color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600;">Reset Password</a>
              </div>
              <p style="font-size: 14px; color: #6b7280;">Or copy and paste this link into your browser:</p>
              <p style="font-size: 12px; color: #9ca3af; word-break: break-all; background: #f3f4f6; padding: 10px; border-radius: 4px;">${resetUrl}</p>
              <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">This link will expire in 1 hour.</p>
              <p style="font-size: 14px; color: #6b7280;">If you didn't request a password reset, please ignore this email.</p>
            </div>
            <div style="text-align: center; margin-top: 20px; font-size: 12px; color: #9ca3af;">
              <p>© ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
            </div>
          </body>
        </html>
      `,
    });

    console.log('Resend API response:', JSON.stringify(result, null, 2));
    
    if (result.error) {
      console.error('Resend API error:', result.error);
      throw new Error(`Resend API error: ${JSON.stringify(result.error)}`);
    }

    if (result.data) {
      console.log(`✅ Email sent successfully. Email ID: ${result.data.id}`);
    }
  } catch (error) {
    console.error('Failed to send password reset email:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to send password reset email: ${String(error)}`);
  }
}

