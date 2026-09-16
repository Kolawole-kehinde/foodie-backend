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

const permissions = [
  // Profile
  {
    name: "profile.read",
    resource: "profile",
    action: "read",
    description: "View a user profile",
  },
  {
    name: "profile.update",
    resource: "profile",
    action: "update",
    description: "Update a user profile",
  },

  // Email DLQ
  {
    name: "email-dlq.replay",
    resource: "email-dlq",
    action: "replay",
    description: "Replay failed email jobs from the dead-letter queue",
  },

  // Cart
  {
    name: "cart.read",
    resource: "cart",
    action: "read",
    description: "View a shopping cart",
  },
  {
    name: "cart.create",
    resource: "cart",
    action: "create",
    description: "Create a shopping cart",
  },
  {
    name: "cart.update",
    resource: "cart",
    action: "update",
    description: "Update a shopping cart",
  },
  {
    name: "cart.delete",
    resource: "cart",
    action: "delete",
    description: "Delete a shopping cart",
  },

  // Orders
  {
    name: "orders.read",
    resource: "orders",
    action: "read",
    description: "View orders",
  },
  {
    name: "orders.create",
    resource: "orders",
    action: "create",
    description: "Create an order",
  },
  {
    name: "orders.update",
    resource: "orders",
    action: "update",
    description: "Update an order",
  },
  {
    name: "orders.cancel",
    resource: "orders",
    action: "cancel",
    description: "Cancel an order",
  },
  {
    name: "orders.refund",
    resource: "orders",
    action: "refund",
    description: "Refund an order",
  },

  // Reviews
  {
    name: "reviews.read",
    resource: "reviews",
    action: "read",
    description: "View reviews",
  },
  {
    name: "reviews.create",
    resource: "reviews",
    action: "create",
    description: "Create a review",
  },
  {
    name: "reviews.update",
    resource: "reviews",
    action: "update",
    description: "Update a review",
  },
  {
    name: "reviews.delete",
    resource: "reviews",
    action: "delete",
    description: "Delete a review",
  },

  // Users
  {
    name: "users.read",
    resource: "users",
    action: "read",
    description: "View users",
  },
  {
    name: "users.create",
    resource: "users",
    action: "create",
    description: "Create a user",
  },
  {
    name: "users.update",
    resource: "users",
    action: "update",
    description: "Update a user",
  },
  {
    name: "users.suspend",
    resource: "users",
    action: "suspend",
    description: "Suspend a user",
  },
  {
    name: "users.delete",
    resource: "users",
    action: "delete",
    description: "Delete a user",
  },

  // User Roles
  {
    name: "users.roles.assign",
    resource: "users.roles",
    action: "assign",
    description: "Assign a role to a user",
  },
  {
    name: "users.roles.read",
    resource: "users.roles",
    action: "read",
    description: "View roles assigned to a user",
  },
  {
    name: "users.roles.remove",
    resource: "users.roles",
    action: "remove",
    description: "Remove a role from a user",
  },

  // Products
  {
    name: "products.read",
    resource: "products",
    action: "read",
    description: "View products",
  },
  {
    name: "products.create",
    resource: "products",
    action: "create",
    description: "Create a product",
  },
  {
    name: "products.update",
    resource: "products",
    action: "update",
    description: "Update a product",
  },
  {
    name: "products.delete",
    resource: "products",
    action: "delete",
    description: "Delete a product",
  },

  // Inventory
  {
    name: "inventory.read",
    resource: "inventory",
    action: "read",
    description: "View inventory",
  },
  {
    name: "inventory.create",
    resource: "inventory",
    action: "create",
    description: "Create inventory records",
  },
  {
    name: "inventory.update",
    resource: "inventory",
    action: "update",
    description: "Update inventory",
  },
  {
    name: "inventory.delete",
    resource: "inventory",
    action: "delete",
    description: "Delete inventory records",
  },

  // Roles
  {
    name: "roles.read",
    resource: "roles",
    action: "read",
    description: "View roles",
  },
  {
    name: "roles.create",
    resource: "roles",
    action: "create",
    description: "Create roles",
  },
  {
    name: "roles.update",
    resource: "roles",
    action: "update",
    description: "Update roles",
  },
  {
    name: "roles.delete",
    resource: "roles",
    action: "delete",
    description: "Delete roles",
  },

  // Role Permissions
  {
    name: "roles.permissions.assign",
    resource: "roles.permissions",
    action: "assign",
    description: "Assign a permission to a role",
  },
  {
    name: "roles.permissions.read",
    resource: "roles.permissions",
    action: "read",
    description: "View permissions assigned to a role",
  },
  {
    name: "roles.permissions.remove",
    resource: "roles.permissions",
    action: "remove",
    description: "Remove a permission from a role",
  },

  // Permissions
  {
    name: "permissions.read",
    resource: "permissions",
    action: "read",
    description: "View permissions",
  },
  {
    name: "permissions.create",
    resource: "permissions",
    action: "create",
    description: "Create permissions",
  },
  {
    name: "permissions.update",
    resource: "permissions",
    action: "update",
    description: "Update permissions",
  },
  {
    name: "permissions.delete",
    resource: "permissions",
    action: "delete",
    description: "Delete permissions",
  },

  // Audit & Security
  {
    name: "audit.read",
    resource: "audit",
    action: "read",
    description: "View audit logs",
  },
  {
    name: "security-events.read",
    resource: "security-events",
    action: "read",
    description: "View security events",
  },
];

const rolePermissions: Record<RoleName, string[]> = {
  [RoleName.USER]: [
    "profile.read",
    "profile.update",

    "cart.read",
    "cart.create",
    "cart.update",
    "cart.delete",

    "orders.read",
    "orders.create",
    "orders.cancel",

    "reviews.read",
    "reviews.create",
    "reviews.update",
    "reviews.delete",
  ],

  [RoleName.CUSTOMER_SUPPORT]: [
    "users.read",
    "profile.read",

    "orders.read",
    "orders.update",
    "orders.cancel",

    "reviews.read",
  ],

  [RoleName.ADMIN]: [
    // Profile
    "profile.read",
    "profile.update",

    // Email
    "email-dlq.replay",

    // Users
    "users.read",
    "users.create",
    "users.update",
    "users.suspend",
    "users.delete",

    // User roles
    "users.roles.assign",
    "users.roles.read",
    "users.roles.remove",

    // Products
    "products.read",
    "products.create",
    "products.update",
    "products.delete",

    // Inventory
    "inventory.read",
    "inventory.create",
    "inventory.update",
    "inventory.delete",

    // Orders
    "orders.read",
    "orders.update",
    "orders.cancel",
    "orders.refund",

    // Reviews
    "reviews.read",
    "reviews.delete",

    // Roles
    "roles.read",
    "roles.create",
    "roles.update",
    "roles.delete",

    // Role permissions
    "roles.permissions.assign",
    "roles.permissions.read",
    "roles.permissions.remove",

    // Permissions
    "permissions.read",
    "permissions.create",
    "permissions.update",
    "permissions.delete",

    // Audit & Security
    "audit.read",
    "security-events.read",
  ],

  // Reserved for future features
  [RoleName.EDITOR]: [],

  [RoleName.MODERATOR]: [],
};


async function main() {
  // 1. Seed roles
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

  // 2. Seed permissions
  for (const permission of permissions) {
    await prisma.permission.upsert({
      where: {
        name: permission.name,
      },
      update: {
        resource: permission.resource,
        action: permission.action,
        description: permission.description,
      },
      create: permission,
    });
  }

  // 3. Connect roles to permissions
  for (const [roleName, permissionNames] of Object.entries(rolePermissions)) {
    const role = await prisma.role.findUnique({
      where: {
        name: roleName as RoleName,
      },
    });

    if (!role) {
      throw new Error(`Role not found: ${roleName}`);
    }

    for (const permissionName of permissionNames) {
      const permission = await prisma.permission.findUnique({
        where: {
          name: permissionName,
        },
      });

      if (!permission) {
        throw new Error(`Permission not found: ${permissionName}`);
      }

      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: role.id,
          permissionId: permission.id,
        },
      });
    }
  }

  console.log("Authorization data seeded successfully.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
