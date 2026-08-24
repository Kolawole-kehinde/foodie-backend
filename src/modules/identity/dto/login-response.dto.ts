// export type LoginResponseDto = {
//   accessToken: string;
//   refreshToken: string;
//   expiresIn: number;
 


//   user: {
//     id: string;
//     email: string;
//  message: string;
//   };
// };

export type LoginResult = {
  user: {
    id: string;
    email: string;
  };
};