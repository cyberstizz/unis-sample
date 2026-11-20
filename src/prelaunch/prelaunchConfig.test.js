// src/prelaunch/prelaunchConfig.test.js
//
// The pre-launch "Coming soon" gate. Until launch day this decides, for every
// visit, whether someone sees the real app or the Coming soon page — so a
// mistake here either leaks the app to the public early or locks out the
// pages sign-up depends on.
//
// Rules:
//   • VITE_PRELAUNCH "true" forces the gate on, "false" forces it off;
//     unset = on in production builds, off in dev and tests
//   • while on: admins and anyone holding a backstage pass get the app;
//     everyone else gets Coming soon — except the short list of open paths
//     (verification, password reset, legal, waitlist, sponsor, help, join,
//     team), which keep working
//   • the login form only exists at the secret backstage path
//   • a backstage pass belongs to ONE account in that browser

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  OPEN_PATHS,
  getLaunchAt,
  getLaunchLabel,
  isPrelaunch,
  getBackstagePath,
  isOpenPath,
  isBackstagePath,
  grantBackstagePass,
  clearBackstagePass,
  canEnterApp,
  resolveGate,
} from './prelaunchConfig';

const BACKSTAGE = '/backstage-k7q2m9xw';
const ADMIN = { userId: 'admin-1', adminRole: 'super_admin' };
const LISTENER = { userId: 'user-1', adminRole: null };

const gateOn = () => {
  vi.stubEnv('VITE_PRELAUNCH', 'true');
  vi.stubEnv('VITE_BACKSTAGE_PATH', BACKSTAGE);
};

beforeEach(() => {
  localStorage.clear();
  vi.stubEnv('VITE_PRELAUNCH', '');
  vi.stubEnv('VITE_BACKSTAGE_PATH', '');
  vi.stubEnv('VITE_LAUNCH_AT', '');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

// ===========================================================================
describe('prelaunch — is the gate on?', () => {
  it.each(['true', 'TRUE', ' true '])('VITE_PRELAUNCH=%p forces it on', (value) => {
    vi.stubEnv('VITE_PRELAUNCH', value);
    vi.stubEnv('PROD', false);
    expect(isPrelaunch()).toBe(true);
  });

  it.each(['false', 'FALSE', ' false '])('VITE_PRELAUNCH=%p forces it off — the launch-day switch', (value) => {
    vi.stubEnv('VITE_PRELAUNCH', value);
    vi.stubEnv('PROD', true);
    expect(isPrelaunch()).toBe(false);
  });

  it('unset: on in a production build', () => {
    vi.stubEnv('PROD', true);
    expect(isPrelaunch()).toBe(true);
  });

  it('unset: off in dev and in tests', () => {
    vi.stubEnv('PROD', false);
    expect(isPrelaunch()).toBe(false);
  });

  it('anything else is treated as unset, so a typo cannot open the app in production', () => {
    vi.stubEnv('VITE_PRELAUNCH', 'flase');
    vi.stubEnv('PROD', true);
    expect(isPrelaunch()).toBe(true);
  });
});

// ===========================================================================
describe('prelaunch — open paths', () => {
  it('keeps the pages sign-up and the law depend on open', () => {
    expect(OPEN_PATHS).toEqual([
      '/verify-email', '/reset-password', '/privacy', '/terms', '/cookie', '/report',
      '/waitlist', '/sponsor', '/help', '/join', '/team',
    ]);
  });

  it.each([
    '/verify-email', '/reset-password', '/privacy', '/terms', '/cookie', '/report',
    '/waitlist', '/waitlist/join', '/sponsor', '/sponsor/book', '/help',
    '/join', '/join/HARLEM', '/team', '/team/join', '/team/me',
    '/help/', '/waitlist//',
  ])('%s is open', (path) => {
    expect(isOpenPath(path)).toBe(true);
  });

  it.each([
    '/', '/feed', '/login', '/artist/abc', '/song/abc', '/voteawards', '/admin', '/admin/users',
    '/profile', '/earnings', '/messages', '/plus', '/charts', '/discover', '/findpage',
    '/helpful', '/teams', '/joiner', '/terms-old', '/waitlisted',
  ])('%s is NOT open', (path) => {
    expect(isOpenPath(path)).toBe(false);
  });

  it('treats a missing path as the home page (not open)', () => {
    expect(isOpenPath(undefined)).toBe(false);
  });
});

// ===========================================================================
describe('prelaunch — the backstage path', () => {
  it('is null when unset — then nobody can reach a login form', () => {
    expect(getBackstagePath()).toBeNull();
    expect(isBackstagePath('/login')).toBe(false);
    expect(isBackstagePath('/')).toBe(false);
  });

  it.each([
    ['/backstage-k7q2m9xw', '/backstage-k7q2m9xw'],
    ['backstage-k7q2m9xw', '/backstage-k7q2m9xw'],
    ['  /backstage-k7q2m9xw/  ', '/backstage-k7q2m9xw'],
    ['/backstage-k7q2m9xw///', '/backstage-k7q2m9xw'],
  ])('reads %p as %p', (value, expected) => {
    vi.stubEnv('VITE_BACKSTAGE_PATH', value);
    expect(getBackstagePath()).toBe(expected);
  });

  it.each(['/', '//', '/help', '/terms', '/join/x', '/waitlist/join'])(
    'refuses %p — it would swallow the site or a public page', (value) => {
      vi.stubEnv('VITE_BACKSTAGE_PATH', value);
      expect(getBackstagePath()).toBeNull();
    });

  it('matches the exact path only, with or without a trailing slash', () => {
    vi.stubEnv('VITE_BACKSTAGE_PATH', BACKSTAGE);
    expect(isBackstagePath(BACKSTAGE)).toBe(true);
    expect(isBackstagePath(`${BACKSTAGE}/`)).toBe(true);
    expect(isBackstagePath(`${BACKSTAGE}/extra`)).toBe(false);
    expect(isBackstagePath('/backstage')).toBe(false);
    expect(isBackstagePath('/login')).toBe(false);
  });
});

// ===========================================================================
describe('prelaunch — who may enter the app', () => {
  it.each(['moderator', 'admin', 'super_admin'])('an account with the %s role may', (adminRole) => {
    expect(canEnterApp({ userId: 'x', adminRole })).toBe(true);
  });

  it.each([null, undefined, LISTENER, { userId: 'a', adminRole: '' }])('%p may not', (user) => {
    expect(canEnterApp(user)).toBe(false);
  });

  it('an account that signed in backstage may, admin or not', () => {
    grantBackstagePass('user-1');
    expect(canEnterApp(LISTENER)).toBe(true);
  });

  it('the pass belongs to that one account — another account in the same browser may not', () => {
    grantBackstagePass('user-1');
    expect(canEnterApp({ userId: 'user-2', adminRole: null })).toBe(false);
  });

  it('a signed-out visitor never inherits a pass left in the browser', () => {
    grantBackstagePass('user-1');
    expect(canEnterApp(null)).toBe(false);
    expect(canEnterApp({})).toBe(false);
  });

  it('matches a numeric id against the stored text', () => {
    grantBackstagePass(42);
    expect(canEnterApp({ userId: 42 })).toBe(true);
    expect(canEnterApp({ userId: '42' })).toBe(true);
  });

  it('clearing the pass (logout) closes the door again', () => {
    grantBackstagePass('user-1');
    clearBackstagePass();
    expect(canEnterApp(LISTENER)).toBe(false);
  });

  it('granting a pass with no user id does nothing', () => {
    grantBackstagePass(undefined);
    grantBackstagePass('');
    expect(localStorage.getItem('unis_backstage_pass')).toBeNull();
  });

  it('a newer pass replaces the old one', () => {
    grantBackstagePass('user-1');
    grantBackstagePass('user-2');
    expect(canEnterApp(LISTENER)).toBe(false);
    expect(canEnterApp({ userId: 'user-2' })).toBe(true);
  });

  it('blocked storage means no pass, not a crash', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(() => grantBackstagePass('user-1')).not.toThrow();
    expect(canEnterApp(LISTENER)).toBe(false);
  });
});

// ===========================================================================
describe('prelaunch — what each visit gets', () => {
  it('gate off: everyone gets the app, whatever the path, even before auth settles', () => {
    vi.stubEnv('VITE_PRELAUNCH', 'false');
    vi.stubEnv('VITE_BACKSTAGE_PATH', BACKSTAGE);
    expect(resolveGate({ pathname: '/', user: null, authLoaded: false })).toBe('app');
    expect(resolveGate({ pathname: '/feed', user: null, authLoaded: true })).toBe('app');
    expect(resolveGate({ pathname: BACKSTAGE, user: null, authLoaded: true })).toBe('app');
    expect(resolveGate({ pathname: '/help', user: LISTENER, authLoaded: true })).toBe('app');
  });

  describe('gate on', () => {
    beforeEach(gateOn);

    it('waits until sign-in state is known, so nothing flashes', () => {
      expect(resolveGate({ pathname: '/', user: null, authLoaded: false })).toBe('wait');
      expect(resolveGate({ pathname: BACKSTAGE, user: ADMIN, authLoaded: false })).toBe('wait');
    });

    it.each(['/', '/feed', '/login', '/artist/abc', '/song/abc', '/voteawards', '/admin', '/profile', '/plus'])(
      'a visitor at %s gets Coming soon', (pathname) => {
        expect(resolveGate({ pathname, user: null, authLoaded: true })).toBe('comingSoon');
      });

    it('a signed-in listener gets Coming soon too', () => {
      expect(resolveGate({ pathname: '/feed', user: LISTENER, authLoaded: true })).toBe('comingSoon');
    });

    it.each(['/verify-email', '/reset-password', '/terms', '/waitlist/join', '/sponsor/book', '/help', '/join/HARLEM', '/team/join'])(
      'a visitor at %s gets that page on its own', (pathname) => {
        expect(resolveGate({ pathname, user: null, authLoaded: true })).toBe('open');
      });

    it('the secret path shows the login form to a visitor', () => {
      expect(resolveGate({ pathname: BACKSTAGE, user: null, authLoaded: true })).toBe('backstage');
    });

    it('the secret path still shows the login form to a signed-in listener with no pass', () => {
      expect(resolveGate({ pathname: BACKSTAGE, user: LISTENER, authLoaded: true })).toBe('backstage');
    });

    it('/login is not the login form — it is Coming soon like everything else', () => {
      expect(resolveGate({ pathname: '/login', user: null, authLoaded: true })).toBe('comingSoon');
    });

    it('an admin gets the full app everywhere', () => {
      ['/', '/feed', '/admin', '/help', '/artist/abc'].forEach((pathname) => {
        expect(resolveGate({ pathname, user: ADMIN, authLoaded: true })).toBe('app');
      });
    });

    it('an admin already signed in who lands on the secret path is sent into the app', () => {
      expect(resolveGate({ pathname: BACKSTAGE, user: ADMIN, authLoaded: true })).toBe('enter');
    });

    it('a test account with a backstage pass gets the full app', () => {
      grantBackstagePass('user-1');
      expect(resolveGate({ pathname: '/feed', user: LISTENER, authLoaded: true })).toBe('app');
      expect(resolveGate({ pathname: BACKSTAGE, user: LISTENER, authLoaded: true })).toBe('enter');
    });

    it('after that account logs out, the next visitor is back to Coming soon', () => {
      grantBackstagePass('user-1');
      clearBackstagePass();
      expect(resolveGate({ pathname: '/feed', user: null, authLoaded: true })).toBe('comingSoon');
    });

    it('with no backstage path set, there is no way to a login form', () => {
      vi.stubEnv('VITE_BACKSTAGE_PATH', '');
      ['/', '/login', '/backstage', BACKSTAGE].forEach((pathname) => {
        expect(resolveGate({ pathname, user: null, authLoaded: true })).toBe('comingSoon');
      });
    });
  });

  it('a production build with nothing set is gated', () => {
    vi.stubEnv('PROD', true);
    expect(resolveGate({ pathname: '/feed', user: null, authLoaded: true })).toBe('comingSoon');
  });
});

// ===========================================================================
describe('prelaunch — the launch date', () => {
  it('is optional: unset means no date and no countdown', () => {
    expect(getLaunchAt()).toBeNull();
    expect(getLaunchLabel()).toBeNull();
  });

  it.each(['soon', 'December', '   '])('%p is not a date', (value) => {
    vi.stubEnv('VITE_LAUNCH_AT', value);
    expect(getLaunchAt()).toBeNull();
    expect(getLaunchLabel()).toBeNull();
  });

  it('reads an ISO date', () => {
    vi.stubEnv('VITE_LAUNCH_AT', '2026-12-06T00:00:00-05:00');
    expect(getLaunchAt()).toBe(Date.parse('2026-12-06T00:00:00-05:00'));
  });

  it.each([
    ['2026-12-01T00:00:00-05:00', 'December 1st'],
    ['2026-12-02T00:00:00-05:00', 'December 2nd'],
    ['2026-12-03T00:00:00-05:00', 'December 3rd'],
    ['2026-12-06T00:00:00-05:00', 'December 6th'],
    ['2026-12-11T00:00:00-05:00', 'December 11th'],
    ['2026-12-12T00:00:00-05:00', 'December 12th'],
    ['2026-12-13T00:00:00-05:00', 'December 13th'],
    ['2026-12-21T00:00:00-05:00', 'December 21st'],
    ['2026-12-22T00:00:00-05:00', 'December 22nd'],
    ['2026-12-23T00:00:00-05:00', 'December 23rd'],
    ['2026-12-31T00:00:00-05:00', 'December 31st'],
  ])('%s reads "%s"', (value, label) => {
    vi.stubEnv('VITE_LAUNCH_AT', value);
    expect(getLaunchLabel()).toBe(label);
  });

  it('names the day in Harlem time, not UTC', () => {
    // 03:00 UTC on the 6th is still 10 PM on the 5th in New York.
    vi.stubEnv('VITE_LAUNCH_AT', '2026-12-06T03:00:00Z');
    expect(getLaunchLabel()).toBe('December 5th');
  });
});
