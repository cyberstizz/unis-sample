// src/data/featuresContent.js
//
// The public Features page (/features), linked from the Help center and open
// to everyone, even before launch.
//
// Each section is a set of benefits (what Unis does for you), and each benefit
// lists the features behind it as small tags. `isNew: true` marks the latest
// update.
//
// SCREENSHOTS: put phone screenshots in /public/features/ with the file names
// below (PNG, JPG or WebP all work; just match the name and extension here).
// A screenshot that isn't there yet is simply left out, and a section with
// none shows no strip. Set `wide: true` on a computer screenshot.

export const FEATURE_SECTIONS = [
  {
    id: 'local',
    title: 'Hear your neighborhood first',
    em: 'neighborhood',
    blurb: 'Music from where you live, ranked by the people who live there.',
    shots: [
      { src: '/features/local-home.jpg', caption: 'Home: what your area is playing' },
      { src: '/features/local-discover.jpg', caption: 'Discover by genre and mood' },
      { src: '/features/local-map.jpg', caption: 'Find on the map' },
    ],
    benefits: [
      {
        t: 'Find the artists on your block',
        d: 'Every artist and listener belongs to a real area, from Uptown and Downtown Harlem up through Harlem, Manhattan, New York City and all of Unis.',
        tags: ['Local areas', 'Artists near you', 'Area pages'],
      },
      {
        t: 'Know what your area is playing right now',
        d: 'Home shows the top songs in your area live, with new music from the artists you follow underneath.',
        tags: ['Home', 'Live top songs', 'The Feed', 'Spotlight card', 'Trending and new releases'],
      },
      {
        t: 'Discover by sound, not only by name',
        d: 'Browse genres, subgenres and moods with your area first, and every song suggests similar ones.',
        tags: ['Discover', 'Genres and subgenres', 'Moods', 'Tag pages', 'Recommended songs'],
      },
      {
        t: 'Explore the whole map',
        d: 'Every area on one map, with its top artists and songs, a genre filter and a random pick, plus charts and a full history of winners.',
        tags: ['Find on the map', 'Charts', 'Winners archive'],
      },
      {
        t: 'Search that forgives typos',
        d: 'Find songs, artists, listeners and playlists even when you spell them wrong.',
        tags: ['Search'],
      },
    ],
  },
  {
    id: 'vote',
    title: 'Your vote decides who rises',
    em: 'decides',
    blurb: 'Listeners pick the winners, not editors.',
    shots: [
      { src: '/features/vote-race.jpg', caption: 'The live race' },
      { src: '/features/vote-award.jpg', caption: 'An award card' },
    ],
    benefits: [
      {
        t: 'One vote, counted all the way up',
        d: 'A vote counts in every race you share with the artist, from your area to all of Unis.',
        tags: ['Song votes', 'Artist votes', 'Weighted votes'],
      },
      {
        t: 'Something to win every day',
        d: 'Song and Artist of the Day, Week, Month, Quarter, Half-year and Year, in every area. Each race closes at its own local midnight, with results right away.',
        tags: ['Six award periods', 'Local-midnight close', 'Fair tie-breaks'],
      },
      {
        t: 'Watch the race live',
        d: 'See where everyone stands while a race is still open, and your rank from your area to all of Unis.',
        tags: ['Live standings', 'Leaderboards', 'Territory ranks'],
      },
      {
        t: 'Wins worth sharing',
        d: 'Every win gets its own card and page. The newest winner in your area is announced once when you open Unis.',
        tags: ['Award cards', 'Winner announcement', 'Vote celebration'],
      },
      {
        t: 'One person, one vote',
        d: 'Voting, earning and commenting need a verified phone number.',
        tags: ['Phone-verified voting'],
      },
    ],
  },
  {
    id: 'listen',
    title: 'A player that feels as good as it sounds',
    em: 'feels',
    blurb: 'Smooth transitions, even volume, and controls the big apps don’t have.',
    shots: [
      { src: '/features/listen-mix.jpg', caption: 'Unis Mix in Now Playing' },
      { src: '/features/listen-sleep.jpg', caption: 'Sleep timer' },
      { src: '/features/listen-mini.jpg', caption: 'The mini player' },
    ],
    benefits: [
      {
        t: 'Songs that flow like a DJ set',
        d: 'Unis Mix lines the next song up on the beat, matches its tempo without changing its pitch, and only overlaps outros, so no verse gets cut. Albums still play gapless.',
        tags: ['Unis Mix', 'Fade, Rise, Bass swap, Echo out, Cut', 'Auto style by tempo and key', 'Gapless albums', 'Crossfade 1–12 s'],
        isNew: true,
      },
      {
        t: 'See the mix happen',
        d: 'Now Playing shows both songs’ waveforms, the mix window and the volume curves as it happens. Tap a style to change how the next song comes in.',
        tags: ['Live mix view', 'Pick the next transition'],
        isNew: true,
      },
      {
        t: 'No more volume jumps',
        d: 'Every song plays at about the same volume, Quiet, Normal or Loud. A whole release is levelled as one, and nothing is pushed past its peaks.',
        tags: ['Volume levelling', 'Album levelling', 'Peak-safe limiter'],
        isNew: true,
      },
      {
        t: 'The music keeps going, or stops when you say',
        d: 'When your queue ends, similar music keeps playing, local artists first. The sleep timer fades out after 5 to 60 minutes or at the end of the song.',
        tags: ['Autoplay', 'Sleep timer'],
        isNew: true,
      },
      {
        t: 'Made for your pocket',
        d: 'Pocket Lock stops accidental taps. Controls show on your lock screen, the mini player takes on the artwork’s colours, and lyrics follow the song line by line.',
        tags: ['Pocket Lock', 'Lock-screen controls', 'Mini player', 'Timed lyrics', 'Music videos', 'Desktop dock'],
      },
      {
        t: 'A logo that dances',
        d: 'The Unis logo pops on every kick, snare and hi-hat of what you’re playing, and calms down for anyone who asks for less motion.',
        tags: ['Beat-reactive logo', 'Reduced motion'],
      },
    ],
  },
  {
    id: 'queue',
    title: 'Your music, organised',
    em: 'organised',
    blurb: 'A queue that respects you, and a library that remembers.',
    shots: [
      { src: '/features/queue.jpg', caption: 'The queue' },
      { src: '/features/queue-liked.jpg', caption: 'Liked Songs' },
    ],
    benefits: [
      {
        t: 'Playing something never wipes your queue',
        d: 'Play it now or add it to the end. Playlists join your queue as a group you can see, move and remove.',
        tags: ['Play now or add to queue', 'Playlist groups', 'Drag to reorder', 'Select several songs', 'Swipe to remove, with undo'],
      },
      {
        t: 'Shuffle that’s actually random',
        d: 'A true Fisher–Yates shuffle: every order is equally likely and nothing repeats.',
        tags: ['Fisher–Yates shuffle', 'Repeat one', 'Repeat all'],
      },
      {
        t: 'Pick up where you left off',
        d: 'Your queue and your place in the song survive a refresh. Recently played follows you to every device, and Jump back in sits at the top of the Feed.',
        tags: ['Queue restore', 'Recently played', 'Jump back in'],
        isNew: true,
      },
      {
        t: 'Every like in one place',
        d: 'Liked Songs, with search, sorting and genre filters that change what Play and Shuffle actually play.',
        tags: ['Liked Songs'],
        isNew: true,
      },
      {
        t: 'Know what’s coming next',
        d: 'Each upcoming song in the queue shows how it will come in, like “Bass swap in 0:12”.',
        tags: ['Mix tags'],
        isNew: true,
      },
      {
        t: 'Skip what you never want to hear',
        d: 'Block a song and Unis skips it. Like a queue? Save it as a playlist.',
        tags: ['Do-not-play list', 'Save queue as playlist', 'Your library'],
      },
    ],
  },
  {
    id: 'playlists',
    title: 'Playlists worth sharing',
    em: 'sharing',
    blurb: 'Make them, mix them, build them together.',
    shots: [
      { src: '/features/playlist-mix.jpg', caption: 'A mixed playlist' },
      { src: '/features/playlist-editor.jpg', caption: 'The Mix editor' },
    ],
    benefits: [
      {
        t: 'Make them yours',
        d: 'Name, description, cover image and order are all editable, and you decide who sees each playlist.',
        tags: ['Custom covers', 'Private, unlisted or public', 'Search and sort inside'],
      },
      {
        t: 'Build them together',
        d: 'Anyone can suggest a song to a community playlist and listeners vote it in. Save anyone’s playlist to your library.',
        tags: ['Community playlists', 'Saved playlists', 'Unis playlists'],
      },
      {
        t: 'Turn any playlist into a mix',
        d: 'Switch on Mix and every song blends into the next, with each transition and each song’s tempo shown right in the list.',
        tags: ['Mixed playlists', 'BPM on every song'],
        isNew: true,
      },
      {
        t: 'Edit every transition',
        d: 'The Mix editor puts both songs’ waveforms in front of you: pick the style, the length in bars and the start point, preview it, save it. Free for everyone.',
        tags: ['Mix editor', 'Preview', 'Free'],
        isNew: true,
      },
    ],
  },
  {
    id: 'social',
    title: 'Music is better with your neighbors',
    em: 'neighbors',
    blurb: 'Follow, talk and share, on your terms.',
    shots: [
      { src: '/features/social-messages.jpg', caption: 'Messages' },
      { src: '/features/social-preview.jpg', caption: 'A shared link' },
    ],
    benefits: [
      {
        t: 'Never miss a release',
        d: 'New music from artists you follow lands in Messages, with at most one email a day. Set the bell for each artist.',
        tags: ['Follow', 'Release alerts', 'Per-artist bell'],
      },
      {
        t: 'Talk about it',
        d: 'Chats with typing and seen indicators, reactions and songs you can play right in the chat. Comment on songs, reply and like comments.',
        tags: ['Messages', 'Reactions', 'Share songs in chat', 'Comments'],
      },
      {
        t: 'You stay in control',
        d: 'Choose who can message you, turn off read receipts and activity status, and block or report anyone. Strangers land in requests.',
        tags: ['Message requests', 'Privacy controls', 'Block and report', 'Daily limits'],
      },
      {
        t: 'Shares that work for you',
        d: 'Links you share carry your referral code, and they show a card with the cover in WhatsApp, iMessage and other apps.',
        tags: ['Referral share links', 'Link previews'],
        isNew: true,
      },
      {
        t: 'A profile that shows your taste',
        d: 'A photo grid, the artist you support and your votes.',
        tags: ['Listener profiles'],
      },
    ],
  },
  {
    id: 'artists',
    title: 'Everything an independent artist needs',
    em: 'artist',
    blurb: 'Release, grow, get counted and get paid.',
    shots: [
      { src: '/features/artist-dashboard.jpg', caption: 'The artist dashboard' },
      { src: '/features/artist-soundcheck.jpg', caption: 'Sound check' },
      { src: '/features/artist-page.jpg', caption: 'An artist page' },
    ],
    benefits: [
      {
        t: 'Release it your way',
        d: 'Songs and videos with artwork, lyrics, ISRC and an explicit flag, a clean version alongside, and whole albums, EPs and mixtapes with their own release pages.',
        tags: ['Song and video uploads', 'Clean versions', 'Albums, EPs and mixtapes', 'Release pages', 'One song a day'],
      },
      {
        t: 'Hear how it will sound',
        d: 'Right after you upload, Sound check shows your song’s tempo, key, loudness, peaks, intro and outro, and what levelling will do with it.',
        tags: ['Sound check'],
        isNew: true,
      },
      {
        t: 'Know your fans',
        d: 'A dashboard with a setup checklist, this week’s numbers, your live rank and your balance, plus who your fans are and where they listen.',
        tags: ['Artist dashboard', 'Fan insights', 'Song stats and sales', 'Release reach'],
      },
      {
        t: 'Bring your team',
        d: 'Invite a manager or a viewer with clear roles, and switch between the artists you work for.',
        tags: ['Team access', 'Roles'],
      },
      {
        t: 'Your page, your story',
        d: 'Photo, bio, links, gallery, featured song, discography and awards, all editable anytime, including lyrics and their timing.',
        tags: ['Artist page', 'Edit songs and lyrics'],
      },
      {
        t: 'Your rights, protected',
        d: 'Every upload confirms the artist controls the song, and anyone can report infringement.',
        tags: ['Rights confirmation', 'Infringement reports'],
      },
    ],
  },
  {
    id: 'money',
    title: 'Everyone gets paid',
    em: 'paid',
    blurb: 'Artists and listeners both earn.',
    shots: [
      { src: '/features/money-earnings.jpg', caption: 'Earnings' },
    ],
    benefits: [
      {
        t: 'Sell your songs',
        d: 'Make a song a free download, a paid one from $0.94 (under iTunes’ 99¢), or not downloadable at all.',
        tags: ['Song sales', 'Free downloads'],
      },
      {
        t: 'Fans who support you, pay you',
        d: 'Every listener picks one artist to support, and fans can pay an artist directly. Unis Plus is $4.99 a month with no ads, and half goes to the artist you support.',
        tags: ['Supporter earnings', 'Direct support', 'Unis Plus'],
      },
      {
        t: 'Earn by bringing people',
        d: 'Earn from the Community Share for the people who join with your code, and the people they bring, three levels deep.',
        tags: ['Referral earnings'],
      },
      {
        t: 'Payouts without the fine print',
        d: 'Paid to your bank on the 1st of each month once you pass $50, with Unis covering the payout fee. See what every stream earned, and get your tax forms each year.',
        tags: ['Monthly payouts', 'Earnings page', 'Tax forms'],
      },
      {
        t: 'Local business, local music',
        d: 'Harlem businesses can sponsor Unis from their own booking page.',
        tags: ['Local sponsors'],
      },
    ],
  },
  {
    id: 'account',
    title: 'Make it yours',
    em: 'yours',
    blurb: 'Your colours, your sound, your privacy.',
    shots: [
      { src: '/features/account-themes.jpg', caption: 'Themes' },
      { src: '/features/account-playback.jpg', caption: 'Playback settings' },
    ],
    benefits: [
      {
        t: 'Seven themes, and a logo that matches',
        d: 'Blue, orange, red, green, purple, yellow or Dianna. Buttons, progress bars and the logo all follow your pick.',
        tags: ['Seven colour themes', 'Themed logo'],
      },
      {
        t: 'Sound the way you like it',
        d: 'Choose levelling, transitions, crossfade length, mixing inside releases and Autoplay, saved on each device.',
        tags: ['Playback settings'],
        isNew: true,
      },
      {
        t: 'Rewarded for listening',
        d: 'Earn points for listening, liking and voting, and climb levels.',
        tags: ['Points', 'Levels'],
      },
      {
        t: 'Learn it in 40 seconds',
        d: 'A short tour on your first visit, and a Help center with every rule in plain language. Every action tells you it went through.',
        tags: ['Guided tour', 'Help center', 'Clear confirmations'],
      },
      {
        t: 'Your account stays yours',
        d: 'Email verification and password reset, control over what others see, and you can download or delete your account. Usernames are never handed to someone else.',
        tags: ['Privacy controls', 'Download or delete', 'Reserved usernames'],
      },
      {
        t: 'Join from anywhere',
        d: 'Outside an open area? Join the waitlist to listen, like and message now, and vote once your area opens.',
        tags: ['Waitlist'],
      },
    ],
  },
  {
    id: 'behind',
    title: 'Built to last',
    em: 'last',
    blurb: 'The parts you don’t see, so the parts you do keep working.',
    shots: [],
    benefits: [
      {
        t: 'Every song measured once',
        d: 'Loudness to the broadcast standard, true peak, tempo, beats, key and waveform are measured on the server, so the first play sounds as good as the hundredth.',
        tags: ['Server-side analysis'],
        isNew: true,
      },
      {
        t: 'Plays that mean something',
        d: 'A play counts after real listening, and repeat plays can’t be farmed.',
        tags: ['Fair play counting'],
      },
      {
        t: 'Safe and moderated',
        d: 'A full process for reports and copyright claims.',
        tags: ['Moderation', 'Takedowns'],
      },
      {
        t: 'Your data, looked after',
        d: 'The whole database is backed up every day with tested restores, and everyone who runs Unis signs in with two-factor.',
        tags: ['Daily backups', 'Staff two-factor'],
      },
    ],
  },
];

export const FEATURE_COUNT = FEATURE_SECTIONS.reduce(
  (n, s) => n + s.benefits.reduce((m, b) => m + b.tags.length, 0), 0,
);

export const NEW_COUNT = FEATURE_SECTIONS.reduce(
  (n, s) => n + s.benefits.filter((b) => b.isNew).length, 0,
);
