/** Thrown by `apiRequest` when the server returns a non-2xx JSON body (includes optional `code`). */
export class ApiError extends Error {
  code?: string;

  status?: number;

  constructor(message: string, opts?: { code?: string; status?: number }) {
    super(message);
    this.name = "ApiError";
    this.code = opts?.code;
    this.status = opts?.status;
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}

/** True when the backend has no user row for an authenticated Cognito identity. */
export function isUnregisteredAccountApiError(e: unknown): boolean {
  if (!isApiError(e)) return false;
  if (e.status === 404) return true;
  const code = (e.code || "").toUpperCase();
  return (
    code === "USER_NOT_FOUND" ||
    code === "NOT_FOUND" ||
    code === "USER_NOT_REGISTERED" ||
    code === "ACCOUNT_NOT_REGISTERED"
  );
}
