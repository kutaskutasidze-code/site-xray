#!/usr/bin/env node
// Generates a focused improvement brief for Claude
// Replaces 15 turns of file reading with 1 turn of reading this brief

const fs = require('fs');
const path = require('path');

const XRAY_DIR = process.argv[2] || '/opt/site-xray';
const version = process.argv[3] || fs.readFileSync(path.join(XRAY_DIR, 'VERSION'), 'utf-8').trim();
const strategy = process.argv[4] || 'universal';

// Read all data sources safely
function readJSON(filePath, fallback) {
  try {
    if (fs.existsSync(filePath)) return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (e) {}
  return fallback;
}

const reportFile = path.join(XRAY_DIR, `test/results/v${version}.json`);
const report = readJSON(reportFile, null);
const history = readJSON(path.join(XRAY_DIR, 'improve/history.json'), []);
const knowledge = readJSON(path.join(XRAY_DIR, 'improve/knowledge.json'), {});
const focus = readJSON(path.join(XRAY_DIR, 'improve/current-focus.json'), {});
const sites = readJSON(path.join(XRAY_DIR, 'test/sites.json'), {});
const trendsFile = path.join(XRAY_DIR, 'test/results/trends.json');
const trends = readJSON(trendsFile, {});

if (!report) { console.error('No report found for v' + version); process.exit(1); }

// Sort sites by score
const sorted = [...(report.sites || [])].sort((a, b) => a.totalScore - b.totalScore);
const worst3 = sorted.slice(0, 3);
const best3 = sorted.slice(-3).reverse();

// Find worst metric across all sites
const metricTotals = {};
for (const site of report.sites || []) {
  for (const [metric, data] of Object.entries(site.metrics || {})) {
    if (!metricTotals[metric]) metricTotals[metric] = { total: 0, count: 0, worst: { score: 100, site: '' } };
    metricTotals[metric].total += (data.score || 0);
    metricTotals[metric].count++;
    if ((data.score || 0) < metricTotals[metric].worst.score) {
      try {
        metricTotals[metric].worst = { score: data.score, site: new URL(site.site).hostname };
      } catch (e) {
        metricTotals[metric].worst = { score: data.score, site: site.site };
      }
    }
  }
}

// Safe hostname extraction
function getHostname(url) {
  try { return new URL(url).hostname; } catch (e) { return url; }
}

// Build the brief
const nextV = parseInt(version) + 1;
let brief = `## IMPROVEMENT BRIEF — v${nextV}
Current: v${version}, ${report.averageScore}/100, ${fs.readFileSync(path.join(XRAY_DIR, `v${version}-stable.js`), 'utf-8').split('\n').length} lines
Strategy: **${strategy.toUpperCase()}**
Consecutive failures: ${focus.consecutive_failures || 0}
Mastered: ${(sites.mastered || []).length} | Active: ${(sites.active || []).length} | Queue: ${(sites.queue || []).length}

`;

// Strategy-specific instructions
if (strategy === 'per-site') {
  const target = worst3[0];
  const host = getHostname(target.site);
  brief += `### FOCUS: ${host} (${target.totalScore}/100)
This is PER-SITE mode. Fix ONLY ${host}. Other sites must not regress.
The "3+ sites" universality rule is RELAXED — site-specific fixes are OK.

Per-metric breakdown:
`;
  for (const [metric, data] of Object.entries(target.metrics || {})) {
    brief += `  ${metric}: ${data.score}/100${data.score < 80 ? ' ← FIX THIS' : ''}\n`;
  }
  // Include analysis if it exists
  const hostSlug = host.replace(/\./g, '-');
  const analysisDir = path.join(XRAY_DIR, `test/results/v${version}`);
  if (fs.existsSync(analysisDir)) {
    const files = fs.readdirSync(analysisDir).filter(f => f.includes(hostSlug) && f.endsWith('-analysis.md'));
    if (files.length > 0) {
      const analysisFile = path.join(analysisDir, files[0]);
      brief += `\nAnalysis for ${host}:\n${fs.readFileSync(analysisFile, 'utf-8').slice(0, 1500)}\n`;
    }
  }
} else if (strategy === 'metric-focus') {
  const metricList = Object.entries(metricTotals)
    .map(([m, d]) => ({ metric: m, avg: Math.round(d.total / d.count), worst: d.worst }))
    .sort((a, b) => a.avg - b.avg);
  const worstMetric = metricList[0];
  brief += `### FOCUS: ${worstMetric.metric} metric (avg ${worstMetric.avg}/100)
This is METRIC-FOCUS mode. Improve the "${worstMetric.metric}" metric across all sites.
Worst: ${worstMetric.worst.site} at ${worstMetric.worst.score}/100

All metrics ranked by average:
`;
  for (const m of metricList) {
    brief += `  ${m.metric.padEnd(15)} avg:${m.avg}  worst:${m.worst.score} (${m.worst.site})\n`;
  }
  brief += '\n';
} else if (strategy === 'refactor') {
  brief += `### MODE: REFACTOR
10+ consecutive failures. Stop adding features. Instead:
- Clean up error handling
- Fix edge cases in existing code
- Improve reliability, not capability
- Reduce code complexity if possible
- Focus on the MOST FRAGILE part of the code

`;
} else {
  brief += `### MODE: UNIVERSAL
Find fixes that improve 3+ sites simultaneously.

`;
}

// Worst and best sites
brief += `\n### SITE SCORES (worst → best)\n`;
for (const s of sorted) {
  const h = getHostname(s.site);
  const marker = s.totalScore >= 98 ? 'PERFECT' : s.totalScore < 90 ? 'NEEDS_WORK' : 'OK';
  brief += `[${marker.padEnd(10)}] ${h.padEnd(25)} ${s.totalScore}/100\n`;
}

// Per-metric averages
brief += `\n### METRIC AVERAGES\n`;
for (const [m, d] of Object.entries(metricTotals).sort((a, b) => a[1].total / a[1].count - b[1].total / b[1].count)) {
  const avg = Math.round(d.total / d.count);
  brief += `  ${m.padEnd(15)} avg:${avg}  worst:${d.worst.score} (${d.worst.site})\n`;
}

// Last failed approaches (from focus context)
if (focus.last_approaches?.length > 0) {
  brief += `\n### LAST ${focus.last_approaches.length} FAILED APPROACHES (DO NOT REPEAT)\n`;
  for (const a of focus.last_approaches.slice(-5)) {
    brief += `  Attempt #${a.attempt}: ${(a.summary || 'no summary').slice(0, 150)}\n`;
  }
}

// Sites that regressed in past attempts
if (focus.regressions_seen?.length > 0) {
  brief += `\n### SITES THAT REGRESSED IN PAST ATTEMPTS (BE CAREFUL)\n`;
  for (const r of focus.regressions_seen) {
    brief += `  ${r}\n`;
  }
}

// Recent learnings (what worked)
const recentLearnings = (knowledge.learnings || []).filter(l => l.technique).slice(-3);
if (recentLearnings.length > 0) {
  brief += `\n### RECENT TECHNIQUES THAT WORKED\n`;
  for (const l of recentLearnings) {
    brief += `  ${l.version}: ${l.technique} → ${l.impact || ''}\n`;
  }
}

// Recent failed approaches from knowledge
const recentFails = (knowledge.failed_approaches || []).slice(-3);
if (recentFails.length > 0) {
  brief += `\n### RECENT FAILED APPROACHES FROM KNOWLEDGE BASE\n`;
  for (const f of recentFails) {
    brief += `  ${f.version}: ${f.reason || 'unknown'}`;
    if (f.diff_summary) brief += ` — code: ${f.diff_summary.slice(0, 120)}`;
    if (f.regressions) brief += ` — regressions: ${f.regressions.join(', ').slice(0, 120)}`;
    brief += '\n';
  }
}

// Volatile metrics warning
const volatileWarnings = [];
for (const [host, data] of Object.entries(trends)) {
  if (data.volatile_metrics && typeof data.volatile_metrics === 'object') {
    // Check if volatile_metrics has meaningful swing data (numbers, not raw scores)
    for (const [metric, swing] of Object.entries(data.volatile_metrics)) {
      if (typeof swing === 'number' && swing > 5) {
        volatileWarnings.push(`${host} ${metric}: ±${swing} (NON-DETERMINISTIC, don't try to fix)`);
      }
    }
  }
}
if (volatileWarnings.length > 0) {
  brief += `\n### VOLATILE METRICS (IGNORE — scores fluctuate naturally)\n`;
  for (const w of volatileWarnings) brief += `  ${w}\n`;
}

brief += `\n### INSTRUCTIONS
1. Read v${version}-stable.js (the current code)
2. Based on the strategy above, implement 2-4 targeted fixes
3. Test on the worst site: node v${nextV}-stable.js <worst-url> /tmp/test-v${nextV} 3
4. Quick single-site test available: node test/suite.js v${nextV} --site <hostname>
5. Read improve/CLAUDE.md for rules
`;

// Write to file
const briefFile = path.join(XRAY_DIR, 'improve/brief.md');
fs.writeFileSync(briefFile, brief);
console.log('Brief generated: ' + briefFile + ' (' + brief.split('\n').length + ' lines)');
