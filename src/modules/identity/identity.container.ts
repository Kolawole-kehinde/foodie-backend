import { prisma } from "../../database/prisma/client.js";
import { redis } from "../../database/redis/client.js";
import { createAuthController } from "./controllers/auth.controller.js";
import { createRoleController } from "./controllers/role.controller.js";
import { createAuthorizationRepository } from "./repositories/authorization.repository.js";
import { createAuditRepository } from "./repositories/audit.repository.js";
import { createLoginAttemptRepository } from "./repositories/login-attempt.repository.js";
import { createPendingRegistrationRepository } from "./repositories/pending-registration.repository.js";
import { createPasswordResetTokenRepository } from "./repositories/password-reset-token.repository.js";
import { createRefreshTokenRepository } from "./repositories/refresh-token.repository.js";
import { createRoleRepository } from "./repositories/role.repository.js";
import { createSecurityEventRepository } from "./repositories/security-event.repository.js";
import { createUserRepository } from "./repositories/user.repository.js";
import { createUserSessionRepository } from "./repositories/user-session.repository.js";
import { createAuthRoutes } from "./routes/auth.routes.js";
import { createRoleRoutes } from "./routes/role.routes.js";
import { createGeoLocationService } from "./security/geo-location.service.js";
import { createImpossibleTravelService } from "./security/impossible-travel.service.js";
import { createSecurityEventService } from "./security/security-event.service.js";
import { createAuthorizationService } from "./services/authorization.service.js";
import { createAuditService } from "./services/audit.service.js";
import { createAuthService } from "./services/auth.service.js";
import { createPasswordService } from "./services/password.service.js";
import { createRoleService } from "./services/role.service.js";
import { createSessionService } from "./services/session.service.js";
import { createTokenService } from "./services/token.service.js";
import { createPermissionCache } from "./cache/permission.cache.js";
import { createEmailQueueService } from "../../queues/email/email.queue.service.js";
import { createAuthenticate } from "../../middlewares/authentication.js";
import { createAuthorizePermission } from "../../middlewares/authorize-permission.js";
import { createAuthorizationCacheService } from "./services/authorization-cache.service.js";

// Repositories

const userRepository = createUserRepository(prisma);
const pendingRegistrationRepository = createPendingRegistrationRepository(prisma);
const auditRepository = createAuditRepository(prisma);
const userSessionRepository = createUserSessionRepository(prisma);
const refreshTokenRepository = createRefreshTokenRepository(prisma);
const loginAttemptRepository = createLoginAttemptRepository(prisma);
const securityEventRepository = createSecurityEventRepository(prisma);
const passwordResetTokenRepository = createPasswordResetTokenRepository(prisma)
const authorizationRepository = createAuthorizationRepository(prisma);
const roleRepository = createRoleRepository(prisma);

// Security / Infrastructure Services
const passwordService = createPasswordService();
const tokenService = createTokenService();
const auditService = createAuditService(auditRepository);
const emailQueueService = createEmailQueueService();
const impossibleTravel = createImpossibleTravelService();
const geoLocation = createGeoLocationService();
const securityEventService = createSecurityEventService(securityEventRepository);
const sessionService = createSessionService({
  sessionRepository: userSessionRepository,
});

// Authorization

const permissionCache = createPermissionCache({
  redis,
});

const authorizationCacheService = createAuthorizationCacheService({
  permissionCache,
});

const authorizationService = createAuthorizationService({
  authorizationRepository,
  permissionCache,
});

const authorizePermission = createAuthorizePermission({
  authorizationService,
});


// Authentication
const authenticate = createAuthenticate({
  tokenService,
  sessionService,
});

// Role Management
const roleService = createRoleService({
  roleRepository,
  authorizationCacheService,
});

// Auth Service
const authService = createAuthService({
  prisma,

  repositories: {
    user: userRepository,
    pendingRegistration: pendingRegistrationRepository,
    session: userSessionRepository,
    refreshToken: refreshTokenRepository,
    loginAttempt: loginAttemptRepository,
    passwordResetToken: passwordResetTokenRepository,
  },

  services: {
    password: passwordService,
    token: tokenService,
    audit: auditService,
    impossibleTravel,
    geoLocation,
    securityEvent: securityEventService,
    session: sessionService,
  },

  queues: {
    email: emailQueueService,
  },
});

// Controllers

const authController = createAuthController({
  authService,
});

const roleController = createRoleController({
  roleService,
});

// Routes

const authRoutes = createAuthRoutes({
  authController,
  authenticate,
});

const roleRoutes = createRoleRoutes({
  roleController,
  authenticate,
  authorizePermission,
});

// Public Identity Dependencies

export {
  authRoutes,
  roleRoutes,
  authenticate,
  authorizePermission,
  authorizationService,
  authorizationRepository,
  sessionService,
  userRepository,
  userSessionRepository,
  authService,
  permissionCache,
  roleRepository,
  roleService,
  roleController,
};