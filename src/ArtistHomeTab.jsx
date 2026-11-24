import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Bell,
  Check,
  ChevronDown,
  Megaphone,
  RefreshCw,
} from 'lucide-react';
import { apiCall } from './components/axiosInstance';
import buildUrl from './utils/buildUrl';
import { BroadcastComposer } from './SupporterSection';
import LiveStanding from './LiveStanding';
import { RELEASE_TYPE_LABEL } from './utils/releases';
import { fetchReach } from './utils/releaseAlerts';

// =============================================================================
// ArtistHomeTab — the dashboard's first screen (Nov 2026 look).
//
// Leads with what matters today, like Spotify for Artists' 2026 Home:
//   main:  setup checklist (until done) · this week · latest release + reach
//   side:  today's race · balance · supporters
//
// Data:
//   • What ArtistDashboard already loaded comes in as props.
//   • Small reads of its own, each failing quietly to its own card:
//       /v1/artist-analytics/artist/{id}/fanbase?period=week   (this week)
//       /v1/artist-analytics/artist/{id}/supporters            (newest supporters)
//       /v1/release-alerts/reach                               (latest alert)
//       /v1/awards/standings (LiveStanding)                    (today's race)
// =============================================================================

const formatNumber = (n) => Number(n || 0).toLocaleString('en-US');
const initialOf = (name) => (name ? name.charAt(0).toUpperCase() : '?');

const formatDelta = (delta) => {
  if (delta === null || delta === undefined) return null;
  const n = Number(delta);
  if (Number.isNaN(n) || n === 0) return null;
  return { text: `${n > 0 ? '+' : '−'}${formatNumber(Math.abs(n))}`, tone: n > 0 ? 'up' : 'down' };
};

// Ring geometry for the setup card (r = 22 in a 54-unit box).
const RING_C = 2 * Math.PI * 22;

function useArtistRead(url) {
  const [state, setState] = useState({ data: null, loading: Boolean(url), error: null });

  const load = useCallback(() => {
    if (!url) return undefined;
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    apiCall({ url, method: 'get', useCache: false })
      .then((res) => {
        if (!cancelled) setState({ data: res.data ?? null, loading: false, error: null });
      })
      .catch((err) => {
        console.error(`Dashboard home read failed (${url}):`, err);
        if (!cancelled) setState({ data: null, loading: false, error: 'Could not load this right now.' });
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  useEffect(() => load(), [load]);

  return { ...state, retry: load };
}

const CardError = ({ onRetry }) => (
  <div className="ad-card__error">
    <span>Could not load this right now.</span>
    <button type="button" onClick={onRetry}>
      <RefreshCw size={13} aria-hidden="true" /> Retry
    </button>
  </div>
);

const CardLoading = ({ label }) => (
  <div className="ad-card__loading" role="status">
    <span className="ad-card__spinner" aria-hidden="true" />
    {label}
  </div>
);

// =============================================================================
// Setup — progress ring, the next step as one button, every step on request.
// =============================================================================
const SetupCard = ({ steps, onAction }) => {
  const [open, setOpen] = useState(false);
  const doneCount = steps.filter((s) => s.done).length;
  const total = steps.length;
  const next = steps.find((s) => !s.done);
  const dash = `${((RING_C * doneCount) / total).toFixed(1)} ${RING_C.toFixed(1)}`;

  return (
    <section className="ad-card ad-setup" aria-labelledby="ad-setup-title">
      <div className="ad-setup__head">
        <svg className="ad-setup__ring" viewBox="0 0 54 54" aria-hidden="true">
          <circle cx="27" cy="27" r="22" className="ad-setup__ring-track" />
          <circle cx="27" cy="27" r="22" className="ad-setup__ring-fill" strokeDasharray={dash} transform="rotate(-90 27 27)" />
        </svg>
        <div className="ad-setup__copy">
          <h2 id="ad-setup-title">
            {doneCount} of {total} steps done
          </h2>
          {next && (
            <p>
              Next: {next.title.charAt(0).toLowerCase() + next.title.slice(1)}. {next.text}
            </p>
          )}
        </div>
      </div>

      {next && (
        <button type="button" className="artist-btn artist-btn--primary ad-setup__next" onClick={() => onAction(next.key)}>
          <Check size={16} aria-hidden="true" /> {next.action || next.title}
        </button>
      )}

      <button
        type="button"
        className="ad-card__link ad-setup__toggle"
        aria-expanded={open}
        aria-controls="ad-setup-list"
        onClick={() => setOpen((o) => !o)}
      >
        {open ? 'Hide steps' : 'See all steps'} <ChevronDown size={14} aria-hidden="true" className={open ? 'is-flipped' : ''} />
      </button>

      {open && (
        <ol className="ad-setup__list" id="ad-setup-list">
          {steps.map((step) => (
            <li key={step.key} className={`ad-setup__step ${step.done ? 'is-done' : ''}`}>
              <span className="ad-setup__check" aria-hidden="true">
                {step.done && <Check size={14} strokeWidth={3} />}
              </span>
              <div className="ad-setup__stepcopy">
                <strong>
                  {step.title}
                  {step.done && <span className="sr-only"> (done)</span>}
                </strong>
                {!step.done && <span>{step.text}</span>}
              </div>
              {!step.done && (
                <button type="button" className="ad-setup__action" onClick={() => onAction(step.key)}>
                  {step.action}
                </button>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
};

// =============================================================================
// This week — the fan funnel's week, as stat tiles with the change since last week.
// =============================================================================
const WeekStats = ({ artistId, totals }) => {
  const { data, loading, error, retry } = useArtistRead(
    artistId ? `/v1/artist-analytics/artist/${artistId}/fanbase?period=week` : null
  );
  const stages = data?.funnel || [];

  return (
    <section className="ad-card" aria-labelledby="ad-week-title">
      <h2 id="ad-week-title" className="ad-card__title">
        This <em>week</em>
      </h2>
      <p className="ad-card__sub">Compared with last week</p>
      {loading ? (
        <CardLoading label="Loading this week…" />
      ) : error ? (
        <CardError onRetry={retry} />
      ) : stages.length === 0 ? (
        <p className="ad-card__note">Your first plays will show up here.</p>
      ) : (
        <div className="ad-stats">
          {stages.map((stage) => {
            const delta = formatDelta(stage.delta);
            const total = totals[stage.key];
            return (
              <div className="ad-stat" key={stage.key}>
                <div className="ad-stat__top">
                  <strong className="ad-stat__value">{formatNumber(stage.value)}</strong>
                  {delta && <span className={`ad-stat__delta is-${delta.tone}`}>{delta.text}</span>}
                </div>
                <span className="ad-stat__label">{stage.label}</span>
                {total != null && <span className="ad-stat__total">{formatNumber(total)} all time</span>}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

// =============================================================================
// Latest release — what came out last, and how far the follower alert went.
// =============================================================================
const daysSince = (iso) => {
  const t = Date.parse(iso || '');
  if (Number.isNaN(t)) return null;
  const now = new Date();
  const then = new Date(t);
  const a = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const b = new Date(then.getFullYear(), then.getMonth(), then.getDate()).getTime();
  return Math.max(0, Math.round((a - b) / 86400000));
};

const outLine = (days) => {
  if (days == null) return '';
  if (days === 0) return 'out today';
  if (days === 1) return 'out 1 day';
  return `out ${days} days`;
};

const LatestRelease = ({ releases, songs }) => {
  const [reach, setReach] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    fetchReach()
      .then((r) => {
        if (active) setReach(r);
      })
      .catch((err) => console.error('Release reach failed:', err))
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const latest = releases?.[0] || null;
  if (!loaded && !latest) return null;

  // The latest alert when there is one (a release or a song); otherwise the latest release.
  let item = null;
  if (reach && (reach.kind === 'SONG' || reach.releaseId)) {
    item = {
      kind: reach.kind,
      id: reach.kind === 'RELEASE' ? reach.releaseId : reach.songId,
      title: reach.title,
      cover: reach.coverUrl,
      type: reach.kind === 'RELEASE' ? RELEASE_TYPE_LABEL[reach.releaseType] || 'Release' : 'Song',
      at: reach.at,
      reach: reach.reach,
      newFollowers: reach.newFollowersSince,
    };
  } else if (latest) {
    item = {
      kind: 'RELEASE',
      id: latest.releaseId,
      title: latest.title,
      cover: latest.coverUrl,
      type: RELEASE_TYPE_LABEL[latest.type] || 'Release',
      at: latest.releasedAt,
      reach: null,
      newFollowers: null,
    };
  }
  if (!item) return null;

  const tracks = (songs || []).filter((s) =>
    item.kind === 'RELEASE' ? s.releaseId === item.id : (s.songId || s.id) === item.id
  );
  const plays = tracks.reduce((n, s) => n + Number(s.playCount || s.plays || 0), 0);
  const likes = tracks.reduce((n, s) => n + Number(s.likes || s.likeCount || 0), 0);
  const votes = tracks.reduce((n, s) => n + Number(s.votes || s.voteCount || 0), 0);
  const href = item.kind === 'RELEASE' ? `/release/${item.id}` : `/song/${item.id}`;
  const cover = buildUrl(item.cover);

  return (
    <section className="ad-card ad-latest" aria-labelledby="ad-latest-title">
      <h2 id="ad-latest-title" className="ad-card__title">
        Latest <em>release</em>
      </h2>
      <Link to={href} className="ad-latest__item">
        {cover ? <img src={cover} alt="" className="ad-latest__art" /> : <span className="ad-latest__art" aria-hidden="true" />}
        <span className="ad-latest__text">
          <span className="ad-latest__kicker">
            {item.type}
            {item.at ? ` · ${outLine(daysSince(item.at))}` : ''}
          </span>
          <strong>{item.title}</strong>
          <span className="ad-latest__meta">
            {formatNumber(plays)} plays · {formatNumber(likes)} likes · {formatNumber(votes)} votes
          </span>
        </span>
      </Link>
      {item.reach != null && (
        <p className="ad-latest__reach">
          <Bell size={16} aria-hidden="true" />
          <span>
            Sent to <b>{formatNumber(item.reach)} {item.reach === 1 ? 'follower' : 'followers'}</b>
            {item.newFollowers > 0 ? ` · ${formatNumber(item.newFollowers)} new ${item.newFollowers === 1 ? 'follower' : 'followers'} since` : ''}
          </span>
        </p>
      )}
    </section>
  );
};

// =============================================================================
// Balance — what's waiting toward the payout minimum.
// =============================================================================
const Balance = ({ earningsSummary, phoneVerified, onVerify, onOpenEarnings }) => {
  const balance = Number.parseFloat(earningsSummary?.currentBalance || 0) || 0;
  const threshold = Number.parseFloat(earningsSummary?.payoutThreshold || 50) || 50;
  const pct = Math.min(100, Math.round((balance / threshold) * 100));
  const toGo = Math.max(0, threshold - balance);

  return (
    <section className="ad-card ad-balance" aria-labelledby="ad-balance-title">
      <div className="ad-balance__row">
        <h2 id="ad-balance-title">Balance</h2>
        <strong className="ad-balance__amount">
          ${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </strong>
      </div>
      <div
        className="ad-balance__bar"
        role="progressbar"
        aria-label="Progress toward the payout minimum"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
      >
        <span style={{ width: `${pct}%` }} />
      </div>
      <p className="ad-balance__note">
        {toGo > 0
          ? `$${toGo.toFixed(2)} to the $${threshold.toFixed(0)} payout minimum. Banks are paid on the 1st.`
          : 'Ready to withdraw. Banks are paid on the 1st.'}
      </p>
      {!phoneVerified && (
        <div className="ad-warn">
          <span>Verify your phone so this reaches you.</span>
          <button type="button" onClick={onVerify}>
            Verify
          </button>
        </div>
      )}
      <button type="button" className="ad-card__link" onClick={onOpenEarnings}>
        Open Earnings <ArrowRight size={14} aria-hidden="true" />
      </button>
    </section>
  );
};

// =============================================================================
// Supporters — the count, the newest faces, one message to all of them.
// =============================================================================
const Supporters = ({ artistId, fallbackCount, onOpenFans, canMessage }) => {
  const { data, loading, error, retry } = useArtistRead(
    artistId ? `/v1/artist-analytics/artist/${artistId}/supporters` : null
  );
  const [composerOpen, setComposerOpen] = useState(false);
  const count = Number(data?.supportersCount ?? fallbackCount ?? 0);
  const recent = (data?.recentSupporters || []).slice(0, 5);
  const newLast30 = (data?.supporterGrowth || []).reduce((sum, g) => sum + Number(g.count || 0), 0);

  return (
    <section className="ad-card ad-sup" aria-labelledby="ad-sup-title">
      <div className="ad-balance__row">
        <h2 id="ad-sup-title">Supporters</h2>
        <strong className="ad-balance__amount">{formatNumber(count)}</strong>
      </div>
      {loading ? (
        <CardLoading label="Loading your supporters…" />
      ) : error ? (
        <CardError onRetry={retry} />
      ) : count === 0 ? (
        <p className="ad-card__note">When a listener picks you as their artist, they show up here by name.</p>
      ) : (
        <>
          <div className="ad-sup__line">
            {recent.length > 0 && (
              <ul className="ad-faces" aria-label="Newest supporters">
                {recent.map((s) => (
                  <li key={s.userId} title={s.username}>
                    {s.photoUrl ? (
                      <img
                        src={buildUrl(s.photoUrl)}
                        alt={s.username || 'Supporter'}
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      <span aria-label={s.username || 'Supporter'}>{initialOf(s.username)}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <span className="ad-sup__new">
              {newLast30 > 0 ? `${formatNumber(newLast30)} new in 30 days` : 'Each sends you 15% of their share'}
            </span>
          </div>
          {canMessage && (
            <button type="button" className="artist-btn artist-btn--ghost ad-card__cta" onClick={() => setComposerOpen(true)}>
              <Megaphone size={16} aria-hidden="true" /> Message all supporters
            </button>
          )}
        </>
      )}
      <button type="button" className="ad-card__link" onClick={onOpenFans}>
        Open Fans <ArrowRight size={14} aria-hidden="true" />
      </button>
      {composerOpen && <BroadcastComposer supporterCount={count} onClose={() => setComposerOpen(false)} />}
    </section>
  );
};

// =============================================================================
// The tab
// =============================================================================
const ArtistHomeTab = ({
  artistId,
  setupSteps,
  onSetupAction,
  totals,
  latestWin,
  earningsSummary,
  phoneVerified,
  onVerifyPhone,
  supportersCount,
  onGoTab,
  jurisdictionId,
  placeName,
  releases,
  songs,
  canEdit = true,
}) => {
  const setupDone = setupSteps.every((s) => s.done);

  return (
    <div className="ad-home">
      <div className="ad-home__main">
        {!setupDone && <SetupCard steps={setupSteps} onAction={onSetupAction} />}
        <WeekStats artistId={artistId} totals={totals} />
        <LatestRelease releases={releases} songs={songs} />
      </div>

      <aside className="ad-home__side" aria-label="At a glance">
        <LiveStanding
          artistId={artistId}
          jurisdictionId={jurisdictionId}
          placeName={placeName}
          latestWin={latestWin}
          onOpen={() => onGoTab('races')}
        />
        <Balance
          earningsSummary={earningsSummary}
          phoneVerified={phoneVerified}
          onVerify={onVerifyPhone}
          onOpenEarnings={() => onGoTab('earnings')}
        />
        <Supporters
          artistId={artistId}
          fallbackCount={supportersCount}
          onOpenFans={() => onGoTab('fans')}
          canMessage={canEdit}
        />
        <Link to={`/artist/${artistId}`} className="ad-home__public">
          See your page the way fans do <ArrowRight size={14} aria-hidden="true" />
        </Link>
      </aside>
    </div>
  );
};

export default ArtistHomeTab;
