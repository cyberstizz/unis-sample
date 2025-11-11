export const GENRE_IDS = {
  'rap-hiphop': '00000000-0000-0000-0000-000000000101',
  'rock': '00000000-0000-0000-0000-000000000102',
  'pop': '00000000-0000-0000-0000-000000000103',
};

export const JURISDICTION_IDS = {
  'uptown-harlem': '00000000-0000-0000-0000-000000000002',
  'downtown-harlem': '00000000-0000-0000-0000-000000000003',
  'harlem-wide': '00000000-0000-0000-0000-000000000001',
};

export const INTERVAL_IDS = {
  'daily': '00000000-0000-0000-0000-000000000201',
  'weekly': '00000000-0000-0000-0000-000000000202',
  'monthly': '00000000-0000-0000-0000-000000000203',
  'quarterly': '00000000-0000-0000-0000-000000000204',
  'annual': '00000000-0000-0000-0000-000000000205',
};

// Reverse mappings (UUID to string)
export const GENRE_NAMES = Object.fromEntries(
  Object.entries(GENRE_IDS).map(([k, v]) => [v, k])
);

export const JURISDICTION_NAMES = Object.fromEntries(
  Object.entries(JURISDICTION_IDS).map(([k, v]) => [v, k])
);

export const INTERVAL_NAMES = Object.fromEntries(
  Object.entries(INTERVAL_IDS).map(([k, v]) => [v, k])
);