import type { ProfileRepository } from "../repositories/profile.repository.js";
import type { ProfileDto } from "../dto/profile.dto.js";
import type { UpdateProfileInput } from "../schemas/profile.schema.js";

type CreateProfileServiceDependencies = {
  profileRepository: ProfileRepository;
};

export const createProfileService = ({profileRepository,}: CreateProfileServiceDependencies) => {

  const getProfile = async (userId: string): Promise<ProfileDto> => {

    let profile = await profileRepository.findByUserId(userId);

    if (!profile) {
      profile = await profileRepository.create(userId);
    }

    return {
      id: profile.id,
      firstName: profile.firstName,
      lastName: profile.lastName,
      phone: profile.phone,
      bio: profile.bio,
      avatarUrl: null,
    };
  };

  const updateProfile = async ( userId: string, data: UpdateProfileInput,): Promise<ProfileDto> => {
    
    const profile = await profileRepository.update(userId, data);

    return {
      id: profile.id,
      firstName: profile.firstName,
      lastName: profile.lastName,
      phone: profile.phone,
      bio: profile.bio,
      avatarUrl: null,
    };
  };

  return {
    getProfile,
    updateProfile,
  };
};

export type ProfileService = ReturnType<typeof createProfileService>;
