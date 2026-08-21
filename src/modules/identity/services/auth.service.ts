import type { AuthDependencies } from "../types/auth.types.js";
import { createRegistrationService } from "./registration.service.js";
import { createVerifyEmailService } from "./verify-email.service.js";


export const createAuthService = ( dependencies: AuthDependencies) => {
  const registration = createRegistrationService(dependencies);
  const verifyEmail = createVerifyEmailService(dependencies);

  return {
    register: registration.register,
    verifyEmail: verifyEmail.verifyEmail,
  };
};

export type AuthService =  ReturnType<typeof createAuthService>;