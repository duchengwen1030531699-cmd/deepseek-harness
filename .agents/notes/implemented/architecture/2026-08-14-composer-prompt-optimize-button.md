# Agent Note: Composer prompt-optimize button over a Host Remote

Status: implemented

English | [中文](2026-08-14-composer-prompt-optimize-button.zh.md)

## Problem

The Web composer needs a way to improve a draft before sending it without exposing an LLM route or unlogged model input to the browser.

## Decision

`@deepseek-ai/dsh-prompt-optimizer` owns the auxiliary LLM call as the `promptOptimizer.optimize` Typert Remote service. It resolves the live Agent from the wire identity, frames the draft as JSON, appends the exact `session/prompt-optimize-request` record before dispatch, and returns the normalized text or a stable failure. The generated Host and Client Remote artifacts use the package's direct `zod` dependency.

The service accepts either both explicit `provider` and `model` values or neither. A partial route fails during construction instead of silently selecting the session or default route.

`@deepseek-ai/dsh-client-ui-prompt-optimizer` contributes the composer button through the `conversation.input.model.tools` list slot. A successful response replaces the draft only when it still equals the request text, so typing during the auxiliary request wins. Carrier envelopes and rejected transport promises both settle as a no-op failure.

## Alternatives considered

**Pure client-side rewrite.** The browser has no owned LLM route and cannot append the required durable model-request record.

**ApiProxy unary RPC.** Typert Remote lets the business package contribute its endpoint without extending the gateway's closed RPC method map.

**Reuse `conversation.input.right`.** That slot sits left of the model selector; the dedicated companion-controls slot gives the requested placement and preserves the existing named seats.

## Consequences

Each activation creates a bounded, independently logged auxiliary request. The Web profile mounts both plugin halves. The button has no streaming preview and intentionally leaves the current draft untouched when its request fails, its response is stale, or the configured route is unavailable.
