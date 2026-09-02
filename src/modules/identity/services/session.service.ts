import type { UserSessionRepository } from "../repositories/user-session.repository.js";
import { UnauthorizedError } from "../../../shared/errors/UnauthorizedError.js";

type SessionServiceDependencies = {
  sessionRepository: UserSessionRepository;
};


 // 1. Find the session only if it is active.
    // The repository checks:
    // - session exists
    // - session has not been revoked
    // - session has not expired
export const createSessionService = ({sessionRepository}: SessionServiceDependencies) => {

  const validateSession = async (sessionId: string) => {
   
    const session = await sessionRepository.findActiveById(sessionId);

    // 2. Reject the request if the session is no longer active.
    if (!session) {
      throw new UnauthorizedError("Session is no longer active");
    }

    // 3. Return the active session.
    return session;
  };


  //  Get all active sessions belonging to a user.
   // The repository already filters out:
   // -revoked sessions
   // - expired sessions
  const getActiveSessions = async (userId: string) => {
      return sessionRepository.findActiveByUserId(userId);
  };

  return {
    validateSession,
    getActiveSessions
  };
};

export type SessionService = ReturnType<typeof createSessionService>;
