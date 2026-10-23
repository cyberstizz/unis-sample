import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  Megaphone,
  Play,
  RefreshCw,
  Trophy,
} from 'lucide-react';
import { apiCall } from './components/axiosInstance';
import buildUrl from './utils/buildUrl';
import { BroadcastComposer } from './SupporterSection';

// =============================================================================
// ArtistHomeTab — the dashboard's first screen.
//
// Leads with what matters today (Spotify for Artists' 2026 Home does the same):
//   left:  setup progress (until done) · this week vs last week · featured song
//   right: where you stand · share balance · supporters
//
// Data:
//   • Everything already loaded by ArtistDashboard comes in as props.
//   • Three small reads of its own, each failing quietly to its own card:
//       /v1/artist-analytics/artist/{id}/fanbase?period=week   (this week)
//       /v1/artist-analytics/artist/{id}/territory-rank        (where you stand)
//       /v1/artist-analytics/artist/{id}/supporters            (newest supporters)
// =============================================================================

const formatNumber = (n) => Number(n || 0).toLocaleString('en-US');
const initialOf = (name) => (name ? name.charAt(0).toUpperCase() : '?');

const formatDelta = (delta) => {
  if (delta === null || delta === undefined) return null;
  const n = Number(delta);
  if (Number.isNaN(n)) return null;
  if (n === 0) return { text: 'No change', tone: 'flat' };
  return { text: `${n > 0 ? '+' : '−'}${formatNumber(Math.abs(n))}`, tone: n > 0 ? 'up' : 'down' };
};

const RANK_PERIOD_LABEL = {
  today: 'Yesterday',
  week: 'This week',
  month: 'This month',
  year: 'This year',
};

// Ring geometry for the setup card's progress (r = 26 in a 64-unit box).
const RING_C = 2 * Math.PI * 26;

// -----------------------------------------------------------------------------
// Small reusable read hook: one GET, its own loading/error, a retry.
// -----------------------------------------------------------------------------
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
// Setup card — the dashboard's wizard. Seven steps, each with its own action
// (steps come from utils/artistSetupSteps.js). Disappears once every step is done.
// =============================================================================
const SetupCard = ({ steps, onAction }) => {
  const doneCount = steps.filter((s) => s.done).length;
  const total = steps.length;
  const next = steps.find((s) => !s.done);
  const dash = `${((RING_C * doneCount) / total).toFixed(1)} ${RING_C.toFixed(1)}`;

  return (
    <section className="ad-card ad-setup" aria-labelledby="ad-setup-title">
      <div className="ad-setup__head">
        <svg className="ad-setup__ring" viewBox="0 0 64 64" role="img" aria-label={`${doneCount} of ${total} setup steps done`}>
          <circle cx="32" cy="32" r="26" className="ad-setup__ring-track" />
          <circle cx="32" cy="32" r="26" className="ad-setup__ring-fill" strokeDasharray={dash} transform="rotate(-90 32 32)" />
          <text x="32" y="37" textAnchor="middle" className="ad-setup__ring-text">
            {doneCount}/{total}
          </text>
        </svg>
        <div>
          <h2 id="ad-setup-title">
            Finish setting <em>up</em>
          </h2>
          <p>{next ? `Next: ${next.title.toLowerCase()}.` : 'All set.'}</p>
        </div>
      </div>

      <ol className="ad-setup__list">
        {steps.map((step) => (
          <li key={step.key} className={`ad-setup__step ${step.done ? 'is-done' : ''}`}>
            <span className="ad-setup__check" aria-hidden="true">
              {step.done && <Check size={14} strokeWidth={3} />}
            </span>
            <div className="ad-setup__copy">
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
    </section>
  );
};

// =============================================================================
// This week — the fan funnel's week view, as cards with the change since
// last week. All-time totals sit under the measures the dashboard already has.
// =============================================================================
const WeekStats = ({ artistId, totals }) => {
  const { data, loading, error, retry } = useArtistRead(
    artistId ? `/v1/artist-analytics/artist/${artistId}/fanbase?period=week` : null
  );
  const stages = data?.funnel || [];

  return (
    <section className="ad-week" aria-labelledby="ad-week-title">
      <div className="ad-week__head">
        <h2 id="ad-week-title">This week</h2>
        <span>Compared with last week</span>
      </div>
      {loading ? (
        <CardLoading label="Loading this week…" />
      ) : error ? (
        <CardError onRetry={retry} />
      ) : stages.length === 0 ? (
        <p className="ad-week__empty">Your first plays will show up here.</p>
      ) : (
        <div className="ad-week__grid">
          {stages.map((stage) => {
            const delta = formatDelta(stage.delta);
            const total = totals[stage.key];
            return (
              <div className="ad-stat" key={stage.key}>
                <span className="ad-stat__label">{stage.label}</span>
                <strong className="ad-stat__value">{formatNumber(stage.value)}</strong>
                {delta && <span className={`ad-stat__delta is-${delta.tone}`}>{delta.text}</span>}
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
// Where you stand — the territory rank's home rows, plus the latest win.
// =============================================================================
const Standing = ({ artistId, latestWin, onOpenRaces }) => {
  const { data, loading, error, retry } = useArtistRead(
    artistId ? `/v1/artist-analytics/artist/${artistId}/territory-rank` : null
  );
  const period = data?.defaultPeriod && data?.periods?.[data.defaultPeriod] ? data.defaultPeriod : 'week';
  const rows = (data?.periods?.[period] || []).slice(0, 4);

  return (
    <section className="ad-card" aria-labelledby="ad-stand-title">
      <h2 id="ad-stand-title" className="ad-card__title">
        Where you <em>stand</em>
      </h2>
      {loading ? (
        <CardLoading label="Loading your rank…" />
      ) : error ? (
        <CardError onRetry={retry} />
      ) : data?.status === 'calculating' || rows.length === 0 ? (
        <p className="ad-card__note">Ranks are worked out once a night. Yours will show here after the next update.</p>
      ) : (
        <>
          <p className="ad-card__sub">{RANK_PERIOD_LABEL[period] || 'Latest'}, as of last night</p>
          <ol className="ad-stand">
            {rows.map((row) => (
              <li key={row.jurisdictionId} className="ad-stand__row">
                <div>
                  <strong>{row.jurisdictionName}</strong>
                  {row.genreRank != null && data.genreName && (
                    <span>
                      #{row.genreRank} in {data.genreName}
                    </span>
                  )}
                </div>
                <span className="ad-stand__rank">{row.overallRank != null ? `#${formatNumber(row.overallRank)}` : '—'}</span>
              </li>
            ))}
          </ol>
        </>
      )}
      {latestWin && (
        <div className="ad-win">
          <Trophy size={16} aria-hidden="true" />
          <span>Latest win: {latestWin}</span>
        </div>
      )}
      <button type="button" className="ad-card__link" onClick={onOpenRaces}>
        Open Races <ArrowRight size={14} aria-hidden="true" />
      </button>
    </section>
  );
};

// =============================================================================
// Share balance — what's waiting toward the payout minimum.
// =============================================================================
const Balance = ({ earningsSummary, phoneVerified, onVerify, onOpenEarnings }) => {
  const balance = Number.parseFloat(earningsSummary?.currentBalance || 0) || 0;
  const threshold = Number.parseFloat(earningsSummary?.payoutThreshold || 50) || 50;
  const pct = Math.min(100, Math.round((balance / threshold) * 100));
  const toGo = Math.max(0, threshold - balance);

  return (
    <section className="ad-card" aria-labelledby="ad-balance-title">
      <h2 id="ad-balance-title" className="ad-card__title">
        Share balance
      </h2>
      <strong className="ad-balance__amount">
        ${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </strong>
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
      <p className="ad-card__note">
        {toGo > 0
          ? `$${toGo.toFixed(2)} more and you can withdraw. Banks are paid on the 1st.`
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
// Supporters — the count, the newest faces, and the one-message-to-all button.
// =============================================================================
const Supporters = ({ artistId, fallbackCount, onOpenFans }) => {
  const { data, loading, error, retry } = useArtistRead(
    artistId ? `/v1/artist-analytics/artist/${artistId}/supporters` : null
  );
  const [composerOpen, setComposerOpen] = useState(false);
  const count = Number(data?.supportersCount ?? fallbackCount ?? 0);
  const recent = (data?.recentSupporters || []).slice(0, 5);
  const newLast30 = (data?.supporterGrowth || []).reduce((sum, g) => sum + Number(g.count || 0), 0);

  return (
    <section className="ad-card" aria-labelledby="ad-sup-title">
      <h2 id="ad-sup-title" className="ad-card__title">
        {formatNumber(count)} {count === 1 ? 'supporter' : 'supporters'}
      </h2>
      {loading ? (
        <CardLoading label="Loading your supporters…" />
      ) : error ? (
        <CardError onRetry={retry} />
      ) : count === 0 ? (
        <p className="ad-card__note">When a listener picks you as their artist, they show up here by name.</p>
      ) : (
        <>
          <p className="ad-card__sub">
            {newLast30 > 0 ? `${formatNumber(newLast30)} new in the last 30 days. ` : ''}
            Each one sends you 15% of their monthly share.
          </p>
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
          <button type="button" className="artist-btn artist-btn--primary ad-card__cta" onClick={() => setComposerOpen(true)}>
            <Megaphone size={15} aria-hidden="true" /> Message all supporters
          </button>
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
  defaultSong,
  featuredArtwork,
  onPlayFeatured,
  onChooseFeatured,
  latestWin,
  earningsSummary,
  phoneVerified,
  onVerifyPhone,
  supportersCount,
  onGoTab,
}) => {
  const setupDone = setupSteps.every((s) => s.done);

  return (
    <div className="ad-home">
      <div className="ad-home__main">
        {!setupDone && <SetupCard steps={setupSteps} onAction={onSetupAction} />}

        <WeekStats artistId={artistId} totals={totals} />

        <div className="artist-featured ad-home__featured" style={{ backgroundImage: `url(${featuredArtwork})` }}>
          <div className="artist-featured__overlay" />
          <div className="artist-featured__content">
            <span className="artist-featured__tag">Featured song</span>
            <h2>{defaultSong?.title || 'No featured song set'}</h2>
            <p>
              {defaultSong
                ? `${formatNumber(defaultSong.playCount)} plays · the first song people hear on your page.`
                : 'Choose the song that should represent you first.'}
            </p>
            <div className="artist-featured__actions">
              <button type="button" className="artist-featured__play" onClick={onPlayFeatured}>
                <Play size={13} fill="currentColor" aria-hidden="true" /> {defaultSong ? 'Play' : 'Choose'}
              </button>
              {defaultSong && (
                <button type="button" className="artist-featured__change" onClick={onChooseFeatured}>
                  Change
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <aside className="ad-home__side" aria-label="At a glance">
        <Standing artistId={artistId} latestWin={latestWin} onOpenRaces={() => onGoTab('races')} />
        <Balance
          earningsSummary={earningsSummary}
          phoneVerified={phoneVerified}
          onVerify={onVerifyPhone}
          onOpenEarnings={() => onGoTab('earnings')}
        />
        <Supporters artistId={artistId} fallbackCount={supportersCount} onOpenFans={() => onGoTab('fans')} />
        <Link to={`/artist/${artistId}`} className="ad-home__public">
          See your page the way fans do <ArrowRight size={14} aria-hidden="true" />
        </Link>
      </aside>
    </div>
  );
};

export default ArtistHomeTab;
