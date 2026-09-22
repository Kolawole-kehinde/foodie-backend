import { prisma } from "../database/prisma/client.js";
import { redis } from "../database/redis/client.js";
import { createEmailDlqService } from "../workers/services/email-dlq.service.js";
import { createEmailDlqController } from "../workers/controllers/email-dlq.controller.js";
import { createEmailDlqRoutes } from "../workers/routes/email-dlq.routes.js";
import { createS3Service } from "../infrastructure/s3/s3.service.js";
import { createMediaDependencies } from "../modules/media/media.dependencies.js";
import { createProfileDependencies } from "../modules/profile/profile.dependencies.js";

import {
  authRoutes,
  roleRoutes,
  authenticate,
  authorizePermission,
  userRoleRoutes,
  rolePermissionRoutes,
  permissionRoutes,
  userRoutes,
} from "../modules/identity/identity.container.js";
import { createCatalogDependencies } from "../modules/catalog/catalog.container.js";

// Infrastructure

const s3Service = createS3Service();

// Email DLQ

const emailDlqService = createEmailDlqService();

const emailDlqController = createEmailDlqController({
  emailDlqService,
});

const emailDlqRoutes = createEmailDlqRoutes({
  emailDlqController,
  authenticate,
  authorizePermission,
});

// Media

const media = createMediaDependencies({
  db: prisma,
  s3Service,
  authenticate,
});

// Profile

const profile = createProfileDependencies({
  db: prisma,
  s3Service,
  authenticate,
});

// Catalog

const catalog = createCatalogDependencies({
  db: prisma,
  authenticate,
  authorizePermission,
});

// Public Dependencies

export {
  prisma,
  redis,
  authRoutes,
  roleRoutes,
  userRoleRoutes,
  rolePermissionRoutes,
  permissionRoutes,
  userRoutes,
  emailDlqService,
  emailDlqController,
  emailDlqRoutes,
  media,
  profile,
  catalog,
};