// src/feedModules.test.jsx
//
// Tests for the feed's cards (feedModules.jsx):
//
//   raceClock       time left in today's race
//   voteShares      who has votes, and each one's share
//   pickMovers      biggest rank moves
//   FeedSpotlight   the carousel at the top of the feed
//   TodayRace       "Where Harlem's votes are going" (bubbles)
//   DayTiles        Votes today · Your points · Races close in
//   MoversCard      Movers in Harlem
//   FollowingDrops  New from artists you follow
//
// These cards only draw what feed.jsx hands them — none of them loads data or
// reports a play, so every test here is props in, screen out.

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within, act, fireEvent } from '@testing-library/react';
import * as axiosModule from './components/axiosInstance';

vi.mock('./feedModules.scss', () => ({}));

import {
  raceClock, voteShares, pickMovers,
  FeedSpotlight, TodayRace, DayTiles, MoversCard, FollowingDrops,
} from './feedModules';

// ---------------------------------------------------------------------------
const HOUR = 3600000;
const MINUTE = 60000;
/** A moment today on the viewer's own clock. */
const local = (h, m = 0) => new Date(2026, 10, 17, h, m, 0, 0).getTime();

const entry = (id, rank, extra = {}) => ({
  id, type: 'song', rank, name: `Song ${rank}`, artistName: `Artist ${rank}`, artwork: null,
  points: 100 - rank, votes: 0, plays: 0, likes: 0, movement: null, isNew: false, ...extra,
});
const board = (entries, extra = {}) => ({ state: 'LIVE', closesAt: null, entries, ...extra });

const setClock = (ms) => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(ms));
};

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// ===========================================================================
describe('raceClock', () => {
  it('counts down to the area\'s own closing time', () => {
    const now = local(18);
    expect(raceClock(new Date(now + 3 * HOUR + 30 * MINUTE).toISOString(), now)).toEqual({
      hours: 3, minutes: 30, dayFraction: 1 - 3.5 / 24,
    });
  });

  it('rounds partial minutes down', () => {
    const now = local(18);
    const clock = raceClock(new Date(now + 59 * MINUTE + 59000).toISOString(), now);
    expect([clock.hours, clock.minutes]).toEqual([0, 59]);
  });

  it('with no closing time it falls back to the viewer\'s own midnight', () => {
    expect(raceClock(null, local(18))).toEqual({ hours: 6, minutes: 0, dayFraction: 0.75 });
    expect(raceClock(undefined, local(23, 45))).toMatchObject({ hours: 0, minutes: 15 });
    expect(raceClock(null, local(0))).toEqual({ hours: 24, minutes: 0, dayFraction: 0 });
  });

  it('a closing time that makes no sense falls back the same way', () => {
    expect(raceClock('not a date', local(18))).toMatchObject({ hours: 6, minutes: 0 });
  });

  it('a closing time already well past (a stale board) falls back rather than showing zero forever', () => {
    const now = local(18);
    expect(raceClock(new Date(now - 5 * MINUTE).toISOString(), now)).toMatchObject({ hours: 6, minutes: 0 });
  });

  it('in the last moments it shows 0h 0m and a full day', () => {
    const now = local(18);
    expect(raceClock(new Date(now - 30000).toISOString(), now)).toEqual({ hours: 0, minutes: 0, dayFraction: 1 });
    expect(raceClock(new Date(now).toISOString(), now)).toEqual({ hours: 0, minutes: 0, dayFraction: 1 });
  });

  it('the day fraction never leaves 0–1, even when the race closes more than a day away', () => {
    const now = local(18);
    const clock = raceClock(new Date(now + 30 * HOUR).toISOString(), now);
    expect(clock.hours).toBe(30);
    expect(clock.dayFraction).toBe(0);
  });
});

// ===========================================================================
describe('voteShares', () => {
  it('gives each entry its share of the votes, largest first', () => {
    const { total, ranked } = voteShares(board([
      entry('a', 1, { votes: 6 }), entry('b', 2, { votes: 3 }), entry('c', 3, { votes: 1 }),
    ]));
    expect(total).toBe(10);
    expect(ranked.map((e) => [e.id, e.share])).toEqual([['a', 60], ['b', 30], ['c', 10]]);
  });

  it('leaves out entries with no votes — points alone do not count here', () => {
    const { total, ranked } = voteShares(board([entry('a', 1, { votes: 0, points: 900 }), entry('b', 2, { votes: 4 })]));
    expect(total).toBe(4);
    expect(ranked.map((e) => e.id)).toEqual(['b']);
    expect(ranked[0].share).toBe(100);
  });

  it('orders by votes, not by rank — and by rank when votes are level', () => {
    const { ranked } = voteShares(board([
      entry('a', 1, { votes: 2 }), entry('b', 2, { votes: 9 }), entry('c', 3, { votes: 2 }),
    ]));
    expect(ranked.map((e) => e.id)).toEqual(['b', 'a', 'c']);
  });

  it('shows at most five, but counts every vote in the total and the shares', () => {
    const entries = Array.from({ length: 8 }, (_, i) => entry(`e${i}`, i + 1, { votes: 10 }));
    const { total, ranked } = voteShares(board(entries));
    expect(total).toBe(80);
    expect(ranked).toHaveLength(5);
    expect(ranked.every((e) => e.share === 13)).toBe(true);
  });

  it('takes a different limit when asked', () => {
    const entries = Array.from({ length: 8 }, (_, i) => entry(`e${i}`, i + 1, { votes: 1 }));
    expect(voteShares(board(entries), 2).ranked).toHaveLength(2);
  });

  it('keeps the entry\'s own details and does not reorder the board it was given', () => {
    const entries = [entry('a', 1, { votes: 1 }), entry('b', 2, { votes: 5 })];
    const { ranked } = voteShares(board(entries));
    expect(ranked[0]).toMatchObject({ id: 'b', name: 'Song 2', votes: 5 });
    expect(entries.map((e) => e.id)).toEqual(['a', 'b']);
    expect(entries[0].share).toBeUndefined();
  });

  it.each([null, undefined, {}, { entries: [] }])('an empty or missing board (%j) is nobody and no votes', (b) => {
    expect(voteShares(b)).toEqual({ total: 0, ranked: [] });
  });
});

// ===========================================================================
describe('pickMovers', () => {
  it('lists climbers first (biggest jump first), then new entries, then the drops (biggest first)', () => {
    const picked = pickMovers(board([
      entry('down-small', 1, { movement: -1 }),
      entry('up-small', 2, { movement: 1 }),
      entry('new', 3, { isNew: true }),
      entry('up-big', 4, { movement: 7 }),
      entry('down-big', 5, { movement: -6 }),
    ]), 10);
    expect(picked.map((e) => e.id)).toEqual(['up-big', 'up-small', 'new', 'down-big', 'down-small']);
  });

  it('shows four by default', () => {
    const entries = Array.from({ length: 9 }, (_, i) => entry(`e${i}`, i + 1, { movement: i + 1 }));
    expect(pickMovers(board(entries)).map((e) => e.id)).toEqual(['e8', 'e7', 'e6', 'e5']);
  });

  it('leaves out entries that held their place or have nothing to compare against', () => {
    const picked = pickMovers(board([entry('steady', 1, { movement: 0 }), entry('unknown', 2), entry('up', 3, { movement: 2 })]));
    expect(picked.map((e) => e.id)).toEqual(['up']);
  });

  it('leaves out entries with no points this period, however far they "moved"', () => {
    const picked = pickMovers(board([entry('ghost', 1, { movement: 20, points: 0 }), entry('new-ghost', 2, { isNew: true, points: 0 })]));
    expect(picked).toEqual([]);
  });

  it.each([null, undefined, {}])('a missing board (%j) has no movers', (b) => {
    expect(pickMovers(b)).toEqual([]);
  });
});

// ===========================================================================
describe('FeedSpotlight', () => {
  let handlers;
  const renderSpotlight = (props = {}) => render(
    <FeedSpotlight jurisdictionName="Harlem" dailyBoard={null} weeklyWinner={null} artistOfWeek={null} {...handlers} {...props} />,
  );
  const slides = () => screen.getAllByRole('group');
  const WINNER = { songId: 's-9', title: 'Week Winner', artistName: 'Maya', artworkUrl: 'https://cdn.test/w.jpg' };
  const AOTW = { userId: 'a-5', username: 'Tony Fadd', photoUrl: 'https://cdn.test/t.jpg', votesCount: 31 };
  const LEADER = board([entry('s-1', 1, { name: 'Uptown Anthem', artistName: 'Tony Fadd', votes: 12, artwork: 'https://cdn.test/1.jpg' }), entry('s-2', 2, { votes: 8 })]);

  beforeEach(() => {
    handlers = { onVote: vi.fn(), onSongNav: vi.fn(), onArtistNav: vi.fn() };
  });

  it.each([
    [9, 'This morning in Harlem'],
    [11, 'This morning in Harlem'],
    [12, 'This afternoon in Harlem'],
    [16, 'This afternoon in Harlem'],
    [17, 'Tonight in Harlem'],
    [23, 'Tonight in Harlem'],
    [2, 'This morning in Harlem'],
  ])('at %i:00 the headline reads "%s"', (hour, headline) => {
    setClock(local(hour));
    renderSpotlight();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(headline);
  });

  it('with nothing to feature it still sells the vote — one slide, no dots, nothing to open', () => {
    renderSpotlight();
    expect(slides()).toHaveLength(1);
    expect(slides()[0]).toHaveAccessibleName('1 of 1: Who runs Harlem today?');
    expect(slides()[0]).toHaveTextContent("Today's race in Harlem");
    expect(slides()[0]).toHaveTextContent('Your vote decides the #1');
    expect(screen.queryByRole('button', { name: /^open /i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /show slide/i })).not.toBeInTheDocument();
  });

  it('a board where nobody has scored counts as nothing to feature', () => {
    renderSpotlight({ dailyBoard: board([entry('s-1', 1, { points: 0 })]) });
    expect(slides()[0]).toHaveAccessibleName('1 of 1: Who runs Harlem today?');
  });

  it('leads with today\'s race leader: votes, share of the vote, and the artist', () => {
    renderSpotlight({ dailyBoard: LEADER });
    const slide = slides()[0];
    expect(slide).toHaveAccessibleName('1 of 1: Uptown Anthem');
    expect(slide).toHaveTextContent("Leading today's race");
    expect(slide.querySelector('.fm-spot__byline')).toHaveTextContent('Tony Fadd');
    expect(slide.querySelector('.fm-spot__chip')).toHaveTextContent('12 votes');
    expect(slide.querySelector('.fm-spot__meta')).toHaveTextContent('60% share');
    expect(slide.querySelector('.fm-spot__art')).toHaveAttribute('src', 'https://cdn.test/1.jpg');
  });

  it('a leader on plays and likes alone shows its place and points instead of votes', () => {
    renderSpotlight({ dailyBoard: board([entry('s-1', 1, { points: 1240, votes: 0 }), entry('s-2', 2, { votes: 3 })]) });
    expect(slides()[0].querySelector('.fm-spot__chip')).toHaveTextContent('#1 in Harlem');
    expect(slides()[0].querySelector('.fm-spot__meta')).toHaveTextContent('1,240 pts');
  });

  it('says "1 vote", not "1 votes"', () => {
    renderSpotlight({ dailyBoard: board([entry('s-1', 1, { votes: 1 })]) });
    expect(slides()[0].querySelector('.fm-spot__chip')).toHaveTextContent(/^1 vote$/);
    expect(slides()[0].querySelector('.fm-spot__meta')).toHaveTextContent('100% share');
  });

  it('before today has any activity it shows yesterday\'s #1 as such', () => {
    renderSpotlight({ dailyBoard: { ...LEADER, state: 'PREVIOUS_FINAL' } });
    expect(slides()[0]).toHaveTextContent("Yesterday's #1");
    expect(slides()[0]).not.toHaveTextContent("Leading today's race");
  });

  it('skips entries with no points when choosing the leader', () => {
    renderSpotlight({ dailyBoard: board([entry('s-0', 1, { points: 0 }), entry('s-1', 2, { name: 'Real Leader', votes: 2 })]) });
    expect(slides()[0]).toHaveAccessibleName('1 of 1: Real Leader');
  });

  it('adds Song of the Week and Artist of the Week, in that order', () => {
    renderSpotlight({ dailyBoard: LEADER, weeklyWinner: WINNER, artistOfWeek: AOTW });
    expect(slides().map((s) => s.getAttribute('aria-label'))).toEqual([
      '1 of 3: Uptown Anthem', '2 of 3: Week Winner', '3 of 3: Tony Fadd',
    ]);

    const [, sotw, aotw] = slides();
    expect(sotw).toHaveTextContent('Song of the Week');
    expect(sotw.querySelector('.fm-spot__chip')).toHaveTextContent('Winner');
    expect(sotw.querySelector('.fm-spot__byline')).toHaveTextContent('Maya');
    expect(within(sotw).getByRole('button', { name: 'Vote this week' })).toBeInTheDocument();

    expect(aotw).toHaveTextContent('Artist of the Week');
    expect(aotw.querySelector('.fm-spot__chip')).toHaveTextContent('31 votes');
    expect(aotw.querySelector('.fm-spot__art')).toHaveClass('fm-spot__art--round');
  });

  it('an Artist of the Week with no vote count is labelled Winner', () => {
    renderSpotlight({ artistOfWeek: { ...AOTW, votesCount: 0 } });
    expect(slides()[0].querySelector('.fm-spot__chip')).toHaveTextContent('Winner');
  });

  it('the weekly slides stand on their own when today has no leader', () => {
    renderSpotlight({ weeklyWinner: WINNER });
    expect(slides().map((s) => s.getAttribute('aria-label'))).toEqual(['1 of 1: Week Winner']);
  });

  it('tapping a slide opens the song or the artist it features', () => {
    renderSpotlight({ dailyBoard: LEADER, weeklyWinner: WINNER, artistOfWeek: AOTW });
    fireEvent.click(screen.getByRole('button', { name: 'Open Uptown Anthem' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open Week Winner' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open Tony Fadd' }));

    expect(handlers.onSongNav.mock.calls).toEqual([['s-1', 'song'], ['s-9', 'song']]);
    expect(handlers.onArtistNav.mock.calls).toEqual([['a-5']]);
    expect(handlers.onVote).not.toHaveBeenCalled();
  });

  it('the Vote button on any slide opens voting, not the song', () => {
    renderSpotlight({ dailyBoard: LEADER, weeklyWinner: WINNER });
    fireEvent.click(within(slides()[0]).getByRole('button', { name: 'Vote' }));
    fireEvent.click(within(slides()[1]).getByRole('button', { name: 'Vote this week' }));
    expect(handlers.onVote).toHaveBeenCalledTimes(2);
    expect(handlers.onSongNav).not.toHaveBeenCalled();
  });

  it('the fallback slide\'s Vote button works too', () => {
    renderSpotlight();
    fireEvent.click(screen.getByRole('button', { name: 'Vote' }));
    expect(handlers.onVote).toHaveBeenCalledTimes(1);
  });

  it('has one dot per slide; choosing a dot marks it current', () => {
    renderSpotlight({ dailyBoard: LEADER, weeklyWinner: WINNER, artistOfWeek: AOTW });
    const dots = screen.getAllByRole('button', { name: /show slide/i });
    expect(dots).toHaveLength(3);
    expect(dots[0]).toHaveAttribute('aria-current', 'true');

    fireEvent.click(dots[2]);
    expect(dots[2]).toHaveAttribute('aria-current', 'true');
    expect(dots[0]).not.toHaveAttribute('aria-current');
  });

  it('swiping the track moves the current dot with it', () => {
    renderSpotlight({ dailyBoard: LEADER, weeklyWinner: WINNER, artistOfWeek: AOTW });
    const track = document.querySelector('.fm-spot__track');
    Object.defineProperty(track, 'clientWidth', { value: 320, configurable: true });
    track.scrollLeft = 330;
    fireEvent.scroll(track);
    expect(screen.getAllByRole('button', { name: /show slide/i })[1]).toHaveAttribute('aria-current', 'true');
  });

  it('goes back to the first slide when the number of slides changes', () => {
    const view = renderSpotlight({ dailyBoard: LEADER, weeklyWinner: WINNER, artistOfWeek: AOTW });
    fireEvent.click(screen.getAllByRole('button', { name: /show slide/i })[2]);

    view.rerender(<FeedSpotlight jurisdictionName="Harlem" dailyBoard={LEADER} weeklyWinner={WINNER} artistOfWeek={null} {...handlers} />);
    const dots = screen.getAllByRole('button', { name: /show slide/i });
    expect(dots).toHaveLength(2);
    expect(dots[0]).toHaveAttribute('aria-current', 'true');
  });

  it('artwork that fails to load is hidden rather than left broken', () => {
    renderSpotlight({ dailyBoard: LEADER });
    const art = slides()[0].querySelector('.fm-spot__art');
    fireEvent.error(art);
    expect(art.style.display).toBe('none');
  });
});

// ===========================================================================
describe('TodayRace', () => {
  let handlers;
  const SONGS = board([
    entry('s-1', 1, { name: 'Uptown Anthem', votes: 12 }),
    entry('s-2', 2, { name: 'Second City', votes: 6 }),
    entry('s-3', 3, { name: 'Third Rail', votes: 2 }),
  ]);
  const ARTISTS = board([entry('a-1', 1, { type: 'artist', name: 'Tony Fadd', votes: 4 })]);

  const renderRace = (props = {}) => render(
    <TodayRace
      jurisdictionName="Harlem" songBoard={SONGS} artistBoard={ARTISTS} category="song"
      votedTargetIds={new Set()} {...handlers} {...props}
    />,
  );
  const bubbles = () => Array.from(document.querySelectorAll('.fm-bubble'));

  beforeEach(() => {
    handlers = { onCategoryChange: vi.fn(), onVote: vi.fn(), onOpenEntry: vi.fn(), onOpenStandings: vi.fn() };
  });

  it('is titled for the area and says which race and how many votes', () => {
    renderRace();
    expect(screen.getByRole('region', { name: "Today's song race" })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Where Harlem’s votes are going');
    expect(document.querySelector('.fm-race__head .fm-card__sub')).toHaveTextContent('Song of the Day · 20 votes');
  });

  it('the Artists tab reads the artist board', () => {
    renderRace({ category: 'artist' });
    expect(screen.getByRole('region', { name: "Today's artist race" })).toBeInTheDocument();
    expect(document.querySelector('.fm-race__head .fm-card__sub')).toHaveTextContent('Artist of the Day · 4 votes');
    expect(bubbles().map((b) => b.getAttribute('aria-label'))).toEqual(['Tony Fadd, 100 percent of votes']);
  });

  it('Songs / Artists show which is on and ask the feed to switch', () => {
    renderRace();
    expect(screen.getByRole('button', { name: 'Songs' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Artists' })).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(screen.getByRole('button', { name: 'Artists' }));
    fireEvent.click(screen.getByRole('button', { name: 'Songs' }));
    expect(handlers.onCategoryChange.mock.calls).toEqual([['artist'], ['song']]);
  });

  it('before today has activity it is labelled as yesterday\'s final', () => {
    renderRace({ songBoard: { ...SONGS, state: 'PREVIOUS_FINAL' } });
    expect(document.querySelector('.fm-race__head .fm-card__sub')).toHaveTextContent("Yesterday's final · 20 votes");
  });

  it('draws one bubble per voted entry, biggest share first', () => {
    renderRace();
    expect(bubbles().map((b) => b.getAttribute('aria-label'))).toEqual([
      'Uptown Anthem, 60 percent of votes', 'Second City, 30 percent of votes', 'Third Rail, 10 percent of votes',
    ]);
    expect(bubbles()[0]).toHaveTextContent('60%');
    expect(bubbles()[0]).toHaveTextContent('12 votes');
  });

  it('draws at most five bubbles; the small ones carry less text', () => {
    const many = board(Array.from({ length: 7 }, (_, i) => entry(`s-${i}`, i + 1, { votes: 70 - i * 10 })));
    renderRace({ songBoard: many });
    expect(bubbles()).toHaveLength(5);
    expect(bubbles()[2].querySelector('.fm-bubble__votes')).not.toBeNull();
    expect(bubbles()[3].querySelector('.fm-bubble__votes')).toBeNull();
    expect(bubbles()[3].querySelector('.fm-bubble__name')).not.toBeNull();
    expect(bubbles()[4].querySelector('.fm-bubble__name')).toBeNull();
    expect(bubbles()[4].querySelector('.fm-bubble__pct')).not.toBeNull();
  });

  it('bubbles never overlap: each sits in its own fixed slot', () => {
    const many = board(Array.from({ length: 5 }, (_, i) => entry(`s-${i}`, i + 1, { votes: 50 - i * 10 })));
    renderRace({ songBoard: many });
    const spots = bubbles().map((b) => `${b.style.left}|${b.style.top}`);
    expect(new Set(spots).size).toBe(5);
    const widths = bubbles().map((b) => parseFloat(b.style.width));
    expect(widths).toEqual([...widths].sort((a, b) => b - a));
  });

  it('tapping a bubble opens that entry', () => {
    renderRace();
    fireEvent.click(screen.getByRole('button', { name: 'Second City, 30 percent of votes' }));
    expect(handlers.onOpenEntry).toHaveBeenCalledWith(expect.objectContaining({ id: 's-2', share: 30 }));
  });

  it('while the board is loading it says so', () => {
    renderRace({ songBoard: null });
    expect(screen.getByText('Loading the race…')).toBeInTheDocument();
    expect(bubbles()).toHaveLength(0);
  });

  it('with no votes yet it invites the first one', () => {
    renderRace({ songBoard: board([entry('s-1', 1, { votes: 0, points: 40 })]) });
    expect(screen.getByText('No votes yet today in Harlem. The first one sets the pace.')).toBeInTheDocument();
    expect(document.querySelector('.fm-race__head .fm-card__sub')).toHaveTextContent('Song of the Day · 0 votes');
  });

  describe('the footer', () => {
    it('before voting: the vote is open, one per day, with a Vote button', () => {
      renderRace();
      const foot = document.querySelector('.fm-race__foot');
      expect(foot).toHaveTextContent('Today’s vote is open');
      expect(foot).toHaveTextContent('One song vote per day in Harlem');
      fireEvent.click(within(foot).getByRole('button', { name: 'Vote' }));
      expect(handlers.onVote).toHaveBeenCalledTimes(1);
    });

    it('after voting: the vote is in, no Vote button, and the user\'s bubble is marked', () => {
      renderRace({ votedTargetIds: new Set(['s-2']) });
      const foot = document.querySelector('.fm-race__foot');
      expect(foot).toHaveTextContent('Your vote is in');
      expect(foot).toHaveTextContent('Next song vote opens at midnight');
      expect(within(foot).queryByRole('button', { name: 'Vote' })).not.toBeInTheDocument();

      const mine = screen.getByRole('button', { name: 'Second City, 30 percent of votes, your vote' });
      expect(mine).toHaveClass('is-mine');
      expect(mine).toHaveTextContent('Your vote');
      expect(screen.getByRole('button', { name: 'Uptown Anthem, 60 percent of votes' })).not.toHaveClass('is-mine');
    });

    it('a vote for an entry too small to get a bubble still counts as voted', () => {
      const many = board(Array.from({ length: 7 }, (_, i) => entry(`s-${i}`, i + 1, { votes: 70 - i * 10 })));
      renderRace({ songBoard: many, votedTargetIds: new Set(['s-6']) });
      expect(document.querySelector('.fm-race__foot')).toHaveTextContent('Your vote is in');
    });

    it('a song vote does not close the artist race', () => {
      renderRace({ category: 'artist', votedTargetIds: new Set(['s-2']) });
      const foot = document.querySelector('.fm-race__foot');
      expect(foot).toHaveTextContent('Today’s vote is open');
      expect(foot).toHaveTextContent('One artist vote per day in Harlem');
    });

    it('works without a set of voted ids (a guest)', () => {
      renderRace({ votedTargetIds: undefined });
      expect(document.querySelector('.fm-race__foot')).toHaveTextContent('Today’s vote is open');
    });

    it('both the corner button and the Standings link open the full standings', () => {
      renderRace();
      fireEvent.click(screen.getByRole('button', { name: 'Open full standings' }));
      fireEvent.click(screen.getByRole('button', { name: /^standings/i }));
      expect(handlers.onOpenStandings).toHaveBeenCalledTimes(2);
    });
  });

  describe('the countdown', () => {
    it('counts down to the area\'s closing time on a live board', () => {
      setClock(local(20));
      renderRace({ songBoard: { ...SONGS, closesAt: new Date(local(20) + 2 * HOUR + 15 * MINUTE).toISOString() } });
      const clock = screen.getByLabelText('Race closes in 2 hours 15 minutes');
      expect(clock).toHaveTextContent('2h 15m');
    });

    it('a board showing yesterday\'s final counts down to the viewer\'s midnight instead of a closing time already passed', () => {
      setClock(local(9));
      renderRace({ songBoard: { ...SONGS, state: 'PREVIOUS_FINAL', closesAt: new Date(local(9) + 1 * HOUR).toISOString() } });
      expect(screen.getByLabelText('Race closes in 15 hours 0 minutes')).toBeInTheDocument();
    });

    it('keeps itself up to date without the feed re-rendering', () => {
      setClock(local(20));
      renderRace({ songBoard: { ...SONGS, closesAt: new Date(local(20) + 2 * HOUR).toISOString() } });
      expect(screen.getByLabelText('Race closes in 2 hours 0 minutes')).toBeInTheDocument();

      act(() => { vi.advanceTimersByTime(30 * MINUTE); });
      expect(screen.getByLabelText('Race closes in 1 hours 30 minutes')).toBeInTheDocument();
    });

    it('stops its timer when the card leaves the screen', () => {
      setClock(local(20));
      const clear = vi.spyOn(globalThis, 'clearInterval');
      const view = renderRace();
      view.unmount();
      expect(clear).toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);
    });
  });
});

// ===========================================================================
describe('DayTiles', () => {
  const renderTiles = (props = {}) => render(
    <DayTiles isGuest={false} jurisdictionName="Harlem" votedSongToday={false} votedArtistToday={false}
      score={0} level={null} closesAt={null} {...props} />,
  );
  const tile = (label) => screen.getByText(label).closest('.fm-tile');

  it.each([
    [false, false, '0/2', 'Two races open'],
    [true, false, '1/2', 'Artist race still open'],
    [false, true, '1/2', 'Song race still open'],
    [true, true, '2/2', 'Both races done'],
  ])('votes today — song: %s, artist: %s → %s, "%s"', (votedSongToday, votedArtistToday, count, note) => {
    renderTiles({ votedSongToday, votedArtistToday });
    const votes = tile('Votes today');
    expect(votes.querySelector('.fm-tile__big')).toHaveTextContent(count);
    expect(votes.querySelector('.fm-tile__note')).toHaveTextContent(note);
    const used = Number(count[0]);
    expect(votes.querySelectorAll('.fm-tile__pips .is-on')).toHaveLength(used);
  });

  it('shows the user\'s points, rounded with thousands separators, and their level', () => {
    renderTiles({ score: 12345.6, level: 'silver' });
    const points = tile('Your points');
    expect(points.querySelector('.fm-tile__big')).toHaveTextContent('12,346');
    expect(points.querySelector('.fm-tile__note')).toHaveTextContent('Silver level');
  });

  it('shows 0 points when the score has not arrived, and no level line without a level', () => {
    renderTiles({ score: undefined, level: null });
    const points = tile('Your points');
    expect(points.querySelector('.fm-tile__big')).toHaveTextContent(/^0$/);
    expect(points.querySelector('.fm-tile__note')).toBeNull();
  });

  it('is headed "Your day on Unis" for a member', () => {
    renderTiles();
    expect(screen.getByRole('region', { name: 'Your day on Unis' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Your day on Unis');
  });

  it('a guest sees only the countdown — no votes or points of their own', () => {
    renderTiles({ isGuest: true, votedSongToday: true, score: 500 });
    expect(screen.getByRole('region', { name: 'Today on Unis' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Today on Unis');
    expect(screen.queryByText('Votes today')).not.toBeInTheDocument();
    expect(screen.queryByText('Your points')).not.toBeInTheDocument();
    expect(screen.getByText('Harlem’s races close in')).toBeInTheDocument();
  });

  it('counts down to the closing time it is given', () => {
    setClock(local(18));
    renderTiles({ closesAt: new Date(local(18) + 4 * HOUR + 5 * MINUTE).toISOString() });
    expect(document.querySelector('.fm-clock__big')).toHaveTextContent('4h 5m');
    expect(screen.getByText('Song & Artist of the Day · midnight local')).toBeInTheDocument();
  });

  it('with no closing time it counts down to the viewer\'s midnight and shows how much of the day has gone', () => {
    setClock(local(18));
    renderTiles();
    expect(document.querySelector('.fm-clock__big')).toHaveTextContent('6h 0m');
    expect(screen.getByRole('img', { name: '75 percent of the day has passed' })).toBeInTheDocument();
    expect(document.querySelector('.fm-clock__ring')).toHaveTextContent('75%');
  });

  it('the ring\'s arc is drawn in proportion to the day', () => {
    setClock(local(12));
    renderTiles();
    const circumference = 2 * Math.PI * 31;
    expect(document.querySelector('.fm-clock__arc')).toHaveAttribute(
      'stroke-dasharray', `${(circumference * 0.5).toFixed(1)} ${circumference.toFixed(1)}`);
  });

  it('ticks on its own', () => {
    setClock(local(18));
    renderTiles();
    act(() => { vi.advanceTimersByTime(90 * MINUTE); });
    expect(document.querySelector('.fm-clock__big')).toHaveTextContent('4h 30m');
  });
});

// ===========================================================================
describe('MoversCard', () => {
  let handlers;
  const MOVERS = board([
    entry('s-1', 1, { name: 'Climber', artistName: 'Tony Fadd', movement: 4, plays: 340, artwork: 'https://cdn.test/c.jpg' }),
    entry('s-2', 2, { name: 'Newcomer', artistName: '', isNew: true, plays: 1 }),
    entry('s-3', 3, { name: 'Faller', artistName: 'Maya', movement: -2, plays: 1200 }),
  ]);
  const renderMovers = (props = {}) => render(
    <MoversCard jurisdictionName="Harlem" board={MOVERS} period="daily" fallbackArt="/fallback.png" {...handlers} {...props} />,
  );
  const rows = () => Array.from(document.querySelectorAll('.fm-mover'));

  beforeEach(() => {
    handlers = { onPeriodChange: vi.fn(), onOpenEntry: vi.fn() };
  });

  it('is titled for the area', () => {
    renderMovers();
    expect(screen.getByRole('region', { name: 'Movers in Harlem' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Movers in Harlem');
  });

  it('Today / Week show which is on and ask the feed to switch', () => {
    renderMovers({ period: 'weekly' });
    expect(screen.getByRole('button', { name: 'Week' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Today' })).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(screen.getByRole('button', { name: 'Today' }));
    fireEvent.click(screen.getByRole('button', { name: 'Week' }));
    expect(handlers.onPeriodChange.mock.calls).toEqual([['daily'], ['weekly']]);
  });

  it('lists each mover with its place and how far it moved', () => {
    renderMovers();
    expect(rows().map((r) => r.querySelector('.fm-mover__title').textContent)).toEqual(['Climber', 'Newcomer', 'Faller']);

    const [up, fresh, down] = rows();
    expect(up.querySelector('.fm-mover__pos')).toHaveTextContent('#1');
    expect(up.querySelector('.fm-mover__move')).toHaveClass('is-up');
    expect(up.querySelector('.fm-mover__move')).toHaveTextContent('4 places up');
    expect(fresh.querySelector('.fm-mover__new')).toHaveTextContent('NEW');
    expect(fresh.querySelector('.fm-mover__move')).toBeNull();
    expect(down.querySelector('.fm-mover__move')).toHaveClass('is-down');
    expect(down.querySelector('.fm-mover__move')).toHaveTextContent('2 places down');
  });

  it('the second line gives the artist and plays for the period shown', () => {
    renderMovers();
    expect(rows().map((r) => r.querySelector('.fm-mover__sub').textContent)).toEqual([
      'Tony Fadd · 340 plays today', '1 play today', 'Maya · 1,200 plays today',
    ]);
  });

  it('says "this week" on the weekly view', () => {
    renderMovers({ period: 'weekly' });
    expect(rows()[0].querySelector('.fm-mover__sub')).toHaveTextContent('Tony Fadd · 340 plays this week');
  });

  it('tapping a mover opens it', () => {
    renderMovers();
    fireEvent.click(rows()[2]);
    expect(handlers.onOpenEntry).toHaveBeenCalledWith(expect.objectContaining({ id: 's-3' }));
  });

  it('uses the fallback picture when there is no artwork or it fails to load', () => {
    renderMovers();
    const [withArt, without] = rows().map((r) => r.querySelector('img'));
    expect(withArt).toHaveAttribute('src', 'https://cdn.test/c.jpg');
    expect(without).toHaveAttribute('src', '/fallback.png');

    fireEvent.error(withArt);
    expect(withArt).toHaveAttribute('src', '/fallback.png');
  });

  it('says Loading… until the board arrives', () => {
    renderMovers({ board: null });
    expect(screen.getByText('Loading…')).toBeInTheDocument();
    expect(rows()).toHaveLength(0);
  });

  it.each([['daily', 'Nobody has moved yet today.'], ['weekly', 'Nobody has moved yet this week.']])(
    'with no movers on the %s view it says "%s"', (period, line) => {
      renderMovers({ period, board: board([entry('s-1', 1, { movement: 0 }), entry('s-2', 2)]) });
      expect(screen.getByText(line)).toBeInTheDocument();
    });

  it('shows no more than four', () => {
    renderMovers({ board: board(Array.from({ length: 9 }, (_, i) => entry(`s-${i}`, i + 1, { movement: i + 1 }))) });
    expect(rows()).toHaveLength(4);
  });
});

// ===========================================================================
describe('FollowingDrops', () => {
  const NOW = local(12);
  const daysAgo = (n) => new Date(NOW - n * 24 * HOUR).toISOString();
  const drop = (id, extra = {}) => ({
    id, title: `Drop ${id}`, artist: 'Tony Fadd', artistPhoto: 'https://cdn.test/photo.jpg',
    artworkUrl: 'https://cdn.test/art.jpg', createdAt: daysAgo(10), ...extra,
  });

  beforeEach(() => setClock(NOW));

  it.each([[[]], [null], [undefined]])('shows nothing at all when there are no drops (%j)', (drops) => {
    const { container } = render(<FollowingDrops drops={drops} onOpen={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('lists each new song under its heading', () => {
    render(<FollowingDrops drops={[drop(1), drop(2)]} onOpen={vi.fn()} />);
    expect(screen.getByRole('region', { name: 'New from artists you follow' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('New from artists you follow');
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('a song less than two days old gets the NEW ring; an older one does not', () => {
    render(<FollowingDrops drops={[drop(1, { createdAt: daysAgo(1) }), drop(2, { createdAt: daysAgo(3) })]} onOpen={vi.fn()} />);

    const fresh = screen.getByRole('button', { name: 'Drop 1 by Tony Fadd, new' });
    expect(fresh.querySelector('.fm-drop__ring')).toHaveClass('is-fresh');
    expect(fresh.querySelector('.fm-drop__new')).toHaveTextContent('NEW');

    const older = screen.getByRole('button', { name: 'Drop 2 by Tony Fadd' });
    expect(older.querySelector('.fm-drop__ring')).not.toHaveClass('is-fresh');
    expect(older.querySelector('.fm-drop__new')).toBeNull();
  });

  it('a song with no date is not called new', () => {
    render(<FollowingDrops drops={[drop(1, { createdAt: null })]} onOpen={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Drop 1 by Tony Fadd' })).toBeInTheDocument();
  });

  it.each([
    [{ artistData: { username: 'From Profile' }, artist: 'From Song' }, 'From Profile'],
    [{ artistData: null, artist: 'From Song' }, 'From Song'],
    [{ artistData: null, artist: '' }, 'Artist'],
  ])('names the artist from the best source it has', (extra, name) => {
    render(<FollowingDrops drops={[drop(1, extra)]} onOpen={vi.fn()} />);
    expect(document.querySelector('.fm-drop__name')).toHaveTextContent(name);
    expect(screen.getByRole('button', { name: `Drop 1 by ${name}` })).toBeInTheDocument();
  });

  it('shows the artist\'s photo, or the song\'s artwork when there is none', () => {
    render(<FollowingDrops drops={[drop(1), drop(2, { artistPhoto: null })]} onOpen={vi.fn()} />);
    const [photo, art] = Array.from(document.querySelectorAll('.fm-drop img'));
    expect(photo).toHaveAttribute('src', 'https://cdn.test/photo.jpg');
    expect(art).toHaveAttribute('src', 'https://cdn.test/art.jpg');

    fireEvent.error(photo);
    expect(photo.style.visibility).toBe('hidden');
  });

  it('tapping a drop hands that song back to the feed', () => {
    const onOpen = vi.fn();
    const drops = [drop(1), drop(2)];
    render(<FollowingDrops drops={drops} onOpen={onOpen} />);
    fireEvent.click(screen.getByRole('button', { name: 'Drop 2 by Tony Fadd' }));
    expect(onOpen).toHaveBeenCalledWith(drops[1]);
  });
});

// ===========================================================================
describe('feed cards — earnings rule', () => {
  it('no card makes a request of its own: opening, voting and switching tabs only call back to the feed', () => {
    const api = vi.spyOn(axiosModule, 'apiCall');
    const noop = () => {};
    const songs = board([entry('s-1', 1, { votes: 3, movement: 2 })]);
    render(
      <>
        <FeedSpotlight jurisdictionName="Harlem" dailyBoard={songs} weeklyWinner={null} artistOfWeek={null}
          onVote={noop} onSongNav={noop} onArtistNav={noop} />
        <TodayRace jurisdictionName="Harlem" songBoard={songs} artistBoard={null} category="song"
          votedTargetIds={new Set()} onCategoryChange={noop} onVote={noop} onOpenEntry={noop} onOpenStandings={noop} />
        <MoversCard jurisdictionName="Harlem" board={songs} period="daily" onPeriodChange={noop} onOpenEntry={noop} fallbackArt="/f.png" />
        <FollowingDrops drops={[{ id: 1, title: 'Drop', artist: 'Tony' }]} onOpen={noop} />
      </>,
    );
    screen.getAllByRole('button').forEach((button) => fireEvent.click(button));
    expect(api).not.toHaveBeenCalled();
  });
});
