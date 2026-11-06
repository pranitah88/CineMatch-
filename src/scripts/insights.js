/**
 * CineMatch - Model Insights & Architecture Script
 * Visualizes cluster distributions, mathematical foundations, and archetype metadata.
 * No emojis, no harsh gradients.
 */

import { loadCatalogData } from './recommender.js';

let modelMeta = null;
let catalog = [];

async function init() {
  const data = await loadCatalogData();
  catalog = data.catalog;
  modelMeta = data.modelMeta;

  renderClusterChart();
  renderArchetypeSelector();
  setupArchetypeInspect(0);
}

function renderClusterChart() {
  const container = document.getElementById('cluster-chart-container');
  if (!container || !modelMeta) return;

  const counts = [];
  let maxCount = 0;
  for (let c = 0; c < modelMeta.nClusters; c++) {
    const count = modelMeta.clusterStats[c].count;
    counts.push({ cluster: c, count });
    if (count > maxCount) maxCount = count;
  }

  const svgWidth = 800;
  const svgHeight = 280;
  const margin = { top: 20, right: 20, bottom: 40, left: 50 };
  const chartWidth = svgWidth - margin.left - margin.right;
  const chartHeight = svgHeight - margin.top - margin.bottom;

  const barWidth = chartWidth / counts.length;
  const barPadding = 12;

  const barsSvg = counts.map((item, idx) => {
    const h = (item.count / maxCount) * chartHeight;
    const x = margin.left + (idx * barWidth) + (barPadding / 2);
    const y = margin.top + chartHeight - h;
    const w = barWidth - barPadding;
    const arch = modelMeta.archetypes[item.cluster] || { name: 'Archetype' };

    return `
      <g class="chart-bar" tabindex="0" role="img" aria-label="Cluster ${item.cluster}: ${item.count} movies">
        <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="#c9a86a" opacity="0.85" style="transition: opacity 0.15s ease;" />
        <text x="${x + w / 2}" y="${y - 6}" font-family="'Outfit', sans-serif" font-size="11" font-weight="600" fill="#f0ece1" text-anchor="middle">${item.count}</text>
        <text x="${x + w / 2}" y="${margin.top + chartHeight + 20}" font-family="'Outfit', sans-serif" font-size="11" font-weight="500" fill="#a39e93" text-anchor="middle">Cl. ${item.cluster}</text>
        <title>Cluster ${item.cluster}: ${arch.name} (${item.count} titles)</title>
      </g>
    `;
  }).join('');

  const yTicks = [0, Math.round(maxCount / 2), maxCount].map(val => {
    const yPos = margin.top + chartHeight - ((val / maxCount) * chartHeight);
    return `
      <g>
        <line x1="${margin.left}" y1="${yPos}" x2="${margin.left + chartWidth}" y2="${yPos}" stroke="rgba(255,255,255,0.06)" stroke-dasharray="2 2" />
        <text x="${margin.left - 8}" y="${yPos + 4}" font-family="'Outfit', sans-serif" font-size="10" fill="#6b7280" text-anchor="end">${val}</text>
      </g>
    `;
  }).join('');

  container.innerHTML = `
    <svg viewBox="0 0 ${svgWidth} ${svgHeight}" width="100%" height="auto" style="overflow: visible;">
      ${yTicks}
      <line x1="${margin.left}" y1="${margin.top + chartHeight}" x2="${margin.left + chartWidth}" y2="${margin.top + chartHeight}" stroke="rgba(255,255,255,0.2)" />
      ${barsSvg}
    </svg>
  `;
}

function renderArchetypeSelector() {
  const select = document.getElementById('archetype-select');
  if (!select || !modelMeta) return;

  select.innerHTML = Array.from({ length: modelMeta.nClusters }, (_, c) => {
    const arch = modelMeta.archetypes[c];
    const stats = modelMeta.clusterStats[c];
    return `<option value="${c}">Cluster ${c} (${stats.count} films): ${arch.name}</option>`;
  }).join('');

  select.addEventListener('change', (e) => {
    setupArchetypeInspect(parseInt(e.target.value, 10));
  });
}

function setupArchetypeInspect(clusterId) {
  if (!modelMeta) return;

  const arch = modelMeta.archetypes[clusterId];
  const stats = modelMeta.clusterStats[clusterId];

  const titleEl = document.getElementById('archetype-detail-title');
  const descEl = document.getElementById('archetype-detail-desc');
  const primaryEl = document.getElementById('archetype-detail-primary');
  const combosContainer = document.getElementById('archetype-top-combos');
  const samplesContainer = document.getElementById('archetype-samples');

  if (titleEl) titleEl.textContent = `Cluster ${clusterId}: ${arch.name}`;
  if (descEl) descEl.textContent = arch.description;
  if (primaryEl) primaryEl.textContent = `Primary Dimension Focus: ${arch.primary}`;

  if (combosContainer) {
    const combosHtml = Object.entries(stats.topGenres).map(([combo, count]) => `
      <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 0.85rem;">
        <span style="color: var(--text-primary);">${combo.replace(/\|/g, ', ')}</span>
        <span style="color: var(--accent-brass); font-weight: 600;">${count} films</span>
      </div>
    `).join('');
    combosContainer.innerHTML = combosHtml;
  }

  if (samplesContainer) {
    const samplesHtml = stats.samples.map(s => `
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 0.85rem;">
        <span style="color: var(--text-primary); font-weight: 500;">${s.title}</span>
        <span style="color: var(--text-muted); font-size: 0.78rem;">${s.genres.replace(/\|/g, ', ')}</span>
      </div>
    `).join('');
    samplesContainer.innerHTML = samplesHtml;
  }
}

document.addEventListener('DOMContentLoaded', init);
