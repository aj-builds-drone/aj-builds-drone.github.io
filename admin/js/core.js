/* ═══════════════════════════════════════════════════════════════════
   core.js — API client, tab system, utilities, auto-refresh
   ═══════════════════════════════════════════════════════════════════ */
var D = D || {};

D.API = window.location.origin + '/drone-api';
D._refreshInterval = null;
D._refreshCountdown = 30;
D._charts = {};

// ── API Client ──
D.api = async function(path) {
  try {
    var r = await fetch(D.API + path);
    if (!r.ok) throw new Error(r.statusText);
    return await r.json();
  } catch (e) { console.error('API GET:', path, e); return null; }
};

D.post = async function(path, body) {
  try {
    var r = await fetch(D.API + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    });
    return await r.json();
  } catch (e) { console.error('API POST:', path, e); return null; }
};

// ── Tab System ──
D.showTab = function(name, btn) {
  document.querySelectorAll('.tab-content').forEach(function(el) { el.classList.add('hidden'); });
  document.querySelectorAll('.tab-btn').forEach(function(b) { b.classList.remove('active'); b.classList.add('bg-carbon-700'); });
  var content = document.getElementById('tab-' + name);
  if (content) { content.classList.remove('hidden'); content.classList.add('slide-up'); }
  if (btn) { btn.classList.add('active'); btn.classList.remove('bg-carbon-700'); }
  document.querySelectorAll('.desktop-tabs [data-tab="' + name + '"]').forEach(function(b) { b.classList.add('active'); b.classList.remove('bg-carbon-700'); });
  // Lazy-load tab content
  if (name === 'map' && D.Analytics) D.Analytics.initMap();
  if (name === 'analytics' && D.Analytics) D.Analytics.loadCharts();
  if (name === 'queue' && D.Analytics) D.Analytics.loadQueue();
  if (name === 'sent' && D.Sent) D.Sent.load();
  if (name === 'prospects' && D.Prospects) D.Prospects.load();
  if (name === 'ab-tests' && D.Analytics) { D.Analytics.loadABTests(); D.Analytics.loadOptimizer(); }
  if (name === 'agents' && D.Agents) D.Agents.load();
  if (name === 'discovery' && D.Discovery) { D.Discovery.loadSourcePerf(); D.Discovery.loadEmailCoverage(); }
  if (name === 'pipeline' && D.Overview) D.Overview.loadPipeline();
  if (name === 'activity' && D.Overview) D.Overview.loadFullActivity();
};

// ── Utilities ──
D.esc = function(s) {
  if (!s) return '';
  var d = document.createElement('div');
  d.textContent = String(s);
  return d.innerHTML;
};

D.timeAgo = function(iso) {
  if (!iso) return '';
  var diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  return Math.floor(diff / 86400) + 'd ago';
};

D.statusClass = function(s) {
  var m = {
    discovered: 'bg-gray-600/40 text-gray-300', enriched: 'bg-blue-600/30 text-blue-300',
    audited: 'bg-cyan-600/30 text-cyan-300', scored: 'bg-indigo-600/30 text-indigo-300',
    queued: 'bg-yellow-600/30 text-yellow-300', contacted: 'bg-amber-600/30 text-amber-300',
    opened: 'bg-orange-600/30 text-orange-300', replied: 'bg-green-600/30 text-green-300',
    meeting: 'bg-purple-600/30 text-purple-300', converted: 'bg-pink-600/30 text-pink-300',
    draft: 'bg-gray-600/40 text-gray-300', approved: 'bg-green-600/30 text-green-300',
    sent: 'bg-blue-600/30 text-blue-300', rejected: 'bg-red-600/30 text-red-300',
    failed: 'bg-red-600/30 text-red-300', dead: 'bg-red-800/30 text-red-400'
  };
  return m[s] || 'bg-gray-600/40 text-gray-300';
};

D.tierClass = function(t) {
  return t === 'hot' ? 'text-orange-400' : t === 'warm' ? 'text-yellow-400' : 'text-blue-400';
};

// ── Toast Notifications ──
D.toast = function(msg, type) {
  type = type || 'info';
  var el = document.createElement('div');
  el.className = 'toast toast-' + type;
  el.textContent = msg;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(function() { el.style.opacity = '0'; el.style.transform = 'translateY(-10px)'; el.style.transition = 'all 0.3s'; }, 3000);
  setTimeout(function() { el.remove(); }, 3500);
};

// ── Chart Helper ──
D.renderChart = function(canvasId, type, data, opts) {
  if (D._charts[canvasId]) D._charts[canvasId].destroy();
  var ctx = document.getElementById(canvasId);
  if (!ctx) return;
  D._charts[canvasId] = new Chart(ctx, { type: type, data: data, options: opts || {} });
};

D.chartOpts = function() {
  return {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { labels: { color: '#9ca3af', font: { family: 'JetBrains Mono', size: 10 } } } },
    scales: {
      x: { ticks: { color: '#6b7280', font: { family: 'JetBrains Mono', size: 9 } }, grid: { color: 'rgba(48,54,61,0.3)' } },
      y: { ticks: { color: '#6b7280', font: { family: 'JetBrains Mono', size: 9 } }, grid: { color: 'rgba(48,54,61,0.3)' }, beginAtZero: true }
    }
  };
};

// ── Mini SVG Donut ──
D.miniDonut = function(data, colors, size) {
  size = size || 80;
  var total = data.reduce(function(a, b) { return a + b; }, 0);
  if (!total) return '<div class="text-gray-500 text-xs">No data</div>';
  var r = size / 2 - 4, cx = size / 2, cy = size / 2;
  var circumference = 2 * Math.PI * r;
  var offset = 0;
  var paths = '';
  for (var i = 0; i < data.length; i++) {
    var pct = data[i] / total;
    var dash = pct * circumference;
    paths += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="' + colors[i] + '" stroke-width="8" stroke-dasharray="' + dash + ' ' + (circumference - dash) + '" stroke-dashoffset="' + (-offset) + '" transform="rotate(-90 ' + cx + ' ' + cy + ')" />';
    offset += dash;
  }
  return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '">' + paths + '<text x="' + cx + '" y="' + (cy + 4) + '" text-anchor="middle" fill="#fff" font-size="12" font-family="JetBrains Mono">' + total + '</text></svg>';
};

// ── Auto Refresh ──
D.startAutoRefresh = function() {
  D._refreshCountdown = 30;
  clearInterval(D._refreshInterval);
  D._refreshInterval = setInterval(function() {
    D._refreshCountdown--;
    var el = document.getElementById('refresh-countdown');
    var ring = document.getElementById('refresh-ring');
    if (el) el.textContent = D._refreshCountdown + 's';
    if (ring) ring.style.transform = 'rotate(' + ((30 - D._refreshCountdown) * 12) + 'deg)';
    if (D._refreshCountdown <= 0) {
      D._refreshCountdown = 30;
      D.refreshAll();
    }
  }, 1000);
};

D.refreshAll = function() {
  D._refreshCountdown = 30;
  if (D.Overview) D.Overview.load();
};

// ── Boot ──
D.boot = function() {
  D.startAutoRefresh();
  if (D.Overview) D.Overview.load();
  // Keyboard shortcuts
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') { if (D.Prospects) D.Prospects.closeModal(); }
  });
  var modal = document.getElementById('prospect-modal');
  if (modal) modal.addEventListener('click', function(e) { if (e.target === e.currentTarget && D.Prospects) D.Prospects.closeModal(); });
};

document.addEventListener('DOMContentLoaded', D.boot);
