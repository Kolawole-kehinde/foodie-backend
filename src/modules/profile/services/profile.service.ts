import type { ProfileRepository } from "../repositories/profile.repository.js";
import type { ProfileDto } from "../dto/profile.dto.js";
import type { UpdateProfileInput } from "../schemas/profile.schema.js";
import type { S3Service } from "../../../infrastructure/s3/s3.service.js";

type CreateProfileServiceDependencies = {
  profileRepository: ProfileRepository;
  s3Service: S3Service;
};

export const createProfileService = ({
  profileRepository,
  s3Service,
}: CreateProfileServiceDependencies) => {
  const getProfile = async (
    userId: string,
  ): Promise<ProfileDto> => {
    let profile =
      await profileRepository.findByUserId(userId);

    if (!profile) {
      profile = await profileRepository.create(userId);
    }

    const avatarUrl = profile.avatarKey
      ? await s3Service.createDownloadUrl(
          profile.avatarKey,
        )
      : null;

    return {
      id: profile.id,
      firstName: profile.firstName,
      lastName: profile.lastName,
      phone: profile.phone,
      bio: profile.bio,
      avatarUrl,
    };
  };

  const updateProfile = async (
    userId: string,
    data: UpdateProfileInput,
  ): Promise<ProfileDto> => {
    const profile =
      await profileRepository.update(userId, data);

    const avatarUrl = profile.avatarKey
      ? await s3Service.createDownloadUrl(
          profile.avatarKey,
        )
      : null;

    return {
      id: profile.id,
      firstName: profile.firstName,
      lastName: profile.lastName,
      phone: profile.phone,
      bio: profile.bio,
      avatarUrl,
    };
  };

  return {
    getProfile,
    updateProfile,
  };
};

export type ProfileService =
  ReturnType<typeof createProfileService>;