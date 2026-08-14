---
name: dsh-plugin-development
description: Use when developing, extending, or authoring plugins, tools, services, packages, or bundles in the deepseek-harness repo — creating a new plugin, adding a tool, providing or consuming a service, registering or listening to events, adding a workspace package, or packaging an installable bundle. Enforces the plugin development standards from the official documentation.
---

# DSH Plugin Development Standards

This skill is the working memory for developing plugins in `deepseek-harness`. It distills the official plugin development documentation. **Follow it strictly; where it links an authoritative doc, that doc wins if a detail is missing here.** Read [docs/architecture.md](../../../docs/architecture.md) before changing anything under `packages/`.

Authoritative sources (consult before and while writing code):
- Cordis concepts: [docs/cordis-primer.md](../../../docs/cordis-primer.md), tutorial [docs/cordis-tutorial/index.md](../../../docs/cordis-tutorial/index.md)
- Plugin basics / config / tool / publish: [docs/user/develop/basic/index.md](../../../docs/user/develop/basic/index.md), [config.md](../../../docs/user/develop/basic/config.md), [tool.md](../../../docs/user/develop/basic/tool.md), [publish.md](../../../docs/user/develop/basic/publish.md)
- Lifecycle / services / events: [docs/user/develop/framework/index.md](../../../docs/user/develop/framework/index.md), [service.md](../../../docs/user/develop/framework/service.md), [events.md](../../../docs/user/develop/framework/events.md)
- Capability design: [docs/user/develop/practice/index.md](../../../docs/user/develop/practice/index.md)
- Reference patterns: [docs/cookbook/extension-cookbook.md](../../../docs/cookbook/extension-cookbook.md), [adding-a-package.md](../../../docs/cookbook/adding-a-package.md), [adding-a-tool.md](../../../docs/cookbook/adding-a-tool.md), [adding-an-llm-adapter.md](../../../docs/cookbook/adding-an-llm-adapter.md), [adding-a-conversation-node.md](../../../docs/cookbook/adding-a-conversation-node.md), [adding-a-vendored-package.md](../../../docs/cookbook/adding-a-vendored-package.md)
- System map and extension points: [docs/architecture.md](../../../docs/architecture.md), [docs/capability-seams.md](../../../docs/capability-seams.md)
- Repo-wide conventions: root [AGENTS.md](../../../AGENTS.md), [packages/AGENTS.md](../../../packages/AGENTS.md), [docs/development.md](../../../docs/development.md), [docs/testing.md](../../../docs/testing.md)
- Service/event/config references: generated regions on [docs/subsystems/core.md](../../../docs/subsystems/core.md), [docs/tool-catalog.md](../../../docs/tool-catalog.md), [docs/config-catalog.md](../../../docs/config-catalog.md)

## 1. The plugin model

A plugin is a TypeScript module that exports an `apply` function; Cordis calls it with a `ctx` context through which the plugin registers everything it contributes. Three forms exist:

- **Function form** (most common): named-exports `name` (optional display metadata), `inject`, `Config`, `apply`. **Function plugins must have NO default export** — mixing forms makes the Loader discard the function plugin's namespace.
- **Object form**: `{ name, inject, apply(ctx) }`.
- **Class form**: a `Service` subclass; use it when the plugin provides a service to other plugins.

Service packages default-export their service class; function plugins named-export and have no default export (see `packages/AGENTS.md`).

```ts
import type { Context } from '@deepseek-ai/cordis'

export const name = 'my-plugin'
export const inject = ['tools']   // hard dependencies; plugin waits (PENDING) until they exist

export function apply(ctx: Context) {
  // ctx.tools is ready here.
}
```

### Lifecycle and fibers

Every loaded plugin instance owns a **fiber**: `PENDING → LOADING → ACTIVE → UNLOADING → DISPOSED` (with `FAILED` if `apply` or config validation throws). A plugin whose `inject` names a missing service sits PENDING forever, silently — diagnose by enumerating `ctx.registry` fibers. `ctx.plugin(child)` mounts a child plugin that unloads with its parent; `fiber.dispose()` awaits all cleanup including async disposers and recursively unloads children.

### Registrations are reversible effects

Every registration must be an effect so unload/HMR unwinds it predictably:

- `ctx.on(event, listener)` — removed on unload.
- `ctx.tools.register(...)`, `ctx.llm.registerAdapter(...)` — registry disposers attached to the calling plugin.
- `ctx.plugin(child)` — child disposed with parent.
- `ctx.effect(() => { acquire(); return disposer })` — for resources Cordis does not manage (timers, connections, watchers).

Disposers start in reverse registration order, but **multiple async disposers run concurrently** — keep order-dependent teardown in one disposer and await the steps serially there.

### Dependencies

- `inject` lists hard requirements. If a required service disappears at runtime (provider unloaded or hot-replaced), dependent plugins unload and reload when it returns.
- **Optional dependencies**: skip `inject` and probe at the use site with `ctx.get(name)` — never `ctx.<name>` for optional access (the property proxy is topology-sensitive; `ctx.get` reads the global service store).
- Optional services use `ctx.get(name)`; reserve `ctx.<name>` for declared injections.

## 2. Configuration

Export an `interface Config` and a same-named Schemastery runtime schema; `apply(ctx, config)` always receives complete, validated config with defaults filled.

```ts
import Schema from '@deepseek-ai/schemastery'

export interface Config {
  greeting: string
  maxRetries: number
}

export const Config: Schema<Config> = Schema.object({
  greeting: Schema.string().default('Hello'),
  maxRetries: Schema.number().default(3),
})

export function apply(ctx: Context, config: Config) { /* ... */ }
```

Rules:
- Do **not** export a plain object as `Config`; Cordis requires a Standard Schema validator, and this repo uses Schemastery.
- **No hardcoded tunables**: anything two deployments may set differently MUST be a validated `Config` field changeable from `cordis.yml` (a `DEFAULT_*` constant or test hook is not configurability). The test: can `cordis.yml` change it without a code edit?
- **Misconfiguration fails loud**: express self-contained constraints in the schema so invalid config fails the load with an actionable error; reject schema-valid config naming an unavailable resource/provider as early as resolvable. Never silently skip a missing referent.
- In `cordis.yml`, `!!js` expressions are valid only under plugin `config` and the entry `disabled` field; use overlays when the environment selects plugins (never `!js`).

## 3. Services

A **service** is a named capability one plugin provides and others consume via `ctx` (e.g. `ctx.tools`, `ctx.llm`, `ctx.agents`). Provide one with a `Service` subclass plus TypeScript declaration merging:

```ts
import { Service, type Context } from '@deepseek-ai/cordis'

declare module '@deepseek-ai/cordis' {
  interface Context {
    metrics: MetricsService
  }
}

export default class MetricsService extends Service {
  static inject = ['llm']          // a service may depend on other services
  constructor(ctx: Context) {
    super(ctx, 'metrics')          // 'metrics' is the service name; registration is an effect
  }
  record(event: string, value: number) { /* ... */ }
}
```

Rules:
- Service names live in one flat namespace; prefix or namespace your own distinctively (harness claims plain names like `tools`, `llm`).
- `src/types.ts` contains only types — no runtime code.
- **Trust TypeScript at typed same-process boundaries** — no runtime validation or hostile-input tests solely for values the static interface requires.
- Keep `Agent`/`Session` explicit at lifecycle, session-log, service, authority, worker/process, persistence, and wire interfaces; do not widen a leaf helper from `Session` to `Context` merely to hide a parameter.
- Design Service Definitions for all current consumers; keep tool-schema, Loader, UI, transport, and provider-specific behavior in the Consumer or provider. Inverse smell: a public service method with one internal caller — pass a private capability closure instead.

## 4. Events

Events are the loosely coupled communication mechanism. Typed events use declaration merging:

```ts
declare module '@deepseek-ai/cordis' {
  interface Events {
    'my-plugin/ready': (payload: { id: string }) => void
    'my-plugin/transform': (input: string, next: () => Promise<string>) => Promise<string>
  }
}
```

Consumers import the declaring module for side effects (`import type {} from './plugin.ts'` or the package) so the merges are visible.

### Dispatch modes (part of the event's public contract)

| Mode | Call | Semantics |
|---|---|---|
| `emit` | `ctx.emit(name, ...args)` | Synchronous broadcast; return values ignored |
| `parallel` | `await ctx.parallel(...)` | All listeners run concurrently, awaited together |
| `serial` | `await ctx.serial(...)` | In order, awaited; first non-null/false/undefined return wins and stops the rest |
| `bail` | `ctx.bail(...)` | Synchronous version of serial |
| `waterfall` | `ctx.waterfall(name, ...args, next)` | Around-middleware chain |

**Waterfall semantics (standing repo rule): a listener that only observes/annotates MUST call `next()`**; returning without it deliberately short-circuits the chain (the veto). Forgetting `next()` in a logging listener silently swallows default behavior for everyone downstream. Harness waterfalls: `agent/request`, `agent/pre-step`, `llm/stream`, `tools/pre-execute`, `tools/execute`, `tools/post-execute`, `approval/request`. `agent/turn-stopping` is serial and has no `next()`.

### Session events vs. Cordis events — don't confuse them

- Durable **session events** (`turn/*`, `step/*`, `user/message`, `assistant/*`, `tool/call`, `tool/result`, `compaction/*`) are appended to the session log and broadcast through `session/event`. To observe them, listen to `session/event` and inspect `event.type`. **Model-visible means logged**: anything reaching a model request must be reconstructable from the log; a new model-visible input requires extending `SessionEventMap` and rendering from the log.
- **Cordis events** (`agent/*`, `tools/*`, `fs/*`, `approval/*`, `session/event`) are live extension points for observation/interception. Their JSDoc needs `@mode` and payload `@param`; scoped keys absent from payloads need `@dshScopeScan unsupported`. Use `emit`/`waterfall`/`parallel`/`serial` per the declared mode.
- `turn/*`, `step/*`, `tool/*` are NOT same-named Cordis events.

## 5. Tools (model-facing capabilities)

Register tools on `ctx.tools` via `defineTool` (first-party) or raw JSON-Schema `ToolDefinition` (e.g. MCP-sourced). `docs/cookbook/adding-a-tool.md` is the source of truth; `packages/shell/tool-bash` is the production-grade example.

```ts
import { defineTool } from '@deepseek-ai/dsh-tools'

ctx.tools.register(defineTool({
  name: 'read_file',
  description: 'Read a file from disk.',
  parameters: {
    path: { type: 'string', required: true, description: 'Absolute path' },
    limit: { type: 'number' },
  },
  output: {
    schema: { type: 'string' },
    render: (_args, value) => [{ type: 'text', text: value }],
  },
  async execute(args, exec) {
    return readFile(args.path, { encoding: 'utf8', signal: exec.signal })
  },
}))
```

### The execute() contract

- `args` is typed and validated for you (types, required keys, literal constraints, exact-one unions, nested values); still hand-check constraints the DSL does not express (non-empty strings, positive numbers, cross-field rules). Registration borrows your readonly definition — never mutate the schema or replace callbacks after registration; hot-swap by disposing the effect and registering a replacement.
- **Declare and return one canonical JSON value** (`output.schema`, `ValueSchemaSpec`, root may be object/array/scalar/null). `execute` returns only the inferred value; the registry snapshots it as lossless JSON, validates and freezes it, then passes it to `output.render(args, value)`. Never return content blocks from the body or make callers parse prose for ids/fields.
- **Throw or return an invalid value ⇒ `isError`.** Throw for infrastructure failures; represent a successful domain outcome in the canonical value even when its Native renderer explains a non-ideal state (e.g. non-zero process exit).
- **Honor `exec.signal`** — cancel in-flight work when it fires. `exec` carries immutable identity + token; `signal` is the only operational field.
- `exec.agent` — for async notifications use `agent.inject({ content, source: { kind: 'plugin', plugin: '<name>' } })` (appends durable context the NEXT model request sees; NOT a wake-up). Guard against disposed agents.
- **Long-running work**: gate `run_in_background` with producer config, register via `ctx.jobs.start({ kind, label, owner: exec.agent, run })`; return a typed canonical handle like `{ kind: 'background', jobId }`. Once published, use a task-owned cancellation signal, not `exec.signal`.
- Optional `output.presentationMeta(args, value)` derives replayable JSON persisted on `tool/result` for UI cards that need result-time facts.

### UI render intent (decided up front)

`output.render` returns model-facing content; the **UI card** is a separate concern via pure presentation projections (`presentCall`/`presentResult`) returning `card`-tagged render intents: `generic`, `terminal`, `diff`, `search`, `web`. Hard rules:
- **Purity**: they run on live streaming AND session-log replay — no I/O, no session state, no clock/random.
- **UI-only formatting stays out of the model result**: fenced console blocks, diffs, relativized paths never go into the canonical value or Native content merely to serve a UI.
- `defineTool` soft-validates the display path (returns `undefined` → generic fallback rather than throw; display must never crash replay).
- Tools never import a UI or transport type; the neutral vocabulary lives in `dsh-tools`.

### Execution policy and observation

Prefer NOT to build deployment policy into the tool. Extension-point selection rule:
- `tools/pre-execute` — extensible allow/deny/ask policy (waterfall; return a typed decision like `{ kind: 'deny', reason }` or `next()`).
- `ctx.tools.guard()` — final monotonic deny later listeners cannot undo.
- `tools/execute` — wrap dispatch lifetime (deadline, retry, metrics); only `exec.signal` is replaceable.
- `tools/post-execute` — replace presentation content or the returned value, block the result, attach model-facing context.
- `tools/result` — observe the immutable normalized outcome (no transformation).

## 6. Capability seams (three-role design)

A **seam** is a swappable capability with three roles — **Service Definition** (interface + `ctx` key + Request/Result types), **Service Provider** (implementation), **Consumer** (commonly a model-facing tool). The complete capability is its seam; no individual role is a seam. Split into separate packages only when roles evolve independently (the shell trio is the template: `dsh-shell` / `dsh-bash-local` / `dsh-tool-bash`). Provider and Consumer depend only on the Service Definition, never on each other.

- The Service Definition owns Request/Result types; consumers name the capability (`inject: ['shell']`) instead of importing the provider, so config can swap providers.
- **Explicit > implicit at package boundaries**: defaulting is an explicit `resolve(request): Spec` step in the owning implementation, never a hidden `?? default` inside `run()`.
- Do not split preemptively — a simple tool plugin stays one package.

## 7. Workspace package layout (adding a package)

New packages are `@deepseek-ai/dsh-<name>` workspaces at `packages/<group>/<pkg>/`. Follow `docs/cookbook/adding-a-package.md` file-by-file:

```
packages/<group>/<pkg>/
  package.json     # copy from packages/core/tools
  tsconfig.json    # extends ../../../tsconfig.base.json, rootDir src, outDir lib/types
  src/index.ts     # service default export or plugin (name/inject/apply/Config)
  README.md        # service API, events, extension points, design notes + Model Experience + Known Limitations
```

package.json invariants (enforced by `pnpm run constraints`): `private: true`; `version` matches root; `type: module`; `main: "lib/index.js"`; `types: "lib/types/index.d.ts"`; `exports["."]` has `.types` and `.default`; `@deepseek-ai/cordis` in BOTH peerDependencies and devDependencies (same range); mirror every dsh peer dependency in devDependencies; `@deepseek-ai/schemastery` in `dependencies`; `files` contains exactly `lib/index.js`, `lib/invariant.js`, `lib/types/**/*.d.ts` (+ runtime artifacts), never `src`, maps, or stale root declarations. In-package relative imports use explicit `.ts` specifiers in source. ESM everywhere.

Register the package: `tsconfig.host.json` (Host package) or `tsconfig.client.json` (Client package) references — exactly one aggregate, never both. Client packages extend `tsconfig.base.client.json` and declare `dsh.client` in package.json.

**Naming the role that exists** (from `adding-a-package.md`): name the stable current responsibility, not the first implementation or future expansion. Use a singular `ctx` key for one engine/runtime/policy/controller/store; plural for registries. Role-suffix table governs `Controller`/`Store`/`Registry`/`Runtime`/`Provider`/`Resolver`/`Engine`/`Policy`/`Executor`/`Gateway`/`Backend`/`Handle`/`Config`/`Service` — pick the sharpest honest role. Use `local` only when same-host execution is part of the contract.

**Package README**: package-specific service API, config, events, extension points, design notes first; end with canonical `## Model Experience` (Request context and condition / What the model sees / Token effect / KV Cache effect) and `## Known Limitations and Deferred Work` sections (or justified allowlist entries). A package's README and JSDoc are part of the change — update them in the same commit.

**Every package owns `./invariant`**: register the manifest name; check an event/data relation or give empty installers package-specific `No runtime invariant:` reasons.

**Every non-trivial change includes an Agent Note in the same PR** (`.agents/notes/`, format per `.agents/notes/README.md`) — only mechanical/local edits are exempt.

## 8. Composition (cordis.yml, bundles, profiles)

- `cordis.yml` is a list of plugin entries: `name` (module specifier), `id` (stable identity for HMR diffing — entries without one remount after any config edit), `config`, `disabled`, `inject`. Entries start concurrently; ordering comes from service dependencies, not file position.
- **Patch layers** apply in order: each bundle in the profile's `dsh.profile.bundles` list → profile's `cordis.patch.yml` → home-level `$DSH_HOME/cordis.patch.yml` → each `--patch` overlay. Later layers win per row; a patch replaces a row's ENTIRE `config` value (restate every key), never deep-merges.
- **Bundle** = an npm package declaring `dsh.bundle` pointing at a `cordis.patch.yml` (a distribution layer). **Profile** = `$DSH_HOME/profiles/<name>` declaring `dsh.profile` with an ordered `bundles` list. Nothing is both.
- Load a local plugin for dev with `pnpm dsh web --patch ./path/cordis.yml` (plugin path must be absolute); run a task headless with `pnpm dsh --profile headless "task"`.
- HMR works because every registration is an effect: editing a file or config unloads the old instance (all effects unwind) and loads the new one. `@deepseek-ai/cordis-plugin-hmr` watches files; it injects `timer` for debouncing and logs through the console exporter.

## 9. Repo-wide conventions that bind plugin code

- **Registrations are effects** — every contribution goes through `ctx.effect()` / `ctx.on()`; a registry's `register()` returns the disposer.
- **Typed events use declaration merging** and merge-extensible maps; closed unions end in `assertNever`.
- **Waterfall listeners MUST call `next()`** to delegate; returning without it short-circuits the chain.
- **Model-visible ⟺ logged**: anything that reaches a model request must be reconstructable from the session log; a new model-visible input requires a session event.
- **Plugins, not loop changes**: new behavior goes on documented extension points; changing `agent-loop` requires updating `docs/architecture.md`.
- **A capability seam is complete (three roles)**, never one role; split only when roles evolve independently.
- **No hardcoded tunables in plugins** — deployment-varying choices are validated `Config` fields; protocol constants and security invariants stay fixed.
- **Misconfiguration fails loud** at load (or the earliest resolvable point); never silently skip a missing referent.
- **Opaque cross-boundary ids are branded** (`Branded<B>` from `dsh-brand`), never bare `string`.
- **Switch on discriminant tags**; merge-extensible unions fall through a documented default.
- **Empty `catch` names what it swallows** and why nothing else can reach it; keep the `try` to one statement.
- **Do not comment on facts obvious from code**; comments/JSDoc state complete contracts, not reasoning transcripts.
- **Explicit > implicit at package boundaries** (see §6).
- Trust TypeScript at typed same-process boundaries; validate at parser/config, queued, model/tool JSON, durable/file, worker, process, and wire boundaries.
- Extension-point map (where new behavior goes) is in `docs/architecture.md` § "Where new behavior goes" — consult it before choosing where a feature lives.

## 10. Testing requirements

- Unit tests live at package level under `tests/`, not `src/__tests__/`; run with `pnpm exec vitest run packages/<group>/<pkg>/tests/<behavior>.spec.ts`.
- **Every registry gets an HMR-safety test**: dispose the contributing fiber, assert cleanup/removal.
- **Product-visible plugins require a non-unit REAL-composition test**: boot test-only `cordis.yml` through the Loader and app/process (hand-built `ctx.plugin(...)` suites are insufficient); mock only external services or nondeterministic inputs; assert model-visible request/log, durable state, or user-visible output. Keep opt-ins out of shipped defaults.
- **Prefer the real implementation over a mock** — mock only the expensive/nondeterministic boundary (LLM adapter, network, clock).
- The CI coverage gate is per-file 100% on `packages/*/*/src` (`pnpm run test:coverage`); an uncovered line is often dead code.
- Every non-trivial model-, protocol-, or human-visible change adds/updates a keyless snapshot scenario in the same PR through a runnable example's owning snapshot suite.
- Tests describe behavior, not correctness; change obsolete behavior with its tests and explain why.

## 11. Verification commands (run before pushing)

```sh
pnpm run doc-sync           # documentation gates
pnpm run constraints && pnpm run typecheck && pnpm run lint
pnpm run build && pnpm run hygiene
pnpm exec vitest run packages/<group>/<pkg>/tests/<behavior>.spec.ts --coverage --coverage.include='packages/<group>/<pkg>/src/**/*.ts'
```

Match evidence to the surface: focused tests for behavior, snapshots for model/user output, `doc-sync` for docs, build/hygiene + built smokes for published paths, real-API e2e for provider behavior. Never default to the full suite or repeat a passing check for commit or push.

## 12. Authoring checklist (verify before delivering)

- [ ] Plugin exports are correct for the form (function plugin: named `name`/`inject`/`Config`/`apply`, no default export; service package: default-export the class).
- [ ] All registrations go through `ctx.on` / `ctx.tools.register` / `ctx.effect`; every non-managed resource has a disposer.
- [ ] `inject` lists every hard dependency; optional dependencies use `ctx.get(name)`.
- [ ] `Config` is a Schemastery schema with defaults; no hardcoded tunables; invalid config fails loud.
- [ ] Tool: canonical `output.schema` value, pure `output.render`, `exec.signal` honored, no UI formatting in model content, `run_in_background` config-gated.
- [ ] Waterfall listeners call `next()` unless deliberately short-circuiting.
- [ ] New session-visible data extends `SessionEventMap` and renders from the log (model-visible ⟺ logged).
- [ ] Package layout, tsconfig aggregate, `./invariant`, README Model Experience + Limitations, package.json invariants all conform.
- [ ] Agent Note included for non-trivial changes; snapshot/real-composition coverage added; docs/README/JSDoc updated in the same change.
- [ ] Relevant checks run and pass (see §11).
