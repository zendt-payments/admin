/// <reference types="vite/client" />

interface Window {
  google?: {
    accounts?: {
      id?: {
        initialize: (cfg: Record<string, unknown>) => void;
        renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void;
        cancel?: () => void;
        disableAutoSelect?: () => void;
      };
    };
  };
}

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  /** Optional WebSocket base URL (defaults to ws/wss derived from VITE_API_URL). */
  readonly VITE_WS_URL?: string;
  readonly VITE_TEST_MODE?: string;
  /** Optional artificial delay in ms for mock API (test mode). Default 0. */
  readonly VITE_MOCK_LATENCY_MS?: string;
  readonly VITE_COGNITO_USER_POOL_ID?: string;
  readonly VITE_COGNITO_CLIENT_ID?: string;
  readonly VITE_COGNITO_ADMIN_GROUP?: string;
  readonly VITE_GOOGLE_OAUTH_WEB_CLIENT_ID?: string;
  readonly VITE_GOOGLE_OAUTH_IOS_CLIENT_ID?: string;
  readonly VITE_GOOGLE_OAUTH_ANDROID_CLIENT_ID?: string;
  readonly VITE_APPLE_CLIENT_ID?: string;
  readonly VITE_APPLE_REDIRECT_URI?: string;
  readonly VITE_APPLE_WEB_ORIGIN?: string;
}
