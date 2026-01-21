export const GENRE_IDS = {
  'rap': '00000000-0000-0000-0000-000000000101',
  'rap-hiphop': '00000000-0000-0000-0000-000000000101',  
  'hip-hop': '00000000-0000-0000-0000-000000000101',     
  'rock': '00000000-0000-0000-0000-000000000102',
  'pop': '00000000-0000-0000-0000-000000000103',
};


export const JURISDICTION_IDS = {
  'uptown-harlem': '52740de0-e4e9-4c9e-b68e-1e170f6788c4',
  'downtown-harlem': '4b09eaa2-03bc-4778-b7c2-db8b42c9e732',
  'harlem': '1cf6ceb1-aae6-4113-98c0-d9fe8ad8b5e3',
};


export const INTERVAL_IDS = {
  'daily': '00000000-0000-0000-0000-000000000201',
  'weekly': '00000000-0000-0000-0000-000000000202',
  'monthly': '00000000-0000-0000-0000-000000000203',
  'quarterly': '00000000-0000-0000-0000-000000000204',
  'annual': '00000000-0000-0000-0000-000000000205',
  'midterm': '00000000-0000-0000-0000-000000000206',  // NEW: Was missing!
};

// ============================================================================
// REVERSE MAPPINGS (UUID to string)
// ============================================================================
// Useful for displaying human-readable names from API responses
// ============================================================================
export const GENRE_NAMES = Object.fromEntries(
  Object.entries(GENRE_IDS).map(([k, v]) => [v, k])
);

export const JURISDICTION_NAMES = Object.fromEntries(
  Object.entries(JURISDICTION_IDS).map(([k, v]) => [v, k])
);

export const INTERVAL_NAMES = Object.fromEntries(
  Object.entries(INTERVAL_IDS).map(([k, v]) => [v, k])
);

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get jurisdiction ID from key, with fallback
 */
export const getJurisdictionId = (key) => {
  const id = JURISDICTION_IDS[key];
  if (!id) {
    console.warn(`Unknown jurisdiction key: ${key}`);
  }
  return id;
};

/**
 * Get genre ID from key, with fallback
 */
export const getGenreId = (key) => {
  const id = GENRE_IDS[key];
  if (!id) {
    console.warn(`Unknown genre key: ${key}`);
  }
  return id;
};

/**
 * Get interval ID from key, with fallback
 */
export const getIntervalId = (key) => {
  const id = INTERVAL_IDS[key];
  if (!id) {
    console.warn(`Unknown interval key: ${key}`);
  }
  return id;
};