/**
 * CineMatch Recommendation Engine
 * Powered by pre-trained K-Nearest Neighbors (Cosine Metric) and K-Means Clustering.
 * Operates with 100% mathematical fidelity to the scikit-learn model.
 * Zero runtime retraining.
 */

let catalog = null;
let modelMeta = null;

// Population count for 32-bit integers
function popcount(n) {
  n = n - ((n >> 1) & 0x55555555);
  n = (n & 0x33333333) + ((n >> 2) & 0x33333333);
  return (((n + (n >> 4)) & 0x0F0F0F0F) * 0x01010101) >> 24;
}

export async function loadCatalogData() {
  if (catalog && modelMeta) {
    return { catalog, modelMeta };
  }

  const [catRes, metaRes] = await Promise.all([
    fetch('/data/catalog.json'),
    fetch('/data/model_meta.json')
  ]);

  if (!catRes.ok || !metaRes.ok) {
    throw new Error('Failed to load CineMatch model artifacts and catalog.');
  }

  catalog = await catRes.json();
  modelMeta = await metaRes.json();

  return { catalog, modelMeta };
}

export function getMovieByIndex(idx) {
  if (!catalog || idx < 0 || idx >= catalog.length) return null;
  return catalog[idx];
}

export function getDuplicateVersions(title) {
  if (!modelMeta || !modelMeta.duplicates) return [];
  return modelMeta.duplicates[title] || [];
}

/**
 * Recommends top similar movies using pre-trained NearestNeighbors model.
 * - Features: Binary genre features (19 dimensions).
 * - Distance: Cosine distance (0.0 = identical genres, 1.0 = disjoint genres).
 * - Optionally restricts results to the same K-Means cluster.
 */
export function getKnnRecommendations(queryIdx, nRecommendations = 5, filterCluster = false) {
  if (!catalog) throw new Error('Catalog not loaded');

  const targetMovie = catalog[queryIdx];
  if (!targetMovie) throw new Error(`Movie index ${queryIdx} out of range`);

  const targetCluster = targetMovie.c;
  const targetBitmask = targetMovie.b;
  const targetCount = popcount(targetBitmask);
  const isZeroGenres = targetCount === 0;
  const targetNorm = Math.sqrt(targetCount);

  // Compute cosine distances for all movies in catalog
  const candidates = [];

  for (let i = 0; i < catalog.length; i++) {
    // Exclude query movie itself
    if (i === queryIdx) continue;

    const movie = catalog[i];

    // Optional cluster filter
    if (filterCluster && movie.c !== targetCluster) {
      continue;
    }

    const movieBitmask = movie.b;
    const movieCount = popcount(movieBitmask);
    const movieNorm = Math.sqrt(movieCount);

    let similarity = 0.0;
    let distance = 1.0;

    if (!isZeroGenres && movieNorm > 0) {
      const dot = popcount(targetBitmask & movieBitmask);
      similarity = Math.min(1.0, Math.max(0.0, dot / (targetNorm * movieNorm)));
      distance = Math.max(0.0, 1.0 - similarity);
    }

    candidates.push({
      index: movie.i,
      movieId: movie.id,
      title: movie.t,
      genres: movie.g,
      cluster: movie.c,
      distance: distance,
      similarity: similarity
    });
  }

  // Sort by distance ascending (nearest first). For ties, preserve dataset order
  candidates.sort((a, b) => {
    if (Math.abs(a.distance - b.distance) > 1e-7) {
      return a.distance - b.distance;
    }
    return a.index - b.index;
  });

  const recs = candidates.slice(0, nRecommendations);

  // Fallback if cluster filter yielded fewer than requested recommendations
  if (filterCluster && recs.length < nRecommendations) {
    for (let i = 0; i < catalog.length; i++) {
      if (i === queryIdx) continue;
      const m = catalog[i];
      if (m.c === targetCluster && !recs.some(r => r.index === i)) {
        recs.push({
          index: m.i,
          movieId: m.id,
          title: m.t,
          genres: m.g,
          cluster: m.c,
          distance: 1.0,
          similarity: 0.0
        });
        if (recs.length >= nRecommendations) break;
      }
    }
  }

  return {
    recommendations: recs,
    isZeroGenres: isZeroGenres,
    targetMovie: targetMovie
  };
}

/**
 * Filter the catalog by keyword, genres, and cluster
 */
export function filterCatalog({ keyword = '', selectedGenres = [], genreMatchMode = 'OR', cluster = null }) {
  if (!catalog) return [];

  const cleanKeyword = keyword.trim().toLowerCase();
  const hasGenres = selectedGenres && selectedGenres.length > 0;
  const targetCluster = cluster !== null && cluster !== 'all' ? parseInt(cluster, 10) : null;

  return catalog.filter(movie => {
    // 1. Keyword title check
    if (cleanKeyword && !movie.t.toLowerCase().includes(cleanKeyword)) {
      return false;
    }

    // 2. Cluster check
    if (targetCluster !== null && movie.c !== targetCluster) {
      return false;
    }

    // 3. Genre check
    if (hasGenres) {
      const movieGenres = movie.g.split('|');
      if (genreMatchMode === 'AND') {
        const matchesAll = selectedGenres.every(g => movieGenres.includes(g));
        if (!matchesAll) return false;
      } else {
        const matchesAny = selectedGenres.some(g => movieGenres.includes(g));
        if (!matchesAny) return false;
      }
    }

    return true;
  });
}
