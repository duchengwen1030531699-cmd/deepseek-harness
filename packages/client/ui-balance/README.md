# @deepseek-ai/dsh-client-ui-balance

English | [中文](README.zh.md)

Sidebar account balance readout: a persistent strip in the sidebar foot that shows the DeepSeek account balance (`余额 ¥136.33`, a compact `¥` in the rail) and opens a detail panel on click — total / topped-up / granted balances, account availability, last-update time, and a refresh button that re-queries in place.

**The key never leaves the host.** The browser half fetches two exact webServer routes (`/api/balance`, `/api/balance/refresh`); the node half resolves `DEEPSEEK_API_KEY` through the credentials seam on every query and calls the official [Get User Balance](https://api-docs.deepseek.com/zh-cn/api/get-user-balance/) endpoint with `redirect: 'error'`, so a redirect cannot forward the credential. The readout receives only the cleaned view (`fetchedAt`, `available`, `total`, per-currency buckets, or an error message).

**The readout is a reference, not a bill.** The provider's balance is not real-time, so the panel labels the stamp "非实时，仅供参考" (not real-time, for reference only), and a failed or unconfigured query degrades to an error marker (`余额 ?`) rather than blocking anything.

**The controller cell is shadowed on purpose.** The shipped `cordis-panel` (dynamic-plugin controller) cell is replaced with an empty occupant via a lower shadowing priority, because the balance strip is the intended sole surface of this deployment's sidebar foot. Reverting is a one-line removal of that registration.

## Model Experience

No model-visible effect: the package adds no prompt content, registers no tools, and writes no session events. The browser readout renders host-served JSON over two exact HTTP routes, and the node half's provider query is a host-side side effect that never enters the session log.

#### KV Cache effect

None: no prompt input originates here.

## Known Limitations and Deferred Work

- **The routes are unauthenticated same-origin reads** — they answer any request the web server accepts, so the deployment's trusted-host/network posture is the only gate. They return the balance view, never the API key; a per-request auth layer is deferred.
- **Balance is not real-time** — the provider's own figures lag billing, and the node half additionally serves a healthy cached view for 30 seconds (configurable via `refreshIntervalSeconds`); the panel states both.
- **Pricing is not shown** — the strip reports the account balance only; converting session token usage into estimated spend is deliberately out of scope for this package.
- **The controller shadow is deployment-wide** — replacing the `cordis-panel` cell hides the dynamic-plugin inventory/approval surface for every session using this bundle (approvals still surface as conversation cards); the shadow only lives while this package is mounted.
- **The credential reference is fixed** — `DEEPSEEK_API_KEY` is resolved by name; a configurable reference is deferred.
