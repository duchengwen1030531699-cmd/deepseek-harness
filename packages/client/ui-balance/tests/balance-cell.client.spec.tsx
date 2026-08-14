// @vitest-environment jsdom
/** Client half: the balance strip component, its formatting helpers, and the browser apply. */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Context } from '@deepseek-ai/cordis'
import { BalanceCell } from '../src/client/BalanceCell.tsx'
import { formatTime, formatYuan } from '../src/client/format.ts'
import { apply, inject } from '../src/client/index.ts'
import type { BalanceView } from '../src/wire.ts'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const VIEW: BalanceView = {
  fetchedAt: 1_700_000_000_000,
  available: true,
  total: 136.33,
  currency: 'CNY',
  balances: [
    { currency: 'CNY', total: '136.33', granted: '0.00', toppedUp: '136.33' },
  ],
}

/** The two standard-kit stubs the footer-action slot delivers alongside `wide`. */
const KIT = {
  useSessions: (() => undefined) as never,
  useWorkspaces: (() => undefined) as never,
}

function stubFetch(answer: (input: RequestInfo | URL) => Promise<unknown>): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(answer)
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('formatYuan', () => {
  it('renders compact yuan amounts and a placeholder for non-finite values', () => {
    expect(formatYuan(0)).toBe('¥0.00')
    expect(formatYuan(0.005)).toBe('¥<0.01')
    expect(formatYuan(0.1234)).toBe('¥0.123')
    expect(formatYuan(136.33)).toBe('¥136.33')
    expect(formatYuan(Number.NaN)).toBe('--')
    expect(formatYuan(Number.POSITIVE_INFINITY)).toBe('--')
  })
})

describe('formatTime', () => {
  it('formats a timestamp as local HH:mm:ss', () => {
    const date = new Date(1_700_000_000_000)
    const pad = (value: number) => String(value).padStart(2, '0')
    expect(formatTime(1_700_000_000_000))
      .toBe(`${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`)
  })
})

describe('BalanceCell', () => {
  it('shows the loading state before the first read settles, then the balance', async () => {
    let resolveFetch: ((value: unknown) => void) | undefined
    stubFetch(() => new Promise((resolve) => { resolveFetch = resolve }))
    const { unmount } = render(<BalanceCell wide={true} {...KIT} />)
    expect(screen.getByText('余额 …')).toBeTruthy()
    resolveFetch?.({ ok: true, status: 200, json: async () => VIEW })
    await screen.findByText('余额 ¥136.33')
    unmount()
  })

  it('renders a compact ¥ in the rail and an error marker when the fetch fails', async () => {
    stubFetch(async () => ({ ok: false, status: 500, json: async () => ({}) }))
    const { unmount } = render(<BalanceCell wide={false} {...KIT} />)
    await screen.findByTitle('账户余额')
    expect(screen.getByTitle('账户余额').textContent).toBe('¥')
    unmount()

    stubFetch(async () => { throw new Error('network down') })
    const { unmount: unmountWide } = render(<BalanceCell wide={true} {...KIT} />)
    await screen.findByText('余额 ?')
    unmountWide()

    // A non-Error rejection still surfaces its string form in the error view.
    stubFetch(async () => { throw 'boom' })
    const { unmount: unmountString } = render(<BalanceCell wide={true} {...KIT} />)
    await screen.findByText('余额 ?')
    fireEvent.click(screen.getByTitle('账户余额'))
    expect(screen.getByRole('alert').textContent).toContain('boom')
    unmountString()
  })

  it('keeps the compact ¥ in the rail once a successful read lands', async () => {
    stubFetch(async () => ({ ok: true, status: 200, json: async () => VIEW }))
    const { unmount } = render(<BalanceCell wide={false} {...KIT} />)
    await screen.findByTitle('账户余额')
    expect(screen.getByTitle('账户余额').textContent).toBe('¥')
    unmount()
  })

  it('shows zero buckets and an unavailable account in the panel', async () => {
    stubFetch(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        fetchedAt: 1_700_000_000_000,
        available: false,
        total: 0,
        currency: 'CNY',
        balances: [{ currency: 'CNY', total: '0.00', granted: '0.00', toppedUp: '0.00' }],
      } satisfies BalanceView),
    }))
    const { unmount } = render(<BalanceCell wide={true} {...KIT} />)
    await screen.findByText('余额 ¥0.00')
    fireEvent.click(screen.getByTitle('账户余额'))
    expect(screen.getByText('不可用')).toBeTruthy()
    expect(screen.getAllByText('¥0.00').length).toBeGreaterThanOrEqual(2)
    unmount()
  })

  it('opens the detail panel on click and keeps it open while refreshing', async () => {
    let calls = 0
    stubFetch(async (input: RequestInfo | URL) => {
      calls += 1
      const path = typeof input === 'string' ? input : input instanceof URL ? input.pathname : ''
      return {
        ok: true,
        status: 200,
        json: async () => (path.includes('refresh')
          ? { ...VIEW, total: 99.9, fetchedAt: 1_700_000_000_001 }
          : VIEW),
      }
    })
    const { unmount } = render(<BalanceCell wide={true} {...KIT} />)
    await screen.findByText('余额 ¥136.33')

    fireEvent.click(screen.getByTitle('账户余额'))
    expect(screen.getByText('DeepSeek 账户余额')).toBeTruthy()
    expect(screen.getByText('充值（CNY）')).toBeTruthy()
    expect(screen.getByText('赠送（CNY）')).toBeTruthy()
    expect(screen.getByText('可用')).toBeTruthy()

    const before = calls
    fireEvent.click(screen.getByText('刷新'))
    expect(calls).toBeGreaterThan(before)
    // The panel stays open through the refresh (the refresh button is inside
    // the panel, which the outside-click listener must not treat as outside).
    expect(screen.getByText('DeepSeek 账户余额')).toBeTruthy()
    await screen.findByText('余额 ¥99.90')
    unmount()
  })

  it('shows the error detail in the panel, the loading row before the first read, and closes on an outside click', async () => {
    let resolveFetch: ((value: unknown) => void) | undefined
    stubFetch(() => new Promise((resolve) => { resolveFetch = resolve }))
    const { unmount } = render(<BalanceCell wide={true} {...KIT} />)
    // Clicking while the first read is still pending shows the loading row.
    fireEvent.click(screen.getByTitle('账户余额'))
    expect(screen.getByText('查询中…')).toBeTruthy()
    resolveFetch?.({ ok: false, status: 401, json: async () => ({}) })
    await screen.findByText('余额 ?')
    expect(screen.getByRole('alert').textContent).toContain('HTTP 401')

    fireEvent.pointerDown(document.body)
    expect(screen.queryByText('DeepSeek 账户余额')).toBeNull()
    unmount()
  })
})

describe('client apply', () => {
  it('registers the balance strip and shadows the cordis controller cell', async () => {
    const ctx = new Context()
    const registrations: { name: string; id?: string; priority?: number; order?: number; component: unknown }[] = []
    ctx.provide('slots', {
      inject(_key: string, callback: () => () => void): () => void {
        const dispose = callback()
        return () => { dispose() }
      },
      register(options: { name: string; id?: string; priority?: number; order?: number }, component: unknown) {
        registrations.push({ ...options, component })
        return () => {}
      },
    } as never)

    const fiber = ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    await fiber.dispose()

    expect(registrations).toHaveLength(2)
    expect(registrations.every(entry => entry.name === 'sidebar.footer.action')).toBe(true)
    const strip = registrations.find(entry => entry.id === 'account-balance')
    const shadow = registrations.find(entry => entry.id === 'cordis-panel')
    expect(strip?.order).toBe(10)
    expect(shadow?.priority).toBe(-1)
    // Both components render without throwing (the shadow must render null).
    render(createElement(strip!.component as never))
    render(createElement(shadow!.component as never))
  })
})
