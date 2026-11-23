// src/tour/lyricsTourSteps.jsx
// ─────────────────────────────────────────────────────────────
// The lyric-timing tour: why timed lyrics matter and how the three steps of
// the lyrics wizard work. Opened from the artist dashboard (Music tab →
// "How timed lyrics work") and from the wizard's "How it works" button.
// Same engine and step format as the welcome tour (tourSteps.jsx), plus
// `art` (a small moving picture) and an outro `action` ('start' opens the
// lyrics wizard on the artist's first song).
// ─────────────────────────────────────────────────────────────
import { KaraokeArt, WordsArt, TapArt, CheckArt, MicGlyph, SparkGlyph } from './lyricsTourArt';

export function lyricsTourSteps({ hasSongs = false } = {}) {
  return [
    {
      id: 'lyrics-welcome',
      kind: 'intro',
      art: KaraokeArt,
      eyebrow: 'Timed lyrics',
      title: 'Let fans *sing along* with your song.',
      body: 'Timed lyrics light up line by line as your song plays, like karaoke. Setting them up takes about as long as the song itself.',
      cta: 'Show me how',
      secondary: 'Not now',
    },
    {
      id: 'lyrics-why',
      kind: 'spot',
      targets: [],
      glyph: SparkGlyph,
      eyebrow: 'Why it matters',
      title: 'Words keep people *with your song*',
      body: 'Fans can read along, learn the words faster and sing them back to you. Every listener on Unis sees timed lyrics for free, on phones and computers.',
    },
    {
      id: 'lyrics-button',
      kind: 'spot',
      targets: ['.ad-lyrics-btn'],
      glyph: MicGlyph,
      eyebrow: 'Where to start',
      title: 'Every song has a *lyrics button*',
      body: 'It’s the mic on each of your songs. Tap it to add the words, or to change them later.',
    },
    {
      id: 'lyrics-words',
      kind: 'spot',
      targets: [],
      art: WordsArt,
      eyebrow: 'Step 1 · Words',
      title: '*Paste* your words',
      body: 'One line for each line you sing. Already have an .lrc file from another app? Import it and the timing comes with it.',
    },
    {
      id: 'lyrics-tap',
      kind: 'spot',
      targets: [],
      art: TapArt,
      eyebrow: 'Step 2 · Tap along',
      title: 'Tap as *each line starts*',
      body: 'Your song plays. Tap the big button, or press Space, the moment each line begins. Missed one? Undo and keep going.',
    },
    {
      id: 'lyrics-check',
      kind: 'spot',
      targets: [],
      art: CheckArt,
      eyebrow: 'Step 3 · Check',
      title: 'Play it back and *fine-tune*',
      body: 'Watch it move with the song. Nudge any line a little earlier or later, then save. Listeners see it right away.',
    },
    {
      id: 'lyrics-done',
      kind: 'outro',
      eyebrow: 'You’re ready',
      title: 'Your song, *karaoke-ready.*',
      body: 'Change the words any time. Lines you don’t touch keep their timing.',
      cta: hasSongs ? 'Time my first song' : 'Got it',
      action: hasSongs ? 'start' : undefined,
      secondary: hasSongs ? 'Later' : undefined,
    },
  ];
}
