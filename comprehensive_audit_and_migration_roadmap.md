# Comprehensive Audit & Migration Roadmap

## Scope
This audit is focused on the user-facing application under `split-apps/user-app`. The review was completed in audit-first mode, so this document captures the current defects, likely root causes, recommended fixes, rollout order, and test gaps without changing runtime code yet.

The audit specifically targets the four requested problem areas:

1. Backend data retrieval optimization
2. Infinite scroll and list behavior
3. Download file storage and device visibility
4. BTS avatar expiration and real-time cleanup

---

## Executive Summary
The user app already contains the building blocks needed for the requested upgrade, including `FlashList`, `MasonryFlashList`, React Query dependencies, realtime subscriptions, and several edge functions that expose paginated client-facing feeds. The main issue is that the screens do not consistently use those building blocks.

The current implementation has four systemic problems:

1. Data-heavy screens still perform direct client-side Supabase fan-out queries instead of using paginated service endpoints.
2. Several user-facing screens still rely on `ScrollView` for long or potentially long content, so virtualization, buffer spacing, and scroll restoration are inconsistent.
3. The download flow saves files into app-private storage instead of OS-visible media libraries, so files do not reliably appear in Android galleries or iOS Photos.
4. BTS expiration logic is incorrect in multiple places and does not include local timer-based cleanup, so expired story avatars can remain visible until a manual refresh or app restart.

If left unchanged, the current code is unlikely to meet the requested sub-2-second fetch target across real datasets, especially on the announcement feed, BTS feed, gallery photo retrieval, and chat history screens.

---

## High-Risk Findings

### 1. BTS expiration filters are logically incorrect
The BTS filtering logic is broken in multiple screens and services because expiry and schedule checks are combined with separate `.or()` clauses or with a single malformed OR group. That means a post can pass the filter if any single condition is true, even when it is already expired.

Affected modules:

- `split-apps/user-app/app/(tabs)/home/index.tsx`
- `split-apps/user-app/app/bts/[id].tsx`
- `split-apps/user-app/services/client.ts`

Why this matters:

- Expired BTS story avatars can remain in the home row.
- Expired BTS viewer items can still load in the full-screen feed.
- Realtime refreshes do not guarantee cleanup because the local list is rebuilt from an invalid filter.

Required fix:

- Replace the current OR logic with the equivalent of:
  - `is_active = true`
  - `(expires_at is null OR expires_at > now)`
  - `(scheduled_for is null OR scheduled_for <= now)`
- Add a local expiration scheduler so items are removed at the exact expiration time without needing a database event.

### 2. Announcement and BTS feeds perform N+1 client fan-out
Both social feeds fetch a base list and then run extra per-item lookups for likes, bookmarks, comment counts, and related state. In the current shape, 20 cards can trigger more than 80 network/database operations before the screen stabilizes.

Worst offenders:

- `split-apps/user-app/app/announcements/index.tsx`
- `split-apps/user-app/app/bts/[id].tsx`
- `split-apps/user-app/app/bts/all.tsx`
- `split-apps/user-app/app/announcements/all.tsx`

Current query shape examples:

- Announcement feed: `1` base list query + `4 x N` per announcement
- BTS viewer: `1` feed query + `4 x N` per BTS post
- Home screen: parallel direct queries for BTS, galleries, notifications, announcements, then additional thumbnail/signed URL fetches

Required fix:

- Move list screens to aggregated endpoints or service functions that return:
  - page items
  - pagination cursor
  - social counters
  - viewer state
  - minimum display fields only
- Reuse the existing edge functions `clients_bts_feed` and `clients_announcements` after fixing their payloads and expiry filters.

### 3. Download pipeline writes to app-private storage instead of device media libraries
The gallery download code uses `expo-file-system/legacy` and writes into `documentDirectory`. That is app-private storage, not OS media storage. The files may exist, but they are not guaranteed to appear in Android gallery apps or iOS Photos.

Affected modules:

- `split-apps/user-app/app/(tabs)/gallery/index.tsx`
- `split-apps/user-app/app/(tabs)/profile/settings/downloads.tsx`
- `split-apps/user-app/supabase/functions/client_gallery_download/index.ts`

Current defects:

- No `expo-media-library` integration
- No Android media scanning step
- No iOS Photo Library save flow
- No completion notification
- No persistent download registry
- Downloads settings screen is only a placeholder

Additional backend defect:

- `client_gallery_download` still queries a `photos` table, while the app’s gallery flow primarily uses `gallery_photos`. That schema mismatch is a likely source of broken or inconsistent downloads.

Required fix:

- Save completed downloads to a shared album:
  - Android: `MediaLibrary.createAssetAsync` plus album placement
  - iOS: `MediaLibrary.createAssetAsync` plus album placement in Photos
- Persist a download manifest locally for the downloads history screen
- Emit user-visible local notifications on completion/failure
- Standardize the backend on `gallery_photos` or create a clear compatibility adapter

### 4. Long lists are not consistently virtualized and cannot scale
Several major screens still use `ScrollView` for content that should be virtualized. This will degrade quickly as data grows and prevents proper infinite scroll, list buffering, and scroll-to-top behavior.

Affected modules:

- `split-apps/user-app/app/(tabs)/home/index.tsx`
- `split-apps/user-app/app/(tabs)/gallery/index.tsx`
- `split-apps/user-app/app/(tabs)/bookings/index.tsx`
- `split-apps/user-app/app/(tabs)/chat/index.tsx`
- `split-apps/user-app/app/(tabs)/profile/index.tsx`

Current state:

- `Announcements` and `BTS all` use list primitives but still fetch full datasets.
- `Gallery` uses `MasonryFlashList` for photo grids, but the surrounding shell still relies on `ScrollView` and modal nesting.
- `Chat` renders the whole message history inside `ScrollView`, which does not support efficient paging.
- `Home` uses a monolithic `Animated.ScrollView` with multiple horizontally nested lists and full refreshes.

Required fix:

- Standardize on `FlashList` for vertical feeds
- Use `onEndReached` and cursor-based pagination
- Add `RefreshControl` where the user expects pull-to-refresh
- Add a shared list-screen shell that always reserves at least `100px` above the floating tab bar

---

## Detailed Findings By Requirement

## 1. Backend Data Retrieval Optimization

### Current findings

#### Home screen
The home dashboard is the most expensive aggregation point in the app.

Observed issues:

- `fetchBts()` runs direct `select('*')` against `bts_posts`
- `fetchAnnouncements()` runs direct `select('*')` against `announcements`
- `fetchGalleries()` combines:
  - client gallery query
  - unlocked gallery query
  - local unlocked gallery re-query
  - thumbnail query
  - signed URL generation
- realtime subscriptions refetch full sections rather than patching a single record

Impact:

- Heavy initial load
- duplicate data transfer
- duplicate signing work
- high chance of jank on low-end devices

#### Gallery screen
The gallery flow is partly optimized and partly not.

Observed issues:

- gallery shell fetches all galleries eagerly
- `ClientService.gallery.getPhotos()` fetches all photos for a gallery in one request
- signed URLs are generated one photo at a time inside `Promise.all`
- thumbnails are signed per-photo with fallback logic, which amplifies storage round trips

Impact:

- slow gallery open time on large shoots
- unnecessary storage API load
- poor chance of meeting the 2-second target on medium or large galleries

#### Announcements and BTS feeds
The social feeds do not use an aggregated BFF pattern even though the repository already includes edge functions that do exactly that.

Underused or partially-ready endpoints:

- `supabase/functions/clients_bts_feed/index.ts`
- `supabase/functions/clients_announcements/index.ts`
- `supabase/functions/clients_announcements_id/index.ts`

Issues in those endpoints:

- `clients_bts_feed` still needs corrected expiry/schedule logic
- `clients_announcements` does not currently apply expiration filtering
- neither endpoint is wired into the user-facing screens that need them most

#### Chat screen
Chat loads the full message history up front and appends in realtime.

Observed issues:

- no pagination
- no capped history window
- no reverse infinite scroll
- admin profile polling every 5 seconds adds unnecessary churn

Impact:

- slower initial render for long chats
- memory growth over time
- wasted network activity while chat is open

### Required upgrade design

#### Data layer changes

- Introduce a single feed service per major list:
  - `HomeFeedService`
  - `AnnouncementFeedService`
  - `BtsFeedService`
  - `GalleryDownloadsService`
  - `ChatMessageService`
- Use React Query for:
  - stale-while-revalidate
  - background refresh
  - optimistic patching
  - pagination state

#### Query constraints

- Never use `select('*')` on feed endpoints
- only request fields needed for visible cards
- server-provide counts and booleans instead of per-item client lookups
- return cursors or `offset/limit` metadata for every list endpoint

#### Database-side recommendations

- Add or validate composite indexes for:
  - `bts_posts(is_active, scheduled_for, expires_at, created_at desc)`
  - `announcements(is_active, scheduled_for, expires_at, created_at desc)`
  - `gallery_photos(gallery_id, upload_order, created_at desc)`
  - `messages(client_id, created_at desc)`
  - `notifications(user_id, created_at desc, read, is_read)`
- Consider materialized feed views or RPC wrappers for counts-heavy feeds

### Performance target plan

- Home initial content: under `2.0s`
- Gallery list load: under `1.5s`
- First photo page in gallery: under `2.0s`
- Announcement and BTS feed page fetch: under `1.2s`
- Chat initial page: under `1.0s`

### Metrics to capture during implementation

- p50 / p95 endpoint latency
- DB query count per screen open
- storage signing operations per gallery open
- bytes transferred per page
- time to first visible list item

---

## 2. Infinite Scroll Implementation

### Current findings

#### Screens already using list primitives but lacking infinite scroll

- `app/announcements/index.tsx`
- `app/announcements/all.tsx`
- `app/bts/all.tsx`
- `app/bts/[id].tsx`

Problems:

- full-list fetches instead of paged fetches
- no `onEndReached`
- no scroll-to-top helper
- pull-to-refresh exists on some screens but not consistently

#### Screens still using `ScrollView` where a virtualized list is needed

- `app/(tabs)/home/index.tsx`
- `app/(tabs)/bookings/index.tsx`
- `app/(tabs)/chat/index.tsx`
- `app/(tabs)/profile/index.tsx`
- `app/(tabs)/gallery/index.tsx` shell and nested modal flows

Problems:

- unbounded render trees
- inconsistent safe-area + tab-bar spacing
- no central scroll state
- poor performance on long datasets

#### Tab bar buffer issue
The tab bar is floating and 74px tall, with extra bottom offset. Several screens use arbitrary bottom padding values like `20`, `24`, `32`, or `120`, but there is no shared bottom safe-area contract.

Result:

- list tails can end too close to the floating tab bar
- action buttons and final cells can be partially obscured
- the requested `100px` buffer is not guaranteed

### Required upgrade design

#### Shared list shell
Create a shared list container that standardizes:

- bottom content inset >= `100px`
- pull-to-refresh
- scroll-to-top ref handling
- empty, loading, error states
- keyboard-safe behavior where needed

#### Screen-by-screen migration

- Home:
  - split into vertically paged sections or a single virtualized home feed
  - retain horizontal carousels only for short datasets
- Gallery:
  - paginate galleries
  - paginate photos per gallery
  - keep `MasonryFlashList`, but remove surrounding `ScrollView` bottlenecks
- Chat:
  - move to inverted `FlashList`
  - load newest page first
  - prepend older messages on demand
- Bookings:
  - if packages and bookings grow, convert both sections to virtualized lists
- Profile:
  - use a section list if activity, invoices, downloads, and achievements continue to expand

#### Scroll-to-top behavior

- tapping an already-selected tab should scroll the active list to top
- detail modals should expose a close-and-return behavior that restores scroll position

---

## 3. Download File Storage Issue

### Current findings

#### Client-side download flow
The current implementation downloads files into:

- `FileSystem.documentDirectory + galleries/...`
- `FileSystem.documentDirectory + photos/...`

This does not satisfy the requested behavior because:

- those files are private to the app sandbox
- they are not guaranteed to appear in gallery apps
- there is no system-facing media index update

#### UX gaps

- no progress indicator per file
- no completion notification
- no failure retry queue
- no download history screen
- no destination preview or "open in folder/photos" action

#### Backend mismatch
The `client_gallery_download` edge function references `photos`, while the user app primarily works with `gallery_photos`. That mismatch needs to be resolved before the download pipeline can be trusted.

### Required upgrade design

#### Native storage strategy

- Add `expo-media-library`
- For Android:
  - create media asset
  - add to a named album such as `Epix Visuals`
  - verify visibility through the MediaStore path
- For iOS:
  - save to Photo Library
  - optionally group into album if supported in the flow

#### Download manager

- Queue downloads with states:
  - pending
  - in_progress
  - completed
  - failed
- Persist queue state in local storage
- show local notification when complete
- update the downloads settings screen to show recent and failed downloads

#### Completion SLA
To achieve "visible within 5 seconds":

- keep file IO on a queue
- save asset immediately after download
- do not wait for a follow-up refresh screen to acknowledge success
- expose last completion timestamp for instrumentation

---

## 4. BTS Avatar Expiration Logic

### Current findings

In this codebase, the "BTS avatar" behavior is the circular story-style BTS row shown on the home screen. Those avatars are directly derived from `bts_posts`, so if expiry logic is wrong, the avatar ring remains visible.

Observed causes:

- invalid OR filtering in `home/index.tsx`
- invalid OR filtering in `bts/[id].tsx`
- invalid OR chaining in `services/client.ts`
- no per-item expiration timer once data is already in memory
- realtime subscription refetches everything but does not guarantee immediate cleanup at the exact expiry moment

### Required upgrade design

#### State model

- Normalize BTS items by id
- store `expires_at` as parsed epoch
- maintain a min-next-expiry timer
- remove expired items locally the moment their timer fires

#### Realtime model

- use realtime subscriptions only for:
  - insert
  - update
  - delete
- do not rely on realtime alone for expiry because a timestamp passing is not a row update

#### Visibility transitions

- when a BTS item expires while visible:
  - remove it from the home avatar rail immediately
  - if currently open in the full-screen viewer, advance to the next valid item or close cleanly
  - if it is the only item left, show empty-state fallback

---

## Screen Inventory And Audit Notes

### `app/(tabs)/home/index.tsx`

- Primary aggregation hotspot
- mixes dashboard, BTS rail, announcements carousel, and gallery preview
- no infinite scroll for any vertical content
- full refetch on realtime events
- BTS expiry logic is currently unsafe

### `app/(tabs)/gallery/index.tsx`

- strongest use of virtualization for photo grids
- still lacks paged data retrieval, OS-visible download storage, and download history
- shell structure still depends on `ScrollView`
- current photo signing strategy is too expensive for large galleries

### `app/(tabs)/bookings/index.tsx`

- mostly small dataset today, but built entirely around `ScrollView`
- package and booking fetches are eager and unpaginated
- payment flow is still placeholder-driven and not instrumented for performance

### `app/(tabs)/chat/index.tsx`

- real-time messaging works but does not scale
- loads entire history
- lacks inverted pagination
- profile polling every 5 seconds is too aggressive

### `app/(tabs)/profile/index.tsx`

- heavy summary screen still rendered via `ScrollView`
- direct fetches for payments, galleries, photo counts, next booking, and booking counts
- downloads entry points to a placeholder screen only

### `app/announcements/index.tsx`

- good card abstraction via `FeedPostCard`
- bad query fan-out and no pagination
- should become the primary announcement feed once moved to paginated service endpoints

### `app/announcements/all.tsx`

- list exists but still fetches full dataset
- realtime invalidates by refetching the whole feed
- already has pull-to-refresh, so it is a good candidate for first infinite-scroll rollout

### `app/announcements/[id].tsx`

- detail screen is not the main performance bottleneck
- comment polling every 5 seconds should be replaced with more targeted realtime and background refresh

### `app/bts/all.tsx`

- uses `FlashList`
- still fetches all results and does not page
- expiry filter is incomplete because it only checks `.gt('expires_at', nowIso)` and excludes null-expiry items incorrectly

### `app/bts/[id].tsx`

- full-screen feed is visually strong
- data fetch is expensive and expiry filter is unsafe
- no immediate cleanup when active item expires

### `app/(tabs)/profile/settings/downloads.tsx`

- currently not implemented beyond empty placeholder state
- cannot satisfy the requested download deliverables until it is backed by a download registry

---

## Existing Assets Worth Reusing

The codebase already contains several useful pieces that should be reused instead of replaced:

- `@shopify/flash-list`
- `MasonryFlashList`
- React Query dependency in `package.json`
- edge functions:
  - `clients_bts_feed`
  - `clients_announcements`
  - `clients_announcements_id`
  - `client_gallery_access`
- realtime subscriptions already present in feed and gallery screens

The audit recommendation is to consolidate around these pieces rather than introducing an entirely new stack.

---

## Recommended Fix Plan

## Phase 1: Critical correctness

1. Fix BTS expiry and schedule predicates everywhere
2. add local expiration timers for BTS story/avatar cleanup
3. fix download backend schema mismatch between `photos` and `gallery_photos`
4. stop writing user downloads only to app-private storage

## Phase 2: Query reduction

1. move announcements and BTS lists to paginated edge/service endpoints
2. batch gallery photo URL signing with `createSignedUrls`
3. reduce `select('*')` usage on all feed screens
4. patch realtime updates into local cache instead of full refetch

## Phase 3: Infinite scroll and virtualization

1. convert announcement feeds to paginated `FlashList`
2. convert BTS all feed to paginated `FlashList`
3. convert chat to inverted paginated list
4. standardize 100px bottom buffer and scroll-to-top behavior

## Phase 4: Download UX completion

1. implement download queue and history
2. save completed downloads to Android/iOS shared media libraries
3. add completion and failure notifications
4. populate the downloads settings screen with persistent records

## Phase 5: Validation

1. add performance instrumentation
2. add focused regression tests
3. run load tests against paginated endpoints

---

## Test Gap Analysis

Current test coverage in `split-apps/user-app/__tests__` is mostly focused on auth, setup, and a few screen compilation scenarios. There is no meaningful automated coverage yet for the requested problem areas.

Missing tests:

- BTS expiration removal without app restart
- announcement and BTS pagination behavior
- gallery infinite scroll and pull-to-refresh
- download queue success/failure persistence
- Android/iOS media library save integration
- chat pagination and scroll retention
- tab reselect scroll-to-top behavior
- bottom safe-area buffer regression

Recommended test additions:

- unit tests for expiry filtering and timer cleanup
- service tests for paginated feed adapters
- integration tests for gallery download state transitions
- screen tests for infinite scroll loading states
- end-to-end tests for:
  - open gallery
  - download photo
  - confirm file appears in downloads history
  - open BTS and verify expiry cleanup

---

## Delivery Notes

This audit confirms that the highest-value runtime changes should start in these modules:

1. `split-apps/user-app/app/(tabs)/home/index.tsx`
2. `split-apps/user-app/app/(tabs)/gallery/index.tsx`
3. `split-apps/user-app/app/bts/[id].tsx`
4. `split-apps/user-app/app/bts/all.tsx`
5. `split-apps/user-app/app/announcements/index.tsx`
6. `split-apps/user-app/services/client.ts`
7. `split-apps/user-app/supabase/functions/client_gallery_download/index.ts`

These are the main `index.tsx` problem areas and the related service/back-end files that need to be corrected before broader UX polish work begins.

---

## Audit Conclusion

The app is not far from the requested target state, but it currently falls short on four fronts:

- too many direct client-side Supabase calls
- incomplete virtualization and no consistent infinite scrolling
- incorrect native download destination handling
- BTS expiration logic that is not safe or immediate

The recommended path is not a rewrite. It is a focused refactor that standardizes feed access, list behavior, download storage, and expiry state management around infrastructure that already exists in the repo.
 these are the ui upgrdes fisrst complete thesse upgrades then we mov on to the next phases 
 no the home screen iwant to be like social app not dashboard  also lets strt with  the ui fixes then move to  the  other phases The notifications screen in notifications.tsx is clean, but could feel more premium and more actionable.
Add filters like All, Unread, Payments, Galleries, Bookings.
Increase card distinctiveness by notification type.
Make the CTA more obvious on actionable notifications like gallery-ready or payment-required.
Add grouped-by-date sections like Today, Earlier this week, Older.- The chat screen in index.tsx works, but it still feels utility-first.
- Upgrade the header with studio identity, response-time promise, and quick actions like Send inquiry , Ask about delivery , Request edit .
- Add quick reply chips above the input.
- Add structured message cards for invoices, gallery-ready updates, and booking confirmations.
- Improve empty state so it feels warm and guided, not blank.
- Add typing indicator, delivery/read receipts, and nicer system messages.    Announcements And BTS - Add unread styling that is more elegant: subtle gold edge, dot, or title weight change.
- Add richer author/admin identity with badge, avatar polish, and category ribbons.
- BTS in all.tsx and [id].tsx should lean harder into a reels/story look.
- The full-screen viewer should get cleaner overlays, stronger caption styling, and better progress affordances.
- BTS cards on home should preview urgency or freshness better, like New , Expires today , Wedding , Portrait . - The gallery landing should open with a featured hero gallery, then segmented sections like My Galleries , Unlocked , Favorites , Portfolio .
- Add sticky filter chips: All , Recent , Wedding , Portrait , Paid , Locked .
- Improve gallery cards with stronger cover treatment, clearer metadata, and cleaner CTA grouping.
- The photo viewer should feel more premium: darker chrome, less clutter, better pinch/zoom cues, stronger swipe-to-dismiss feel.
- Add a proper Select mode for batch actions like download, favorite, and share.
- Add a visible download state per photo/gallery: queued , downloading , saved to Photos , failed .
- Introduce a true downloads/history screen connected to the gallery, not just a placeholder settings page.
- Make unlock transitions feel special: blur fades, locked overlay collapse, watermark fade-out after successful payment.
- Add a slideshow mode and “highlight picks” collection for large shoots. - The booking flow in index.tsx feels off because it mixes discovery, history, and booking in one screen.
- Split it into a step flow:
- Step 1 : choose package
- Step 2 : choose date
- Step 3 : add details
- Step 4 : review + pay deposit
- Replace the current alert-based payment handoff with an in-screen bottom sheet or confirmation panel.
- Show package cards with clearer differentiation: hero image, best-for label, duration, deliverables, price, deposit amount.
- Improve the calendar with stronger states: unavailable, limited, available, selected.
- Add a visual booking progress tracker for existing bookings: Requested > Deposit Paid > Confirmed > Shoot Day > Editing > Delivered .
- Turn “My Bookings” into a clean timeline or accordion cards with clear status colors and next actions.
- Add trust-building details near payment: cancellation policy, reschedule policy, turnaround estimate.
- The whole flow should feel like one guided experience, not three tabs sharing one state bucket. Home Page Turn BTS into a more premium “story rail” with stronger spacing, consistent ring treatment, and subtle category chips. - Replace generic stacked sections with clearer visual hierarchy: Hero , What Needs Attention , Latest Memories , Updates .
- Add stronger section cards for pending actions like Gallery ready , Payment pending , New announcement , Booking confirmed .
- Use larger, more visual announcement cards with one primary featured card and smaller secondary cards beneath.
- Add skeletons that match exact layout blocks instead of generic spinners.
- Introduce soft motion: header fade, card entrance stagger, and a tap-to-scroll-to-top behavior when the home tab is tapped again.
- Make the page less text-heavy by using icon + label + short meta instead of multiple dense lines.
