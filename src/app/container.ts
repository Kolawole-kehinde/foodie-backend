import type { Router } from "express";
import { prisma } from "../database/prisma/client.js";
import { createAuthController } from "../modules/identity/controllers/auth.controller.js";
import { createAuditRepository } from "../modules/identity/repositories/audit.repository.js";
import { createLoginAttemptRepository } from "../modules/identity/repositories/login-attempt.repository.js";
import { createPendingRegistrationRepository } from "../modules/identity/repositories/pending-registration.repository.js";
import { createRefreshTokenRepository } from "../modules/identity/repositories/refresh-token.repository.js";
import { createSecurityEventRepository } from "../modules/identity/repositories/security-event.repository.js";
import { createUserSessionRepository } from "../modules/identity/repositories/user-session.repository.js";
import { createUserRepository } from "../modules/identity/repositories/user.repository.js";
import { createAuthRoutes } from "../modules/identity/routes/auth.routes.js";
import { createGeoLocationService } from "../modules/identity/security/geo-location.service.js";
import { createImpossibleTravelService } from "../modules/identity/security/impossible-travel.service.js";
import { createSecurityEventService } from "../modules/identity/security/security-event.service.js";
import { createAuditService } from "../modules/identity/services/audit.service.js";
import { createAuthService } from "../modules/identity/services/auth.service.js";
import { createPasswordService } from "../modules/identity/services/password.service.js";
import { createTokenService } from "../modules/identity/services/token.service.js";
import { createEmailQueueService } from "../queues/email/email.service.js";

// Repositories
const userRepository = createUserRepository(prisma);
const pendingRegistrationRepository = createPendingRegistrationRepository(prisma);
const auditRepository = createAuditRepository(prisma);
const userSessionRepository = createUserSessionRepository(prisma);
const refreshTokenRepository = createRefreshTokenRepository(prisma);
const loginAttemptRepository = createLoginAttemptRepository(prisma);
const securityEventRepository = createSecurityEventRepository(prisma);
const securityEventService =
  createSecurityEventService(securityEventRepository);

// Infrastructure services
const passwordService = createPasswordService();
const tokenService = createTokenService();
const auditService = createAuditService(auditRepository);
const emailQueueService = createEmailQueueService();
const impossibleTravel = createImpossibleTravelService();
const geoLocation = createGeoLocationService();

// Auth service
const authService = createAuthService({
  prisma,

  repositories: {
    user: userRepository,
    pendingRegistration: pendingRegistrationRepository,
    session: userSessionRepository,
    refreshToken: refreshTokenRepository,
    loginAttempt: loginAttemptRepository,
  },

  services: {
    password: passwordService,
    token: tokenService,
    audit: auditService,
    impossibleTravel,
    geoLocation,
    securityEvent: securityEventService,
  },

  queues: {
    email: emailQueueService,
  },
});

// Controller
const authController = createAuthController({
  authService,
});

// Routes
export const authRoutes: Router = createAuthRoutes({
  authController,
});
