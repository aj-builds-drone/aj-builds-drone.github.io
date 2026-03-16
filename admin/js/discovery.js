/* ═══════════════════════════════════════════════════════════════════
   discovery.js — Crawlers, Email Hunter, Source Performance
   ═══════════════════════════════════════════════════════════════════ */
D.Discovery = {};
D.Discovery._crawlLog = [];

var CRAWLERS = [
  { id: 'scholar', icon: '&#x1F393;', label: 'Scholar', desc: 'Google Scholar', color: 'green', endpoint: '/outreach/discover/scholar' },
  { id: 'nsf', icon: '&#x1F3DB;', label: 'NSF Awards', desc: 'Grant funding', color: 'blue', endpoint: '/outreach/discover/nsf' },
  { id: 'faculty', icon: '&#x1F3EB;', label: 'Faculty', desc: 'University sites', color: 'purple', endpoint: '/outreach/discover/faculty' },
  { id: 'arxiv', icon: '&#x1F4C4;', label: 'arXiv', desc: 'Research papers', color: 'orange', endpoint: '/outreach/discover/arxiv' },
  { id: 'github', icon: '&#x1F419;', label: 'GitHub', desc: 'PX4/ArduPilot/ROS2', color: 'gray', endpoint: '/outreach/discover/github' },
  { id: 'sam-gov', icon: '&#x1F3DB;', label: 'SAM.gov', desc: 'Govt drone RFPs', color: 'red', endpoint: '/outreach/discover/sam-gov' }
];

// Render crawler buttons on first load
D.Discovery.renderButtons = function() {
  var el = document.getElementById('crawler-buttons');
  if (!el) return;
  el.innerHTML = CRAWLERS.map(function(c) {
    return '<button onclick="D.Discovery.triggerCrawl(\'' + c.id + '\',\'btn-' + c.id + '\')" id="btn-' + c.id + '" class="discover-btn glass rounded-lg p-4 text-center hover:border-' + c.color + '-500/30 group">' +
      '<div class="text-2xl mb-1">' + c.icon + '</div>' +
      '<div class="text-xs font-medium text-white group-hover:text-' + c.color + '-400">' + c.label + '</div>' +
      '<div class="text-[10px] text-gray-500 mt-0.5">' + c.desc + '</div></button>';
  }).join('');
};

D.Discovery.triggerCrawl = async function(source, btnId) {
  var btn = document.getElementById(btnId);
  if (btn) btn.classList.add('running');
  D.Discovery.log('Starting ' + source + ' crawl...', 'text-yellow-400');

  var crawler = CRAWLERS.find(function(c) { return c.id === source; });
  var endpoint = crawler ? crawler.endpoint : '/outreach/discover/' + source;
  var result = await D.post(endpoint);

  if (btn) btn.classList.remove('running');
  if (result) {
    var found = result.prospects_found != null ? result.prospects_found : (result.merged != null ? result.merged : '?');
    var newP = result.prospects_new != null ? result.prospects_new : '';
    D.Discovery.log(source + ': ' + found + ' found' + (newP ? ', ' + newP + ' new' : ''), 'text-green-400');
    D.toast(source + ': ' + found + ' found' + (newP ? ', ' + newP + ' new' : ''), 'success');
  } else {
    D.Discovery.log(source + ': failed', 'text-red-400');
    D.toast(source + ' crawl failed', 'error');
  }
};

D.Discovery.batchScore = async function() {
  var btn = document.getElementById('btn-score');
  if (btn) btn.classList.add('running');
  D.Discovery.log('Running batch score...', 'text-yellow-400');
  var result = await D.post('/outreach/batch/score');
  if (btn) btn.classList.remove('running');
  if (result) {
    D.Discovery.log('Scored ' + (result.scored || '?') + ' prospects', 'text-green-400');
    D.toast('Scored ' + (result.scored || '?') + ' prospects', 'success');
  } else {
    D.Discovery.log('Batch score failed', 'text-red-400');
  }
};

D.Discovery.seedAll = async function() {
  var btn = document.getElementById('btn-seed');
  if (btn) btn.classList.add('running');
  D.Discovery.log('Seeding ALL sources...', 'text-cyan-400');
  var result = await D.post('/outreach/discover/seed-batch', {});
  if (btn) btn.classList.remove('running');
  if (result) {
    D.Discovery.log('Seed: ' + result.sources_run + ' sources, ' + result.total_new + ' new', 'text-green-400');
    D.toast('Seeded ' + result.total_new + ' new prospects from ' + result.sources_run + ' sources', 'success');
  } else {
    D.Discovery.log('Seed batch failed', 'text-red-400');
  }
};

D.Discovery.emailHunt = async function() {
  var btn = document.getElementById('btn-email-hunt');
  if (btn) btn.classList.add('running');
  D.Discovery.log('Email hunt (7 strategies, 30 prospects)...', 'text-emerald-400');
  var result = await D.post('/outreach/email-hunt?batch_size=30');
  if (btn) btn.classList.remove('running');
  if (result) {
    D.Discovery.log('Emails: ' + result.found + '/' + result.tried + ' found', result.found > 0 ? 'text-green-400' : 'text-yellow-400');
    D.toast('Found ' + result.found + ' emails from ' + result.tried + ' prospects', result.found > 0 ? 'success' : 'info');
    D.Discovery.loadEmailCoverage();
  } else {
    D.Discovery.log('Email hunt failed', 'text-red-400');
  }
};

D.Discovery.log = function(msg, colorClass) {
  var ts = new Date().toLocaleTimeString();
  D.Discovery._crawlLog.unshift({ ts: ts, msg: msg, color: colorClass });
  if (D.Discovery._crawlLog.length > 50) D.Discovery._crawlLog.pop();
  document.getElementById('crawl-log').innerHTML = D.Discovery._crawlLog.map(function(e) {
    return '<div class="' + e.color + '"><span class="text-gray-600">[' + e.ts + ']</span> ' + D.esc(e.msg) + '</div>';
  }).join('');
};

D.Discovery.loadSourcePerf = async function() {
  var data = await D.api('/outreach/optimizer/sources');
  var el = document.getElementById('source-perf');
  if (!data || data.error) {
    el.innerHTML = '<p class="text-gray-500 text-xs col-span-full">Not enough data yet.</p>';
    return;
  }
  var icons = { scholar: '&#x1F393;', nsf: '&#x1F3DB;', faculty_page: '&#x1F3EB;', arxiv: '&#x1F4C4;', github: '&#x1F419;', sam_gov: '&#x1F3DB;' };
  var colors = { scholar: 'green', nsf: 'blue', faculty_page: 'purple', arxiv: 'orange', github: 'gray', sam_gov: 'red' };
  el.innerHTML = Object.entries(data).map(function(entry) {
    var src = entry[0], stats = entry[1];
    return '<div class="glass rounded-lg p-3 text-center">' +
      '<div class="text-xl mb-1">' + (icons[src] || '&#x1F4CA;') + '</div>' +
      '<div class="text-xs font-medium text-white capitalize">' + src.replace('_', ' ') + '</div>' +
      '<div class="text-lg font-bold font-mono text-' + (colors[src] || 'gray') + '-400 mt-1">' + (stats.total_discovered || 0) + '</div>' +
      '<div class="text-[10px] text-gray-500">discovered</div>' +
      (stats.reply_rate != null ? '<div class="text-[10px] text-green-400 mt-1">' + stats.reply_rate + '% reply</div>' : '') +
      '</div>';
  }).join('');
};

D.Discovery.loadEmailCoverage = async function() {
  var data = await D.api('/outreach/email-hunt/stats');
  if (!data) return;
  var pctEl = document.getElementById('email-pct');
  var covEl = document.getElementById('email-coverage');
  if (pctEl) pctEl.textContent = data.coverage_pct + '%';
  if (covEl) covEl.textContent = data.with_email + '/' + data.total_prospects + ' have email';
};

// Auto-render buttons on load
document.addEventListener('DOMContentLoaded', function() { D.Discovery.renderButtons(); });
