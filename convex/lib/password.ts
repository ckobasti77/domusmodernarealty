/**
 * The staff password rule, shared by the credentials provider (`convex/auth.ts`),
 * the password change (`users.changeOwnPassword`) and the admin forms that
 * mirror it. The server is the rule; the forms only repeat it.
 */
export const PASSWORD_PROVIDER = "password";
export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 128;

export function passwordLengthOk(password: string): boolean {
  return password.length >= PASSWORD_MIN && password.length <= PASSWORD_MAX;
}
