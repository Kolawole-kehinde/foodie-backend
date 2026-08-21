import type { AuthDependencies } from "../../types/auth.types.js";
import {createRegistrationService,} from "./registration.service.js";


export const createAuthService = (dependencies: AuthDependencies) => {
  
  const registration =createRegistrationService(dependencies);

  return {
    // Registration
    register: registration.register,
    verifyEmail: registration.verifyEmail,
  };
};

export type AuthService =
  ReturnType<typeof createAuthService>;