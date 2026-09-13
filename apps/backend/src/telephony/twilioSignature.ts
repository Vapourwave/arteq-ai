import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Twilio webhook signature validation (CLAUDE.md §28 / §9: the phone
 * webhook is an external untrusted transport).
 *
 * Twilio signs each webhook request with:
 *   base64( HMAC-SHA1( authToken, fullUrl + concat(sortedByKey(k + v)) ) )
 * and sends it in the `X-Twilio-Signature` header. `fullUrl` is the exact
 * URL configured in the Twilio console (scheme + host + path + query), and
 * the params are the POST body fields (application/x-www-form-urlencoded).
 *
 * Reference: Twilio "Validating Signatures from Twilio" (current docs, 2026).
 */

export function expectedTwilioSignature(
  authToken: string,
  fullUrl: string,
  params: Record<string, string>,
): string {
  const data = Object.keys(params)
    .sort()
    .reduce((acc, key) => acc + key + params[key], fullUrl);
  return createHmac("sha1", authToken).update(Buffer.from(data, "utf-8")).digest("base64");
}

export function validateTwilioSignature(opts: {
  authToken: string;
  signatureHeader: string | undefined;
  fullUrl: string;
  params: Record<string, string>;
}): boolean {
  if (!opts.signatureHeader) return false;
  const expected = expectedTwilioSignature(opts.authToken, opts.fullUrl, opts.params);
  const a = Buffer.from(expected, "utf-8");
  const b = Buffer.from(opts.signatureHeader, "utf-8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
