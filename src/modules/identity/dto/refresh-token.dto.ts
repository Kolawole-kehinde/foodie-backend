export type RefreshResponseDto = {
  accessToken: string;
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