# Unis — QA Findings Report
**Date:** April 2026
**Scope:** Pre-launch audit of 9 user-identified concerns across frontend and backend
**Frontend repo:** [cyberstizz/unis-sample](https://github.com/cyberstizz/unis-sample)
**Backend repo:** [cyberstizz/unis_mvp](https://github.com/cyberstizz/unis_mvp)

This document records the findings from a code-level investigation of nine QA concerns. Each finding is labeled with severity, has concrete file/line references, and lists the tests that lock it in.

**Severity legend:**
- 🔴 **BLOCKER** — must fix before launch. Money, data integrity, or correctness is at stake.
- 🟠 **HIGH** — should fix before launch. Incorrect behavior users will notice.
- 🟡 **MEDIUM** — should fix soon. Degraded UX or stale data.
- 🟢 **LOW** — cleanup / code hygiene.

---

## Finding 1 — AdSense Ad View Tracking: Partial Coverage

**Severity:** 🟠 HIGH
**Concern #1:** Do the percentages adhere to the earnings rules through the api flow?

### Summary
The ad revenue split math is **correct** and matches documentation (15/10/5/2/68 = 100%). However, **tracking only fires on 3 of the 6+ pages** where ads are supposed to appear, so most impressions are silently unattributed.

### Where it's correct
- `backend/src/main/java/com/unis/service/EarningsService.java` lines 45–53 — constants are right.
- `trackAdView()` at lines 66–113 — looks up supporter, walks 3-level referral chain correctly.

### Where it's broken
**Frontend fires `/v1/earnings/track-view` on only these pages:**
- `feed.jsx` line 75
- `findpage.jsx` line 40
- `voteawards.jsx` line 49

**Pages that probably show ads but never fire the tracker:**
- `songPage.jsx` — no `track-view` call
- `artistpage.jsx` — no `track-view` call
- `jurisdictionPage.jsx` — no `track-view` call
- `milestonesPage.jsx` — no `track-view` call
- `leaderboardsPage.jsx` — no `track-view` call
- `profile.jsx`, `artistDashboard.jsx` — no `track-view` call

### Guest handling
**Intentional:** guests are excluded by `if (!userId) return;` (see `feed.jsx` line 72). A comment confirms: *"guest ad revenue goes to Unis."* The backend `POST /track-view` requires a JWT — a guest hit would 401 anyway. **This is working as designed.**

### Fix
Add a shared `useAdTracking()` hook (or call `apiCall({ url: '/v1/earnings/track-view', method: 'post' })` in every page's top-level `useEffect` that shows ads). Route logic is identical; just missing coverage.

### Tests that lock this in
- `earnings.tracking.test.jsx` — verifies every page with `<AdSlot>` fires the endpoint once per mount.
- `earnings.math.test.js` — pins the 15/10/5/2/68 constants.

---

## Finding 2 — Monthly Total Computed Incorrectly; Balance Never Subtracts Past Payouts

**Severity:** 🔴 BLOCKER (balance bug) / 🟠 HIGH (monthly bug)
**Concern #2:** If the tracking is interrupted by anything or flawed in any way.

### Bug 2a: `totalMonthly` uses `supporterLifetime` instead of `supporterMonthly`
**File:** `backend/src/main/java/com/unis/service/EarningsService.java` line 159
```java
BigDecimal totalMonthly = referralMonthly.add(supporterLifetime);
// Should be:   .add(supporterMonthly);
```
**Impact:** An artist's "this month" earnings are falsely inflated by their entire lifetime supporter earnings. Gets worse the longer they've been on the platform.

### Bug 2b: `currentBalance` is lifetime earnings, not lifetime − past payouts
**File:** `backend/src/main/java/com/unis/service/EarningsService.java` lines 167–168
```java
BigDecimal currentBalance = totalLifetime; // Simplified — subtract past payouts in production
```
**Impact:**
- UI shows `payoutReady = true` based on inflated balance.
- User clicks "Request Payout" → backend correctly subtracts past payouts in `StripeConnectService.requestPayout()` (line 223) → throws `"Minimum payout is $50.00"` → user sees an error on a button the UI said was ready.
- Frontend progress bar math (`earnings.jsx` line 154) is wrong for anyone who has ever been paid out.

**The payout itself is safe** — the server-side check in `StripeConnectService` does subtract correctly. The bug is purely in the display/`payoutReady` flag.

### Fix
```java
// Line 159:
BigDecimal totalMonthly = referralMonthly.add(supporterMonthly);

// Line 168:
BigDecimal completedPayouts = payoutRepository.sumCompletedPayouts(userId);
BigDecimal currentBalance = totalLifetime.subtract(completedPayouts);
```

### Tests
- `earnings.summary.test.js` — asserts `totalMonthly = referralMonthly + supporterMonthly`.
- `earnings.balance.test.js` — creates fake completed payouts, asserts `currentBalance = lifetime − paidOut`.
- `earnings.payoutReady.test.js` — verifies `payoutReady` flips to `false` after a payout that drains below threshold.

---

## Finding 3 — Play Tracker Is Defined But Never Imported (30s Delay Not In Effect)

**Severity:** 🔴 BLOCKER
**Concern #3:** If the song play tracking credits the artist properly on each page. Also: is MilestonesPage missing it?

### Summary
`src/utils/playTracker.js` implements the Spotify-style 30-second-minimum play tracking. It is documented in the architecture doc. **It is imported and called from zero components.** Every page fires `POST /v1/media/song/{id}/play` immediately on click.

### Evidence
```
$ grep -rn "schedulePlayTracking\|cancelPlayTracking\|from.*playTracker" src/
./utils/playTracker.js:32:export function schedulePlayTracking(songId, userId) {
./utils/playTracker.js:69:export function cancelPlayTracking() {
```
Only self-references. Zero imports anywhere else.

### Per-page status
| Page | Play click fires `/play`? | Uses playTracker? |
|------|---------------------------|-------------------|
| `feed.jsx` | ✅ line 239 (direct `apiCall`) | ❌ |
| `songPage.jsx` | ✅ line 168 (direct `apiCall`) | ❌ |
| `artistpage.jsx` | ✅ line 141 (direct `apiCall`) | ❌ |
| `voteawards.jsx` | ✅ lines 203, 240 (direct `apiCall`) | ❌ |
| `findpage.jsx` | ✅ line 494 (direct `apiCall`) | ❌ |
| `jurisdictionPage.jsx` | ✅ lines 154, 169, 183, 198 (direct `apiCall`) | ❌ |
| `milestonesPage.jsx` | ❌ no call at all | ❌ |

### Impact
- Skipping a song after 2 seconds counts as a play.
- Plays drive leaderboard rankings AND appear in the `song_plays` table that the leaderboard SQL joins. **Inflated play counts directly skew rankings.**
- Bots / spammers clicking play 1000 times get credited 1000 plays.
- `MilestonesPage` doesn't track plays at all — silent gap.

### Fix
Replace every direct `apiCall({ url: '/v1/media/song/.../play' })` with:
```js
import { schedulePlayTracking, cancelPlayTracking } from '../utils/playTracker';

// On play click:
schedulePlayTracking(song.id, userId);

// On skip / component unmount / new song click:
cancelPlayTracking();
```
And call `cancelPlayTracking()` from `PlayerContext.next()`, `prev()`, and `clearQueue()`.

### Tests
- `playTracker.integration.test.jsx` — per-page harness that mounts each page, fires a play click, and asserts (a) no immediate network call, (b) timer scheduled, (c) call fires at 30s, (d) call cancelled on skip.
- `playTracker.unit.test.js` — pure timer semantics.

---

## Finding 4 — Award Cron Runs 7–8 Hours Early (UTC vs EST)

**Severity:** 🔴 BLOCKER
**Concern #4:** Cron might be running early in production; LastWonNotification shows winners mid-day.

### Summary
Your observation is 100% accurate. The cron runs at **UTC midnight, which is 7pm/8pm the previous day in EST.**

### Evidence
**File:** `backend/src/main/java/com/unis/service/AwardService.java`
```java
@Scheduled(cron = "0 1 0 * * ?")    // line 730 — no zone attribute
public void computeDailyAwards() {
    LocalDate yesterday = LocalDate.now().minusDays(1);   // line 735
    ...
}
```
- No `zone = "America/New_York"` attribute on `@Scheduled`.
- `LocalDate.now()` uses the JVM default timezone (UTC on Render).
- No `TZ` env var, no `application.properties` timezone config, no `user.timezone` JVM arg — verified via grep across the repo.

### Additional problem: two daily crons run in parallel
**File:** `backend/src/main/java/com/unis/service/VoteService.java` line 258
```java
@Scheduled(cron = "0 0 0 * * ?")    // VoteService version (00:00 UTC)
public void computeDailyAwards() {...}
```
**File:** `backend/src/main/java/com/unis/service/AwardService.java` line 730
```java
@Scheduled(cron = "0 1 0 * * ?")    // AwardService version (00:01 UTC)
public void computeDailyAwards() {...}
```
The `VoteService` version is annotated "kept for backwards compatibility" (line 257) but is still active — both will fire and attempt to compute awards for the same day, likely creating duplicates or FK conflicts.

### Fix
1. Add timezone to every `@Scheduled` cron in `AwardService` and `VoteService`:
   ```java
   @Scheduled(cron = "0 1 0 * * ?", zone = "America/New_York")
   ```
2. Change `LocalDate.now()` to `LocalDate.now(ZoneId.of("America/New_York"))` in both services.
3. Delete `VoteService.computeDailyAwards()` entirely (or `@Profile`-gate it off in production).
4. Optionally set `spring.jackson.time-zone=America/New_York` and/or `TZ=America/New_York` env var on Render for belt-and-suspenders safety.

### Tests
- `AwardServiceCronTest.java` (backend) — mocks the clock to 23:59:30 EST, fires the cron, asserts `award_date = today`, then advances 1 minute to 00:00:30 next day EST, fires again, asserts `award_date = yesterday`.
- `AwardCronDeduplicationTest.java` — verifies only one daily award cron is registered in the Spring context.
- `lastWonNotification.timezone.test.jsx` — frontend component test that asserts the displayed date matches `America/New_York` not browser local.

---

## Finding 5 — Cashout Flow Works End-to-End, But With UX Glitches

**Severity:** 🟠 HIGH
**Concern #5:** If the full flow of a user who has surpassed the minimum threshold can actually cash out.

### Summary
**The end-to-end flow is implemented and will work.** Stripe Connect onboarding, Transfer creation, payout record tracking are all in place. But three issues will cause user-facing problems.

### Issue 5a: Balance display wrong after first payout (tied to Finding 2b)
After the first successful payout, `currentBalance` continues to show lifetime earnings, but `StripeConnectService.requestPayout()` correctly subtracts past payouts. Users see "Ready!" → click → error.

### Issue 5b: No Stripe webhook for `account.updated`
**File:** `backend/src/main/java/com/unis/controller/StripeConnectController.java`
No endpoint handles Stripe webhooks. Onboarding completion is detected only when the user returns to `/earnings` and `getAccountStatus` fires a GET against Stripe. If they close the browser mid-flow, their `stripe_onboarding_complete` flag stays `false` until they revisit.

### Issue 5c: `frontendBaseUrl` default points to prototype URL
**File:** `StripeConnectService.java` line 41
```java
@Value("${app.frontend.url:https://unisprototypetwo.netlify.app}")
private String frontendBaseUrl;
```
If the `APP_FRONTEND_URL` env var isn't set on Render, Stripe redirects back to the prototype URL instead of `unismusic.com`. Verify it's set before launch.

### Issue 5d: `periodStart` / `periodEnd` hardcoded to "previous month"
**File:** `StripeConnectService.java` lines 238–239
```java
.periodStart(LocalDate.now().withDayOfMonth(1).minusMonths(1))
.periodEnd(LocalDate.now().withDayOfMonth(1).minusDays(1))
```
Every payout is labeled "last month" regardless of when earnings accumulated. Cosmetic, but payout history labels will be wrong for anyone who waits 2+ months between cashouts.

### Fix
5a — Fix Finding 2b.
5b — Add `POST /api/v1/stripe/webhook` handler that listens for `account.updated` events and updates `stripe_onboarding_complete`.
5c — Verify `APP_FRONTEND_URL=https://unismusic.com` on Render before launch.
5d — Compute `periodStart` as `MAX(created_at of earliest unpaid earning)` and `periodEnd` as `LocalDate.now()`.

### Tests
- `cashout.e2e.test.jsx` — full flow with mocked Stripe API. Asserts button visibility gates, balance display, server-side rejection path.
- `cashout.webhook.test.java` — (backend) when webhook added, assert account flag flips.

---

## Finding 6 — WinnersNotification Pulls From Leaderboards, Not Awards

**Severity:** 🟠 HIGH
**Concern #6:** WinnersNotification might be announcing slightly inaccurate information.

### Summary
The component announces current standings as if they were finalized winners.

### Evidence
**File:** `src/winnersNotification.jsx` line 130
```js
url: `/v1/vote/leaderboards?jurisdictionId=${jurisdictionId}&genreId=${genreId}&targetType=artist&intervalId=00000000-0000-0000-0000-000000000201&limit=5`,
```
- `/vote/leaderboards` returns **live** standings (current day's running tally), not awards. If Artist A has 10 votes at noon and Artist B has 9 votes, "A" is shown as the "winner" — but B could pass A by midnight.
- `targetType=artist` is hardcoded. Song winners are never shown. The notification is half-complete.
- Fallback jurisdiction UUID `00000000-0000-0000-0000-000000000003` (line 123) does not match any real jurisdiction in `src/utils/idMappings.js`. If `user.jurisdiction.jurisdictionId` is ever undefined, the call will return nothing or 404.

### Fix
- Call `/v1/awards/past?startDate=yesterday&endDate=yesterday` to get yesterday's actual winners.
- Cycle both `targetType=artist` and `targetType=song` to show mixed winners.
- Replace the stale fallback UUID with a known-good one (e.g., `harlem` UUID from `idMappings.js`) or skip the call entirely if jurisdiction is missing.

### Tests
- `winnersNotification.dataSource.test.jsx` — asserts the component calls `/v1/awards/past`, not `/v1/vote/leaderboards`.
- `winnersNotification.fallback.test.jsx` — asserts no network call when `user.jurisdiction` is missing.
- `winnersNotification.targetType.test.jsx` — asserts it can display both artist and song winners.

---

## Finding 7 — Song & Account Deletion Will Throw FK Violations

**Severity:** 🔴 BLOCKER
**Concern #7:** Does the appropriate thing happen across the board during deletions?

### Summary
Foreign-key constraints exist on child tables (`song_plays`, `votes`, `likes`, `comments`, `playlist_tracks`, `purchases`, `blocked_songs`, `awards`), but **only one has `ON DELETE` behavior**:
```sql
-- backend/schema.sql
ADD CONSTRAINT fk_users_default_song FOREIGN KEY (default_song_id)
REFERENCES public.songs(song_id) ON DELETE SET NULL;
```
Every other FK is plain — no CASCADE, no SET NULL, no action. Deletes fail if any child row references the parent.

### Bug 7a: `DELETE /v1/media/song/{id}` is unsafe
**File:** `backend/src/main/java/com/unis/service/MediaService.java` lines 287–290
```java
@CacheEvict(value = {"songs", "artists", "trending"}, allEntries = true)
public void deleteSong(UUID songId) {
    songRepository.deleteById(songId);
}
```
Zero cleanup. If any user has played, voted for, liked, commented on, purchased, added to a playlist, or blocked this song → PostgreSQL throws FK violation → 500.

### Bug 7b: Account deletion leaves other users' references to deleted songs
**File:** `backend/src/main/java/com/unis/service/UserService.java` lines 328–380

The method cleans up the **deleter's** records (their own plays, likes, ad views, supporter rows), but when it calls `songRepository.deleteByArtistUserId(currentUserId)` at line 342, it does NOT first clean up other users' plays, votes, likes, comments, playlist_tracks, purchases, or blocked_songs that reference the to-be-deleted songs. FK violation on first other-user reference.

### Fix
Add cascade cleanup in `deleteSong` and before `deleteByArtistUserId`:
```java
// Before deleting a song, clean up all references
songPlayRepository.deleteBySongId(songId);
voteRepository.deleteByTargetIdAndTargetType(songId, "song");
likeRepository.deleteBySongId(songId);
commentRepository.deleteBySongId(songId);
playlistTrackRepository.deleteBySongId(songId);
blockedSongRepository.deleteBySongId(songId);
// Keep awards and purchases for audit/legal — but nullify song_id:
awardRepository.nullifySongReferences(songId);
purchaseRepository.markSongDeleted(songId);  // or retain FK with ON DELETE SET NULL
```
**Alternatively:** add `ON DELETE CASCADE` to the schema for activity-log tables and `ON DELETE SET NULL` for legal/audit tables. Flyway migration is a one-shot fix.

### Tests
- `MediaServiceDeleteSongTest.java` (backend) — creates song, 3 users play/vote/like it → deletes → asserts no exception and clean state.
- `UserServiceDeleteAccountTest.java` — artist with 5 songs, 10 users have played each → deletes artist account → asserts all cleanup succeeds.

---

## Finding 8 — Leaderboard Score Calculation Is Wrong (Cartesian Product Bug)

**Severity:** 🔴 BLOCKER
**Concern #8:** If leaderboards are calculating properly and logically.

### Summary
The leaderboard SQL uses `COUNT(votes) + COUNT(plays)` across a double LEFT JOIN, which produces a cartesian product. Any artist/song with both votes AND plays has their score massively inflated.

### Evidence
**File:** `backend/src/main/java/com/unis/service/VoteService.java` line 493 (artist branch) and line 558 (song branch)
```sql
SELECT u.user_id, u.username,
       COALESCE(COUNT(v.vote_id), 0) + COALESCE(COUNT(sp.play_id), 0) as score,
       u.photo_url
FROM users u
LEFT JOIN votes v ON v.target_id = u.user_id AND ...
LEFT JOIN song_plays sp ON sp.song_id IN (SELECT s.song_id FROM songs s WHERE s.artist_id = u.user_id) AND ...
GROUP BY u.user_id, u.username, u.photo_url
```

Math breakdown: Artist with 3 votes and 10 plays → LEFT JOIN produces 3 × 10 = 30 rows → `COUNT(v.vote_id) = 30`, `COUNT(sp.play_id) = 30` → score = 60. Expected: 13.

This affects **any** artist/song that has both votes and plays. Artists with only votes OR only plays are counted correctly (one side of the cartesian is empty, multiplier is effectively 1).

### Impact
- Leaderboards favor artists with mixed activity over artists with only votes or only plays.
- `/v1/vote/leaderboards` cached for 1 minute — wrong score persists per-request-combo.
- `AwardService.computeAwardsInternal` likely uses a similar query pattern (didn't trace all branches) — awards may be wrong too.

### Fix
Use `COUNT(DISTINCT v.vote_id) + COUNT(DISTINCT sp.play_id)` to eliminate the cartesian, OR restructure with subqueries:
```sql
SELECT u.user_id, u.username,
       COALESCE(v.vote_count, 0) + COALESCE(sp.play_count, 0) as score,
       u.photo_url
FROM users u
LEFT JOIN (
  SELECT target_id, COUNT(*) as vote_count
  FROM votes
  WHERE target_type = 'artist' AND ...
  GROUP BY target_id
) v ON v.target_id = u.user_id
LEFT JOIN (
  SELECT s.artist_id, COUNT(*) as play_count
  FROM song_plays sp
  JOIN songs s ON sp.song_id = s.song_id
  WHERE DATE(sp.played_at) BETWEEN :startDate AND :endDate
  GROUP BY s.artist_id
) sp ON sp.artist_id = u.user_id
...
```

### Tests
- `VoteServiceLeaderboardTest.java` (backend) — seed 3 artists: A (5 votes, 0 plays), B (0 votes, 10 plays), C (3 votes, 4 plays). Assert ranking: B (10), A (5), C (7). Current code will rank C wrongly as 12.

---

## Finding 9 — Purchase Revenue Is Orphaned (Never Reaches Payouts)

**Severity:** 🔴 BLOCKER
**Concern #9:** If a song priced at $1.99+ is sold, is that revenue separate from AdSense, and cashoutable within 2 business days?

### Summary
You were half right. `Purchase` IS tracked separately from `AdView` — good. But Purchase revenue **never flows into `getEarningsSummary()` or `requestPayout()`**. Artists can sell songs, but have no way to see or withdraw the money.

### Evidence
- `backend/src/main/java/com/unis/entity/Purchase.java` exists with `amount` (cents), `platformFee` (cents), `artistId`.
- `PurchaseRepository` exists.
- **`EarningsService` never references `Purchase` or `PurchaseRepository`** (verified via grep).
- **`StripeConnectService.requestPayout()` balance calc uses `earningsService.getEarningsSummary()`** (line 220) — which knows nothing about purchases.

### Current state
| Component | Status |
|-----------|--------|
| Purchase entity exists | ✅ |
| DownloadService handles paid downloads | ✅ |
| Platform fee calculated | ✅ |
| `amount - platformFee` surfaces in earnings summary | ❌ NOT IMPLEMENTED |
| `amount - platformFee` added to `currentBalance` | ❌ NOT IMPLEMENTED |
| `amount - platformFee` cashoutable via Stripe | ❌ NOT IMPLEMENTED |

### Cashout timing
Once wired in, Stripe Transfers are near-instant to the connected account's Stripe balance. Stripe Express auto-payouts to bank default to a 2-day rolling schedule for the US. So "2 business days" *is* the natural outcome — **but only after the money is actually surfaced in the payout path.**

### Fix
```java
// In EarningsService.getEarningsSummary():

BigDecimal purchaseLifetime = safeSum(
    purchaseRepository.sumArtistRevenue(userId, "completed")
);
BigDecimal purchaseMonthly = safeSum(
    purchaseRepository.sumArtistRevenueSince(userId, monthStart, "completed")
);

BigDecimal totalLifetime = referralLifetime
    .add(supporterLifetime)
    .add(purchaseLifetime);
BigDecimal totalMonthly = referralMonthly
    .add(supporterMonthly)   // fix from Finding 2a
    .add(purchaseMonthly);

// ... and expose purchaseLifetime/purchaseMonthly in the summary map
summary.put("purchaseEarnings", Map.of(
    "lifetime", purchaseLifetime.setScale(2, RoundingMode.HALF_UP),
    "thisMonth", purchaseMonthly.setScale(2, RoundingMode.HALF_UP)
));
```
Note: `amount - platformFee` is the artist's take. Verify the `amount` field represents the full charge vs artist portion — rename if needed.

### Tests
- `PurchaseEarningsTest.java` (backend) — create completed purchase for artist → assert it surfaces in `getEarningsSummary()`.
- `PurchasePayoutTest.java` — artist with only purchase revenue (no ad views) crosses $50 → `requestPayout()` succeeds.

---

## Summary Table

| # | Concern | Finding | Severity | Test Coverage |
|---|---------|---------|----------|----------|
| 1 | Ad tracking coverage | Pages missing `track-view` calls | 🟠 HIGH | `earnings.tracking.test.jsx` |
| 2 | Earnings math bugs | `totalMonthly` typo + balance doesn't subtract payouts | 🔴 BLOCKER | `earnings.summary.test.js` |
| 3 | Play tracking | `playTracker.js` imported nowhere; MilestonesPage missing | 🔴 BLOCKER | `playTracker.integration.test.jsx` |
| 4 | Cron timezone | UTC cron fires EST 7pm; duplicate daily cron | 🔴 BLOCKER | `AwardServiceCronTest.java` |
| 5 | Cashout flow | Works, but UX gaps around stale balance + webhook | 🟠 HIGH | `cashout.e2e.test.jsx` |
| 6 | WinnersNotification | Reads live standings, not awards | 🟠 HIGH | `winnersNotification.dataSource.test.jsx` |
| 7 | Deletion cascade | Song + user delete will throw FK violations | 🔴 BLOCKER | `MediaServiceDeleteSongTest.java` |
| 8 | Leaderboards | Cartesian product inflates scores | 🔴 BLOCKER | `VoteServiceLeaderboardTest.java` |
| 9 | Paid downloads | Revenue orphaned from payout flow | 🔴 BLOCKER | `PurchaseEarningsTest.java` |

**Total blockers:** 6. **Recommended launch-readiness order:**
1. Fix 3 (play tracker) — breaks everything downstream.
2. Fix 8 (leaderboards) + Fix 4 (cron TZ) — together they determine who wins awards.
3. Fix 7 (deletion cascade) — one user deletion in prod will throw a 500.
4. Fix 2 + Fix 9 (earnings math + paid downloads) — money correctness.
5. Fix 1 + Fix 5 + Fix 6 — HIGH-severity UX and coverage gaps.

Tests are written in the test suite that accompanies this document. They are currently written to match the **expected correct behavior** — meaning they will fail against the current codebase and pass once each fix is applied. This turns the test suite into verifiable regression protection.
