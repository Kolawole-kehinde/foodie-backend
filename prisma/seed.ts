import { PrismaClient, RoleName } from "@prisma/client";

const prisma = new PrismaClient();

const roles = [
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
    description: "Customer support representative",
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

async function main() {
  for (const role of roles) {
    await prisma.role.upsert({
      where: {
        name: role.name,
      },
      update: {
        description: role.description,
      },
      create: role,
    });
  }

  console.log("Roles seeded successfully.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });