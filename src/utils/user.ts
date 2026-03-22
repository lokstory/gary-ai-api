export function getUserId(req: any): bigint | null {
  return req.user?.id ? BigInt(req.user.id as string) : null;
}
