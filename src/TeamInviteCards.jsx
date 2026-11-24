// src/TeamInviteCards.jsx — team invites, pinned at the top of Messages.
// Accept opens the artist's dashboard as their team member; Decline removes it.
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTeam } from './context/TeamContext';
import { useFeedback, errorMessage } from './context/FeedbackContext';
import { buildUrl } from './utils/buildUrl';
import './teamAndReleases.scss';

const TeamInviteCards = () => {
  const { invites, acceptInvite, declineInvite, startActing } = useTeam();
  const feedback = useFeedback();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(null);

  if (!invites?.length) return null;

  const accept = async (inv) => {
    setBusy(inv.inviteId);
    try {
      const managed = await acceptInvite(inv);
      feedback.success(`You're on ${inv.username}'s team`);
      startActing(managed || { artistId: inv.artistId, username: inv.username, photoUrl: inv.photoUrl, role: inv.role });
      navigate('/artistDashboard');
    } catch (err) {
      feedback.error(errorMessage(err, "Couldn't accept the invite. Try again."));
    } finally {
      setBusy(null);
    }
  };

  const decline = async (inv) => {
    setBusy(inv.inviteId);
    try {
      await declineInvite(inv);
      feedback.info('Invite declined');
    } catch (err) {
      feedback.error(errorMessage(err, "Couldn't decline the invite. Try again."));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="ti" aria-label="Team invites">
      {invites.map((inv) => {
        const manager = inv.role === 'MANAGER';
        return (
          <section key={inv.inviteId} className="ti-card" aria-label={`Team invite from ${inv.username}`}>
            <div className="ti-head">
              {inv.photoUrl
                ? <img src={buildUrl(inv.photoUrl)} alt="" className="tm-avatar" />
                : <span className="tm-avatar tm-avatar--initial">{(inv.username || '?').charAt(0).toUpperCase()}</span>}
              <div><b>{inv.username}</b> invited you to their team as <b>{manager ? 'Manager' : 'Viewer'}</b></div>
            </div>
            <p className="ti-text">
              {manager
                ? 'You’ll be able to upload music, edit their page and see their stats. Payouts stay with them.'
                : 'You’ll be able to see their stats, fans and earnings.'}
            </p>
            <div className="ti-actions">
              <button type="button" className="ti-accept" onClick={() => accept(inv)} disabled={busy === inv.inviteId}>Accept</button>
              <button type="button" className="ti-decline" onClick={() => decline(inv)} disabled={busy === inv.inviteId}>Decline</button>
            </div>
          </section>
        );
      })}
    </div>
  );
};

export default TeamInviteCards;
