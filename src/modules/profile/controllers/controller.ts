import type { Request, Response } from "express";
import type { ProfileService } from "../services/profile.service.js";

type CreateProfileControllerDependencies = {
  profileService: ProfileService;
};

export const createProfileController = ({
  profileService,
}: CreateProfileControllerDependencies) => {
  const getProfile = async (req: Request, res: Response) => {
    const userId = req.user.id;

    const profile = await profileService.getProfile(userId);

    return res.status(200).json({
      success: true,
      data: profile,
    });
  };

  const updateProfile = async (req: Request, res: Response) => {
    const userId = req.user.id;

    const profile = await profileService.updateProfile(userId, req.body);

    return res.status(200).json({
      success: true,
      data: profile,
    });
  };

  return {
    getProfile,
    updateProfile,
  };
};

export type ProfileController = ReturnType<typeof createProfileController>;
