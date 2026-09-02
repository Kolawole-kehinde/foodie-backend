import type { PrismaClient } from "@prisma/client";
import type { UserRepository } from "../repositories/user.repository.js";
import type { PendingRegistrationRepository } from "../repositories/pending-registration.repository.js";
import type { EmailQueueService } from "../../../queues/email/email.service.js";
import type { PasswordService } from "../services/password.service.js";
import type { TokenService } from "../services/token.service.js";
import type { AuditService } from "../services/audit.service.js";
import type { UserSessionRepository } from "../repositories/user-session.repository.js";
import type { RefreshTokenRepository } from "../repositories/refresh-token.repository.js";
import type { LoginAttemptRepository } from "../repositories/login-attempt.repository.js";
import type { ImpossibleTravelService } from "../security/impossible-travel.service.js";
import type { GeoLocationService } from "../security/geo-location.service.js";
import type { SecurityEventService } from "../security/security-event.service.js";
import type { SessionService } from "../services/session.service.js";
import type { PasswordResetTokenRepository } from "../repositories/password-reset-token.repository.js";

export type AuthContext = {
  ipAddress?: string;
  userAgent?: string;
  deviceName?: string;
  // latitude?: string;
  // longtitude?: string
};

export type AuthRepositories = {
  user: UserRepository;
  pendingRegistration: PendingRegistrationRepository;
  session: UserSessionRepository;
  refreshToken: RefreshTokenRepository;
  loginAttempt: LoginAttemptRepository;
  passwordResetToken: PasswordResetTokenRepository
};

export type AuthServices = {
  password: PasswordService;
  token: TokenService;
  audit: AuditService;
  impossibleTravel: ImpossibleTravelService;
  geoLocation: GeoLocationService;
  securityEvent: SecurityEventService;
  session: SessionService;
  
};

export type AuthQueues = {
  email: EmailQueueService;
};

export type AuthDependencies = {
  prisma: PrismaClient;
  repositories: AuthRepositories;
  services: AuthServices;
  queues: AuthQueues;
};
