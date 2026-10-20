import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import Layout from './layout';
import WinnersTimeline from './winnersTimeline';
import { apiCall } from './components/axiosInstance';
import AdSlot from './components/AdSlot';
import './winnersTimeline.scss';

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

  // Resolve the UUID once here rather than letting the timeline do its own
  // byName round-trip on every interval switch.
  const [jurId, setJurId] = useState(null);

  useEffect(() => {
    let active = true;

    apiCall({
      method: 'get',
      url: `/v1/jurisdictions/byName/${encodeURIComponent(jurName)}`,
    })
      .then((res) => {
        if (!active) return;
        const body = res.data;
        const first = Array.isArray(body) ? body[0] : body;
        if (first?.jurisdictionId) setJurId(first.jurisdictionId);
      })
      .catch((err) =>
        console.error('[winnersPage] byName lookup failed:', err?.message || err)
      );

    return () => {
      active = false;
    };
  }, [jurName]);

  return (
    <Layout>
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
            jurisdictionId={jurId}
            initialInterval={initialInterval}
            initialCategory={initialCategory}
            variant="full"
            initialCount={5}
            pageSize={5}
          />
        </div>

        {/* The ad space: a local sponsor, AdSense, or a Unis card (none for
            Unis Plus members). Sticky rail on desktop, banner on phones. */}
        <AdSlot placement="winners" variant="rail" className="wt-page-ad" />
      </div>
    </Layout>
  );
};

export default WinnersTimelinePage;