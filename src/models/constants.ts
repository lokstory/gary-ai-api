export const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

export enum SwaggerBearer {
  USER = 'user-token',
  ADMIN = 'admin-token',
}
