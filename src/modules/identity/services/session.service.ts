import type { UserSessionRepository } from "../repositories/user-session.repository.js";
import { UnauthorizedError } from "../../../shared/errors/UnauthorizedError.js";
import type { GetSessionsResponseDto, SessionDto } from "../dto/session.dto.js";
import { NotFoundError } from "../../../shared/errors/NotFoundError.js";

type SessionServiceDependencies = {
  sessionRepository: UserSessionRepository;
};

// 1. Find the session only if it is active.
// The repository checks:
// - session exists
// - session has not been revoked
// - session has not expired
export const createSessionService = ({
  sessionRepository,
}: SessionServiceDependencies) => {
  const validateSession = async (sessionId: string) => {
    const session = await sessionRepository.findActiveById(sessionId);

    // 2. Reject the request if the session is no longer active.
    if (!session) {
      throw new UnauthorizedError("Session is no longer active");
    }

    // 3. Return the active session.
    return session;
  };

  // revoke a single session
  const revokeSession = async (userId: string, sessionId: string) => {
    const result = await sessionRepository.revokeForUser(userId, sessionId);

    // count === 0 means the session either:
    // - does not exist
    // - belongs to another user
    // - has already been revoked

    if (result.count === 0) {
      throw new NotFoundError("Session not found");
    }

    return {
      message: "Session revoked successfully",
    };
  };



  //  Get all active sessions belonging to a user.
  // currentSessionId is used to tell the frontend which session is currently making the request.
  const getActiveSessions = async (userId: string,currentSessionId: string,): Promise<GetSessionsResponseDto> => {
    const sessions = await sessionRepository.findActiveByUserId(userId);

    // Convert the database session into the public SessionDto.
    //  We deliberately return only the fields that the API is supposed to expose.
    const sessionDtos: SessionDto[] = sessions.map((session) => ({
      id: session.id,
      deviceName: session.deviceName,
      userAgent: session.userAgent,
      ipAddress: session.ipAddress,
      country: session.country,
      city: session.city,
      lastActivityAt: session.lastActivityAt,
      expiresAt: session.expiresAt,
      createdAt: session.createdAt,

      // Identify the session being used for this request.
      isCurrent: session.id === currentSessionId,
    }));

    return {
      sessions: sessionDtos,
    };
  };

  return {
    validateSession,
    getActiveSessions,
    revokeSession,
  };
};

export type SessionService = ReturnType<typeof createSessionService>;
