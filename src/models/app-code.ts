export const AppCode = {
  SUCCESS: [0, 'Success'] as const,
  PARAMETER_ERROR: [400, 'Parameter error'] as const,
  SERVER_ERROR: [500, 'Server error'] as const,
  USER_ALREADY_EXISTS: [1000, 'User already exists'] as const,
} as const;

export type AppCodeKey = keyof typeof AppCode;
export type AppCodeType = (typeof AppCode)[AppCodeKey];
