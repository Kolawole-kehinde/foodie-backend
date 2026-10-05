import type { PaymentProvider, PrismaClient } from "@prisma/client";
import type { PaymentRepository } from "../repositories/index.js";
import type { PaymentProviderRegistry } from "../providers/payment-provider.registry.js";
import type { PaymentProcessingService } from "../services/payment-processing.service.js";

export type PaymentProviderStatus =
  | "PENDING"
  | "PROCESSING"
  | "SUCCESS"
  | "FAILED"
  | "CANCELLED"
  | "EXPIRED"
  | "UNKNOWN";

export type PaymentResourceType = "PAYMENT" | "REFUND" | "UNKNOWN";


export interface InitializePaymentInput {
  paymentId: string;
  attemptId: string;

  amount: string;
  currency: string;

  customerEmail: string;

  callbackUrl?: string;

  metadata?: Record<string, unknown>;
  
  reference?: string;
}

export interface InitializePaymentServiceInput {
  orderId: string;
  userId: string;
  provider: PaymentProvider;
  idempotencyKey: string;
  callbackUrl?: string;
}

export interface InitializePaymentResult {
  provider: PaymentProvider;

  providerReference: string;

  authorizationUrl?: string;

  accessCode?: string;

  status: PaymentProviderStatus;

  providerStatus?: string;

  metadata?: Record<string, unknown>;
}

export interface VerifyPaymentInput {
  providerReference: string;
}

export interface VerifyPaymentResult {
  provider: PaymentProvider;

  providerReference: string;

  amount: string;

  currency: string;

  status: PaymentProviderStatus;

  providerStatus?: string;

  paidAt?: Date;

  failureReason?: string;

  metadata?: Record<string, unknown>;
}

export interface VerifyWebhookInput {
  rawBody: Buffer;

  headers: Record<string, string | undefined>;
}

export interface VerifyWebhookResult {
  provider: PaymentProvider;

  resourceType: PaymentResourceType;

  eventType: string;

  providerEventId?: string;

  providerReference?: string;

  providerRefundReference?: string;

  amount?: string;

  currency?: string;

  status: PaymentProviderStatus;

  providerStatus?: string;

  paidAt?: Date;

  failureReason?: string;

  metadata?: Record<string, unknown>;

  payload: Record<string, unknown>;
}

export interface RefundPaymentInput {
  paymentId: string;

  providerReference: string;

  amount: string;

  currency: string;

  reason?: string;

  metadata?: Record<string, unknown>;
}

export interface RefundPaymentResult {
  provider: PaymentProvider;

  providerReference: string;

  providerRefundReference?: string;

  amount: string;

  currency: string;

  status: PaymentProviderStatus;

  providerStatus?: string;

  failureReason?: string;

  metadata?: Record<string, unknown>;
}

export interface VerifyRefundInput {
  providerRefundReference: string;
}

export interface VerifyRefundResult {
  provider: PaymentProvider;
  providerRefundReference: string;
  providerReference?: string;
  amount: string;
  currency: string;
  status: PaymentProviderStatus;
  providerStatus?: string;
  failureReason?: string;
  completedAt?: Date;
  metadata?: Record<string, unknown>;
}

export type PaymentServiceDependencies = {
  db: PrismaClient;
  paymentRepository: PaymentRepository;
  paymentProviderRegistry: PaymentProviderRegistry;
  paymentProcessingService: PaymentProcessingService;
};
