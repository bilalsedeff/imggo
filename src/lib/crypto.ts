/**
 * Cryptographic utilities for ImgGo
 * HMAC signing and verification for webhooks
 */

import { createHmac, timingSafeEqual } from "crypto";

/**
 * Generate HMAC signature for webhook payload
 * @param payload - The payload to sign (will be JSON stringified)
 * @param secret - The webhook secret
 * @returns Signature in format "sha256=<hex>"
 */
export function signWebhookPayload(
  payload: Record<string, unknown>,
  secret: string
): string {
  const data = JSON.stringify(payload);
  const hmac = createHmac("sha256", secret);
  hmac.update(data);
  const signature = hmac.digest("hex");
  return `sha256=${signature}`;
}

/**
 * Verify HMAC signature from webhook request
 * @param payload - The payload to verify (will be JSON stringified)
 * @param signature - The signature from X-ImgGo-Signature header
 * @param secret - The webhook secret
 * @returns True if signature is valid
 */
export function verifyWebhookSignature(
  payload: Record<string, unknown>,
  signature: string,
  secret: string
): boolean {
  try {
    const expectedSignature = signWebhookPayload(payload, secret);

    // Use timing-safe comparison to prevent timing attacks
    const expectedBuffer = Buffer.from(expectedSignature);
    const actualBuffer = Buffer.from(signature);

    // Signatures must be same length
    if (expectedBuffer.length !== actualBuffer.length) {
      return false;
    }

    return timingSafeEqual(expectedBuffer, actualBuffer);
  } catch {
    return false;
  }
}

/**
 * Generate a secure random webhook secret
 * @param length - Length of the secret (default: 32)
 * @returns Random hex string
 */
export function generateWebhookSecret(length = 32): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    ""
  );
}

/**
 * Hash API key for storage
 * @param apiKey - The API key to hash
 * @returns SHA-256 hash hex string
 */
export async function hashApiKey(apiKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(apiKey);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Generate a random API key
 * @returns API key in format "imggo_<random>"
 */
export function generateApiKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const random = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
  return `imggo_${random}`;
}
