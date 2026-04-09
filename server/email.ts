import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = "Swing Studio <noreply@swingstudio.ai>";
const APP_URL = process.env.APP_URL || "https://swingstudio.ai";

export async function sendCoachInviteEmail(
  email: string,
  coachName: string,
  token: string,
  hasAccount: boolean,
) {
  const link = hasAccount
    ? `${APP_URL}/invite/accept?token=${token}`
    : `${APP_URL}/auth?invite=${token}`;

  await resend.emails.send({
    from: FROM,
    to: email,
    subject: `${coachName} invited you to Swing Studio`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
        <h2 style="margin: 0 0 8px; font-size: 22px;">You've been invited</h2>
        <p style="color: #666; margin: 0 0 24px;">
          <strong>${coachName}</strong> has invited you to connect on Swing Studio
          so they can review and share analysis sessions with you.
        </p>
        <a href="${link}"
           style="display: inline-block; background: #2563eb; color: #fff; text-decoration: none;
                  padding: 12px 28px; border-radius: 6px; font-weight: 600; font-size: 15px;">
          ${hasAccount ? "Accept Invitation" : "Create Account & Accept"}
        </a>
        <p style="color: #999; font-size: 13px; margin: 24px 0 0;">
          This invitation expires in 7 days. If you don't know ${coachName}, you can safely ignore this email.
        </p>
        <p style="color: #bbb; font-size: 12px; margin: 8px 0 0;">
          Or copy this link: ${link}
        </p>
      </div>
    `,
  });
}

export async function sendStreakAtRiskEmail(email: string, firstName: string, streak: number) {
  await resend.emails.send({
    from: FROM,
    to: email,
    subject: `Your ${streak}-day streak ends tonight`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
        <h2 style="margin: 0 0 8px; font-size: 22px;">Don't break the chain, ${firstName}.</h2>
        <p style="color: #666; margin: 0 0 8px;">You're on a <strong>${streak}-day training streak</strong> — don't let it end tonight.</p>
        <p style="color: #666; margin: 0 0 24px;">One session is all it takes. Breathing, pitch recognition, vision drills — anything counts.</p>
        <a href="${APP_URL}/enhance"
           style="display: inline-block; background: #2563eb; color: #fff; text-decoration: none;
                  padding: 12px 28px; border-radius: 6px; font-weight: 600; font-size: 15px;">
          Train Now
        </a>
        <p style="color: #bbb; font-size: 12px; margin: 24px 0 0;">Swing Studio · <a href="${APP_URL}/my-studio" style="color: #bbb;">My Studio</a></p>
      </div>
    `,
  });
}

export async function sendStreakBrokenEmail(email: string, firstName: string, streak: number) {
  await resend.emails.send({
    from: FROM,
    to: email,
    subject: `You broke your ${streak}-day streak — here's how to restart`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
        <h2 style="margin: 0 0 8px; font-size: 22px;">It happens, ${firstName}.</h2>
        <p style="color: #666; margin: 0 0 8px;">Your <strong>${streak}-day streak</strong> ended yesterday — but the work you put in doesn't disappear.</p>
        <p style="color: #666; margin: 0 0 24px;">The best hitters don't quit after a bad at-bat. Start a new streak today.</p>
        <a href="${APP_URL}/enhance"
           style="display: inline-block; background: #2563eb; color: #fff; text-decoration: none;
                  padding: 12px 28px; border-radius: 6px; font-weight: 600; font-size: 15px;">
          Start Fresh
        </a>
        <p style="color: #bbb; font-size: 12px; margin: 24px 0 0;">Swing Studio · <a href="${APP_URL}/my-studio" style="color: #bbb;">My Studio</a></p>
      </div>
    `,
  });
}

export async function sendStreakMilestoneEmail(email: string, firstName: string, streak: number, badgeName: string) {
  await resend.emails.send({
    from: FROM,
    to: email,
    subject: `${streak}-day streak — you earned "${badgeName}"`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
        <h2 style="margin: 0 0 8px; font-size: 22px;">${streak} days straight, ${firstName}.</h2>
        <p style="color: #666; margin: 0 0 8px;">You just earned the <strong>${badgeName}</strong> badge.</p>
        <p style="color: #666; margin: 0 0 24px;">Most players stop after a few reps. You keep going. That's what separates the ones who get better.</p>
        <a href="${APP_URL}/my-studio"
           style="display: inline-block; background: #2563eb; color: #fff; text-decoration: none;
                  padding: 12px 28px; border-radius: 6px; font-weight: 600; font-size: 15px;">
          View Your Badge
        </a>
        <p style="color: #bbb; font-size: 12px; margin: 24px 0 0;">Swing Studio · <a href="${APP_URL}/my-studio" style="color: #bbb;">My Studio</a></p>
      </div>
    `,
  });
}

export async function sendWeeklyRecapEmail(
  email: string,
  firstName: string,
  sessionsLastWeek: number,
  streakDays: number,
  modulesUsed: string[],
) {
  const moduleList = modulesUsed.length > 0
    ? modulesUsed.join(", ")
    : "No modules this week";
  await resend.emails.send({
    from: FROM,
    to: email,
    subject: `Your Swing Studio week in review`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
        <h2 style="margin: 0 0 8px; font-size: 22px;">Last week, ${firstName}</h2>
        <table style="width: 100%; border-collapse: collapse; margin: 0 0 24px;">
          <tr>
            <td style="padding: 12px; background: #f8f9fa; border-radius: 6px; text-align: center; width: 33%;">
              <div style="font-size: 24px; font-weight: 700;">${sessionsLastWeek}</div>
              <div style="font-size: 12px; color: #666;">sessions</div>
            </td>
            <td style="width: 8px;"></td>
            <td style="padding: 12px; background: #f8f9fa; border-radius: 6px; text-align: center; width: 33%;">
              <div style="font-size: 24px; font-weight: 700;">${streakDays}</div>
              <div style="font-size: 12px; color: #666;">day streak</div>
            </td>
            <td style="width: 8px;"></td>
            <td style="padding: 12px; background: #f8f9fa; border-radius: 6px; text-align: center; width: 33%;">
              <div style="font-size: 14px; font-weight: 600;">${moduleList}</div>
              <div style="font-size: 12px; color: #666;">trained</div>
            </td>
          </tr>
        </table>
        <a href="${APP_URL}/enhance"
           style="display: inline-block; background: #2563eb; color: #fff; text-decoration: none;
                  padding: 12px 28px; border-radius: 6px; font-weight: 600; font-size: 15px;">
          Keep It Going
        </a>
        <p style="color: #bbb; font-size: 12px; margin: 24px 0 0;">Swing Studio · <a href="${APP_URL}/my-studio" style="color: #bbb;">My Studio</a></p>
      </div>
    `,
  });
}

export async function sendReengagementEmail(email: string, firstName: string, daysSince: number) {
  await resend.emails.send({
    from: FROM,
    to: email,
    subject: `It's been ${daysSince} days — your training is waiting`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
        <h2 style="margin: 0 0 8px; font-size: 22px;">Miss us, ${firstName}?</h2>
        <p style="color: #666; margin: 0 0 8px;">It's been ${daysSince} days since your last session. Your competitors didn't take the day off.</p>
        <p style="color: #666; margin: 0 0 24px;">Five minutes of breathing + affirmations is enough to get back in the groove.</p>
        <a href="${APP_URL}/enhance"
           style="display: inline-block; background: #2563eb; color: #fff; text-decoration: none;
                  padding: 12px 28px; border-radius: 6px; font-weight: 600; font-size: 15px;">
          Get Back In It
        </a>
        <p style="color: #bbb; font-size: 12px; margin: 24px 0 0;">Swing Studio · <a href="${APP_URL}/my-studio" style="color: #bbb;">My Studio</a></p>
      </div>
    `,
  });
}

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
