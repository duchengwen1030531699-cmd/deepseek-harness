# @deepseek-ai/dsh-client-ui-prompt-optimizer

English | [中文](README.zh.md)

Composer tool-row optimize button: rewrites the draft into a well-formed prompt through the Host [`@deepseek-ai/dsh-prompt-optimizer`](../../prompt/prompt-optimizer/README.md) Remote. The button occupies the `conversation.input.model.tools` seat (declared by `dsh-client-ui-conversation`), immediately right of the model select, and replaces the draft with the optimized prompt on success.

## Composition

- **Entry**: one list entry (`id: 'prompt-optimizer'`, `order: 10`) in the `conversation.input.model.tools` seat.
- **Inject face**: `optimize(text)` wrapping the `promptOptimizer.optimize` Remote; the session id is captured per session scope.
- **Behavior**: disabled while the draft is empty or locked, busy while the auxiliary request is in flight, and a silent no-op on failure. A response replaces the draft only if it still matches the request text, so input typed during the request remains untouched.

## Extension points

None consumed beyond the slot; the Host service owns the model call.

## Model Experience

### Request context and condition

#### What the model sees

Nothing directly: the model request is owned by the Host prompt-optimizer service (one auxiliary user message with the draft framed as JSON plus the optimization system instruction), triggered by this button. This plugin contributes no prompt text of its own.

#### Token effect

Zero direct; the Host auxiliary request is bounded by its own `maxInputBytes` / `maxOutputTokens` configuration.

#### KV Cache effect

Independent; see the Host package's Model Experience.

## Known Limitations and Deferred Work

- **No optimistic result** — the button awaits the full auxiliary call and replaces the draft once; a streaming preview is deferred.
- **No undo** — a replaced draft is a normal `setDraft` transaction and follows the composer's undo behavior.
