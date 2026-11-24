// src/SongReleaseLink.jsx — "From the mixtape · Uptown Static · track 2" on the song page.
// Shown only when the song is on a release; one tap opens the release page.
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Disc3 } from 'lucide-react';
import { apiCall } from './components/axiosInstance';
import { buildUrl } from './utils/buildUrl';
import './songReleaseLink.scss';

const FROM = { ALBUM: 'From the album', EP: 'From the EP', MIXTAPE: 'From the mixtape', SINGLE: 'From the single' };

const SongReleaseLink = ({ releaseId, trackNumber }) => {
  const [release, setRelease] = useState(null);

  useEffect(() => {
    if (!releaseId) { setRelease(null); return undefined; }
    let cancelled = false;
    apiCall({ url: `/v1/releases/${releaseId}`, method: 'get', useCache: false })
      .then((res) => { if (!cancelled) setRelease(res.data?.release || null); })
      .catch((err) => {
        console.error('Release link failed to load:', releaseId, err);
        if (!cancelled) setRelease(null);
      });
    return () => { cancelled = true; };
  }, [releaseId]);

  if (!release) return null;
  const cover = buildUrl(release.coverUrl);

  return (
    <Link to={`/release/${release.releaseId}`} className="sp-release-link">
      {cover
        ? <img src={cover} alt="" className="sp-release-link__art" />
        : <span className="sp-release-link__art sp-release-link__art--empty"><Disc3 size={20} /></span>}
      <span className="sp-release-link__text">
        <span className="sp-release-link__from">{FROM[release.type] || 'From'}</span>
        <span className="sp-release-link__title">
          {release.title}{trackNumber ? ` · track ${trackNumber}` : ''}
        </span>
      </span>
      <ChevronRight size={18} aria-hidden="true" />
    </Link>
  );
};

export default SongReleaseLink;
