import { RoleName } from "@prisma/client";

export const roles = [
  {
    name: RoleName.ADMIN,
    description: "System administrator",
  },
  {
    name: RoleName.USER,
    description: "Standard application user",
  },
  {
    name: RoleName.CUSTOMER_SUPPORT,
    description: "Customer support staff",
  },
  {
    name: RoleName.EDITOR,
    description: "Content editor",
  },
  {
    name: RoleName.MODERATOR,
    description: "Content moderator",
  },
];