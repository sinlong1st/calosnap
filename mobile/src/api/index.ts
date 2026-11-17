import { MockApiClient } from './mock/MockApiClient';

/**
 * The app-wide API client. Phase 1A is mock-only by PO decision; the HTTP client
 * is introduced in Phase 2 behind the same `ApiClient` interface.
 */
export const apiClient = new MockApiClient();

export type { ApiClient } from './client';
