export const verifyEmailTemplate = (otp: string) => {
  return {
    subject: "Verify your email",

    text: `
Verify your email

Thanks for signing up to Foodie.

Your verification code is: ${otp}

This code expires in 10 minutes.

If you didn't create an account, you can ignore this email.

— Foodie
    `.trim(),

    html: `
      <div style="
        max-width: 480px;
        margin: 40px auto;
        padding: 32px;
        font-family: Arial, sans-serif;
        color: #1f2937;
        background: #ffffff;
        border: 1px solid #e5e7eb;
        border-radius: 12px;
        text-align: center;
      ">
        <h2 style="margin: 0 0 12px;">Verify your email</h2>

        <p style="color: #6b7280;">
          Thanks for signing up to Foodie.
          Use the code below to verify your email address.
        </p>

        <div style="
          margin: 24px 0;
          padding: 16px;
          background: #f3f4f6;
          border-radius: 8px;
          font-size: 32px;
          font-weight: bold;
          letter-spacing: 8px;
        ">
          ${otp}
        </div>

        <p style="font-size: 14px; color: #6b7280;">
          This code expires in <strong>10 minutes</strong>.
        </p>

        <p style="
          margin-top: 24px;
          font-size: 13px;
          color: #9ca3af;
        ">
          If you didn't create an account, you can safely ignore this email.
        </p>
      </div>
    `.trim(),
  };
};
