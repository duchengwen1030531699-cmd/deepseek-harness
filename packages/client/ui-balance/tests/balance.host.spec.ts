/** Host half: balance parsing, the cached reader, and the two webServer routes. */

import { EventEmitter } from 'node:events'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import type { WebRoute, WebServer } from '@deepseek-ai/dsh-host-webserver'
import {
  BalanceReader, DEFAULT_BASE_URL, DEFAULT_REFRESH_INTERVAL_SECONDS,
  nodeFetchJson, parseBalanceResponse, type BalanceReaderEnv,
} from '../src/balance.ts'
import { apply, inject } from '../src/index.ts'
import { BALANCE_API_PATH, BALANCE_REFRESH_PATH, type BalanceView } from '../src/wire.ts'

const VALID_BODY = {
  is_available: true,
  balance_infos: [
    { currency: 'CNY', total_balance: '136.33', granted_balance: '0.00', topped_up_balance: '136.33' },
  ],
}

describe('parseBalanceResponse', () => {
  it('parses a valid response into buckets and a summed total', () => {
    expect(parseBalanceResponse(VALID_BODY)).toEqual({
      available: true,
      total: 136.33,
      currency: 'CNY',
      balances: [
        { currency: 'CNY', total: '136.33', granted: '0.00', toppedUp: '136.33' },
      ],
    })
  })

  it('sums multiple currencies, absorbs non-numeric totals, and leaves currency absent when empty', () => {
    expect(parseBalanceResponse({ balance_infos: [] })).toEqual({
      available: false,
      total: 0,
      currency: undefined,
      balances: [],
    })
    expect(parseBalanceResponse({
      balance_infos: [
        { currency: 'CNY', total_balance: '1.00', granted_balance: '0', topped_up_balance: '1.00' },
        { currency: 'USD', total_balance: '2.00', granted_balance: '0', topped_up_balance: '2.00' },
        { currency: 'JPY', total_balance: 'junk', granted_balance: '0', topped_up_balance: '0' },
      ],
    })?.total).toBe(3)
  })

  it('rejects null, non-object, non-array infos, and non-object entries', () => {
    expect(parseBalanceResponse(null)).toBeNull()
    expect(parseBalanceResponse('junk')).toBeNull()
    expect(parseBalanceResponse({ balance_infos: 'junk' })).toBeNull()
    expect(parseBalanceResponse({ balance_infos: ['junk'] })).toBeNull()
  })
})

function readerEnv(overrides: Partial<BalanceReaderEnv> = {}): {
  env: BalanceReaderEnv
  clock: { now: number }
} {
  const clock = { now: 1_000_000 }
  const env: BalanceReaderEnv = {
    resolveKey: vi.fn(async () => 'sk-test'),
    fetchJson: vi.fn(async () => ({ ok: true, status: 200, text: JSON.stringify(VALID_BODY) })),
    baseUrl: DEFAULT_BASE_URL,
    refreshMs: DEFAULT_REFRESH_INTERVAL_SECONDS * 1_000,
    now: () => clock.now,
    ...overrides,
  }
  return { env, clock }
}

describe('BalanceReader', () => {
  it('serves a fresh healthy view from cache and re-queries after expiry', async () => {
    const { env, clock } = readerEnv()
    const reader = new BalanceReader(env)
    const first = await reader.view()
    expect(first.total).toBe(136.33)
    expect(env.fetchJson).toHaveBeenCalledTimes(1)

    const cached = await reader.view()
    expect(cached).toBe(first)
    expect(env.fetchJson).toHaveBeenCalledTimes(1)

    clock.now += DEFAULT_REFRESH_INTERVAL_SECONDS * 1_000
    await reader.view()
    expect(env.fetchJson).toHaveBeenCalledTimes(2)
  })

  it('never reuses an erroneous view as fresh, and dedupes concurrent reads', async () => {
    const fetchJson = vi.fn(async () => ({ ok: false, status: 401, text: 'unauthorized' }))
    const { env } = readerEnv({ fetchJson })
    const reader = new BalanceReader(env)
    const failed = await reader.view()
    expect(failed.error).toContain('401')
    // The error view is not fresh: the next read queries again.
    await reader.view()
    expect(fetchJson).toHaveBeenCalledTimes(2)
  })

  it('dedupes concurrent reads into one provider query', async () => {
    const { env } = readerEnv()
    const reader = new BalanceReader(env)
    const [a, b] = await Promise.all([reader.view(), reader.view()])
    expect(a).toBe(b)
    expect(env.fetchJson).toHaveBeenCalledTimes(1)
  })

  it('returns an error view when the key is unconfigured, the fetch throws, or the body is malformed', async () => {
    const noKey = new BalanceReader(readerEnv({ resolveKey: async () => undefined }).env)
    expect((await noKey.view()).error).toContain('DEEPSEEK_API_KEY')

    const throwing = new BalanceReader(readerEnv({
      fetchJson: async () => { throw new Error('network down') },
    }).env)
    expect((await throwing.view()).error).toBe('network down')

    const malformed = new BalanceReader(readerEnv({
      fetchJson: async () => ({ ok: true, status: 200, text: '{"junk": 1}' }),
    }).env)
    expect((await malformed.view()).error).toBe('余额接口响应格式异常')

    const unparseable = new BalanceReader(readerEnv({
      fetchJson: async () => ({ ok: true, status: 200, text: '{nope' }),
    }).env)
    expect((await unparseable.view()).error).toContain('JSON')

    const nonError = new BalanceReader(readerEnv({
      fetchJson: async () => { throw 'boom' },
    }).env)
    expect((await nonError.view()).error).toBe('boom')
  })

  it('refresh bypasses the cache window', async () => {
    const { env } = readerEnv()
    const reader = new BalanceReader(env)
    await reader.view()
    const fresh = await reader.refresh()
    expect(fresh).not.toBeUndefined()
    expect(env.fetchJson).toHaveBeenCalledTimes(2)
  })
})

describe('nodeFetchJson', () => {
  it('returns the status, ok flag, and body text for a successful and a failing response', async () => {
    const fetchMock = vi.fn()
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => '{"ok":1}' })
    fetchMock.mockResolvedValueOnce({ ok: false, status: 429, text: async () => 'slow down' })
    vi.stubGlobal('fetch', fetchMock)
    try {
      expect(await nodeFetchJson('https://x/balance', { authorization: 'Bearer k' }))
        .toEqual({ ok: true, status: 200, text: '{"ok":1}' })
      expect(await nodeFetchJson('https://x/balance', { authorization: 'Bearer k' }))
        .toEqual({ ok: false, status: 429, text: 'slow down' })
      expect(fetchMock.mock.calls[0]?.[0]).toBe('https://x/balance')
      expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: 'GET', redirect: 'error' })
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('propagates a fetch rejection', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('refused') }))
    try {
      await expect(nodeFetchJson('https://x/balance', {})).rejects.toThrow('refused')
    } finally {
      vi.unstubAllGlobals()
    }
  })
})

function fakeWebServer(routes: WebRoute[]): Pick<WebServer, 'register'> {
  return {
    register(route) {
      routes.push(route)
      return () => {
        const at = routes.indexOf(route)
        if (at !== -1) routes.splice(at, 1)
      }
    },
  }
}

function fakeCredentials(value: string | undefined): { resolve: () => Promise<{ value: string; source: string } | undefined> } {
  return {
    resolve: async () => value === undefined ? undefined : { value, source: 'test' },
  }
}

function fakeRequest(): IncomingMessage {
  return Object.assign(new EventEmitter(), {
    url: BALANCE_API_PATH, method: 'GET', headers: {},
  }) as unknown as IncomingMessage
}

function fakeResponse(): { res: ServerResponse; body: () => string | undefined; status: () => number | undefined } {
  let status: number | undefined
  const chunks: Buffer[] = []
  const res = Object.assign(new EventEmitter(), {
    writeHead(value: number) { status = value; return this },
    write(value: string | Uint8Array) { chunks.push(Buffer.from(value)); return true },
    end(value?: unknown) {
      if (typeof value === 'string' || value instanceof Uint8Array) chunks.push(Buffer.from(value))
      ;(this as unknown as { writableEnded: boolean }).writableEnded = true
      return this
    },
  }) as unknown as ServerResponse
  return {
    res,
    body: () => (chunks.length > 0 ? Buffer.concat(chunks).toString() : undefined),
    status: () => status,
  }
}

describe('host apply', () => {
  async function mount(
    config: Record<string, unknown> = {},
    keyValue: string | null = 'sk-test',
    provideCredentials = true,
  ): Promise<{
    routes: WebRoute[]
    ctx: Context
    setKey: (value: string | undefined) => void
    dispose: () => Promise<void>
  }> {
    const ctx = new Context()
    const routes: WebRoute[] = []
    ctx.provide('webServer', fakeWebServer(routes) as WebServer)
    let current: string | null | undefined = keyValue
    const setKey = (value: string | undefined): void => { current = value }
    if (provideCredentials) {
      ctx.provide('credentials', fakeCredentials(current ?? undefined) as never)
    }
    const fiber = ctx.plugin({ inject: [...inject], apply }, config)
    await fiber.await()
    return {
      routes,
      ctx,
      setKey,
      dispose: () => fiber.dispose(),
    }
  }

  it('resolves the credentials seam lazily per request, not at apply time', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, text: async () => JSON.stringify(VALID_BODY) })))
    try {
      // The key is missing when the plugin applies...
      const { routes, ctx, setKey, dispose } = await mount({}, null, false)
      const first = fakeResponse()
      await routes[0]!.handler(fakeRequest(), first.res)
      expect((JSON.parse(first.body() ?? '{}') as BalanceView).error).toContain('DEEPSEEK_API_KEY')

      // ...and the credentials service mounts only afterwards: a later call
      // must still see it (per-call ctx.get, matching llm-deepseek).
      ctx.provide('credentials', fakeCredentials('sk-late') as never)
      setKey('sk-late')
      const second = fakeResponse()
      await routes[0]!.handler(fakeRequest(), second.res)
      const parsed = JSON.parse(second.body() ?? '{}') as BalanceView
      expect(parsed.error).toBeUndefined()
      expect(parsed.total).toBe(136.33)
      await dispose()
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('registers the two balance routes and answers them with the cached view JSON', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, text: async () => JSON.stringify(VALID_BODY) })))
    try {
      const { routes } = await mount()
      expect(routes.map(route => route.path)).toEqual([BALANCE_API_PATH, BALANCE_REFRESH_PATH])
      expect(routes.every(route => route.kind === 'exact')).toBe(true)

      const view = fakeResponse()
      await routes[0]!.handler(fakeRequest(), view.res)
      const parsed = JSON.parse(view.body() ?? '{}') as BalanceView
      expect(view.status()).toBe(200)
      expect(parsed.total).toBe(136.33)
      expect(parsed.error).toBeUndefined()

      const refresh = fakeResponse()
      await routes[1]!.handler(fakeRequest(), refresh.res)
      expect((JSON.parse(refresh.body() ?? '{}') as BalanceView).total).toBe(136.33)
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('answers an error view when the key is unconfigured, and honors config overrides', async () => {
    try {
      vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('unused') }))
      const noKey = await mount({}, null)
      const response = fakeResponse()
      await noKey.routes[0]!.handler(fakeRequest(), response.res)
      const parsed = JSON.parse(response.body() ?? '{}') as BalanceView
      expect(parsed.error).toContain('DEEPSEEK_API_KEY')

      vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 502, text: async () => '' })))
      const overridden = await mount({ baseUrl: 'https://gateway.example', refreshIntervalSeconds: 5 }, 'sk-test')
      const readerResponse = fakeResponse()
      await overridden.routes[0]!.handler(fakeRequest(), readerResponse.res)
      expect((JSON.parse(readerResponse.body() ?? '{}') as BalanceView).error).toContain('HTTP 502')
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('removes both routes when the fiber disposes', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, text: async () => '{}' })))
    try {
      const { routes, dispose } = await mount()
      expect(routes).toHaveLength(2)
      await dispose()
      expect(routes).toHaveLength(0)
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
