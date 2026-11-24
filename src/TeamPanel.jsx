// src/TeamPanel.jsx — Settings → Team on the artist dashboard (the artist only).
//
// Who helps run the page (with their own Unis accounts), their role, invites
// still waiting, an invite sheet that says exactly what each role can and
// can't do, and the team activity log.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, MoreHorizontal, Search, Users, X } from 'lucide-react';
import { apiCall } from './components/axiosInstance';
import { useFeedback, errorMessage } from './context/FeedbackContext';
import { buildUrl } from './utils/buildUrl';
import useModalA11y from './hooks/useModalA11y';
import './teamAndReleases.scss';

const MAX_TEAM = 5;

const ROLES = [
  {
    id: 'MANAGER',
    name: 'Manager',
    can: 'Upload and edit songs, videos and releases · edit your profile, photos and bio · see all stats and earnings · message your supporters (signed “from the team”).',
    cant: 'Can’t touch payouts or your bank, cash out, invite people, read your messages or vote as you.',
  },
  { id: 'VIEWER', name: 'Viewer', can: 'See your stats, fans and earnings.', cant: 'Can’t change anything.' },
];

const roleName = (r) => (r === 'MANAGER' ? 'Manager' : r === 'VIEWER' ? 'Viewer' : 'Owner');

const timeAgo = (iso) => {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  const mins = Math.floor((Date.now() - t) / 60000);
  if (mins < 60) return `${Math.max(mins, 1)}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'Yesterday';
  if (d < 7) return `${d} days ago`;
  return new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const Avatar = ({ src, name, size = 44 }) => (
  src
    ? <img src={buildUrl(src)} alt="" className="tm-avatar" style={{ width: size, height: size }} />
    : <span className="tm-avatar tm-avatar--initial" style={{ width: size, height: size }}>{(name || '?').charAt(0).toUpperCase()}</span>
);

const InviteSheet = ({ onClose, onInvited }) => {
  const feedback = useFeedback();
  const ref = useRef(null);
  useModalA11y({ active: true, onClose, modalRef: ref });
  const [username, setUsername] = useState('');
  const [role, setRole] = useState('MANAGER');
  const [sending, setSending] = useState(false);

  const send = async (e) => {
    e?.preventDefault();
    const name = username.trim().replace(/^@/, '');
    if (!name) { feedback.error('Enter their Unis username.'); return; }
    setSending(true);
    try {
      await apiCall({ url: '/v1/artist-team/invite', method: 'post', data: { username: name, role } });
      feedback.success(`Invited @${name} as ${roleName(role)}`);
      onInvited();
      onClose();
    } catch (err) {
      feedback.error(errorMessage(err, "Couldn't send the invite. Try again."));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="tm-sheet-backdrop" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form className="tm-sheet" role="dialog" aria-modal="true" aria-labelledby="tm-invite-title" ref={ref} onSubmit={send}>
        <span className="tm-sheet__grab" aria-hidden="true" />
        <div className="tm-sheet__head">
          <h3 id="tm-invite-title">Invite to your team</h3>
          <button type="button" className="tm-icon" onClick={onClose} aria-label="Close"><X size={19} /></button>
        </div>
        <label className="tm-search">
          <Search size={18} aria-hidden="true" />
          <span className="tm-sr">Their Unis username</span>
          <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Their Unis username"
            autoCapitalize="none" autoCorrect="off" spellCheck="false" />
        </label>
        <p className="tm-fine">They need a Unis account with a verified phone. They sign in with their own account — you never share your password.</p>
        <div role="radiogroup" aria-label="Role">
          {ROLES.map((r) => (
            <button key={r.id} type="button" role="radio" aria-checked={role === r.id}
              className={`tm-role ${role === r.id ? 'is-on' : ''}`} onClick={() => setRole(r.id)}>
              <span className="tm-role__name"><span className="tm-radio" aria-hidden="true" />{r.name}</span>
              <span className="tm-role__can">{r.can}</span>
              <span className="tm-role__cant">{r.cant}</span>
            </button>
          ))}
        </div>
        <button type="submit" className="tm-go" disabled={sending}>
          <Check size={18} /> {sending ? 'Sending…' : 'Send invite'}
        </button>
      </form>
    </div>
  );
};

const TeamPanel = ({ owner }) => {
  const feedback = useFeedback();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);
  const [menuFor, setMenuFor] = useState(null);
  const [view, setView] = useState('team'); // team | activity
  const [activity, setActivity] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await apiCall({ url: '/v1/artist-team/members', method: 'get', useCache: false });
      setMembers(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Team failed to load:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!menuFor) return undefined;
    const close = () => setMenuFor(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [menuFor]);

  const openActivity = async () => {
    setView('activity');
    try {
      const res = await apiCall({ url: '/v1/artist-team/activity', method: 'get', useCache: false });
      setActivity(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Team activity failed to load:', err);
      setActivity([]);
      feedback.error("Couldn't load team activity. Try again.");
    }
  };

  const changeRole = async (m, role) => {
    setMenuFor(null);
    try {
      await apiCall({ url: `/v1/artist-team/members/${m.memberId}`, method: 'patch', data: { role } });
      feedback.success(`${m.username} is now a ${roleName(role)}`);
      load();
    } catch (err) {
      feedback.error(errorMessage(err, "Couldn't change their role. Try again."));
    }
  };

  const remove = async (m) => {
    setMenuFor(null);
    const pending = m.status === 'PENDING';
    const ok = await feedback.confirm({
      title: pending ? `Cancel the invite for ${m.username}?` : `Remove ${m.username}?`,
      message: pending ? 'They won’t be able to accept it.' : 'They lose access right away. Anything they uploaded stays on your page.',
      confirmLabel: pending ? 'Cancel invite' : 'Remove',
      danger: true,
    });
    if (!ok) return;
    try {
      await apiCall({ url: `/v1/artist-team/members/${m.memberId}`, method: 'delete' });
      feedback.success(pending ? 'Invite cancelled' : `Removed ${m.username}`);
      load();
    } catch (err) {
      feedback.error(errorMessage(err, "Couldn't remove them. Try again."));
    }
  };

  if (view === 'activity') {
    return (
      <section className="ad-panel tm" aria-labelledby="tm-activity-title">
        <div className="ad-panel__head">
          <button type="button" className="tm-backlink" onClick={() => setView('team')}><ChevronLeft size={18} /> Team</button>
        </div>
        <h3 id="tm-activity-title" className="tm-title">Team <em>activity</em></h3>
        <p className="tm-lede">Everything your team does on your page, kept for a year.</p>
        {activity === null ? (
          <p className="tm-lede">Loading…</p>
        ) : activity.length === 0 ? (
          <p className="tm-empty">Nothing yet. Changes your team makes will show up here.</p>
        ) : (
          <ul className="tm-log">
            {activity.map((a, i) => (
              <li key={`${a.createdAt}-${i}`}>
                <span className="tm-log__dot" aria-hidden="true" />
                <div>
                  <b>{a.actorName}</b> {a.action}
                  <span className="tm-log__when">{timeAgo(a.createdAt)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  }

  const full = members.length >= MAX_TEAM;

  return (
    <section className="ad-panel tm" aria-labelledby="tm-title">
      <div className="ad-panel__head">
        <h3 id="tm-title"><em>Team</em></h3>
      </div>
      <p className="tm-lede">People who help run your page. They sign in with their own Unis account — you never share your password.</p>

      <ul className="tm-list">
        <li className="tm-person">
          <Avatar src={owner?.photoUrl} name={owner?.username} />
          <div className="tm-person__text"><b>{owner?.username}</b><span>You</span></div>
          <span className="tm-pill tm-pill--owner">Owner</span>
          <span className="tm-menu-spacer" />
        </li>
        {loading && <li className="tm-lede">Loading your team…</li>}
        {members.map((m) => (
          <li key={m.memberId} className="tm-person">
            <Avatar src={m.photoUrl} name={m.username} />
            <div className="tm-person__text">
              <b>{m.username}</b>
              <span>{m.status === 'PENDING' ? 'Invite sent · waiting' : `Joined ${m.acceptedAt ? new Date(m.acceptedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}`}</span>
            </div>
            <span className="tm-pill">{roleName(m.role)}</span>
            <div className="tm-menu-wrap">
              <button type="button" className="tm-icon" aria-label={`Options for ${m.username}`} aria-expanded={menuFor === m.memberId}
                onClick={(e) => { e.stopPropagation(); setMenuFor(menuFor === m.memberId ? null : m.memberId); }}>
                <MoreHorizontal size={18} />
              </button>
              {menuFor === m.memberId && (
                <div className="tm-menu" role="menu" onClick={(e) => e.stopPropagation()}>
                  {m.status === 'ACCEPTED' && m.role !== 'MANAGER' && (
                    <button type="button" role="menuitem" onClick={() => changeRole(m, 'MANAGER')}>Make Manager</button>
                  )}
                  {m.status === 'ACCEPTED' && m.role !== 'VIEWER' && (
                    <button type="button" role="menuitem" onClick={() => changeRole(m, 'VIEWER')}>Make Viewer</button>
                  )}
                  <button type="button" role="menuitem" className="tm-menu__danger" onClick={() => remove(m)}>
                    {m.status === 'PENDING' ? 'Cancel invite' : 'Remove from team'}
                  </button>
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>

      <button type="button" className="tm-go" onClick={() => setInviting(true)} disabled={full}>
        <Users size={18} /> Invite someone
      </button>
      <button type="button" className="tm-row-link" onClick={openActivity}>
        Team activity <ChevronRight size={18} />
      </button>
      <p className="tm-fine">Up to {MAX_TEAM} people. Only you can invite, change roles or remove someone.</p>

      {inviting && <InviteSheet onClose={() => setInviting(false)} onInvited={load} />}
    </section>
  );
};

export default TeamPanel;
