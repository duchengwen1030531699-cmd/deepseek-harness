// @vitest-environment jsdom
/** PromptOptimizeButton preserves a draft edited after its request starts. */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PromptOptimizeButton } from '../src/client/PromptOptimizeButton.tsx'
import type { PromptOptimizeButtonProps } from '../src/client/slots.ts'
import type { OptimizeOutcome } from '../src/client/controller.ts'

afterEach(cleanup)

interface Deferred<T> {
  readonly promise: Promise<T>
  resolve(value: T): void
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((complete) => { resolve = complete })
  return { promise, resolve }
}

function props(draft: { value: string }, optimize: PromptOptimizeButtonProps['optimize']) {
  const setDraft = vi.fn()
  return {
    setDraft,
    value: {
      locked: false,
      optimize,
      t: (key: string) => key,
      useInput: (select: (state: { draft: string }) => unknown) => select({ draft: draft.value }),
      inputActions: { setDraft },
    } as unknown as PromptOptimizeButtonProps,
  }
}

describe('PromptOptimizeButton', () => {
  it('does not replace a draft edited while optimization is pending', async () => {
    const pending = deferred<OptimizeOutcome>()
    const optimize = vi.fn(() => pending.promise)
    const draft = { value: 'original draft' }
    const initial = props(draft, optimize)
    const view = render(<PromptOptimizeButton {...initial.value} />)

    fireEvent.click(screen.getByRole('button', { name: 'button.aria' }))
    expect(optimize).toHaveBeenCalledWith('original draft')

    draft.value = 'later user input'
    view.rerender(<PromptOptimizeButton {...initial.value} />)
    await act(async () => { pending.resolve({ ok: true, value: { prompt: 'optimized draft' } }); await pending.promise })

    expect(initial.setDraft).not.toHaveBeenCalled()
  })

  it('replaces an unchanged draft after a successful optimization', async () => {
    const pending = deferred<OptimizeOutcome>()
    const optimize = vi.fn(() => pending.promise)
    const draft = { value: 'original draft' }
    const input = props(draft, optimize)
    render(<PromptOptimizeButton {...input.value} />)

    fireEvent.click(screen.getByRole('button', { name: 'button.aria' }))
    await act(async () => { pending.resolve({ ok: true, value: { prompt: 'optimized draft' } }); await pending.promise })

    expect(input.setDraft).toHaveBeenCalledWith('optimized draft')
  })
})
