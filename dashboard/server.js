#!/usr/bin/env node
/**
 * Site X-Ray Dashboard Server
 * Serves the dashboard UI + JSON API for test results, history, knowledge base.
 *
 * Usage: node dashboard/server.js [port]
 * Default port: 3847
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.argv[2] || 3847;
const XRAY_DIR = path.join(__dirname, '..');
const DASHBOARD_DIR = __dirname;

function readJSON(file) {
  try {
    return JSON.parse(fs.readFileSync(path.join(XRAY_DIR, file), 'utf-8'));
  } catch { return null; }
}

function getLatestReport() {
  const resultsDir = path.join(XRAY_DIR, 'test/results');
  if (!fs.existsSync(resultsDir)) return null;

  const reports = fs.readdirSync(resultsDir)
    .filter(f => f.endsWith('.json') && f.startsWith('v'))
    .sort((a, b) => {
      const numA = parseInt(a.match(/v(\d+)/)?.[1] || '0');
      const numB = parseInt(b.match(/v(\d+)/)?.[1] || '0');
      return numB - numA;
    });

  if (reports.length === 0) return null;
  return readJSON('test/results/' + reports[0]);
}

function getScreenshot(version, filename) {
  const file = path.join(XRAY_DIR, 'test/results', version, filename);
  if (!fs.existsSync(file)) return null;
  return fs.readFileSync(file);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');

  // API routes
  if (url.pathname === '/api/report') {
    const report = getLatestReport();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(report || { error: 'No reports yet' }));
    return;
  }

  if (url.pathname === '/api/history') {
    const history = readJSON('improve/history.json');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(history || []));
    return;
  }

  if (url.pathname === '/api/knowledge') {
    const kb = readJSON('improve/knowledge.json');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(kb || { learnings: [], failed_approaches: [] }));
    return;
  }

  if (url.pathname === '/api/sites') {
    const sites = readJSON('test/sites.json');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(sites || { active: [], mastered: [], queue: [] }));
    return;
  }

  if (url.pathname === '/api/cycle-status') {
    // Check if a cycle is currently running
    const lockExists = fs.existsSync('/tmp/site-xray-cycle.lock');
    let pid = null;
    if (lockExists) {
      try { pid = parseInt(fs.readFileSync('/tmp/site-xray-cycle.lock', 'utf-8').trim()); } catch {}
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ running: lockExists, pid }));
    return;
  }

  if (url.pathname.startsWith('/api/screenshot/')) {
    const parts = url.pathname.split('/');
    const version = parts[3];
    const filename = parts.slice(4).join('/');
    const data = getScreenshot(version, filename);
    if (data) {
      res.writeHead(200, { 'Content-Type': 'image/png' });
      res.end(data);
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
    return;
  }

  // Serve static files
  let filePath = url.pathname === '/' ? '/index.html' : url.pathname;
  filePath = path.join(DASHBOARD_DIR, filePath);

  if (!fs.existsSync(filePath)) {
    filePath = path.join(DASHBOARD_DIR, 'index.html'); // SPA fallback
  }

  const ext = path.extname(filePath);
  const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
  };

  try {
    const content = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'text/plain' });
    res.end(content);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Site X-Ray Dashboard running on http://0.0.0.0:${PORT}`);
});
