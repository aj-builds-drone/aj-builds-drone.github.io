/* ═══════════════════════════════════════════════════════════════════
   overview.js — KPIs, Pipeline Flowchart, Funnel, Activity Feed
   ═══════════════════════════════════════════════════════════════════ */
D.Overview = {};

D.Overview.load = async function() {
  var results = await Promise.all([
    D.api('/outreach/stats'),
    D.api('/outreach/funnel'),
    D.api('/outreach/top-prospects?limit=20'),
    D.api('/outreach/agents/status')
  ]);
  var stats = results[0], funnel = results[1], top = results[2], agents = results[3];

  // API status indicator
  var dot = document.getElementById('api-dot'), label = document.getElementById('api-label');
  if (stats) {
    dot.className = 'status-dot bg-green-500 pulse-dot';
    label.textContent = 'API Connected';
    label.className = 'text-green-400 hidden md:inline text-[10px] font-mono';
  } else {
    dot.className = 'status-dot bg-red-500';
    label.textContent = 'API Offline';
    label.className = 'text-red-400 hidden md:inline text-[10px] font-mono';
  }

  if (stats) D.Overview.renderKPIs(stats);
  if (funnel) D.Overview.renderFunnel(funnel);
  if (top) D.Overview.renderTopProspects(top);
  if (agents) {
    var agentList = Object.values(agents.agents || {});
    var running = agentList.filter(function(a) { return a.status === 'running'; }).length;
    var total = agentList.length;
    var stopped = agentList.filter(function(a) { return a.status === 'stopped'; }).length;
    document.getElementById('agent-count').textContent = (total - stopped) + (running > 0 ? ' (' + running + ' active)' : '');
  }
  if (stats) D.Overview.renderBreakdowns(stats);
  D.Overview.loadActivityPreview();
};

// ── KPI Cards ──
D.Overview.renderKPIs = function(s) {
  var cards = [
    { label: 'TOTAL', value: s.total_prospects, bg: 'from-blue-500/10 to-cyan-500/10', color: 'text-cyan-400', icon: '&#x1F4CA;' },
    { label: 'HOT', value: (s.by_tier && s.by_tier.hot) || 0, bg: 'from-orange-500/10 to-red-500/10', color: 'text-orange-400', icon: '&#x1F525;' },
    { label: 'WARM', value: (s.by_tier && s.by_tier.warm) || 0, bg: 'from-yellow-500/10 to-amber-500/10', color: 'text-yellow-400', icon: '&#x2600;' },
    { label: 'COLD', value: (s.by_tier && s.by_tier.cold) || 0, bg: 'from-blue-500/10 to-indigo-500/10', color: 'text-blue-400', icon: '&#x2744;' },
    { label: 'EMAILS SENT', value: s.emails_sent, bg: 'from-purple-500/10 to-violet-500/10', color: 'text-purple-400', icon: '&#x1F4E4;' },
    { label: 'OPENED', value: s.emails_opened || 0, bg: 'from-cyan-500/10 to-teal-500/10', color: 'text-cyan-400', icon: '&#x1F441;' },
    { label: 'OPEN RATE', value: s.open_rate + '%', bg: 'from-green-500/10 to-emerald-500/10', color: 'text-green-400', icon: '&#x1F4C8;' },
    { label: 'REPLY RATE', value: s.reply_rate + '%', bg: 'from-green-500/10 to-lime-500/10', color: 'text-green-400', icon: '&#x1F4AC;' },
  ];
  document.getElementById('kpi-cards').innerHTML = cards.map(function(c) {
    return '<div class="glass stat-card rounded-xl p-3 bg-gradient-to-br ' + c.bg + '">' +
      '<div class="text-center text-sm mb-1">' + c.icon + '</div>' +
      '<div class="' + c.color + ' text-xl md:text-2xl font-bold kpi-value text-center">' + c.value + '</div>' +
      '<p class="text-[9px] text-gray-500 uppercase tracking-wider text-center mt-1">' + c.label + '</p></div>';
  }).join('');
};

// ── Funnel Bars ──
D.Overview.renderFunnel = function(data) {
  var el = document.getElementById('funnel-bars');
  var vals = Object.values(data.funnel);
  var max = Math.max.apply(null, vals.concat([1]));
  var total = vals.reduce(function(a, b) { return a + b; }, 0);
  document.getElementById('funnel-total').textContent = total + ' total';
  var colors = {
    discovered: 'bg-gray-500', enriched: 'bg-blue-600', audited: 'bg-cyan-500',
    scored: 'bg-indigo-500', queued: 'bg-yellow-500', contacted: 'bg-amber-500',
    opened: 'bg-orange-500', replied: 'bg-green-500', meeting: 'bg-purple-500', converted: 'bg-pink-500'
  };
  el.innerHTML = data.stages.map(function(s) {
    var count = data.funnel[s] || 0;
    var width = Math.max((count / max) * 100, 2);
    return '<div class="flex items-center gap-3">' +
      '<span class="text-[10px] text-gray-500 w-20 text-right capitalize font-mono">' + s + '</span>' +
      '<div class="flex-1 bg-carbon-700 rounded-full h-5 overflow-hidden">' +
      '<div class="funnel-bar ' + (colors[s] || 'bg-gray-500') + ' h-full rounded-full flex items-center justify-end px-2" style="width:' + width + '%">' +
      '<span class="text-[10px] font-mono font-bold text-white">' + count + '</span></div></div></div>';
  }).join('');
};

// ── Breakdown Donuts ──
D.Overview.renderBreakdowns = function(stats) {
  // By Source
  var sourceEl = document.getElementById('source-donut');
  if (stats.by_source) {
    var srcKeys = Object.keys(stats.by_source);
    var srcVals = srcKeys.map(function(k) { return stats.by_source[k]; });
    var srcColors = ['#00D4FF', '#0b6df5', '#A855F7', '#FF8A00', '#6b7280', '#EC4899'];
    var legend = srcKeys.map(function(k, i) {
      return '<div class="flex items-center gap-1.5 text-[10px]"><span class="w-2 h-2 rounded-full" style="background:' + srcColors[i] + '"></span><span class="text-gray-400">' + D.esc(k.replace('_', ' ')) + '</span><span class="text-white font-mono">' + stats.by_source[k] + '</span></div>';
    }).join('');
    sourceEl.innerHTML = D.miniDonut(srcVals, srcColors) + '<div class="space-y-1">' + legend + '</div>';
  }

  // By Org Type
  var orgEl = document.getElementById('orgtype-donut');
  if (stats.by_org_type) {
    var orgKeys = Object.keys(stats.by_org_type);
    var orgVals = orgKeys.map(function(k) { return stats.by_org_type[k]; });
    var orgColors = ['#00FF88', '#FFD600', '#FF6B6B', '#00D4FF', '#A855F7'];
    var oLegend = orgKeys.map(function(k, i) {
      return '<div class="flex items-center gap-1.5 text-[10px]"><span class="w-2 h-2 rounded-full" style="background:' + orgColors[i] + '"></span><span class="text-gray-400 capitalize">' + D.esc(k) + '</span><span class="text-white font-mono">' + stats.by_org_type[k] + '</span></div>';
    }).join('');
    orgEl.innerHTML = D.miniDonut(orgVals, orgColors) + '<div class="space-y-1">' + oLegend + '</div>';
  }
};

// ── Top Prospects ──
D.Overview.renderTopProspects = function(prospects) {
  var el = document.getElementById('top-prospects-table');
  if (!prospects.length) {
    el.innerHTML = '<tr><td colspan="9" class="py-8 text-center text-gray-500 text-xs">No prospects yet. Run a crawler to get started.</td></tr>';
    return;
  }
  el.innerHTML = prospects.map(function(p) {
    var emailCell = p.email
      ? '<span class="text-green-400 text-[10px] font-mono truncate max-w-[120px] inline-block" title="' + D.esc(p.email) + '">' + D.esc(p.email) + '</span>'
      : '<span class="text-gray-600 text-[10px]">&mdash;</span>';
    return '<tr class="border-b border-carbon-700/50 hover:bg-carbon-800/50 transition cursor-pointer" onclick="D.Prospects.open(\'' + p.id + '\')">' +
      '<td class="py-2 px-3"><span class="text-white font-medium">' + D.esc(p.name) + '</span><br/><span class="text-[10px] text-gray-600">' + D.esc(p.title || '') + '</span></td>' +
      '<td class="py-2 px-3">' + emailCell + '</td>' +
      '<td class="py-2 px-3">' + D.esc(p.organization || '') + '</td>' +
      '<td class="py-2 px-3 text-gray-400">' + D.esc(p.lab_name || '') + '</td>' +
      '<td class="py-2 px-3 text-center font-mono text-gray-300">' + (p.h_index != null ? p.h_index : '&mdash;') + '</td>' +
      '<td class="py-2 px-3 text-center font-mono text-white font-bold">' + (p.priority_score != null ? p.priority_score : '&mdash;') + '</td>' +
      '<td class="py-2 px-3 text-center"><span class="' + D.tierClass(p.tier) + ' text-[10px] font-bold uppercase tracking-wider">' + (p.tier || '&mdash;') + '</span></td>' +
      '<td class="py-2 px-3"><span class="px-2 py-0.5 rounded-full text-[10px] ' + D.statusClass(p.status) + '">' + (p.status || '&mdash;') + '</span></td>' +
      '<td class="py-2 px-3 text-[10px] text-gray-500 font-mono">' + (p.source || '&mdash;') + '</td></tr>';
  }).join('');
};

// ── Pipeline Flowchart (Pipeline Tab) ──
D.Overview.loadPipeline = async function() {
  var data = await D.api('/outreach/funnel');
  if (!data) return;

  var stages = [
    { key: 'discovered', icon: '&#x1F50D;', label: 'Discovered', desc: 'Crawlers find researchers' },
    { key: 'enriched', icon: '&#x1F52C;', label: 'Enriched', desc: 'Profile data enhanced' },
    { key: 'audited', icon: '&#x1F50E;', label: 'Audited', desc: 'Lab capabilities scored' },
    { key: 'scored', icon: '&#x26A1;', label: 'Scored', desc: 'Priority ranking applied' },
    { key: 'queued', icon: '&#x1F4CB;', label: 'Queued', desc: 'Email drafts generated' },
    { key: 'contacted', icon: '&#x1F4E4;', label: 'Contacted', desc: 'Email sent (approved)' },
    { key: 'opened', icon: '&#x1F441;', label: 'Opened', desc: 'Tracking pixel fired' },
    { key: 'replied', icon: '&#x1F4AC;', label: 'Replied', desc: 'Response received' },
    { key: 'meeting', icon: '&#x1F4C5;', label: 'Meeting', desc: 'Call/demo scheduled' },
    { key: 'converted', icon: '&#x1F389;', label: 'Converted', desc: 'Deal closed' }
  ];

  var html = '';
  var prevCount = 0;
  stages.forEach(function(s, i) {
    var count = data.funnel[s.key] || 0;
    var hasItems = count > 0;
    // Determine node state
    var state = 'pending';
    if (hasItems) state = 'has-items done';
    // Active = has items and is transition point (count drops from prev)
    if (hasItems && i > 0 && count < prevCount) state = 'has-items active';
    if (i === 0 && hasItems) state = 'has-items done';

    // Connector (except before first)
    if (i > 0) {
      var lit = prevCount > 0 ? 'lit' : '';
      html += '<div class="pipe-connector ' + lit + '"></div>';
    }

    // Node
    html += '<div class="pipe-node ' + state + '">' +
      '<div class="flex items-center justify-center gap-2">' +
      '<span class="text-lg">' + s.icon + '</span>' +
      '<span class="font-mono font-bold text-sm text-white">' + s.label + '</span>' +
      '<span class="text-xl font-bold font-mono ' + (hasItems ? 'text-neon-green' : 'text-gray-600') + '">' + count + '</span>' +
      '</div>' +
      '<div class="text-[10px] text-gray-500 mt-0.5">' + s.desc + '</div>' +
      '</div>';

    prevCount = count;
  });

  document.getElementById('pipeline-flowchart').innerHTML = html;

  // Conversion rates
  D.Overview.renderConversionRates(data, stages);
  D.Overview.renderVelocity(data, stages);
};

D.Overview.renderConversionRates = function(data, stages) {
  var el = document.getElementById('conversion-rates');
  var html = '';
  for (var i = 1; i < stages.length; i++) {
    var prev = data.funnel[stages[i - 1].key] || 0;
    var curr = data.funnel[stages[i].key] || 0;
    var rate = prev > 0 ? Math.round((curr / prev) * 100) : 0;
    var barColor = rate > 50 ? 'bg-green-500' : rate > 20 ? 'bg-yellow-500' : rate > 0 ? 'bg-orange-500' : 'bg-gray-600';
    html += '<div class="flex items-center gap-2">' +
      '<span class="text-[10px] text-gray-500 w-32 text-right font-mono">' + stages[i - 1].label + ' → ' + stages[i].label + '</span>' +
      '<div class="flex-1 bg-carbon-700 rounded-full h-3 overflow-hidden">' +
      '<div class="' + barColor + ' h-full rounded-full transition-all" style="width:' + Math.max(rate, 2) + '%"></div></div>' +
      '<span class="text-[10px] font-mono font-bold ' + (rate > 50 ? 'text-green-400' : rate > 0 ? 'text-yellow-400' : 'text-gray-600') + ' w-10 text-right">' + rate + '%</span></div>';
  }
  el.innerHTML = html || '<p class="text-gray-500 text-xs">No conversion data yet.</p>';
};

D.Overview.renderVelocity = function(data, stages) {
  var el = document.getElementById('pipeline-velocity');
  var total = 0;
  stages.forEach(function(s) { total += data.funnel[s.key] || 0; });
  var contacted = data.funnel.contacted || 0;
  var replied = data.funnel.replied || 0;
  var converted = data.funnel.converted || 0;
  var discovered = data.funnel.discovered || 0;

  var metrics = [
    { label: 'Total in Pipeline', value: total, color: 'text-cyan-400' },
    { label: 'Contact Rate', value: (discovered > 0 ? Math.round(contacted / discovered * 100) : 0) + '%', color: 'text-amber-400' },
    { label: 'Reply Rate', value: (contacted > 0 ? Math.round(replied / contacted * 100) : 0) + '%', color: 'text-green-400' },
    { label: 'Conversion Rate', value: (discovered > 0 ? Math.round(converted / discovered * 100) : 0) + '%', color: 'text-pink-400' }
  ];

  el.innerHTML = metrics.map(function(m) {
    return '<div class="glass rounded-lg p-3 text-center">' +
      '<div class="text-lg font-bold font-mono ' + m.color + '">' + m.value + '</div>' +
      '<div class="text-[10px] text-gray-500">' + m.label + '</div></div>';
  }).join('');
};

// ── Activity Preview (Overview sidebar) ──
D.Overview.loadActivityPreview = async function() {
  // Not shown in overview anymore, but used by Activity tab
};

// ── Full Activity Feed (Activity Tab) ──
D.Overview.loadFullActivity = async function() {
  var data = await D.api('/dashboard/activity-feed?limit=200');
  var el = document.getElementById('full-activity-feed');
  if (!data || !data.activities || !data.activities.length) {
    // Show agent status as fallback when no log entries exist yet
    var agentData = await D.api('/outreach/agents/status');
    if (agentData && agentData.agents) {
      var agents = agentData.agents;
      var html = '<div class="mb-3"><p class="text-xs text-gray-400 mb-3">Agent activity is being tracked. Recent agent status:</p></div>';
      var names = Object.keys(agents);
      names.forEach(function(name) {
        var a = agents[name];
        var statusColor = a.status === 'idle' ? 'text-green-400' : a.status === 'running' ? 'text-blue-400' : a.status === 'error' ? 'text-red-400' : 'text-gray-500';
        var statusBg = a.status === 'error' ? 'bg-red-600/10 border-red-600/20' : 'bg-carbon-700/50 border-carbon-700';
        var lastRun = a.last_run ? D.timeAgo(a.last_run) : 'never';
        html += '<div class="timeline-item py-2">' +
          '<div class="flex items-start gap-2">' +
          '<span class="text-base flex-shrink-0">' + (a.status === 'error' ? '❌' : a.status === 'running' ? '⚡' : '✅') + '</span>' +
          '<div class="flex-1 min-w-0">' +
          '<p class="text-xs text-gray-300"><span class="font-medium text-white">' + D.esc(name) + '</span>' +
          ' <span class="' + statusColor + '">' + (a.status || 'unknown').toUpperCase() + '</span></p>' +
          '<div class="flex gap-2 mt-0.5 flex-wrap">' +
          '<span class="text-[10px] text-gray-600 font-mono">Runs: ' + (a.runs || 0) + '</span>' +
          '<span class="text-[10px] text-gray-600 font-mono">Errors: ' + (a.errors || 0) + '</span>' +
          '<span class="text-[10px] text-gray-600 font-mono">Last: ' + lastRun + '</span>' +
          (a.last_result && a.last_result.error ? '<span class="text-[10px] text-red-400 font-mono truncate max-w-[300px]">' + D.esc(a.last_result.error).substring(0, 100) + '</span>' : '') +
          '</div></div></div></div>';
      });
      el.innerHTML = html;
    } else {
      el.innerHTML = '<p class="text-gray-500 text-xs text-center py-8">No activity yet.</p>';
    }
    return;
  }

  // Group by date
  var groups = {};
  data.activities.forEach(function(a) {
    var date = a.created_at ? a.created_at.split('T')[0] : 'Unknown';
    if (!groups[date]) groups[date] = [];
    groups[date].push(a);
  });

  var html = '';
  Object.keys(groups).forEach(function(date) {
    var d = new Date(date + 'T00:00:00');
    var label = isNaN(d.getTime()) ? date : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    html += '<div class="mb-4">';
    html += '<div class="timeline-date-header text-xs font-semibold text-gray-400 mb-2">' + label + ' <span class="text-gray-600 font-mono">(' + groups[date].length + ')</span></div>';
    groups[date].forEach(function(a) {
      var time = a.created_at ? new Date(a.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '';
      var isError = a.action === 'error';
      var borderClass = isError ? 'border-l-red-600/50' : '';
      html += '<div class="timeline-item py-2 ' + borderClass + '">' +
        '<div class="flex items-start gap-2">' +
        '<span class="text-base flex-shrink-0">' + (a.icon || '&#x1F4CB;') + '</span>' +
        '<div class="flex-1 min-w-0">' +
        '<p class="text-xs ' + (isError ? 'text-red-300' : 'text-gray-300') + '">' + D.esc(a.description || a.action) + '</p>' +
        '<div class="flex gap-2 mt-0.5 flex-wrap">' +
        '<span class="text-[10px] text-gray-600 font-mono">' + time + '</span>' +
        (a.actor ? '<span class="text-[10px] px-1.5 py-0.5 rounded ' + (a.actor.startsWith('agent:') ? 'bg-blue-600/10 text-blue-400' : 'bg-carbon-600 text-gray-400') + '">' + D.esc(a.actor) + '</span>' : '') +
        (a.entity_type === 'agent' && a.action === 'error' ? '<span class="text-[10px] px-1.5 py-0.5 rounded bg-red-600/10 text-red-400">ERROR</span>' : '') +
        '</div></div></div></div>';
    });
    html += '</div>';
  });

  el.innerHTML = html;
};
