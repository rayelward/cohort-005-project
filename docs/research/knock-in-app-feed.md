# Research: Knock in-app feed in a React Router 8 / React 19 SSR app

Resolves issue #2 (parent map #1). Researched 2026-11-10.

**Gist:** Knock gives us two layers. `@knocklabs/react` has prebuilt feed components (bell, badge, popover, cells), styled with `--rnf-*` CSS variables and plain CSS. `@knocklabs/react-core` has headless hooks over the same realtime feed store. For Cadence, use the headless hooks with our own shadcn/radix UI, mount Knock on the client only, and mint the per-user JWT in the `layout.app.tsx` loader with `signUserToken` from `@knocklabs/node`.

## Sources

Primary sources only:

- npm registry metadata and the published tarballs of `@knocklabs/react@0.15.1`, `@knocklabs/react-core@0.17.1`, `@knocklabs/client@0.23.1` and `@knocklabs/node@1.41.0`. I read the shipped `dist/` code and `.d.ts` types. File paths below are relative to each package root.
- Knock docs:
  - [Security and authentication](https://docs.knock.app/in-app-ui/security-and-authentication)
  - [React feed](https://docs.knock.app/in-app-ui/react/feed)
  - [Feed styling](https://docs.knock.app/in-app-ui/feeds/styling)
  - [In-app channel (Knock)](https://docs.knock.app/integrations/in-app/knock)
  - [Headless feed](https://docs.knock.app/in-app-ui/react/headless/feed)
- The `@knocklabs/react` README, which ships in the tarball.
- My own local bundle measurement with esbuild 0.x (method below).

## 1. Packages

| Package | Version | Role |
| --- | --- | --- |
| `@knocklabs/react` | 0.15.1 | Prebuilt components plus a re-export of everything in `react-core`. Peers: `react`/`react-dom` `^17 \|\| ^18 \|\| ^19`. The `next` and `@tanstack/react-router` peers are **optional** (`peerDependenciesMeta`), so React Router doesn't need them. |
| `@knocklabs/react-core` | 0.17.1 | Headless: providers and hooks. Peer: `react ^17–19`. Depends on `swr`, `date-fns`, `@tanstack/react-store` and `@knocklabs/client`. |
| `@knocklabs/client` | 0.23.1 | Framework-agnostic JS client. Handles the HTTP API, the Phoenix websocket (`phoenix` dependency) and the feed store. |
| `@knocklabs/node` | 1.41.0 | Server SDK. Triggers workflows and exports `signUserToken`. Its only dependency is `jose`. |

Source: `npm view <pkg> version peerDependencies peerDependenciesMeta dependencies`.

## 2. Prebuilt components vs headless hooks

**Prebuilt** (`@knocklabs/react`, from `dist/types/modules/feed/index.d.ts`):

- `KnockProvider`: props `apiKey`, `user` (`{ id, ...props }`), `userToken`, `onUserTokenExpiring`, `timeBeforeExpirationInMs`, `enabled`, `identificationStrategy` (`"inline" | "skip"`), `host`, `i18n`, `logLevel` and `branch`.
- `KnockFeedProvider`: props `feedId` (the feed channel ID), `colorMode` (`"light" | "dark"`) and `defaultFeedOptions` (a `FeedClientOptions` object such as `{ archived: "exclude", page_size, status, workflow_categories, tenant }`).
- `NotificationIconButton`: a bell icon with a badge. Props `badgeCountType` (`"unseen" | "unread" | "all"`, default `"unseen"`) and `onClick`. It forwards a ref.
- `NotificationFeedPopover`: positioned with `@popperjs/core`, not Radix. Props are `isVisible`, `onClose`, `buttonRef`, `onOpen`, `placement` and `closeOnClickOutside`, plus every `NotificationFeed` prop.
- `NotificationFeed`: props `renderItem`, `renderHeader`, `EmptyComponent`, `onNotificationClick`, `onNotificationButtonClick`, `onMarkAllAsReadClick`, `initialFilterStatus`, `renderLoading` and `formatTimestamp`.
- Building blocks: `NotificationCell` (props `item`, `onItemClick`, `onButtonClick`, `avatar`, `archiveButton`, `children`), `NotificationFeedHeader`, `MarkAsRead`, `UnseenBadge`, `Avatar` and `EmptyFeed`.

**Headless** (`@knocklabs/react-core`, also re-exported from `@knocklabs/react`):

- `useKnockFeed()` returns `{ knock, feedClient, useFeedStore, colorMode }` when called inside `KnockFeedProvider`.
- `useFeedStore()` (from that provider) or `useNotificationStore(feedClient, selector?)` returns the `FeedStoreState`, which includes `items`, `metadata` (`total_count`, `unread_count`, `unseen_count`), `pageInfo` and `networkStatus`.
- Use `useAuthenticatedKnockClient(apiKey, user, userToken, opts)` and `useNotifications(knock, feedChannelId, opts)` if you want to skip the providers entirely (README "Headless usage").
- `useKnockClient()` and `useKnockAuthState()`.
- Each `FeedItem` (`@knocklabs/client` `clients/feed/interfaces.d.ts`) carries:
  - `id`
  - `blocks` (named content blocks, e.g. `body` with `.rendered` HTML and `action_url` with `.rendered`)
  - `data` (the trigger payload)
  - `actors`
  - `inserted_at`, `seen_at`, `read_at`, `interacted_at`, `archived_at`
  - `tenant`
  - `source` (workflow key etc.)

**Recommendation for Cadence:** go headless. Render the bell with `lucide-react` `Bell`, the panel with a radix `Popover`/`DropdownMenu` (shadcn), and rows with our own Tailwind cells driven by `useKnockFeed()` + `useFeedStore()`. This drops the popper/Telegraph stack (see bundle weight), keeps a11y and focus handling consistent with the rest of the app, and avoids fighting a second stylesheet.

## 3. Styling the prebuilt components

From the [Feed styling](https://docs.knock.app/in-app-ui/feeds/styling) and [React feed](https://docs.knock.app/in-app-ui/react/feed) docs, and from `dist/index.css`:

- The components need `import "@knocklabs/react/dist/index.css"` (66.9 KB raw, about 12.7 KB gzipped). The JS doesn't inject it: the ESM entry has only `/* empty css */` placeholders.
- 92 distinct `--rnf-*` CSS variables cover colours, fonts, radii, cell padding, popover size, the unread dot and buttons. These can be mapped onto our Tailwind/shadcn tokens, e.g. `--rnf-color-brand-500: var(--primary)`.
- Every element uses BEM-ish `rnf-*` class names (e.g. `rnf-notification-cell`, `rnf-notification-cell__unread-dot`). The docs say you can "completely replace Knock's CSS".
- `colorMode="dark"` adds `--dark` modifier classes. This doesn't follow Tailwind's `.dark` class automatically, so we'd have to pass it ourselves.
- `renderItem` replaces each cell, `renderHeader` replaces the header and `EmptyComponent` replaces the empty state. This hybrid lets us keep Knock's popover and use our own Tailwind cells.
- Tailwind isn't mentioned anywhere in Knock's docs. Utility classes can't be passed into the built-in components except through `renderItem` and our own wrappers, and none of the prebuilt components take a `className` prop (checked in the `.d.ts` props).

## 4. Realtime, counts, read state, archiving

- **Realtime:** the client opens a Phoenix websocket (`@knocklabs/client` `api.mjs`), only `if (typeof window !== "undefined" && typeof WebSocket !== "undefined")`. New items and count changes stream into the store. By default the socket disconnects when the tab is hidden (`disconnectOnPageHidden`, a Knock client option) and reconnects when the tab is visible again. There's also an experimental `__experimentalCrossBrowserUpdates` option that syncs tabs via BroadcastChannel ([React feed docs](https://docs.knock.app/in-app-ui/react/feed)).
- **Counts:** `metadata.unseen_count` and `metadata.unread_count` (and `total_count`) are in the store. **The default badge counts *unseen*.** By default, opening `NotificationFeedPopover` calls `feedClient.markAllAsSeen()`, which resets the badge (the `defaultOnOpen` in `NotificationFeedPopover.tsx`). If we want an unread badge, use `badgeCountType="unread"` or read `unread_count` directly.
- **State semantics** ([in-app channel docs](https://docs.knock.app/integrations/in-app/knock)):
  - *unseen*: not yet rendered in the feed.
  - *seen*: rendered in the feed.
  - *read*: clicked, or covered by mark-all-read.
  - *interacted*: an engagement event; clicking a cell records it with the action URL.
  - *archived*: removed from the feed.
- **Feed client methods** (`clients/feed/feed.d.ts`):
  - `markAsSeen`, `markAllAsSeen`, `markAsUnseen`
  - `markAsRead`, `markAllAsRead`, `markAsUnread`
  - `markAsInteracted(item, metadata)`
  - `markAsArchived`, `markAllAsArchived`, `markAllReadAsArchived`, `markAsUnarchived`
  - `fetch(opts)`, `fetchNextPage()`
  - `on`/`off` events

  All update the local store optimistically.
- **Filters:** `FilterStatus` is `all | read | unseen | unread`. Archived items are excluded by default. The docs say the prebuilt feed has no archived view, but you can fetch them with `archived: "only"`. `NotificationCell` renders an `ArchiveButton` on hover by default.
- **Content can't be edited after sending.** To correct a notification you archive it and trigger again (in-app channel docs).

## 5. Browser auth: public key + signed user token (enhanced security)

From [Security and authentication](https://docs.knock.app/in-app-ui/security-and-authentication) and `@knocklabs/node` `lib/tokenSigner.{d.mts,mjs}`:

- **Without enhanced security**, the browser authenticates with just the public key and a user id. The docs warn: "Without enhanced security mode, a request with your public key can act as any user." The docs say production should enable it "before you release your in-app feed to your users". It's a per-environment setting in the Knock dashboard, so dev can stay off and prod on.
- **With enhanced security**, every client request also needs a **user token**. This is an RS256 JWT signed with the environment's private **signing key** (dashboard > Platform > API keys; it's shown only once). Claims: `sub` = user id (required), `iat`, `exp` (recommended), and optional `grants`.
- **Minting helper:**

  ```ts
  import { signUserToken } from "@knocklabs/node"; // also exported at the package root
  const userToken = await signUserToken(String(userId), { expiresInSeconds: 3600 });
  ```

  `signingKey` falls back to `process.env.KNOCK_SIGNING_KEY` (PEM or base64), which matches our `.env.example` name. The default expiry is 3600 s. The helper throws if the key is missing.
- **Where to mint in Cadence:** in a `*.server.ts` helper (e.g. `app/lib/knock.server.ts`), called from the `app/routes/layout.app.tsx` loader. That loader already resolves `getCurrentUserId(request)`. Return `{ knockUserId, knockUserToken, knockPublicKey, knockFeedChannelId }` to the client. The public key and feed channel ID aren't secret, so passing them through loader data is fine. `KNOCK_SECRET_API_KEY` and `KNOCK_SIGNING_KEY` must stay server-only.
- **Expiry and refresh:** pass `onUserTokenExpiring={async () => fetch("/api/knock-token").then(r => r.text())}`. That callback fires `timeBeforeExpirationInMs` before `exp` and must return the new token. It needs a small resource route that mints a fresh token for the session user. Alternatively, match token lifetime to session lifetime, which the docs recommend. React Router layout loaders don't re-run on every child navigation, so a long tab session will outlive a 1 h token unless we refresh.
- **User switching (DevUI):** when `user.id` or `userToken` changes, `Knock.authenticate` tears down and reinitialises the feed and socket (`@knocklabs/client` `knock.mjs`). So a revalidated loader after a DevUI switch just works. `enabled={Boolean(userId && userToken)}` keeps the client idle when no user is selected (README "Deferring activity with `enabled`").
- **Identity side effect:** the default `identificationStrategy` is `"inline"`. When `user` is an object, the browser calls `user.identify(props)` on authenticate, which upserts the Knock user from the client. Pass `identificationStrategy="skip"` if user identity should be owned server-side (`knock.users.update` from `@knocklabs/node`). This feeds into the open "Identity mapping" question on #1.

## 6. SSR caveats

- `@knocklabs/react`'s ESM entry starts with `"use client"`. That's a no-op hint for React Router, not a guard.
- No module ever touches `window` at import time, so **importing on the server is safe**. Socket and visibility code is guarded with `typeof window/document`.
- **Rendering on the server is not clean**:
  - `useAuthenticatedKnockClient` runs `new Knock(...)` and `authenticate(...)` inside `useMemo`, i.e. during render. On the server that means:
    - with `identificationStrategy: "inline"` and a `user` object, the server fires an identify HTTP request for every SSR render;
    - with `onUserTokenExpiring`, it schedules a `setTimeout` on the server.
  - `useNotifications` initialises the feed in a `useState` initialiser. The socket join is skipped without `window`.
  - The feed **doesn't fetch on the server**, so SSR would render an empty or loading feed anyway, with no SEO value.
- **Recommendation:** render the Knock subtree client-only. Use a `useEffect`-set `mounted` flag (or `enabled={isHydrated && Boolean(token)}` plus `identificationStrategy="skip"`) and render a static bell placeholder on the server, so there's no layout shift and no hydration mismatch.
- I found no React Router or Remix recipe in Knock's docs. The only SSR guidance is Next.js-specific (a `@knocklabs/react/next` subpath and a blog post).

## 7. Bundle weight

Measured locally with esbuild (`--bundle --minify --format=esm`, with `react`, `react-dom`, `next` and `@tanstack/react-router` external, CSS emptied), importing only the named symbols:

| Import | Minified | Gzipped |
| --- | --- | --- |
| `@knocklabs/react`: `KnockProvider`, `KnockFeedProvider`, `NotificationFeedPopover`, `NotificationIconButton` | 565 KB | **~185 KB** |
| `@knocklabs/react-core`: `KnockProvider`, `KnockFeedProvider`, `useKnockFeed` (headless) | 111 KB | **~33 KB** |
| `@knocklabs/react/dist/index.css` | 67 KB | ~13 KB |

- The prebuilt package tree-shakes poorly. It declares no `sideEffects` field, and its entry pulls in the Guides, Slack and MS Teams modules. The metafile shows `@base-ui/react` (155 KB), `motion-dom`/`framer-motion` (74 KB) and `@telegraph/*` coming from those modules, not from the feed.
- The headless path costs about the same as `@knocklabs/client` (with `phoenix` and `eventemitter2`) plus `swr` and `date-fns`.
- Vite/Rollup in our production build may tree-shake a bit differently. I didn't verify this inside Cadence's build. Either way, lazy-load the Knock subtree behind the client-only mount.

## 8. Linking a feed item to a URL in the app

- In the workflow's in-app channel step, enable "include click action" to set an **Action URL**. It can be static or Liquid, e.g. `/courses/{{ course_slug }}`. The URL arrives on the item as `blocks[name="action_url"].rendered`. The Single-action and Multi-action template variants add buttons, each with its own action URL ([in-app channel docs](https://docs.knock.app/integrations/in-app/knock)).
- **Default click behaviour in `NotificationCell`:** it calls `feedClient.markAsInteracted(item, { type: "cell_click", action })`. Then, if there's no `onItemClick`, it runs `setTimeout(() => window.location.assign(url), 200)`. That's a **full page reload**, not a client-side navigation.
- **For Cadence:** pass `onNotificationClick={(item) => { feedClient.markAsRead(item); navigate(actionUrlOf(item)); }}` using React Router's `useNavigate`, or do the same in our headless cell. Store app-relative paths in the Action URL, or put the target in trigger `data` (e.g. `data.path`) and read `item.data.path`.
- Clicking a cell **doesn't mark it read** in the prebuilt component. It only records `interacted`. If we want read-on-click, we have to call `markAsRead` ourselves.
- The cell `body` is pre-rendered HTML from Knock's markdown template, injected with `dangerouslySetInnerHTML`. Our headless cell would do the same, or use `item.data` fields directly.

## Unverified / open

- I didn't install the packages in Cadence or run them with React Router 8 SSR. The SSR behaviour above comes from reading the shipped code.
- The bundle numbers come from esbuild, not Cadence's Vite build.
- I didn't verify the dashboard UI for toggling enhanced security per environment. The docs imply it's per-environment.
- I didn't look up feed retention or message limits; the in-app channel docs I read don't cover them.
