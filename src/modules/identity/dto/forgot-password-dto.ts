import { z } from "../../../docs/zod-openapi.js";

export type ForgotPasswordDto = {
  email: string;
};


export type ResetPasswordDto = {
  token: string;
  newPassword: string;
  confirmPassword: string;
};



export const forgotPasswordResponseSchema = z.object({
  message: z.string().meta({
    description: "Generic response to prevent email enumeration",
    example:
      "If an account exists with this email, a password reset link has been sent.",
  }),
});

export type ForgotPasswordResponseDto = z.infer<
  typeof forgotPasswordResponseSchema
>;