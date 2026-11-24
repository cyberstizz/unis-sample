// src/NewReleaseWizard.jsx — create or edit an album, EP, mixtape or single.
//
// Three steps, like the mockup: 1 details (cover, title, type), 2 songs (pick
// from the artist's songs or upload new, drag to order), 3 review + publish.
// Unis suggests the type from the length (store rules); the artist decides.
// Songs keep their own plays, likes, votes and races.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext, closestCenter, KeyboardSensor, MouseSensor, TouchSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import {
  SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { CSS } from '@dnd-kit/utilities';
import { Check, ChevronRight, GripVertical, ImagePlus, Plus, Upload, X } from 'lucide-react';
import { apiCall } from './components/axiosInstance';
import { useFeedback, errorMessage } from './context/FeedbackContext';
import { buildUrl } from './utils/buildUrl';
import useModalA11y from './hooks/useModalA11y';
import { RELEASE_TYPES, RELEASE_TYPE_LABEL, suggestReleaseType, toSeconds, formatReleaseLength } from './utils/releases';
import './teamAndReleases.scss';

const fmtTime = (d) => {
  const s = toSeconds(d);
  return s ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '';
};

const SongRow = ({ song, index, onRemove }) => {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: song.songId });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`nr-song ${isDragging ? 'is-dragging' : ''}`}
    >
      <span className="nr-song__num">{index + 1}</span>
      <span className="nr-song__title">{song.title}</span>
      <span className="nr-song__time">{fmtTime(song.duration)}</span>
      <button type="button" className="nr-song__x" onClick={() => onRemove(song.songId)} aria-label={`Take ${song.title} off`}>
        <X size={16} />
      </button>
      <button type="button" className="nr-song__grip" ref={setActivatorNodeRef} aria-label={`Reorder ${song.title}`}
        {...attributes} {...listeners}>
        <GripVertical size={18} />
      </button>
    </li>
  );
};

const NewReleaseWizard = ({ open, onClose, songs = [], release = null, onSaved, onUploadNew }) => {
  const feedback = useFeedback();
  const editing = !!release;
  const dialogRef = useRef(null);
  const coverInput = useRef(null);
  useModalA11y({ active: open, onClose, modalRef: dialogRef });

  const [step, setStep] = useState(1);
  const [title, setTitle] = useState('');
  const [type, setType] = useState('SINGLE');
  const [typeTouched, setTypeTouched] = useState(false);
  const [description, setDescription] = useState('');
  const [cover, setCover] = useState(null);         // File
  const [coverPreview, setCoverPreview] = useState(null);
  const [order, setOrder] = useState([]);           // songIds
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);

  // Fill from the release when editing; reset when opened fresh.
  useEffect(() => {
    if (!open) return;
    setStep(1);
    setPicking(false);
    setSaving(false);
    setCover(null);
    if (release) {
      setTitle(release.title || '');
      setType(release.type || 'SINGLE');
      setTypeTouched(true);
      setDescription(release.description || '');
      setCoverPreview(buildUrl(release.coverUrl) || null);
      setOrder((release.trackIds || []).slice());
    } else {
      setTitle('');
      setType('SINGLE');
      setTypeTouched(false);
      setDescription('');
      setCoverPreview(null);
      setOrder([]);
    }
  }, [open, release]);

  useEffect(() => () => { if (cover && coverPreview?.startsWith('blob:')) URL.revokeObjectURL(coverPreview); }, [cover, coverPreview]);

  const byId = useMemo(() => Object.fromEntries(songs.map((s) => [s.songId, s])), [songs]);
  const chosen = order.map((id) => byId[id]).filter(Boolean);
  const totalSec = chosen.reduce((sum, s) => sum + toSeconds(s.duration), 0);
  const suggestion = suggestReleaseType(chosen.length, totalSec);
  const thisId = release?.releaseId || null;
  const available = songs.filter((s) => !order.includes(s.songId) && (!s.releaseId || s.releaseId === thisId));

  // Follow the suggestion until the artist picks a type themself.
  useEffect(() => {
    if (!typeTouched && chosen.length) setType(suggestion);
  }, [suggestion, typeTouched, chosen.length]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  if (!open) return null;

  const pickCover = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { feedback.error('Choose an image for the cover.'); return; }
    if (file.size > 10 * 1024 * 1024) { feedback.error('That image is over 10 MB. Choose a smaller one.'); return; }
    setCover(file);
    setCoverPreview(URL.createObjectURL(file));
  };

  const onDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    setOrder((list) => arrayMove(list, list.indexOf(active.id), list.indexOf(over.id)));
  };

  const canNext1 = title.trim().length > 0;
  const canNext2 = chosen.length > 0;

  const publish = async () => {
    setSaving(true);
    try {
      const form = new FormData();
      form.append('release', JSON.stringify({
        title: title.trim(),
        type,
        description: description.trim() || null,
        songIds: order,
      }));
      if (cover) form.append('cover', cover);
      const res = await apiCall(editing
        ? { url: `/v1/releases/${release.releaseId}`, method: 'patch', data: form }
        : { url: '/v1/releases', method: 'post', data: form });
      feedback.success(editing ? `Saved ${title.trim()}` : `Published ${title.trim()}`);
      onSaved?.(res.data);
      onClose();
    } catch (err) {
      console.error('Release save failed:', err);
      feedback.error(errorMessage(err, editing ? "Couldn't save the release. Try again." : "Couldn't publish the release. Try again."));
    } finally {
      setSaving(false);
    }
  };

  const label = RELEASE_TYPE_LABEL[type] || 'Release';

  return (
    <div className="nr-overlay" role="presentation" onClick={(e) => { if (e.target === e.currentTarget && !saving) onClose(); }}>
      <div className="nr" role="dialog" aria-modal="true" aria-labelledby="nr-title" ref={dialogRef}>
        <div className="nr__head">
          <button type="button" className="nr__close" onClick={onClose} aria-label="Close" disabled={saving}><X size={20} /></button>
          <h2 id="nr-title">{step === 1 ? (editing ? 'Edit release' : 'New release') : step === 2 ? `Songs on ${title.trim() || 'this release'}` : 'Review'}</h2>
        </div>
        <div className="nr__steps" aria-hidden="true">
          {[1, 2, 3].map((n) => <span key={n} className={n <= step ? 'is-on' : ''} />)}
        </div>
        <div className="nr__stepnote">Step {step} of 3</div>

        <div className="nr__body">
          {step === 1 && (
            <>
              <div className="nr-cover">
                <button type="button" className="nr-cover__pick" onClick={() => coverInput.current?.click()}>
                  {coverPreview ? <img src={coverPreview} alt="Cover" /> : <><ImagePlus size={26} strokeWidth={1.6} /><span>Add cover</span></>}
                </button>
                <p>Square, at least 1400 × 1400. It becomes the whole page&apos;s colour.{!coverPreview && ' No cover? We use the first song’s artwork.'}</p>
                <input ref={coverInput} type="file" accept="image/*" hidden onChange={pickCover} />
              </div>

              <label className="nr-field">
                <span className="nr-label">Title</span>
                <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Name your release" />
              </label>

              <div className="nr-field">
                <span className="nr-label" id="nr-type">Type</span>
                <div className="nr-seg" role="radiogroup" aria-labelledby="nr-type">
                  {RELEASE_TYPES.map((t) => (
                    <button key={t} type="button" role="radio" aria-checked={type === t}
                      className={type === t ? 'is-on' : ''} onClick={() => { setType(t); setTypeTouched(true); }}>
                      {RELEASE_TYPE_LABEL[t]}
                    </button>
                  ))}
                </div>
                <p className="nr-hint">We suggest a type from the length (4–6 songs under 30 min is an EP), but it&apos;s your call.</p>
              </div>

              <label className="nr-field">
                <span className="nr-label">About it <em>(optional)</em></span>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} rows={3}
                  placeholder="The story behind it, who you made it with…" />
              </label>
            </>
          )}

          {step === 2 && (
            <>
              {chosen.length > 0 ? (
                <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis]} onDragEnd={onDragEnd}>
                  <SortableContext items={order} strategy={verticalListSortingStrategy}>
                    <ol className="nr-songs">
                      {chosen.map((s, i) => (
                        <SongRow key={s.songId} song={s} index={i} onRemove={(id) => setOrder((l) => l.filter((x) => x !== id))} />
                      ))}
                    </ol>
                  </SortableContext>
                </DndContext>
              ) : (
                <p className="nr-empty">No songs yet. Add songs you&apos;ve uploaded, or upload new ones.</p>
              )}

              <div className="nr-adders">
                <button type="button" className={`nr-chip ${picking ? 'is-on' : ''}`} onClick={() => setPicking((v) => !v)} aria-expanded={picking}>
                  <Plus size={16} /> From your songs
                </button>
                {onUploadNew && (
                  <button type="button" className="nr-chip" onClick={onUploadNew}>
                    <Upload size={16} /> Upload new
                  </button>
                )}
              </div>

              {picking && (
                <ul className="nr-pick" aria-label="Your songs">
                  {available.length === 0 && <li className="nr-pick__none">Every song is already on a release.</li>}
                  {available.map((s) => (
                    <li key={s.songId}>
                      <button type="button" onClick={() => setOrder((l) => [...l, s.songId])}>
                        <img src={buildUrl(s.artworkUrl) || '/assets/placeholder.jpg'} alt="" />
                        <span>{s.title}</span>
                        <em>{fmtTime(s.duration)}</em>
                        <Plus size={17} aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {chosen.length > 0 && (
                <div className="nr-note">
                  {chosen.length} song{chosen.length === 1 ? '' : 's'}{totalSec ? ` · ${formatReleaseLength(totalSec * 1000)}` : ''} — most apps would call this <b>{suggestion === 'ALBUM' ? 'an album' : suggestion === 'EP' ? 'an EP' : 'a single'}</b>. Hold and drag to reorder.
                </div>
              )}
            </>
          )}

          {step === 3 && (
            <>
              <div className="nr-review">
                {coverPreview
                  ? <img src={coverPreview} alt="" />
                  : <img src={buildUrl(chosen[0]?.artworkUrl) || '/assets/placeholder.jpg'} alt="" />}
                <div>
                  <div className="nr-review__type">{label}</div>
                  <div className="nr-review__title">{title.trim()}</div>
                  <div className="nr-review__meta">
                    {chosen.length} song{chosen.length === 1 ? '' : 's'}{totalSec ? ` · ${formatReleaseLength(totalSec * 1000)}` : ''}
                  </div>
                </div>
              </div>
              <div className="nr-toggle">
                <div><b>Out now</b><span>Goes live the moment you publish.</span></div>
                <span className="nr-switch is-on" aria-hidden="true"><span /></span>
              </div>
              <div className="nr-toggle is-disabled">
                <div><b>Tell my followers</b><span>Follower alerts are coming soon.</span></div>
                <span className="nr-switch" aria-hidden="true"><span /></span>
              </div>
              <p className="nr-dashed">Songs keep their own plays, likes and votes. Putting them on a release never resets anything.</p>
            </>
          )}
        </div>

        <div className="nr__foot">
          {step > 1 && (
            <button type="button" className="nr-back" onClick={() => setStep(step - 1)} disabled={saving}>Back</button>
          )}
          {step === 1 && (
            <button type="button" className="nr-go" disabled={!canNext1} onClick={() => setStep(2)}>
              <ChevronRight size={18} /> Next: pick songs
            </button>
          )}
          {step === 2 && (
            <button type="button" className="nr-go" disabled={!canNext2} onClick={() => setStep(3)}>
              <ChevronRight size={18} /> Next: review
            </button>
          )}
          {step === 3 && (
            <button type="button" className="nr-go" disabled={saving} onClick={publish}>
              <Check size={18} /> {saving ? (editing ? 'Saving…' : 'Publishing…') : (editing ? 'Save changes' : `Publish ${label}`)}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default NewReleaseWizard;
