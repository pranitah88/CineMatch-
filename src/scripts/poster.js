/**
 * CineMatch - Movie Poster Resolution & Fallback System
 * Primary source: Wikidata (Entity search + P18 claim + Wikimedia Commons).
 * Fallback: High-fidelity CineMatch vector poster (dark charcoal, subtle gold film reel).
 * Caching: Multi-tiered (in-memory Map + in-flight deduplication + persistent localStorage).
 */

function escapeXml(unsafe) {
  if (!unsafe) return '';
  return String(unsafe).replace(/[<>&'"]/g, c => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
    }
  });
}

/**
 * Normalizes MovieLens title formats:
 * - "Matrix, The (1999)" -> { baseTitle: "The Matrix", year: "1999" }
 * - "Amelie (Fabuleux destin d'Amélie Poulain, Le) (2001)" -> { baseTitle: "Amelie", year: "2001" }
 */
export function splitTitleAndYear(rawTitle) {
  let clean = String(rawTitle || '').trim();
  const yearMatch = clean.match(/\((\d{4})\)$/);
  const year = yearMatch ? yearMatch[1] : '';
  if (yearMatch) {
    clean = clean.slice(0, yearMatch.index).trim();
  }

  // Remove alternate foreign title in parentheses if any
  const parenMatch = clean.match(/^([^(]+)\s*\([^)]+\)$/);
  if (parenMatch) {
    clean = parenMatch[1].trim();
  }

  // Rearrange trailing articles
  const articles = [
    { suffix: ', The', prefix: 'The ' },
    { suffix: ', A', prefix: 'A ' },
    { suffix: ', An', prefix: 'An ' },
    { suffix: ', Le', prefix: 'Le ' },
    { suffix: ', La', prefix: 'La ' },
    { suffix: ', Les', prefix: 'Les ' },
    { suffix: ', Der', prefix: 'Der ' },
    { suffix: ', Die', prefix: 'Die ' },
    { suffix: ', Das', prefix: 'Das ' },
    { suffix: ', El', prefix: 'El ' },
    { suffix: ', Los', prefix: 'Los ' }
  ];
  for (const art of articles) {
    if (clean.endsWith(art.suffix)) {
      clean = art.prefix + clean.slice(0, -art.suffix.length).trim();
      break;
    }
  }

  return { baseTitle: clean, year };
}

function wrapText(text, maxChars = 18, maxLines = 3) {
  const words = text.split(/\s+/);
  const lines = [];
  let current = [];
  let currentLen = 0;

  for (const w of words) {
    if (currentLen + w.length + (current.length ? 1 : 0) <= maxChars) {
      current.push(w);
      currentLen += w.length + (current.length > 1 ? 1 : 0);
    } else {
      if (current.length) lines.push(current.join(' '));
      current = [w];
      currentLen = w.length;
    }
    if (lines.length >= maxLines - 1) break;
  }
  if (current.length && lines.length < maxLines) {
    lines.push(current.join(' '));
  }
  if (words.length > lines.reduce((acc, l) => acc + l.split(/\s+/).length, 0) && lines.length) {
    lines[lines.length - 1] = lines[lines.length - 1].replace(/[., ]+$/, '') + '...';
  }
  return lines;
}

/**
 * Polished CineMatch-themed SVG placeholder:
 * Dark charcoal background (#13161d), subtle gold geometric film reel icon (#c9a86a),
 * movie title in Cinzel serif (#f0ece1), release year, cluster badge, and genre tag.
 */
export function generateSvgPoster(title, genres, clusterId = 0, width = 300, height = 440) {
  const { baseTitle, year } = splitTitleAndYear(title);
  const lines = wrapText(baseTitle, 18, 3);
  const genreDisplay = String(genres || '').replace(/\|/g, ' / ');

  const titleTspans = lines.map((l, i) => {
    const y = (lines.length === 1 ? 280 : lines.length === 2 ? 265 : 250) + (i * 24);
    return `<tspan x="${width / 2}" y="${y}">${escapeXml(l)}</tspan>`;
  }).join('');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
    <rect width="${width}" height="${height}" rx="8" fill="#13161d" />
    <rect x="10" y="10" width="${width - 20}" height="${height - 20}" rx="6" fill="none" stroke="#c9a86a" stroke-width="1.2" stroke-opacity="0.35" />
    <rect x="14" y="14" width="${width - 28}" height="${height - 28}" rx="4" fill="none" stroke="#374151" stroke-width="0.8" stroke-dasharray="3 3" />
    
    <!-- Subtle Gold Film Reel Icon -->
    <g transform="translate(${width / 2}, 105)">
      <circle r="42" fill="#0d0f14" stroke="#c9a86a" stroke-width="2" />
      <circle r="14" fill="#13161d" stroke="#c9a86a" stroke-width="1.5" />
      <circle cx="0" cy="-24" r="6" fill="#c9a86a" opacity="0.85" />
      <circle cx="21" cy="-12" r="6" fill="#c9a86a" opacity="0.85" />
      <circle cx="21" cy="12" r="6" fill="#c9a86a" opacity="0.85" />
      <circle cx="0" cy="24" r="6" fill="#c9a86a" opacity="0.85" />
      <circle cx="-21" cy="12" r="6" fill="#c9a86a" opacity="0.85" />
      <circle cx="-21" cy="-12" r="6" fill="#c9a86a" opacity="0.85" />
    </g>

    <!-- Cluster Identifier -->
    <g transform="translate(${width / 2}, 175)">
      <rect x="-60" y="-11" width="120" height="22" rx="4" fill="#1a1e28" stroke="#374151" stroke-width="1" />
      <text x="0" y="4" font-family="'Outfit', sans-serif" font-size="11" font-weight="600" fill="#c5cbd6" text-anchor="middle">CLUSTER ${clusterId}</text>
    </g>

    <!-- Release Year -->
    <text x="${width / 2}" y="222" font-family="'Cinzel', serif" font-size="13" font-weight="700" fill="#c9a86a" text-anchor="middle" letter-spacing="3">${escapeXml(year)}</text>

    <!-- Title Lines -->
    <text font-family="'Cinzel', serif" font-size="16" font-weight="700" fill="#f0ece1" text-anchor="middle">
      ${titleTspans}
    </text>

    <!-- Genre Badge at Bottom -->
    <rect x="18" y="${height - 48}" width="${width - 36}" height="26" rx="4" fill="#0d0f14" stroke="#2c3342" stroke-width="0.8" />
    <text x="${width / 2}" y="${height - 31}" font-family="'Outfit', sans-serif" font-size="10" font-weight="500" fill="#9ea3ae" text-anchor="middle">
      ${escapeXml(genreDisplay.length > 34 ? genreDisplay.slice(0, 34) + '...' : genreDisplay)}
    </text>
  </svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function getFallbackPoster(title, genres = '', clusterId = 0) {
  return generateSvgPoster(title, genres, clusterId);
}

// ---------------------------------------------------------------------------
// Caching Layer
// ---------------------------------------------------------------------------
const memoryCache = new Map();
const inFlightRequests = new Map();
const STORAGE_PREFIX = 'cinematch_poster_';
const MISSING_TTL_MS = 5 * 60 * 1000; // 5 minutes negative cache (avoids permanent lockouts)
const SUCCESS_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days positive cache

export function clearPosterCache() {
  memoryCache.clear();
  inFlightRequests.clear();
  try {
    if (typeof localStorage !== 'undefined') {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(STORAGE_PREFIX)) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
    }
  } catch {
    // Gracefully handle storage errors
  }
}

function getStorageCache(key) {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return null;
    const record = JSON.parse(raw);
    const now = Date.now();
    const ttl = record.missing ? MISSING_TTL_MS : SUCCESS_TTL_MS;
    if (now - record.time > ttl) {
      localStorage.removeItem(STORAGE_PREFIX + key);
      return null;
    }
    return record;
  } catch {
    return null;
  }
}

function setStorageCache(key, data) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify({ ...data, time: Date.now() }));
  } catch {
    // Gracefully handle storage quota or privacy mode errors
  }
}

// ---------------------------------------------------------------------------
// Wikidata Poster Resolution
// ---------------------------------------------------------------------------

/**
 * Searches Wikidata for the movie entity and retrieves the P18 image claim.
 * Distinguishes similar titles using the release year and film keywords.
 */
export async function fetchWikidataPoster(rawTitle) {
  const { baseTitle, year } = splitTitleAndYear(rawTitle);
  if (!baseTitle) return null;

  try {
    const searchUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(baseTitle)}&language=en&format=json&origin=*&type=item&limit=10`;
    const res = await fetch(searchUrl, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(5000)
    });
    if (!res.ok) return null;

    const data = await res.json();
    const results = data.search || [];
    if (results.length === 0) return null;

    // Rank candidates using release year, film keywords, and title match
    let bestEntity = null;
    let bestScore = -999;

    for (const item of results) {
      const desc = (item.description || '').toLowerCase();
      const label = (item.label || '').toLowerCase();
      const baseLower = baseTitle.toLowerCase();
      let score = 0;

      const isFilm = /film|movie|motion picture|animation|animated|cinema/.test(desc);
      if (isFilm) score += 15;

      if (year && desc.includes(year)) score += 20;

      // Penalize non-films (albums, sound tracks, video games, etc.)
      if (/album|song|soundtrack|video game|band|musical group|comic|novel|television series|tv series/.test(desc)) {
        score -= 25;
      }

      if (label === baseLower) score += 5;
      else if (label.includes(baseLower)) score += 2;

      if (score > bestScore) {
        bestScore = score;
        bestEntity = item;
      }
    }

    if (!bestEntity || bestScore < 0) return null;

    // Fetch entity claims to inspect P18 (image)
    const claimsUrl = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${bestEntity.id}&props=claims&format=json&origin=*`;
    const claimsRes = await fetch(claimsUrl, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(5000)
    });
    if (!claimsRes.ok) return null;

    const claimsData = await claimsRes.json();
    const entity = claimsData.entities?.[bestEntity.id];
    const p18Claims = entity?.claims?.P18;

    if (p18Claims && p18Claims.length > 0) {
      const filename = p18Claims[0]?.mainsnak?.datavalue?.value;
      if (filename) {
        // Wikimedia Commons Special:FilePath URL with thumb width
        return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(filename)}?width=400`;
      }
    }

    return null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// OMDb Backend Integration (Secure Backend Proxy)
// ---------------------------------------------------------------------------

/**
 * Queries the secure backend /api/omdb proxy.
 * The OMDB_API_KEY environment variable is kept strictly on the backend.
 * Optionally supports client key override if stored in localStorage.
 */
export async function fetchOmdbPoster(rawTitle) {
  const { baseTitle, year } = splitTitleAndYear(rawTitle);
  if (!baseTitle) return null;

  try {
    const params = new URLSearchParams();
    params.set('title', baseTitle);
    if (year) params.set('year', year);

    const clientKey = typeof localStorage !== 'undefined' ? (localStorage.getItem('cinematch_omdb_key') || '').trim() : '';
    if (clientKey) params.set('key', clientKey);

    const res = await fetch(`/api/omdb?${params.toString()}`, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(6000)
    });
    if (!res.ok) return null;

    const data = await res.json();
    if (data.success && data.poster) {
      return data.poster;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Queries TMDB directly if the user entered a personal TMDB API key in settings.
 */
export async function fetchTmdbPoster(rawTitle) {
  try {
    const tmdbKey = typeof localStorage !== 'undefined' ? (localStorage.getItem('cinematch_tmdb_key') || '').trim() : '';
    if (!tmdbKey) return null;
    const { baseTitle, year } = splitTitleAndYear(rawTitle);
    if (!baseTitle) return null;

    const url = new URL('https://api.themoviedb.org/3/search/movie');
    url.searchParams.set('api_key', tmdbKey);
    url.searchParams.set('query', baseTitle);
    url.searchParams.set('include_adult', 'false');
    if (year) url.searchParams.set('year', year);

    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(3500) });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.results && data.results.length > 0 && data.results[0].poster_path) {
      return `https://image.tmdb.org/t/p/w500${data.results[0].poster_path}`;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Primary poster URL resolver:
 * 1. Checks memory cache.
 * 2. Checks localStorage cache (for both positive hits and negative misses).
 * 3. Deduplicates in-flight promises.
 * 4. Queries secure backend OMDb endpoint (studio posters).
 * 5. Queries TMDB if personal key is configured.
 * 6. Falls back to Wikidata (open knowledge posters).
 * 7. Falls back to CineMatch vector placeholder.
 */
export async function getPosterUrl(title, genres = '', clusterId = 0) {
  const cacheKey = String(title || '').trim();
  if (!cacheKey) {
    return generateSvgPoster('CineMatch', genres, clusterId);
  }

  // 1. In-memory cache hit
  if (memoryCache.has(cacheKey)) {
    return memoryCache.get(cacheKey);
  }

  // 2. Persistent storage cache hit
  const stored = getStorageCache(cacheKey);
  if (stored) {
    if (stored.url) {
      memoryCache.set(cacheKey, stored.url);
      return stored.url;
    }
    if (stored.missing) {
      const fallback = generateSvgPoster(title, genres, clusterId);
      memoryCache.set(cacheKey, fallback);
      return fallback;
    }
  }

  // 3. Deduplicate in-flight requests for the same movie
  if (inFlightRequests.has(cacheKey)) {
    return inFlightRequests.get(cacheKey);
  }

  // 4. Resolve poster: OMDb (backend) -> TMDB -> Wikidata -> Fallback SVG
  const promise = (async () => {
    // Step A: Check OMDb via backend proxy
    try {
      const omdbPoster = await fetchOmdbPoster(title);
      if (omdbPoster) {
        setStorageCache(cacheKey, { url: omdbPoster, source: 'omdb' });
        memoryCache.set(cacheKey, omdbPoster);
        return omdbPoster;
      }
    } catch {
      // Fall through to TMDB
    }

    // Step B: Check TMDB if key configured
    try {
      const tmdbPoster = await fetchTmdbPoster(title);
      if (tmdbPoster) {
        setStorageCache(cacheKey, { url: tmdbPoster, source: 'tmdb' });
        memoryCache.set(cacheKey, tmdbPoster);
        return tmdbPoster;
      }
    } catch {
      // Fall through to Wikidata
    }

    // Step C: Check Wikidata knowledge base
    try {
      const wikidataUrl = await fetchWikidataPoster(title);
      if (wikidataUrl) {
        setStorageCache(cacheKey, { url: wikidataUrl, source: 'wikidata' });
        memoryCache.set(cacheKey, wikidataUrl);
        return wikidataUrl;
      }
    } catch {
      // Fall through on error
    }

    // Step D: Negative cache & vector SVG fallback
    setStorageCache(cacheKey, { missing: true });
    const fallback = generateSvgPoster(title, genres, clusterId);
    memoryCache.set(cacheKey, fallback);
    return fallback;
  })().finally(() => {
    inFlightRequests.delete(cacheKey);
  });

  inFlightRequests.set(cacheKey, promise);
  return promise;
}
