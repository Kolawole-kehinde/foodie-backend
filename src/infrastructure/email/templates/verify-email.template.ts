


export const verifyEmailTemplate = (otp: string) => {
  return {
    subject: "Verify your email",

    text: `
      Your email verification code is:

      ${otp}

      Enter this code in the verification page to verify your email address.

      This code expires in 10 minutes.
    `,

    html: `
      <h2>Verify your email</h2>

      <p>
        Your email verification code is:
      </p>

      <h1>${otp}</h1>

      <p>
        Enter this code in the verification page to verify your email address.
      </p>

      <p>
        This code expires in 10 minutes.
      </p>
    `,
  };
};
