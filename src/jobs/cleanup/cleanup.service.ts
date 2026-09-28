import {
  createPendingRegistrationsCleanup,
  type PendingRegistrationsCleanup,
} from "./pending-registrations.cleanup.js";

import {
  createMediaUploadsCleanup,
  type MediaUploadsCleanup,
} from "./media-uploads.cleanup.js";

type CleanupServiceDependencies = {
  pendingRegistrationsCleanup: PendingRegistrationsCleanup;
  mediaUploadsCleanup: MediaUploadsCleanup;
};

export const createCleanupService = ({
  pendingRegistrationsCleanup,
  mediaUploadsCleanup,
}: CleanupServiceDependencies) => {
  const run = async () => {
    const [
      deletedRegistrations,
      deletedUploads,
    ] = await Promise.all([
      pendingRegistrationsCleanup.run(),
      mediaUploadsCleanup.run(),
    ]);

    return {
      deletedRegistrations,
      deletedUploads,
    };
  };

  return {
    run,
  };
};

export type CleanupService = ReturnType<typeof createCleanupService>;