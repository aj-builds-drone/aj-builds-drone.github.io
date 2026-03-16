/* ═══════════════════════════════════════════════════════════════════
   agents.js — Mission Control: Radar, Terminal, Agent Grid + Controls
   ═══════════════════════════════════════════════════════════════════ */
D.Agents = {};
D.Agents._lastAgents = [];
D.Agents._terminalLog = [];
D.Agents._globalRunning = false;

var AGENT_META = {
  scholar_crawler:  { icon: '&#x1F393;', group: 'crawler', color: '#00D4FF' },
  nsf_crawler:      { icon: '&#x1F3DB;', group: 'crawler', color: '#0b6df5' },
  faculty_crawler:  { icon: '&#x1F3EB;', group: 'crawler', color: '#A855F7' },
  arxiv_crawler:    { icon: '&#x1F4C4;', group: 'crawler', color: '#FF8A00' },
  github_crawler:   { icon: '&#x1F419;', group: 'crawler', color: '#8b949e' },
  sam_gov_crawler:  { icon: '&#x1F3DB;', group: 'crawler', color: '#FF6B6B' },
  batch_scorer:     { icon: '&#x26A1;',  group: 'scorer',  color: '#FFD600' },
  deduplicator:     { icon: '&#x1F517;', group: 'scorer',  color: '#00D4FF' },
  enrichment:       { icon: '&#x1F52C;', group: 'scorer',  color: '#00FF88' },
  lab_auditor:      { icon: '&#x1F50E;', group: 'audit',   color: '#A855F7' },
  email_hunter:     { icon: '&#x1F4E7;', group: 'hunter',  color: '#EC4899' },
  copywriter:       { icon: '&#x270D;',  group: 'email',   color: '#00FF88' },
  prospect_enqueue: { icon: '&#x1F4CB;', group: 'email',   color: '#FFD600' },
  cadence_sender:   { icon: '&#x1F4E4;', group: 'email',   color: '#00D4FF' },
  research_analyzer: { icon: '&#x1F9E0;', group: 'scorer',  color: '#FF6B6B' },
  geocoder:          { icon: '&#x1F4CD;', group: 'scorer',  color: '#10B981' }
};

D.Agents.load = async function() {
  var data = await D.api('/outreach/agents/status');
  if (!data || !data.agents) return;

  // API returns agents as object {name: {...}} — convert to array
  var agents = Object.values(data.agents);
  D.Agents._lastAgents = agents;
  D.Agents._globalRunning = data.running;

  var active = agents.filter(function(a) { return a.status === 'running'; });
  var totalRuns = agents.reduce(function(sum, a) { return sum + (a.runs || 0); }, 0);
  var totalErrors = agents.reduce(function(sum, a) { return sum + (a.errors || 0); }, 0);
  var stopped = agents.filter(function(a) { return a.status === 'stopped'; }).length;

  // Mission Control summary
  document.getElementById('mc-active-count').textContent = agents.length - stopped;
  var subtitle = document.getElementById('agent-grid-subtitle');
  if (subtitle) subtitle.textContent = agents.length + ' autonomous agents on staggered intervals';
  document.getElementById('mc-total-runs').textContent = totalRuns;
  document.getElementById('mc-total-errors').textContent = totalErrors;
  document.getElementById('mc-uptime').textContent = data.uptime || '—';

  // Global controls state
  D.Agents.updateGlobalButtons(data.running);

  // Radar blips
  D.Agents.renderRadar(agents);

  // Terminal log
  D.Agents.renderTerminal(agents);

  // Agent grid
  D.Agents.renderGrid(agents);
};

// ── Global start / stop ──
D.Agents.startAll = async function() {
  D.toast('Starting all agents...', 'info');
  await D.post('/outreach/agents/start');
  setTimeout(function() { D.Agents.load(); }, 1000);
};

D.Agents.stopAll = async function() {
  D.toast('Stopping all agents...', 'info');
  await D.post('/outreach/agents/stop');
  setTimeout(function() { D.Agents.load(); }, 1000);
};

D.Agents.updateGlobalButtons = function(running) {
  var startBtn = document.getElementById('mc-start-all');
  var stopBtn = document.getElementById('mc-stop-all');
  if (startBtn && stopBtn) {
    if (running) {
      startBtn.classList.add('hidden');
      stopBtn.classList.remove('hidden');
    } else {
      startBtn.classList.remove('hidden');
      stopBtn.classList.add('hidden');
    }
  }
};

// ── Per-agent controls ──
D.Agents.pauseAgent = async function(name) {
  D.toast('Pausing ' + name + '...', 'info');
  await D.post('/outreach/agents/' + name + '/pause');
  setTimeout(function() { D.Agents.load(); }, 500);
};

D.Agents.resumeAgent = async function(name) {
  D.toast('Resuming ' + name + '...', 'info');
  await D.post('/outreach/agents/' + name + '/resume');
  setTimeout(function() { D.Agents.load(); }, 500);
};

D.Agents.stopAgent = async function(name) {
  D.toast('Stopping ' + name + '...', 'info');
  await D.post('/outreach/agents/' + name + '/stop');
  setTimeout(function() { D.Agents.load(); }, 500);
};

D.Agents.startAgent = async function(name) {
  D.toast('Starting ' + name + '...', 'info');
  await D.post('/outreach/agents/' + name + '/start');
  setTimeout(function() { D.Agents.load(); }, 500);
};

// ── Radar with blips for each agent ──
D.Agents.renderRadar = function(agents) {
  var radar = document.getElementById('mc-radar');
  // Remove old blips
  radar.querySelectorAll('.mc-blip').forEach(function(b) { b.remove(); });

  var groupRings = { crawler: 0.35, scorer: 0.55, audit: 0.65, hunter: 0.7, email: 0.85 };
  var groupCounts = {};

  agents.forEach(function(a, i) {
    var meta = AGENT_META[a.name] || { group: 'other', color: '#6b7280' };
    var ring = groupRings[meta.group] || 0.7;
    if (!groupCounts[meta.group]) groupCounts[meta.group] = 0;
    groupCounts[meta.group]++;

    var angle = (i / agents.length) * 2 * Math.PI - Math.PI / 2;
    var cx = 50 + ring * 42 * Math.cos(angle);
    var cy = 50 + ring * 42 * Math.sin(angle);

    var blip = document.createElement('div');
    var isActive = a.status === 'running';
    var isPaused = a.status === 'paused';
    var isError = a.status === 'error';
    blip.className = 'mc-blip' + (isActive ? '' : isPaused ? ' paused' : isError ? ' error' : ' idle');
    blip.style.left = cx + '%';
    blip.style.top = cy + '%';
    blip.style.transform = 'translate(-50%, -50%)';
    if (isActive) blip.style.background = meta.color;
    else if (isPaused) blip.style.background = '#FFD600';
    else if (isError) blip.style.background = '#FF6B6B';
    blip.title = a.name + ' (' + a.status + ')';
    radar.appendChild(blip);
  });
};

// ── Terminal output ──
D.Agents.renderTerminal = function(agents) {
  var el = document.getElementById('mc-terminal-body');
  var lines = [];

  agents.forEach(function(a) {
    var meta = AGENT_META[a.name] || { group: 'other' };
    var tagClass = 'mc-tag-' + (meta.group === 'crawler' ? 'crawler' : meta.group === 'scorer' ? 'scorer' : meta.group === 'email' ? 'email' : meta.group === 'audit' ? 'audit' : 'hunter');
    var tag = a.name.replace(/_/g, ' ').toUpperCase();
    var interval = a.interval_seconds >= 3600 ? (a.interval_seconds / 3600) + 'h' : (a.interval_seconds / 60) + 'm';

    if (a.last_run) {
      var lastResult = '';
      if (a.last_result) {
        if (typeof a.last_result === 'string') lastResult = a.last_result;
        else lastResult = JSON.stringify(a.last_result).slice(0, 80);
      }
      var statusIcon = a.status === 'running' ? '&#x25B6;' : a.status === 'paused' ? '&#x23F8;' : a.status === 'error' ? '&#x26A0;' : '&#x2714;';
      var statusLabel = a.status === 'running' ? 'Running' : a.status === 'paused' ? 'Paused' : a.status === 'error' ? 'Error' : 'Completed';
      lines.push({
        time: a.last_run,
        html: '<span class="mc-ts">[' + D.Agents._formatTime(a.last_run) + ']</span> ' +
          '<span class="mc-tag ' + tagClass + '">[' + tag + ']</span> ' +
          '<span class="mc-msg">' + statusIcon + ' ' + statusLabel + ' (every ' + interval + ', ' + (a.runs || 0) + ' runs' +
          (a.consecutive_errors ? ', ' + a.consecutive_errors + ' err streak' : '') +
          (a.recoveries ? ', ' + a.recoveries + ' recoveries' : '') +
          ')' + (lastResult ? ' &rarr; ' + D.esc(lastResult) : '') + '</span>'
      });
    } else {
      lines.push({
        time: new Date().toISOString(),
        html: '<span class="mc-ts">[--:--:--]</span> ' +
          '<span class="mc-tag ' + tagClass + '">[' + tag + ']</span> ' +
          '<span class="mc-msg">Scheduled (every ' + interval + ') — ' + a.status + '</span>'
      });
    }
  });

  lines.sort(function(a, b) { return new Date(b.time) - new Date(a.time); });

  if (lines.length) {
    el.innerHTML = lines.slice(0, 20).map(function(l) {
      return '<div class="mc-log-line">' + l.html + '</div>';
    }).join('') + '<div class="mc-log-line"><span class="mc-cursor"></span></div>';
  }
};

D.Agents._formatTime = function(iso) {
  if (!iso) return '--:--:--';
  var d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

// ── Agent Grid ──
D.Agents.renderGrid = function(agents) {
  var el = document.getElementById('agents-grid');
  if (!agents.length) {
    el.innerHTML = '<p class="text-gray-500 text-xs col-span-full">No agents registered.</p>';
    return;
  }

  el.innerHTML = agents.map(function(a) {
    var meta = AGENT_META[a.name] || { icon: '&#x1F916;', group: 'other', color: '#6b7280' };
    var isRunning = a.status === 'running';
    var isPaused = a.status === 'paused';
    var isError = a.status === 'error';
    var isStopped = a.status === 'stopped';
    var interval = a.interval_seconds >= 3600 ? (a.interval_seconds / 3600) + 'h' : (a.interval_seconds / 60) + 'm';
    var lastRan = a.last_run ? D.timeAgo(a.last_run) : 'never';
    var lastResult = '';
    if (a.last_result) {
      lastResult = typeof a.last_result === 'string' ? a.last_result : JSON.stringify(a.last_result).slice(0, 60);
    }
    var stateClass = isRunning ? 'agent-running' : isPaused ? 'agent-paused' : isError ? 'agent-error' : isStopped ? 'agent-stopped' : 'agent-idle';

    // Status badge
    var statusBadge = isRunning ? '<span class="agent-badge badge-running">RUNNING</span>'
      : isPaused ? '<span class="agent-badge badge-paused">PAUSED</span>'
      : isError ? '<span class="agent-badge badge-error">ERROR</span>'
      : isStopped ? '<span class="agent-badge badge-stopped">STOPPED</span>'
      : '<span class="agent-badge badge-idle">IDLE</span>';

    // Control buttons
    var controls = '<div class="agent-controls">';
    if (isPaused || isStopped) {
      controls += '<button onclick="D.Agents.' + (isStopped ? 'startAgent' : 'resumeAgent') + '(\'' + D.esc(a.name) + '\')" class="ctrl-btn ctrl-start" title="' + (isStopped ? 'Start' : 'Resume') + '">&#x25B6;</button>';
    } else if (isRunning || a.status === 'idle') {
      controls += '<button onclick="D.Agents.pauseAgent(\'' + D.esc(a.name) + '\')" class="ctrl-btn ctrl-pause" title="Pause">&#x23F8;</button>';
    }
    if (!isStopped) {
      controls += '<button onclick="D.Agents.stopAgent(\'' + D.esc(a.name) + '\')" class="ctrl-btn ctrl-stop" title="Stop">&#x23F9;</button>';
    }
    if (!isRunning && !isPaused && !isStopped) {
      controls += '<button onclick="D.Agents.trigger(\'' + D.esc(a.name) + '\')" class="ctrl-btn ctrl-run" title="Run Now">&#x26A1;</button>';
    }
    if (isError) {
      controls += '<button onclick="D.Agents.startAgent(\'' + D.esc(a.name) + '\')" class="ctrl-btn ctrl-start" title="Restart">&#x21BB;</button>';
    }
    controls += '</div>';

    return '<div class="agent-card glass glass-hover rounded-lg p-4 ' + stateClass + '" style="color:' + meta.color + '">' +
      '<div class="flex items-center justify-between mb-2">' +
      '<div class="flex items-center gap-2"><span class="text-lg">' + meta.icon + '</span><span class="text-xs font-medium text-white">' + D.esc(a.name) + '</span></div>' +
      statusBadge + '</div>' +
      '<div class="space-y-1 text-[10px]">' +
      '<div class="flex justify-between"><span class="text-gray-500">Interval</span><span class="text-gray-300 font-mono">' + interval + '</span></div>' +
      '<div class="flex justify-between"><span class="text-gray-500">Last ran</span><span class="text-gray-300 font-mono">' + lastRan + '</span></div>' +
      '<div class="flex justify-between"><span class="text-gray-500">Runs</span><span class="text-gray-300 font-mono">' + (a.runs || 0) + '</span></div>' +
      '<div class="flex justify-between"><span class="text-gray-500">Errors</span><span class="' + (a.errors > 0 ? 'text-red-400' : 'text-gray-600') + ' font-mono">' + (a.errors || 0) + '</span></div>' +
      (a.consecutive_errors > 0 ? '<div class="flex justify-between"><span class="text-gray-500">Err streak</span><span class="text-red-400 font-mono">' + a.consecutive_errors + '</span></div>' : '') +
      (a.recoveries > 0 ? '<div class="flex justify-between"><span class="text-gray-500">Recoveries</span><span class="text-green-400 font-mono">' + a.recoveries + '</span></div>' : '') +
      (lastResult ? '<div class="truncate text-gray-600 font-mono mt-1" title="' + D.esc(lastResult) + '">' + D.esc(lastResult) + '</div>' : '') +
      '</div>' +
      controls +
      '</div>';
  }).join('');
};

D.Agents.trigger = async function(name) {
  D.toast('Triggering ' + name + '...', 'info');
  await D.post('/outreach/agents/' + name + '/run');
  setTimeout(function() { D.Agents.load(); }, 1500);
};
