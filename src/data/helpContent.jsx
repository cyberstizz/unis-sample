import React from 'react';

// ════════════════════════════════════════════════════════════════════════════
// HELP CENTER CONTENT
//
// One entry per Unis system. Sections are filled in as each system is audited
// against the live implementation, so a section marked `status: 'draft'` is
// deliberately not shown to users yet — it renders as "Coming soon" instead.
//
// Rules for editing this file:
//   1. Nothing here describes intended behaviour. Every sentence must be true
//      of the code that is actually deployed. If the code changes, this file
//      changes in the same PR.
//   2. Numbers that appear in more than one place (points, weights) live in
//      the exported constants below, never inline in prose, so the help page
//      and the app can never quote different figures.
//   3. Write from the listener's side of the screen. No entity names, no
//      endpoint names, no internal vocabulary.
// ════════════════════════════════════════════════════════════════════════════

// ── Shared figures ──────────────────────────────────────────────────────────
// These must match the backend. Cross-references are noted so a future change
// has one obvious checklist.
//
//   VOTE_POINTS      → ScoreUpdateService.onVote (voter increment)
//   INTERVAL_WEIGHTS → AwardService.VOTE_WEIGHTS
//   AWARD_PRIZE      → AwardService.AWARD_POINTS

export const VOTE_POINTS = 2;

export const INTERVAL_WEIGHTS = [
  { key: 'daily', label: 'Daily', weight: 10, prize: 50, cadence: 'Every day', window: 'Midnight to midnight' },
  { key: 'weekly', label: 'Weekly', weight: 20, prize: 100, cadence: 'Every week', window: 'Monday through Sunday' },
  { key: 'monthly', label: 'Monthly', weight: 25, prize: 250, cadence: 'Every month', window: 'The 1st to the last day' },
  { key: 'quarterly', label: 'Quarterly', weight: 60, prize: 500, cadence: 'Every three months', window: 'Jan–Mar, Apr–Jun, Jul–Sep, Oct–Dec' },
  { key: 'midterm', label: 'Midterm', weight: 200, prize: 2500, cadence: 'Every six months', window: 'Jan–Jun, Jul–Dec' },
  { key: 'annual', label: 'Annual', weight: 250, prize: 5000, cadence: 'Every year', window: 'Jan 1 to Dec 31' },
];

// ── The interval ladder ─────────────────────────────────────────────────────
// Signature element of the voting section. It is not decoration: the bar
// length is the real award weight, so a reader can see at a glance why an
// annual vote is worth chasing and a daily vote is worth casting often.

const IntervalLadder = () => {
  const max = Math.max(...INTERVAL_WEIGHTS.map((i) => i.weight));
  return (
    <div className="help-ladder" role="table" aria-label="Vote weight by interval">
      <div className="help-ladder__head" role="row">
        <span role="columnheader">Interval</span>
        <span role="columnheader">You can vote</span>
        <span role="columnheader">Weight</span>
      </div>
      {INTERVAL_WEIGHTS.map((i) => (
        <div className="help-ladder__row" role="row" key={i.key}>
          <span className="help-ladder__name" role="cell">{i.label}</span>
          <span className="help-ladder__cadence" role="cell">{i.cadence}</span>
          <span className="help-ladder__bar" role="cell">
            <span
              className="help-ladder__fill"
              style={{ width: `${(i.weight / max) * 100}%` }}
            />
            <b>{i.weight}</b>
          </span>
        </div>
      ))}
    </div>
  );
};

// ── The jurisdiction ladder ─────────────────────────────────────────────────

const JurisdictionLadder = () => (
  <div className="help-juris">
    <div className="help-juris__row help-juris__row--site">
      <span className="help-juris__tier">Unis</span>
      <span className="help-juris__note">Everyone can vote here</span>
    </div>
    <div className="help-juris__row">
      <span className="help-juris__tier">State</span>
      <span className="help-juris__note">If your home is inside it</span>
    </div>
    <div className="help-juris__row">
      <span className="help-juris__tier">City / metro</span>
      <span className="help-juris__note">If your home is inside it</span>
    </div>
    <div className="help-juris__row help-juris__row--home">
      <span className="help-juris__tier">Your neighborhood</span>
      <span className="help-juris__note">Your home jurisdiction</span>
    </div>
  </div>
);

// ── The tiebreaker cascade ──────────────────────────────────────────────────
// Numbered deliberately: this genuinely is an ordered sequence, and the order
// is the whole rule. Each step is only reached if the one above it is tied.

const CASCADE = [
  {
    n: 1,
    title: 'Weighted votes',
    body: 'Every vote received during the period, each counted at the weight of the interval it was cast for.',
  },
  {
    n: 2,
    title: 'Plays',
    body: 'How many times the song was played during the period. For an artist, every play across all of their songs.',
  },
  {
    n: 3,
    title: 'Likes',
    body: 'Likes received during the period.',
  },
  {
    n: 4,
    title: 'Score',
    body: 'Lifetime points on Unis — the number that sets your level.',
  },
  {
    n: 5,
    title: 'Seniority',
    body: 'Whoever has been on Unis longest wins. This step can never tie, so every award always has exactly one winner.',
  },
];

const TiebreakerCascade = () => (
  <ol className="help-cascade">
    {CASCADE.map((s) => (
      <li className="help-cascade__step" key={s.n}>
        <span className="help-cascade__n">{s.n}</span>
        <span className="help-cascade__body">
          <b>{s.title}</b>
          <span>{s.body}</span>
        </span>
      </li>
    ))}
  </ol>
);

const PrizeTable = () => (
  <div className="help-ladder" role="table" aria-label="Award periods and prizes">
    <div className="help-ladder__head help-ladder__head--wide" role="row">
      <span role="columnheader">Award</span>
      <span role="columnheader">Period</span>
      <span role="columnheader">Points</span>
    </div>
    {INTERVAL_WEIGHTS.map((i) => (
      <div className="help-ladder__row help-ladder__row--wide" role="row" key={i.key}>
        <span className="help-ladder__name" role="cell">{i.label}</span>
        <span className="help-ladder__cadence" role="cell">{i.window}</span>
        <span className="help-ladder__prize" role="cell">
          +{i.prize.toLocaleString()}
        </span>
      </div>
    ))}
  </div>
);

// ── Revenue split ───────────────────────────────────────────────────────────
// Mirrors EarningsService.SUPPORTER_RATE / LEVEL1_RATE / LEVEL2_RATE /
// LEVEL3_RATE and the DISPLAY_AD_SPLIT array in earnings.jsx. Three copies of
// these numbers now exist; they must be changed together.

export const DISPLAY_AD_SPLIT = [
  { key: 'unis', label: 'Unis', pct: 68, note: 'Runs the platform' },
  { key: 'artist', label: 'Your artist', pct: 15, note: 'The artist you support' },
  { key: 'level1', label: 'Who invited you', pct: 10, note: 'Your referrer' },
  { key: 'level2', label: 'Who invited them', pct: 5, note: 'One step further back' },
  { key: 'level3', label: 'One more back', pct: 2, note: 'Three steps from you' },
];

const RevenueSplit = () => (
  <div className="help-ladder" role="table" aria-label="How ad revenue is divided">
    <div className="help-ladder__head" role="row">
      <span role="columnheader">Goes to</span>
      <span role="columnheader">Who that is</span>
      <span role="columnheader">Share</span>
    </div>
    {DISPLAY_AD_SPLIT.map((s) => (
      <div className="help-ladder__row" role="row" key={s.key}>
        <span className="help-ladder__name" role="cell">{s.label}</span>
        <span className="help-ladder__cadence" role="cell">{s.note}</span>
        <span className="help-ladder__bar" role="cell">
          <span className="help-ladder__fill" style={{ width: `${s.pct}%` }} />
          <b>{s.pct}%</b>
        </span>
      </div>
    ))}
  </div>
);

// ════════════════════════════════════════════════════════════════════════════

export const HELP_SECTIONS = [
  {
    id: 'voting',
    title: 'Voting',
    blurb: 'How votes work, where you can cast them, and what each one counts for.',
    status: 'published',
    articles: [
      {
        id: 'voting-basics',
        q: 'How often can I vote?',
        a: (
          <>
            <p>
              Once per interval, in each place you can vote, for each category.
              A category is a genre paired with what you are voting for — a song
              or an artist.
            </p>
            <p>
              The six intervals run on their own clocks. Voting in the daily
              race does not use up your weekly vote, and voting for a rap song
              does not use up your vote for a rap artist.
            </p>
            <IntervalLadder />
            <p className="help-note">
              Longer intervals carry more weight when a winner is decided. An
              annual vote counts for 250 toward that year&rsquo;s award; a daily
              vote counts for 10 toward that day&rsquo;s.
            </p>
          </>
        ),
      },
      {
        id: 'voting-where',
        q: 'Where can I vote?',
        a: (
          <>
            <p>
              In your home jurisdiction, and in every jurisdiction that contains
              it — your city, your state, and Unis itself. You cannot vote in a
              neighborhood you are not part of.
            </p>
            <JurisdictionLadder />
            <p>
              Unis is the sitewide jurisdiction and sits above everything, so it
              is always open to you. If a local race is closed or has no
              nominees, you can always back an artist at the Unis level instead.
            </p>
            <p className="help-note">
              Your home jurisdiction is set from your location when you create
              your account. Some jurisdictions do not have voting turned on
              yet — those will not appear as an option.
            </p>
          </>
        ),
      },
      {
        id: 'voting-final',
        q: 'Can I change or take back a vote?',
        a: (
          <>
            <p>
              No. A vote is final for the interval you cast it in. Once you back
              a song for the day, the daily slot for that genre in that
              jurisdiction is spent — you cannot switch to a different song, and
              you cannot undo it.
            </p>
            <p>
              This is deliberate. If votes could be moved, a race could be
              swung in the last minute by people watching the standings, and
              the leaderboard would stop meaning anything until the moment it
              closed.
            </p>
          </>
        ),
      },
      {
        id: 'voting-points',
        q: 'Do I earn points for voting?',
        a: (
          <>
            <p>
              Yes. Casting a vote adds <b>{VOTE_POINTS} points</b> to your
              score. The artist or song you back gains points too, which is
              separate from the vote itself and counts toward their standing.
            </p>
            <p>
              Points are not the same thing as votes. Points build your own
              level on Unis over time; votes decide who wins an award. A vote
              does both at once.
            </p>
          </>
        ),
      },
      {
        id: 'voting-requirements',
        q: 'Why is my vote being refused?',
        a: (
          <>
            <p>There are five reasons a vote will not go through:</p>
            <ul>
              <li>
                <b>Your phone is not verified.</b> Voting requires a verified
                phone number. You can add one in Settings.
              </li>
              <li>
                <b>You already voted in this category.</b> One vote per
                interval, per genre, per song-or-artist, per jurisdiction.
              </li>
              <li>
                <b>You are not part of that jurisdiction.</b> You can only vote
                in your home jurisdiction and the ones above it.
              </li>
              <li>
                <b>Voting is not enabled there yet.</b> Some jurisdictions are
                still opening up.
              </li>
              <li>
                <b>You are browsing as a guest.</b> Sign in to vote.
              </li>
            </ul>
            <p className="help-note">
              Every refusal tells you which of these it was. If a vote fails
              with anything else, it was not counted and you can try again.
            </p>
          </>
        ),
      },
      {
        id: 'voting-day',
        q: 'When does the day roll over?',
        a: (
          <>
            <p>
              Midnight Eastern time, everywhere. Unis stamps every vote in New
              York time regardless of where you are, so the daily race opens and
              closes at the same instant for every listener.
            </p>
            <p>
              If you are on the west coast, that means the day rolls over at
              9:00 PM your time. If you are outside the US, it rolls over on
              your clock at whatever 12:00 AM in New York works out to.
            </p>
          </>
        ),
      },
    ],
  },

  // ── Awaiting audit ────────────────────────────────────────────────────────
  // Each of these becomes `status: 'published'` with real articles once its
  // system has been walked end to end.
  {
    id: 'awards',
    title: 'Awards',
    blurb: 'How a winner is decided, when results post, and what winning is worth.',
    status: 'published',
    articles: [
      {
        id: 'awards-what',
        q: 'What counts as one award?',
        a: (
          <>
            <p>
              An award is one genre, one kind of nominee, one jurisdiction, one
              period. <b>Rap Song of the Day in Harlem</b> is a different award
              from Rap Artist of the Day in Harlem, from Rock Song of the Day in
              Harlem, and from Rap Song of the Day in New York.
            </p>
            <p>
              Every one of those has exactly one winner. Not a top three, not a
              tie — one.
            </p>
          </>
        ),
      },
      {
        id: 'awards-winner',
        q: 'How is the winner decided?',
        a: (
          <>
            <p>
              By weighted votes first. If two nominees are level on that, Unis
              works down a fixed order of tiebreakers until one of them is
              ahead.
            </p>
            <TiebreakerCascade />
            <p className="help-note">
              Every award records which step decided it. If a race came down to
              plays rather than votes, that is part of the permanent record of
              the win.
            </p>
          </>
        ),
      },
      {
        id: 'awards-weight',
        q: 'Why is one vote worth more than another?',
        a: (
          <>
            <p>
              Because of what it costs you. A daily vote is one of many you will
              cast this year. An annual vote is the only one you get — so it
              carries far more weight when a winner is decided.
            </p>
            <IntervalLadder />
            <p>
              Every vote cast during a period counts toward that period&rsquo;s
              award, at the weight of the interval it was cast for. So a single
              annual vote is worth 25 daily votes, and an artist who wins one
              committed supporter has gained more than one who picked up a
              handful of casual taps.
            </p>
          </>
        ),
      },
      {
        id: 'awards-where',
        q: 'Can an artist win in more than one place?',
        a: (
          <>
            <p>
              Yes — upward. An artist based in a neighborhood competes for that
              neighborhood&rsquo;s award, and for the award of every jurisdiction
              above it, all the way to Unis.
            </p>
            <p>
              It does not work sideways or downward. An artist can only win in
              their own jurisdiction and the ones that contain it, so a Harlem
              artist is never in the running for a Brooklyn award.
            </p>
            <p className="help-note">
              This is why local wins matter. A neighborhood award is a much
              smaller field than a sitewide one, and it is the field you are
              actually from.
            </p>
          </>
        ),
      },
      {
        id: 'awards-when',
        q: 'When are winners announced?',
        a: (
          <>
            <p>
              At <b>12:01 AM Eastern</b>, one minute after the period closes.
              Daily awards post every night, weekly awards early Monday, monthly
              awards on the 1st, and so on.
            </p>
            <PrizeTable />
            <p>
              A period is only settled once it has fully elapsed. While a period
              is still running you can watch the standings, but nothing is final
              and the leader can change until the moment it closes.
            </p>
          </>
        ),
      },
      {
        id: 'awards-noone',
        q: 'What if nobody voted?',
        a: (
          <>
            <p>
              The award is still given. If no votes were cast in a category, Unis
              picks the winner from the same list, starting at the next
              step — plays, then likes, then score, then seniority.
            </p>
            <p>
              Quiet categories still crown someone, which means a new
              jurisdiction has a real winner from its first day instead of an
              empty page.
            </p>
          </>
        ),
      },
      {
        id: 'awards-worth',
        q: 'What does winning get me?',
        a: (
          <>
            <p>
              Points, permanently. An award adds to your score the moment it is
              decided — <b>50</b> for a daily win up to <b>5,000</b> for an
              annual one. Those points count toward your level like any others,
              and they never expire.
            </p>
            <p>
              The win itself is permanent too. It goes on your profile and into
              your jurisdiction&rsquo;s record of past winners, and it stays
              there.
            </p>
          </>
        ),
      },
    ],
  },
  {
    id: 'ranking',
    title: 'Rankings',
    blurb: 'What your rank means and how often it moves.',
    status: 'published',
    articles: [
      {
        id: 'ranking-what',
        q: 'What is my rank?',
        a: (
          <>
            <p>
              Where you stand against every other artist in your jurisdiction
              right now, for a given period. It is worked out the same way an
              award winner is — weighted votes first, then plays, likes, score,
              and seniority — so your rank is a live preview of who would win if
              the period closed today.
            </p>
            <p>
              You get two ranks in each place: one against every artist there,
              and one against only the artists in your genre.
            </p>
          </>
        ),
      },
      {
        id: 'ranking-when',
        q: 'How often does my rank update?',
        a: (
          <>
            <p>
              Once a night. Unis recalculates every rank after midnight Eastern
              and swaps the new standings in all at once, so you never catch the
              board mid-calculation.
            </p>
            <p>
              Each rank is measured against the last <b>complete</b> day. That
              is why today&rsquo;s activity does not move your rank until
              tomorrow — a half-finished day would make the number jump around
              for reasons nobody could act on.
            </p>
          </>
        ),
      },
      {
        id: 'ranking-periods',
        q: 'Why do I have more than one rank?',
        a: (
          <>
            <p>
              Because different periods tell you different things. Unis keeps a
              rank for the day, the week, the month, the quarter, the year, and
              for all time.
            </p>
            <p>
              A strong week and a weak year usually means you are climbing. The
              reverse usually means an older release is carrying you. Both are
              worth knowing, so neither one is hidden.
            </p>
          </>
        ),
      },
      {
        id: 'ranking-vs-award',
        q: 'Is my rank the same as an award?',
        a: (
          <>
            <p>
              No. A rank is where you stand while a period is still running. An
              award is what gets recorded when it closes. Ranks move every
              night; awards are permanent.
            </p>
            <p>
              Being ranked first for the week does not guarantee the weekly
              award. Nothing is settled until the period ends.
            </p>
          </>
        ),
      },
    ],
  },
  { id: 'points', title: 'Points and levels', blurb: 'What earns points and how levels work.', status: 'draft', articles: [] },
  {
    id: 'plays',
    title: 'Play counts',
    blurb: 'What counts as a play and why the same song stops counting.',
    status: 'published',
    articles: [
      {
        id: 'plays-what',
        q: 'What happens when I play a song?',
        a: (
          <>
            <p>
              Three things at once. You earn a point, the song earns a point,
              and the artist earns a point. One play, three ledgers.
            </p>
            <p>
              This is why listening is not a passive act on Unis. Every play you
              choose is a small amount of standing you are handing to an artist,
              and a small amount you are building for yourself.
            </p>
          </>
        ),
      },
      {
        id: 'plays-repeat',
        q: 'Why did playing that song again not count?',
        a: (
          <>
            <p>
              The same song only counts once every <b>30 minutes</b> for the
              same listener. Play it on repeat and the second play through does
              nothing — no point for you, none for the song, none for the
              artist.
            </p>
            <p>
              There is no limit on how many <em>different</em> songs you play.
              Listening widely keeps earning; looping one track does not. That
              is the point of the rule — a play should mean somebody chose to
              listen, not that a tab was left open.
            </p>
          </>
        ),
      },
      {
        id: 'plays-queue',
        q: 'Do plays from a playlist or my queue count?',
        a: (
          <>
            <p>
              Yes. A play is a play wherever it comes from — a playlist, your
              queue, an artist page, or search. The 30-minute rule still applies
              to each song individually, so a playlist with the same track twice
              only counts it once.
            </p>
          </>
        ),
      },
      {
        id: 'plays-points',
        q: 'What are the points actually for?',
        a: (
          <>
            <p>
              They set your level, and your level is how Unis will decide access
              to live events and giveaways as those roll out. Points are the
              record of showing up.
            </p>
            <p>
              Artists and listeners both earn them, but artists have far more
              ways to — their songs earn on every play, every like, and every
              vote, on top of whatever they earn as listeners themselves.
            </p>
          </>
        ),
      },
    ],
  },
  {
    id: 'queue',
    title: 'Queue',
    blurb: 'What plays next, shuffling, repeating, and saving a queue.',
    status: 'published',
    articles: [
      {
        id: 'queue-add',
        q: 'What happens when I tap a song?',
        a: (
          <>
            <p>
              If nothing is playing, it starts. If something is already playing,
              Unis asks what you meant: <b>Play now</b> interrupts and starts the
              track immediately, <b>Add to queue</b> puts it at the end to play
              after everything already lined up.
            </p>
            <p>
              You are never guessing which one you got, and a tap never silently
              wipes out a queue you spent time building.
            </p>
          </>
        ),
      },
      {
        id: 'queue-shuffle',
        q: 'How does shuffle work?',
        a: (
          <>
            <p>
              It genuinely randomizes. Unis uses a true shuffle — every ordering
              of your queue is equally likely, with no weighting toward
              particular artists or songs.
            </p>
            <p>
              The track you are currently playing stays where it is and moves to
              the front; everything else is reordered behind it. Turning shuffle
              off restores your original order and keeps your place in it.
            </p>
          </>
        ),
      },
      {
        id: 'queue-repeat',
        q: 'Can I repeat a song or the whole queue?',
        a: (
          <>
            <p>
              Both. The repeat control cycles through three states: off, repeat
              the whole queue when it reaches the end, and repeat the current
              track.
            </p>
            <p className="help-note">
              Repeating one track will not keep earning points for it. The
              30-minute rule in Play counts still applies.
            </p>
          </>
        ),
      },
      {
        id: 'queue-manage',
        q: 'Can I edit my queue or keep it?',
        a: (
          <>
            <p>
              You can remove any track from the queue without stopping playback,
              and you can save the whole queue as a playlist in one step. A good
              listening session does not have to be rebuilt from memory later.
            </p>
          </>
        ),
      },
      {
        id: 'queue-video',
        q: 'What happens to my queue when I watch a video?',
        a: (
          <>
            <p>
              Nothing. Starting a video pauses the music so the two are not
              playing over each other, but your queue is held exactly as it
              was — same tracks, same order, same position. Close the video and
              press play, and you pick up where you left off.
            </p>
          </>
        ),
      },
    ],
  },
  { id: 'playlists', title: 'Playlists', blurb: 'Personal, community, and official playlists.', status: 'draft', articles: [] },
  { id: 'verification', title: 'Verification', blurb: 'Phone and email verification, and what they unlock.', status: 'draft', articles: [] },
  { id: 'follow', title: 'Following', blurb: 'Following artists and listeners.', status: 'draft', articles: [] },
  { id: 'likes', title: 'Likes', blurb: 'What liking a song does.', status: 'draft', articles: [] },
  { id: 'messaging', title: 'Messages', blurb: 'Direct messages and artist broadcasts.', status: 'draft', articles: [] },
  { id: 'comments', title: 'Comments', blurb: 'Commenting, editing, and moderation.', status: 'draft', articles: [] },
  { id: 'jurisdiction', title: 'Jurisdictions', blurb: 'How Unis divides the map.', status: 'draft', articles: [] },
  { id: 'referrals', title: 'Referrals', blurb: 'Referral codes and the three referral levels.', status: 'draft', articles: [] },
  { id: 'supporter', title: 'Supporting an artist', blurb: 'Picking an artist to support and switching later.', status: 'draft', articles: [] },
  {
    id: 'payouts',
    title: 'Earnings and payouts',
    blurb: 'Where the money comes from, who it goes to, and how you get paid.',
    status: 'published',
    articles: [
      {
        id: 'payouts-source',
        q: 'Where does the money come from?',
        a: (
          <>
            <p>
              Advertisers. When you are signed in and an ad appears on Unis, that
              view earns real money — and Unis splits it out immediately, to a
              fixed formula, every single time.
            </p>
            <p>
              You have to be signed in for a view to earn anything. Browsing
              signed out costs the artist you support real income.
            </p>
          </>
        ),
      },
      {
        id: 'payouts-split',
        q: 'Who gets paid when I see an ad?',
        a: (
          <>
            <p>
              Two people, neither of them you: the artist you support, and
              whoever invited you to Unis.
            </p>
            <RevenueSplit />
            <p>
              You cannot earn from your own viewing. That is deliberate — it
              removes any reason to farm your own ad views, and it means the
              money moves outward through the community instead of in a circle.
            </p>
          </>
        ),
      },
      {
        id: 'payouts-artist',
        q: 'What is a supported artist?',
        a: (
          <>
            <p>
              The artist who earns from your listening. You choose one when you
              sign up, and you always have one — this is the mechanism that keeps
              money circulating locally instead of pooling at the top.
            </p>
            <p>
              You can switch whenever you like, but the change takes effect at
              the end of the pay period, not immediately. That protects the
              artist you were supporting from losing income they had already
              earned.
            </p>
            <p className="help-note">
              If your supported artist leaves Unis, you will be asked to pick a
              new one. Some share of your ad revenue always goes to an artist.
            </p>
          </>
        ),
      },
      {
        id: 'payouts-referrer',
        q: 'What if the person who invited me leaves?',
        a: (
          <>
            <p>
              Their share stays with Unis. It does not transfer to anyone else
              and it is not redistributed — the referral chain simply stops
              there.
            </p>
            <p>
              Your supported artist keeps earning either way. That part of the
              split is never affected by what happens to your referrer.
            </p>
          </>
        ),
      },
      {
        id: 'payouts-getting-paid',
        q: 'How do I actually get paid?',
        a: (
          <>
            <p>
              Through Stripe. Connect a Stripe account from the Earnings page,
              and once your balance reaches <b>$50</b> you can request a payout.
              Below that it keeps accruing.
            </p>
            <p>
              You will need a verified phone number for earnings to be
              attributed to you at all, so add one before you start building a
              balance.
            </p>
          </>
        ),
      },
    ],
  },
];

export default HELP_SECTIONS;