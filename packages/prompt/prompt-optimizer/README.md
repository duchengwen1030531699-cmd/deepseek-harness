# @deepseek-ai/dsh-prompt-optimizer

English | [中文](README.zh.md)

Rewrite a draft natural-language request into a well-formed prompt through the harness LLM route. The service is a Typert Remote endpoint (`ctx.remote.promptOptimizer`) consumed by the Web Client's composer tool-row button ([`@deepseek-ai/dsh-client-ui-prompt-optimizer`](../../client/ui-prompt-optimizer/README.md)); the Host resolves the session's Agent, records the exact auxiliary model request on the session log, and returns the normalized optimized prompt.

## Service API

`PromptOptimizerService` registers the `promptOptimizer` service key and the Remote namespace `promptOptimizer.optimize`:

| Method | Wire endpoint | Returns |
|---|---|---|
| `optimize(agent, { text })` | `promptOptimizer/optimize` | `PromptOptimizeResult` |

The method takes the live `Agent` resolved from the wire identity (the `agent` Typert lookup configured by `dsh-host-apiproxy`); the Client passes the session id.

### Results

- `{ ok: true, value: { prompt } }` — the optimized prompt, verbatim model text after whitespace normalization.
- `{ ok: false, error: { code: 'empty' } }` — the draft was empty or whitespace-only.
- `{ ok: false, error: { code: 'route-unavailable' } }` — no explicit provider/model pair was configured and neither the session log nor `ctx.agentDefaultModel` yielded a route.
- `{ ok: false, error: { code: 'llm-failed', message } }` — the auxiliary model request failed, timed out, produced only a tool call, or produced no text.

## Configuration

| Field | Required | Meaning |
|---|---|---|
| `maxInputBytes` | yes | Maximum UTF-8 bytes in the framed user prompt. |
| `maxOutputTokens` | yes | Auxiliary generation output-token cap. |
| `timeoutMs` | yes | End-to-end auxiliary request deadline. |
| `provider` / `model` | no | Explicit route; both must be supplied together. |

Without an explicit pair, the route resolves from the session's latest logged `request/header`, then from `ctx.agentDefaultModel`. A deployment with none of the three sources receives `route-unavailable`; a configuration with only one explicit field fails while the plugin loads.

## Events

The service appends a log-only pre-dispatch record before every auxiliary model request (the repo-wide model-visible⟺logged rule):

| Event | Payload |
|---|---|
| `session/prompt-optimize-request` | `{ route, system, messages, maxTokens }` |

## Extension points

None — the plugin contributes a self-contained Remote endpoint. The Client side owns the composer entry point.

## Model Experience

### Request context and condition

#### What the model sees

One auxiliary user message carrying the draft framed as JSON, plus the stable optimization system instruction, on the resolved route, every time the user activates the composer's optimize button.

##### Verbatim text for the system instruction

```markdown
You are a prompt engineering assistant.
Rewrite the supplied natural-language request into a clear, structured, and professional prompt.
Preserve every requirement and constraint the user stated; add only structural clarity.
Return only the optimized prompt as plain text, with no quotes, prefix, explanation, Markdown, XML, or terminal control codes. No code is allowed.
Use the language of the input text.
```

#### Token effect

Conditional: one auxiliary request whose input size is bounded by `maxInputBytes` and output by `maxOutputTokens`, per optimize click.

#### KV Cache effect

Independent model request: it reuses whatever provider cache the route offers; the framed JSON input is append-only relative to itself and does not reuse the conversation prefix.

## Known Limitations and Deferred Work

- **No client-side streaming preview** — the button awaits the full auxiliary call and replaces the draft once; a live streaming preview is deferred.
- **Route resolution is session-default based** — a session that never logged a model request and has no `agentDefaultModel` cannot optimize without an explicit `provider`/`model` pair.
