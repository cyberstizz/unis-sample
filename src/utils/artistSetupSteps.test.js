import { describe, it, expect } from 'vitest';
import buildSetupSteps from './artistSetupSteps';

const complete = {
  userProfile: { photoUrl: '/p.jpg', bio: 'Hi', instagramUrl: 'https://instagram.com/me' },
  user: { phoneVerified: true },
  songs: [{ songId: 'a' }, { songId: 'b' }],
  defaultSong: { songId: 'a' },
  isStripeReady: true,
  referralCount: 1,
  isArtistRole: true,
};

const keys = (steps) => steps.map((s) => s.key);

describe('buildSetupSteps', () => {
  it('has seven steps for an artist, all done when everything is in place', () => {
    const steps = buildSetupSteps(complete);
    expect(keys(steps)).toEqual(['profile', 'featured', 'second-song', 'links', 'phone', 'payouts', 'share']);
    expect(steps.every((s) => s.done)).toBe(true);
  });

  it('leaves out payouts for non-artist roles', () => {
    expect(keys(buildSetupSteps({ ...complete, isArtistRole: false }))).not.toContain('payouts');
  });

  it('needs both a photo and a bio for the profile step', () => {
    const noBio = buildSetupSteps({ ...complete, userProfile: { ...complete.userProfile, bio: '' } });
    expect(noBio.find((s) => s.key === 'profile').done).toBe(false);
  });

  it('counts any of the four social links, but not the contact email alone', () => {
    const emailOnly = buildSetupSteps({
      ...complete,
      userProfile: { photoUrl: '/p.jpg', bio: 'Hi', contactEmail: 'me@x.com' },
    });
    expect(emailOnly.find((s) => s.key === 'links').done).toBe(false);
    const youtube = buildSetupSteps({
      ...complete,
      userProfile: { photoUrl: '/p.jpg', bio: 'Hi', youtubeUrl: 'https://youtube.com/@me' },
    });
    expect(youtube.find((s) => s.key === 'links').done).toBe(true);
  });

  it('marks phone, second song and share open when missing, with the join count in the text', () => {
    const steps = buildSetupSteps({
      ...complete,
      user: { phoneVerified: false },
      songs: [{ songId: 'a' }],
      referralCount: 0,
    });
    const byKey = Object.fromEntries(steps.map((s) => [s.key, s]));
    expect(byKey.phone.done).toBe(false);
    expect(byKey['second-song'].done).toBe(false);
    expect(byKey.share.done).toBe(false);
    expect(buildSetupSteps({ ...complete, referralCount: 3 }).find((s) => s.key === 'share').text).toMatch(/3 people have joined/);
  });
});
