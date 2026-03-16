/* ═══════════════════════════════════════════════════════════════════
   prospects.js — Prospect table, filters, detail modal, email editor
   ═══════════════════════════════════════════════════════════════════ */
D.Prospects = {};
D.Prospects._page = 0;
D.Prospects._pageSize = 50;
D.Prospects._sort = 'priority_score';
D.Prospects._order = 'desc';
D.Prospects._timer = null;
D.Prospects._currentProspect = null;

// ── Pipeline stages for progress bar ──
var STAGES = ['discovered', 'enriched', 'audited', 'scored', 'queued', 'contacted', 'opened', 'replied', 'meeting', 'converted'];

D.Prospects.load = async function() {
  var tier = D._val('filter-tier');
  var status = D._val('filter-status');
  var source = D._val('filter-source');
  var orgType = D._val('filter-org-type');
  var hasEmail = D._val('filter-has-email');
  var hasHIndex = D._val('filter-has-hindex');
  var hasLab = D._val('filter-has-lab');
  var hasDroneLab = D._val('filter-has-drone-lab');
  var hasGrants = D._val('filter-has-grants');
  var search = D._val('filter-search');

  var url = '/outreach/prospects?offset=' + (D.Prospects._page * D.Prospects._pageSize) +
    '&limit=' + D.Prospects._pageSize +
    '&sort=' + D.Prospects._sort +
    '&order=' + D.Prospects._order;
  if (tier) url += '&tier=' + tier;
  if (status) url += '&status=' + status;
  if (source) url += '&source=' + source;
  if (orgType) url += '&org_type=' + orgType;
  if (hasEmail) url += '&has_email=' + hasEmail;
  if (hasHIndex) url += '&has_h_index=' + hasHIndex;
  if (hasLab) url += '&has_lab=' + hasLab;
  if (hasDroneLab) url += '&has_drone_lab=' + hasDroneLab;
  if (hasGrants) url += '&has_grants=' + hasGrants;
  if (search) url += '&search=' + encodeURIComponent(search);

  var data = await D.api(url);
  if (!data) return;

  var prospects = data.prospects || data;
  var total = data.total || prospects.length;
  document.getElementById('prospects-count').textContent = total + ' total';
  document.getElementById('page-num').textContent = 'Page ' + (D.Prospects._page + 1);

  var el = document.getElementById('prospects-table');
  if (!prospects.length) {
    el.innerHTML = '<tr><td colspan="10" class="py-8 text-center text-gray-500 text-xs">No prospects found.</td></tr>';
    return;
  }

  el.innerHTML = prospects.map(function(p) {
    var emailCell = p.email
      ? '<span class="text-green-400 text-[10px] font-mono truncate max-w-[130px] inline-block" title="' + D.esc(p.email) + '">' + D.esc(p.email) + '</span>'
      : '<span class="text-gray-600 text-[10px]">&mdash;</span>';
    return '<tr class="border-b border-carbon-700/50 hover:bg-carbon-800/50 transition cursor-pointer" onclick="D.Prospects.open(\'' + p.id + '\')">' +
      '<td class="py-2 px-3"><span class="text-white font-medium">' + D.esc(p.name) + '</span><br/><span class="text-[10px] text-gray-600">' + D.esc(p.title || '') + '</span></td>' +
      '<td class="py-2 px-3">' + emailCell + '</td>' +
      '<td class="py-2 px-3">' + D.esc(p.organization || '') + '</td>' +
      '<td class="py-2 px-3 text-gray-400">' + D.esc(p.department || '') + '</td>' +
      '<td class="py-2 px-3 text-gray-400">' + D.esc(p.lab_name || '') + '</td>' +
      '<td class="py-2 px-3 text-center font-mono text-gray-300">' + (p.h_index != null ? p.h_index : '&mdash;') + '</td>' +
      '<td class="py-2 px-3 text-center font-mono text-white font-bold">' + (p.priority_score != null ? p.priority_score : '&mdash;') + '</td>' +
      '<td class="py-2 px-3 text-center"><span class="' + D.tierClass(p.tier) + ' text-[10px] font-bold uppercase tracking-wider">' + (p.tier || '&mdash;') + '</span></td>' +
      '<td class="py-2 px-3"><span class="px-2 py-0.5 rounded-full text-[10px] ' + D.statusClass(p.status) + '">' + (p.status || '&mdash;') + '</span></td>' +
      '<td class="py-2 px-3 text-[10px] text-gray-500 font-mono">' + (p.source || '&mdash;') + '</td></tr>';
  }).join('');
};

// ── Helper to get element value ──
D._val = function(id) { var el = document.getElementById(id); return el ? el.value : ''; };

// ── Sort ──
D.Prospects.sortBy = function(col) {
  if (D.Prospects._sort === col) D.Prospects._order = D.Prospects._order === 'desc' ? 'asc' : 'desc';
  else { D.Prospects._sort = col; D.Prospects._order = 'desc'; }
  D.Prospects._page = 0;
  D.Prospects.load();
};

// ── Pagination ──
D.Prospects.nextPage = function() { D.Prospects._page++; D.Prospects.load(); };
D.Prospects.prevPage = function() { if (D.Prospects._page > 0) { D.Prospects._page--; D.Prospects.load(); } };

// ── Filters ──
D.Prospects.apply = function() { D.Prospects._page = 0; D.Prospects.load(); D.Prospects.renderTags(); };
D.Prospects.debounceSearch = function() {
  clearTimeout(D.Prospects._timer);
  D.Prospects._timer = setTimeout(function() { D.Prospects._page = 0; D.Prospects.load(); }, 300);
};

D.Prospects.toggleFilters = function() {
  var panel = document.getElementById('filter-panel');
  panel.classList.toggle('hidden');
};

D.Prospects.clearAll = function() {
  ['filter-tier', 'filter-status', 'filter-source', 'filter-org-type', 'filter-has-email', 'filter-has-hindex', 'filter-has-lab', 'filter-has-drone-lab', 'filter-has-grants'].forEach(function(id) {
    var el = document.getElementById(id); if (el) el.value = '';
  });
  var s = document.getElementById('filter-search'); if (s) s.value = '';
  D.Prospects._page = 0; D.Prospects.load(); D.Prospects.renderTags();
};

D.Prospects.renderTags = function() {
  var el = document.getElementById('active-filter-tags');
  if (!el) return;
  var filters = [
    { id: 'filter-tier', label: 'Tier' }, { id: 'filter-status', label: 'Status' },
    { id: 'filter-source', label: 'Source' }, { id: 'filter-org-type', label: 'Org' },
    { id: 'filter-has-email', label: 'Email' }, { id: 'filter-has-hindex', label: 'H-Index' },
    { id: 'filter-has-lab', label: 'Lab' }, { id: 'filter-has-drone-lab', label: 'Drone Lab' },
    { id: 'filter-has-grants', label: 'Grants' }
  ];
  var tags = [];
  filters.forEach(function(f) {
    var v = document.getElementById(f.id);
    if (!v || !v.value) return;
    var display = v.options ? v.options[v.selectedIndex].text : v.value;
    tags.push('<span class="inline-flex items-center gap-1 text-[10px] bg-drone-600/20 text-drone-400 border border-drone-600/30 px-2 py-0.5 rounded-full">' +
      D.esc(f.label) + ': ' + D.esc(display) +
      '<button onclick="document.getElementById(\'' + f.id + '\').value=\'\';D.Prospects.apply()" class="hover:text-white">&times;</button></span>');
  });
  el.innerHTML = tags.join('');
};

// ── Export ──
D.Prospects.exportCSV = function() { window.open(D.API + '/outreach/prospects/export', '_blank'); };

// ═══════════════════════════════════════════════════════════════════
// Prospect Detail Modal — Full view with email drafts
// ═══════════════════════════════════════════════════════════════════

D.Prospects.open = async function(id) {
  var data = await D.api('/dashboard/prospect/' + id);
  if (!data) return;
  var p = data.profile;
  D.Prospects._currentProspect = p;

  document.getElementById('modal-name').textContent = p.name || 'Unknown';
  document.getElementById('modal-org').innerHTML = [p.title, p.department, p.organization].filter(Boolean).join(' &middot; ');

  // Pipeline progress bar
  D.Prospects.renderPipelineProgress(p.status);

  var html = '';

  // ── Action Bar ──
  html += '<div class="flex flex-wrap gap-2 mb-4">';
  if (p.email) {
    html += '<button onclick="D.Prospects.generateDraft(\'' + p.id + '\')" class="text-[10px] bg-drone-600/20 text-drone-400 border border-drone-600/30 px-3 py-1.5 rounded-lg hover:bg-drone-600/30 transition font-mono">&#x270D; Generate Email Draft</button>';
  } else {
    html += '<button onclick="D.Prospects.huntEmail(\'' + p.id + '\')" class="text-[10px] bg-pink-600/20 text-pink-400 border border-pink-600/30 px-3 py-1.5 rounded-lg hover:bg-pink-600/30 transition font-mono">&#x1F4E7; Hunt Email</button>';
  }
  if (p.scholar_url) html += '<a href="' + D.esc(p.scholar_url) + '" target="_blank" rel="noopener" class="text-[10px] bg-carbon-700 text-gray-300 border border-carbon-600 px-3 py-1.5 rounded-lg hover:bg-carbon-600 transition font-mono">&#x1F393; Scholar</a>';
  if (p.linkedin_url) html += '<a href="' + D.esc(p.linkedin_url) + '" target="_blank" rel="noopener" class="text-[10px] bg-carbon-700 text-gray-300 border border-carbon-600 px-3 py-1.5 rounded-lg hover:bg-carbon-600 transition font-mono">&#x1F517; LinkedIn</a>';
  if (p.personal_site) html += '<a href="' + D.esc(p.personal_site) + '" target="_blank" rel="noopener" class="text-[10px] bg-carbon-700 text-gray-300 border border-carbon-600 px-3 py-1.5 rounded-lg hover:bg-carbon-600 transition font-mono">&#x1F310; Website</a>';
  if (p.lab_url) html += '<a href="' + D.esc(p.lab_url) + '" target="_blank" rel="noopener" class="text-[10px] bg-carbon-700 text-gray-300 border border-carbon-600 px-3 py-1.5 rounded-lg hover:bg-carbon-600 transition font-mono">&#x1F52C; Lab Page</a>';
  html += '</div>';

  // ── Info Cards Grid ──
  html += '<div class="grid grid-cols-1 md:grid-cols-2 gap-4">';

  // Identity + Contact
  html += D.Prospects._card('Contact & Identity', [
    ['Email', p.email ? '<span class="text-green-400 font-mono">' + D.esc(p.email) + '</span>' : '<span class="text-red-400">No email found</span>'],
    ['Phone', p.phone || '&mdash;'],
    ['Lab', p.lab_name || '&mdash;'],
    ['Location', [p.city, p.state, p.country].filter(Boolean).join(', ') || '&mdash;'],
    ['Students', p.lab_students_count || '&mdash;']
  ]);

  // Research
  html += D.Prospects._card('Research Profile', [
    ['H-Index', p.h_index != null ? '<span class="text-cyan-400 font-bold">' + p.h_index + '</span>' : '&mdash;'],
    ['Citations', p.total_citations != null ? Number(p.total_citations).toLocaleString() : '&mdash;'],
    ['Pub Rate', p.publication_rate ? p.publication_rate + '/yr' : '&mdash;'],
    ['Areas', Array.isArray(p.research_areas) ? '<span class="text-[10px]">' + p.research_areas.map(function(a) { return D.esc(a); }).join(', ') + '</span>' : '&mdash;'],
    ['Grant $', p.total_grant_funding ? '<span class="text-green-400">$' + Number(p.total_grant_funding).toLocaleString() + '</span>' : '&mdash;'],
    ['Agencies', Array.isArray(p.grant_agencies) ? p.grant_agencies.join(', ') : '&mdash;']
  ]);

  // Scoring
  html += D.Prospects._card('Priority Scoring', [
    ['Priority', '<span class="text-white font-bold text-base font-mono">' + (p.priority_score != null ? p.priority_score : '&mdash;') + '</span>'],
    ['Tier', '<span class="' + D.tierClass(p.tier) + ' font-bold uppercase text-xs">' + (p.tier || '&mdash;') + '</span>'],
    ['Need', p.need_score != null ? p.need_score : '&mdash;'],
    ['Ability', p.ability_score != null ? p.ability_score : '&mdash;'],
    ['Timing', p.timing_score != null ? p.timing_score : '&mdash;'],
    ['Status', '<span class="px-2 py-0.5 rounded-full text-[10px] ' + D.statusClass(p.status) + '">' + (p.status || '&mdash;') + '</span>'],
    ['Source', '<span class="font-mono text-[10px]">' + (p.source || '&mdash;') + '</span>']
  ]);

  // Drone Capabilities
  var droneRows = [
    ['Drone Lab', p.has_drone_lab ? '<span class="text-green-400">&#10004; Yes</span>' : '&mdash;'],
    ['FPGA', p.has_fpga ? '<span class="text-green-400">&#10004; Yes</span>' : '&mdash;'],
    ['Custom HW', p.has_custom_hardware ? '<span class="text-green-400">&#10004; Yes</span>' : '&mdash;'],
    ['Simulation', p.simulation_setup || '&mdash;'],
    ['Flight Ctrl', p.flight_controller || '&mdash;'],
    ['Hardware', Array.isArray(p.hardware_platforms) ? p.hardware_platforms.join(', ') : '&mdash;'],
    ['Software', Array.isArray(p.software_stack) ? p.software_stack.join(', ') : '&mdash;'],
    ['Sensors', Array.isArray(p.sensor_types) ? p.sensor_types.join(', ') : '&mdash;']
  ];
  html += D.Prospects._card('Drone Capabilities', droneRows);
  html += '</div>';

  // ── Capability Scores (if audited) ──
  if (p.score_hardware || p.score_software || p.score_research || p.score_overall) {
    html += '<div class="mt-4 glass rounded-lg p-4"><h4 class="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-3">Capability Assessment</h4>';
    html += '<div class="grid grid-cols-4 gap-4 text-center">';
    var scores = [['Hardware', p.score_hardware, '#00D4FF'], ['Software', p.score_software, '#A855F7'], ['Research', p.score_research, '#FFD600'], ['Overall', p.score_overall, '#00FF88']];
    scores.forEach(function(s) {
      var val = s[1] != null ? s[1] : '&mdash;';
      html += '<div><div class="text-[10px] text-gray-500 mb-1">' + s[0] + '</div><div class="text-lg font-bold font-mono" style="color:' + s[2] + '">' + val + '</div></div>';
    });
    html += '</div>';
    if (p.primary_gap) html += '<div class="mt-3 text-[10px] text-gray-400"><span class="text-gray-500">Primary Gap:</span> ' + D.esc(p.primary_gap) + '</div>';
    if (p.competitive_position) html += '<div class="text-[10px] text-gray-400"><span class="text-gray-500">Position:</span> ' + D.esc(p.competitive_position) + '</div>';
    html += '</div>';
  }

  // ── Lab Audits ──
  if (data.audits && data.audits.length) {
    html += '<div class="mt-4"><h3 class="text-white font-semibold text-sm mb-3">Lab Audits</h3>';
    data.audits.forEach(function(a) {
      html += '<div class="glass rounded-lg p-4 mb-3"><div class="grid grid-cols-4 gap-4 text-xs mb-3">' +
        '<div class="text-center"><span class="text-gray-500 text-[10px] block">Hardware</span><span class="text-white font-bold font-mono text-sm">' + (a.hardware_score != null ? a.hardware_score : '&mdash;') + '</span></div>' +
        '<div class="text-center"><span class="text-gray-500 text-[10px] block">Software</span><span class="text-white font-bold font-mono text-sm">' + (a.software_score != null ? a.software_score : '&mdash;') + '</span></div>' +
        '<div class="text-center"><span class="text-gray-500 text-[10px] block">Research</span><span class="text-white font-bold font-mono text-sm">' + (a.research_score != null ? a.research_score : '&mdash;') + '</span></div>' +
        '<div class="text-center"><span class="text-gray-500 text-[10px] block">Overall</span><span class="text-cyan-400 font-bold font-mono text-lg">' + (a.overall_score != null ? a.overall_score : '&mdash;') + '</span></div>' +
        '</div>';
      if (a.competitive_gap) html += '<div class="text-[10px] text-gray-400 mb-1"><span class="text-gray-500">Gap:</span> ' + D.esc(a.competitive_gap) + '</div>';
      if (a.recommendations) {
        var recs = Array.isArray(a.recommendations) ? a.recommendations : [];
        if (typeof a.recommendations === 'string') { try { recs = JSON.parse(a.recommendations); } catch(e) { recs = []; } }
        if (recs.length) {
          html += '<div class="mt-2 space-y-1.5">';
          recs.forEach(function(r) {
            var pColor = r.priority === 'high' ? 'text-red-400 bg-red-900/20 border-red-800/30' : 'text-yellow-400 bg-yellow-900/20 border-yellow-800/30';
            var areaIcon = r.area === 'hardware' ? '&#x1F527;' : r.area === 'software' ? '&#x1F4BB;' : '&#x1F4DA;';
            html += '<div class="rounded-md border p-2 ' + pColor + '">' +
              '<div class="flex items-center gap-1 mb-0.5"><span class="text-xs">' + areaIcon + '</span><span class="text-[10px] font-semibold uppercase">' + D.esc(r.area || '') + ' &middot; ' + D.esc(r.priority || '') + '</span></div>' +
              '<div class="text-[10px] text-gray-300">' + D.esc(r.recommendation || '') + '</div>' +
              (r.impact ? '<div class="text-[9px] text-gray-500 mt-0.5 italic">Impact: ' + D.esc(r.impact) + '</div>' : '') +
              '</div>';
          });
          html += '</div>';
        }
      }
      html += '</div>';
    });
    html += '</div>';
  }

  // ── Enrichment Data (if any) ──
  if (p.enrichment && typeof p.enrichment === 'object' && Object.keys(p.enrichment).length) {
    html += '<div class="mt-4 glass rounded-lg p-4"><h4 class="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Agent Enrichment Data</h4>';
    var en = p.enrichment;
    // Show structured signals as badges
    var signals = [];
    if (en.mentions_future_work) signals.push(['&#x1F680;', 'Future Work Mentioned', 'text-green-400 bg-green-900/20']);
    if (en.hiring_drone_engineer) signals.push(['&#x1F4CB;', 'Hiring Signal', 'text-cyan-400 bg-cyan-900/20']);
    if (en.competition_involvement) signals.push(['&#x1F3C6;', 'Competition Involved', 'text-yellow-400 bg-yellow-900/20']);
    if (en.email_source) signals.push(['&#x1F4E7;', 'Email: ' + en.email_source, 'text-purple-400 bg-purple-900/20']);
    if (en.detected_hardware && en.detected_hardware.length) signals.push(['&#x1F527;', en.detected_hardware.length + ' Hardware', 'text-orange-400 bg-orange-900/20']);
    if (en.detected_software && en.detected_software.length) signals.push(['&#x1F4BB;', en.detected_software.length + ' Software', 'text-blue-400 bg-blue-900/20']);
    if (en.detected_sensors && en.detected_sensors.length) signals.push(['&#x1F50D;', en.detected_sensors.length + ' Sensors', 'text-pink-400 bg-pink-900/20']);
    if (en.has_fpga) signals.push(['&#x26A1;', 'FPGA Detected', 'text-red-400 bg-red-900/20']);
    if (en.edge_compute) signals.push(['&#x1F9E0;', en.edge_compute, 'text-emerald-400 bg-emerald-900/20']);
    if (signals.length) {
      html += '<div class="flex flex-wrap gap-1.5 mb-2">';
      signals.forEach(function(s) { html += '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] ' + s[2] + '"><span>' + s[0] + '</span>' + D.esc(s[1]) + '</span>'; });
      html += '</div>';
    }
    // Show detected items as lists
    if (en.detected_hardware && en.detected_hardware.length) {
      html += '<div class="text-[10px] text-gray-400 mb-1"><span class="text-gray-500">Hardware:</span> ' + en.detected_hardware.map(function(h) { return D.esc(h); }).join(', ') + '</div>';
    }
    if (en.detected_software && en.detected_software.length) {
      html += '<div class="text-[10px] text-gray-400 mb-1"><span class="text-gray-500">Software:</span> ' + en.detected_software.map(function(s) { return D.esc(s); }).join(', ') + '</div>';
    }
    if (en.detected_sensors && en.detected_sensors.length) {
      html += '<div class="text-[10px] text-gray-400 mb-1"><span class="text-gray-500">Sensors:</span> ' + en.detected_sensors.map(function(s) { return D.esc(s); }).join(', ') + '</div>';
    }
    // Collapsible raw data
    var rawKeys = Object.keys(en).filter(function(k) { return k !== 'faculty_page_text' && k !== 'lab_page_text' && k !== 'detected_hardware' && k !== 'detected_software' && k !== 'detected_sensors'; });
    if (en.faculty_page_text || en.lab_page_text || rawKeys.length) {
      var togId = 'enrich-raw-' + (p.id || Math.random()).toString().slice(0,8);
      html += '<button onclick="document.getElementById(\'' + togId + '\').classList.toggle(\'hidden\')" class="text-[10px] text-gray-600 hover:text-gray-400 font-mono mt-1">&#x25B6; Show raw data</button>';
      html += '<pre id="' + togId + '" class="hidden text-[10px] text-gray-500 font-mono whitespace-pre-wrap max-h-40 overflow-y-auto mt-1 border-t border-carbon-700 pt-1">';
      // Show non-text keys first
      var display = {};
      rawKeys.forEach(function(k) { display[k] = en[k]; });
      html += D.esc(JSON.stringify(display, null, 2));
      if (en.faculty_page_text) html += '\n\n--- Faculty Page Text (truncated) ---\n' + D.esc(en.faculty_page_text.slice(0, 500)) + '...';
      if (en.lab_page_text) html += '\n\n--- Lab Page Text (truncated) ---\n' + D.esc(en.lab_page_text.slice(0, 500)) + '...';
      html += '</pre>';
    }
    html += '</div>';
  }

  // ── Recent Papers ──
  if (p.recent_papers && Array.isArray(p.recent_papers) && p.recent_papers.length) {
    html += '<div class="mt-4 glass rounded-lg p-4"><h4 class="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Recent Papers</h4><div class="space-y-1">';
    p.recent_papers.slice(0, 8).forEach(function(paper) {
      var title = typeof paper === 'string' ? paper : paper.title || JSON.stringify(paper);
      html += '<div class="text-[10px] text-gray-300 font-mono truncate" title="' + D.esc(title) + '">&#x1F4C4; ' + D.esc(title) + '</div>';
    });
    html += '</div></div>';
  }

  // ═══ EMAIL SECTION — The heart of the modal ═══
  html += '<div class="mt-5 border-t border-carbon-600 pt-5">';
  html += '<div class="flex items-center justify-between mb-3">';
  html += '<h3 class="text-white font-semibold text-sm">Email Drafts & History</h3>';
  if (p.email) {
    html += '<button onclick="D.Prospects.generateDraft(\'' + p.id + '\')" class="text-[10px] bg-drone-600/20 text-drone-400 border border-drone-600/30 px-3 py-1.5 rounded-lg hover:bg-drone-600/30 transition font-mono">&#x270D; Generate New Draft</button>';
  }
  html += '</div>';

  if (!p.email) {
    html += '<div class="glass rounded-lg p-4 border border-red-900/30 bg-red-950/20">' +
      '<div class="flex items-center gap-2 text-red-400 mb-2"><span class="text-base">&#x26A0;</span><span class="font-semibold text-xs">No Email Address Found</span></div>' +
      '<p class="text-[10px] text-gray-400 mb-2">Our email hunter agents haven\'t found an email for this prospect yet. You can trigger a hunt or add one manually.</p>' +
      '<div class="flex gap-2">' +
      '<button onclick="D.Prospects.huntEmail(\'' + p.id + '\')" class="text-[10px] bg-pink-600/20 text-pink-400 border border-pink-600/30 px-3 py-1.5 rounded-lg hover:bg-pink-600/30 transition font-mono">&#x1F4E7; Run Email Hunter</button>' +
      '</div></div>';
  }

  // Show existing emails
  if (data.emails && data.emails.length) {
    var statusIcon = { draft: '&#x1F4DD;', approved: '&#10004;', scheduled: '&#x1F4C5;', sent: '&#x1F4E4;', opened: '&#x1F441;', replied: '&#x1F4AC;', rejected: '&#10060;', failed: '&#x26A0;' };
    html += '<div class="space-y-3" id="email-list-' + p.id + '">';
    data.emails.forEach(function(e) {
      var isDraft = e.status === 'draft';
      var borderClass = isDraft ? 'border-drone-600/30' : e.status === 'sent' || e.status === 'opened' ? 'border-green-900/30' : e.status === 'replied' ? 'border-cyan-900/30' : 'border-carbon-600/30';
      html += '<div class="glass rounded-lg p-4 space-y-2 ' + borderClass + '">';

      // Header row
      html += '<div class="flex items-center justify-between">';
      html += '<div class="flex items-center gap-2">';
      html += '<span class="text-base">' + (statusIcon[e.status] || '&#x1F4CB;') + '</span>';
      html += '<span class="text-xs text-white font-medium">Step ' + e.step + '</span>';
      html += '<span class="px-2 py-0.5 rounded-full text-[10px] ' + D.statusClass(e.status) + '">' + e.status + '</span>';
      if (e.template) html += '<span class="text-[10px] text-gray-600 font-mono">' + D.esc(e.template) + '</span>';
      html += '</div>';
      html += '<div class="flex items-center gap-1">';
      if (e.open_count) html += '<span class="text-[10px] text-green-400 font-mono">' + e.open_count + ' opens</span>';
      if (e.click_count) html += '<span class="text-[10px] text-cyan-400 font-mono">' + e.click_count + ' clicks</span>';
      if (e.replied_at) html += '<span class="text-[10px] text-yellow-400 font-mono">Replied &#10004;</span>';
      html += '</div></div>';

      // Subject
      html += '<div class="text-xs text-gray-200 font-medium">' + D.esc(e.subject || '(no subject)') + '</div>';

      // Timestamps
      var timeInfo = [];
      if (e.sent_at) timeInfo.push('Sent: ' + new Date(e.sent_at).toLocaleString());
      else if (e.scheduled_for) timeInfo.push('Scheduled: ' + new Date(e.scheduled_for).toLocaleString());
      if (e.opened_at) timeInfo.push('Opened: ' + new Date(e.opened_at).toLocaleString());
      if (e.replied_at) timeInfo.push('Replied: ' + new Date(e.replied_at).toLocaleString());
      if (!timeInfo.length && e.created_at) timeInfo.push('Created: ' + new Date(e.created_at).toLocaleString());
      if (timeInfo.length) html += '<div class="text-[10px] text-gray-600 font-mono">' + timeInfo.join(' &middot; ') + '</div>';

      // Action buttons for drafts
      if (isDraft) {
        html += '<div class="flex gap-2 pt-1">';
        html += '<button onclick="D.Prospects.editEmail(\'' + e.id + '\')" class="text-[10px] bg-drone-600/20 text-drone-400 border border-drone-600/30 px-3 py-1.5 rounded-lg hover:bg-drone-600/30 transition font-mono">&#x270F; Edit & Preview</button>';
        html += '<button onclick="D.Prospects.approveEmail(\'' + e.id + '\')" class="text-[10px] bg-green-600/20 text-green-400 border border-green-600/30 px-3 py-1.5 rounded-lg hover:bg-green-600/30 transition font-mono">&#10004; Approve for Send</button>';
        html += '<button onclick="D.Prospects.rejectEmail(\'' + e.id + '\')" class="text-[10px] bg-red-600/20 text-red-400 border border-red-600/30 px-3 py-1.5 rounded-lg hover:bg-red-600/30 transition font-mono">&#10060; Reject</button>';
        html += '</div>';
      }
      // View button for sent emails
      if (!isDraft && e.body_html) {
        html += '<button onclick="D.Prospects.viewEmail(\'' + e.id + '\',\'' + D.esc(e.subject || '') + '\')" class="text-[10px] text-gray-500 hover:text-gray-300 font-mono">&#x1F441; View email body</button>';
      }

      html += '</div>';
    });
    html += '</div>';
  } else if (p.email) {
    html += '<div class="glass rounded-lg p-4 text-center">' +
      '<p class="text-gray-500 text-xs mb-2">No emails yet — generate a personalized draft based on agent findings.</p>' +
      '<button onclick="D.Prospects.generateDraft(\'' + p.id + '\')" class="text-[10px] bg-drone-600/20 text-drone-400 border border-drone-600/30 px-3 py-1.5 rounded-lg hover:bg-drone-600/30 transition font-mono">&#x270D; Generate First Draft</button>' +
      '</div>';
  }

  html += '</div>'; // end email section

  document.getElementById('modal-content').innerHTML = html;
  document.getElementById('prospect-modal').classList.remove('hidden');
};

// ═══ Email Actions ═══

D.Prospects.generateDraft = async function(prospectId) {
  D.toast('Generating personalized draft...', 'info');
  var result = await D.post('/outreach/prospects/' + prospectId + '/generate-draft', {});
  if (result && result.success && result.email) {
    D.toast('Draft created! Opening editor...', 'success');
    // Reopen modal to show new draft, then open editor
    await D.Prospects.open(prospectId);
    setTimeout(function() { D.Prospects.editEmail(result.email.id); }, 300);
  } else {
    D.toast('Failed to generate draft: ' + (result && result.detail ? result.detail : 'Unknown error'), 'error');
  }
};

D.Prospects.huntEmail = async function(prospectId) {
  D.toast('Running 7-strategy email hunter...', 'info');
  var result = await D.post('/outreach/email-hunt/prospect/' + prospectId, {});
  if (result && result.email) {
    D.toast('Email found: ' + result.email, 'success');
    D.Prospects.open(prospectId); // Refresh modal
  } else {
    D.toast('No email found — try again later', 'error');
  }
};

D.Prospects.approveEmail = async function(emailId) {
  D.toast('Approving email...', 'info');
  var result = await D.post('/outreach/email-queue/' + emailId + '/approve', {});
  if (result && result.success) {
    D.toast(result.message || 'Email approved!', 'success');
    // Refresh the current prospect modal
    if (D.Prospects._currentProspect) D.Prospects.open(D.Prospects._currentProspect.id);
  } else {
    D.toast('Approve failed: ' + (result && result.detail ? result.detail : 'Error'), 'error');
  }
};

D.Prospects.rejectEmail = async function(emailId) {
  if (!confirm('Reject this email draft? This cannot be undone.')) return;
  var result = await D.post('/outreach/email-queue/' + emailId + '/reject', {});
  if (result && result.success) {
    D.toast('Email rejected', 'info');
    if (D.Prospects._currentProspect) D.Prospects.open(D.Prospects._currentProspect.id);
  } else {
    D.toast('Reject failed', 'error');
  }
};

// ═══ Email Editor Modal ═══

D.Prospects.editEmail = async function(emailId) {
  // Fetch the full email
  var data = await D.api('/outreach/emails/' + emailId);
  if (!data) { D.toast('Could not load email', 'error'); return; }

  var e = data;
  document.getElementById('editor-email-id').value = e.id;
  document.getElementById('editor-to').textContent = e.to_email || (D.Prospects._currentProspect ? D.Prospects._currentProspect.email : '—');
  document.getElementById('editor-prospect-name').textContent = e.to_name || (D.Prospects._currentProspect ? D.Prospects._currentProspect.name : '—');
  document.getElementById('editor-step').textContent = 'Step ' + (e.sequence_step || e.step || '?');
  document.getElementById('editor-subject').value = e.subject || '';
  document.getElementById('editor-body').value = e.body_html || '';

  // Load preview iframe
  D.Prospects._loadPreview(e.body_html || '');
  D.Prospects._editorMode = 'preview';
  document.getElementById('editor-preview-btn').classList.add('active');
  document.getElementById('editor-source-btn').classList.remove('active');
  document.getElementById('editor-iframe-wrap').classList.remove('hidden');
  document.getElementById('editor-body').classList.add('hidden');

  document.getElementById('email-editor-modal').classList.remove('hidden');
};

D.Prospects.viewEmail = async function(emailId, subject) {
  var data = await D.api('/outreach/emails/' + emailId);
  if (!data) return;
  // Reuse editor in read-only mode
  document.getElementById('editor-email-id').value = '';
  document.getElementById('editor-to').textContent = data.to_email || '—';
  document.getElementById('editor-prospect-name').textContent = data.to_name || '—';
  document.getElementById('editor-step').textContent = 'Step ' + (data.sequence_step || '?');
  document.getElementById('editor-subject').value = data.subject || subject;
  document.getElementById('editor-subject').readOnly = true;
  document.getElementById('editor-body').value = data.body_html || '';
  D.Prospects._loadPreview(data.body_html || '');
  D.Prospects._editorMode = 'preview';
  document.getElementById('editor-preview-btn').classList.add('active');
  document.getElementById('editor-source-btn').classList.remove('active');
  document.getElementById('editor-iframe-wrap').classList.remove('hidden');
  document.getElementById('editor-body').classList.add('hidden');
  document.getElementById('email-editor-modal').classList.remove('hidden');
};

D.Prospects._loadPreview = function(html) {
  var iframe = document.getElementById('editor-iframe');
  var doc = iframe.contentDocument || iframe.contentWindow.document;
  doc.open();
  doc.write(html || '<p style="color:#888;font-family:sans-serif">No email content</p>');
  doc.close();
  // Make editable
  doc.body.contentEditable = 'true';
  doc.body.style.margin = '12px';
  doc.body.style.fontFamily = 'Arial, sans-serif';
  doc.body.style.fontSize = '14px';
  doc.body.style.color = '#1a1a1a';
  doc.body.style.background = '#ffffff';
};

D.Prospects._getPreviewHtml = function() {
  var iframe = document.getElementById('editor-iframe');
  var doc = iframe.contentDocument || iframe.contentWindow.document;
  var body = doc.body;
  if (!body) return '';
  body.contentEditable = 'false';
  var html = doc.documentElement.outerHTML;
  body.contentEditable = 'true';
  return html;
};

D.Prospects.toggleEditorMode = function(mode) {
  var body = document.getElementById('editor-body');
  var iframeWrap = document.getElementById('editor-iframe-wrap');
  var previewBtn = document.getElementById('editor-preview-btn');
  var sourceBtn = document.getElementById('editor-source-btn');

  if (mode === 'source') {
    // Sync iframe → textarea
    body.value = D.Prospects._getPreviewHtml();
    iframeWrap.classList.add('hidden');
    body.classList.remove('hidden');
    previewBtn.classList.remove('active');
    sourceBtn.classList.add('active');
    D.Prospects._editorMode = 'source';
  } else {
    // Sync textarea → iframe
    D.Prospects._loadPreview(body.value);
    iframeWrap.classList.remove('hidden');
    body.classList.add('hidden');
    previewBtn.classList.add('active');
    sourceBtn.classList.remove('active');
    D.Prospects._editorMode = 'preview';
  }
};

D.Prospects.saveEmail = async function() {
  var emailId = document.getElementById('editor-email-id').value;
  if (!emailId) { D.toast('No email to save (view-only mode)', 'info'); return; }
  var subject = document.getElementById('editor-subject').value;
  var bodyHtml = D.Prospects._editorMode === 'source'
    ? document.getElementById('editor-body').value
    : D.Prospects._getPreviewHtml();

  var result = await D.patch('/outreach/email-queue/' + emailId, { subject: subject, body_html: bodyHtml });
  if (result && result.success) {
    D.toast('Email saved!', 'success');
  } else {
    D.toast('Save failed: ' + (result && result.detail ? result.detail : 'Error'), 'error');
  }
};

D.Prospects.approveFromEditor = async function() {
  await D.Prospects.saveEmail();
  var emailId = document.getElementById('editor-email-id').value;
  if (!emailId) return;
  var result = await D.post('/outreach/email-queue/' + emailId + '/approve', {});
  if (result && result.success) {
    D.toast(result.message || 'Approved!', 'success');
    D.Prospects.closeEditor();
    if (D.Prospects._currentProspect) D.Prospects.open(D.Prospects._currentProspect.id);
  } else {
    D.toast('Approve failed', 'error');
  }
};

D.Prospects.closeEditor = function() {
  document.getElementById('email-editor-modal').classList.add('hidden');
  document.getElementById('editor-subject').readOnly = false;
};

D.Prospects.closeModal = function() {
  document.getElementById('prospect-modal').classList.add('hidden');
  D.Prospects._currentProspect = null;
};

// ── Pipeline Progress in Modal ──
D.Prospects.renderPipelineProgress = function(currentStatus) {
  var el = document.getElementById('modal-pipeline-progress');
  var currentIdx = STAGES.indexOf(currentStatus);
  el.innerHTML = '<div class="flex items-center gap-0.5 overflow-x-auto">' +
    STAGES.map(function(s, i) {
      var isDone = i < currentIdx;
      var isCurrent = i === currentIdx;
      var cls = isDone ? 'bg-green-600/30 text-green-300 border-green-600/30' :
                isCurrent ? 'bg-drone-600/30 text-drone-300 border-drone-500/50 ring-1 ring-drone-500/30' :
                'bg-carbon-700 text-gray-600 border-carbon-600';
      return '<div class="flex items-center">' +
        '<span class="px-2 py-1 rounded text-[9px] font-mono border ' + cls + ' whitespace-nowrap">' + s + '</span>' +
        (i < STAGES.length - 1 ? '<span class="text-[10px] mx-0.5 ' + (isDone ? 'text-green-500' : 'text-gray-700') + '">&rarr;</span>' : '') +
        '</div>';
    }).join('') + '</div>';
};

// ── Card Builder ──
D.Prospects._card = function(title, rows) {
  var html = '<div class="glass rounded-lg p-4"><h4 class="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">' + title + '</h4>';
  rows.forEach(function(r) {
    html += '<div class="flex justify-between text-[11px] py-1 border-b border-carbon-700/30"><span class="text-gray-500">' + r[0] + '</span><span class="text-gray-300 text-right max-w-[60%] truncate">' + (r[1] || '&mdash;') + '</span></div>';
  });
  return html + '</div>';
};

// ── D.patch helper (if not in core.js) ──
if (!D.patch) {
  D.patch = async function(path, body) {
    try {
      var resp = await fetch(D.API + path, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      return await resp.json();
    } catch(e) { return null; }
  };
}
