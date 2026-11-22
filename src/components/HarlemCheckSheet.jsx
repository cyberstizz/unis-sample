// =============================================================================
// HarlemCheckSheet — the one honest answer on the sign-up's "Your Hood" step.
//
// Shown once, when someone who picked a Harlem area presses Continue (not on
// every tap). It names the exact area, says the choice is permanent and what a
// wrong answer costs, needs a ticked box, and gives anyone who isn't from
// Harlem a way in as a visitor with their referral code carried over.
//
// Rendered INSIDE the sign-up wizard's dialog (so the wizard's focus trap
// covers it); Escape closes only this sheet.
// =============================================================================
import React, { useEffect, useRef, useState } from 'react';
import './visitor.scss';

const HarlemCheckSheet = ({ areaName, referrerName = '', referralCode = '', onConfirm, onChangeArea, onVisitor }) => {
  const [checked, setChecked] = useState(false);
  const [panel, setPanel] = useState('check');   // 'check' | 'visitor'
  const firstRef = useRef(null);

  useEffect(() => {
    firstRef.current?.focus();
  }, [panel]);

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      // Close this sheet, not the whole sign-up.
      e.stopPropagation();
      onChangeArea?.();
    }
  };

  const credit = referrerName ? `${referrerName}, who referred you` : 'whoever referred you';

  return (
    <div className="vl-overlay vl-overlay--contained" onKeyDown={onKeyDown}>
      <div className="vl-sheet" role="dialog" aria-modal="true" aria-labelledby="hc-title">
        <span className="vl-sheet__handle" aria-hidden="true" />

        {panel === 'check' ? (
          <>
            <p className="vl-sheet__eyebrow">One honest answer</p>
            <h2 id="hc-title" className="vl-sheet__title">Do you live in <em>{areaName}?</em></h2>
            <p className="vl-sheet__body">
              Harlem&rsquo;s charts are decided by the people who live here. Your home area is
              permanent. If it&rsquo;s wrong, the only fix is deleting your account, and you&rsquo;d lose:
            </p>
            <ul className="vl-sheet__list">
              <li>Your username. It stays reserved forever, even after you delete.</li>
              <li>The credit for {credit}</li>
              <li>The artist you support, your points and playlists</li>
              <li>Any earnings under $50</li>
            </ul>
            <label className="hc-attest">
              <input
                ref={firstRef}
                type="checkbox"
                checked={checked}
                onChange={(e) => setChecked(e.target.checked)}
              />
              I live in {areaName}
            </label>
            <button type="button" className="vl-btn vl-btn--primary" disabled={!checked} onClick={onConfirm}>
              Yes, I live here
            </button>
            <div className="hc-visitor">
              <b>Not from Harlem? You can still use Unis.</b>
              <p>
                Listen, like, make playlists and message anyone. Voting opens when your city does.
                Your referral code comes with you.
              </p>
              <button type="button" className="vl-btn vl-btn--outline" onClick={() => setPanel('visitor')}>
                Join from my city
              </button>
            </div>
            <button type="button" className="vl-sheet__link" onClick={onChangeArea}>Change area</button>
          </>
        ) : (
          <>
            <p className="vl-sheet__eyebrow">Thanks for being straight with us</p>
            <h2 id="hc-title" className="vl-sheet__title">Come in as a <em>visitor.</em></h2>
            <p className="vl-sheet__body">
              Pick your city, and you&rsquo;re in today.
              {referralCode && (
                <>
                  {' '}Your code <b className="hc-code">{referralCode}</b> comes with you
                  {referrerName ? `, so ${referrerName} still gets the credit.` : '.'}
                </>
              )}
            </p>
            <button ref={firstRef} type="button" className="vl-btn vl-btn--primary" onClick={onVisitor}>
              Continue to visitor sign-up
            </button>
            <button
              type="button"
              className="vl-sheet__link"
              onClick={() => { setChecked(false); setPanel('check'); }}
            >
              Start over
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default HarlemCheckSheet;
