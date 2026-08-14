/**
 * Host-side balance reader: resolves the DeepSeek API key through the
 * credentials seam, queries the official Get User Balance endpoint, and serves
 * a cached view so the browser readout can poll without spamming the provider.
 *
 * @module @deepseek-ai/dsh-client-ui-balance/balance
 */

import type { BalanceInfo, BalanceView } from './wire.ts'

/** Official DeepSeek API base URL. */
export const DEFAULT_BASE_URL = 'https://api.deepseek.com'

/** Default minimum seconds a healthy cached view stays fresh. */
export const DEFAULT_REFRESH_INTERVAL_SECONDS = 30

/** Request timeout for one provider query, ms. */
const QUERY_TIMEOUT_MS = 10_000

/** Parsed subset of the Get User Balance response body. */
export interface ParsedBalance {
  /** Whether the account can currently be billed. */
  available: boolean
  /** Per-currency buckets in response order. */
  balances: BalanceInfo[]
  /** Sum of the per-currency totals. */
  total: number
  /** ISO currency of the first bucket; absent when the list is empty. */
  currency: string | undefined
}

/** One JSON fetch the reader performs. */
export interface FetchJsonResult {
  ok: boolean
  status: number
  text: string
}

/** Dependencies the reader needs; production wiring lives in `index.ts`. */
export interface BalanceReaderEnv {
  /** Resolve the API key; `undefined` while the credential is unconfigured. */
  resolveKey: () => Promise<string | undefined>
  /** Perform one GET with the given headers and return the raw response. */
  fetchJson: (url: string, headers: Record<string, string>) => Promise<FetchJsonResult>
  /** DeepSeek API base URL. */
  baseUrl: string
  /** Minimum milliseconds a healthy cached view stays fresh. */
  refreshMs: number
  /** Clock override for tests. */
  now?: () => number
}

/**
 * Parse the Get User Balance response body into the cleaned view.
 * @param body - parsed JSON from the endpoint.
 * @returns the parsed buckets, or `null` when the body is malformed.
 */
export function parseBalanceResponse(body: unknown): ParsedBalance | null {
  if (body === null || typeof body !== 'object') return null
  const record = body as Record<string, unknown>
  const infos = record.balance_infos
  if (!Array.isArray(infos)) return null
  const balances: BalanceInfo[] = []
  for (const info of infos) {
    if (info === null || typeof info !== 'object') return null
    const entry = info as Record<string, unknown>
    balances.push({
      currency: String(entry.currency),
      total: String(entry.total_balance),
      granted: String(entry.granted_balance),
      toppedUp: String(entry.topped_up_balance),
    })
  }
  const total = balances.reduce((sum, bucket) => sum + (Number(bucket.total) || 0), 0)
  return {
    available: record.is_available === true,
    balances,
    total,
    currency: balances.length > 0 ? balances[0]?.currency : undefined,
  }
}

/**
 * The provider-query client with a healthy-view cache. An erroneous view is
 * never reused as fresh, so the next read re-queries and the readout recovers
 * automatically once the underlying condition clears; concurrent reads are
 * deduped.
 */
export class BalanceReader {
  private cached: BalanceView | undefined
  private cachedAt = 0
  private inflight: Promise<BalanceView> | undefined

  constructor(private readonly env: BalanceReaderEnv) {}

  private timestamp(): number {
    return this.env.now !== undefined ? this.env.now() : Date.now()
  }

  /**
   * Most recent view, cached while healthy and fresh.
   * @returns the view, never rejecting (provider failures become error views).
   */
  view(): Promise<BalanceView> {
    const now = this.timestamp()
    const cached = this.cached
    if (cached !== undefined && cached.error === undefined && now - this.cachedAt < this.env.refreshMs) {
      return Promise.resolve(cached)
    }
    if (this.inflight !== undefined) return this.inflight
    this.inflight = this.query().then((view) => {
      this.cached = view
      this.cachedAt = this.timestamp()
      return view
    }).finally(() => { this.inflight = undefined })
    return this.inflight
  }

  /**
   * Force a fresh provider query, bypassing the cache window.
   * @returns the fresh view, never rejecting.
   */
  async refresh(): Promise<BalanceView> {
    this.cached = undefined
    const view = await this.query()
    this.cached = view
    this.cachedAt = this.timestamp()
    return view
  }

  private async query(): Promise<BalanceView> {
    const fetchedAt = this.timestamp()
    const fail = (error: string): BalanceView =>
      ({ fetchedAt, available: false, total: 0, balances: [], currency: undefined, error })
    try {
      const apiKey = await this.env.resolveKey()
      if (apiKey === undefined || apiKey.length === 0) {
        return fail('未配置 DEEPSEEK_API_KEY（~/.dsh/.credentials.yaml）')
      }
      const response = await this.env.fetchJson(`${this.env.baseUrl}/user/balance`, {
        authorization: `Bearer ${apiKey}`,
        accept: 'application/json',
      })
      if (!response.ok) {
        return fail(`余额接口请求失败（HTTP ${response.status}）`)
      }
      const parsed = parseBalanceResponse(JSON.parse(response.text))
      if (parsed === null) return fail('余额接口响应格式异常')
      return { fetchedAt, ...parsed }
    } catch (error) {
      return fail(error instanceof Error ? error.message : String(error))
    }
  }
}

/** The JSON fetch the production wiring hands the reader. */
export async function nodeFetchJson(
  url: string,
  headers: Record<string, string>,
): Promise<FetchJsonResult> {
  const response = await fetch(url, {
    method: 'GET',
    headers,
    redirect: 'error',
    signal: AbortSignal.timeout(QUERY_TIMEOUT_MS),
  })
  return { ok: response.ok, status: response.status, text: await response.text() }
}
