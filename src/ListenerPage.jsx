import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { buildUrl } from "../utils/buildUrl";
import { apiCall } from "../components/axiosInstance";
import { useAuth } from "../context/AuthContext";
import Layout from "../layout";
import VoteHistorySection from "../VoteHistorySection"; // ★ read-only; fetches the logged-in user's votes (self-view only)
import "./ListenerPage.scss";

// ----------------------------------------------------------------------------
// inline icons
// ----------------------------------------------------------------------------
const Diamond = () => (<svg width="16" height="16" viewBox="0 0 12 12" fill="currentColor"><path d="M6 .8l3.3 3.4L6 11.2 2.7 4.2 6 .8z" /></svg>);
const Headphones = () => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M4 13v-1a8 8 0 0116 0v1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><rect x="3" y="13" width="4" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.8" /><rect x="17" y="13" width="4" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.8" /></svg>);
const Crown = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M3 7l4 4 5-7 5 7 4-4-2 12H5L3 7z" /></svg>);
const Pin = () => (<svg width="15" height="15" viewBox="0 0 20 20" fill="none"><path d="M10 2c-3.3 0-6 2.7-6 6 0 4.5 6 10 6 10s6-5.5 6-10c0-3.3-2.7-6-6-6z" stroke="currentColor" strokeWidth="1.5" /><circle cx="10" cy="8" r="2" stroke="currentColor" strokeWidth="1.5" /></svg>);
const Cal = () => (<svg width="15" height="15" viewBox="0 0 20 20" fill="none"><rect x="3" y="4" width="14" height="13" rx="2" stroke="currentColor" strokeWidth="1.5" /><path d="M3 8h14M7 2v3M13 2v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>);

const BADGE_ICONS = {
  bolt: <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" /></svg>,
  star: <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.8 6.1 20l1.2-6.5L2.5 8.9 9.1 8 12 2z" /></svg>,
  fire: <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c1 3-2 4-2 7 0 1.5 1 2.5 2 2.5S16 12 15 9c3 2 5 5 5 8a8 8 0 11-16 0c0-4 4-6 4-9 0-2 2-4 4-6z" /></svg>,
  heart: <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21S3 14.5 3 8.8A4.8 4.8 0 0112 6a4.8 4.8 0 019 2.8C21 14.5 12 21 12 21z" /></svg>,
  crown: <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M3 7l4 4 5-7 5 7 4-4-2 12H5L3 7z" /></svg>,
  lock: <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="5" y="10" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.8" /><path d="M8 10V7a4 4 0 018 0v3" stroke="currentColor" strokeWidth="1.8" /></svg>,
};

// ----------------------------------------------------------------------------
// helpers
// ----------------------------------------------------------------------------
const fmtCount = (n) => {
  const v = Number(n) || 0;
  if (v >= 1000) return `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k`;
  return `${v}`;
};
const memberSince = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d)) return null;
  return d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
};
// ★ derive badges from real public signals until a badges service exists
const deriveBadges = ({ votes, supporting, level }) => {
  const lvl = (level || "silver").toLowerCase();
  return [
    { i: "bolt", l: "Day One", earned: true },
    { i: "star", l: "First Vote", earned: votes >= 1 },
    { i: "fire", l: "100 Votes", earned: votes >= 100 },
    { i: "heart", l: "Backer", earned: supporting },
    { i: "crown", l: `${lvl[0].toUpperCase()}${lvl.slice(1)} Tier`, earned: lvl !== "silver" },
    { i: "star", l: "Tastemaker", earned: false },
  ];
};

// ----------------------------------------------------------------------------
// page
// ----------------------------------------------------------------------------
const ListenerPage = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user: authUser } = useAuth();

  const [user, setUser] = useState(null);
  const [supportedArtist, setSupportedArtist] = useState(null);
  const [followers, setFollowers] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState("votes");
  const [following, setFollowing] = useState(false);

  const isSelf = authUser?.userId && authUser.userId === userId;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        // ★ public profile endpoint (permitAll, no ownership guard) — not profile-summary (owner-only)
        const profRes = await apiCall({ url: `/v1/users/profile/${userId}` });
        if (cancelled) return;
        const u = profRes.data || {};
        if (u.role === "artist") { navigate(`/artist/${userId}`, { replace: true }); return; }
        setUser(u);

        const [folRes, supRes] = await Promise.all([
          apiCall({ url: `/v1/users/${userId}/followers/count` }).catch(() => null),
          u.supportedArtistId ? apiCall({ url: `/v1/users/profile/${u.supportedArtistId}` }).catch(() => null) : Promise.resolve(null),
        ]);
        if (cancelled) return;
        if (folRes?.data?.count != null) setFollowers(Number(folRes.data.count));
        if (supRes?.data) setSupportedArtist(supRes.data);
      } catch (e) {
        if (!cancelled) setError("Couldn't load this profile.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId, navigate]);

  const toggleFollow = useCallback(async () => {
    const next = !following;
    setFollowing(next); // optimistic
    try {
      await apiCall({ method: next ? "post" : "delete", url: `/v1/users/${userId}/follow` });
    } catch (e) { setFollowing(!next); }
  }, [following, userId]);

  if (loading) {
    return <Layout><div className="lpr-wrap"><div className="lpr-loading"><div className="lpr-loading__spinner" /></div></div></Layout>;
  }
  if (error || !user) {
    return <Layout><div className="lpr-wrap"><div className="lpr-empty"><h3>{error || "Profile not found"}</h3><p>This listener may have moved or set their profile to private.</p></div></div></Layout>;
  }

  const tier = (user.level || "silver").toLowerCase();
  const photo = buildUrl(user.photoUrl);
  const initial = (user.username || "?").charAt(0).toUpperCase();
  const votes = user.totalVotes ?? 0;
  const jName = user.jurisdiction?.name || null;
  const jId = user.jurisdiction?.jurisdictionId || user.jurisdictionId || null;
  const since = memberSince(user.createdAt);
  const badges = deriveBadges({ votes, supporting: Boolean(supportedArtist), level: tier });

  const socials = [
    user.instagramUrl && { label: "Instagram", url: user.instagramUrl, icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="1.6" /><circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.6" /><circle cx="17" cy="7" r="1.2" fill="currentColor" /></svg> },
    user.twitterUrl && { label: "X", url: user.twitterUrl, icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M18 2h3l-7 8 8 12h-6l-5-7-5 7H0l8-9L0 2h6l4 6 5-6z" /></svg> },
    user.tiktokUrl && { label: "TikTok", url: user.tiktokUrl, icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M14 3v10.5a3.5 3.5 0 11-3-3.46" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /><path d="M14 5.5A4.5 4.5 0 0019 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg> },
  ].filter(Boolean);

  const discoverHref = jId ? `/discover?jid=${jId}&jname=${encodeURIComponent(jName || "")}` : "/discover";

  return (
    <Layout>
      <div className="lpr-wrap">
        {/* HERO */}
        <section className="lpr-hero">
          <div className="lpr-avawrap" data-tier={tier}>
            <div className="lpr-ava" data-tier={tier}>
              <div className="img">{photo ? <img src={photo} alt="" /> : initial}</div>
            </div>
            <div className="lpr-hp"><Headphones /></div>
          </div>
          <div className="lpr-id">
            <p className="eyebrow"><span className="dot" /> Listener{jName ? ` · ${jName}` : ""}</p>
            <h1 className="lpr-name">{user.username}</h1>
            <p className="lpr-tagline">
              <b>{tier.toUpperCase()}</b> &nbsp;·&nbsp; <em>{user.bio || "exploring Harlem's finest"}</em>
            </p>

            <div className="lpr-ribbon">
              <div className="lpr-stat points"><div className="v"><Diamond />{fmtCount(user.score)}</div><div className="l">Points</div></div>
              <div className="lpr-stat"><div className="v">{fmtCount(votes)}</div><div className="l">Votes cast</div></div>
              <div className="lpr-stat"><div className="v">{supportedArtist ? 1 : 0}</div><div className="l">Supporting</div></div>
              {followers != null && (
                <div className="lpr-stat"><div className="v">{fmtCount(followers)}</div><div className="l">Followers</div></div>
              )}
            </div>

            <div className="lpr-actions">
              {isSelf ? (
                <>
                  <button className="lpr-btn primary" onClick={() => navigate("/profile")}>Edit profile</button>
                  <button className="lpr-btn ghost" onClick={() => navigate("/profile")}>Share my code</button>
                </>
              ) : (
                <>
                  <button className={`lpr-btn ${following ? "ghost" : "primary"}`} onClick={toggleFollow}>{following ? "Following" : "+ Follow"}</button>
                  <a className="lpr-btn ghost" href={discoverHref}>Find similar</a>
                </>
              )}
            </div>
          </div>
        </section>

        {/* "FREQUENCY" CTA (taste-match slot — real Discover loop; ★ personalized % is future backend) */}
        <section className="lpr-match">
          <div className="lpr-ring" data-static>
            <div className="hole"><div className="pct" style={{ fontSize: "22px" }}>{jName ? jName.split(" ")[0] : "UNIS"}</div><div className="cap">scene</div></div>
          </div>
          <div className="body">
            <p className="k">On the <b>same frequency</b></p>
            <p>Meet listeners {jName ? `in ${jName}` : "near you"} who back the same artists and vote on the same records.</p>
            <a className="lpr-btn primary" href={discoverHref}>Explore {jName || "Discover"} →</a>
          </div>
        </section>

        {/* BODY */}
        <div className="lpr-body">
          <div className="lpr-main">
            {/* Supporting */}
            <div className="lpr-card">
              <h2 className="lpr-sec-title">Backing <em>their artist</em></h2>
              {supportedArtist ? (
                <div className="lpr-support">
                  <div className="a">{buildUrl(supportedArtist.photoUrl) ? <img src={buildUrl(supportedArtist.photoUrl)} alt="" /> : (supportedArtist.username || "?").charAt(0).toUpperCase()}</div>
                  <div className="info">
                    <div className="n">{supportedArtist.username} <span className="crown"><Crown /></span></div>
                    <div className="sub">Backing directly{jName ? ` · ${jName}` : ""}</div>
                  </div>
                  <div className="support-actions">
                    <button className="lpr-btn ghost" onClick={() => navigate(`/artist/${supportedArtist.userId}`)}>Visit</button>
                  </div>
                </div>
              ) : (
                <p className="lpr-soft">Not backing an artist yet.</p>
              )}
            </div>

            {/* Activity */}
            <div className="lpr-card">
              <h2 className="lpr-sec-title">On the <em>record</em></h2>
              <div className="lpr-tabs" role="tablist">
                <button className="lpr-tab" role="tab" aria-selected={tab === "votes"} onClick={() => setTab("votes")}>Votes</button>
                <button className="lpr-tab" role="tab" aria-selected={tab === "comments"} onClick={() => setTab("comments")}>Comments</button>
                <button className="lpr-tab" role="tab" aria-selected={tab === "taste"} onClick={() => setTab("taste")}>Taste</button>
              </div>

              {tab === "votes" && (
                isSelf
                  ? <VoteHistorySection userId={userId} />
                  : (
                    <div className="lpr-soft-block">
                      <div className="big">{fmtCount(votes)}</div>
                      <p>total votes cast{jName ? ` across ${jName} and beyond` : ""}.</p>
                      <span className="hint">Full vote history is shown on a listener's own profile.</span>
                    </div>
                  )
              )}
              {tab === "comments" && (
                <div className="lpr-soft-block"><p>No public comments yet.</p><span className="hint">Comments {user.username} leaves on songs will show up here.</span></div>
              )}
              {tab === "taste" && (
                <div className="lpr-soft-block">
                  <p>{supportedArtist ? `Backs ${supportedArtist.username}.` : "Building a taste profile."} {tier.charAt(0).toUpperCase() + tier.slice(1)} tier listener.</p>
                  <span className="hint">Genre & artist breakdown is coming soon.</span>
                </div>
              )}
            </div>
          </div>

          {/* ASIDE */}
          <div className="lpr-aside">
            <div className="lpr-card">
              <h2 className="lpr-sec-title">Badges <em>earned</em></h2>
              <div className="lpr-badges">
                {badges.map((b, i) => (
                  <div className={`lpr-badge ${b.earned ? "" : "locked"}`} key={i}>
                    <div className="tok">{b.earned ? BADGE_ICONS[b.i] : BADGE_ICONS.lock}</div>
                    <div className="bl">{b.l}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="lpr-card lpr-about">
              <h2 className="lpr-sec-title">About</h2>
              {user.bio && <p>{user.bio}</p>}
              <div className="lpr-meta">
                {jName && <div className="r"><Pin /> <b>{jName}</b></div>}
                {since && <div className="r"><Cal /> Member since <b>{since}</b></div>}
              </div>
              {socials.length > 0 && (
                <div className="lpr-socials">
                  {socials.map((s, i) => (
                    <a key={i} className="lpr-soc" href={s.url} target="_blank" rel="noopener noreferrer" title={s.label}>{s.icon}</a>
                  ))}
                </div>
              )}
            </div>

            <div className="lpr-card">
              <h2 className="lpr-sec-title">Listeners <em>nearby</em></h2>
              <p className="lpr-soft">Discover people {jName ? `in ${jName}` : "near you"} on the same wavelength.</p>
              <a className="lpr-btn ghost full" href={discoverHref}>Open Discover →</a>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default ListenerPage;