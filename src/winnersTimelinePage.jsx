import React from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import Layout from './layout';
import WinnersTimeline from './winnersTimeline';
import './winnersTimeline.scss';
import prominentArtistBg from './assets/songartworkfour.jpeg';

// ═══════════════════════════════════════════════════════════
// FULL-PAGE archive view
//
// Route: /jurisdiction/:jurisdiction/winners
//        ?interval=week&category=song
//
// Layout assumes the global Layout component already reserves
// space for the right-hand sidebar (~200px on desktop).
// Inside that, we split into:
//   ┌─────────────────────────┬─────────────────┐
//   │  Timeline (main)        │  Ad rail (~220) │
//   └─────────────────────────┴─────────────────┘
//   On mobile, ad rail collapses to top banner.
// ═══════════════════════════════════════════════════════════

const VALID_INTERVALS = new Set(['day', 'week', 'month', 'quarter', 'midterm', 'year']);
const VALID_CATEGORIES = new Set(['song', 'artist']);

const WinnersTimelinePage = () => {
  const { jurisdiction } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const jurName = jurisdiction
    ? decodeURIComponent(jurisdiction)
    : 'Downtown Harlem';

  const intervalParam = searchParams.get('interval');
  const categoryParam = searchParams.get('category');

  const initialInterval = VALID_INTERVALS.has(intervalParam)
    ? intervalParam
    : 'week';
  const initialCategory = VALID_CATEGORIES.has(categoryParam)
    ? categoryParam
    : 'song';

  return (
    <Layout backgroundImage={prominentArtistBg}>
      <div className="wt-page">
        <button
          type="button"
          className="wt-back"
          onClick={() =>
            navigate(`/jurisdiction/${encodeURIComponent(jurName)}`)
          }
        >
          ← Back to {jurName}
        </button>

        <div className="wt-page-main">
          <WinnersTimeline
            jurisdiction={jurName}
            initialInterval={initialInterval}
            initialCategory={initialCategory}
            variant="full"
            initialCount={5}
            pageSize={5}
          />
        </div>

        {/*
          Ad rail placeholder. Sticky on desktop so it stays visible
          as the user scrolls through history. Becomes a top banner
          on mobile. When AdSense is wired in, replace the inner
          contents with the ad unit. Refreshes happen on each
          "Load more" page reveal — that hookup lives inside
          WinnersTimeline.handleLoadMore for now.
        */}
        <aside className="wt-page-ad-slot" aria-label="Sponsored">
          <div className="wt-ad-inner">
            <span className="wt-ad-label">Ad space</span>
            <span className="wt-ad-note">
              Partnership pending — refreshes every 5 winners loaded
            </span>
          </div>
        </aside>
      </div>
    </Layout>
  );
};

export default WinnersTimelinePage;