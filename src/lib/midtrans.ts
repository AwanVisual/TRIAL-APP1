// Midtrans configuration and utilities
export const MIDTRANS_CONFIG = {
  // Use sandbox for development, production for live
  isProduction: false,
  serverKey: 'Mid-server-QwTp14ZfxnE4_-fv8K3REw7G',
  clientKey: 'Mid-client-WRfpVnNnuYzhwawu',
  
  // Midtrans API URLs
  get apiUrl() {
    return this.isProduction 
      ? 'https://api.midtrans.com/v2'
      : 'https://api.sandbox.midtrans.com/v2';
  },
  
  get snapUrl() {
    return this.isProduction
      ? 'https://app.midtrans.com/snap/snap.js'
      : 'https://app.sandbox.midtrans.com/snap/snap.js';
  }
};

export interface MidtransTransactionRequest {
  order_id: string;
  gross_amount: number;
  payment_type?: string;
  customer_details?: {
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
  };
  item_details?: Array<{
    id: string;
    price: number;
    quantity: number;
    name: string;
  }>;
}

export interface MidtransTransactionResponse {
  token?: string;
  redirect_url?: string;
  va_numbers?: Array<{
    bank: string;
    va_number: string;
  }>;
  bill_key?: string;
  biller_code?: string;
  transaction_id: string;
  order_id: string;
  merchant_id: string;
  gross_amount: string;
  currency: string;
  payment_type: string;
  transaction_time: string;
  transaction_status: string;
  fraud_status?: string;
}

// Utility function to generate unique order ID
export const generateOrderId = (prefix: string = 'ORDER'): string => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 9);
  return `${prefix}-${timestamp}-${random}`;
};

// Utility function to format amount for Midtrans (no decimal places)
export const formatMidtransAmount = (amount: number): number => {
  return Math.round(amount);
};

// Payment method configurations
export const MIDTRANS_PAYMENT_METHODS = {
  BANK_TRANSFER: {
    BCA: { code: 'bca', name: 'BCA Virtual Account' },
    BNI: { code: 'bni', name: 'BNI Virtual Account' },
    BRI: { code: 'bri', name: 'BRI Virtual Account' },
    MANDIRI: { code: 'echannel', name: 'Mandiri e-Channel' },
    PERMATA: { code: 'permata', name: 'Permata Virtual Account' },
  },
  E_WALLET: {
    GOPAY: { code: 'gopay', name: 'GoPay' },
    SHOPEEPAY: { code: 'shopeepay', name: 'ShopeePay' },
    DANA: { code: 'dana', name: 'DANA' },
    LINKAJA: { code: 'linkaja', name: 'LinkAja' },
  },
  CREDIT_CARD: {
    VISA: { code: 'credit_card', name: 'Visa' },
    MASTERCARD: { code: 'credit_card', name: 'Mastercard' },
    JCB: { code: 'credit_card', name: 'JCB' },
  }
};

// Transaction status mapping
export const MIDTRANS_STATUS = {
  CAPTURE: 'capture',
  SETTLEMENT: 'settlement',
  PENDING: 'pending',
  DENY: 'deny',
  CANCEL: 'cancel',
  EXPIRE: 'expire',
  FAILURE: 'failure',
  REFUND: 'refund',
  PARTIAL_REFUND: 'partial_refund',
  AUTHORIZE: 'authorize',
} as const;

export type MidtransStatus = typeof MIDTRANS_STATUS[keyof typeof MIDTRANS_STATUS];