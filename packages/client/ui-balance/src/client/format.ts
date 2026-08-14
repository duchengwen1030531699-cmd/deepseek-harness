/**
 * Pure display helpers for the balance readout.
 *
 * @module @deepseek-ai/dsh-client-ui-balance/client/format
 */

/**
 * Compact yuan amount: `¥0.00` at zero, `¥<0.01` below a cent, three decimals
 * under one yuan, two decimals from there on.
 * @param value - amount in the account currency.
 * @returns the display string.
 */
export function formatYuan(value: number): string {
  if (!Number.isFinite(value)) return '--'
  if (value <= 0) return '¥0.00'
  if (value < 0.01) return '¥<0.01'
  if (value < 1) return `¥${value.toFixed(3)}`
  return `¥${value.toFixed(2)}`
}

/**
 * Clock time `HH:mm:ss` for a fetched-at stamp.
 * @param ms - epoch milliseconds.
 * @returns the local wall-clock display string.
 */
export function formatTime(ms: number): string {
  const date = new Date(ms)
  const pad = (value: number): string => String(value).padStart(2, '0')
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}
