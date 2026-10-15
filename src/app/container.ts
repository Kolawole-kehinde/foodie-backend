
import { prisma } from "../database/prisma/client.js";
import { redis } from "../database/redis/client.js";

import { createEmailDlqService } from "../workers/services/email-dlq.service.js";
import { createEmailDlqController } from "../workers/controllers/email-dlq.controller.js";
import { createEmailDlqRoutes } from "../workers/routes/email-dlq.routes.js";

import { createS3Service } from "../infrastructure/s3/s3.service.js";

import { createMediaDependencies } from "../modules/media/media.dependencies.js";
import { createProfileDependencies } from "../modules/profile/profile.dependencies.js";
import {
  initializeIdentityAuth,
  roleRoutes,
  userRoleRoutes,
  rolePermissionRoutes,
  permissionRoutes,
  userRoutes,
} from "../modules/identity/identity.container.js";

import { createCatalogDependencies } from "../modules/catalog/catalog.container.js";
import { createInventoryDependencies } from "../modules/inventory/inventory.container.js";
import { createCartDependencies } from "../modules/cart/cart.container.js";
import { createOrderDependencies } from "../modules/order/container.order.js";
import { createOutboxDependencies } from "../modules/outbox/outbox.container.js";
import { createPaymentDependencies } from "../modules/payments/payment.container.js";
import { createPaymentSucceededHandler } from "../modules/payments/handlers/payment-succeeded.handler.js";
import { createNotificationDependencies } from "../modules/notification/notification.container.js";
import { createOrderPaymentConsumer } from "../modules/order/consumers/order-payment.consumer.js";

// Infrastructure
const s3Service = createS3Service();

// Outbox
const outbox = createOutboxDependencies(prisma);

// Identity authentication
const identityAuth = initializeIdentityAuth(outbox.outboxService);
const { authRoutes } = identityAuth;

// Identity middleware
// Import these directly from identity.container.ts if they remain exported there.
import {
  authenticate,
  authorizePermission,
} from "../modules/identity/identity.container.js";

// Payment
const payment = createPaymentDependencies({
  db: prisma,
  authenticate,
  outboxService: outbox.outboxService,
});

// Email DLQ
const emailDlqService = createEmailDlqService();

const emailDlqController = createEmailDlqController({
  emailDlqService,
});

const emailDlqRoutes = createEmailDlqRoutes({
  emailDlqController,
  authenticate,
  authorizePermission,
});

// Media
const media = createMediaDependencies({
  db: prisma,
  s3Service,
  authenticate,
});

// Profile
const profile = createProfileDependencies({
  db: prisma,
  s3Service,
  authenticate,
});

// Catalog
const catalog = createCatalogDependencies({
  db: prisma,
  mediaUploadRepository: media.mediaUploadRepository,
  s3Service,
  authenticate,
  authorizePermission,
});

// Inventory
const inventory = createInventoryDependencies({
  db: prisma,
  productRepository: catalog.productRepository,
  authenticate,
  authorizePermission,
});

// Cart
const cart = createCartDependencies({
  db: prisma,
  productRepository: catalog.productRepository,
  authenticate,
});

// Order
const order = createOrderDependencies({
  db: prisma,
  productRepository: catalog.productRepository,
  cartRepository: cart.cartRepository,
  inventoryService: inventory.inventoryService,
  outboxService: outbox.outboxService,
  authenticate,
  authorizePermission,
});

// Payment succeeded handler
const paymentSucceededHandler = createPaymentSucceededHandler({
  orderService: order.orderService,
});

// Order payment consumer
const orderPaymentConsumer = createOrderPaymentConsumer({
  handler: paymentSucceededHandler,
});

// Notifications
const notification = createNotificationDependencies({
  db: prisma,
  authenticate,
});

// Public Dependencies
export {
  prisma,
  redis,

  // Identity
  authRoutes,
  roleRoutes,
  userRoleRoutes,
  rolePermissionRoutes,
  permissionRoutes,
  userRoutes,
  authenticate,
  authorizePermission,

  // Email DLQ
  emailDlqService,
  emailDlqController,
  emailDlqRoutes,

  // Feature modules
  media,
  profile,
  catalog,
  inventory,
  cart,

  // Infrastructure and integrations
  outbox,
  payment,
  order,
  orderPaymentConsumer,
  notification,
};
