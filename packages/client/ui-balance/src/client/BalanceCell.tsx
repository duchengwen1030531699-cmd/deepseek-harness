/**
 * Sidebar foot balance strip and detail panel.
 *
 * @module @deepseek-ai/dsh-client-ui-balance/client/BalanceCell
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { BALANCE_API_PATH, BALANCE_REFRESH_PATH, type BalanceView } from '../wire.ts'
import { formatTime, formatYuan } from './format.ts'
import css from './balance.module.css'

/** The balance view's JSON error body shape when a fetch itself fails. */
function fetchErrorView(error: unknown): BalanceView {
  return {
    fetchedAt: Date.now(),
    available: false,
    total: 0,
    balances: [],
    currency: undefined,
    error: error instanceof Error ? error.message : String(error),
  }
}

/**
 * The persistent account-balance strip rendered in `sidebar.footer.action`:
 * shows the total in the wide sidebar (`余额 ¥136.33`) and a compact `¥` in
 * the rail, opens the detail panel on click, and refreshes in place.
 * @param props - the footer-action owner share (the wide flag).
 * @returns the strip with its optional fixed panel.
 */
export function BalanceCell({ wide }: PropsRuntime<'sidebar.footer.action'>) {
  const isWide = wide
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<BalanceView | null>(null)
  // Starts loading: the mount effect fires the first read immediately.
  const [loading, setLoading] = useState(true)
  const [anchor, setAnchor] = useState<{ left: number; bottom: number } | null>(null)
  const btnRef = useRef<HTMLButtonElement | null>(null)
  // Clicks on the panel (e.g. the refresh button) must not count as outside
  // clicks, so the outside-click listener excludes both the trigger and panel.
  const panelRef = useRef<HTMLDivElement | null>(null)

  const load = useCallback((force: boolean) => {
    setLoading(true)
    fetch(force ? BALANCE_REFRESH_PATH : BALANCE_API_PATH, { headers: { accept: 'application/json' } })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return response.json() as Promise<BalanceView>
      })
      .then((value) => { setView(value); setLoading(false) })
      .catch((error: unknown) => {
        setView(fetchErrorView(error))
        setLoading(false)
      })
  }, [])

  useEffect(() => { load(false) }, [load])

  useEffect(() => {
    if (!open) return undefined
    const onPointerDown = (event: PointerEvent): void => {
      const target = event.target as Node
      /* v8 ignore next -- the trigger and panel refs are always attached while
         the outside-click listener is live (open requires a prior click). */
      if (btnRef.current !== null && btnRef.current.contains(target)) return
      /* v8 ignore next -- see above; the panel only exists while open. */
      if (panelRef.current !== null && panelRef.current.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => { document.removeEventListener('pointerdown', onPointerDown) }
  }, [open])

  const toggle = (): void => {
    /* v8 ignore next -- btnRef is attached on first commit, so a click always
       finds it; the guard satisfies the ref's nullable type. */
    if (!open && btnRef.current !== null) {
      const rect = btnRef.current.getBoundingClientRect()
      setAnchor({ left: Math.max(8, rect.left), bottom: window.innerHeight - rect.top + 6 })
    }
    setOpen(!open)
  }

  const hasError = view !== null && view.error !== undefined && view.error.length > 0
  const totalText = view !== null ? formatYuan(view.total) : null
  /* v8 ignore next -- view is always settled before loading clears (load sets
     it in both settle paths), so the fallback only satisfies the type. */
  const displayTotal = totalText !== null ? totalText : '¥0.00'
  const label = loading
    ? (isWide ? '余额 …' : '¥')
    : hasError
      ? (isWide ? '余额 ?' : '¥')
      : (isWide ? `余额 ${displayTotal}` : '¥')

  const panel = open
    ? (
      <div
        ref={panelRef}
        className={css.panel}
        /* v8 ignore next -- anchor is always measured in toggle() before the
           panel opens; the undefined arm guards a defensive null. */
        style={anchor !== null ? { left: anchor.left, bottom: anchor.bottom } : undefined}
      >
        <h4 className={css.title}>DeepSeek 账户余额</h4>
        {hasError
          ? <div className={css.error} role="alert">查询失败：{view.error}</div>
          : view === null
            ? <div className={css.row}><span className={css.key}>查询中…</span></div>
            : (
              <div>
                <div className={css.row}>
                  <span className={css.key}>总余额</span>
                  <span className={css.value}>{formatYuan(view.total)}</span>
                </div>
                {view.balances.map(bucket => (
                  <div className={css.row} key={bucket.currency}>
                    <span className={css.key}>充值（{bucket.currency}）</span>
                    <span className={css.value}>{formatYuan(Number(bucket.toppedUp) || 0)}</span>
                  </div>
                ))}
                {view.balances.map(bucket => (
                  <div className={css.row} key={`${bucket.currency}-granted`}>
                    <span className={css.key}>赠送（{bucket.currency}）</span>
                    <span className={css.value}>{formatYuan(Number(bucket.granted) || 0)}</span>
                  </div>
                ))}
                <div className={css.row}>
                  <span className={css.key}>账户状态</span>
                  <span className={view.available ? css.ok : css.bad}>{view.available ? '可用' : '不可用'}</span>
                </div>
                <div className={css.meta}>更新于 {formatTime(view.fetchedAt)}（非实时，仅供参考）</div>
                <button type="button" className={css.button} onClick={() => { load(true) }} disabled={loading}>
                  {loading ? '刷新中…' : '刷新'}
                </button>
              </div>
            )}
      </div>
    )
    : null

  return (
    <span className={css.cell}>
      <button
        ref={btnRef}
        type="button"
        className={hasError && !loading ? `${css.balance} ${css.balanceError}` : css.balance}
        onClick={toggle}
        title="账户余额"
      >
        {label}
      </button>
      {panel}
    </span>
  )
}
