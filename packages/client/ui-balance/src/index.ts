/**
 * Sidebar account balance, node half: owns the provider query and serves it to
 * the browser readout through two exact webServer routes. The API key is
 * resolved per query through the credentials seam and never leaves the host.
 *
 * @module @deepseek-ai/dsh-client-ui-balance
 */

import type { Context } from '@deepseek-ai/cordis'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import type { ServerResponse } from 'node:http'
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver'
import { BalanceReader, DEFAULT_BASE_URL, DEFAULT_REFRESH_INTERVAL_SECONDS, nodeFetchJson } from './balance.ts'
import { BALANCE_API_PATH, BALANCE_REFRESH_PATH, type BalanceView } from './wire.ts'

/** Deployment-varying plugin configuration. */
export interface BalanceConfig {
  /** DeepSeek API base URL; defaults to the official endpoint. */
  baseUrl?: string
  /** Minimum seconds a healthy cached view stays fresh (browser poll pacing). */
  refreshIntervalSeconds?: number
}

/** Host plugin name. */
export const name = 'ui-balance'

/** Required services: the webServer owns the route table the two routes join. */
export const inject = ['webServer']

/** Write one JSON response with a 200 status. */
function writeJson(res: ServerResponse, body: unknown): void {
  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(body))
}

/** One exact GET route answering a balance read. */
function balanceRoute(path: string, run: () => Promise<BalanceView>): WebRoute {
  return {
    kind: 'exact',
    path,
    handler: async (_req, res) => { writeJson(res, await run()) },
  }
}

/**
 * Host plugin body: build the reader over the credentials seam and global
 * fetch, then register the two balance routes for the fiber's lifetime.
 * @param ctx - Cordis context with the webServer service.
 * @param config - optional base URL and cache-window overrides.
 */
export function apply(ctx: Context, config: BalanceConfig = {}): void {
  const reader = new BalanceReader({
    // The credentials service is resolved per call, not at apply time: its
    // mounting order relative to this row is not guaranteed, and the seam
    // itself prescribes re-resolving at each operation (llm-deepseek and
    // llm-pi-ai follow the same lazy pattern).
    resolveKey: async () => {
      const credentials = ctx.get('credentials')
      return credentials === undefined
        ? undefined
        : (await credentials.resolve(credentialRef('DEEPSEEK_API_KEY')))?.value
    },
    fetchJson: nodeFetchJson,
    baseUrl: config.baseUrl ?? DEFAULT_BASE_URL,
    refreshMs: Math.max(0, (config.refreshIntervalSeconds ?? DEFAULT_REFRESH_INTERVAL_SECONDS) * 1_000),
  })
  ctx.effect(() => ctx.webServer.register(balanceRoute(BALANCE_API_PATH, () => reader.view())),
    'ui-balance: balance route')
  ctx.effect(() => ctx.webServer.register(balanceRoute(BALANCE_REFRESH_PATH, () => reader.refresh())),
    'ui-balance: balance refresh route')
}
