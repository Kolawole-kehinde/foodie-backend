import type { PrismaClient } from "@prisma/client";
import type {UserRepository,} from "../repositories/user.repository.js";
import type {PendingRegistrationRepository} from "../repositories/pending-registration.repository.js";
import type { EmailQueueService } from "../../../queues/email/email.service.js";
import type { PasswordService } from "../services/password.service.js";
import type { TokenService } from "../services/token.service.js";
import type { AuditService } from "../services/audit.service.js";
import type { UserSessionRepository } from "../repositories/user-session.repository.js";
import type { RefreshTokenRepository } from "../repositories/refresh-token.repository.js";
import type { LoginAttemptRepository } from "../repositories/login-attempt.repository.js";

export type AuthContext = {
  ipAddress?: string;
  userAgent?: string;
  deviceName?: string;
};

export type AuthRepositories = {
  user: UserRepository;
  pendingRegistration: PendingRegistrationRepository;
  session: UserSessionRepository;
  refreshToken: RefreshTokenRepository;
  loginAttempt: LoginAttemptRepository
};

export type AuthServices = {
  password: PasswordService;
  token: TokenService;
  audit: AuditService;
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