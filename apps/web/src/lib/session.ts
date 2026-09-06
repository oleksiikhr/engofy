import { ApiError, apiGet } from './api';
import type { CurrentUser } from './types';

// Resolves the signed-in user from the forwarded session cookie, or null for a
// guest. 401 (no / expired session) is the normal guest path, not an error.
export async function getCurrentUser(
  request: Request,
): Promise<CurrentUser | null> {
  try {
    return await apiGet<CurrentUser>('/auth/me', { request });
  } catch (error) {
    if (
      error instanceof ApiError &&
      (error.status === 401 || error.status === 404)
    ) {
      return null;
    }
    throw error;
  }
}
