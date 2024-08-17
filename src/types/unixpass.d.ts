declare module 'unixpass' {
  export function crypt(password: string, salt: string): string;
}
