export type SessionDto = {
  id: string;
  deviceName: string | null;
  userAgent: string | null;
  ipAddress: string | null;
  country: string | null;
  city: string | null;
  lastActivityAt: Date | null;
  expiresAt: Date;
  createdAt: Date;

  // Lets the frontend identify the device
  // currently being used by the user.
  isCurrent: boolean;
};

export type GetSessionsResponseDto = {sessions: SessionDto[];};