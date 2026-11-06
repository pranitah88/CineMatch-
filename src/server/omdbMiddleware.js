import fs from 'fs';
import path from 'path';
import { loadEnv } from 'vite';

/**
 * Robustly retrieves OMDB_API_KEY on Windows and across all environments.
 * Checks process.env, .env, .env.local, handles Windows UTF-8 BOM, CRLF, quotes,
 * and ensures the secret key is NEVER exposed to the frontend client.
 */
function getOmdbApiKey(rootPath = process.cwd(), mode = 'development') {
  // 1. Check process.env first
  if (process.env.OMDB_API_KEY && process.env.OMDB_API_KEY.trim() && process.env.OMDB_API_KEY.trim() !== 'your_omdb_api_key_here') {
    return process.env.OMDB_API_KEY.trim();
  }

  // 2. Check candidate env files in rootPath and process.cwd()
  const candidateDirs = Array.from(new Set([rootPath, process.cwd()].filter(Boolean)));
  const candidateFiles = ['.env', '.env.local', `.env.${mode}`, '.env.example'];

  for (const dir of candidateDirs) {
    for (const fileName of candidateFiles) {
      try {
        const filePath = path.resolve(dir, fileName);
        if (fs.existsSync(filePath)) {
          let content = fs.readFileSync(filePath, 'utf-8');
          // Strip UTF-8 BOM if present
          if (content.charCodeAt(0) === 0xFEFF) {
            content = content.slice(1);
          }
          const lines = content.split(/\r?\n/);
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            const match = trimmed.match(/^OMDB_API_KEY\s*=\s*(.*)$/);
            if (match) {
              let val = match[1].trim();
              // Strip trailing inline comments if any
              val = val.replace(/\s+#.*$/, '').trim();
              // Strip surrounding quotes
              val = val.replace(/^['"]|['"]$/g, '').trim();
              if (val && val !== 'your_omdb_api_key_here') {
                return val;
              }
            }
          }
        }
      } catch {
        // Skip unreadable files
      }
    }
  }

  // 3. Fallback to Vite loadEnv
  try {
    const env = loadEnv(mode, rootPath || process.cwd(), '');
    const key = (env.OMDB_API_KEY || '').trim();
    if (key && key !== 'your_omdb_api_key_here') {
      return key;
    }
  } catch {
    // Ignore loadEnv errors
  }

  return '';
}

/**
 * Backend middleware for OMDb API integration.
 * The OMDB_API_KEY secret is loaded securely from the backend environment (.env)
 * and is NEVER exposed or transmitted to the client frontend code.
 */
export function createOmdbMiddleware(getRoot = () => process.cwd(), getMode = () => 'development') {
  return async function omdbMiddleware(req, res, next) {
    const reqUrl = req.url || '';
    if (!reqUrl.startsWith('/api/omdb')) {
      if (typeof next === 'function') return next();
      return;
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');

    const rootDir = typeof getRoot === 'function' ? getRoot() : process.cwd();
    const mode = typeof getMode === 'function' ? getMode() : 'development';
    const apiKey = getOmdbApiKey(rootDir, mode);

    try {
      const url = new URL(reqUrl, 'http://localhost');

      // Health & status verification endpoint: /api/omdb?check=1 or /api/omdb/health
      if (url.searchParams.has('check') || url.pathname.endsWith('/health')) {
        res.statusCode = 200;
        res.end(JSON.stringify({
          status: 'ok',
          configured: Boolean(apiKey && apiKey !== 'your_omdb_api_key_here'),
          provider: 'OMDb API'
        }));
        return;
      }

      const clientKey = url.searchParams.get('key') || url.searchParams.get('apikey');
      const effectiveKey = (clientKey && clientKey.trim()) ? clientKey.trim() : apiKey;

      if (!effectiveKey) {
        res.statusCode = 200;
        res.end(JSON.stringify({
          success: false,
          configured: false,
          error: 'OMDB_API_KEY is not configured in backend environment (.env)'
        }));
        return;
      }

      const title = url.searchParams.get('title') || url.searchParams.get('t');
      const year = url.searchParams.get('year') || url.searchParams.get('y');

      if (!title) {
        res.statusCode = 400;
        res.end(JSON.stringify({ success: false, error: 'Movie title is required' }));
        return;
      }

      // Query OMDb API securely on the backend
      const omdbUrl = new URL('https://www.omdbapi.com/');
      omdbUrl.searchParams.set('apikey', effectiveKey);
      omdbUrl.searchParams.set('t', title);
      if (year) omdbUrl.searchParams.set('y', year);
      omdbUrl.searchParams.set('type', 'movie');

      let omdbRes = await fetch(omdbUrl.toString(), {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(6000)
      });

      if (!omdbRes.ok) {
        res.statusCode = 200;
        res.end(JSON.stringify({
          success: false,
          error: `OMDb service returned HTTP ${omdbRes.status}`
        }));
        return;
      }

      let data = await omdbRes.json();

      // If not found with year, retry without year (release years in catalogs can vary by 1 year)
      if (data.Response !== 'True' && year) {
        omdbUrl.searchParams.delete('y');
        try {
          const fallbackRes = await fetch(omdbUrl.toString(), {
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(5000)
          });
          if (fallbackRes.ok) {
            const fallbackData = await fallbackRes.json();
            if (fallbackData.Response === 'True') {
              data = fallbackData;
            }
          }
        } catch {
          // Keep original data
        }
      }

      if (data.Response === 'True') {
        const hasPoster = Boolean(data.Poster && data.Poster !== 'N/A');
        res.statusCode = 200;
        res.end(JSON.stringify({
          success: true,
          configured: true,
          found: true,
          title: data.Title,
          year: data.Year,
          poster: hasPoster ? data.Poster : null,
          imdbId: data.imdbID || null,
          rating: data.imdbRating || null,
          rated: data.Rated || null,
          runtime: data.Runtime || null,
          plot: data.Plot || null
        }));
      } else {
        res.statusCode = 200;
        res.end(JSON.stringify({
          success: false,
          configured: true,
          found: false,
          error: data.Error || 'Movie not found in OMDb'
        }));
      }
    } catch (err) {
      res.statusCode = 200;
      res.end(JSON.stringify({
        success: false,
        error: err.message || 'Error processing OMDb request'
      }));
    }
  };
}
