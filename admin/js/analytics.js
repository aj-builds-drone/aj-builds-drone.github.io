/* ═══════════════════════════════════════════════════════════════════
   analytics.js — Charts, Map, Email Queue, A/B Tests, Optimizer
   ═══════════════════════════════════════════════════════════════════ */
D.Analytics = {};
D.Analytics._map = null;
D.Analytics._markerLayer = null;
D.Analytics._mapInit = false;

// ═══ Campaign Analytics Charts ═══
D.Analytics.loadCharts = async function() {
  var data = await D.api('/dashboard/analytics/campaign');
  if (!data) return;
  var opts = D.chartOpts();

  if (data.by_org_type && data.by_org_type.length) {
    D.renderChart('chart-org-open', 'bar', {
      labels: data.by_org_type.map(function(r) { return r.org_type; }),
      datasets: [
        { label: 'Open %', data: data.by_org_type.map(function(r) { return r.open_rate; }), backgroundColor: 'rgba(0,212,255,0.7)' },
        { label: 'Click %', data: data.by_org_type.map(function(r) { return r.click_rate; }), backgroundColor: 'rgba(255,138,0,0.7)' },
        { label: 'Reply %', data: data.by_org_type.map(function(r) { return r.reply_rate; }), backgroundColor: 'rgba(0,255,136,0.7)' }
      ]
    }, opts);
  }

  if (data.by_step && data.by_step.length) {
    D.renderChart('chart-step', 'bar', {
      labels: data.by_step.map(function(r) { return 'Step ' + r.step; }),
      datasets: [
        { label: 'Open %', data: data.by_step.map(function(r) { return r.open_rate; }), backgroundColor: 'rgba(0,212,255,0.7)' },
        { label: 'Click %', data: data.by_step.map(function(r) { return r.click_rate; }), backgroundColor: 'rgba(255,138,0,0.7)' },
        { label: 'Reply %', data: data.by_step.map(function(r) { return r.reply_rate; }), backgroundColor: 'rgba(0,255,136,0.7)' }
      ]
    }, opts);
  }

  if (data.by_template && data.by_template.length) {
    D.renderChart('chart-template', 'bar', {
      labels: data.by_template.map(function(r) { return r.template; }),
      datasets: [
        { label: 'Open %', data: data.by_template.map(function(r) { return r.open_rate; }), backgroundColor: 'rgba(168,85,247,0.7)' },
        { label: 'Reply %', data: data.by_template.map(function(r) { return r.reply_rate; }), backgroundColor: 'rgba(0,255,136,0.7)' }
      ]
    }, opts);
  }

  if (data.daily_volume && data.daily_volume.length) {
    D.renderChart('chart-daily', 'line', {
      labels: data.daily_volume.map(function(r) { return r.date; }),
      datasets: [{
        label: 'Emails Sent',
        data: data.daily_volume.map(function(r) { return r.count; }),
        borderColor: 'rgba(0,212,255,0.9)', backgroundColor: 'rgba(0,212,255,0.1)',
        fill: true, tension: 0.4, pointRadius: 2
      }]
    }, opts);
  }

  // Campaign breakdown table
  var tbody = document.getElementById('analytics-table');
  if (data.by_org_type && data.by_org_type.length) {
    tbody.innerHTML = data.by_org_type.map(function(r) {
      return '<tr class="border-b border-carbon-700/50">' +
        '<td class="py-2 px-3 capitalize">' + D.esc(r.org_type) + '</td>' +
        '<td class="py-2 px-3 text-right font-mono">' + r.sent + '</td>' +
        '<td class="py-2 px-3 text-right font-mono">' + r.opened + '</td>' +
        '<td class="py-2 px-3 text-right font-mono">' + r.clicked + '</td>' +
        '<td class="py-2 px-3 text-right font-mono">' + r.replied + '</td>' +
        '<td class="py-2 px-3 text-right font-mono text-cyan-400">' + r.open_rate + '%</td>' +
        '<td class="py-2 px-3 text-right font-mono text-orange-400">' + r.click_rate + '%</td>' +
        '<td class="py-2 px-3 text-right font-mono text-green-400">' + r.reply_rate + '%</td></tr>';
    }).join('');
  } else {
    tbody.innerHTML = '<tr><td colspan="8" class="py-8 text-center text-gray-500 text-xs">No email campaign data yet.</td></tr>';
  }
};

// ═══ Email Queue ═══
D.Analytics._queueStepFilter = 'all';
D.Analytics._allQueueEmails = [];

D.Analytics.loadQueue = async function() {
  var data = await D.api('/outreach/email-queue');
  var emails = Array.isArray(data) ? data : (data && data.pending ? data.pending : []);

  D.Analytics._allQueueEmails = emails;
  // Preserve current step filter; if the filtered step no longer has emails, fall back to 'all'
  var filter = D.Analytics._queueStepFilter;
  if (filter !== 'all') {
    var hasStep = emails.some(function(e) { return e.sequence_step === filter; });
    if (!hasStep) D.Analytics._queueStepFilter = 'all';
  }
  D.Analytics._renderQueueTabs(emails);
  var filtered = emails;
  if (D.Analytics._queueStepFilter !== 'all') {
    filtered = emails.filter(function(e) { return e.sequence_step === D.Analytics._queueStepFilter; });
  }
  D.Analytics._renderQueueList(filtered);
};

D.Analytics._renderQueueTabs = function(emails) {
  var tabsEl = document.getElementById('queue-step-tabs');
  if (!tabsEl) return;

  // Count emails per step
  var stepCounts = {};
  emails.forEach(function(e) {
    var s = e.sequence_step || 1;
    stepCounts[s] = (stepCounts[s] || 0) + 1;
  });
  var steps = Object.keys(stepCounts).sort(function(a, b) { return a - b; });

  var active = D.Analytics._queueStepFilter;
  var btn = function(label, value, count) {
    var isActive = active === value;
    return '<button onclick="D.Analytics.filterQueueStep(' + (typeof value === 'string' ? "'" + value + "'" : value) + ')" ' +
      'class="px-3 py-1.5 rounded-lg text-xs font-medium transition ' +
      (isActive ? 'bg-drone-600 text-white' : 'bg-carbon-700 text-gray-400 hover:bg-carbon-600') + '">' +
      label + (count !== undefined ? ' <span class="ml-1 text-[10px] opacity-70">' + count + '</span>' : '') +
      '</button>';
  };

  var html = '';
  steps.forEach(function(s) {
    html += btn('Step ' + s, parseInt(s), stepCounts[s]);
  });
  html += btn('All', 'all', emails.length);
  tabsEl.innerHTML = html;
};

D.Analytics.filterQueueStep = function(step) {
  D.Analytics._queueStepFilter = step;
  var emails = D.Analytics._allQueueEmails;
  if (step !== 'all') {
    emails = emails.filter(function(e) { return e.sequence_step === step; });
  }
  D.Analytics._renderQueueTabs(D.Analytics._allQueueEmails);
  D.Analytics._renderQueueList(emails);
};

D.Analytics._renderQueueList = function(emails) {
  var el = document.getElementById('email-queue');
  var empty = document.getElementById('queue-empty');

  if (!emails.length) {
    el.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  el.innerHTML = emails.map(function(e) {
    return '<div class="glass rounded-lg p-4 fade-in glass-hover cursor-pointer" onclick="D.Analytics.previewEmail(event, \'' + e.id + '\', \'' + (e.prospect_id || '') + '\')">' +
      '<div class="flex items-start justify-between gap-4">' +
      '<div class="flex-1 min-w-0">' +
      '<div class="flex items-center gap-2 mb-1 flex-wrap">' +
      '<span class="text-white font-medium text-sm">' + D.esc(e.to_name || 'Unknown') + '</span>' +
      '<span class="text-[10px] text-gray-500 font-mono">' + D.esc(e.to_email || '') + '</span>' +
      '<span class="px-1.5 py-0.5 rounded text-[10px] bg-carbon-600 font-mono">Step ' + e.sequence_step + '</span>' +
      '<span class="text-[10px] text-gray-500">' + D.timeAgo(e.created_at) + '</span>' +
      '</div>' +
      '<p class="text-xs text-gray-400 mb-1">Subject: <span class="text-gray-200">' + D.esc(e.subject) + '</span></p>' +
      '<p class="text-[10px] text-gray-600 font-mono">Template: ' + D.esc(e.template_id || '') + '</p>' +
      '</div>' +
      '<div class="flex gap-2 flex-shrink-0">' +
      '<button onclick="event.stopPropagation();D.Analytics.approveAndSend(\'' + e.id + '\')" class="text-xs bg-drone-600/80 hover:bg-drone-600 text-white px-3 py-1.5 rounded-lg transition" title="Approve and send immediately">&#x1F680; Send</button>' +
      '<button onclick="event.stopPropagation();D.Analytics.approveEmail(\'' + e.id + '\')" class="text-xs bg-green-600/80 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg transition" title="Approve for scheduled send">&#10003;</button>' +
      '<button onclick="event.stopPropagation();D.Analytics.rejectEmail(\'' + e.id + '\')" class="text-xs bg-red-600/80 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg transition">&times;</button>' +
      '</div></div></div>';
  }).join('');

  // Store emails for preview
  D.Analytics._queueEmails = {};
  emails.forEach(function(e) { D.Analytics._queueEmails[e.id] = e; });
};

D.Analytics.approveEmail = async function(id) {
  await D.post('/outreach/email-queue/' + id + '/approve');
  D.toast('Email approved', 'success');
  D.Analytics.loadQueue();
};

D.Analytics.approveAndSend = async function(id) {
  D.toast('Approving & sending...', 'info');
  await D.post('/outreach/email-queue/' + id + '/approve');
  try {
    var r = await fetch(D.API + '/outreach/emails/' + id + '/send-now', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}'
    });
    var data = await r.json();
    if (r.ok && data.success) {
      D.toast('Email sent!', 'success');
    } else {
      D.toast('Send failed: ' + (data.detail || data.error || 'Unknown error'), 'error');
    }
  } catch (e) {
    D.toast('Send failed: ' + e.message, 'error');
  }
  D.Analytics.loadQueue();
};

D.Analytics.rejectEmail = async function(id) {
  await D.post('/outreach/email-queue/' + id + '/reject');
  D.toast('Email rejected', 'info');
  D.Analytics.loadQueue();
};

// ── Email Preview (click to view draft) ──
D.Analytics.previewEmail = function(event, emailId, prospectId) {
  var e = (D.Analytics._queueEmails || {})[emailId];
  if (!e) return;

  var modal = document.getElementById('email-preview-modal');
  if (!modal) {
    // Create the preview modal once
    modal = document.createElement('div');
    modal.id = 'email-preview-modal';
    modal.className = 'fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[70] hidden';
    modal.innerHTML =
      '<div class="bg-carbon-800 rounded-2xl border border-carbon-700 shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col mx-4">' +
      '<div class="flex items-center justify-between p-4 border-b border-carbon-700">' +
      '<div class="flex-1 min-w-0"><h3 id="ep-subject" class="text-white font-semibold text-sm truncate"></h3>' +
      '<p id="ep-meta" class="text-[11px] text-gray-500 mt-0.5"></p></div>' +
      '<div class="flex gap-2 ml-4">' +
      '<button id="ep-edit-btn" class="text-xs bg-drone-600/20 text-drone-400 border border-drone-600/30 px-3 py-1.5 rounded-lg hover:bg-drone-600/30 transition">&#x270F; Edit</button>' +
      '<button id="ep-send-btn" class="text-xs bg-drone-600/80 hover:bg-drone-600 text-white px-3 py-1.5 rounded-lg transition">&#x1F680; Send Now</button>' +
      '<button id="ep-approve-btn" class="text-xs bg-green-600/80 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg transition">&#10003; Approve</button>' +
      '<button id="ep-reject-btn" class="text-xs bg-red-600/80 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg transition">&times; Reject</button>' +
      '<button onclick="document.getElementById(\'email-preview-modal\').classList.add(\'hidden\')" class="text-gray-500 hover:text-white text-xl px-2">&times;</button>' +
      '</div></div>' +
      '<div class="flex-1 overflow-auto p-1">' +
      '<iframe id="ep-iframe" class="w-full border-0 rounded-lg bg-white" style="height:100%;min-height:400px;"></iframe>' +
      '</div></div>';
    document.body.appendChild(modal);
    modal.addEventListener('click', function(ev) { if (ev.target === modal) modal.classList.add('hidden'); });
  }

  document.getElementById('ep-subject').textContent = e.subject;
  document.getElementById('ep-meta').textContent = (e.to_name || 'Unknown') + ' · ' + (e.to_email || '') + ' · Step ' + e.sequence_step + ' · ' + (e.template_id || '');

  var iframe = document.getElementById('ep-iframe');
  var doc = iframe.contentDocument || iframe.contentWindow.document;
  doc.open(); doc.write(e.body_html || '<p style="color:#999;padding:20px;">No content</p>'); doc.close();

  // Wire up buttons
  document.getElementById('ep-edit-btn').onclick = function() {
    modal.classList.add('hidden');
    if (prospectId && D.Prospects) {
      D.Prospects.open(prospectId).then(function() { setTimeout(function() { D.Prospects.editEmail(emailId); }, 300); });
    }
  };
  document.getElementById('ep-approve-btn').onclick = function() { modal.classList.add('hidden'); D.Analytics.approveEmail(emailId); };
  document.getElementById('ep-send-btn').onclick = function() { modal.classList.add('hidden'); D.Analytics.approveAndSend(emailId); };
  document.getElementById('ep-reject-btn').onclick = function() { modal.classList.add('hidden'); D.Analytics.rejectEmail(emailId); };

  modal.classList.remove('hidden');
};

D.Analytics.batchApprove = async function() {
  var all = D.Analytics._allQueueEmails || [];
  var filter = D.Analytics._queueStepFilter;
  var emails = (filter !== 'all')
    ? all.filter(function(e) { return e.sequence_step === filter; })
    : all;
  if (!emails.length) { D.toast('No emails to approve in this view', 'info'); return; }
  var label = filter !== 'all' ? emails.length + ' Step ' + filter + ' emails' : emails.length + ' emails';
  if (!confirm('Approve ' + label + '?')) return;
  await D.post('/outreach/email-queue/approve-batch', { email_ids: emails.map(function(e) { return e.id; }) });
  D.toast(label + ' approved', 'success');
  D.Analytics.loadQueue();
};

// ═══ Leaflet Map ═══
D.Analytics.initMap = function() {
  if (D.Analytics._mapInit) {
    // Map already created — just fix tiles after tab switch
    setTimeout(function() { D.Analytics._map.invalidateSize(); }, 100);
    return;
  }
  D.Analytics._mapInit = true;
  D.Analytics._map = L.map('map', { zoomControl: true }).setView([39.5, -98.0], 4);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; CARTO', maxZoom: 18
  }).addTo(D.Analytics._map);
  D.Analytics._markerLayer = L.layerGroup().addTo(D.Analytics._map);
  D.Analytics.loadMapData();
};

D.Analytics.loadMapData = async function() {
  var data = await D.api('/dashboard/map-data');
  if (!data || !data.markers) return;
  D.Analytics._markerLayer.clearLayers();

  // Invalidate size in case we just switched to map tab
  setTimeout(function() { D.Analytics._map.invalidateSize(); }, 200);

  var tierColors = { hot: '#f97316', warm: '#eab308', cool: '#3b82f6', cold: '#6366f1', unscored: '#6b7280' };

  data.markers.forEach(function(m) {
    var color = tierColors[m.tier] || '#6b7280';
    var radius = m.score ? Math.max(5, Math.min(12, m.score / 10)) : 5;
    var circle = L.circleMarker([m.lat, m.lng], {
      radius: radius, fillColor: color, color: color,
      weight: 1, opacity: 0.8, fillOpacity: 0.6
    });
    circle.bindPopup(
      '<div class="text-sm"><strong class="text-white">' + D.esc(m.name) + '</strong><br/>' +
      '<span class="text-gray-400">' + D.esc(m.org || '') + (m.dept ? ' &mdash; ' + D.esc(m.dept) : '') + '</span><br/>' +
      '<span class="text-gray-400">' + D.esc(m.city || '') + (m.state ? ', ' + m.state : '') + '</span><br/>' +
      '<span style="color:' + color + '" class="font-medium">' + (m.tier || '').toUpperCase() + '</span>' +
      (m.score ? ' &middot; Score: ' + m.score : '') +
      '<br/><a href="#" onclick="D.Analytics._map.closePopup();D.Prospects.open(\'' + m.id + '\');return false;" class="text-blue-400 hover:underline">View Detail &rarr;</a></div>'
    );
    D.Analytics._markerLayer.addLayer(circle);
  });
  document.getElementById('map-count').textContent = data.total + ' prospects with coordinates';
};

// ═══ A/B Tests ═══
D.Analytics.loadABTests = async function() {
  var results = await Promise.all([
    D.api('/outreach/ab-tests/experiments'),
    D.api('/outreach/ab-tests')
  ]);
  var experiments = results[0], abResults = results[1];

  // Experiments list
  var expEl = document.getElementById('ab-experiments');
  if (experiments && Object.keys(experiments).length) {
    expEl.innerHTML = Object.entries(experiments).map(function(entry) {
      var name = entry[0], exp = entry[1];
      return '<div class="glass rounded-lg p-4">' +
        '<div class="flex items-center justify-between mb-3">' +
        '<h4 class="text-white font-medium text-xs">' + D.esc(name) + '</h4>' +
        '<span class="text-[10px] px-2 py-0.5 rounded-full bg-green-600/20 text-green-400 border border-green-600/30">Active</span></div>' +
        '<div class="space-y-1.5 text-[11px]">' +
        '<div class="flex justify-between"><span class="text-gray-500">Step</span><span class="text-gray-300 font-mono">' + exp.step + '</span></div>' +
        '<div class="flex justify-between"><span class="text-gray-500">Field</span><span class="text-gray-300 font-mono">' + exp.field + '</span></div>' +
        '<div class="mt-2"><span class="text-gray-500 text-[10px]">Variants:</span>' +
        '<div class="flex flex-wrap gap-1 mt-1">' + exp.variants.map(function(v, i) {
          return '<span class="px-2 py-0.5 rounded text-[10px] font-mono ' +
            (i === 0 ? 'bg-blue-600/20 text-blue-300 border border-blue-600/30' : 'bg-purple-600/20 text-purple-300 border border-purple-600/30') + '">' + D.esc(v) + '</span>';
        }).join('') + '</div></div></div></div>';
    }).join('');
  } else {
    expEl.innerHTML = '<p class="text-gray-500 text-xs col-span-full">No active experiments.</p>';
  }

  // Results
  var resEl = document.getElementById('ab-results');
  if (abResults && Object.keys(abResults).length) {
    resEl.innerHTML = Object.entries(abResults).map(function(entry) {
      var expName = entry[0], variants = entry[1];
      var rows = Object.entries(variants).map(function(vEntry) {
        var variant = vEntry[0], stats = vEntry[1];
        return '<tr class="border-b border-carbon-700/50">' +
          '<td class="py-2 px-3 font-mono text-white text-xs">' + D.esc(variant) + '</td>' +
          '<td class="py-2 px-3 text-right font-mono text-xs">' + (stats.sent || 0) + '</td>' +
          '<td class="py-2 px-3 text-right font-mono text-xs">' + (stats.opened || 0) + '</td>' +
          '<td class="py-2 px-3 text-right font-mono text-xs">' + (stats.replied || 0) + '</td>' +
          '<td class="py-2 px-3 text-right font-mono text-xs text-cyan-400">' + (stats.open_rate || 0) + '%</td>' +
          '<td class="py-2 px-3 text-right font-mono text-xs text-green-400">' + (stats.reply_rate || 0) + '%</td></tr>';
      }).join('');
      return '<div class="glass rounded-lg p-4">' +
        '<h4 class="text-white font-medium text-xs mb-3">' + D.esc(expName) + '</h4>' +
        '<table class="w-full text-xs"><thead class="text-gray-500 border-b border-carbon-600 uppercase tracking-wider">' +
        '<tr><th class="text-left py-1 px-3">Variant</th><th class="text-right py-1 px-3">Sent</th>' +
        '<th class="text-right py-1 px-3">Opened</th><th class="text-right py-1 px-3">Replied</th>' +
        '<th class="text-right py-1 px-3">Open %</th><th class="text-right py-1 px-3">Reply %</th></tr></thead>' +
        '<tbody>' + rows + '</tbody></table></div>';
    }).join('');
  } else {
    resEl.innerHTML = '<p class="text-gray-500 text-xs">No A/B test results yet.</p>';
  }
};

// ═══ Scoring Weight Optimizer ═══
D.Analytics.loadOptimizer = async function() {
  var data = await D.api('/outreach/optimizer/engagement');
  var el = document.getElementById('optimizer-results');

  if (!data || data.error) {
    el.innerHTML = '<div class="text-center py-6">' +
      '<div class="text-3xl mb-2">&#x1F4CA;</div>' +
      '<p class="text-gray-500 text-xs">' + D.esc(data && data.error ? data.error : 'Not enough data yet.') + '</p>' +
      '<p class="text-[10px] text-gray-600 mt-1">Need 20+ contacted prospects with 3+ replies.</p></div>';
    return;
  }

  var html = '';
  if (data.suggestions && data.suggestions.length) {
    html += '<div class="space-y-2"><h4 class="text-xs text-gray-400 font-medium uppercase tracking-wider mb-2">Weight Suggestions</h4>';
    data.suggestions.forEach(function(s) {
      var isUp = s.indexOf('Increase') >= 0;
      var isDown = s.indexOf('Decrease') >= 0;
      html += '<div class="flex items-center gap-2 text-xs ' + (isUp ? 'text-green-400' : isDown ? 'text-red-400' : 'text-gray-400') + '">' +
        '<span>' + (isUp ? '&uarr;' : isDown ? '&darr;' : '&rarr;') + '</span><span>' + D.esc(s) + '</span></div>';
    });
    html += '</div>';
  }
  if (data.analysis) {
    html += '<div class="mt-4"><h4 class="text-xs text-gray-400 font-medium uppercase tracking-wider mb-2">Feature-Reply Correlation</h4>' +
      '<div class="grid grid-cols-1 md:grid-cols-2 gap-2">';
    Object.entries(data.analysis).forEach(function(entry) {
      var feature = entry[0], stats = entry[1];
      var lift = stats.lift || 0;
      var color = lift > 20 ? 'text-green-400' : lift < -20 ? 'text-red-400' : 'text-gray-400';
      html += '<div class="flex items-center justify-between text-[11px] px-3 py-1.5 glass rounded">' +
        '<span class="text-gray-300 font-mono">' + feature + '</span>' +
        '<span class="' + color + ' font-mono font-bold">' + (lift > 0 ? '+' : '') + lift.toFixed(0) + '% lift</span></div>';
    });
    html += '</div></div>';
  }
  el.innerHTML = html || '<p class="text-gray-500 text-xs">No optimization data available.</p>';
};
