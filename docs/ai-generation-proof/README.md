# Founders development AI generation proof

Three real UI generations passed persistence, public rendering, local URL access,
and reload checks. **Public preview reachability remains blocked:** all three
preview URLs return HTTP 403 with Cloudflare `error code: 1010` from this environment.
This is a local development proof, not a successful public preview proof.

Work was performed on `ai-generation-proof` in
`https://github.com/cartersites-arch/founders.git`. No upstream checkout, production
deployment, production database, or Cloudflare access setting was modified.
The user confirmed that `vpewpybdvtnhwxhzyubc` is the development Supabase project.
Only the existing proof workspace `0944aa62-2f20-4937-9cea-e5c06992f7bc` received
generated content. Existing production deployment configuration was not changed.
Evidence timestamps use UTC; this run occurred on October 5, 2026 in Los Angeles.

## Results

| Case | Words | Actual provider model | Initial request / reload | Database unchanged after reload |
| --- | ---: | --- | --- | --- |
| Weekend pool pricing | 510 | `cohere/north-mini-code:free` | 200 / 200 | SHA-256 match |
| Guest arrival checklist | 1,042 | `nvidia/nemotron-3-super-120b-a12b:free` | 200 / 200 | SHA-256 match |
| Family pool party planning | 837 | `cohere/north-mini-code:free` | 200 / 200 | SHA-256 match |

Ordinary URLs verified in a fresh Chromium context with no authentication or
custom browser headers:

- <http://localhost:8082/p/ai-proof-weekend-pool-pricing-october-2026-complete>
- <http://localhost:8082/p/ai-proof-guest-arrival-checklist-october-2026-complete>
- <http://localhost:8082/p/ai-proof-family-pool-party-planning-october-2026-complete>

These URLs require the development server and local proof proxy in this workspace.
The proxy forwards to the local app on port 8081 and sets `X-Forwarded-Host` to the
existing proof workspace domain. The browser makes ordinary local requests.
Corresponding HTTPS preview URLs and their 403 responses are in `results.json`.

## Evidence

- `network-checks.json`: API key authenticated with HTTP 200; OpenRouter models
  reachable with HTTP 200. The environment status reported readiness as unknown,
  so these observations come from actual requests. No credential value is recorded.
- `provider.jsonl`: actual OpenRouter completion response IDs, selected model,
  provider, token usage, and cost. The final three success records correspond in
  order to the three accepted runs. Their recorded cost is zero.
- `results.json`: row IDs, workspace, content hashes, URL/status checks, section
  heading counts, reload checks, provider IDs, and final visual checks.
- `generation-N-input.png` and `generation-N-published.png`: form submissions
  through `/app/pages/new` and actual UI publication results.
- `generation-N-database.json`: independent REST reads of the persisted rows,
  including full Markdown and its SHA-256 hash.
- `generation-N-rendered.html`, `generation-N-rendered.png`, and
  `generation-N-reload.png`: actual Markdown rendering and fresh reload evidence.
  Final screenshots show the corrected typography; headings compute to 24px.

The browser's development Supabase requests were forwarded through the configured
network proxy using real HTTP requests, not fixtures. The authenticated generation
browser received a session for the existing non-admin proof owner, including a
same-origin Authorization header for SSR. Public page checks used a separate
browser context without that session or header. Sessions remained private in `/tmp`.

## Findings and fixes

The paid Gemini UI attempt reached OpenRouter but returned HTTP 402: the account
has never purchased credits. A valid key and a configured spending limit do not
establish a funded balance. A direct free-model probe succeeded, so the form now
offers `openrouter/free`. The three accepted UI runs used that option.

An initial free-model UI result persisted incomplete Markdown and failed the
rendering check. Its row and failure are retained as
`initial-incomplete-database.json` and `initial-render-failure.json`; this row is
not counted among the three accepted runs. The generation request now reserves
8192 output tokens and rejects responses marked `finish_reason: length` before
insertion. The initial incomplete row remains only in the development workspace.

Visual inspection also found that the public route relied on unavailable `prose`
styles. Scoped public-page styles now format headings, paragraphs, lists, links,
and tables. Final checks refreshed all three screenshots and verified reload
and database content again without generating additional pages.

## Validation

- Final `npm run build`: passed.
- ESLint for the new JavaScript scripts and public page route: passed.
- Python authentication helper compilation: passed.
- Formatting of new JavaScript, public page route, and CSS: passed.
- The generator form has four existing lint diagnostics; the customer server
  module has eight existing `no-explicit-any` diagnostics. Baseline comparison
  confirmed the same diagnostics before these changes.
- The three real UI runs, final fresh-browser rendering checks, and database
  hash comparisons passed. No mocked AI response or database was used.

## Reproduce in development

Use the environment's configured development Supabase variables and
`OPENROUTER_API_KEY`. Never paste secrets into a report or terminal output.
The helpers reject a Supabase URL outside this development project.

Install the browser driver outside the application checkout:

```sh
npm install --prefix /tmp/founders-proof-browser --cache /workspace/.npm-cache playwright --no-audit --no-fund
python scripts/ai-proof-auth.py
```

Start the server and proxy in separate terminals:

```sh
NODE_USE_ENV_PROXY=1 NODE_OPTIONS='--import ./scripts/ai-proof-provider-observer.mjs' PORT=8081 npm run dev
```

```sh
node scripts/ai-proof-local-proxy.mjs
```

To recheck the existing three rows and their local URLs without generating:

```sh
NODE_USE_ENV_PROXY=1 node scripts/verify-ai-proof.mjs
```

To generate three additional development pages through the UI, replacing the
current numbered evidence files:

```sh
NODE_USE_ENV_PROXY=1 node scripts/ai-generation-proof.mjs
```

The generating harness is intended for the local development proxy and existing
proof account. Free model selection and latency vary with availability. Resolving
Cloudflare's preview denial and rerunning the public HTTPS checks is still needed
to complete the public URL part of the proof.
