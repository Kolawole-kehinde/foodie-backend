import { createCleanupJob } from "./cleanup.job.js";
import { createCleanupService } from "./cleanup.service.js";
import { createMediaUploadsCleanup } from "./media-uploads.cleanup.js";
import { createPendingRegistrationsCleanup } from "./pending-registrations.cleanup.js";

export const createCleanupContainer = () => {
  const pendingRegistrationsCleanup = createPendingRegistrationsCleanup();

  const mediaUploadsCleanup = createMediaUploadsCleanup();

  const cleanupService = createCleanupService({
    pendingRegistrationsCleanup,
    mediaUploadsCleanup,
  });

  const cleanupJob = createCleanupJob({
    cleanupService,
  });

  return {
    pendingRegistrationsCleanup,
    mediaUploadsCleanup,
    cleanupService,
    cleanupJob,
  };
};

export type CleanupContainer = ReturnType<typeof createCleanupContainer>;
