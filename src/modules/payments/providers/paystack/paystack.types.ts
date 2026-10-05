export type PaystackInitializeResponse = {
  status: boolean;
  message: string;
  data?: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
};

export type PaystackVerifyResponse = {
  status: boolean;
  message: string;
  data?: {
    id: number;
    amount: number;
    currency: string;
    reference: string;
    status: string;
    paid_at?: string | null;
    gateway_response?: string | null;
    metadata?: unknown;
  };
};

export type PaystackRefundResponse = {
  status: boolean;
  message: string;
  data?: {
    id: number;
    amount: number;
    currency: string;
    status: string;
    transaction:
      | number
      | string
      | {
          id?: number;
          reference?: string;
        };
    reason?: string | null;
    refunded_at?: string | null;
  };
};

export type PaystackRefundTransaction =
  | number
  | string
  | {
      id?: number;
      reference?: string;
    };