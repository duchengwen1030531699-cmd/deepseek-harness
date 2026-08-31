# Agent Note: Static sidebar balance readout

Status: implemented

English | [中文](2026-08-14-static-sidebar-balance-readout.zh.md)

## Problem

The Web client needs a persistent sidebar balance readout that survives page refresh. A browser surface cannot read the DeepSeek API key, and the deployment does not need the Cordis controller in the same footer area.

## Decision

`@deepseek-ai/dsh-client-ui-balance` is a dual-half Web package. Its host half resolves `DEEPSEEK_API_KEY` for each request, queries the provider through `BalanceReader`, and exposes cleaned results through `/api/balance` and `/api/balance/refresh`.

Its client half registers the balance strip in `sidebar.footer.action` and shadows the `cordis-panel` occupant while the package is mounted. The Web bundle composes the package as `ui-balance`.

## Alternatives considered

**A browser-side provider request.** Rejected because the browser must not receive the API key.

**Keep the Cordis controller beside the balance strip.** Rejected because the deployment uses the footer for the balance surface only; slot shadowing is local to this package and ends on disposal.

## Consequences

The balance surface survives refreshes and receives only a sanitized result. The value is a cached provider reference rather than a billing source, and the controller cell remains hidden for every session using this Web composition.

The host and client tests cover reader caching, route disposal, rendering, and refresh behavior.
