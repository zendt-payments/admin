import { getCognitoGroups, isAdminFromGroups, logout } from "./auth";
import { dataService, invalidateUserMeCache } from "./dataService";
import { isApiError, isUnregisteredAccountApiError } from "../lib/apiError";

export type EnsureFreelancerAccountOpts = {
  /** Email/password login — forwarded to signup-complete for welcome email + social-auth storage. */
  password?: string;
};

const PROFILE_SETUP_FAILED_MESSAGE =
  "We couldn't finish setting up your account. Please try signing in again or contact support.";

/**
 * Confirmed Cognito users get a MongoDB row from auth middleware on the first authed API call.
 * signup-complete only sends the welcome email — it does not create the user document.
 */
export async function ensureFreelancerAccountProvisioned(
  opts?: EnsureFreelancerAccountOpts
): Promise<void> {
  const groups = await getCognitoGroups();
  if (isAdminFromGroups(groups)) return;

  try {
    await dataService.getProfileSettings();
  } catch (e) {
    if (isApiError(e) && e.code === "ACCOUNT_DEACTIVATED") {
      await logout();
      throw new Error("This account has been deactivated. Contact support if you need help.");
    }
    if (isUnregisteredAccountApiError(e)) {
      invalidateUserMeCache();
      try {
        await dataService.getProfileSettings();
      } catch (retryErr) {
        if (isApiError(retryErr) && retryErr.code === "ACCOUNT_DEACTIVATED") {
          await logout();
          throw new Error("This account has been deactivated. Contact support if you need help.");
        }
        await logout();
        throw new Error(PROFILE_SETUP_FAILED_MESSAGE);
      }
    } else {
      throw e;
    }
  }

  const password = opts?.password?.trim();
  await dataService.signupComplete(password || undefined).catch(() => {});
}
