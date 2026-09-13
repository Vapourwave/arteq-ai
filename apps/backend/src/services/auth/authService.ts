/**
 * DEMO/MOCK Authentication Service
 * 
 * Provides a minimal, in-memory credential check and session token generation
 * for the Admin Dashboard. Do NOT use this pattern in production; it is
 * strictly for demoing the Admin boundary as requested.
 */

export function verifyAdminLogin(username: string, password: string): string | null {
  if (username === "admin" && password === "admin123") {
    // Return a mock token
    return "demo-admin-token-12345";
  }
  return null;
}

export function isValidAdminToken(token: string): boolean {
  return token === "demo-admin-token-12345";
}
