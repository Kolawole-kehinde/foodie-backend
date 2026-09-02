import type { AuthDependencies } from "../types/auth.types.js";
import { createLoginService } from "./login.service.js";
import { createLogoutAllDevicesService } from "./logout-all.service.js";
import { createLogoutService } from "./logout.service.js";
import { createPasswordResetService } from "./password-reset.service.js";
import { createRefreshService } from "./refresh.service.js";
import { createRegistrationService } from "./registration.service.js";
import { createVerifyEmailService } from "./verify-email.service.js";

export const createAuthService = (dependencies: AuthDependencies) => {
  const registration = createRegistrationService(dependencies);
  const verifyEmail = createVerifyEmailService(dependencies);
  const login = createLoginService(dependencies);
  const refresh = createRefreshService(dependencies);
  const logout = createLogoutService(dependencies);
  const logoutAllDevices = createLogoutAllDevicesService(dependencies);
  const passwordReset = createPasswordResetService(dependencies);

  return {
    register: registration.register,
    verifyEmail: verifyEmail.verifyEmail,
    login: login.login,
    refresh: refresh.refresh,
    logout: logout.logout,
    logoutAllDevices: logoutAllDevices.logoutAllDevices,

    // Session management
    getActiveSessions: dependencies.services.session.getActiveSessions,
    revokeSession: dependencies.services.session.revokeSession,

    // Password reset
    passwordReset: passwordReset.passwordReset,
    resetPassword: passwordReset.resetPassword,
  };
};

export type AuthService = ReturnType<typeof createAuthService>;