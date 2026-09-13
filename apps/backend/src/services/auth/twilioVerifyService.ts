import twilio from "twilio";
import { env, hasTwilioVerifyConfig } from "../../config/env.js";

/**
 * Server-side Twilio Verify v2 OTP service (CLAUDE.md §28, ARTEQ Phase 6).
 *
 * Credentials MUST remain server-side only; never expose them to kiosk or browser.
 * Never log OTP codes or sensitive patient PII.
 */

let twilioClient: twilio.Twilio | null = null;

function getTwilioClient(): twilio.Twilio {
  if (!twilioClient) {
    if (!hasTwilioVerifyConfig) {
      throw new Error("[TwilioVerify] Twilio credentials or Verify Service SID are not configured.");
    }
    twilioClient = twilio(env.twilioAccountSid!, env.twilioAuthToken!);
  }
  return twilioClient;
}

export interface VerificationSendResult {
  success: boolean;
  message?: string;
}

export interface VerificationCheckResult {
  verified: boolean;
  message?: string;
}

/**
 * Dispatches an SMS OTP to the patient's registered phone number via Twilio Verify.
 */
export async function sendVerificationCode(phoneNumber: string): Promise<VerificationSendResult> {
  const normalizedPhone = phoneNumber.trim();
  if (!normalizedPhone) {
    return { success: false, message: "Phone number is required." };
  }

  // Authoritative Twilio Verify path
  if (hasTwilioVerifyConfig) {
    try {
      const client = getTwilioClient();
      const verification = await client.verify.v2
        .services(env.twilioVerifyServiceSid!)
        .verifications.create({ to: normalizedPhone, channel: "sms" });

      console.log(`[TwilioVerify] OTP dispatched via Twilio Verify (status=${verification.status})`);
      return { success: true };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Failed to send OTP via Twilio";
      console.error("[TwilioVerify] Error creating verification:", errMsg);
      return { success: false, message: errMsg };
    }
  }

  // Development-only fallback guard
  if (process.env.NODE_ENV === "production") {
    console.error("[TwilioVerify] FATAL: Twilio Verify is not configured in production environment.");
    return { success: false, message: "Twilio Verify service is not configured on this server." };
  }

  // Explicitly marked development mock fallback
  console.warn(
    "[TwilioVerify] DEVELOPMENT MOCK MODE: Twilio credentials unset. Real SMS disabled. Use test code 123456.",
  );
  return { success: true, message: "DEV MOCK MODE: OTP simulated (use test code 123456)" };
}

/**
 * Checks the OTP code submitted by the patient via Twilio Verify.
 */
export async function checkVerificationCode(
  phoneNumber: string,
  code: string,
): Promise<VerificationCheckResult> {
  const normalizedPhone = phoneNumber.trim();
  const normalizedCode = code.trim();

  if (!normalizedPhone || !normalizedCode) {
    return { verified: false, message: "Phone number and verification code are required." };
  }

  // Authoritative Twilio Verify path
  if (hasTwilioVerifyConfig) {
    try {
      const client = getTwilioClient();
      const check = await client.verify.v2
        .services(env.twilioVerifyServiceSid!)
        .verificationChecks.create({ to: normalizedPhone, code: normalizedCode });

      const isApproved = check.status === "approved";
      console.log(`[TwilioVerify] Verification check status: ${check.status}`);
      return {
        verified: isApproved,
        message: isApproved ? undefined : "Invalid or expired verification code.",
      };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Twilio verification check failed";
      console.error("[TwilioVerify] Error checking verification:", errMsg);
      return { verified: false, message: errMsg };
    }
  }

  // Development-only fallback guard
  if (process.env.NODE_ENV === "production") {
    console.error("[TwilioVerify] FATAL: Twilio Verify is not configured in production environment.");
    return { verified: false, message: "Twilio Verify service is not configured on this server." };
  }

  // Explicitly marked development mock fallback
  console.warn("[TwilioVerify] DEVELOPMENT MOCK MODE: validating against test code.");
  if (normalizedCode === "123456") {
    return { verified: true };
  }
  return { verified: false, message: "Invalid code. (Dev Mock requires '123456')" };
}
