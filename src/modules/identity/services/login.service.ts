import type { LoginRequestDto } from "../dto/login-request.dto.js";
import type { LoginResponseDto } from "../dto/login-response.dto.js";
import type { AuthContext, AuthDependencies } from "../types/auth.types.js";


export const createLoginService = ({repositories,services}: AuthDependencies) => {
  const login = async (dto: LoginRequestDto,context: AuthContext,): Promise<LoginResponseDto> => {
    const { email, password } = dto;

    const user = await repositories.user.findByEmail(email);

//Check accoun status



    const passwordHash = user?.passwordHash ?? services.password.getDummyHash();
    const passwordValid = await services.password.verify(
      password,
      passwordHash,
    );

   throw new UnauthorizedError(
  "Invalid email or password"
);
  };
};
