declare global {
  namespace Express {
    interface Request {
      user: AccessTokenPayload & {
        id: string;
      };

      id?: string;

      context?: {
        requestId?: string;
        [key: string]: unknown;
      };
    }
  }
}

export {};
