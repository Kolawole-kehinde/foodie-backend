import { prisma } from "../database/prisma/client.js";

import { createAuthController } from "../modules/identity/controllers/auth.controller.js";
import { createAuditRepository } from "../modules/identity/repositories/audit.repository.js";
import { createUserRepository } from "../modules/identity/repositories/user.repository.js";
import { createAuthRoutes } from "../modules/identity/routes/auth.routes.js";
import { createAuditService } from "../modules/identity/services/audit.service.js";
import { createAuthService } from "../modules/identity/services/auth.service.js";
import { createPasswordService } from "../modules/identity/services/password.service.js";
import { createTokenService } from "../modules/identity/services/token.service.js";

const userRepository = createUserRepository(prisma);

const auditRepository = createAuditRepository(prisma);

const passwordService = createPasswordService();

const tokenService = createTokenService();

const auditService = createAuditService(auditRepository);

const authService = createAuthService({
  prisma,
  userRepository,
  passwordService,
  tokenService,
  auditService,
});

const authController = createAuthController({
  authService,
});

export const authRoutes = createAuthRoutes({
  authController,
});