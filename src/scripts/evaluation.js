/**
 * CineMatch - Minimal Model Evaluation Dashboard Script
 * Visualizes actual calculated metrics for KNN and K-Means from /data/evaluation.json.
 * Minimal, clean, student-project presentation friendly.
 */

async function init() {
  try {
    const res = await fetch('/data/evaluation.json');
    if (!res.ok) throw new Error('Evaluation artifact not found');
    const data = await res.json();

    const primary = data.primaryBenchmark;
    const km = data.kmeans;

    // 1. Populate Score Cards
    const setText = (id, txt) => {
      const el = document.getElementById(id);
      if (el) el.textContent = txt;
    };

    setText('card-knn-prec', `${(primary.knn.precision * 100).toFixed(1)}%`);
    setText('card-knn-rec', `${(primary.knn.recall * 100).toFixed(2)}%`);
    setText('card-knn-f1', primary.knn.f1.toFixed(4));

    // 2. Render Simple SVG Comparison Bar Chart
    renderSimpleChart(primary);

    // 3. Populate Compact Comparison Table
    renderCompactTable(primary);
  } catch (err) {
    console.warn('Evaluation data load failed:', err);
  }
}

function renderSimpleChart(bench) {
  const container = document.getElementById('simple-comparison-chart');
  if (!container) return;

  const svgWidth = 720;
  const svgHeight = 260;
  const margin = { top: 30, right: 20, bottom: 40, left: 40 };
  const chartW = svgWidth - margin.left - margin.right;
  const chartH = svgHeight - margin.top - margin.bottom;

  const metrics = [
    {
      label: 'Precision@5',
      knn: bench.knn.precision,
      km: bench.kmeans.precision,
      knnDisplay: `${(bench.knn.precision * 100).toFixed(1)}%`,
      kmDisplay: `${(bench.kmeans.precision * 100).toFixed(1)}%`,
      scale: 1.05
    },
    {
      label: 'Recall@5',
      knn: bench.knn.recall,
      km: bench.kmeans.recall,
      knnDisplay: `${(bench.knn.recall * 100).toFixed(2)}%`,
      kmDisplay: `${(bench.kmeans.recall * 100).toFixed(2)}%`,
      scale: Math.max(bench.knn.recall, bench.kmeans.recall) * 1.35 || 0.02
    },
    {
      label: 'F1@5',
      knn: bench.knn.f1,
      km: bench.kmeans.f1,
      knnDisplay: bench.knn.f1.toFixed(4),
      kmDisplay: bench.kmeans.f1.toFixed(4),
      scale: Math.max(bench.knn.f1, bench.kmeans.f1) * 1.35 || 0.04
    }
  ];

  const groupW = chartW / metrics.length;
  const barW = 38;
  const barGap = 8;

  const groupsSvg = metrics.map((m, idx) => {
    const cx = margin.left + (idx * groupW) + (groupW / 2);
    const knnX = cx - barW - (barGap / 2);
    const kmX = cx + (barGap / 2);

    const knnH = Math.max(4, (m.knn / m.scale) * chartH);
    const kmH = Math.max(4, (m.km / m.scale) * chartH);
    const knnY = margin.top + chartH - knnH;
    const kmY = margin.top + chartH - kmH;

    return `
      <g>
        <!-- KNN Bar -->
        <rect x="${knnX}" y="${knnY}" width="${barW}" height="${knnH}" rx="4" fill="#c9a86a" opacity="0.9" />
        <text x="${knnX + barW / 2}" y="${knnY - 6}" font-family="'Outfit', sans-serif" font-size="11" font-weight="600" fill="#f0ece1" text-anchor="middle">${m.knnDisplay}</text>
        <text x="${knnX + barW / 2}" y="${margin.top + chartH + 16}" font-family="'Outfit', sans-serif" font-size="10" font-weight="600" fill="#c9a86a" text-anchor="middle">KNN</text>

        <!-- K-Means Bar -->
        <rect x="${kmX}" y="${kmY}" width="${barW}" height="${kmH}" rx="4" fill="#5b677a" opacity="0.95" />
        <text x="${kmX + barW / 2}" y="${kmY - 6}" font-family="'Outfit', sans-serif" font-size="11" font-weight="600" fill="#d5dae2" text-anchor="middle">${m.kmDisplay}</text>
        <text x="${kmX + barW / 2}" y="${margin.top + chartH + 16}" font-family="'Outfit', sans-serif" font-size="10" font-weight="600" fill="#8c97a8" text-anchor="middle">K-Means</text>

        <!-- Group Label -->
        <text x="${cx}" y="${margin.top + chartH + 34}" font-family="'Outfit', sans-serif" font-size="12" font-weight="600" fill="#f0ece1" text-anchor="middle">${m.label}</text>
      </g>
    `;
  }).join('');

  container.innerHTML = `
    <svg viewBox="0 0 ${svgWidth} ${svgHeight}" width="100%" height="auto" style="overflow: visible;" aria-label="KNN vs K-Means recommendation comparison bar chart">
      <line x1="${margin.left}" y1="${margin.top + chartH}" x2="${margin.left + chartW}" y2="${margin.top + chartH}" stroke="rgba(255,255,255,0.2)" stroke-width="1.2" />
      ${groupsSvg}
    </svg>
  `;
}

function renderCompactTable(bench) {
  const tbody = document.getElementById('compact-table-body');
  if (!tbody) return;

  const rows = [
    {
      metric: 'Precision@5',
      knn: `${(bench.knn.precision * 100).toFixed(1)}%`,
      km: `${(bench.kmeans.precision * 100).toFixed(1)}%`
    },
    {
      metric: 'Recall@5',
      knn: `${(bench.knn.recall * 100).toFixed(2)}%`,
      km: `${(bench.kmeans.recall * 100).toFixed(2)}%`
    },
    {
      metric: 'F1@5',
      knn: bench.knn.f1.toFixed(4),
      km: bench.kmeans.f1.toFixed(4)
    },
    {
      metric: 'Candidate Search Space',
      knn: '9,741 films (Full Catalog)',
      km: '~974 films (Cluster Subset)'
    }
  ];

  tbody.innerHTML = rows.map(r => `
    <tr>
      <td style="font-weight: 600; color: var(--text-primary);">${r.metric}</td>
      <td style="color: #c9a86a; font-weight: 500;">${r.knn}</td>
      <td style="color: #8c97a8; font-weight: 500;">${r.km}</td>
    </tr>
  `).join('');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
