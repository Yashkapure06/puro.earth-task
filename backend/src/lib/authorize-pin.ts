/**
 * Demo PIN for this assessment, not a real second factor.
 * Card reveal checks it on the server so GET /accounts/me never returns the PAN.
 */
export const DEMO_AUTHORIZE_PIN = "1234";

export function isValidAuthorizePin(input: string): boolean {
  return input === DEMO_AUTHORIZE_PIN;
}
