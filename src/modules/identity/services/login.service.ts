import type { LoginRequestDto } from "../dto/login-request.dto.js";
import type { LoginResponseDto } from "../dto/login-response.dto.js";
import type { AuthContext, AuthDependencies } from "../types/auth.types.js";
import { createPasswordService } from "./password.service.js";



export const createLoginService = ({repositories, services, queues}:AuthDependencies) => {
    const login = async (dto: LoginRequestDto, context: AuthContext): Promise<LoginResponseDto> => {
       const {email, password} = dto


       const user = await repositories.user.findByEmail(email)

        const passwordHash = user?.passwordHash ?? services.password.getDummyHash;

        const passwordValid = await services.password.verify(
            dto.password,
            passwordHash
        )

    }
}