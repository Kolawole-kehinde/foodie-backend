export type RefreshResponseDto = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: {
    id: string;
    email: string;
    roles: string[];
  };
};

export type RefreshRequestDto = {
  refreshToken: string;
};