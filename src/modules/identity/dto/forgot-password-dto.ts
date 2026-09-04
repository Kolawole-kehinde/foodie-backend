export type ForgotPasswordDto = {
  email: string;
};


export type ResetPasswordDto = {
  token: string;
  newPassword: string;
  confirmPassword: string;
};

export type ForgotPasswordResponseDto = {
  message: string;
};