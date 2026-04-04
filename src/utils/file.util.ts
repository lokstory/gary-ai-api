export function joinFileUrl(baseUrl: string, path: string): string {
  return new URL(path, `${baseUrl}/`).toString();
}
