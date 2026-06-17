import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserAttribute,
  CognitoRefreshToken,
  CognitoIdToken,
  CognitoAccessToken,
  CognitoUserSession,
} from "amazon-cognito-identity-js";
import { clearBiometricCredentials, verifyBiometricAndGetCredentials } from "./biometricAuth";
import {
  TEST_MODE,
  TEST_EMAIL,
  TEST_PASSWORD,
  hasTestSession,
  setTestSession,
  TEST_AUTH_ID_TOKEN,
  TEST_AUTH_REFRESH_TOKEN,
} from "./testMode";
import { mockApi } from "./mockApi";
import { Capacitor } from "@capacitor/core";
import { apiFetch } from "../lib/apiFetch";

const USER_POOL_ID = import.meta.env.VITE_COGNITO_USER_POOL_ID || "";
const CLIENT_ID = import.meta.env.VITE_COGNITO_CLIENT_ID || "";
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

const BACKEND_HEALTH_TIMEOUT_MS = 8000;

/** Shown when signup cannot reach the API (e.g. backend stopped or wrong VITE_API_URL). */
const BACKEND_UNREACHABLE_MESSAGE =
  "Cannot reach the Zendt server. Check your connection, ensure the backend is running, then try again.";

/** Resolves if GET /health succeeds; rejects with {@link BACKEND_UNREACHABLE_MESSAGE} otherwise. Skipped in TEST_MODE. */
export async function assertBackendReachable(): Promise<void> {
  if (TEST_MODE) return;
  const base = API_URL.replace(/\/$/, "");
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), BACKEND_HEALTH_TIMEOUT_MS);
  try {
    const res = await apiFetch(`${base}/health`, {
      method: "GET",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      throw new Error(BACKEND_UNREACHABLE_MESSAGE);
    }
    const data: unknown = await res.json().catch(() => null);
    if (
      data &&
      typeof data === "object" &&
      "status" in data &&
      (data as { status: unknown }).status !== "ok"
    ) {
      throw new Error(BACKEND_UNREACHABLE_MESSAGE);
    }
  } catch (e) {
    if (e instanceof Error && e.message === BACKEND_UNREACHABLE_MESSAGE) {
      throw e;
    }
    if (e instanceof TypeError) {
      throw new Error(BACKEND_UNREACHABLE_MESSAGE);
    }
    throw new Error(BACKEND_UNREACHABLE_MESSAGE);
  } finally {
    window.clearTimeout(timeoutId);
  }
}

/** Confirms registration_secret matches server ADMIN_REGISTRATION_SECRET before Cognito signup (rate-limited). */
export async function precheckAdminRegistrationSecret(secret: string): Promise<void> {
  if (TEST_MODE) {
    await mockApi<{ ok: boolean }>("POST", "/auth/precheck-admin-registration-secret", {
      registration_secret: secret,
    });
    return;
  }
  const base = API_URL.replace(/\/$/, "");
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), BACKEND_HEALTH_TIMEOUT_MS);
  try {
    const res = await apiFetch(`${base}/auth/precheck-admin-registration-secret`, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ registration_secret: secret }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
    if (!res.ok) {
      if (data.code === "INVALID_REGISTRATION_SECRET" || res.status === 403) {
        throw new Error("INVALID_REGISTRATION_SECRET");
      }
      if (res.status === 503) {
        throw new Error("ADMIN_REGISTRATION_NOT_CONFIGURED");
      }
      throw new Error(data.error || `Request failed: ${res.status}`);
    }
  } finally {
    window.clearTimeout(timeoutId);
  }
}

// Cognito SDK throws if pool/client IDs are empty, so only construct the pool
// when we have real credentials. In test mode we never touch userPool.
const userPool =
  !TEST_MODE && USER_POOL_ID && CLIENT_ID
    ? new CognitoUserPool({ UserPoolId: USER_POOL_ID, ClientId: CLIENT_ID })
    : (null as unknown as CognitoUserPool);

let cachedToken: string | null = null;

const COGNITO_ADMIN_GROUP = import.meta.env.VITE_COGNITO_ADMIN_GROUP || "ZendtAdmins";

/** Install Cognito session from issued tokens (password login, social login). */
function applyCognitoTokenResponse(payload: {
  username: string;
  idToken: string;
  accessToken: string;
  refreshToken: string;
}): void {
  const u = payload.username.trim().toLowerCase();
  if (TEST_MODE) {
    setTestSession(true);
    cachedToken = TEST_AUTH_ID_TOKEN;
    return;
  }
  if (!userPool) return;

  const session = new CognitoUserSession({
    IdToken: new CognitoIdToken({ IdToken: payload.idToken }),
    AccessToken: new CognitoAccessToken({ AccessToken: payload.accessToken }),
    RefreshToken: new CognitoRefreshToken({ RefreshToken: payload.refreshToken }),
  });

  const cognitoUser = new CognitoUser({
    Username: u,
    Pool: userPool,
  });
  cognitoUser.setSignInUserSession(session);
  cachedToken = payload.idToken;
}

function decodeIdTokenPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payload = parts[1];
    const b64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
    const json = atob(b64 + pad);
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Groups from a raw ID token string (e.g. immediately after login). */
function getCognitoGroupsFromToken(token: string): string[] {
  const p = decodeIdTokenPayload(token);
  const g = p?.["cognito:groups"];
  return Array.isArray(g) ? (g as string[]) : [];
}

export function isAdminFromGroups(groups: string[]): boolean {
  return groups.includes(COGNITO_ADMIN_GROUP);
}

/** Groups from the current session ID token. */
export async function getCognitoGroups(): Promise<string[]> {
  if (TEST_MODE) return [];
  const token = await getAuthTokenAsync();
  if (!token) return [];
  return getCognitoGroupsFromToken(token);
}

export async function isAdmin(): Promise<boolean> {
  if (TEST_MODE) return false;
  const groups = await getCognitoGroups();
  return isAdminFromGroups(groups);
}

export async function getAuthTokenAsync(): Promise<string | null> {
  if (TEST_MODE) return hasTestSession() ? TEST_AUTH_ID_TOKEN : null;
  const currentUser = userPool.getCurrentUser();
  if (!currentUser) return null;

  return new Promise((resolve) => {
    currentUser.getSession((err: Error | null, session: CognitoUserSession | null) => {
      if (err || !session || !session.isValid()) {
        cachedToken = null;
        resolve(null);
        return;
      }
      cachedToken = session.getIdToken().getJwtToken();
      resolve(cachedToken);
    });
  });
}

export type SignupResult = {
  success: boolean;
  email: string;
  needsConfirmation: boolean;
  /** True when email already existed as unconfirmed — we resent the OTP instead of failing */
  resentExisting?: boolean;
  /** True when Cognito user is already confirmed (e.g. MongoDB row still missing). */
  alreadyConfirmed?: boolean;
};

/** Cognito duplicate username — admin signup rejects instead of auto-resending OTP. */
export const ADMIN_SIGNUP_EMAIL_ALREADY_USED_MESSAGE = "This email is already in use.";

/** Public signup: email already registered (Cognito confirmed + MongoDB profile). */
export const SIGNUP_EMAIL_ALREADY_EXISTS_MESSAGE = "This email is already taken.";

/** Cognito confirmed but MongoDB profile missing — finish via login, not OTP. */
export const SIGNUP_REPAIR_LOGIN_FAILED_MESSAGE =
  "This email is already verified. Sign in with your existing password or reset it from the login page.";

export type SignupEmailStatus = {
  available: boolean;
  registered?: boolean;
  /** Cognito confirmed with no MongoDB profile — skip OTP and log in to provision. */
  repair?: boolean;
};

/** Public signup email guard — returns availability and repair eligibility. */
export async function fetchSignupEmailStatus(email: string): Promise<SignupEmailStatus> {
  const normalized = normalizeAuthEmail(email);
  if (TEST_MODE) {
    return mockApi<SignupEmailStatus>("POST", "/auth/precheck-signup-email", {
      email: normalized,
    });
  }
  const base = API_URL.replace(/\/$/, "");
  const res = await apiFetch(`${base}/auth/precheck-signup-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ email: normalized }),
  });
  const data = (await res.json().catch(() => ({}))) as SignupEmailStatus & { error?: string };
  if (!res.ok) {
    throw new Error(data.error || "Could not verify this email. Please try again.");
  }
  return {
    available: data.available !== false,
    registered: data.registered,
    repair: data.repair,
  };
}

/** Blocks signup on the form when the email belongs to a fully registered account. */
export async function precheckSignupEmailAvailable(email: string): Promise<void> {
  const status = await fetchSignupEmailStatus(email);
  if (!status.available && status.registered) {
    throw new Error(SIGNUP_EMAIL_ALREADY_EXISTS_MESSAGE);
  }
}

/** Login when Cognito user exists but signup was never completed (no DB row / unconfirmed). */
export const LOGIN_ACCOUNT_NOT_REGISTERED_MESSAGE = "No account found for this email.";

export function mapCognitoLoginError(err: { code?: string; name?: string; message?: string }): Error {
  const code = err.code || err.name || "";
  const msg = err.message || "";
  if (code === "UserNotConfirmedException" || /user is not confirmed|not confirmed/i.test(msg)) {
    return new Error(LOGIN_ACCOUNT_NOT_REGISTERED_MESSAGE);
  }
  if (code === "NotAuthorizedException" && /incorrect username or password/i.test(msg)) {
    return new Error("Invalid email or password.");
  }
  return new Error(msg || "Login failed.");
}

function isDuplicateSignupError(err: { code?: string; name?: string }): boolean {
  const code = err.code || err.name || "";
  return code === "UsernameExistsException" || code === "AliasExistsException";
}

function isAlreadyConfirmedCognitoError(err: { code?: string; name?: string; message?: string }): boolean {
  const code = err.code || err.name || "";
  const msg = err.message || "";
  return (
    code === "InvalidParameterException" ||
    code === "NotAuthorizedException" ||
    /already confirmed|already been confirmed|cannot be confirmed|current status is confirmed/i.test(msg)
  );
}

function isAlreadyConfirmedResendError(err: { code?: string; message?: string }): boolean {
  return isAlreadyConfirmedCognitoError(err);
}

/** Resend email OTP for an unconfirmed user (same email, incomplete signup). */
export async function resendSignupCode(email: string): Promise<void> {
  if (TEST_MODE) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const cognitoUser = new CognitoUser({ Username: normalizeAuthEmail(email), Pool: userPool });
    cognitoUser.resendConfirmationCode((err) => {
      if (err) {
        const ce = err as { code?: string; message?: string };
        const msg = err.message || "Could not resend code";
        if (
          ce.code === "InvalidParameterException" ||
          /already confirmed|already been confirmed/i.test(msg)
        ) {
          reject(new Error("This email is already verified. Please sign in."));
          return;
        }
        reject(new Error(msg));
        return;
      }
      resolve();
    });
  });
}

export async function requestSignup(
  payload: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
  },
  opts?: { onDuplicateEmail?: "resend" | "reject" }
): Promise<SignupResult> {
  const onDuplicateEmail = opts?.onDuplicateEmail ?? "resend";
  if (TEST_MODE) {
    return Promise.resolve({
      success: true,
      email: payload.email.trim(),
      needsConfirmation: true,
    });
  }
  return new Promise((resolve, reject) => {
    const username = normalizeAuthEmail(payload.email);
    const attributes = [
      new CognitoUserAttribute({ Name: "email", Value: username }),
      new CognitoUserAttribute({
        Name: "name",
        Value: `${payload.firstName} ${payload.lastName}`,
      }),
    ];

    userPool.signUp(username, payload.password, attributes, [], (err, result) => {
      if (err) {
        if (isDuplicateSignupError(err)) {
          if (onDuplicateEmail === "reject") {
            reject(new Error(SIGNUP_EMAIL_ALREADY_EXISTS_MESSAGE));
            return;
          }
          const cognitoUser = new CognitoUser({
            Username: normalizeAuthEmail(payload.email),
            Pool: userPool,
          });
          cognitoUser.resendConfirmationCode((resendErr) => {
            if (resendErr) {
              if (isAlreadyConfirmedResendError(resendErr as { code?: string; message?: string })) {
                resolve({
                  success: true,
                  email: normalizeAuthEmail(payload.email),
                  needsConfirmation: false,
                  alreadyConfirmed: true,
                });
                return;
              }
              reject(new Error(resendErr.message || "Could not resend verification code."));
              return;
            }
            resolve({
              success: true,
              email: normalizeAuthEmail(payload.email),
              needsConfirmation: true,
              resentExisting: true,
            });
          });
          return;
        }
        reject(new Error(err.message || "Signup failed"));
        return;
      }
      resolve({
        success: true,
        email: result?.user.getUsername() || payload.email,
        needsConfirmation: !result?.userConfirmed,
      });
    });
  });
}

export async function confirmSignup(
  email: string,
  code: string
): Promise<{ success: boolean; alreadyConfirmed?: boolean }> {
  if (TEST_MODE) return Promise.resolve({ success: true });
  return new Promise((resolve, reject) => {
    const cognitoUser = new CognitoUser({ Username: normalizeAuthEmail(email), Pool: userPool });
    cognitoUser.confirmRegistration(code, true, (err) => {
      if (err) {
        if (isAlreadyConfirmedCognitoError(err as { code?: string; message?: string })) {
          resolve({ success: true, alreadyConfirmed: true });
          return;
        }
        return reject(new Error(err.message || "Confirmation failed"));
      }
      resolve({ success: true });
    });
  });
}

export function normalizeAuthEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function requestLogin(payload: {
  email: string;
  password: string;
}): Promise<{ success: boolean; token: string; refreshToken: string; username: string }> {
  if (TEST_MODE) {
    const email = normalizeAuthEmail(payload.email);
    if (email === TEST_EMAIL.toLowerCase() && payload.password === TEST_PASSWORD) {
      setTestSession(true);
      cachedToken = TEST_AUTH_ID_TOKEN;
      return Promise.resolve({
        success: true,
        token: TEST_AUTH_ID_TOKEN,
        refreshToken: TEST_AUTH_REFRESH_TOKEN,
        username: TEST_EMAIL,
      });
    }
    return Promise.reject(new Error("Invalid email or password"));
  }
  return new Promise((resolve, reject) => {
    const username = normalizeAuthEmail(payload.email);
    const cognitoUser = new CognitoUser({ Username: username, Pool: userPool });
    const authDetails = new AuthenticationDetails({
      Username: username,
      Password: payload.password,
    });

    cognitoUser.authenticateUser(authDetails, {
      onSuccess(session) {
        const idToken = session.getIdToken().getJwtToken();
        const accessToken = session.getAccessToken().getJwtToken();
        const refreshToken = session.getRefreshToken().getToken();
        applyCognitoTokenResponse({
          username,
          idToken,
          accessToken,
          refreshToken,
        });
        resolve({
          success: true,
          token: idToken,
          refreshToken,
          username,
        });
      },
      onFailure(err) {
        reject(mapCognitoLoginError(err as { code?: string; name?: string; message?: string }));
      },
    });
  });
}

export type BiometricLoginOutcome = { success: true; token: string } | { success: false; error: string };

/**
 * Restore Cognito session using refresh token after native biometric unlock.
 */
export async function tryLoginWithBiometric(): Promise<BiometricLoginOutcome> {
  if (TEST_MODE) {
    return { success: false, error: "cancelled" };
  }
  const unlock = await verifyBiometricAndGetCredentials();
  if (!unlock.ok) {
    return {
      success: false,
      error: unlock.reason === "cancelled" ? "cancelled" : unlock.message || unlock.reason,
    };
  }

  return new Promise((resolve) => {
    const cognitoUser = new CognitoUser({ Username: unlock.username, Pool: userPool });
    const refreshToken = new CognitoRefreshToken({ RefreshToken: unlock.refreshToken });
    cognitoUser.refreshSession(refreshToken, (err, session) => {
      if (err || !session) {
        clearBiometricCredentials().catch(() => {});
        resolve({
          success: false,
          error: err?.message || "Session expired. Sign in with your password.",
        });
        return;
      }
      const idToken = session.getIdToken().getJwtToken();
      const accessToken = session.getAccessToken().getJwtToken();
      const newRefresh = session.getRefreshToken().getToken();
      if (!idToken || !accessToken || !newRefresh) {
        clearBiometricCredentials().catch(() => {});
        resolve({ success: false, error: "Session invalid. Sign in with your password." });
        return;
      }
      applyCognitoTokenResponse({
        username: unlock.username,
        idToken,
        accessToken,
        refreshToken: newRefresh,
      });
      resolve({ success: true, token: idToken });
    });
  });
}

const APPLE_HINT_KEY = "zendt_apple_signin_email_hint";

/** `openid` is required for a stable OIDC `id_token` (backend verifies via social-login). */
const GOOGLE_SIGNIN_SCOPES = ["openid", "profile", "email"] as const;

function messageFromSocialSignInFailure(e: unknown): string {
  if (typeof e === "string") return e;
  if (e instanceof Error && e.message) return e.message;
  if (!e || typeof e !== "object") return "";
  const o = e as Record<string, unknown>;
  if (typeof o.error === "string") return o.error;
  const inner = o.error;
  if (inner && typeof inner === "object") {
    const im = (inner as Record<string, unknown>).message;
    if (typeof im === "string") return im;
  }
  if (typeof o.message === "string") return o.message;
  try {
    return JSON.stringify(o);
  } catch {
    return "";
  }
}

function socialSignInErrorCode(e: unknown): string {
  if (!e || typeof e !== "object") return "";
  const o = e as Record<string, unknown>;
  if (typeof o.code === "string") return o.code.trim();
  if (typeof o.code === "number") return String(o.code);
  return "";
}

/**
 * Android GoogleSignIn.requestIdToken() must use the Web OAuth client ID (backend `aud`).
 * iOS uses its iOS OAuth client ID as GIDConfiguration.clientID.
 */
function googleNativeSignInClientId(platform: string): string {
  const web = import.meta.env.VITE_GOOGLE_OAUTH_WEB_CLIENT_ID?.trim() || "";
  const ios = import.meta.env.VITE_GOOGLE_OAUTH_IOS_CLIENT_ID?.trim() || "";
  if (platform === "ios") return ios || web;
  if (platform === "android") return web;
  return web;
}

/** Maps Google Sign-In plugin errors to actionable hints. */
function messageFromGoogleSignInFailure(e: unknown): string {
  const raw = messageFromSocialSignInFailure(e);
  const code = socialSignInErrorCode(e);
  if (code === "12501" || /12501|cancel/i.test(raw)) {
    return "Google sign-in was cancelled.";
  }
  if (code === "10" || /\b10\b/.test(code)) {
    return (
      "Google Sign-In configuration error (code 10). Android ID tokens must use your Web OAuth client ID; " +
      "register the debug/release SHA-1 for package com.zendt.app on the Android OAuth client in Google Cloud Console."
    );
  }
  if (/something went wrong/i.test(raw)) {
    const suffix = code ? ` (code ${code})` : "";
    return `Google Sign-In failed${suffix}. Check Web and platform OAuth clients and SHA-1 in Google Cloud Console.`;
  }
  return raw;
}

/** Maps Apple sign-in errors to actionable hints (does not replace detailed plugin errors). */
function messageFromAppleSignInFailure(e: unknown): string {
  const raw = messageFromSocialSignInFailure(e);
  if (/Web fallback also failed|Apple web sign-in/i.test(raw)) return raw;
  if (/No UI window for Sign in with Apple/i.test(raw)) {
    return `${raw} Then run npm run ios:prepare and rebuild in Xcode (App.xcworkspace).`;
  }
  if (/1001|cancel/i.test(raw)) {
    if (Capacitor.getPlatform() === "ios" && /web sign-in|ASWebAuthentication/i.test(raw)) {
      return (
        "Apple sign-in closed before completing. Ensure VITE_APPLE_CLIENT_ID is your Services ID (com.zendt.app.signin), " +
        "backend/ngrok is running, and Simulator Settings → Apple Account is signed in, then try again."
      );
    }
    return "Sign in with Apple was cancelled.";
  }
  if (/1000|authorizationError|unknown/i.test(raw)) {
    if (Capacitor.getPlatform() === "ios") {
      return (
        `${raw} On Simulator, Zendt uses web Apple sign-in (Safari sheet), not the native button — ensure Settings → Apple Account is signed in, ` +
        `backend/ngrok is running (${import.meta.env.VITE_API_URL || "VITE_API_URL"}), and Services ID return URL matches VITE_APPLE_REDIRECT_URI. ` +
        `On a real iPhone, enable Sign in with Apple under Xcode Signing & Capabilities and for App ID com.zendt.app.`
      );
    }
    return "Apple Sign In failed (error 1000). Check Apple Developer Services ID, return URL, and open the app on your registered HTTPS domain.";
  }
  return raw;
}

async function authorizeAppleSignIn(
  platform: string,
  servicesId: string,
  httpsRedirectURI: string,
  base: { scopes: string; state: string; nonce: string }
): Promise<{
  response?: {
    identityToken?: string;
    email?: string | null;
    givenName?: string | null;
    familyName?: string | null;
  };
}> {
  if (platform === "ios") {
    const { ZendtAppleSignIn } = await import("./zendtAppleSignInNative");
    return ZendtAppleSignIn.authorize({
      ...base,
      clientId: servicesId,
      redirectURI: httpsRedirectURI,
      useWeb: true,
    });
  }
  const { SignInWithApple } = await import("@capacitor-community/apple-sign-in");
  return SignInWithApple.authorize({
    ...base,
    clientId: appleAuthorizeClientId(platform, servicesId),
    redirectURI: httpsRedirectURI,
  });
}

let gsiClientLoadPromise: Promise<void> | null = null;

/** Sign-In with Google (GIS) — web only; avoids deprecated gapi.auth2 popup false "popup_closed_by_user". */
async function loadGoogleGsiClient(): Promise<void> {
  if (typeof window === "undefined") return;
  if (window.google?.accounts?.id) return;

  gsiClientLoadPromise ??= new Promise<void>((resolve, reject) => {
    const finishOk = () => {
      if (window.google?.accounts?.id) resolve();
      else reject(new Error("Google Sign-In client failed to initialize."));
    };

    const existing = document.querySelector<HTMLScriptElement>(
      'script[src^="https://accounts.google.com/gsi/client"]'
    );
    if (existing) {
      if (window.google?.accounts?.id) {
        finishOk();
        return;
      }
      existing.addEventListener("load", () => finishOk());
      existing.addEventListener("error", () => reject(new Error("Failed to load Google Sign-In script.")));
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => finishOk();
    script.onerror = () => reject(new Error("Failed to load Google Sign-In script."));
    document.head.appendChild(script);
  });

  await gsiClientLoadPromise;
}

function requestGoogleCredentialJwtViaGsiOverlay(webClientId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const idApi = window.google?.accounts?.id;
    if (!idApi) {
      reject(new Error("Google Sign-In is not available in this browser."));
      return;
    }

    let settled = false;

    const finish = (kind: "ok" | "err", payload?: string | Error) => {
      if (settled) return;
      settled = true;
      window.removeEventListener("keydown", onKeyDown);
      try {
        overlay.remove();
      } catch {
        /* ignore */
      }
      try {
        idApi.cancel?.();
      } catch {
        /* ignore */
      }
      if (kind === "ok" && typeof payload === "string") resolve(payload);
      else
        reject(payload instanceof Error ? payload : new Error(String(payload ?? "Google sign-in failed.")));
    };

    const overlay = document.createElement("div");
    overlay.style.cssText = [
      "position:fixed",
      "inset:0",
      "z-index:2147483646",
      "display:flex",
      "align-items:center",
      "justify-content:center",
      "background:rgba(15,23,42,0.45)",
      "padding:16px",
    ].join(";");

    const card = document.createElement("div");
    card.onclick = (e) => e.stopPropagation();
    card.style.cssText = [
      "background:#fff",
      "border-radius:12px",
      "padding:20px 20px 16px",
      "max-width:360px",
      "width:100%",
      "box-shadow:0 10px 40px rgba(0,0,0,0.2)",
    ].join(";");

    const title = document.createElement("p");
    title.textContent = "Sign in with Google";
    title.style.cssText = "margin:0 0 12px;font:600 16px system-ui,-apple-system,sans-serif;color:#0f172a";

    const hint = document.createElement("p");
    hint.textContent = "Use the Google button below to finish signing in.";
    hint.style.cssText = "margin:0 0 16px;font:13px system-ui;color:#475569;line-height:1.4";

    const btnWrap = document.createElement("div");
    btnWrap.style.cssText =
      "min-height:48px;display:flex;flex-wrap:wrap;align-items:center;justify-content:center";

    const cancelRow = document.createElement("div");
    cancelRow.style.cssText = "margin-top:16px;text-align:center";

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.textContent = "Cancel";
    cancelBtn.style.cssText =
      "font:14px system-ui;color:#64748b;background:transparent;border:none;cursor:pointer;text-decoration:underline;padding:4px 8px";

    card.append(title, hint, btnWrap, cancelRow);
    cancelRow.appendChild(cancelBtn);
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") finish("err", new Error("Google sign-in was cancelled."));
    };
    window.addEventListener("keydown", onKeyDown);

    overlay.addEventListener("click", () => finish("err", new Error("Google sign-in was cancelled.")));
    cancelBtn.addEventListener("click", () => finish("err", new Error("Google sign-in was cancelled.")));

    idApi.initialize({
      client_id: webClientId,
      auto_select: false,
      ux_mode: "popup",
      use_fedcm_for_prompt: false,
      callback: (res: unknown) => {
        const credential =
          typeof res === "object" && res !== null ? (res as { credential?: string }).credential : undefined;
        if (!credential) {
          finish("err", new Error("Google did not return a credential."));
          return;
        }
        finish("ok", credential);
      },
    });

    idApi.renderButton(btnWrap, {
      type: "standard",
      theme: "outline",
      size: "large",
      shape: "rectangular",
      text: "continue_with",
      logo_alignment: "left",
      width: 312,
      locale: (typeof navigator !== "undefined" ? navigator.language : "en").slice(0, 12),
    });
  });
}

async function ensureGoogleAuthConfigured(): Promise<void> {
  if (typeof window === "undefined") return;
  const web = import.meta.env.VITE_GOOGLE_OAUTH_WEB_CLIENT_ID?.trim();
  const ios = import.meta.env.VITE_GOOGLE_OAUTH_IOS_CLIENT_ID?.trim();
  const android = import.meta.env.VITE_GOOGLE_OAUTH_ANDROID_CLIENT_ID?.trim();
  if (!web && !ios && !android) return;

  const platform = Capacitor.getPlatform();
  if (platform === "android" && !web) {
    throw new Error(
      "Google sign-in on Android requires VITE_GOOGLE_OAUTH_WEB_CLIENT_ID (Web OAuth client ID for ID token audience)."
    );
  }
  if (platform === "ios" && !ios && !web) {
    throw new Error(
      "Google sign-in on iOS requires VITE_GOOGLE_OAUTH_IOS_CLIENT_ID (or Web client ID as fallback)."
    );
  }

  const clientId = googleNativeSignInClientId(platform);
  if (!clientId) return;

  const { GoogleAuth } = await import("@codetrix-studio/capacitor-google-auth");
  /** Omit grantOfflineAccess — falls back to capacitor.config forceCodeForRefreshToken (avoids iOS silent restore). */
  await GoogleAuth.initialize({
    scopes: [...GOOGLE_SIGNIN_SCOPES],
    clientId,
  });
}

/** Clear cached Google account so the next sign-in shows the account picker (native + web). */
async function resetGoogleSignInChooserState(): Promise<void> {
  const platform = Capacitor.getPlatform();
  if (platform === "web") {
    try {
      window.google?.accounts?.id?.disableAutoSelect?.();
    } catch {
      /* ignore */
    }
    return;
  }
  try {
    const { GoogleAuth } = await import("@codetrix-studio/capacitor-google-auth");
    await GoogleAuth.signOut();
  } catch {
    /* not signed in with Google SDK yet */
  }
}

async function readStoredAppleEmailHint(): Promise<string> {
  try {
    if (!Capacitor.isNativePlatform()) return "";
    const { Preferences } = await import("@capacitor/preferences");
    const { value } = await Preferences.get({ key: APPLE_HINT_KEY });
    return (value || "").trim().toLowerCase();
  } catch {
    return "";
  }
}

async function persistAppleEmailHint(email: string): Promise<void> {
  const e = email.trim().toLowerCase();
  if (!e) return;
  try {
    if (!Capacitor.isNativePlatform()) return;
    const { Preferences } = await import("@capacitor/preferences");
    await Preferences.set({ key: APPLE_HINT_KEY, value: e });
  } catch {
    /* ignore */
  }
}

export type SocialLoginResult = {
  token: string;
  accessToken: string;
  refreshToken: string;
  username: string;
  /** True when the backend emailed a starter password */
  isNewUser: boolean;
  /** True when an existing password account was linked to this provider on this sign-in */
  linkedAccount?: boolean;
};

const SOCIAL_LOGIN_ERROR_MESSAGES: Record<string, string> = {
  APPLE_EMAIL_REQUIRED:
    "Apple didn't share your email. In Settings → Apple ID → Sign-In & Security → Apps Using Apple ID, remove Zendt and sign in again, choosing Share My Email.",
  SOCIAL_IDENTITY_MISMATCH: "This Google or Apple account is linked to a different Zendt profile.",
  SOCIAL_LOGIN_NOT_LINKED:
    "No Zendt account is linked to this sign-in. Create an account with email and password first, then sign in with Google or Apple using the same email.",
  PASSWORD_REQUIRED_FOR_SOCIAL: "Enter your Zendt password to link Google or Apple to this email account.",
  INVALID_ACCOUNT_PASSWORD: "Incorrect email or password.",
  EMAIL_NOT_VERIFIED: "Email is not verified with the identity provider.",
  ACCOUNT_DEACTIVATED: "This account has been deactivated.",
};

/** Thrown when social-login needs the user's email/password to link providers without resetting Cognito. */
export class SocialLoginPasswordRequiredError extends Error {
  readonly code = "PASSWORD_REQUIRED_FOR_SOCIAL" as const;

  constructor(message?: string) {
    super(message || SOCIAL_LOGIN_ERROR_MESSAGES.PASSWORD_REQUIRED_FOR_SOCIAL);
    this.name = "SocialLoginPasswordRequiredError";
  }
}

export type SocialLoginOptions = {
  displayNameHint?: string;
  /** Apple: when the identity token omits email */
  emailFallback?: string;
  /** Link Google/Apple to an existing email/password account */
  accountPassword?: string;
  refreshToken?: string;
};

function socialLoginErrorMessage(data: { error?: string; code?: string }): string {
  const backendError = typeof data.error === "string" ? data.error.trim() : "";
  if (backendError) return backendError;
  const code = typeof data.code === "string" ? data.code : "";
  if (code && SOCIAL_LOGIN_ERROR_MESSAGES[code]) {
    return SOCIAL_LOGIN_ERROR_MESSAGES[code];
  }
  return "Social sign-in failed";
}

async function postSocialLogin(body: Record<string, unknown>): Promise<SocialLoginResult> {
  if (TEST_MODE) {
    return mockApi<SocialLoginResult>("POST", "/auth/social-login", body);
  }
  const res = await apiFetch(`${API_URL}/auth/social-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data: Partial<SocialLoginResult> & { error?: string; code?: string; detail?: string };
  try {
    data = text ? (JSON.parse(text) as typeof data) : {};
  } catch {
    throw new Error(
      text
        ? `Social sign-in failed (${res.status}). ${text.slice(0, 200)}`
        : `Social sign-in failed (${res.status}). Empty response.`
    );
  }
  if (!res.ok) {
    const code = typeof data.code === "string" ? data.code : "";
    const friendly = socialLoginErrorMessage(data);
    if (code === "PASSWORD_REQUIRED_FOR_SOCIAL") {
      throw new SocialLoginPasswordRequiredError(friendly);
    }
    const codeSuffix = code ? ` (${code})` : "";
    const detail =
      typeof data.detail === "string" && data.detail.trim() && data.detail.trim() !== friendly
        ? ` — ${data.detail.trim()}`
        : "";
    throw new Error(friendly + (friendly === data.error ? codeSuffix : "") + detail);
  }
  if (!data.token || !data.refreshToken || !data.username || !data.accessToken) {
    throw new Error("Incomplete social sign-in response from server.");
  }
  return {
    token: data.token,
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    username: data.username,
    isNewUser: !!data.isNewUser,
    linkedAccount: !!data.linkedAccount,
  };
}

/** True when VITE_APPLE_CLIENT_ID and VITE_APPLE_REDIRECT_URI are set (or TEST_MODE). */
export function isAppleSignInConfigured(): boolean {
  if (TEST_MODE) return true;
  const clientId = import.meta.env.VITE_APPLE_CLIENT_ID?.trim();
  const redirectURI = import.meta.env.VITE_APPLE_REDIRECT_URI?.trim();
  return !!(clientId && redirectURI);
}

/**
 * Apple Sign-In is supported on web (Apple JS popup) and iOS (native). Not on Android.
 * Mirrors Google: shown whenever configured on supported platforms.
 */
export function isAppleSignInOffered(): boolean {
  if (!isAppleSignInConfigured()) return false;
  if (TEST_MODE) return true;
  const platform = Capacitor.getPlatform();
  return platform === "ios" || platform === "web";
}

function emailFromAppleIdToken(idToken: string): string {
  const payload = decodeIdTokenPayload(idToken);
  const email = payload?.email;
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

/** Apple JS requires the page origin to match a domain registered on the Services ID. */
function assertAppleWebSignInOrigin(redirectURI: string): void {
  if (Capacitor.getPlatform() !== "web" || typeof window === "undefined") return;
  const originRaw = import.meta.env.VITE_APPLE_WEB_ORIGIN?.trim() || redirectURI;
  let expectedHost: string;
  try {
    expectedHost = new URL(originRaw).hostname;
  } catch {
    throw new Error("VITE_APPLE_REDIRECT_URI (or VITE_APPLE_WEB_ORIGIN) is not a valid URL.");
  }
  const pageHost = window.location.hostname;
  if (pageHost !== expectedHost) {
    throw new Error(
      `Sign in with Apple must run on https://${expectedHost} (registered with Apple). You are on ${pageHost}. Set VITE_APPLE_WEB_ORIGIN or open the app on that host (ngrok), or use the iOS app.`
    );
  }
}

function appleAuthorizeClientId(platform: string, servicesId: string): string {
  /** Native iOS uses the app bundle ID as JWT audience; web uses the Services ID. */
  if (platform === "ios") return "com.zendt.app";
  return servicesId;
}

function socialLoginBody(
  opts: SocialLoginOptions | undefined,
  idToken: string,
  provider: "google" | "apple"
) {
  const body: Record<string, unknown> = { provider, idToken };
  if (opts?.displayNameHint) body.displayName = opts.displayNameHint;
  if (opts?.emailFallback) body.emailHint = opts.emailFallback;
  if (opts?.accountPassword) body.accountPassword = opts.accountPassword;
  if (opts?.refreshToken) body.refreshToken = opts.refreshToken;
  return body;
}

/** Backend exchanges provider ID token for Cognito session JWTs (see POST /auth/social-login). */
export async function loginWithGoogle(opts?: SocialLoginOptions): Promise<SocialLoginResult> {
  if (TEST_MODE) {
    const out = await postSocialLogin(socialLoginBody(opts, "test.google.id-token", "google"));
    applyCognitoTokenResponse({
      username: out.username,
      idToken: out.token,
      accessToken: out.accessToken,
      refreshToken: out.refreshToken,
    });
    return out;
  }

  const webConfigured = !!(import.meta.env.VITE_GOOGLE_OAUTH_WEB_CLIENT_ID || "").trim();
  const nativeConfigured =
    !!(import.meta.env.VITE_GOOGLE_OAUTH_IOS_CLIENT_ID || "").trim() ||
    !!(import.meta.env.VITE_GOOGLE_OAUTH_ANDROID_CLIENT_ID || "").trim();
  if (!webConfigured && !nativeConfigured) {
    throw new Error(
      "Google sign-in is not configured. Add VITE_GOOGLE_OAUTH_WEB_CLIENT_ID (and iOS/Android client IDs for the native apps)."
    );
  }

  if (Capacitor.getPlatform() === "web") {
    const webId = import.meta.env.VITE_GOOGLE_OAUTH_WEB_CLIENT_ID?.trim();
    if (!webId) {
      throw new Error(
        'Google sign-in on the web requires VITE_GOOGLE_OAUTH_WEB_CLIENT_ID (OAuth "Web application" client ID from Google Cloud).'
      );
    }
    await loadGoogleGsiClient();
    await resetGoogleSignInChooserState();
    const idToken = await requestGoogleCredentialJwtViaGsiOverlay(webId);

    const out = await postSocialLogin(socialLoginBody(opts, idToken, "google"));

    applyCognitoTokenResponse({
      username: out.username,
      idToken: out.token,
      accessToken: out.accessToken,
      refreshToken: out.refreshToken,
    });
    return out;
  }

  await ensureGoogleAuthConfigured();
  await resetGoogleSignInChooserState();

  const { GoogleAuth } = await import("@codetrix-studio/capacitor-google-auth");
  let user: Awaited<ReturnType<(typeof GoogleAuth)["signIn"]>>;
  try {
    user = await GoogleAuth.signIn();
  } catch (e) {
    const hint = messageFromGoogleSignInFailure(e);
    throw new Error(hint ? `Google sign-in: ${hint}` : "Google sign-in was cancelled or failed.");
  }
  const idToken = user?.authentication?.idToken;
  if (!idToken) {
    throw new Error(
      "Google did not return an ID token. Ensure the Web OAuth client requests 'openid' scope and matches backend GOOGLE_OAUTH_* client IDs."
    );
  }

  const out = await postSocialLogin(socialLoginBody(opts, idToken, "google"));

  applyCognitoTokenResponse({
    username: out.username,
    idToken: out.token,
    accessToken: out.accessToken,
    refreshToken: out.refreshToken,
  });
  return out;
}

/** Web + iOS (Capacitor plugin). Supply `emailFallback` when Apple omits email (repeat authorization). */
export async function loginWithApple(opts?: SocialLoginOptions): Promise<SocialLoginResult> {
  if (!isAppleSignInOffered()) {
    throw new Error(
      "Sign in with Apple is not available on this device. Use the iOS app or a browser on your registered HTTPS domain."
    );
  }

  if (TEST_MODE) {
    const emailHint = (opts?.emailFallback || (await readStoredAppleEmailHint()) || TEST_EMAIL)
      .trim()
      .toLowerCase();
    const out = await postSocialLogin(
      socialLoginBody({ ...opts, emailFallback: emailHint }, "test.apple.id-token", "apple")
    );
    applyCognitoTokenResponse({
      username: out.username,
      idToken: out.token,
      accessToken: out.accessToken,
      refreshToken: out.refreshToken,
    });
    return out;
  }

  const servicesId = import.meta.env.VITE_APPLE_CLIENT_ID?.trim();
  const redirectURI = import.meta.env.VITE_APPLE_REDIRECT_URI?.trim();
  if (!servicesId || !redirectURI) {
    throw new Error(
      "Apple Sign In is not configured. Set VITE_APPLE_CLIENT_ID and VITE_APPLE_REDIRECT_URI (Services ID + return URL from Apple Developer)."
    );
  }

  assertAppleWebSignInOrigin(redirectURI);

  const platform = Capacitor.getPlatform();

  let res: Awaited<ReturnType<typeof authorizeAppleSignIn>>;
  try {
    res = await authorizeAppleSignIn(platform, servicesId, redirectURI, {
      scopes: "email name",
      state: "zendt-social",
      nonce: "zendt-" + Math.random().toString(36).slice(2),
    });
  } catch (e) {
    const raw = e instanceof Error ? e.message : messageFromSocialSignInFailure(e);
    const hint = messageFromAppleSignInFailure(e);
    const msg = hint && hint !== raw ? hint : raw || "Apple sign-in was cancelled or failed.";
    throw new Error(msg.startsWith("Apple sign-in:") ? msg : `Apple sign-in: ${msg}`);
  }

  const idToken = res.response?.identityToken || "";
  if (!idToken) {
    throw new Error("Apple did not return an identity token.");
  }

  const dn =
    `${res.response?.givenName || ""} ${res.response?.familyName || ""}`.trim() ||
    opts?.displayNameHint?.trim();

  const emailFromApple =
    (res.response?.email || "").trim().toLowerCase() ||
    emailFromAppleIdToken(idToken) ||
    (opts?.emailFallback || "").trim().toLowerCase() ||
    (await readStoredAppleEmailHint());
  if (emailFromApple) await persistAppleEmailHint(emailFromApple);

  const out = await postSocialLogin(
    socialLoginBody(
      {
        ...opts,
        displayNameHint: dn || opts?.displayNameHint,
        emailFallback: emailFromApple || opts?.emailFallback,
      },
      idToken,
      "apple"
    )
  );

  applyCognitoTokenResponse({
    username: out.username,
    idToken: out.token,
    accessToken: out.accessToken,
    refreshToken: out.refreshToken,
  });
  return out;
}

/** Cognito Hosted-style forgot password email (verification code). */
export async function forgotPassword(email: string): Promise<void> {
  const username = normalizeAuthEmail(email);
  if (TEST_MODE) {
    void username;
    return;
  }
  if (!userPool) throw new Error("Authentication is not configured.");
  await new Promise<void>((resolve, reject) => {
    const cognitoUser = new CognitoUser({ Username: username, Pool: userPool });
    cognitoUser.forgotPassword({
      onSuccess() {
        resolve();
      },
      onFailure(err) {
        reject(new Error(err.message || "Could not send reset code."));
      },
    });
  });
}

export async function confirmForgotPassword(
  email: string,
  code: string,
  newPassword: string
): Promise<void> {
  const username = normalizeAuthEmail(email);
  const trimmedCode = code.trim();
  if (TEST_MODE) {
    if (username !== TEST_EMAIL.toLowerCase()) {
      throw new Error("No account found for that email.");
    }
    if (trimmedCode !== "123456") {
      throw new Error("Invalid verification code.");
    }
    if (!isPasswordStrongEnough(newPassword)) {
      throw new Error(
        "New password must be at least 8 characters and include upper, lower, number, and a symbol."
      );
    }
    return;
  }
  if (!userPool) throw new Error("Authentication is not configured.");
  await new Promise<void>((resolve, reject) => {
    const cognitoUser = new CognitoUser({ Username: username, Pool: userPool });
    cognitoUser.confirmPassword(trimmedCode, newPassword, {
      onSuccess() {
        resolve();
      },
      onFailure(err) {
        reject(new Error(err.message || "Could not reset password."));
      },
    });
  });
}

export function isPasswordStrongEnough(password: string): boolean {
  if (password.length < 8) return false;
  if (!/[a-z]/.test(password)) return false;
  if (!/[A-Z]/.test(password)) return false;
  if (!/\d/.test(password)) return false;
  if (!/[^A-Za-z0-9]/.test(password)) return false;
  return true;
}

export async function changePassword(oldPassword: string, newPassword: string): Promise<void> {
  if (!isPasswordStrongEnough(newPassword)) {
    throw new Error(
      "New password must be at least 8 characters and include upper, lower, number, and a symbol."
    );
  }
  if (TEST_MODE) {
    if (oldPassword !== TEST_PASSWORD) {
      throw new Error("Current password is incorrect.");
    }
    return;
  }
  if (!userPool) throw new Error("Authentication is not configured.");
  const cognitoUser = userPool.getCurrentUser();
  if (!cognitoUser) throw new Error("You must be signed in to change your password.");

  await new Promise<void>((resolve, reject) => {
    cognitoUser.getSession((err: Error | null, session: CognitoUserSession | null) => {
      if (err || !session || !session.isValid()) {
        reject(new Error("Session expired. Please sign in again."));
        return;
      }
      cognitoUser.changePassword(oldPassword, newPassword, (cerr) => {
        if (cerr) {
          const code = (cerr as { code?: string }).code;
          const message = cerr.message || "";
          if (code === "NotAuthorizedException" || /incorrect username or password/i.test(message)) {
            reject(new Error("Current password is incorrect."));
          } else if (code === "LimitExceededException") {
            reject(new Error("Too many attempts. Please try again later."));
          } else {
            reject(new Error(message || "Could not update password."));
          }
          return;
        }
        resolve();
      });
    });
  });
}

export async function logout(): Promise<void> {
  if (TEST_MODE) {
    setTestSession(false);
    cachedToken = null;
    return;
  }
  const currentUser = userPool.getCurrentUser();
  if (currentUser) currentUser.signOut();
  cachedToken = null;
}

export function getCurrentUser() {
  if (TEST_MODE) {
    if (!hasTestSession()) return null;
    return {
      getUsername: () => TEST_EMAIL,
    } as unknown as CognitoUser;
  }
  return userPool.getCurrentUser();
}
