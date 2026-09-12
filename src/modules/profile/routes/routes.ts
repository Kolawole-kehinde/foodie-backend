import { Router, type RequestHandler } from "express"
import type { ProfileController } from "../controllers/controller.js"
import { validate } from "node-cron"
import { updateProfileSchema } from "../schemas/profile.schema.js"



type CreateProfileRoutesDependencies = {
    profileController: ProfileController
    authenticate: RequestHandler
}


export const createProfileRoutes = ({profileController, authenticate}: CreateProfileRoutesDependencies) => {
  
    const router = Router()

     router.get(
        "/profile",
        authenticate,
        profileController.getProfile
     );

     router.patch(
        "/profile",
        authenticate,
        validate(updateProfileSchema),
        profileController.updateProfile
     )


    return router
}