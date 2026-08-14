# Prompt Optimizer

English | [中文](prompt-optimizer.zh.md)

[`@deepseek-ai/dsh-prompt-optimizer`](../../packages/prompt/prompt-optimizer) rewrites a draft natural-language request into a well-formed prompt through the harness LLM route. The service is a Typert Remote endpoint (`ctx.remote.promptOptimizer`); the browser consumer is the composer tool-row button ([`@deepseek-ai/dsh-client-ui-prompt-optimizer`](../../packages/client/ui-prompt-optimizer)), and `@deepseek-ai/dsh-api-remotes` mounts the generated contribution so the plugin calls `ctx.remote.promptOptimizer` and never touches the transport.

Source: [`packages/prompt/prompt-optimizer/src/types.ts`](../../packages/prompt/prompt-optimizer/src/types.ts)

## Public types

```ts type-equiv
/** The current prompt-optimizer output. */
interface PromptOptimizeValue {
  /** The optimized prompt, verbatim model output after normalization. */
  readonly prompt: string
}
```

```ts type-equiv
/** Optimize one draft natural-language request into a well-formed prompt. */
interface PromptOptimizeRequest {
  /** The raw draft text the user typed. */
  readonly text: string
}
```

```ts type-equiv
/** The draft is empty or whitespace-only. */
interface PromptOptimizeEmpty {
  readonly code: 'empty'
}
```

```ts type-equiv
/** No usable LLM route could be resolved for the request. */
interface PromptOptimizeRouteUnavailable {
  readonly code: 'route-unavailable'
}
```

```ts type-equiv
/** The auxiliary model call failed or produced no usable text. */
interface PromptOptimizeLlmFailed {
  readonly code: 'llm-failed'
  /** Provider or adapter failure message. */
  readonly message: string
}
```

```ts type-equiv
/** Stable failures of the optimize operation. */
type PromptOptimizeFailure =
  | PromptOptimizeEmpty
  | PromptOptimizeRouteUnavailable
  | PromptOptimizeLlmFailed
```

```ts type-equiv
/** Successful public operation result. */
interface PromptOptimizeSuccess<T> {
  readonly ok: true
  readonly value: T
}
```

```ts type-equiv
/** Rejected public operation result with a stable business failure. */
interface PromptOptimizeRejected<E extends PromptOptimizeFailure> {
  readonly ok: false
  readonly error: E
}
```

```ts type-equiv
/** Result returned by the prompt-optimizer `optimize` operation. */
type PromptOptimizeResult =
  | PromptOptimizeSuccess<PromptOptimizeValue>
  | PromptOptimizeRejected<PromptOptimizeFailure>
```

## Request framing and route resolution

The service frames the draft as JSON inside one auxiliary user message and calls `ctx.llm.stream` with the stable optimization system instruction and the configured `maxOutputTokens` cap. Every auxiliary request is preceded by a log-only `session/prompt-optimize-request` event recording `{ route, system, messages, maxTokens }`, satisfying the repo-wide model-visible⟺logged rule; the optimized prompt is returned as the single canonical value.

The route resolves in this order: an explicit `provider`/`model` config pair, else the session's latest logged `request/header`, else `ctx.agentDefaultModel`. A deployment with none of the three receives `route-unavailable`.

## Failure semantics

An empty or whitespace-only draft returns `empty`. A model stream that ends in error or abort, times out (the capability code `PROMPT_OPTIMIZE_TIMEOUT`), requests a tool, or produces no text returns `llm-failed` with the failure message. The button in the browser leaves the draft untouched on any failure.

## Web surface

[`@deepseek-ai/dsh-client-ui-prompt-optimizer`](../../packages/client/ui-prompt-optimizer) is the browser consumer. The button is the `prompt-optimizer` entry (order 10) of the `conversation.input.model.tools` list slot, which `ui-conversation` declares and renders immediately right of the model select in the composer tool row. The button reads the live draft through the standard kit (`useInput`), calls the Remote through the injected `optimize` verb, and replaces the draft via `inputActions.setDraft` on success.

## Boundaries and limitations

- The button awaits the full auxiliary call and replaces the draft once; there is no live streaming preview.
- A replaced draft is an ordinary `setDraft` transaction and follows the composer's undo behavior.
- Route resolution is session-default based: a session that never logged a model request and has no `agentDefaultModel` cannot optimize without an explicit `provider`/`model` pair.

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

Generated from source by `scripts/gen-cordis-catalog.ts` (verified fresh by `pnpm run verify-cordis-catalog` in doc-sync; regenerate with `pnpm run gen-cordis-catalog`) — this section is byte-identical in both language sides of the page. Signature blocks use a `ts cordis-catalog` fence and keep the original source JSDoc; dispatch modes are defined in the [primer](../cordis-primer.md#dispatch-modes), and the framework-inherited `ctx` API lives in [cordis-api/inherited.md](../cordis-api/inherited.md).

<a id="ctxpromptoptimizer--promptoptimizerservice"></a>

### `ctx.promptOptimizer` — `PromptOptimizerService`

The prompt-optimizer Remote service. Resolves the session's Agent, records the exact auxiliary model request on the session log, and returns the normalized optimized prompt.

```ts cordis-catalog
/**
 * Optimize one draft into a well-formed prompt.
 * @param agent - exact live Agent resolved from the wire identity.
 * @param request - the raw draft text.
 * @returns the optimized prompt or a stable business failure.
 */
@Remote('optimize') async optimize(agent: Agent, request: PromptOptimizeRequest): Promise<PromptOptimizeResult>
```

Types: [Agent](core.md)

Source: [`packages/prompt/prompt-optimizer/src/index.ts:131`](../../packages/prompt/prompt-optimizer/src/index.ts)
<!-- END GENERATED cordis-surface -->
