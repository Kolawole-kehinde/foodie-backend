export interface RequestContext {
  requestId: string;
  startedAt: number;
  ipAddress: string;
  userAgent?: string;

  // Populated after authentication
  userId?: string;
  sessionId?: string;
}