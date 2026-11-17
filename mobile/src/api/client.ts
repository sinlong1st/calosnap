import type { DaySummary, DayTotalsSummary, LocalDate, Me } from '@/domain/types';

/**
 * Typed boundary between the app and the CaloSnap API (Architecture Review v1.1 §4.3,
 * revised by v1.2). Screens never call fetch directly; they use this interface, so the
 * mock and the future HTTP client are interchangeable.
 *
 * Checkpoint 1 covers read-only diary/dashboard calls. Scan, save and target methods
 * are added in the checkpoints that use them.
 */
export interface ApiClient {
  /** GET /api/v1/me */
  getMe(): Promise<Me>;
  /** GET /api/v1/days/{local_date} */
  getDay(localDate: LocalDate): Promise<DaySummary>;
  /** GET /api/v1/days?from=&to= (inclusive, ≤ 31 days) */
  getDays(from: LocalDate, to: LocalDate): Promise<DayTotalsSummary[]>;
}

/** Typed error codes from the API error envelope (v1.1 §4.3 + v1.2 additions). */
export type ApiErrorCode =
  | 'unauthorized'
  | 'validation_error'
  | 'image_invalid'
  | 'image_too_large'
  | 'daily_scan_limit'
  | 'budget_exhausted'
  | 'rate_limited'
  | 'busy'
  | 'scan_not_found'
  | 'scan_expired'
  | 'analysis_stale'
  | 'nutrition_unavailable'
  | 'idempotency_conflict'
  | 'revision_conflict'
  | 'service_error'
  | 'network_unreachable';

export class ApiError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
