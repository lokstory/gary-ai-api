export const AppCode = {
  SUCCESS: [0, 'Success'] as const,
  PARAMETER_ERROR: [400, 'Parameter error'] as const,
  UNAUTHORIZED: [401, 'Unauthorized'] as const,
  FORBIDDEN: [403, 'Forbidden'] as const,
  NOT_FOUND: [404, 'Not found'] as const,
  SERVER_ERROR: [500, 'Server error'] as const,
  USER_ALREADY_EXISTS: [1000, 'User already exists'] as const,
  USER_REGISTERED_WITH_GOOGLE: [
    1001,
    'User already registered with Google',
  ] as const,
  VERIFICATION_FAILED: [1002, 'Verification failed'] as const,
  OTP_TOO_MANY_ATTEMPTS: [1003, 'Too many attempts'] as const,
  CART_ITEM_ALREADY_EXISTS: [1004, 'Item already in cart'] as const,
  ORDER_CART_EMPTY: [1005, 'Cart is empty'] as const,
  ORDER_CHECKOUT_FAILED: [1006, 'Checkout failed'] as const,
  ORDER_ITEM_ALREADY_PURCHASED: [1007, 'Item already purchased'] as const,
  USER_REGISTERED_WITH_EMAIL: [
    1008,
    'User already registered with email',
  ] as const,
  CREDENTIAL_INVALID: [1009, 'Invalid credential'] as const,
  OTP_RATE_LIMITED: [1010, 'OTP rate limited'] as const,
} as const;

export type AppCodeKey = keyof typeof AppCode;
export type AppCodeType = (typeof AppCode)[AppCodeKey];

export function getAppCode(code: number): AppCodeType | undefined {
  const entries = Object.values(AppCode) as AppCodeType[];
  return entries.find(([value]) => value === code);
}

export function getAppCodeMessage(code: number): string {
  const appCode = getAppCode(code);
  return appCode ? appCode[1] : 'Unknown error';
}
