// =============================================================================
// ProfilePhotos — the Instagram-style photo grid on a listener's profile
// (/user/:userId), rendered by ListenerPage directly under Follow / Find similar.
//
// Data:   GET    /v1/users/{ownerId}/photos  → { photos, max, hidden, visibility? }
//         POST   /v1/users/{ownerId}/photos  (multipart, owner only, one at a time)
//         DELETE /v1/users/{ownerId}/photos/{photoId}           (owner only)
//         POST | DELETE /v1/users/{ownerId}/photos/{photoId}/like
//
// Visibility is decided by the server (ArtistPhotoService.canView — the under-18
// safeguard + the "Public profile" toggle). `hidden: true` means this viewer may
// not see the gallery; the owner gets `visibility` so we can tell them who can.
//
// The open photo lives in the URL (?photo=<id>) so the phone's back gesture
// closes the viewer instead of leaving the profile. Those navigations pass
// state.preserveScroll so ScrollToTop leaves the page where it is.
//
// Photo likes award no points (server side) — nothing here touches RewardContext.
// =============================================================================

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Plus, Lock, Camera } from "lucide-react";
import { apiCall } from "./components/axiosInstance";
import { buildUrl } from "./utils/buildUrl";
import { useAuth } from "./context/AuthContext";
import PhotoViewer from "./PhotoViewer";
import "./ProfilePhotos.scss";

const DEFAULT_MAX = 15;               // mirrors ArtistPhotoService.MAX_PHOTOS; server wins
const MAX_BYTES = 10 * 1024 * 1024;   // mirrors the server's 10MB limit
const SKELETON_TILES = 6;
const NOTICE_MS = 3200;

// What the owner is told about who sees their photos (never shown to others).
const VISIBILITY_NOTES = {
  private: "Your profile is set to private, so only people you follow back can see your photos.",
  under18: "Because you're under 18, only people you follow back can see your photos.",
  noBirthdate: "Only people you follow back can see your photos, because your account has no date of birth.",
};

const GridIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
    <rect x="3" y="3" width="18" height="18" rx="2.5" stroke="currentColor" strokeWidth="1.9" />
    <path d="M9 3v18M15 3v18M3 9h18M3 15h18" stroke="currentColor" strokeWidth="1.9" />
  </svg>
);

const SmallHeart = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
    <path d="M12 20.4s-8.4-5.5-8.4-11.2A4.7 4.7 0 0112 6.5a4.7 4.7 0 018.4 2.7c0 5.7-8.4 11.2-8.4 11.2z" />
  </svg>
);

const ProfilePhotos = ({ ownerId, ownerName, ownerAvatar, isSelf }) => {
  const { user: authUser } = useAuth();
  const signedIn = Boolean(authUser?.userId);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [photos, setPhotos] = useState([]);           // server order: oldest first
  const [max, setMax] = useState(DEFAULT_MAX);
  const [hidden, setHidden] = useState(false);
  const [visibility, setVisibility] = useState(null);
  const [status, setStatus] = useState("loading");    // loading | ready | error
  const [pending, setPending] = useState([]);         // [{ key, preview }] uploads in flight
  const [uploadError, setUploadError] = useState(null);
  const [notice, setNotice] = useState(null);

  const inputRef = useRef(null);
  const photosRef = useRef(photos);
  photosRef.current = photos;
  const pushedRef = useRef(false);   // true when WE pushed ?photo=, so close = history back
  const likeSync = useRef({});       // photoId → { inFlight, want }
  const noticeTimer = useRef(null);

  // Instagram order: newest top-left
  const ordered = useMemo(() => [...photos].reverse(), [photos]);

  // ------------------------------------------------------------------ load
  const load = useCallback(async () => {
    if (!ownerId) return;
    setStatus("loading");
    try {
      const res = await apiCall({ url: `/v1/users/${ownerId}/photos`, useCache: false });
      const data = res.data || {};
      setPhotos(Array.isArray(data.photos) ? data.photos : []);
      if (data.max) setMax(Number(data.max));
      setHidden(Boolean(data.hidden));
      setVisibility(data.visibility || null);
      setStatus("ready");
      console.log("Profile photos loaded:", ownerId, (data.photos || []).length, data.hidden ? "(hidden)" : "");
    } catch (err) {
      console.error("Profile photos load failed:", ownerId, err);
      setStatus("error");
    }
  }, [ownerId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => () => clearTimeout(noticeTimer.current), []);

  const flash = useCallback((msg) => {
    clearTimeout(noticeTimer.current);
    setNotice(msg);
    noticeTimer.current = setTimeout(() => setNotice(null), NOTICE_MS);
  }, []);

  // ------------------------------------------------------- URL-backed viewer
  const openId = searchParams.get("photo");
  const openIndex = openId ? ordered.findIndex((p) => p.photoId === openId) : -1;

  const writePhotoParam = useCallback((photoId, { replace }) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (photoId) next.set("photo", photoId);
      else next.delete("photo");
      return next;
    }, { replace, state: { preserveScroll: true } });
  }, [setSearchParams]);

  // Browser back already removed the param → our next close must not go back again.
  useEffect(() => { if (!openId) pushedRef.current = false; }, [openId]);

  // Stale or not-allowed ?photo= (deleted, hidden, bad link) → drop it quietly.
  useEffect(() => {
    if (status === "ready" && openId && openIndex === -1) writePhotoParam(null, { replace: true });
  }, [status, openId, openIndex, writePhotoParam]);

  const openAt = (i) => {
    const p = ordered[i];
    if (!p) return;
    pushedRef.current = true;
    writePhotoParam(p.photoId, { replace: false });
  };

  const showIndex = useCallback((i) => {
    const p = ordered[i];
    if (p) writePhotoParam(p.photoId, { replace: true });
  }, [ordered, writePhotoParam]);

  const closeViewer = useCallback(() => {
    setNotice(null);
    if (pushedRef.current) {
      pushedRef.current = false;
      navigate(-1);
    } else {
      writePhotoParam(null, { replace: true });
    }
  }, [navigate, writePhotoParam]);

  // ------------------------------------------------------------------ likes
  // Optimistic. If the person changes their mind while a request is in flight,
  // we send one more request for their final choice instead of racing.
  const patchPhoto = (photoId, fn) =>
    setPhotos((prev) => prev.map((p) => (p.photoId === photoId ? fn(p) : p)));

  const syncLike = useCallback(async (photoId) => {
    const s = likeSync.current[photoId];
    if (!s || s.inFlight) return;
    s.inFlight = true;
    const sending = s.want;
    try {
      const res = await apiCall({
        method: sending ? "post" : "delete",
        url: `/v1/users/${ownerId}/photos/${photoId}/like`,
      });
      s.inFlight = false;
      if (s.want !== sending) { syncLike(photoId); return; }
      delete likeSync.current[photoId];
      const serverCount = Number(res.data?.likeCount);
      if (Number.isFinite(serverCount)) patchPhoto(photoId, (p) => ({ ...p, likedByMe: sending, likeCount: serverCount }));
      console.log(`Photo ${sending ? "liked" : "unliked"}:`, photoId);
    } catch (err) {
      s.inFlight = false;
      console.error(`Photo ${sending ? "like" : "unlike"} failed:`, photoId, err);
      if (s.want !== sending) { syncLike(photoId); return; }
      delete likeSync.current[photoId];
      patchPhoto(photoId, (p) => ({
        ...p,
        likedByMe: !sending,
        likeCount: Math.max(0, (Number(p.likeCount) || 0) + (sending ? -1 : 1)),
      }));
      flash(sending ? "Couldn't like that photo. Try again." : "Couldn't remove your like. Try again.");
    }
  }, [ownerId, flash]);

  const setLiked = useCallback((photoId, want) => {
    const current = photosRef.current.find((p) => p.photoId === photoId);
    if (!current) return;
    if (Boolean(current.likedByMe) === want && !likeSync.current[photoId]) return; // nothing to change
    patchPhoto(photoId, (p) => (Boolean(p.likedByMe) === want ? p : {
      ...p,
      likedByMe: want,
      likeCount: Math.max(0, (Number(p.likeCount) || 0) + (want ? 1 : -1)),
    }));
    const s = likeSync.current[photoId] || (likeSync.current[photoId] = { inFlight: false, want });
    s.want = want;
    syncLike(photoId);
  }, [syncLike]);

  // ---------------------------------------------------------------- delete
  // Move the viewer off the photo FIRST, and drop it from the list only once
  // the URL has moved. Router updates land in a transition, after plain state
  // updates — removing it immediately would briefly leave ?photo= pointing at
  // nothing, unmounting the viewer and tripping the stale-param cleanup.
  const pendingRemoval = useRef(null);

  const deletePhoto = useCallback(async (photoId) => {
    await apiCall({ method: "delete", url: `/v1/users/${ownerId}/photos/${photoId}` }); // viewer shows the error
    console.log("Profile photo deleted:", photoId);
    const idx = ordered.findIndex((p) => p.photoId === photoId);
    const neighbour = ordered[idx + 1] || ordered[idx - 1];
    pendingRemoval.current = photoId;
    if (neighbour) writePhotoParam(neighbour.photoId, { replace: true });
    else closeViewer();
  }, [ownerId, ordered, writePhotoParam, closeViewer]);

  useEffect(() => {
    const id = pendingRemoval.current;
    if (id && openId !== id) {
      pendingRemoval.current = null;
      setPhotos((prev) => prev.filter((p) => p.photoId !== id));
    }
  }, [openId]);

  // ---------------------------------------------------------------- upload
  const remaining = Math.max(0, max - photos.length);
  const uploading = pending.length > 0;

  const handleFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (inputRef.current) inputRef.current.value = "";
    if (files.length === 0) return;
    setUploadError(null);

    const problems = [];
    const accepted = files.filter((f) => {
      if (!f.type || !f.type.startsWith("image/")) { problems.push(`${f.name} isn't an image.`); return false; }
      if (f.size > MAX_BYTES) { problems.push(`${f.name} is over 10MB.`); return false; }
      return true;
    });
    const batch = accepted.slice(0, remaining);
    if (accepted.length > batch.length) {
      problems.push(`You can add ${remaining} more photo${remaining === 1 ? "" : "s"} (limit ${max}).`);
    }

    const items = batch.map((file, i) => ({
      key: `${Date.now()}-${i}`,
      file,
      preview: URL.createObjectURL(file),
    }));
    setPending(items.map(({ key, preview }) => ({ key, preview })));

    // One at a time so the server cap is enforced cleanly and one bad file
    // doesn't sink the rest.
    for (const item of items) {
      const form = new FormData();
      form.append("file", item.file);
      let stop = false;
      try {
        const res = await apiCall({
          method: "post",
          url: `/v1/users/${ownerId}/photos`,
          data: form,
          headers: { "Content-Type": "multipart/form-data" },
        });
        const saved = res.data || {};
        console.log("Profile photo uploaded:", saved.photoId);
        if (saved.photoId) setPhotos((prev) => [...prev, { ...saved, likeCount: 0, likedByMe: false }]);
      } catch (err) {
        console.error("Profile photo upload failed:", item.file.name, err);
        problems.push(err.response?.data?.error || `${item.file.name} didn't upload. Try again.`);
        stop = err.response?.status === 409; // hit the cap — the rest would fail too
      } finally {
        URL.revokeObjectURL(item.preview);
        setPending((prev) => prev.filter((p) => p.key !== item.key));
      }
      if (stop) break;
    }
    items.forEach((item) => URL.revokeObjectURL(item.preview)); // any skipped after a stop
    setPending([]);

    if (problems.length) {
      setUploadError(problems[0] + (problems.length > 1 ? ` (${problems.length - 1} more didn't upload.)` : ""));
    }
  };

  const pickFiles = () => inputRef.current?.click();

  // ---------------------------------------------------------------- render
  const count = photos.length;
  const showAdd = isSelf && status === "ready" && remaining > 0;
  const selfNote = isSelf && visibility && VISIBILITY_NOTES[visibility];

  let body;
  if (status === "loading") {
    body = (
      <>
        <span className="pph-sr" role="status">Loading photos</span>
        <div className="pph-grid" aria-hidden="true">
          {Array.from({ length: SKELETON_TILES }, (_, i) => <div key={i} className="pph-tile pph-tile--skeleton" />)}
        </div>
      </>
    );
  } else if (status === "error") {
    body = (
      <div className="pph-empty">
        <p className="pph-empty__title">Couldn't load photos</p>
        <button type="button" className="pph-btn" onClick={load}>Try again</button>
      </div>
    );
  } else if (hidden && !isSelf) {
    body = (
      <div className="pph-empty">
        <span className="pph-empty__icon"><Lock size={24} aria-hidden="true" /></span>
        <p className="pph-empty__title">These photos are private</p>
        <p className="pph-empty__sub">{ownerName}'s photos are visible to people they follow back.</p>
      </div>
    );
  } else if (count === 0 && !uploading) {
    body = isSelf ? (
      <div className="pph-empty">
        <span className="pph-empty__icon"><Camera size={24} aria-hidden="true" /></span>
        <p className="pph-empty__title">Share your first photo</p>
        <p className="pph-empty__sub">
          {selfNote ? "Photos you add show up here." : "Photos you add show up here for anyone who visits your profile."}
        </p>
        <button type="button" className="pph-btn pph-btn--primary" onClick={pickFiles}>Add photos</button>
      </div>
    ) : (
      <div className="pph-empty pph-empty--quiet">
        <span className="pph-empty__icon"><Camera size={22} aria-hidden="true" /></span>
        <p className="pph-empty__title">No photos yet</p>
      </div>
    );
  } else {
    body = (
      <ul className="pph-grid" role="list">
        {[...pending].reverse().map((p) => (
          <li key={p.key} className="pph-tile pph-tile--pending" aria-busy="true">
            <img src={p.preview} alt="" />
            <span className="pph-spinner" aria-hidden="true" />
            <span className="pph-sr">Uploading photo</span>
          </li>
        ))}
        {ordered.map((photo, i) => {
          const likes = Number(photo.likeCount) || 0;
          return (
            <li key={photo.photoId} className="pph-cell">
              <button
                type="button"
                className="pph-tile"
                onClick={() => openAt(i)}
                aria-label={`Open photo ${i + 1} of ${count}${likes ? `, ${likes} ${likes === 1 ? "like" : "likes"}` : ""}`}
              >
                <img src={buildUrl(photo.photoUrl)} alt="" loading="lazy" decoding="async" draggable={false} />
                <span className="pph-tile__meta" aria-hidden="true">
                  {likes > 0 && (<><SmallHeart /> {likes.toLocaleString()}</>)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <section className="pph" aria-labelledby="pph-heading">
      <div className="pph-inner">
        <div className="pph-strip">
          <h2 id="pph-heading" className="pph-strip__tab">
            <GridIcon /> Photos
            {status === "ready" && !hidden && count > 0 && <span className="pph-strip__count">{count}</span>}
          </h2>
          {showAdd && (
            <button type="button" className="pph-add" onClick={pickFiles} disabled={uploading}>
              <Plus size={15} aria-hidden="true" /> {uploading ? "Adding…" : "Add"}
            </button>
          )}
        </div>

        {selfNote && (
          <p className="pph-note"><Lock size={13} aria-hidden="true" /> {selfNote}</p>
        )}
        {isSelf && status === "ready" && remaining === 0 && (
          <p className="pph-cap">You've reached the {max}-photo limit. Delete one to add another.</p>
        )}
        {uploadError && <p className="pph-error" role="alert">{uploadError}</p>}

        {body}
      </div>

      {isSelf && (
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          data-testid="pph-file-input"
          onChange={(e) => handleFiles(e.target.files)}
        />
      )}

      {openIndex !== -1 && (
        <PhotoViewer
          photos={ordered}
          index={openIndex}
          ownerName={ownerName}
          ownerAvatar={ownerAvatar}
          isSelf={isSelf}
          signedIn={signedIn}
          notice={notice}
          onClose={closeViewer}
          onIndexChange={showIndex}
          onSetLiked={setLiked}
          onDelete={deletePhoto}
        />
      )}
    </section>
  );
};

export default ProfilePhotos;
