// src/TeamSwitcher.jsx — "Managing Nia Brooks" bar on the dashboard + the switch sheet.
//
// Shown to anyone who helps run another artist's page. The bar, in the
// user's theme, says whose page is open; tapping it lists their own account
// and every page they help with.
import React, { useRef, useState } from 'react';
import { ArrowLeftRight, Check } from 'lucide-react';
import { useTeam } from './context/TeamContext';
import { buildUrl } from './utils/buildUrl';
import useModalA11y from './hooks/useModalA11y';
import './teamAndReleases.scss';

const Avatar = ({ src, name }) => (
  src
    ? <img src={buildUrl(src)} alt="" className="tm-avatar" />
    : <span className="tm-avatar tm-avatar--initial">{(name || '?').charAt(0).toUpperCase()}</span>
);

const SwitchSheet = ({ me, onClose }) => {
  const { managing, acting, startActing, stopActing } = useTeam();
  const ref = useRef(null);
  useModalA11y({ active: true, onClose, modalRef: ref });

  const pickMe = () => { stopActing(); onClose(); };
  const pick = (m) => { startActing(m); onClose(); };

  return (
    <div className="tm-sheet-backdrop" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="tm-sheet tm-sheet--short" role="dialog" aria-modal="true" aria-labelledby="tm-switch-title" ref={ref}>
        <span className="tm-sheet__grab" aria-hidden="true" />
        <h3 id="tm-switch-title" className="tm-sheet__title">Switch to</h3>
        <button type="button" className={`tm-switch-row ${!acting ? 'is-on' : ''}`} onClick={pickMe}>
          <Avatar src={me?.photoUrl} name={me?.username} />
          <span><b>{me?.username}</b><em>Your own account</em></span>
          {!acting && <Check size={18} className="tm-check" aria-hidden="true" />}
        </button>
        {managing.map((m) => {
          const on = acting?.artistId === m.artistId;
          return (
            <button key={m.artistId} type="button" className={`tm-switch-row ${on ? 'is-on' : ''}`} onClick={() => pick(m)}>
              <Avatar src={m.photoUrl} name={m.username} />
              <span><b>{m.username}</b><em>{m.role === 'VIEWER' ? 'Viewer' : 'Manager'}</em></span>
              {on && <Check size={18} className="tm-check" aria-hidden="true" />}
            </button>
          );
        })}
      </div>
    </div>
  );
};

const TeamSwitcher = ({ me }) => {
  const { managing, acting } = useTeam();
  const [open, setOpen] = useState(false);
  if (!managing.length && !acting) return null;

  return (
    <>
      <button type="button" className={`tm-bar ${acting ? 'is-acting' : ''}`} onClick={() => setOpen(true)} aria-haspopup="dialog">
        {acting ? <Avatar src={acting.photoUrl} name={acting.username} /> : <Avatar src={me?.photoUrl} name={me?.username} />}
        <span className="tm-bar__text">
          {acting ? (
            <>
              <span className="tm-bar__dim">Managing</span> <b>{acting.username}</b>
              {acting.role === 'VIEWER' && <> · <span className="tm-bar__view">View only</span></>}
            </>
          ) : (
            <><span className="tm-bar__dim">Your page ·</span> <b>switch to an artist you help</b></>
          )}
        </span>
        <ArrowLeftRight size={18} aria-hidden="true" />
      </button>
      {open && <SwitchSheet me={me} onClose={() => setOpen(false)} />}
    </>
  );
};

export default TeamSwitcher;
