import { describe, expect, it } from "vitest";
import { expectedTwilioSignature, validateTwilioSignature } from "./twilioSignature.js";

// Twilio's canonical published test vector for signature validation.
const AUTH_TOKEN = "12345";
const URL = "https://mycompany.com/myapp.php?foo=1&bar=2";
const PARAMS = {
  CallSid: "CA1234567890ABCDE",
  Caller: "+14158675309",
  Digits: "1234",
  From: "+14158675309",
  To: "+18005551212",
};
const EXPECTED = "RSOYDt4T1cUTdK1PDd93/VVr8B8=";

describe("twilioSignature", () => {
  it("reproduces Twilio's published reference signature", () => {
    expect(expectedTwilioSignature(AUTH_TOKEN, URL, PARAMS)).toBe(EXPECTED);
  });

  it("validates a correct signature header", () => {
    expect(
      validateTwilioSignature({
        authToken: AUTH_TOKEN,
        signatureHeader: EXPECTED,
        fullUrl: URL,
        params: PARAMS,
      }),
    ).toBe(true);
  });

  it("rejects a tampered body", () => {
    expect(
      validateTwilioSignature({
        authToken: AUTH_TOKEN,
        signatureHeader: EXPECTED,
        fullUrl: URL,
        params: { ...PARAMS, Digits: "9999" },
      }),
    ).toBe(false);
  });

  it("rejects a tampered URL", () => {
    expect(
      validateTwilioSignature({
        authToken: AUTH_TOKEN,
        signatureHeader: EXPECTED,
        fullUrl: URL + "&evil=1",
        params: PARAMS,
      }),
    ).toBe(false);
  });

  it("rejects the wrong auth token", () => {
    expect(
      validateTwilioSignature({
        authToken: "not-the-token",
        signatureHeader: EXPECTED,
        fullUrl: URL,
        params: PARAMS,
      }),
    ).toBe(false);
  });

  it("rejects a missing signature header", () => {
    expect(
      validateTwilioSignature({
        authToken: AUTH_TOKEN,
        signatureHeader: undefined,
        fullUrl: URL,
        params: PARAMS,
      }),
    ).toBe(false);
  });

  it("is insensitive to param insertion order (sorted by key before signing)", () => {
    const reordered = {
      To: PARAMS.To,
      CallSid: PARAMS.CallSid,
      From: PARAMS.From,
      Digits: PARAMS.Digits,
      Caller: PARAMS.Caller,
    };
    expect(expectedTwilioSignature(AUTH_TOKEN, URL, reordered)).toBe(EXPECTED);
  });
});
