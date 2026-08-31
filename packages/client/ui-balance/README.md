---
description: "Sidebar account-balance readout for DeepSeek deployments; shows a host-fetched balance without exposing the API key to the browser."
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-balance

English | [中文](README.zh.md)

## Summary

This package adds a balance strip to the sidebar footer. It shows a compact account balance, opens a detail panel, and refreshes the value on demand. The host resolves `DEEPSEEK_API_KEY` and calls the DeepSeek balance API, so the browser receives a cleaned result rather than the credential. Choose it for a Web deployment that needs a quick balance reference; its values are not a billing record.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

Add this package to a Web bundle that provides `webServer`, `credentials`, the sidebar, and the client renderer. The supplied Web patch mounts it as `ui-balance`; it reads `DEEPSEEK_API_KEY` when a browser asks for the balance and returns an error view when the key is unavailable.

### Configure refresh behavior

The plugin accepts `baseUrl` and `refreshIntervalSeconds`. A healthy result is cached for 30 seconds by default; the refresh action bypasses that cache. The browser reads `/api/balance` for an ordinary update and `/api/balance/refresh` for a forced update.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

The host half owns `BalanceReader`, which resolves the credential for each query, validates the provider response, deduplicates concurrent requests, and registers two exact web routes. The client half occupies `sidebar.footer.action` and shadows the optional Cordis controller cell for this deployment. See [`src/index.ts`](src/index.ts) and [`src/client/index.ts`](src/client/index.ts) for the registrations.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [ui-sidebar](../ui-sidebar/README.md) — declares and renders the footer-action slot.
- [credentials](../../credentials/credentials/README.md) — resolves the host-held API key.
- [webserver](../../host/webserver/README.md) — owns the HTTP route table.

-----

<a id="model-experience"></a>
## Model Experience

### Balance readout

#### What the model sees

Nothing from `BalanceReader` reaches a model request; this package registers browser presentation and host HTTP routes only.

#### Token effect

None; the balance view is not recorded in session history or assembled into a prompt.

#### KV Cache effect

None; this package does not contribute provider-request content.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

The readout is a convenience surface with a deliberately small host API.

- **Not real-time** — provider values and the healthy-result cache can lag billing.
- **Fixed credential name** — the host resolves `DEEPSEEK_API_KEY` only.
- **Deployment-wide footer replacement** — mounting the package hides the `cordis-panel` footer cell while it remains active.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
