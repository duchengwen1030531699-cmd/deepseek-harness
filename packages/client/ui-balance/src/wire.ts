/**
 * Balance wire contract shared by the host reader and the browser readout.
 *
 * @module @deepseek-ai/dsh-client-ui-balance/wire
 */

/** One currency bucket reported by the DeepSeek Get User Balance endpoint. */
export interface BalanceInfo {
  /** ISO currency code (e.g. `CNY`). */
  currency: string
  /** Total balance in this currency, as reported (string, may carry cents). */
  total: string
  /** Un-expired granted balance in this currency. */
  granted: string
  /** Topped-up (purchased) balance in this currency. */
  toppedUp: string
}

/** The cleaned balance view the host route serves and the readout renders. */
export interface BalanceView {
  /** Query snapshot time (epoch ms). */
  fetchedAt: number
  /** Whether the account can currently be billed. */
  available: boolean
  /** Sum of the per-currency totals (single currency in practice). */
  total: number
  /** ISO currency of {@link BalanceView.total}; absent when no bucket exists. */
  currency: string | undefined
  /** Per-currency buckets. */
  balances: BalanceInfo[]
  /** Human-readable error when the provider query failed; absent on success. */
  error?: string
}

/** Browser-facing path of the balance readout route. */
export const BALANCE_API_PATH = '/api/balance'

/** Browser-facing path forcing a fresh provider query. */
export const BALANCE_REFRESH_PATH = '/api/balance/refresh'
