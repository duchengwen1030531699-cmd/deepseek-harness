# Agent Note: Static sidebar balance readout (survives refresh)

Status: implemented

English | [中文](2026-08-14-static-sidebar-balance-readout.zh.md)

## 问题

Dynamic Cordis plugins' browser halves do not restore after a page refresh by design ("a refresh starts clean"), so the sidebar balance strip and controller shadow previously built as a dynamic plugin lost effect on every refresh; the user also no longer wants the dynamic-plugin controller (`cordis-panel`) in the sidebar foot. The balance readout must become a static web client plugin so the strip and the shadow take effect on every page boot.

## 决策

**新增静态双半包 `packages/client/ui-balance`（`@deepseek-ai/dsh-client-ui-balance`）。** The node half (`src/index.ts`) resolves `DEEPSEEK_API_KEY` through the credentials seam per query and calls the official Get User Balance endpoint with `redirect: 'error'`, serving a cleaned view over two exact webServer routes (`/api/balance`, `/api/balance/refresh`); the key never leaves the host, and the balance is labelled "not real-time, for reference only". The browser half (`src/client/`) registers a persistent strip in `sidebar.footer.action` (wide: `余额 ¥136.33`, rail: `¥`) that opens a detail panel on click (total / topped-up / granted / availability / last-update + in-place refresh), and shadows the shipped `cordis-panel` cell at `priority: -1` (lowest priority renders; a same-priority duplicate registration throws).

**装配面与先例对齐。** The package joins the `dsh.client` roster (`cordis.patch.yml`), the web-app dependency list, and the client aggregate; as a dual-half package it joins host-aggregate typechecking through a `tsconfig.host.json` reference (matching the `api/gateway` and `api/remotes` dual-face precedent). The host query logic is extracted into a `BalanceReader` (30s healthy cache, error views never reused, concurrent-read dedupe) separated from route registration, and unit/component tests cover the package to 100% (defensive arms get sanctioned v8-ignore comments).

## 曾考虑的替代方案

**Keep using the dynamic plugin.** Not adopted: the dynamic browser half does not survive refresh by design, which fails the "still works after refresh" requirement.

**Remove `ui-cordis` from the deployment composition.** Not adopted: disabling a whole extension is too broad; shadowing its cell with an empty occupant meets the need and is reversible (unmounting this package restores the controller).

## 后果

Deployments using this bundle show the sidebar balance strip on every page boot, with the controller cell replaced by an empty occupant (approvals still surface as conversation cards; this deployment-wide effect is recorded in the README Known Limitations). The package writes no session events, produces no model-visible input, and has no KV-cache effect.
