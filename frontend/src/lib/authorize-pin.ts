/**
 * Demo PIN for this assessment, not 2FA.
 * Same value the API checks for card reveal.
 */
export const DEMO_AUTHORIZE_PIN = "1234";

export function isValidAuthorizePin(input: string): boolean {
  return input === DEMO_AUTHORIZE_PIN;
}
