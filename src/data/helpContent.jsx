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
//   VOTE_POINTS                 → ScoreUpdateService.onVote (voter increment)
//   INTERVAL_WEIGHTS            → AwardService.VOTE_WEIGHTS
//   AWARD_PRIZE                 → AwardService.AWARD_POINTS
//   MESSAGE_REQUEST_DAILY_LIMIT → MessagingService.MAX_NEW_REQUESTS_PER_DAY
//   COMMENTS_PER_TRACK          → CommentService.MAX_COMMENTS_PER_USER_PER_SONG
//   COMMENT_MAX_LENGTH          → CommentService.MAX_COMMENT_LENGTH

export const VOTE_POINTS = 2;

export const MESSAGE_REQUEST_DAILY_LIMIT = 15;

export const COMMENTS_PER_TRACK = 3;

export const COMMENT_MAX_LENGTH = 2000;

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

// ── The message lanes ───────────────────────────────────────────────────────
// Signature element of the messaging section, and the same trick as the
// interval ladder: it is not an illustration of the rule, it IS the rule. A
// reader should be able to place themselves in one of these five rows without
// reading the prose around it.
//
// Requires the .help-lanes block appended to helpPage.scss.

const LANE_ROWS = [
  { who: 'People you follow', lane: 'inbox', note: 'Straight to your messages' },
  { who: 'People who support you', lane: 'inbox', note: 'If you left that switch on' },
  { who: 'Anyone you messaged first', lane: 'inbox', note: 'Always, from then on' },
  { who: 'Everyone else', lane: 'requests', note: 'One message, waiting for you' },
  { who: 'People you blocked', lane: 'none', note: 'Cannot reach you at all' },
];

const MessageLanes = () => (
  <div className="help-lanes" role="table" aria-label="Where a message lands">
    <div className="help-lanes__head" role="row">
      <span role="columnheader">Who is writing</span>
      <span role="columnheader">Where it lands</span>
    </div>
    {LANE_ROWS.map((r) => (
      <div className={`help-lanes__row help-lanes__row--${r.lane}`} role="row" key={r.who}>
        <span className="help-lanes__who" role="cell">{r.who}</span>
        <span className="help-lanes__where" role="cell">
          <b>
            {r.lane === 'inbox' && 'Your inbox'}
            {r.lane === 'requests' && 'Requests'}
            {r.lane === 'none' && 'Nowhere'}
          </b>
          <span>{r.note}</span>
        </span>
      </div>
    ))}
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
  {
    id: 'playlists',
    title: 'Playlists',
    blurb: 'Making them, sharing them, and how they differ from your queue.',
    status: 'published',
    articles: [
      {
        id: 'playlists-vs-queue',
        q: 'What is the difference between a playlist and my queue?',
        a: (
          <>
            <p>
              A playlist is something you keep. Your queue is what you are
              listening to right now. Both hold songs and both feed the player,
              but a playlist survives the session and a queue is the session.
            </p>
            <p>
              They open one at a time — opening the playlist closes the queue,
              and opening the queue closes the playlist — so you always know
              which list you are looking at. Songs move freely between them:
              send a track from a playlist into your queue, or turn the queue
              you have built into a playlist in one step.
            </p>
          </>
        ),
      },
      {
        id: 'playlists-create',
        q: 'How do I make a playlist?',
        a: (
          <>
            <p>
              Two ways. Build one from scratch by adding songs as you find them,
              or save your current queue as a playlist once you have a run of
              tracks you want to keep.
            </p>
            <p>
              Give it a name and a cover image so it is recognizable at a
              glance, then decide whether anyone else can see it.
            </p>
          </>
        ),
      },
      {
        id: 'playlists-privacy',
        q: 'Who can see my playlist?',
        a: (
          <>
            <p>
              You choose when you create it, and you can change it later.
            </p>
            <ul>
              <li>
                <b>Private</b> — only you. Nobody can find it, open it, or see
                that it exists. This is the default.
              </li>
              <li>
                <b>Public</b> — anyone on Unis can open it. It shows up in
                search and under Playlists on the Discover page.
              </li>
            </ul>
          </>
        ),
      },
      {
        id: 'playlists-unis',
        q: 'What are Unis playlists?',
        a: (
          <>
            <p>
              Playlists put together by the platform rather than by a listener.
              They are added regularly and every user can play them.
            </p>
            <p>
              Some are curated by hand and some are built from award winners, so
              they are a fast way to hear what a jurisdiction has actually been
              voting for.
            </p>
          </>
        ),
      },
      {
        id: 'playlists-points',
        q: 'Do plays from a playlist count?',
        a: (
          <>
            <p>
              Yes, exactly the same as anywhere else. Points go to you, the song,
              and the artist, and the 30-minute rule still applies to each song
              individually — so a playlist with the same track twice only counts
              it once.
            </p>
          </>
        ),
      },
    ],
  },
  {
    id: 'verification',
    title: 'Phone verification',
    blurb: 'Why Unis asks for a number and what it unlocks.',
    status: 'published',
    articles: [
      {
        id: 'verification-why',
        q: 'Why does Unis want my phone number?',
        a: (
          <>
            <p>
              To keep bots out. Everything that decides an outcome on Unis — who
              wins an award, who gets paid — runs on the assumption that one
              account is one person. An email address takes seconds to fake. A
              phone number does not.
            </p>
            <p>
              Verifying is what separates a listener from a script. It is the
              single measure standing between a local award and someone with a
              thousand throwaway accounts.
            </p>
          </>
        ),
      },
      {
        id: 'verification-how',
        q: 'How do I verify?',
        a: (
          <>
            <p>
              From Settings. Enter your number, and Unis texts you a six-digit
              code. Type it back in and you are verified — it takes under a
              minute and you only do it once.
            </p>
            <p className="help-note">
              If the code does not arrive, check the number for a typo and
              request a new one. Codes expire, so an old text will not work.
            </p>
          </>
        ),
      },
      {
        id: 'verification-unlocks',
        q: 'What does verifying unlock?',
        a: (
          <>
            <p>Four things stay locked until you verify:</p>
            <ul>
              <li><b>Voting</b> — in every jurisdiction and every interval.</li>
              <li><b>Commenting</b> — on songs, videos, and artist pages.</li>
              <li><b>Messaging</b> — sending direct messages to other users.</li>
              <li><b>Earnings</b> — ad revenue is only attributed to verified accounts.</li>
            </ul>
            <p>
              That last one is worth reading twice. If you are an artist with
              supporters, or you referred people to Unis,{' '}
              <b>you do not earn anything until your phone is verified</b>. The
              views still happen; the money does not reach you.
            </p>
          </>
        ),
      },
      {
        id: 'verification-without',
        q: 'What can I do without verifying?',
        a: (
          <>
            <p>
              Most of Unis. You can play music, like songs, follow artists,
              build playlists, browse leaderboards, and support an artist
              without ever entering a number.
            </p>
            <p>
              Verification is not a gate on listening. It is a gate on the
              things where a fake account would do damage.
            </p>
          </>
        ),
      },
    ],
  },
  {
    id: 'follow',
    title: 'Following',
    blurb: 'Following artists and listeners, and what it changes.',
    status: 'published',
    articles: [
      {
        id: 'follow-what',
        q: 'What does following someone do?',
        a: (
          <>
            <p>
              It is how you keep track of people on Unis. Follow an artist whose
              releases you want to catch, or a listener whose taste you trust.
            </p>
            <p>
              You can follow both — artists and listeners alike. Unfollow at any
              time, from the same button.
            </p>
          </>
        ),
      },
      {
        id: 'follow-visible',
        q: 'Can people see that I followed them?',
        a: (
          <>
            <p>
              They can see the count. Follower totals are public and show on
              every profile, including to signed-out visitors — for an artist,
              it is part of how their standing reads at a glance.
            </p>
          </>
        ),
      },
      {
        // ⚠ REWRITTEN for the two-lane messaging model, and only true once the
        // new messaging backend is deployed. The previous version said
        // restricting messages limits you to "only people you follow" — true of
        // the old single-lane gate, not of this one: supporters also get
        // through, and an unrestricted account still hears from strangers, just
        // in a different place. Ships in the same PR as the `messaging` section.
        id: 'follow-messages',
        q: 'Does following change who can message me?',
        a: (
          <>
            <p>
              Yes. Following someone puts their messages in your inbox instead
              of your requests folder — it is one of the two connections Unis
              treats as knowing a person. The other is support.
            </p>
            <p>
              Note the direction: it is who <em>you</em> follow, not who follows
              you. An artist with a large following still only gives inbox
              access to the people they chose to keep track of.
            </p>
            <p>
              If you tighten your message settings to <b>people you know</b>,
              that same pair is the whole list — artists you follow and
              listeners who support you. Everyone else cannot start a
              conversation with you at all.
            </p>
          </>
        ),
      },
    ],
  },
  { id: 'likes', title: 'Likes', blurb: 'What liking a song does.', status: 'draft', articles: [] },
  {
    // ⚠ PUBLISH AFTER DEPLOY. Rule 1 of this file is that nothing describes
    // intended behaviour. Every article below is true of the new messaging
    // backend and NOT of what is running in production right now. Change
    // `status` to 'published' in the same PR that ships the migration and the
    // new MessagingService — that one word is the only edit needed.
    //
    // (Was 'publishedh' — a typo, which the page treated as a draft. Set to
    // 'draft' explicitly so the intent is unambiguous.)
    id: 'messaging',
    title: 'Messages',
    blurb: 'Who can reach you, how requests work, and messaging artists directly.',
    status: 'draft',
    articles: [
      {
        id: 'messaging-who',
        q: 'Can anyone message me?',
        a: (
          <>
            <p>
              Anyone can write to you, but not everyone reaches your inbox. Unis
              splits messages into two places, and where a message lands depends
              on whether you already have a connection to the person sending it.
            </p>
            <MessageLanes />
            <p>
              Your inbox is for people you have some link with. Requests is for
              everyone else — a holding area you check when you feel like it,
              not a queue that interrupts you.
            </p>
            <p className="help-note">
              This applies to listeners and artists equally. There is no separate
              set of rules for artists, and no request to accept before you can
              talk to someone.
            </p>
          </>
        ),
      },
      {
        id: 'messaging-requests',
        q: 'What is a message request?',
        a: (
          <>
            <p>
              The first message from someone you have no connection to. It waits
              in Requests instead of arriving in your inbox, and while it waits
              it is deliberately limited:
            </p>
            <ul>
              <li>
                <b>They can send one message.</b> Not a stream — one. They
                cannot write again until you accept.
              </li>
              <li>
                <b>Text only.</b> No tracks, no support, nothing attached. Those
                unlock after you accept.
              </li>
              <li>
                <b>You are not notified.</b> A request never rings, buzzes, or
                pushes to your phone.
              </li>
              <li>
                <b>They cannot tell you read it.</b> No <em>Seen</em> mark is
                sent from a request, ever.
              </li>
            </ul>
            <p>
              So you can open a request, read it fully, and walk away, and the
              person who sent it learns nothing at all.
            </p>
          </>
        ),
      },
      {
        id: 'messaging-accept',
        q: 'What happens when I accept or delete a request?',
        a: (
          <>
            <p>
              <b>Accept</b> moves the conversation into your inbox. From then on
              they can message you normally and send tracks and support, and you
              are talking like any other thread.
            </p>
            <p>
              <b>Delete</b> removes it. The sender is never told — no notice, no
              read mark, nothing that distinguishes a declined request from one
              you simply have not opened.
            </p>
            <p>
              <b>Block</b> deletes it and stops that account reaching you again.
            </p>
            <p className="help-note">
              Replying counts as accepting. If you just answer the message, the
              conversation moves to your inbox on its own — you never have to do
              both.
            </p>
          </>
        ),
      },
      {
        id: 'messaging-artists',
        q: 'How do I message an artist?',
        a: (
          <>
            <p>
              From their profile — the Message button opens a conversation with
              them. You can also start one from your inbox and search for them
              by name.
            </p>
            <p>
              If you follow each other, or you support them, you land in their
              inbox. Otherwise your first message waits in their requests,
              exactly like anyone else&rsquo;s.
            </p>
            <p>
              <b>Supporting an artist puts you in their inbox.</b> If you are
              putting money behind an artist, your message does not sit in a
              holding folder — it goes straight to them. Artists can turn this
              off, but it is on by default.
            </p>
          </>
        ),
      },
      {
        id: 'messaging-inside',
        q: 'What can I do inside a conversation?',
        a: (
          <>
            <p>Four things, beyond typing:</p>
            <ul>
              <li>
                <b>Share a track.</b> It arrives as a playable card with the
                song&rsquo;s current standing in its jurisdiction, so you are
                sending a place on the board, not just a link.
              </li>
              <li>
                <b>Send support.</b> Money and a note in the same message. It
                appears in the thread as its own bubble, and it counts as
                support exactly like sending it from a profile.
              </li>
              <li>
                <b>React.</b> One emoji per message. Tapping the same one again
                removes it.
              </li>
              <li>
                <b>Send a photo.</b> Once a conversation is accepted.
              </li>
            </ul>
            <p className="help-note">
              Tracks, support, and photos are not available in a request. They
              unlock once the other person accepts.
            </p>
          </>
        ),
      },
      {
        id: 'messaging-control',
        q: 'Can I control who messages me?',
        a: (
          <>
            <p>Yes, in Settings under Messages. There are three choices:</p>
            <ul>
              <li>
                <b>Everyone.</b> Anyone can write; people you do not know land
                in requests. This is the default.
              </li>
              <li>
                <b>People you know.</b> Only artists you follow and listeners
                who support you. Nobody else can start a conversation with you
                at all.
              </li>
              <li>
                <b>No one.</b> Nobody new can write to you. You can still start
                conversations yourself.
              </li>
            </ul>
            <p>
              Whatever you choose, <b>anyone you have already messaged can
              always reach you</b>. Tightening this setting never cuts off a
              conversation you are already in.
            </p>
            <p className="help-note">
              The same screen holds your active status, your read receipts, the
              spam filter, and your blocked accounts.
            </p>
          </>
        ),
      },
      {
        id: 'messaging-seen',
        q: 'Can people tell when I have read a message?',
        a: (
          <>
            <p>
              In an accepted conversation, yes — a <em>Seen</em> mark appears
              under their last message once you open it. In a request, never.
            </p>
            <p>
              You can turn read receipts off in Settings, and the same is true of
              your active status. Both are <b>mutual</b>: switch receipts off and
              you stop seeing when others have read yours; switch active status
              off and you stop seeing who is online.
            </p>
            <p>
              That is deliberate. A setting that let you watch other people while
              staying invisible yourself would not be a privacy control, it would
              be an advantage.
            </p>
          </>
        ),
      },
      {
        id: 'messaging-spam',
        q: 'What stops people from spamming me?',
        a: (
          <>
            <p>Five rules, working together:</p>
            <ul>
              <li>
                <b>A verified phone number is required to send.</b> No verified
                number, no messages — the same gate as voting.
              </li>
              <li>
                <b>Strangers get one message.</b> Nobody can pile message after
                message into your requests folder.
              </li>
              <li>
                <b>That message is text only.</b> No images or attachments can
                reach you from someone you have not accepted.
              </li>
              <li>
                <b>{MESSAGE_REQUEST_DAILY_LIMIT} new people per day.</b> One
                account can only start conversations with{' '}
                {MESSAGE_REQUEST_DAILY_LIMIT} people it does not know in a day.
                Bulk outreach hits a wall quickly.
              </li>
              <li>
                <b>Bulk and low-quality messages are filtered.</b> They go to a
                separate folder rather than your requests. You can switch this
                off.
              </li>
            </ul>
            <p>
              None of this applies to people you already know. The limits exist
              at the point of first contact, which is the only place spam comes
              from.
            </p>
          </>
        ),
      },
      {
        id: 'messaging-block',
        q: 'How do I block or report someone?',
        a: (
          <>
            <p>
              Both are in the menu at the top of any conversation, and blocking
              is also offered directly on a request.
            </p>
            <p>
              <b>Blocking</b> stops messages in both directions — they cannot
              write to you and you cannot write to them until you unblock. If
              they had a request waiting, it is deleted. Your blocked accounts
              are listed in message settings and you can undo it there.
            </p>
            <p>
              <b>Reporting</b> sends the conversation to Unis for review.
              Reporting does not block on its own, so block as well if you do
              not want to hear from them while it is looked at.
            </p>
          </>
        ),
      },
      {
        id: 'messaging-broadcast',
        q: 'Why did an artist I support message me?',
        a: (
          <>
            <p>
              Artists can send one message to everyone supporting them. It
              arrives as a normal conversation, not an announcement — you can
              reply, and your reply goes to the artist alone.
            </p>
            <p>
              Only people who support that artist receive it. Blocking an artist
              stops their broadcasts along with everything else.
            </p>
          </>
        ),
      },
      {
        id: 'messaging-cant',
        q: 'Why can I not message someone?',
        a: (
          <>
            <p>There are five reasons a message will not send:</p>
            <ul>
              <li>
                <b>Your phone is not verified.</b> Add a number in Settings.
              </li>
              <li>
                <b>They only accept messages from people they know.</b> Follow
                them or support them, and you will reach them.
              </li>
              <li>
                <b>They are not accepting new messages.</b> Their inbox is
                closed to people they have not written to.
              </li>
              <li>
                <b>One of you has blocked the other.</b>
              </li>
              <li>
                <b>You have already sent them a request.</b> Wait for it to be
                accepted rather than sending again.
              </li>
            </ul>
            <p className="help-note">
              Every refusal tells you which one it was, except a block — that one
              is deliberately vague in both directions.
            </p>
          </>
        ),
      },
    ],
  },
  {
    id: 'comments',
    title: 'Comments',
    blurb: 'Leaving them, replying, editing, and the limits that keep threads readable.',
    status: 'published',
    articles: [
      {
        id: 'comments-who',
        q: 'Who can comment?',
        a: (
          <>
            <p>
              Anyone with a verified phone number. Comments sit behind the same
              gate as voting, for the same reason — a comment section that
              anyone can fill from a script stops being worth reading within a
              week.
            </p>
            <p>
              Reading is open to everyone. You can browse every comment on Unis
              without an account at all; you just cannot add one until you
              verify.
            </p>
          </>
        ),
      },
      {
        id: 'comments-limit',
        q: 'Why can I not comment again on this song?',
        a: (
          <>
            <p>
              You get <b>{COMMENTS_PER_TRACK}</b> comments on any one song or
              video. Once you have used them, the box closes for that track.
            </p>
            <p>
              The limit exists so no single person can dominate a track&rsquo;s
              comments. Three is enough to say something real and not enough to
              take the section over.
            </p>
            <p className="help-note">
              One exception, and it matters: <b>you can always reply underneath
              your own comment</b>, even after you have used all{' '}
              {COMMENTS_PER_TRACK}. If somebody responds to you, you are never
              locked out of answering them.
            </p>
          </>
        ),
      },
      {
        id: 'comments-replies',
        q: 'Can I reply to a reply?',
        a: (
          <>
            <p>
              No. Threads go one level deep — a comment, and replies underneath
              it. Replying to a reply puts your response under the original
              comment instead.
            </p>
            <p>
              Deeply nested threads collapse into unreadable columns on a phone,
              and the conversation drifts away from the song it is supposed to
              be about. One level keeps every reply attached to the thing that
              started it.
            </p>
          </>
        ),
      },
      {
        id: 'comments-edit',
        q: 'Can I edit or delete a comment?',
        a: (
          <>
            <p>
              Both, on your own comments, at any time. There is no window that
              closes — a typo from last year is still fixable.
            </p>
            <p>
              A deleted comment disappears from the track along with its
              replies&rsquo; context. Editing keeps the comment in place and
              simply changes what it says.
            </p>
          </>
        ),
      },
      {
        id: 'comments-artist-delete',
        q: 'Can an artist delete comments on their own song?',
        a: (
          <>
            <p>
              Yes. An artist can remove any comment on their own songs and
              videos, not just their own comments.
            </p>
            <p>
              Your page is yours. An artist should not have to wait on a
              moderation queue to take something off their own release. It only
              extends to their own media — nobody can reach into someone
              else&rsquo;s comments.
            </p>
          </>
        ),
      },
      {
        id: 'comments-length',
        q: 'Is there a length limit?',
        a: (
          <>
            <p>
              {COMMENT_MAX_LENGTH.toLocaleString()} characters, which is several
              paragraphs. Long enough for a real thought about a record, short
              enough that nobody is pasting an essay into a track page.
            </p>
          </>
        ),
      },
    ],
  },
  {
    id: 'jurisdiction',
    title: 'Jurisdictions',
    blurb: 'Your place on Unis, and what it decides.',
    status: 'published',
    articles: [
      {
        id: 'jurisdiction-what',
        q: 'What is a jurisdiction?',
        a: (
          <>
            <p>
              A place, and your place on Unis. Every listener and every artist
              belongs to one — a neighborhood, not a city — and each neighborhood
              sits inside a larger one, all the way up to Unis itself.
            </p>
            <JurisdictionLadder />
            <p>
              This is the idea the rest of the platform is built on. Music is
              local before it is anything else, and a neighborhood is a real
              scene in a way that a country is not.
            </p>
          </>
        ),
      },
      {
        id: 'jurisdiction-mine',
        q: 'How is my jurisdiction decided?',
        a: (
          <>
            <p>
              From the address you give when you create your account. Unis finds
              the most specific neighborhood that contains it — not the city, not
              the state, the smallest place you actually belong to.
            </p>
            <p className="help-note">
              You can see yours at the top of the sidebar at any time. Tapping it
              opens your jurisdiction&rsquo;s page.
            </p>
          </>
        ),
      },
      {
        id: 'jurisdiction-does',
        q: 'What does my jurisdiction decide?',
        a: (
          <>
            <p>Four things, and they are the four that matter most:</p>
            <ul>
              <li>
                <b>Where you can vote.</b> Your own neighborhood, and every
                jurisdiction above it.
              </li>
              <li>
                <b>Which awards you compete for,</b> if you are an artist. Your
                neighborhood&rsquo;s, and every one above it.
              </li>
              <li>
                <b>Which leaderboards you appear on.</b> You are ranked in each
                place you belong to, separately.
              </li>
              <li>
                <b>What you see first.</b> Your feed and the Find page lead with
                what is happening where you are.
              </li>
            </ul>
          </>
        ),
      },
      {
        id: 'jurisdiction-upward',
        q: 'Why can I vote in places I do not live?',
        a: (
          <>
            <p>
              You cannot — but the places above you count as yours. Your city
              contains your neighborhood, your state contains your city, and Unis
              contains everything, so all of them are places you are genuinely
              part of.
            </p>
            <p>
              What you cannot do is vote sideways. A neighborhood you do not
              belong to is closed to you, however close it is, and that is what
              keeps a local award local.
            </p>
          </>
        ),
      },
      {
        id: 'jurisdiction-page',
        q: 'What is on a jurisdiction page?',
        a: (
          <>
            <p>
              What that place is listening to. Its song of the week, its leading
              artists and songs, and its full record of past winners going back
              as far as the place has existed on Unis.
            </p>
            <p>
              Any jurisdiction is open to browse, whether you belong to it or
              not. You just cannot vote there.
            </p>
          </>
        ),
      },
      {
        // ⚠ VERIFY BEFORE SHIPPING. There is no endpoint that changes a user's
        // jurisdiction after registration — `setJurisdiction` is only called in
        // UserController.register. This copy is written to be true either way
        // (it does not promise self-service and does not rule it out), but if
        // you intend to add a move flow, rewrite this rather than shipping it
        // as the permanent answer.
        id: 'jurisdiction-change',
        q: 'What if I move, or my jurisdiction is wrong?',
        a: (
          <>
            <p>
              Your jurisdiction is set once, when you create your account, and it
              stays put after that. If the wrong one was picked, or you have
              moved, contact us and we will correct it.
            </p>
            <p>
              It is deliberately not a switch you can flip. If people could
              change neighborhood freely, anyone could move into whichever race
              they were most likely to win, and every local award would stop
              meaning anything.
            </p>
          </>
        ),
      },
    ],
  },
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