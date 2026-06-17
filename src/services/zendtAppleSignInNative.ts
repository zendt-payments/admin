import { registerPlugin } from "@capacitor/core";

export interface ZendtAppleSignInAuthorizeResult {
  response?: {
    user?: string;
    email?: string | null;
    givenName?: string | null;
    familyName?: string | null;
    identityToken?: string;
    authorizationCode?: string;
  };
}

export interface ZendtAppleSignInPlugin {
  authorize(options: {
    clientId: string;
    redirectURI: string;
    scopes: string;
    state: string;
    nonce: string;
    /** iOS: use Services ID + custom URL scheme when native sheet fails (Simulator). */
    useWeb?: boolean;
  }): Promise<ZendtAppleSignInAuthorizeResult>;
}

/** iOS-only native plugin (App target) with correct storyboard window for Apple sheet. */
export const ZendtAppleSignIn = registerPlugin<ZendtAppleSignInPlugin>("ZendtAppleSignIn");
