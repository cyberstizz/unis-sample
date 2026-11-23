// src/utils/themeLogo.js
// The Unis logo in the user's theme colour, for pages that draw their own
// header instead of using the app's (sponsor, waitlist, team, sign-in).
// The app header, voting wizard and Pocket Lock keep their own copies of
// this map; new code should use this one.
//
//   themeLogo('green')  → the green logo's URL (blue for anything unknown)
//   useThemeLogo()      → the logo for the signed-in user's theme (blue for
//                         guests, and outside the auth provider, e.g. tests)
import { useAuth } from '../context/AuthContext';
import logoBlue from '../assets/unisLogoThree.svg';
import logoOrange from '../assets/logo-orange.png';
import logoRed from '../assets/logo-red.png';
import logoGreen from '../assets/logo-green.png';
import logoPurple from '../assets/logo-purple.png';
import logoYellow from '../assets/logo-gold.png';
import logoDianna from '../assets/logo-dianna.png';

export const THEME_LOGOS = {
  blue: logoBlue,
  orange: logoOrange,
  red: logoRed,
  green: logoGreen,
  purple: logoPurple,
  yellow: logoYellow,
  dianna: logoDianna,
};

export function themeLogo(theme) {
  return THEME_LOGOS[theme] || logoBlue;
}

const useSignedInTheme = () => {
  try {
    return useAuth()?.theme || 'blue';
  } catch {
    return 'blue'; // rendered outside AuthProvider
  }
};

export function useThemeLogo() {
  return themeLogo(useSignedInTheme());
}
