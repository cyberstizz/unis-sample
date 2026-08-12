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
  { id: 'ranking', title: 'Rankings', blurb: 'How leaderboards are ordered.', status: 'draft', articles: [] },
  { id: 'points', title: 'Points and levels', blurb: 'What earns points and how levels work.', status: 'draft', articles: [] },
  { id: 'plays', title: 'Play counts', blurb: 'What counts as a play.', status: 'draft', articles: [] },
  { id: 'queue', title: 'Queue', blurb: 'How the player queue behaves.', status: 'draft', articles: [] },
  { id: 'playlists', title: 'Playlists', blurb: 'Personal, community, and official playlists.', status: 'draft', articles: [] },
  { id: 'verification', title: 'Verification', blurb: 'Phone and email verification, and what they unlock.', status: 'draft', articles: [] },
  { id: 'follow', title: 'Following', blurb: 'Following artists and listeners.', status: 'draft', articles: [] },
  { id: 'likes', title: 'Likes', blurb: 'What liking a song does.', status: 'draft', articles: [] },
  { id: 'messaging', title: 'Messages', blurb: 'Direct messages and artist broadcasts.', status: 'draft', articles: [] },
  { id: 'comments', title: 'Comments', blurb: 'Commenting, editing, and moderation.', status: 'draft', articles: [] },
  { id: 'jurisdiction', title: 'Jurisdictions', blurb: 'How Unis divides the map.', status: 'draft', articles: [] },
  { id: 'referrals', title: 'Referrals', blurb: 'Referral codes and the three referral levels.', status: 'draft', articles: [] },
  { id: 'supporter', title: 'Supporting an artist', blurb: 'Picking an artist to support and switching later.', status: 'draft', articles: [] },
  { id: 'payouts', title: 'Earnings and payouts', blurb: 'How money is split and how you get paid.', status: 'draft', articles: [] },
];

export default HELP_SECTIONS;