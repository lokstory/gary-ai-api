export const AppCode = {
  SUCCESS: [0, 'Success'] as const,
  PARAMETER_ERROR: [400, 'Parameter error'] as const,
  NOT_FOUND: [404, 'Not found'] as const,
  SERVER_ERROR: [500, 'Server error'] as const,
  USER_ALREADY_EXISTS: [1000, 'User already exists'] as const,
  CREDENTIALS_INVALID: [1001, 'Invalid credentials'] as const,
  VERIFICATION_FAILED: [1002, 'Verification failed'] as const,
  OTP_TOO_MANY_ATTEMPTS: [1003, 'Too many attempts'] as const,
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
