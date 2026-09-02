export type ForgotPasswordDto = {
  email: string;
};


export type ResetPasswordDto = {
  token: string;
  newPassword: string;
};

export type ForgotPasswordResponseDto = {
  message: string;
};