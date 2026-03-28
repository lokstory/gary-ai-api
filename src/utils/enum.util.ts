export function isEnumEqual<T extends string | number>(
  enumValue: T,
  value: string | number,
): value is T {
  return enumValue === value;
}
