import type { AuthDependencies } from "../types/auth.types.js";
import { createLoginService } from "./login.service.js";
import { createRefreshService } from "./refresh.service.js";
import { createRegistrationService } from "./registration.service.js";
import { createVerifyEmailService } from "./verify-email.service.js";


export const createAuthService = ( dependencies: AuthDependencies) => {
  const registration = createRegistrationService(dependencies);
  const verifyEmail = createVerifyEmailService(dependencies);
  const login = createLoginService(dependencies)
    const refresh = createRefreshService(dependencies);

  return {
    register: registration.register,
    verifyEmail: verifyEmail.verifyEmail,
    login: login.login,
    refresh: refresh.refresh,
  };
};

export type AuthService =  ReturnType<typeof createAuthService>;