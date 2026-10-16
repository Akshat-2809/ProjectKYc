/** The sign-in details the admin copies and sends to an agent. */
export const SIGN_IN_URL = "https://project-k-yc.vercel.app/agent/login";

export function credentialsMessage(opts: { phone: string; password: string; [other: string]: unknown }) {
  return [`Sign in: ${SIGN_IN_URL}`, `Phone number: ${opts.phone}`, `Password: ${opts.password}`].join("\n");
}
