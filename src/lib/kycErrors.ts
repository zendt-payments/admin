import { ApiError } from "./apiError";

/** Toast primary line (short) + detail for KYC-related API failures. */
export function getKycToastFromError(err: unknown): { title: string; sub: string } {
  const msg = err instanceof Error ? err.message.trim() : "Something went wrong. Try again.";
  const code = err instanceof ApiError ? err.code : undefined;

  if (code === "PHONE_IN_USE") {
    return { title: "Phone already in use", sub: msg };
  }
  if (code === "PAN_ALREADY_REGISTERED") {
    return { title: "PAN already in use", sub: msg };
  }
  if (code === "ZWITCH_UNAUTHORIZED") {
    return { title: "Could not verify PAN", sub: msg };
  }
  if (code === "ZWITCH_SUB_ACCOUNT_SETUP_FAILED") {
    return { title: "Payment setup failed", sub: msg };
  }
  if (code === "PROOF_UPLOAD_NOT_ALLOWED" || code === "PROOF_SUBMIT_NOT_ALLOWED") {
    return { title: "Verification not available yet", sub: msg };
  }
  if (code === "PROOF_PREREQUISITE_INCOMPLETE") {
    return { title: "Complete earlier steps", sub: msg };
  }

  if (/already linked to another account/i.test(msg)) {
    return { title: "PAN already in use", sub: msg };
  }
  if (
    /Zwitch returned 401|ZWITCH_UNAUTHORIZED|verification limit reached|Try again tomorrow|Too many requests/i.test(
      msg
    )
  ) {
    return { title: "Could not verify PAN", sub: msg };
  }
  if (
    /date of birth|dob|yyyy-mm-dd|years old|choose date|invalid date|must be at least|cannot be in the future/i.test(
      msg
    )
  ) {
    return { title: "Validation failed", sub: msg };
  }

  if (msg === "Wrong PAN number" || /^wrong pan number$/i.test(msg.trim())) {
    return { title: "Validation failed", sub: msg };
  }

  return { title: "Error", sub: msg };
}
