import { prisma } from "../database/prisma/client.js";
import { authRoutes, roleRoutes, authenticate, authorizePermission, userRoleRoutes, rolePermissionRoutes, permissionRoutes} from "../modules/identity/identity.container.js";
import { createEmailDlqService } from "../workers/services/email-dlq.service.js";
import { createEmailDlqController } from "../workers/controllers/email-dlq.controller.js";
import { createEmailDlqRoutes } from "../workers/routes/email-dlq.routes.js";
import { createS3Service } from "../infrastructure/s3/s3.service.js";
import { createMediaDependencies } from "../modules/media/media.dependencies.js";
import { createProfileDependencies } from "../modules/profile/profile.dependencies.js";

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

// Public Dependencies
export {
  authRoutes,
  roleRoutes,
  userRoleRoutes,
  rolePermissionRoutes,
  permissionRoutes,
  emailDlqService,
  emailDlqController,
  emailDlqRoutes,
  media,
  profile,
};
