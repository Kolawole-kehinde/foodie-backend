import type { PrismaClient } from "@prisma/client";
import type {UserRepository,} from "../repositories/user.repository.js";
import type {PendingRegistrationRepository} from "../repositories/pending-registration.repository.js";


import type { EmailQueueService } from "../../../queues/email/email.service.js";
import type { PasswordService } from "../infrastructure/password.service.js";
import type { TokenService } from "../infrastructure/token.service.js";
import type { AuditService } from "../infrastructure/audit.service.js";

export type AuthContext = {
  ipAddress?: string;
  userAgent?: string;
  deviceName?: string;
};

export type AuthRepositories = {
  user: UserRepository;
  pendingRegistration: PendingRegistrationRepository;
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