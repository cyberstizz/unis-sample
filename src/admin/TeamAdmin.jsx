// ─────────────────────────────────────────────────────────────────────────────
// Admin → Street team   (/admin/team, admin + super admin)
//
// Post a meetup, invite members by email (they answer I'm in / Can't make it
// from the email, no login), see who's coming with their phone numbers, mark
// who came, and see the sign-ups made with going members' codes during it.
// Members who joined at /team/join are listed below with their codes and how
// many people they've brought in.
//
// Times are entered and shown in Harlem (New York) time.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../layout';
import { apiCall } from '../components/axiosInstance';
import { meetupWhen, toHarlemInput } from '../utils/teamTime';
import './metrics/metricsPage.scss';
import './communityShareAdmin.scss';
import './launchAdmin.scss';

const errorText = (err, fallback) => err?.response?.data?.error || fallback;
const SIDE = { uptown: 'Uptown', downtown: 'Downtown', either: 'All of Harlem' };
const ROLE = { in_person: 'In person', network: 'Network' };
const SLOT = {
  weekday_day: 'Weekday days', weekday_evening: 'Weekday evenings',
  weekend_day: 'Weekend days', weekend_evening: 'Weekend evenings',
};
const EMPTY = { title: '', meetingPoint: '', startsAt: '', endsAt: '', side: 'either', spots: '', notes: '' };

const MeetupDetail = ({ meetupId, onChanged }) => {
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await apiCall({ method: 'get', url: `/v1/admin/team/meetups/${meetupId}`, useCache: false });
      setDetail(res.data);
      setError('');
    } catch (err) {
      setError(errorText(err, 'Could not load this meetup.'));
    }
  }, [meetupId]);

  useEffect(() => { load(); }, [load]);

  const mark = async (userId, attended) => {
    try {
      await apiCall({ method: 'patch', url: `/v1/admin/team/meetups/${meetupId}/attendance`, data: { userId, attended } });
      await load();
      onChanged?.();
    } catch (err) {
      setError(errorText(err, 'Could not save.'));
    }
  };

  if (error) return <p className="mx-error">{error}</p>;
  if (!detail) return <p className="mx-empty">Loading…</p>;
  const replies = detail.replies || [];

  return (
    <div className="csa-preview">
      <p className="mx-card__note">
        Sign-ups with going members&rsquo; codes during this meetup (30 minutes before to 2 hours after):{' '}
        <strong>{detail.signupsDuring ?? 0}</strong>
      </p>
      {replies.length === 0 ? (
        <p className="mx-empty">Nobody has answered yet.</p>
      ) : (
        <div className="mx-table-wrap">
          <table className="mx-table">
            <thead>
              <tr><th>Name</th><th>Username</th><th>Phone</th><th>Answer</th><th>Came</th></tr>
            </thead>
            <tbody>
              {replies.map((r) => (
                <tr key={r.userId}>
                  <td>{r.name}</td>
                  <td>@{r.username}</td>
                  <td>{r.phone ? <a href={`tel:${r.phone}`}>{r.phone}</a> : '—'}</td>
                  <td>{r.answer === 'going' ? 'Going' : 'Can’t make it'}</td>
                  <td>
                    <label className="csa-check">
                      <input type="checkbox" checked={r.attended === true} onChange={(e) => mark(r.userId, e.target.checked)} />
                      <span>{r.attended ? 'Came' : 'Not marked'}</span>
                    </label>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const TeamAdmin = () => {
  const navigate = useNavigate();
  const [members, setMembers] = useState(null);
  const [meetups, setMeetups] = useState(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  const load = useCallback(async () => {
    try {
      const [m, t] = await Promise.all([
        apiCall({ method: 'get', url: '/v1/admin/team/members', useCache: false }),
        apiCall({ method: 'get', url: '/v1/admin/team/meetups', useCache: false }),
      ]);
      setMembers(m?.data?.members || []);
      setMeetups(t?.data?.meetups || []);
      setError('');
    } catch (err) {
      console.error('[Team] admin load failed:', err?.message);
      setError(errorText(err, 'Could not load the street team.'));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const data = { ...form, spots: form.spots === '' ? null : form.spots };
      if (editing) {
        await apiCall({ method: 'patch', url: `/v1/admin/team/meetups/${editing}`, data });
        setMessage({ tone: 'good', text: 'Meetup updated.' });
      } else {
        await apiCall({ method: 'post', url: '/v1/admin/team/meetups', data });
        setMessage({ tone: 'good', text: 'Meetup posted. Invite members from the list below.' });
      }
      setForm(EMPTY);
      setEditing(null);
      await load();
    } catch (err) {
      setMessage({ tone: 'bad', text: errorText(err, 'Could not save the meetup.') });
    } finally {
      setBusy(false);
    }
  };

  const edit = (m) => {
    setEditing(m.meetupId);
    setForm({
      title: m.title, meetingPoint: m.meetingPoint, startsAt: toHarlemInput(m.startsAt), endsAt: toHarlemInput(m.endsAt),
      side: m.side, spots: m.spots ?? '', notes: m.notes || '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const invite = async (m, scope) => {
    const who = scope === 'all' ? 'every active member' : 'active members whose side and usual times fit';
    if (!window.confirm(`Email "${m.title}" to ${who}? People who already answered aren't emailed again.`)) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await apiCall({ method: 'post', url: `/v1/admin/team/meetups/${m.meetupId}/invite`, data: { scope } });
      const { sent = 0, skipped = 0 } = res.data || {};
      setMessage({ tone: 'good', text: `Sent ${sent} invite${sent === 1 ? '' : 's'}${skipped ? `; ${skipped} didn’t fit` : ''}.` });
      await load();
    } catch (err) {
      setMessage({ tone: 'bad', text: errorText(err, 'Could not send the invites.') });
    } finally {
      setBusy(false);
    }
  };

  const cancel = async (m) => {
    if (!window.confirm(`Cancel "${m.title}"? Everyone going gets an email.`)) return;
    setBusy(true);
    setMessage(null);
    try {
      await apiCall({ method: 'patch', url: `/v1/admin/team/meetups/${m.meetupId}`, data: { status: 'cancelled' } });
      setMessage({ tone: 'good', text: 'Cancelled. Everyone going was emailed.' });
      await load();
    } catch (err) {
      setMessage({ tone: 'bad', text: errorText(err, 'Could not cancel.') });
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (member, status) => {
    setBusy(true);
    try {
      await apiCall({ method: 'patch', url: `/v1/admin/team/members/${member.userId}`, data: { status } });
      await load();
    } catch (err) {
      setMessage({ tone: 'bad', text: errorText(err, 'Could not change this member.') });
    } finally {
      setBusy(false);
    }
  };

  const now = Date.now();

  return (
    <Layout>
      <div className="admin-page mx csa">
        <button className="mx-back" onClick={() => navigate('/admin')}>← Admin dashboard</button>
        <header className="mx-head">
          <div>
            <h1>Street team</h1>
            <p className="mx-head__sub">
              Members join at /team. Meetups are optional: no shifts, no quotas. Post one, invite members, and
              they answer from the email. A reminder goes out the day before. Times are Harlem time.
            </p>
          </div>
        </header>

        {error && <p className="mx-error">{error}</p>}

        <section className="mx-card csa-card">
          <h2 className="mx-card__title">{editing ? 'Edit meetup' : 'New meetup'}</h2>
          <form className="csa-form" onSubmit={save}>
            <label className="mx-select">
              Where (name)
              <input value={form.title} maxLength={120} placeholder="Wagner Houses" required onChange={(e) => set('title', e.target.value)} />
            </label>
            <label className="mx-select">
              Meeting point
              <input value={form.meetingPoint} maxLength={200} placeholder="In front of 2050 2nd Ave" required onChange={(e) => set('meetingPoint', e.target.value)} />
            </label>
            <label className="mx-select">
              Starts
              <input type="datetime-local" value={form.startsAt} required onChange={(e) => set('startsAt', e.target.value)} />
            </label>
            <label className="mx-select">
              Ends
              <input type="datetime-local" value={form.endsAt} required onChange={(e) => set('endsAt', e.target.value)} />
            </label>
            <label className="mx-select">
              Side
              <select value={form.side} onChange={(e) => set('side', e.target.value)}>
                <option value="either">All of Harlem</option>
                <option value="uptown">Uptown</option>
                <option value="downtown">Downtown</option>
              </select>
            </label>
            <label className="mx-select">
              People wanted (blank = no limit)
              <input type="number" min="1" max="500" value={form.spots} onChange={(e) => set('spots', e.target.value)} />
            </label>
            <label className="mx-select mx-select--block csa-form__note">
              Notes for members (optional)
              <input value={form.notes} maxLength={1000} placeholder="Wear your Unis shirt. Bring a charged phone." onChange={(e) => set('notes', e.target.value)} />
            </label>
            <div className="csa-form__actions">
              <button className="mx-btn" type="submit" disabled={busy}>{editing ? 'Save changes' : 'Post meetup'}</button>
              {editing && (
                <button className="mx-btn mx-btn--ghost" type="button" onClick={() => { setEditing(null); setForm(EMPTY); }}>
                  Stop editing
                </button>
              )}
            </div>
          </form>
          {message && <p className={`csa-msg csa-msg--${message.tone}`} role="status">{message.text}</p>}
        </section>

        <section className="mx-card csa-card">
          <h2 className="mx-card__title">Meetups</h2>
          {meetups === null && !error && <p className="mx-empty">Loading…</p>}
          {meetups !== null && meetups.length === 0 && <p className="mx-empty">None yet.</p>}
          {(meetups || []).map((m) => {
            const over = new Date(m.endsAt).getTime() < now;
            const cancelled = m.status === 'cancelled';
            return (
              <div key={m.meetupId} className="csa-preview">
                <p className="mx-card__title">
                  {m.title}{cancelled ? ' · Cancelled' : over ? ' · Done' : ''}
                </p>
                <p className="mx-card__note">
                  {meetupWhen(m)} · {SIDE[m.side] || 'Harlem'} · Meet at {m.meetingPoint}
                  <br />
                  {m.going} going{m.spots != null ? ` of ${m.spots}` : ''} · {m.notGoing} can&rsquo;t make it
                  {over ? ` · ${m.came} came` : ''}
                  {m.invitedAt ? ' · invites sent' : ' · not invited yet'}
                </p>
                <div className="csa-form__actions tma-actions">
                  {!cancelled && !over && (
                    <>
                      <button className="mx-btn" type="button" disabled={busy} onClick={() => invite(m, 'match')}>Invite matching members</button>
                      <button className="mx-btn mx-btn--ghost" type="button" disabled={busy} onClick={() => invite(m, 'all')}>Invite everyone</button>
                      <button className="mx-btn mx-btn--ghost" type="button" disabled={busy} onClick={() => edit(m)}>Edit</button>
                      <button className="mx-btn mx-btn--ghost" type="button" disabled={busy} onClick={() => cancel(m)}>Cancel meetup</button>
                    </>
                  )}
                  <button className="mx-btn mx-btn--ghost" type="button" aria-expanded={open === m.meetupId}
                    onClick={() => setOpen(open === m.meetupId ? null : m.meetupId)}>
                    {open === m.meetupId ? 'Hide who’s coming' : 'Who’s coming'}
                  </button>
                </div>
                {open === m.meetupId && <MeetupDetail meetupId={m.meetupId} onChanged={load} />}
              </div>
            );
          })}
        </section>

        <section className="mx-card csa-card">
          <h2 className="mx-card__title">Members {members ? `(${members.length})` : ''}</h2>
          <p className="mx-card__note">
            Pending members haven&rsquo;t confirmed their email yet. Paused members get no street team emails.
            Phone numbers are for you only.
          </p>
          {members !== null && members.length === 0 && <p className="mx-empty">Nobody has joined yet.</p>}
          {members !== null && members.length > 0 && (
            <div className="mx-table-wrap">
              <table className="mx-table">
                <thead>
                  <tr>
                    <th>Name</th><th>Username</th><th>Contact</th><th>Helps</th><th>Free</th><th>Side</th>
                    <th>Code</th><th>Brought in</th><th>Came</th><th>Status</th><th />
                  </tr>
                </thead>
                <tbody>
                  {members.map((mb) => (
                    <tr key={mb.userId}>
                      <td>{mb.name}</td>
                      <td>@{mb.username}</td>
                      <td>
                        {mb.email}
                        {mb.phone && <><br /><a href={`tel:${mb.phone}`}>{mb.phone}</a></>}
                      </td>
                      <td>{(mb.roles || []).map((r) => ROLE[r] || r).join(', ')}</td>
                      <td>{(mb.availability || []).length ? mb.availability.map((s) => SLOT[s] || s).join(', ') : 'Any time'}</td>
                      <td>{SIDE[mb.side] || mb.side}</td>
                      <td>{mb.referralCode}</td>
                      <td>{mb.referrals}</td>
                      <td>{mb.meetupsCame}</td>
                      <td>{mb.status === 'pending' ? 'Pending' : mb.status === 'paused' ? 'Paused' : 'Active'}</td>
                      <td>
                        {mb.status === 'active' && (
                          <button className="mx-btn mx-btn--ghost" type="button" disabled={busy} onClick={() => setStatus(mb, 'paused')}>Pause</button>
                        )}
                        {mb.status === 'paused' && (
                          <button className="mx-btn mx-btn--ghost" type="button" disabled={busy} onClick={() => setStatus(mb, 'active')}>Activate</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </Layout>
  );
};

export default TeamAdmin;
