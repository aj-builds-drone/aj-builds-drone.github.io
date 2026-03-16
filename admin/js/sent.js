/* ═══════════════════════════════════════════════════════════════════
   sent.js — Sent & Tracking: email lifecycle monitoring
   ═══════════════════════════════════════════════════════════════════ */
D.Sent = {};
D.Sent._filter = '';
D.Sent._offset = 0;
D.Sent._limit = 25;
D.Sent._total = 0;

D.Sent.load = async function() {
  var url = '/outreach/emails/sent?limit=' + D.Sent._limit + '&offset=' + D.Sent._offset;
  if (D.Sent._filter) url += '&status=' + D.Sent._filter;

  var data = await D.api(url);
  if (!data) return;

  // Update status counters
  var sc = data.status_counts || {};
  var ids = ['approved','sent','opened','replied','bounced','failed'];
  ids.forEach(function(s) {
    var el = document.getElementById('sc-' + s);
    if (el) el.textContent = sc[s] || 0;
  });

  D.Sent._total = data.total || 0;
  var emails = data.emails || [];
  var el = document.getElementById('sent-email-list');

  if (!emails.length) {
    el.innerHTML = '<p class="text-gray-500 text-xs text-center py-6">No emails in this category yet.</p>';
    document.getElementById('sent-pagination').classList.add('hidden');
    return;
  }

  el.innerHTML = emails.map(function(e) {
    var statusBadge = D.Sent._badge(e.status);
    var timeStr = e.sent_at ? D.timeAgo(e.sent_at) : D.timeAgo(e.created_at);
    var trackingInfo = [];
    if (e.open_count) trackingInfo.push('<span class="text-green-400">' + e.open_count + ' opens</span>');
    if (e.click_count) trackingInfo.push('<span class="text-cyan-400">' + e.click_count + ' clicks</span>');
    if (e.replied_at) trackingInfo.push('<span class="text-yellow-400">Replied ' + D.timeAgo(e.replied_at) + '</span>');
    if (e.error_message) trackingInfo.push('<span class="text-red-400 truncate max-w-[200px] inline-block align-bottom" title="' + D.esc(e.error_message) + '">&#x26A0; ' + D.esc(e.error_message.slice(0, 60)) + '</span>');

    var timestamps = [];
    if (e.created_at) timestamps.push('Created: ' + new Date(e.created_at).toLocaleString());
    if (e.sent_at) timestamps.push('Sent: ' + new Date(e.sent_at).toLocaleString());
    if (e.opened_at) timestamps.push('Opened: ' + new Date(e.opened_at).toLocaleString());
    if (e.replied_at) timestamps.push('Replied: ' + new Date(e.replied_at).toLocaleString());
    if (e.scheduled_for) timestamps.push('Scheduled: ' + new Date(e.scheduled_for).toLocaleString());

    var borderClass = e.status === 'replied' ? 'border-yellow-800/30' :
      e.status === 'opened' ? 'border-green-800/30' :
      e.status === 'sent' ? 'border-cyan-800/30' :
      e.status === 'bounced' || e.status === 'failed' ? 'border-red-800/30' :
      e.status === 'approved' ? 'border-amber-800/30' : 'border-carbon-600';

    return '<div class="glass rounded-lg p-4 ' + borderClass + ' glass-hover">' +
      '<div class="flex items-start justify-between gap-4">' +
      '<div class="flex-1 min-w-0">' +
      '<div class="flex items-center gap-2 mb-1 flex-wrap">' +
      '<span class="text-white font-medium text-sm">' + D.esc(e.to_name || 'Unknown') + '</span>' +
      '<span class="text-[10px] text-gray-500 font-mono">' + D.esc(e.to_email || '') + '</span>' +
      statusBadge +
      '<span class="px-1.5 py-0.5 rounded text-[10px] bg-carbon-600 font-mono">Step ' + e.sequence_step + '</span>' +
      '<span class="text-[10px] text-gray-600">' + timeStr + '</span>' +
      '</div>' +
      '<p class="text-xs text-gray-400 mb-1">Subject: <span class="text-gray-200">' + D.esc(e.subject || '(no subject)') + '</span></p>' +
      (e.organization ? '<p class="text-[10px] text-gray-600 font-mono mb-1">' + D.esc(e.organization) + (e.template_id ? ' &middot; ' + D.esc(e.template_id) : '') + '</p>' : '') +
      (trackingInfo.length ? '<div class="flex gap-3 text-[10px] font-mono mb-1">' + trackingInfo.join(' &middot; ') + '</div>' : '') +
      '<div class="text-[9px] text-gray-600 font-mono">' + timestamps.join(' &middot; ') + '</div>' +
      '</div>' +
      '<div class="flex flex-col gap-1.5 flex-shrink-0">' +
      (e.prospect_id ? '<button onclick="D.Prospects.open(\'' + e.prospect_id + '\')" class="text-[10px] bg-carbon-700 hover:bg-carbon-600 border border-carbon-600 px-2 py-1 rounded-lg whitespace-nowrap">View Prospect</button>' : '') +
      ((e.status === 'approved' || e.status === 'scheduled') ? '<button onclick="D.Sent.sendNow(\'' + e.id + '\')" class="text-[10px] bg-green-600/20 text-green-400 border border-green-600/30 px-2 py-1 rounded-lg hover:bg-green-600/30 whitespace-nowrap">&#x1F680; Send Now</button>' : '') +
      '</div>' +
      '</div></div>';
  }).join('');

  // Pagination
  var pag = document.getElementById('sent-pagination');
  pag.classList.remove('hidden');
  var start = D.Sent._offset + 1;
  var end = Math.min(D.Sent._offset + emails.length, D.Sent._total);
  document.getElementById('sent-page-info').textContent = start + '–' + end + ' of ' + D.Sent._total;
  document.getElementById('sent-prev').disabled = (D.Sent._offset === 0);
  document.getElementById('sent-next').disabled = (end >= D.Sent._total);
};

D.Sent._badge = function(status) {
  var colors = {
    approved: 'bg-amber-500/15 text-amber-400',
    scheduled: 'bg-blue-500/15 text-blue-400',
    sent: 'bg-cyan-500/15 text-cyan-400',
    opened: 'bg-green-500/15 text-green-400',
    clicked: 'bg-purple-500/15 text-purple-400',
    replied: 'bg-yellow-500/15 text-yellow-400',
    bounced: 'bg-red-500/15 text-red-400',
    failed: 'bg-red-500/15 text-red-400',
    rejected: 'bg-gray-500/15 text-gray-400',
  };
  var icons = {
    approved: '&#10003;',
    scheduled: '&#x1F4C5;',
    sent: '&#x1F4E4;',
    opened: '&#x1F441;',
    clicked: '&#x1F517;',
    replied: '&#x1F4AC;',
    bounced: '&#x26A0;',
    failed: '&#x26D4;',
    rejected: '&#10060;',
  };
  var c = colors[status] || 'bg-gray-500/15 text-gray-400';
  var i = icons[status] || '';
  return '<span class="px-2 py-0.5 rounded-full text-[10px] font-mono ' + c + '">' + i + ' ' + D.esc(status) + '</span>';
};

D.Sent.filterStatus = function(status) {
  D.Sent._filter = status;
  D.Sent._offset = 0;

  // Update active tab
  document.querySelectorAll('#sent-status-tabs button').forEach(function(btn) {
    btn.classList.remove('border-drone-400', 'text-drone-400');
    btn.classList.add('border-transparent', 'text-gray-500');
  });
  var activeId = status ? 'st-tab-' + status : 'st-tab-all';
  var activeBtn = document.getElementById(activeId);
  if (activeBtn) {
    activeBtn.classList.add('border-drone-400', 'text-drone-400');
    activeBtn.classList.remove('border-transparent', 'text-gray-500');
  }

  D.Sent.load();
};

D.Sent.prev = function() {
  D.Sent._offset = Math.max(0, D.Sent._offset - D.Sent._limit);
  D.Sent.load();
};

D.Sent.next = function() {
  if (D.Sent._offset + D.Sent._limit < D.Sent._total) {
    D.Sent._offset += D.Sent._limit;
    D.Sent.load();
  }
};

D.Sent.sendNow = async function(emailId) {
  D.toast('Sending email...', 'info');
  try {
    var r = await fetch(D.API + '/outreach/emails/' + emailId + '/send-now', {
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
  D.Sent.load();
};
