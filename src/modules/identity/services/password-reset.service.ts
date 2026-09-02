import type { ForgotPasswordDto, ForgotPasswordResponseDto } from "../dto/forgot-password-dto.js";
import type { AuthContext, AuthDependencies } from "../types/auth.types.js";



export const createPasswordResetService = ({ repositories, services,}: AuthDependencies) => {
    const passwordReset = async (dto: ForgotPasswordDto,_context: AuthContext,): Promise<ForgotPasswordResponseDto> => {
        const { email } = dto;

        const user = await repositories.user.findByEmail(email);

        const genericResponse: ForgotPasswordResponseDto = {
            message:
                "If an account exists with this email, a password reset link has been sent.",
        };

        if (!user) {
            return genericResponse;
        }

        const token = services.token.generateRandomToken();

        const tokenHash = services.token.hashToken(token);

        const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

        await repositories.passwordResetToken.create({
            user: {
                connect: {
                    id: user.id,
                },
            },
            tokenHash,
            expiresAt,
        });

        return genericResponse;
    };

    return {
        passwordReset,
    };
};

export type PasswordResetService = ReturnType< typeof createPasswordResetService>;
