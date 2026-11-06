/**
 * CineMatch - Discover & Recommendation Page Script
 * Search-first interaction: user searches for a movie, selects it, clicks
 * "Find Similar Movies", then KNN recommendations appear.
 * Genre filter chips let users browse the catalog by genre independently.
 */

import { loadCatalogData, getKnnRecommendations, getDuplicateVersions, filterCatalog } from './recommender.js';
import { getPosterUrl, getFallbackPoster, clearPosterCache } from './poster.js';

let currentQueryIdx = null;   // null = no movie selected yet
let catalog = [];
let modelMeta = null;
let activeGenre = null;       // currently selected genre filter (single)

const GENRE_DISPLAY_LIMIT = 12; // max genre-browse results shown

async function init() {
  const data = await loadCatalogData();
  catalog = data.catalog;
  modelMeta = data.modelMeta;

  // If arriving via ?movie=N from Catalog Browser "Recommend Similar" link
  const urlParams = new URLSearchParams(window.location.search);
  const paramMovie = urlParams.get('movie');
  if (paramMovie !== null) {
    const parsed = parseInt(paramMovie, 10);
    if (!isNaN(parsed) && parsed >= 0 && parsed < catalog.length) {
      currentQueryIdx = parsed;
      showSelectionPreview();
      runRecommendations();
    }
  }

  renderGenreFilters();
  setupEventListeners();
}

// ---------------------------------------------------------------------------
// Event Listeners
// ---------------------------------------------------------------------------

function setupEventListeners() {
  const searchInput = document.getElementById('search-input');
  const searchResults = document.getElementById('search-results');
  const findBtn = document.getElementById('find-similar-btn');
  const clearBtn = document.getElementById('clear-selection-btn');
  const tmdbBtn = document.getElementById('tmdb-config-btn');
  const tmdbModal = document.getElementById('tmdb-modal');
  const tmdbSave = document.getElementById('tmdb-save-btn');
  const tmdbInput = document.getElementById('tmdb-key-input');
  const tmdbClose = document.getElementById('tmdb-close-btn');

  // --- Search autocomplete ---
  if (searchInput && searchResults) {
    let debounceTimer;
    searchInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      const query = searchInput.value.trim().toLowerCase();

      // Clear any active genre filter when typing a movie search
      if (query && activeGenre !== null) {
        clearActiveGenre();
      }

      if (!query) {
        searchResults.style.display = 'none';
        searchResults.innerHTML = '';
        return;
      }

      debounceTimer = setTimeout(() => {
        const matches = catalog.filter(m => m.t.toLowerCase().includes(query)).slice(0, 10);
        if (matches.length === 0) {
          searchResults.innerHTML =
            '<div style="padding: 12px; color: var(--text-muted); font-size: 0.88rem;">No movies found matching that title.</div>';
          searchResults.style.display = 'block';
          return;
        }

        searchResults.innerHTML = matches.map(m => `
          <button type="button" class="search-result-item" data-idx="${m.i}"
            style="width: 100%; text-align: left; background: none; border: none;
                   padding: 10px 14px; color: var(--text-primary); cursor: pointer;
                   border-bottom: 1px solid var(--border-subtle); display: flex;
                   justify-content: space-between; align-items: center; font-family: inherit;
                   font-size: 0.9rem;">
            <span style="font-weight: 500;">${m.t}</span>
            <span style="font-size: 0.78rem; color: var(--text-muted);">${m.g.replace(/\|/g, ', ')}</span>
          </button>
        `).join('');
        searchResults.style.display = 'block';

        searchResults.querySelectorAll('.search-result-item').forEach(btn => {
          btn.addEventListener('click', () => {
            const idx = parseInt(btn.getAttribute('data-idx'), 10);
            clearActiveGenre();
            selectMovie(idx);
            searchResults.style.display = 'none';
            searchInput.value = '';
          });
        });
      }, 120);
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
        searchResults.style.display = 'none';
      }
    });
  }

  // --- Find Similar Movies ---
  if (findBtn) {
    findBtn.addEventListener('click', () => {
      if (currentQueryIdx !== null) {
        clearActiveGenre();
        runRecommendations();
      }
    });
  }

  // --- Clear selection ---
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      currentQueryIdx = null;
      document.getElementById('find-similar-container').style.display = 'none';
      document.getElementById('disambiguation-container').style.display = 'none';
      document.getElementById('spotlight-section').style.display = 'none';
      document.getElementById('recommendations-section').style.display = 'none';
    });
  }

  // --- Poster API Settings Modal ---
  const omdbInput = document.getElementById('omdb-key-input');
  const clearPosterCacheBtn = document.getElementById('clear-poster-cache-btn');
  const posterStatusEl = document.getElementById('poster-api-status');

  if (tmdbBtn && tmdbModal) {
    tmdbBtn.addEventListener('click', async () => {
      if (omdbInput) omdbInput.value = localStorage.getItem('cinematch_omdb_key') || '';
      if (tmdbInput) tmdbInput.value = localStorage.getItem('cinematch_tmdb_key') || '';
      if (posterStatusEl) {
        posterStatusEl.textContent = 'Checking OMDb backend service...';
        try {
          const res = await fetch('/api/omdb?check=1');
          const d = await res.json();
          if (d.configured) {
            posterStatusEl.innerHTML = '<span style="color: #4ade80;">✔ Connected</span> &mdash; OMDb API key is active in backend <code>.env</code>.';
          } else {
            posterStatusEl.innerHTML = '<span style="color: #f87171;">✖ Not configured</span> &mdash; Add <code>OMDB_API_KEY</code> to <code>.env</code> or enter an override below.';
          }
        } catch {
          posterStatusEl.textContent = 'Backend /api/omdb endpoint unreachable.';
        }
      }
      tmdbModal.style.display = 'flex';
    });

    if (tmdbClose) {
      tmdbClose.addEventListener('click', () => { tmdbModal.style.display = 'none'; });
    }

    if (clearPosterCacheBtn) {
      clearPosterCacheBtn.addEventListener('click', () => {
        clearPosterCache();
        clearPosterCacheBtn.textContent = 'Cache Cleared!';
        setTimeout(() => { clearPosterCacheBtn.textContent = 'Clear Poster Cache'; }, 1500);
        if (currentQueryIdx !== null) {
          renderSpotlight();
          if (document.getElementById('recommendations-section').style.display !== 'none') {
            runRecommendations();
          }
        }
        if (activeGenre) {
          renderGenreResults();
        }
      });
    }

    if (tmdbSave) {
      tmdbSave.addEventListener('click', () => {
        const omdbKey = omdbInput ? omdbInput.value.trim() : '';
        const tmdbKey = tmdbInput ? tmdbInput.value.trim() : '';

        if (omdbKey) localStorage.setItem('cinematch_omdb_key', omdbKey);
        else localStorage.removeItem('cinematch_omdb_key');

        if (tmdbKey) localStorage.setItem('cinematch_tmdb_key', tmdbKey);
        else localStorage.removeItem('cinematch_tmdb_key');

        clearPosterCache();
        tmdbModal.style.display = 'none';

        // Re-render visible posters
        if (currentQueryIdx !== null) {
          renderSpotlight();
          if (document.getElementById('recommendations-section').style.display !== 'none') {
            runRecommendations();
          }
        }
        if (activeGenre) {
          renderGenreResults();
        }
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Movie Selection
// ---------------------------------------------------------------------------

function selectMovie(idx) {
  clearActiveGenre();
  currentQueryIdx = idx;
  showSelectionPreview();
  renderDisambiguation();
}

function showSelectionPreview() {
  const movie = catalog[currentQueryIdx];
  if (!movie) return;

  const container = document.getElementById('find-similar-container');
  const nameEl = document.getElementById('selected-movie-name');
  const genresEl = document.getElementById('selected-movie-genres-inline');

  if (nameEl) nameEl.textContent = movie.t;
  if (genresEl) genresEl.textContent = '(' + movie.g.replace(/\|/g, ', ') + ')';
  if (container) container.style.display = 'block';
}

// ---------------------------------------------------------------------------
// Disambiguation (duplicate titles like Emma 1996 vs 2020)
// ---------------------------------------------------------------------------

function renderDisambiguation() {
  const container = document.getElementById('disambiguation-container');
  if (!container || currentQueryIdx === null) return;

  const movie = catalog[currentQueryIdx];
  const versions = getDuplicateVersions(movie.t);

  if (versions.length > 1) {
    container.innerHTML = `
      <div class="disambiguation-box">
        <div class="disambiguation-title">Multiple releases found for "${movie.t}":</div>
        <div class="disambiguation-grid">
          ${versions.map(v => {
            const sel = v.index === currentQueryIdx;
            return `
              <button type="button" class="btn ${sel ? 'btn-primary' : 'btn-secondary'} btn-sm dup-btn"
                data-idx="${v.index}" ${sel ? 'disabled' : ''}>
                ${sel ? 'Selected' : 'Select'} (ID: ${v.movieId}, ${v.genres}, Cluster ${v.cluster})
              </button>`;
          }).join('')}
        </div>
      </div>`;
    container.style.display = 'block';

    container.querySelectorAll('.dup-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        selectMovie(parseInt(btn.getAttribute('data-idx'), 10));
      });
    });
  } else {
    container.style.display = 'none';
    container.innerHTML = '';
  }
}

// ---------------------------------------------------------------------------
// Genre Filters (Browse by Genre, independent of search)
// ---------------------------------------------------------------------------

function renderGenreFilters() {
  const container = document.getElementById('genre-filters-container');
  if (!container || !modelMeta) return;

  const genres = modelMeta.genres; // from the real MovieLens dataset

  container.innerHTML = genres.map(g => `
    <button type="button" class="genre-filter-btn btn btn-secondary btn-sm" data-genre="${g}"
      style="padding: 5px 12px; font-size: 0.82rem;">
      ${g}
    </button>
  `).join('');

  container.querySelectorAll('.genre-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const genre = btn.getAttribute('data-genre');

      // Toggle: clicking currently active genre deselects it and restores default state
      if (activeGenre === genre) {
        clearActiveGenre();
        return;
      }

      // Activate clicked genre
      activeGenre = genre;
      container.querySelectorAll('.genre-filter-btn').forEach(b => {
        b.classList.remove('btn-primary');
        b.classList.add('btn-secondary');
      });
      btn.classList.remove('btn-secondary');
      btn.classList.add('btn-primary');
      showGenreResults(genre);
    });
  });
}

async function showGenreResults(genre) {
  const infoEl = document.getElementById('genre-results-info');
  const gridEl = document.getElementById('genre-results-grid');
  if (!gridEl) return;

  const matches = filterCatalog({ selectedGenres: [genre], genreMatchMode: 'OR' });

  if (infoEl) {
    infoEl.textContent = `${matches.length.toLocaleString()} films tagged "${genre}" in the catalog`;
  }

  // Show a sample (first page)
  const sample = matches.slice(0, GENRE_DISPLAY_LIMIT);

  if (sample.length === 0) {
    gridEl.innerHTML = `
      <div style="grid-column: 1/-1; padding: 24px; text-align: center; color: var(--text-secondary);
                  background: var(--bg-surface); border-radius: var(--radius-md);">
        No films found for genre "${genre}".
      </div>`;
    return;
  }

  const cardsHtml = sample.map((m) => {
    const fallbackUrl = getFallbackPoster(m.t, m.g, m.c);
    const genreTags = m.g.split('|').slice(0, 3).map(g => `<span class="genre-tag">${g}</span>`).join('');
    return `
      <article class="movie-card">
        <div class="card-poster">
          <img id="genre-poster-${m.i}" src="${fallbackUrl}" alt="Poster for ${m.t}" loading="lazy" />
        </div>
        <div class="card-body">
          <h3 class="card-title">${m.t}</h3>
          <div class="card-genres">${genreTags}</div>
        </div>
        <div class="card-footer">
          <button type="button" class="btn btn-secondary btn-sm btn-block genre-select-btn" data-idx="${m.i}">
            Find Similar
          </button>
        </div>
      </article>`;
  }).join('');

  gridEl.innerHTML = cardsHtml;

  // Resolve posters asynchronously without blocking UI
  sample.forEach(m => {
    const imgEl = document.getElementById(`genre-poster-${m.i}`);
    if (!imgEl) return;
    const fallback = getFallbackPoster(m.t, m.g, m.c);
    imgEl.onerror = () => { imgEl.onerror = null; imgEl.src = fallback; };
    getPosterUrl(m.t, m.g, m.c).then(url => {
      if (url && url !== fallback && imgEl) {
        imgEl.src = url;
      }
    }).catch(() => {});
  });

  // Clicking "Find Similar" on a genre-browsed card selects that movie
  gridEl.querySelectorAll('.genre-select-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      selectMovie(idx);
      runRecommendations();
      window.scrollTo({ top: document.getElementById('spotlight-section').offsetTop - 20, behavior: 'smooth' });
    });
  });

  // If many results, add a note
  if (matches.length > GENRE_DISPLAY_LIMIT && infoEl) {
    infoEl.textContent += ` (showing first ${GENRE_DISPLAY_LIMIT}; use Catalog Browser for full list)`;
  }
}

function clearGenreResults() {
  const infoEl = document.getElementById('genre-results-info');
  const gridEl = document.getElementById('genre-results-grid');
  if (infoEl) infoEl.textContent = '';
  if (gridEl) gridEl.innerHTML = '';
}

function clearActiveGenre() {
  activeGenre = null;
  const container = document.getElementById('genre-filters-container');
  if (container) {
    container.querySelectorAll('.genre-filter-btn').forEach(b => {
      b.classList.remove('btn-primary');
      b.classList.add('btn-secondary');
    });
  }
  clearGenreResults();
}

// ---------------------------------------------------------------------------
// Recommendations (KNN)
// ---------------------------------------------------------------------------

async function runRecommendations() {
  if (currentQueryIdx === null) return;

  // Clear any active genre filter when running recommendations for a movie
  clearActiveGenre();

  const spotlightSection = document.getElementById('spotlight-section');
  const recsSection = document.getElementById('recommendations-section');
  const recsGrid = document.getElementById('recommendations-grid');
  const countHeader = document.getElementById('recommendations-count');

  // Show sections
  if (spotlightSection) spotlightSection.style.display = 'block';
  if (recsSection) recsSection.style.display = 'block';

  // Render spotlight
  await renderSpotlight();

  // Show skeleton placeholders while computing
  if (recsGrid) {
    recsGrid.innerHTML = Array(5).fill(0).map(() => `
      <div class="skeleton-card" aria-hidden="true">
        <div class="skeleton-box skeleton-poster"></div>
        <div class="skeleton-box skeleton-line skeleton-line-title"></div>
        <div class="skeleton-box skeleton-line skeleton-line-short"></div>
        <div class="skeleton-box skeleton-line" style="margin-top: 12px; height: 32px;"></div>
      </div>
    `).join('');
  }

  await new Promise(r => setTimeout(r, 50));

  // Use existing trained KNN model (cosine distance, 5 recommendations)
  const { recommendations, isZeroGenres } = getKnnRecommendations(currentQueryIdx, 5, false);

  if (countHeader) {
    countHeader.textContent = `${recommendations.length} similar films based on genre vectors`;
  }

  if (recommendations.length === 0) {
    recsGrid.innerHTML = `
      <div style="grid-column: 1/-1; padding: 24px; text-align: center; color: var(--text-secondary);
                  background: var(--bg-surface); border-radius: var(--radius-md);">
        No similar movies found for this title.
      </div>`;
    return;
  }

  const cardsHtml = recommendations.map((rec) => {
    const fallbackUrl = getFallbackPoster(rec.title, rec.genres, rec.cluster);
    const simPct = Math.round(rec.similarity * 100);
    const simText = isZeroGenres ? 'Cluster Neighbor' : `${simPct}% Genre Match`;
    const genresList = rec.genres.split('|').map(g => `<span class="genre-tag">${g}</span>`).join('');

    return `
      <article class="movie-card">
        <div class="card-poster">
          <img id="rec-poster-${rec.index}" src="${fallbackUrl}" alt="Poster for ${rec.title}" loading="lazy" />
        </div>
        <div class="card-body">
          <div style="margin-bottom: 6px;">
            <span class="badge badge-match">${simText}</span>
          </div>
          <h3 class="card-title">${rec.title}</h3>
          <div class="card-genres">${genresList}</div>
        </div>
        <div class="card-footer">
          <button type="button" class="btn btn-secondary btn-sm btn-block explore-rec-btn" data-idx="${rec.index}">
            Find Similar
          </button>
        </div>
      </article>`;
  }).join('');

  recsGrid.innerHTML = cardsHtml;

  // Resolve posters asynchronously without blocking recommendations
  recommendations.forEach(rec => {
    const imgEl = document.getElementById(`rec-poster-${rec.index}`);
    if (!imgEl) return;
    const fallback = getFallbackPoster(rec.title, rec.genres, rec.cluster);
    imgEl.onerror = () => { imgEl.onerror = null; imgEl.src = fallback; };
    getPosterUrl(rec.title, rec.genres, rec.cluster).then(url => {
      if (url && url !== fallback && imgEl) {
        imgEl.src = url;
      }
    }).catch(() => {});
  });

  // Clicking a recommended movie card runs recommendations for that movie
  recsGrid.querySelectorAll('.explore-rec-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      selectMovie(idx);
      runRecommendations();
      window.scrollTo({ top: spotlightSection.offsetTop - 20, behavior: 'smooth' });
    });
  });
}

// ---------------------------------------------------------------------------
// Spotlight (selected movie detail)
// ---------------------------------------------------------------------------

async function renderSpotlight() {
  const movie = catalog[currentQueryIdx];
  if (!movie) return;

  const titleEl = document.getElementById('spotlight-title');
  const genresEl = document.getElementById('spotlight-genres');
  const clusterEl = document.getElementById('spotlight-cluster');
  const idEl = document.getElementById('spotlight-id');
  const descEl = document.getElementById('spotlight-desc');
  const posterImg = document.getElementById('spotlight-poster-img');

  const archetype = modelMeta.archetypes[movie.c] || { name: 'Cinema Archetype', description: '' };

  if (titleEl) titleEl.textContent = movie.t;
  if (idEl) idEl.textContent = `MovieLens ID: ${movie.id}`;
  if (clusterEl) clusterEl.textContent = `Cluster ${movie.c}: ${archetype.name}`;
  if (descEl) descEl.textContent = archetype.description;

  if (genresEl) {
    genresEl.innerHTML = movie.g.split('|').map(g => `<span class="genre-tag">${g}</span>`).join('');
  }

  if (posterImg) {
    const fallback = getFallbackPoster(movie.t, movie.g, movie.c);
    posterImg.src = fallback;
    posterImg.onerror = () => { posterImg.onerror = null; posterImg.src = fallback; };
    posterImg.alt = `Poster artwork for ${movie.t}`;

    getPosterUrl(movie.t, movie.g, movie.c).then(url => {
      if (url && url !== fallback && posterImg) {
        posterImg.src = url;
      }
    }).catch(() => {});
  }
}

document.addEventListener('DOMContentLoaded', init);
