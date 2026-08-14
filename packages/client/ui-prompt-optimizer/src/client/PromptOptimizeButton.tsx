/**
 * PromptOptimizeButton: the composer tool-row optimize affordance rendered
 * immediately right of the model select. Reads the live draft through the
 * framework standard kit (`useInput`), calls the Host Remote through the
 * injected verb, and replaces the draft on success (`inputActions.setDraft`).
 * Pure presentation: no ctx, no subscriptions beyond the framework hooks.
 */
import { useCallback, useRef, useState } from 'react'
import { IconSparkle16, Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PromptOptimizeButtonProps } from './slots.ts'
import css from './PromptOptimizeButton.module.css'

/**
 * Render the composer optimize button.
 * @param props - owner share (locked) + injected optimize verb + standard kit
 * (useInput / inputActions / sessionId) + the locale seat.
 * @returns an icon button, busy while an optimization is in flight.
 */
export function PromptOptimizeButton({
  locked, optimize, t, useInput, inputActions,
}: PromptOptimizeButtonProps) {
  const draft = useInput(state => state.draft)
  const latestDraft = useRef(draft)
  latestDraft.current = draft
  const [busy, setBusy] = useState(false)
  const empty = draft.trim() === ''

  const onClick = useCallback(async () => {
    if (empty || busy) return
    setBusy(true)
    try {
      const sourceDraft = draft
      const outcome = await optimize(sourceDraft)
      if (outcome.ok && latestDraft.current === sourceDraft) inputActions.setDraft(outcome.value.prompt)
    } finally {
      setBusy(false)
    }
  }, [empty, busy, optimize, draft, inputActions])

  return (
    <Tooltip label={t('button.tooltip')} side="top" delayMs={500}>
      <button
        type="button"
        className={css.button}
        aria-label={t('button.aria')}
        disabled={locked || empty || busy}
        onMouseDown={(event) => { event.preventDefault() }}
        onClick={() => { void onClick() }}
      >
        {busy ? <span className={css.spinner} aria-hidden /> : <IconSparkle16 size={14} />}
      </button>
    </Tooltip>
  )
}
