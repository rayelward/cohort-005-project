# Research: Knock's server side for Cadence

Answers issue #3 (part of map #1). Researched 2026-11-10 against `@knocklabs/node` **1.41.0** (npm, published 2026-11-03), `@knocklabs/cli` **1.6.0**, and docs.knock.app / knock.app/pricing as of that date.

## Short answer

A **Knock workflow** is a hosted pipeline that Cadence starts with a single `knock.workflows.trigger(key, { recipients, data, actor })` call. One workflow can have an in-app feed step and an email step. Knock applies each Student's preferences (by workflow, by category, by channel type) before every channel step. Email goes out through Postmark using a server token stored in Knock, not in Cadence. Workflows and templates can live in the repo as `.knock/` files, managed with the Knock CLI: push to development, commit, then promote to production.

The SDK call is **async and enqueue-only**. If it succeeds, Knock has accepted the run, not that anything was delivered. If Knock is unreachable, the SDK by default retries for up to about 3 minutes and then throws. Cadence must tune that and decide what to do when it throws. The Free plan (10,000 messages a month, with no hard cap) does not constrain v1.

---

## 1. Node SDK (`@knocklabs/node`)

### Client construction

```ts
import Knock from "@knocklabs/node";
const knock = new Knock({
  apiKey: process.env.KNOCK_SECRET_API_KEY, // SDK default reads KNOCK_API_KEY, not our name
  timeout: 5_000,   // default 60_000 ms
  maxRetries: 1,    // default 2
});
```

- `apiKey` defaults to `process.env.KNOCK_API_KEY`. **Cadence uses `KNOCK_SECRET_API_KEY`, so the key must be passed explicitly.** The constructor **throws** if no key is found ("The KNOCK_API_KEY environment variable is missing or empty…"). Construct the client lazily, behind a token check like `defaultTransport()` in the mailer, so tests and `.env`-less dev don't crash. Source: [knock-node `src/client.ts`](https://github.com/knocklabs/knock-node/blob/main/src/client.ts) (lines ~260–280).
- Other env vars the SDK reads: `KNOCK_BASE_URL` (default `https://api.knock.app`), `KNOCK_BRANCH`, `KNOCK_LOG`, and `KNOCK_CUSTOM_HEADERS`. Source: same file.
- You can inject a custom `fetch` in the constructor options. Source: [knock-node README](https://github.com/knocklabs/knock-node).
- The SDK also exports `signUserToken(userId, …)` for signing user tokens for the client-side feed with `KNOCK_SIGNING_KEY`. Source: README.

### Identifying users

- `knock.users.update(userId, { email, name, ... })` → `PUT /v1/users/{user_id}`, an upsert. Only `id` is required, but **the email step needs the reserved `email` property** on the recipient. Source: [api.md](https://github.com/knocklabs/knock-node/blob/main/api.md), [Identifying recipients](https://docs.knock.app/managing-recipients/identifying-recipients).
- **Inline identification:** pass recipient objects instead of IDs in the trigger, e.g. `recipients: [{ id: user.id, email, name }]`. Knock "guarantees that recipients are identified before executing any other action" ("lazy recipient creation"). This removes the need for a separate signup-time identify. The docs also suggest sending the full user data with each trigger. Source: same doc and the trigger endpoint docs.
- Users are **per environment**. Development and production never share users. Source: [Environments](https://docs.knock.app/concepts/environments).
- Not verified: what happens when you trigger with a bare string ID for a user Knock has never seen. The docs don't say. Inline identify sidesteps this.

### Triggering

```ts
const { workflow_run_id } = await knock.workflows.trigger("refund-approved", {
  recipients: [{ id: String(student.id), email: student.email, name: student.name }],
  actor: String(admin.id),          // optional
  data: { courseTitle, amountCents, link },
  cancellation_key: `refund-${refundRequest.id}`, // optional, enables cancel
  settings: { sandbox_mode: true, skip_delay: true }, // optional, per-trigger
}, { idempotencyKey: `refund-approved:${refundRequest.id}` });
```

- Parameters (`WorkflowTriggerParams`): `recipients` (required, **max 1,000**), `actor`, `data`, `cancellation_key`, `tenant`, and `settings.{sandbox_mode, skip_delay}`. The response is `{ workflow_run_id }`. Source: [knock-node `src/resources/workflows.ts`](https://github.com/knocklabs/knock-node/blob/main/src/resources/workflows.ts), [Trigger API](https://docs.knock.app/api-reference/workflows/trigger).
- "All workflow runs are executed asynchronously." A 200 means the run was queued. **Delivery failures, such as Postmark rejecting a message, never reach the caller.** They show up in Knock's message logs. Source: Trigger API.
- Triggering an **inactive** workflow returns a `workflow_inactive` error and creates no runs. Source: [Triggering workflows](https://docs.knock.app/send-notifications/triggering-workflows).
- The trigger endpoint is rate-limit **Tier 5**. The tiers go 1, 5, 60, 200, and 1,000 req/s, and the page layout suggests Tier 5 is 1,000 req/s (not confirmed). Exceeding the limit returns a 429. Source: [Rate limits](https://docs.knock.app/api-reference/overview/rate-limits).

### Idempotency

- Only `POST /workflows/:key/trigger` honours the `Idempotency-Key` header. Keys are up to 255 characters and kept for **24 h**. A repeat with the same key and same params replays the original response, with the `idempotent-replayed: true` header. The same key with different params returns an error. **4xx and 5xx responses are not cached**, so a retry after a failure runs for real. Source: [Idempotent requests](https://docs.knock.app/api-reference/overview/idempotent-requests).
- The SDK **automatically** sends an `Idempotency-Key` (`stainless-node-retry-<uuid>`) on every non-GET request and reuses it across its own retries. You can override it per call with the request option `{ idempotencyKey }`. Use a key derived from the domain event, e.g. `refund-approved:<refundRequestId>`, so that a user resubmitting an action or Cadence retrying from an outbox can't double-notify within 24 h. Source: `src/client.ts` lines ~317, ~370, and ~797–800.

### Cancellation

- `knock.workflows.cancel(key, { cancellation_key, recipients? })` → 204. A run can only be cancelled while it is paused at a **batch, delay, wait-for-event, or fetch** step. You can't cancel a single channel step or a finished run. To retract a delivered feed item, archive the message instead. The docs advise against cancelling within about 5 s of the trigger. Source: [Canceling workflows](https://docs.knock.app/send-notifications/canceling-workflows), api.md.
- For v1 (no delays or batches) cancellation is effectively moot.

### Errors, latency, and Knock being unreachable

- Error classes, all subclasses of `Knock.APIError`: `BadRequestError` (400), `AuthenticationError` (401), `PermissionDeniedError` (403), `NotFoundError` (404), `UnprocessableEntityError` (422), `RateLimitError` (429), `InternalServerError` (≥500), `APIConnectionError` (no response), and `APIConnectionTimeoutError`. Source: README.
- **Defaults: a 60 s timeout and 2 retries with exponential backoff.** The SDK retries connection errors, 408, 409, 429, and ≥500, and honours the `x-should-retry` header. Timed-out requests are retried too. **In the worst case a single `await trigger()` blocks a request handler for about 3 minutes and then throws.** Both settings can be overridden per client or per request (`{ timeout, maxRetries }`). Source: README, `src/client.ts` `shouldRetry`.
- Implication for the map's "Failure behaviour" question: an un-awaited or try/catch-wrapped trigger with a short timeout (a few seconds) and 0–1 retries is the cheap option, but a Knock outage silently loses Notifications. Retrying from an outbox table is safe because of the domain-derived idempotency key, but only within Knock's 24 h replay window, and only for successful responses, which is all that matters here.

## 2. Workflows

- **In-app and email in one workflow: yes.** A workflow is a list of steps. Each channel step needs a configured channel, and the in-app feed channel is Knock's own (`KNOCK_FEED_CHANNEL_ID`). "If no relevant channel data for that recipient is found, the step is skipped", so a Student without an `email` just doesn't get the email step. Source: [Designing workflows](https://docs.knock.app/designing-workflows/overview).
- **Function steps:** Batch, Branch, Experiment, Delay, Wait for event, Fetch, AI agent, Throttle, and Trigger workflow, plus data-update steps. Source: same.
  - **Batch** groups triggers per recipient, optionally by a `batch_key` such as `courseId`, over a fixed or sliding window (sliding has a max of 90 days). Max activities is 2–1000. Templates get `activities` and `actors`, capped at 10 items (100 on Enterprise). Source: [Batch function](https://docs.knock.app/designing-workflows/batch-function).
  - **Throttle** "limits the number of executions of the workflow for the recipient over a window of time."
  - Delay, batch, and throttle run **inside Knock**, so they don't conflict with "Cadence has no scheduler". They are still time-based behaviour, and whether they are in scope is a product decision.
- **Conditions:** any step, including the trigger step, can have conditions on `data.*`, `recipient.*`, and so on. If a trigger-step condition is false, the run terminates. **Step message status** conditions can reference an earlier step, e.g. "email only if `in_app_feed_1` has not been seen" after a delay step. This is stored as `refs.in_app_feed_1.engagement_status not_contains $message.seen`. Source: [Step conditions](https://docs.knock.app/designing-workflows/step-conditions).
- **Workflow-level settings** in the schema: `categories: string[]`, `settings` (e.g. `override_preferences: true`), `trigger_frequency` (`every_trigger` | `once_per_recipient` | `once_per_recipient_per_tenant`), and `trigger_data_json_schema`, which validates the `data` payload. Source: [Management API workflow schema](https://docs.knock.app/mapi-reference/workflows/schemas/workflow).
- `knock workflow generate-types --output-file app/lib/knock-types.ts` generates TS types for every workflow's trigger data. Source: [CLI README](https://github.com/knocklabs/knock-cli).

## 3. Preferences

- **Shape** (`PreferenceSet`, id `"default"` per user):
  ```json
  {
    "workflows":     { "refund-approved": false, "new-lesson": { "channel_types": { "email": false } } },
    "categories":    { "course-updates": { "channel_types": { "email": false, "in_app_feed": true } } },
    "channel_types": { "email": true, "in_app_feed": true },
    "channels":      { "<channel-uuid>": true },
    "commercial_subscribed": true
  }
  ```
  Each `workflows` or `categories` entry is a boolean or `{ channel_types?, channels?, conditions? }`. The channel types are `chat | email | http | in_app_feed | push | sms`. Source: knock-node `src/resources/recipients/preferences.ts`, [Preferences overview](https://docs.knock.app/preferences/overview).
- **Evaluation:** anything unset defaults to `true`. Knock sends only if **every** applicable preference combination evaluates to true, so a category set to `false` blocks the workflow even if its channel type is `true`. `channels` beats `channel_types`. Merge order is recipient set, then tenant default, then environment default (lowest). Source: Preferences overview.
- **Defaults:** an **environment default PreferenceSet** is configured in the dashboard. The docs don't mention an API for it. Tenant defaults exist but per-tenant preferences are an Enterprise feature, and Cadence doesn't need tenants. Source: [Setting preferences](https://docs.knock.app/managing-recipients/setting-preferences), pricing.
- **Server-side write:** `knock.users.setPreferences(userId, "default", { ...set })` replaces the set by default. Add `__persistence_strategy__: "merge"` to deep-merge instead. Also available: `getPreferences`, `listPreferences`, and `unsetPreferences`. Preferences can be set inline on a trigger recipient too (`InlinePreferenceSetRequest`). Source: api.md, Setting preferences.
- **Non-optional (transactional) workflows:** in the dashboard, go to Manage workflow and enable **"Override recipient preferences"**, then commit. "The workflow will send to all of its channels, regardless of the recipient's preferences." In workflow-as-code this is `"settings": { "override_preferences": true }`. Use this for refund emails. Source: Preferences overview, MAPI workflow schema example.
- **Commercial vs transactional:** a separate **"Commercial"** toggle on a workflow adds unsubscribe headers and a `commercial_unsubscribe_url`. An unsubscribe sets `commercial_subscribed: false`, which beats tenant and environment defaults. Transactional workflows keep sending. None of v1's Notifications are commercial. Source: [Commercial unsubscribe](https://docs.knock.app/preferences/commercial-unsubscribe). *Not verified:* the workflow-as-code JSON field name for the Commercial toggle.

## 4. Email via Postmark

- **Config:** add a Postmark channel in the Knock dashboard (Integrations → Channels). These settings are **per environment**:
  - the **API key** (the Postmark *server* token)
  - the **from email address** (Liquid allowed)
  - an optional **from name**
  - advanced settings: Knock open and link tracking, Postmark's own open and link tracking, CSS inlining (on by default), sandbox mode, and to/cc/bcc/reply-to

  Source: [Knock × Postmark](https://docs.knock.app/integrations/email/postmark), [Email settings](https://docs.knock.app/integrations/email/settings).
- **Message stream:** there is no stream setting. Knock sends to Postmark's **default transactional stream** (`outbound`, the same stream the mailer uses today). Any other stream needs a payload override (`"MessageStream"`). Source: Postmark integration page.
- **From address:** the existing `Cadence <hello@cadence.dev>` can be set as the channel's from address and name in both environments. Credentials can't use Liquid. Reply-to can be set per template. Source: Email settings.
- **Recipient address** comes from `recipient.email` on the Knock user, so inline-identify with `email`. Source: Email settings.
- **Channel credentials are not copied between environments.** Production needs Postmark configured separately. Source: Environments.
- Postmark spam complaints deactivate the address, and later sends bounce. Knock doesn't change the delivery status for complaints. Source: Postmark integration page.
- **Templates:** each email step has a subject and a body, either visual blocks or HTML/Markdown, rendered with Liquid (`recipient.*`, `actor.*`, `data.*`, `vars.*`). An **email layout** wraps the body (`{{ content }}`), and every account has a `default` layout. Layouts are managed via CLI (`knock layout pull/push`) or the Management API. Source: [Email layouts](https://docs.knock.app/integrations/email/layouts), MAPI schema example.
- **Migrating the refund emails:** the current mailer sends plain text (`TextBody`) to the `outbound` stream from `hello@cadence.dev`. A Knock email step can reproduce that: same stream and from address, plus `override_preferences: true`. Doing so moves the Postmark token's home from Cadence's `POSTMARK_SERVER_TOKEN` to Knock's channel config, and replaces the `.outbox/` fallback with whatever test seam Cadence builds around the Knock client.

## 5. Environments, workflows-as-code, and testing

- **Environments:** an account starts with **production** only. Enabling environments adds **development**, which then becomes the CLI and Management API default. Each environment has its own API keys. Workflows, layouts, partials, and translations are **versioned with commits**. Users, messages, and logs are per environment and never shared. Source: [Environments](https://docs.knock.app/concepts/environments).
- **CLI** (`npm i -g @knocklabs/cli`). Authenticate with `knock login`, or with `--service-token` in CI. `knock init` creates `knock.json` (`{"knockDir": ".knock"}`) and a `.knock/workflows/<key>/workflow.json`, with one folder per channel step (e.g. `email_1/`, `in_app_feed_1/markdown_body.md`). Key commands (from the [CLI README](https://github.com/knocklabs/knock-cli)):
  - `knock pull` / `knock push [--commit -m "msg"]`: sync the whole `.knock/` directory
  - `knock workflow pull|push|validate [KEY] [--all]`
  - `knock workflow run KEY --recipients <id> --data '<json>' [--sandbox-mode]`: test run
  - `knock commit [-m msg] [--environment development]`
  - `knock commit promote [--to production] [--only <commitId>]`
  - `knock workflow activate KEY --environment production [--status false]`: toggles a workflow immediately, without promotion
  - `knock branch create|switch|merge`, which pairs with the `KNOCK_BRANCH` SDK env var
  - `knock workflow generate-types --output-file <.ts>`

  A sensible flow is: edit in the repo, `knock push --commit` to development, test, then `knock commit promote --to production` from CI on release.
- **Testing (unit and integration):** Knock has no official mocking or test-double guidance. Options, from cheapest up:
  1. **A transport seam** that mirrors `MailTransport`. Define a small `NotificationTransport.trigger(key, payload)` interface, implemented by a Knock transport and by a fake that records calls in memory or under `.outbox/`, and pick the Knock one only when `KNOCK_SECRET_API_KEY` is set. This fits the repo and avoids the constructor throwing without a key.
  2. Inject a `fetch` stub through the SDK constructor's `fetch` option to assert on the HTTP request.
  3. For live checks against the development environment, trigger with `settings: { sandbox_mode: true }`, or set the Postmark channel's sandbox mode. Messages are generated and visible in Knock but not handed to Postmark. Use `knock workflow run … --sandbox-mode` for manual checks.

  Sources: README, `workflows.ts`, [Testing workflows](https://docs.knock.app/send-notifications/testing-workflows).

## 6. Pricing limits that could affect v1

From [knock.app/pricing](https://knock.app/pricing):

| | Free ($0) | Starter ($250/mo) |
|---|---|---|
| Messages / month | up to 10,000 ("We don't hard cap your messages"; Knock contacts you if you go over) | 50,000, then $0.005 each |
| Environments, workflows, channels, seats | unlimited | unlimited |
| Log retention | 30 days | 30 days |
| Feed retention | unlimited | unlimited |
| Preferences | yes (per-tenant prefs are Enterprise-only) | yes |
| Remove Knock branding / email client previews | no | yes |

- Knock doesn't bill for the provider. Postmark is still paid separately.
- Nothing here blocks v1. The one visible constraint is **Knock branding** on the Free tier. *Not verified:* where that branding appears (feed UI vs emails).
- *Not verified:* whether a batched notification counts as one message or several.

## Could not verify

- Behaviour when triggering a bare-string recipient ID that Knock has never identified.
- Whether 429 responses carry `Retry-After`. The SDK honours `retry-after`/`retry-after-ms` generically, but Knock's docs don't mention it.
- The workflow JSON field for the "Commercial" toggle. `override_preferences` is confirmed only from a MAPI schema example, not from an attribute table.
- The exact mapping of rate-limit tiers to req/s.
- Where Free-tier "Knock branding" shows up.
