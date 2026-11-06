/**
 * CineMatch - Catalog Browser & Genre Filter Script
 * High-performance search across 9,742 titles with multi-genre and cluster filtering.
 * No emojis, no harsh gradients.
 */

import { loadCatalogData, filterCatalog } from './recommender.js';
import { getPosterUrl, getFallbackPoster } from './poster.js';

let catalog = [];
let modelMeta = null;
let currentFiltered = [];
let currentPage = 1;
const PAGE_SIZE_CARDS = 12;
const PAGE_SIZE_TABLE = 25;
let currentView = 'cards'; // 'cards' | 'table'
let selectedGenres = new Set();
let genreMatchMode = 'OR';
let selectedCluster = 'all';
let keyword = '';

async function init() {
  const data = await loadCatalogData();
  catalog = data.catalog;
  modelMeta = data.modelMeta;
  currentFiltered = catalog;

  renderGenreChips();
  renderClusterOptions();
  setupEventListeners();
  applyFilters();
}

function renderGenreChips() {
  const container = document.getElementById('genre-chips-container');
  if (!container || !modelMeta) return;

  container.innerHTML = modelMeta.genres.map(g => `
    <button type="button" class="genre-chip btn btn-secondary btn-sm" data-genre="${g}" style="padding: 4px 10px; font-size: 0.78rem;">
      ${g}
    </button>
  `).join('');

  container.querySelectorAll('.genre-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const g = btn.getAttribute('data-genre');
      if (selectedGenres.has(g)) {
        selectedGenres.delete(g);
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-secondary');
      } else {
        selectedGenres.add(g);
        btn.classList.remove('btn-secondary');
        btn.classList.add('btn-primary');
      }
      currentPage = 1;
      applyFilters();
    });
  });
}

function renderClusterOptions() {
  const select = document.getElementById('cluster-select');
  if (!select || !modelMeta) return;

  let optionsHtml = '<option value="all">All Clusters (0 to 9)</option>';
  for (let c = 0; c < modelMeta.nClusters; c++) {
    const arch = modelMeta.archetypes[c] || { name: 'Archetype' };
    optionsHtml += `<option value="${c}">Cluster ${c}: ${arch.name}</option>`;
  }
  select.innerHTML = optionsHtml;
}

function setupEventListeners() {
  const searchInput = document.getElementById('catalog-search-input');
  const clusterSelect = document.getElementById('cluster-select');
  const matchModeRadios = document.querySelectorAll('input[name="genre-mode"]');
  const prevPageBtn = document.getElementById('prev-page-btn');
  const nextPageBtn = document.getElementById('next-page-btn');
  const viewCardsBtn = document.getElementById('view-cards-btn');
  const viewTableBtn = document.getElementById('view-table-btn');
  const clearFiltersBtn = document.getElementById('clear-filters-btn');

  if (searchInput) {
    let debounce;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        keyword = e.target.value;
        currentPage = 1;
        applyFilters();
      }, 150);
    });
  }

  if (clusterSelect) {
    clusterSelect.addEventListener('change', (e) => {
      selectedCluster = e.target.value;
      currentPage = 1;
      applyFilters();
    });
  }

  matchModeRadios.forEach(r => {
    r.addEventListener('change', (e) => {
      genreMatchMode = e.target.value;
      currentPage = 1;
      applyFilters();
    });
  });

  if (prevPageBtn) {
    prevPageBtn.addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage--;
        renderResults();
        window.scrollTo({ top: 300, behavior: 'smooth' });
      }
    });
  }

  if (nextPageBtn) {
    nextPageBtn.addEventListener('click', () => {
      const pageSize = currentView === 'cards' ? PAGE_SIZE_CARDS : PAGE_SIZE_TABLE;
      const totalPages = Math.ceil(currentFiltered.length / pageSize);
      if (currentPage < totalPages) {
        currentPage++;
        renderResults();
        window.scrollTo({ top: 300, behavior: 'smooth' });
      }
    });
  }

  if (viewCardsBtn && viewTableBtn) {
    viewCardsBtn.addEventListener('click', () => {
      currentView = 'cards';
      viewCardsBtn.classList.add('btn-primary');
      viewCardsBtn.classList.remove('btn-secondary');
      viewTableBtn.classList.add('btn-secondary');
      viewTableBtn.classList.remove('btn-primary');
      currentPage = 1;
      renderResults();
    });

    viewTableBtn.addEventListener('click', () => {
      currentView = 'table';
      viewTableBtn.classList.add('btn-primary');
      viewTableBtn.classList.remove('btn-secondary');
      viewCardsBtn.classList.add('btn-secondary');
      viewCardsBtn.classList.remove('btn-primary');
      currentPage = 1;
      renderResults();
    });
  }

  if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener('click', () => {
      keyword = '';
      if (searchInput) searchInput.value = '';
      selectedGenres.clear();
      document.querySelectorAll('.genre-chip').forEach(btn => {
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-secondary');
      });
      selectedCluster = 'all';
      if (clusterSelect) clusterSelect.value = 'all';
      currentPage = 1;
      applyFilters();
    });
  }
}

function applyFilters() {
  currentFiltered = filterCatalog({
    keyword,
    selectedGenres: Array.from(selectedGenres),
    genreMatchMode,
    cluster: selectedCluster
  });

  const countEl = document.getElementById('results-count-text');
  if (countEl) {
    countEl.textContent = `Showing ${currentFiltered.length.toLocaleString()} matching films from 9,742 in catalog`;
  }

  renderResults();
}

async function renderResults() {
  const cardsContainer = document.getElementById('catalog-cards-container');
  const tableContainer = document.getElementById('catalog-table-container');
  const pageInfoEl = document.getElementById('page-info');
  const prevPageBtn = document.getElementById('prev-page-btn');
  const nextPageBtn = document.getElementById('next-page-btn');

  const pageSize = currentView === 'cards' ? PAGE_SIZE_CARDS : PAGE_SIZE_TABLE;
  const totalPages = Math.max(1, Math.ceil(currentFiltered.length / pageSize));
  if (currentPage > totalPages) currentPage = totalPages;

  if (pageInfoEl) {
    pageInfoEl.textContent = `Page ${currentPage} of ${totalPages}`;
  }
  if (prevPageBtn) prevPageBtn.disabled = currentPage <= 1;
  if (nextPageBtn) nextPageBtn.disabled = currentPage >= totalPages;

  const start = (currentPage - 1) * pageSize;
  const slice = currentFiltered.slice(start, start + pageSize);

  if (currentView === 'cards') {
    if (cardsContainer) cardsContainer.style.display = 'grid';
    if (tableContainer) tableContainer.style.display = 'none';

    if (slice.length === 0) {
      cardsContainer.innerHTML = '<div style="grid-column: 1 / -1; padding: 32px; text-align: center; color: var(--text-secondary); background: var(--bg-surface); border-radius: var(--radius-md);">No movies match the current search filters. Try relaxing keywords or genre selections.</div>';
      return;
    }

    const cardsHtml = slice.map((m) => {
      const fallbackUrl = getFallbackPoster(m.t, m.g, m.c);
      const genreTags = m.g.split('|').slice(0, 3).map(g => `<span class="genre-tag">${g}</span>`).join('');

      return `
        <article class="movie-card">
          <div class="card-poster">
            <img id="explore-poster-${m.i}" src="${fallbackUrl}" alt="Poster for ${m.t}" loading="lazy" />
          </div>
          <div class="card-body">
            <span class="badge badge-cluster" style="margin-bottom: 6px;">Cluster ${m.c}</span>
            <h3 class="card-title">${m.t}</h3>
            <div class="card-genres">${genreTags}</div>
          </div>
          <div class="card-footer">
            <a href="/index.html?movie=${m.i}" class="btn btn-primary btn-sm btn-block">
              Recommend Similar
            </a>
          </div>
        </article>
      `;
    }).join('');

    cardsContainer.innerHTML = cardsHtml;

    // Resolve posters asynchronously without blocking page view
    slice.forEach(m => {
      const imgEl = document.getElementById(`explore-poster-${m.i}`);
      if (!imgEl) return;
      const fallback = getFallbackPoster(m.t, m.g, m.c);
      imgEl.onerror = () => { imgEl.onerror = null; imgEl.src = fallback; };
      getPosterUrl(m.t, m.g, m.c).then(url => {
        if (url && url !== fallback && imgEl) {
          imgEl.src = url;
        }
      }).catch(() => {});
    });
  } else {
    if (cardsContainer) cardsContainer.style.display = 'none';
    if (tableContainer) tableContainer.style.display = 'block';

    const tbody = document.getElementById('catalog-table-body');
    if (!tbody) return;

    if (slice.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 24px; color: var(--text-secondary);">No movies match the current filters.</td></tr>';
      return;
    }

    tbody.innerHTML = slice.map(m => {
      const arch = modelMeta.archetypes[m.c] || { name: 'Archetype' };
      return `
        <tr>
          <td style="color: var(--text-muted); font-size: 0.82rem;">${m.id}</td>
          <td><strong>${m.t}</strong></td>
          <td>${m.g.replace(/\|/g, ', ')}</td>
          <td><span class="badge badge-cluster">Cluster ${m.c}: ${arch.name}</span></td>
          <td style="text-align: right;">
            <a href="/index.html?movie=${m.i}" class="btn btn-secondary btn-sm" style="font-size: 0.78rem; padding: 4px 10px;">
              Recommend
            </a>
          </td>
        </tr>
      `;
    }).join('');
  }
}

document.addEventListener('DOMContentLoaded', init);
