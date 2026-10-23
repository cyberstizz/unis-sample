// =============================================================================
// artistSetupSteps — the seven steps of the artist dashboard's setup card.
//
// Pure function so the dashboard and its tests agree on what "done" means.
// Every check reads data the dashboard already has:
//   profile        photo + bio on the profile
//   featured       a featured (default) song is set
//   second-song    two or more songs uploaded
//   links          any of Instagram / TikTok / X / YouTube saved
//   phone          the signed-in user's phone is verified
//   payouts        Stripe onboarding complete + payouts enabled (artists only)
//   share          at least one person joined with the artist's code
//                  (earnings summary `referralCount`)
// =============================================================================

const formatNumber = (n) => Number(n || 0).toLocaleString('en-US');

export const buildSetupSteps = ({
  userProfile,
  user,
  songs,
  defaultSong,
  isStripeReady,
  referralCount,
  isArtistRole,
}) => {
  const hasLinks = Boolean(
    userProfile?.instagramUrl || userProfile?.tiktokUrl || userProfile?.twitterUrl || userProfile?.youtubeUrl
  );
  return [
    {
      key: 'profile',
      title: 'Add a photo and your story',
      text: 'People back artists they can picture.',
      action: 'Edit profile',
      done: Boolean(userProfile?.photoUrl && userProfile?.bio),
    },
    {
      key: 'featured',
      title: 'Set your featured song',
      text: 'The first song people hear on your page.',
      action: 'Choose',
      done: Boolean(defaultSong),
    },
    {
      key: 'second-song',
      title: 'Upload a second song',
      text: 'More for new fans to play, and more chances to win.',
      action: 'Upload',
      done: (songs?.length || 0) >= 2,
    },
    {
      key: 'links',
      title: 'Add your links',
      text: 'Let supporters follow you beyond Unis.',
      action: 'Add links',
      done: hasLinks,
    },
    {
      key: 'phone',
      title: 'Verify your phone',
      text: 'Unlocks voting, messages and your earnings.',
      action: 'Verify',
      done: Boolean(user?.phoneVerified),
    },
    ...(isArtistRole
      ? [
          {
            key: 'payouts',
            title: 'Connect payouts',
            text: 'So sales and your monthly share reach your bank.',
            action: 'Connect',
            done: Boolean(isStripeReady),
          },
        ]
      : []),
    {
      key: 'share',
      title: 'Share your code',
      text:
        referralCount > 0
          ? `${formatNumber(referralCount)} ${referralCount === 1 ? 'person has' : 'people have'} joined with it.`
          : 'Bring your people in. Their votes count in your races.',
      action: 'Copy code',
      done: referralCount > 0,
    },
  ];
};

export default buildSetupSteps;
