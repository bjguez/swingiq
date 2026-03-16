import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = "Swing Studio <noreply@swingstudio.ai>";
const APP_URL = process.env.APP_URL || "https://swingstudio.ai";

export async function sendVerificationEmail(email: string, token: string) {
  const link = `${APP_URL}/verify?token=${token}`;

  await resend.emails.send({
    from: FROM,
    to: email,
    subject: "Verify your Swing Studio account",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
        <h2 style="margin: 0 0 8px; font-size: 22px;">Welcome to Swing Studio</h2>
        <p style="color: #666; margin: 0 0 24px;">Click the button below to verify your email address and activate your account.</p>
        <a href="${link}"
           style="display: inline-block; background: #2563eb; color: #fff; text-decoration: none;
                  padding: 12px 28px; border-radius: 6px; font-weight: 600; font-size: 15px;">
          Verify Email
        </a>
        <p style="color: #999; font-size: 13px; margin: 24px 0 0;">
          This link expires in 24 hours. If you didn't create an account, you can safely ignore this email.
        </p>
        <p style="color: #bbb; font-size: 12px; margin: 8px 0 0;">
          Or copy this link: ${link}
        </p>
      </div>
    `,
  });
}
