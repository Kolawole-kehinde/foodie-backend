import type { UserSessionRepository } from "../repositories/user-session.repository.js";
import { UnauthorizedError } from "../../../shared/errors/UnauthorizedError.js";
import type { GetSessionsResponseDto, SessionDto } from "../dto/session.dto.js";
import { NotFoundError } from "../../../shared/errors/NotFoundError.js";
import { env } from "../../../config/env.js";

type SessionServiceDependencies = {
  sessionRepository: UserSessionRepository;
};

export const createSessionService = ({
  sessionRepository,
}: SessionServiceDependencies) => {
  // Find the session only if it is active.
  const validateSession = async (sessionId: string) => {
    const session = await sessionRepository.findActiveById(sessionId);

    if (!session) {
      throw new UnauthorizedError("Session is no longer active");
    }

    return session;
  };

  // Revoke a single session.
  const revokeSession = async (userId: string, sessionId: string) => {
    const result = await sessionRepository.revokeForUser(userId, sessionId);

    if (result.count === 0) {
      throw new NotFoundError("Session not found");
    }

    return {
      message: "Session revoked successfully",
    };
  };

  // Get all active sessions belonging to a user.
  const getActiveSessions = async (
    userId: string,
    currentSessionId: string,
  ): Promise<GetSessionsResponseDto> => {
    const sessions = await sessionRepository.findActiveByUserId(userId);
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
      isCurrent: session.id === currentSessionId,
    }));

    return {
      sessions: sessionDtos,
    };
  };

  // Enforce the maximum number of active sessions.
  const enforceSessionLimit = async (userId: string) => {
    const maxSessions = env.auth.MAX_SESSIONS_PER_USER;

    const activeSessionCount =
      await sessionRepository.countActiveByUserId(userId);

    if (activeSessionCount < maxSessions) {
      return;
    }

    const oldestSession =
      await sessionRepository.findOldestActiveByUserId(userId);

    if (!oldestSession) {
      return;
    }

    await sessionRepository.revoke(oldestSession.id, "SESSION_LIMIT_EXCEEDED");
  };

  return {
    validateSession,
    getActiveSessions,
    revokeSession,
    enforceSessionLimit,
  };
};

export type SessionService = ReturnType<typeof createSessionService>;
