'use strict';

// ── Dev mode ──────────────────────────────────────────────────────────────────
(function() {
  if (localStorage.getItem('devMode') === '1') {
    document.getElementById('dev-section').style.display = '';
  }
})();

function showToast(msg) {
  var el = document.createElement('div');
  el.textContent = msg;
  el.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#1c1917;color:#f4f1ec;font-size:0.75rem;letter-spacing:0.05em;padding:8px 16px;border-radius:1px;z-index:9999;pointer-events:none;opacity:0;transition:opacity 0.2s';
  document.body.appendChild(el);
  requestAnimationFrame(function() { el.style.opacity = '1'; });
  setTimeout(function() {
    el.style.opacity = '0';
    setTimeout(function() { el.remove(); }, 200);
  }, 2000);
}

// ── Storage helpers ───────────────────────────────────────────────────────────
function todayKey() {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0')
  ].join('-');
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
}

async function getJournal(date) {
  date = date || todayKey();
  try {
    var r = await fetch('/api/journal/' + date);
    return r.ok ? r.json() : { date: date, entries: [] };
  } catch (_) { return { date: date, entries: [] }; }
}

async function saveJournal(journal) {
  await fetch('/api/journal/' + journal.date, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(journal)
  });
}

async function getPastJournalDates() {
  try {
    var r = await fetch('/api/journal/dates');
    return r.ok ? r.json() : [];
  } catch (_) { return []; }
}

async function getPastGoalDates() {
  try {
    var r = await fetch('/api/goals/dates');
    return r.ok ? r.json() : [];
  } catch (_) { return []; }
}

async function getGoals(date) {
  date = date || todayKey();
  try {
    var r = await fetch('/api/goals/' + date);
    return r.ok ? r.json() : null;
  } catch (_) { return null; }
}

async function saveGoals(targets) {
  await fetch('/api/goals/' + todayKey(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targets: targets, lastUpdated: new Date().toISOString() })
  });
}

async function getWeight(date) {
  date = date || todayKey();
  try {
    var r = await fetch('/api/weight/' + date);
    return r.ok ? r.json() : null;
  } catch (_) { return null; }
}

async function saveWeight(date, weight) {
  var r = await fetch('/api/weight/' + date, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date: date, weight: weight })
  });
  if (!r.ok) throw new Error('Save failed (' + r.status + ')');
}

async function deleteWeight(date) {
  var r = await fetch('/api/weight/' + date, { method: 'DELETE' });
  if (!r.ok) throw new Error('Delete failed (' + r.status + ')');
}

async function renderWeightLog() {
  var el = document.getElementById('weight-log');
  if (!el) return;
  var date = logDate;
  var existing = await getWeight(date);
  var currentVal = existing && existing.weight ? existing.weight : '';
  el.innerHTML =
    '<p style="font-size:0.75rem;letter-spacing:0.1em;text-transform:uppercase;color:#a09a93;margin-bottom:12px">Body Weight</p>' +
    '<div style="display:flex;align-items:center;gap:8px">' +
      '<input type="number" id="weight-input" min="50" max="999" step="0.1" inputmode="decimal" ' +
        'placeholder="—" value="' + currentVal + '" ' +
        'style="width:90px;border:1px solid #e0dbd3;border-radius:1px;padding:6px 10px;font-size:0.875rem;background:transparent;color:#1c1917;text-align:center" ' +
        'class="focus:outline-none focus:border-[#1c1917] transition-colors">' +
      '<span style="font-size:0.75rem;color:#6b6560">lbs</span>' +
      '<button id="weight-save-btn" class="text-xs tracking-widest uppercase px-4 py-2 font-medium transition-all" style="background:#1c1917;color:#f4f1ec;border-radius:1px">Log Weight</button>' +
      '<span id="weight-save-hint" style="font-size:0.7rem;color:#a09a93"></span>' +
    '</div>';
  var capturedDate = date;
  document.getElementById('weight-save-btn').addEventListener('click', async function() {
    var raw = document.getElementById('weight-input').value;
    var val = parseFloat(raw);
    var hint = document.getElementById('weight-save-hint');
    try {
      if (!raw.trim() || isNaN(val) || val < 1) {
        await deleteWeight(capturedDate);
      } else {
        await saveWeight(capturedDate, val);
      }
      if (hint) {
        hint.textContent = 'saved';
        hint.style.color = '#a09a93';
        setTimeout(function() { if (hint) hint.textContent = ''; }, 1500);
      }
    } catch (e) {
      if (hint) {
        hint.textContent = 'error — is the server running?';
        hint.style.color = '#8b3a3a';
      }
    }
  });
}


function computeTotals(entries) {
  return entries.reduce(function(acc, e) {
    return {
      calories: acc.calories + (e.calories || 0),
      protein:  acc.protein  + (e.protein  || 0),
      carbs:    acc.carbs    + (e.carbs    || 0),
      fat:      acc.fat      + (e.fat      || 0)
    };
  }, { calories: 0, protein: 0, carbs: 0, fat: 0 });
}

// ── ID generation (crypto.randomUUID requires HTTPS; fall back for plain HTTP) ─
function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

// ── HTML escape ───────────────────────────────────────────────────────────────
function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── Edit modal dirty-state flag ───────────────────────────────────────────────
var editModalDirty = false;

// ── Palette ───────────────────────────────────────────────────────────────────
var P = {
  bg:      '#f4f1ec',
  surface: '#faf8f4',
  ink:     '#1c1917',
  muted:   '#6b6560',
  faint:   '#a09a93',
  ghost:   '#c4bdb5',
  border:  '#e0dbd3',
  cal:  { bg: '#e8edf5', text: '#1e3a5f', ring: '#2455a4' },
  pro:  { bg: '#f2ebe3', text: '#5c3018', ring: '#8b4520' },
  carb: { bg: '#ede8d5', text: '#4a360a', ring: '#7a5514' },
  fat:  { bg: '#e4ece4', text: '#1e3d22', ring: '#2a6632' },
};

// ── Tab switching ─────────────────────────────────────────────────────────────
var currentTab       = 'log';
var viewDate         = todayKey();
var logDate          = todayKey();
var currentChartRange = '7d';

async function buildQuickLogItems() {
  var today = new Date();
  var dates = [];
  for (var d = 0; d < 21; d++) {
    var dt = new Date(today);
    dt.setDate(today.getDate() - d);
    dates.push([dt.getFullYear(), String(dt.getMonth()+1).padStart(2,'0'), String(dt.getDate()).padStart(2,'0')].join('-'));
  }
  var journals = await Promise.all(dates.map(getJournal));
  var counts = {}, best = {};
  journals.forEach(function(journal) {
    journal.entries.forEach(function(e) {
      var k = e.name.toLowerCase();
      counts[k] = (counts[k] || 0) + 1;
      if (!best[k] || e.createdAt > best[k].createdAt) best[k] = e;
    });
  });
  return Object.keys(counts)
    .filter(function(k) { return k !== 'placeholder meal from import'; })
    .sort(function(a, b) { return counts[b] - counts[a] || best[b].createdAt.localeCompare(best[a].createdAt); })
    .slice(0, 12)
    .map(function(k) { return best[k]; });
}

async function renderQuickLog() {
  var bar = document.getElementById('quick-log-bar');
  if (!bar) return;
  var items = await buildQuickLogItems();
  if (!items.length) { bar.innerHTML = ''; return; }
  var chips = items.map(function(e) {
    var label = e.name.length > 28 ? e.name.slice(0, 26) + '…' : e.name;
    return '<button class="quick-log-chip" data-id="' + esc(e.id) + '" ' +
      'style="display:inline-flex;flex-direction:column;align-items:flex-start;background:#fff;border:1px solid #e0dbd3;border-radius:2px;padding:7px 10px;cursor:pointer;text-align:left;max-width:160px;flex-shrink:0">' +
      '<span style="font-size:0.75rem;color:#1c1917;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:140px">' + esc(label) + '</span>' +
      '<span style="font-size:0.65rem;color:#a09a93;margin-top:2px;letter-spacing:0.03em">' + Math.round(e.calories) + ' cal · ' + Math.round(e.protein) + 'p</span>' +
    '</button>';
  }).join('');
  bar.innerHTML =
    '<p style="font-size:0.65rem;letter-spacing:0.08em;text-transform:uppercase;color:#c4bdb5;margin-bottom:8px">Quick log</p>' +
    '<div style="display:flex;flex-wrap:wrap;gap:8px;max-height:170px;overflow:hidden">' + chips + '</div>';
  bar.querySelectorAll('.quick-log-chip').forEach(function(btn) {
    btn.addEventListener('click', async function() {
      var id = btn.dataset.id;
      var items2 = await buildQuickLogItems();
      var entry = items2.find(function(e) { return e.id === id; });
      if (!entry) return;
      pendingFlow = {
        rawInput: entry.name,
        title: entry.name,
        estimates: entry.items ? entry.items.map(function(item) {
          return {
            name:       item.name,
            calories:   item.calories,
            protein:    item.protein,
            carbs:      item.carbs,
            fat:        item.fat,
            confidence: item.conf || 'high'
          };
        }) : [{
          name:       entry.name,
          calories:   entry.calories,
          protein:    entry.protein,
          carbs:      entry.carbs,
          fat:        entry.fat,
          confidence: 'high'
        }]
      };
      openModal(renderConfirmModal);
    });
  });
  renderWeightLog();
}

function switchTab(tab) {
  currentTab = tab;
  if (tab === 'log')     { logDate  = todayKey(); renderLogDateLabel(); }
  if (tab === 'journal') { viewDate = todayKey(); }
  document.querySelectorAll('.tab-panel').forEach(function(el) {
    el.classList.add('hidden');
  });
  document.getElementById('tab-' + tab).classList.remove('hidden');
  document.querySelectorAll('.tab-btn').forEach(function(btn) {
    var isActive = btn.dataset.tab === tab;
    btn.classList.toggle('tab-active', isActive);
  });
  if (tab === 'log')     renderQuickLog();
  if (tab === 'journal') renderJournal();
  if (tab === 'goals')   renderGoals();
}

document.querySelectorAll('.tab-btn').forEach(function(btn) {
  btn.addEventListener('click', function() { switchTab(btn.dataset.tab); });
});

// ── Modal ─────────────────────────────────────────────────────────────────────
function openModal(renderFn) {
  var overlay = document.getElementById('modal-overlay');
  var sheet   = document.getElementById('modal-sheet');
  overlay.style.display = 'flex';
  sheet.classList.add('sliding-in');
  renderFn();
  setTimeout(function() { sheet.classList.remove('sliding-in'); }, 300);
}

function closeModal() {
  document.getElementById('modal-overlay').style.display = 'none';
  document.getElementById('modal-content').innerHTML = '';
  var actions = document.getElementById('modal-actions');
  actions.innerHTML = '';
  actions.style.display = 'none';
}

document.getElementById('modal-overlay').addEventListener('click', function(e) {
  if (e.target !== e.currentTarget) return;
  if (editModalDirty) { showEditUnsavedPrompt(); } else { closeModal(); }
});

function renderTipsModal() {
  document.getElementById('modal-content').innerHTML =
    '<p style="font-size:1rem;font-weight:600;color:#1c1917;margin-bottom:16px">Logging tips</p>' +
    '<div style="display:flex;flex-direction:column;gap:12px">' +
      ['Weigh food when possible for the most accurate estimate',
       'Name the restaurant — published data beats estimates',
       'Sauces and dressings add 100–300 cal; mention them',
       'For home cooking, list key ingredients separately',
       'Drinks count — coffee with milk, juice, protein shakes']
      .map(function(t) {
        return '<p style="font-size:0.8rem;color:#a09a93;line-height:1.5">' + t + '</p>';
      }).join('') +
    '</div>';
}

document.getElementById('tips-btn').addEventListener('click', function() {
  openModal(renderTipsModal);
});

// ── Close-button icon helper ──────────────────────────────────────────────────
var CLOSE_ICON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M18 6L6 18M6 6l12 12"/></svg>';

// ── Progress row ──────────────────────────────────────────────────────────────
function progressRow(label, current, target, color, unit, low, high) {
  unit = unit || '';
  var pct = target ? Math.min((current / target) * 100, 100) : null;
  var over = target && current > target;
  var ratio = target ? current / target : 0;
  var barColor = over ? '#8b3a3a' : (ratio > 0.9 ? '#ca8a04' : color);

  var hasRange = low !== undefined && high !== undefined && (Math.round(low) !== Math.round(high));
  var margin   = hasRange ? Math.round((high - low) / 2) : 0;

  return '<div class="mb-4">' +
    '<div class="flex justify-between mb-1.5" style="font-size:0.7rem">' +
      '<span style="color:#a09a93;letter-spacing:0.06em;text-transform:uppercase">' + label + '</span>' +
      '<span style="color:' + color + '">' +
        '<span style="font-weight:600">' + Math.round(current) + unit + '</span>' +
        (target ? '<span style="color:#c4bdb5"> / ' + target + unit + '</span>' : '') +
        (hasRange ? '<span style="opacity:0.45;font-size:0.6rem;margin-left:3px">±' + margin + unit + '</span>' : '') +
      '</span>' +
    '</div>' +
    (pct !== null
      ? '<div class="progress-track"><div class="progress-fill" style="width:' + pct + '%;background:' + barColor + '"></div></div>'
      : '<div class="progress-track"></div>') +
  '</div>';
}

// ── Donut chart ───────────────────────────────────────────────────────────────
function donutChart(value, target, unit, label, color, trackColor, range) {
  var r      = 35;
  var circ   = 2 * Math.PI * r;
  var pct    = target ? Math.min(value / target, 1) : 0;
  var stroke = color;
  var offset = circ * (1 - pct);

  var arc = pct > 0
    ? '<circle cx="50" cy="50" r="' + r + '" fill="none" stroke="' + stroke + '" stroke-width="7.5"' +
        ' stroke-dasharray="' + circ.toFixed(2) + '" stroke-dashoffset="' + offset.toFixed(2) + '"' +
        ' transform="rotate(-90 50 50)"/>'
    : '';

  var line1 = target ? Math.round(value) + unit + ' / ' + target + unit : Math.round(value) + unit;
  var line2 = (range != null && range > 0) ? '±' + Math.round(range) + unit : '';

  return '<div style="flex:1;display:flex;flex-direction:column;align-items:center">' +
    '<svg width="100%" viewBox="0 0 100 100" style="display:block">' +
      '<circle cx="50" cy="50" r="' + r + '" fill="none" stroke="' + trackColor + '" stroke-width="7.5"/>' +
      arc +
      '<text x="50" y="46" text-anchor="middle" dominant-baseline="central" style="font-size:11px;font-weight:600;fill:' + stroke + ';font-family:-apple-system,BlinkMacSystemFont,Segoe UI,system-ui,sans-serif">' + line1 + '</text>' +
      (line2 ? '<text x="50" y="60" text-anchor="middle" dominant-baseline="central" style="font-size:9px;fill:' + stroke + ';opacity:0.6;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,system-ui,sans-serif">' + line2 + '</text>' : '') +
    '</svg>' +
    '<p style="font-size:0.55rem;letter-spacing:0.1em;text-transform:uppercase;color:#a09a93;margin-top:2px">' + label + '</p>' +
  '</div>';
}

// ── Day-totals-after-adding section (existing + delta highlighted) ─────────────
function donutWithDelta(existingVal, afterVal, target, unit, label, color, trackColor) {
  var r         = 35;
  var circ      = 2 * Math.PI * r;
  var mainColor = color;

  var existPct  = target ? Math.min(existingVal / target, 1) : 0;
  var afterPct  = target ? Math.min(afterVal    / target, 1) : 0;
  var existLen  = circ * existPct;
  var deltaLen  = circ * (afterPct - existPct);
  var existDeg  = existPct * 360;

  var existArc = existLen > 0.5
    ? '<circle cx="50" cy="50" r="' + r + '" fill="none" stroke="' + mainColor + '" stroke-width="7.5"' +
        ' stroke-dasharray="' + existLen.toFixed(2) + ' ' + (circ - existLen).toFixed(2) + '"' +
        ' transform="rotate(-90 50 50)"/>'
    : '';

  var deltaArc = deltaLen > 0.5
    ? '<circle cx="50" cy="50" r="' + r + '" fill="none" stroke="' + mainColor + '" stroke-width="7.5" stroke-opacity="0.35"' +
        ' stroke-dasharray="' + deltaLen.toFixed(2) + ' ' + (circ - deltaLen).toFixed(2) + '"' +
        ' transform="rotate(' + (existDeg - 90) + ' 50 50)"/>'
    : '';

  var deltaVal = Math.round(afterVal - existingVal);
  var line1    = Math.round(afterVal) + unit + (target ? ' / ' + target + unit : '');
  var line2    = (deltaVal > 0 ? '+' : '') + deltaVal + unit;

  return '<div style="flex:1;display:flex;flex-direction:column;align-items:center">' +
    '<svg width="100%" viewBox="0 0 100 100" style="display:block">' +
      '<circle cx="50" cy="50" r="' + r + '" fill="none" stroke="' + trackColor + '" stroke-width="7.5"/>' +
      existArc + deltaArc +
      '<text x="50" y="46" text-anchor="middle" dominant-baseline="central" style="font-size:11px;font-weight:600;fill:' + mainColor + ';font-family:-apple-system,BlinkMacSystemFont,Segoe UI,system-ui,sans-serif">' + line1 + '</text>' +
      '<text x="50" y="60" text-anchor="middle" dominant-baseline="central" style="font-size:9px;fill:' + mainColor + ';opacity:0.6;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,system-ui,sans-serif">' + line2 + '</text>' +
    '</svg>' +
    '<p style="font-size:0.55rem;letter-spacing:0.1em;text-transform:uppercase;color:#a09a93;margin-top:2px">' + label + '</p>' +
  '</div>';
}

function renderDaySectionWithDelta(existing, delta, targets) {
  var after = {
    calories: existing.calories + Math.round(delta.calories),
    protein:  existing.protein  + Math.round(delta.protein),
    carbs:    existing.carbs    + Math.round(delta.carbs),
    fat:      existing.fat      + Math.round(delta.fat)
  };
  var calTarget   = targets && targets.calories;
  var calExistPct = calTarget ? Math.min((existing.calories / calTarget) * 100, 100) : null;
  var calAfterPct = calTarget ? Math.min((after.calories    / calTarget) * 100, 100) : null;
  var calOver     = calTarget && after.calories > calTarget + 60;
  var calRatio    = calTarget ? after.calories / calTarget : 0;
  var calColor    = calOver ? '#c0392b' : (calRatio > 0.95 ? '#ca8a04' : P.cal.text);
  var calColorLt  = calOver ? '#e07060' : (calRatio > 0.9 ? '#eab308' : '#90b4cc');
  var deltaCal    = Math.round(delta.calories);

  var calRow =
    '<div style="margin-bottom:28px">' +
      '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px">' +
        '<span style="font-size:0.6rem;letter-spacing:0.1em;text-transform:uppercase;color:#a09a93">Calories</span>' +
        (deltaCal > 0 ? '<span style="font-size:0.78rem;font-weight:600;color:' + calColorLt + '">+' + deltaCal + ' cal</span>' : '') +
      '</div>' +
      '<div style="height:7px;background:#ede9e2;overflow:hidden;display:flex">' +
        (calExistPct !== null ? '<div style="height:100%;width:' + calExistPct + '%;background:' + calColor + ';flex-shrink:0"></div>' : '') +
        (calExistPct !== null && calAfterPct > calExistPct
          ? '<div style="height:100%;width:' + (calAfterPct - calExistPct) + '%;background:' + calColorLt + ';flex-shrink:0"></div>'
          : (calAfterPct !== null && calExistPct === null
              ? '<div style="height:100%;width:' + calAfterPct + '%;background:' + calColor + '"></div>'
              : '')) +
      '</div>' +
      '<div style="display:flex;justify-content:flex-end;margin-top:5px">' +
        '<span style="font-size:0.72rem;font-weight:600;color:' + calColor + '">' +
          Math.round(after.calories) +
          (calTarget ? ' / ' + calTarget + ' cal' : '') +
        '</span>' +
      '</div>' +
    '</div>';

  var donutRow =
    '<div style="display:flex;gap:4px">' +
      donutWithDelta(existing.protein, after.protein, targets && targets.protein, '', 'Protein (G)', P.pro.ring,  '#f2ebe3') +
      donutWithDelta(existing.carbs,   after.carbs,   targets && targets.carbs,   '', 'Carbs (G)',   P.carb.ring, '#ede8d5') +
      donutWithDelta(existing.fat,     after.fat,     targets && targets.fat,     '', 'Fat (G)',     P.fat.ring,  '#e4ece4') +
    '</div>';

  return '<p style="font-size:0.7rem;letter-spacing:0.1em;text-transform:uppercase;color:#a09a93;margin-bottom:14px">Day totals after adding</p>' +
    calRow + donutRow;
}

// ── Macro summary (calories bar + donut row) ──────────────────────────────────
function renderMacroSummary(sectionLabel, totals, targets, calLow, calHigh, proRange, carbRange, fatRange) {
  var calPct    = targets && targets.calories ? Math.min((totals.calories / targets.calories) * 100, 100) : null;
  var calOver   = targets && targets.calories && totals.calories > targets.calories + 60;
  var calRatio  = targets && targets.calories ? totals.calories / targets.calories : 0;
  var calColor  = calOver ? '#c0392b' : (calRatio > 0.95 ? '#ca8a04' : P.cal.text);

  var hasCalRange = calLow !== undefined && calHigh !== undefined;
  var calMargin   = hasCalRange ? Math.round((calHigh - calLow) / 2) : null;

  var calRow =
    '<div style="margin-bottom:14px">' +
      '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px">' +
        '<span style="font-size:0.6rem;letter-spacing:0.1em;text-transform:uppercase;color:#a09a93">Calories</span>' +
        '<span style="font-size:0.78rem;font-weight:600;color:' + calColor + '">' +
          Math.round(totals.calories) +
          (targets && targets.calories ? ' / ' + targets.calories : '') +
        '</span>' +
      '</div>' +
      '<div style="height:9px;background:#ede9e2;overflow:hidden">' +
        (calPct !== null ? '<div style="height:100%;width:' + calPct + '%;background:' + calColor + ';transition:width 0.4s ease"></div>' : '') +
      '</div>' +
      (calMargin ? '<div style="display:flex;justify-content:flex-end;margin-top:4px"><span style="font-size:0.55rem;color:' + calColor + ';opacity:0.6;letter-spacing:0.02em">±' + calMargin + '</span></div>' : '') +
    '</div>';

  var donutRow =
    '<div style="display:flex;gap:4px">' +
      donutChart(totals.protein, targets && targets.protein, '', 'Protein (g)', P.pro.ring,  '#f2ebe3', proRange) +
      donutChart(totals.carbs,   targets && targets.carbs,   '', 'Carbs (g)',   P.carb.ring, '#ede8d5', carbRange) +
      donutChart(totals.fat,     targets && targets.fat,     '', 'Fat (g)',     P.fat.ring,  '#e4ece4', fatRange) +
    '</div>';

  return (sectionLabel ? '<p style="font-size:0.75rem;letter-spacing:0.1em;text-transform:uppercase;color:#a09a93;margin-bottom:14px">' + sectionLabel + '</p>' : '') +
    calRow + donutRow;
}

// ── LOG FOOD TAB ──────────────────────────────────────────────────────────────
var foodInput    = document.getElementById('food-input');
var logSubmitBtn = document.getElementById('log-submit-btn');
var logError     = document.getElementById('log-error');
var pendingFlow  = null;

function renderLogDateLabel() {
  var el = document.getElementById('log-date-label');
  if (!el) return;
  var isToday = logDate === todayKey();
  var d = new Date(logDate + 'T12:00:00');
  var label = isToday ? 'Today' : d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  el.textContent = label;
  el.style.color = '#6b6560';
  var nextBtn = document.getElementById('log-date-next');
  if (nextBtn) {
    nextBtn.disabled = isToday;
    nextBtn.style.color = isToday ? '#e0dbd3' : '#c4bdb5';
    nextBtn.style.cursor = isToday ? 'default' : '';
  }
  var wrap = document.getElementById('log-today-wrap');
  if (wrap) {
    if (!isToday) {
      wrap.innerHTML = '<button id="log-goto-today" style="font-size:0.6rem;letter-spacing:0.08em;text-transform:uppercase;color:#1c1917;border-bottom:1px solid #1c1917;padding-bottom:1px;background:transparent;line-height:1.2">Go to today</button>';
      document.getElementById('log-goto-today').addEventListener('click', function() {
        logDate = todayKey();
        renderLogDateLabel();
      });
    } else {
      wrap.innerHTML = '';
    }
  }
  renderWeightLog();
}

function shiftLogDate(days) {
  var d = new Date(logDate + 'T12:00:00');
  d.setDate(d.getDate() + days);
  var shifted = d.toISOString().slice(0, 10);
  if (shifted > todayKey()) shifted = todayKey();
  logDate = shifted;
  renderLogDateLabel();
}

document.getElementById('log-date-prev').addEventListener('click', function() { shiftLogDate(-1); });
document.getElementById('log-date-next').addEventListener('click', function() { shiftLogDate(1); });

document.getElementById('log-date-change').addEventListener('click', function() {
  var picker = document.getElementById('log-date-picker');
  picker.max = todayKey();
  picker.value = logDate;
  picker.showPicker();
});

document.getElementById('log-date-picker').addEventListener('change', function() {
  if (this.value) {
    logDate = this.value;
    renderLogDateLabel();
  }
});

renderLogDateLabel();

function showLogError(msg) {
  logError.textContent = msg;
  logError.classList.remove('hidden');
  clearTimeout(logError._t);
  logError._t = setTimeout(function() { logError.classList.add('hidden'); }, 6000);
}

function setLogBtn(state) {
  var base = 'text-xs tracking-widest uppercase px-5 py-2.5 font-medium transition-all disabled:opacity-40';
  if (state === 'loading') {
    logSubmitBtn.disabled = true;
    logSubmitBtn.textContent = 'Analysing…';
    logSubmitBtn.className = base;
    logSubmitBtn.style.cssText = 'background:#1c1917;color:#f4f1ec;border-radius:1px;opacity:0.5';
  } else if (state === 'success') {
    logSubmitBtn.disabled = true;
    logSubmitBtn.textContent = '✓ Added';
    logSubmitBtn.className = base;
    logSubmitBtn.style.cssText = 'background:#2a4330;color:#f4f1ec;border-radius:1px';
    setTimeout(function() { setLogBtn('idle'); }, 2000);
  } else {
    logSubmitBtn.disabled = false;
    logSubmitBtn.textContent = 'Log Food';
    logSubmitBtn.className = base;
    logSubmitBtn.style.cssText = 'background:#1c1917;color:#f4f1ec;border-radius:1px';
  }
}


// ── Thinking modal ────────────────────────────────────────────────────────────
function renderThinkingModal(foodText) {
  var content = document.getElementById('modal-content');
  content.innerHTML =
    '<div class="flex justify-end mb-2">' +
      '<button id="thinking-close" style="color:#c4bdb5;padding:4px">' + CLOSE_ICON + '</button>' +
    '</div>' +
    '<div class="flex flex-col items-center justify-center py-8">' +
      '<div style="display:flex;align-items:flex-end;gap:5px;height:36px;margin-bottom:24px">' +
        '<div class="thinking-bar"></div>' +
        '<div class="thinking-bar"></div>' +
        '<div class="thinking-bar"></div>' +
        '<div class="thinking-bar"></div>' +
        '<div class="thinking-bar"></div>' +
      '</div>' +
      '<p id="thinking-status" style="font-size:0.75rem;letter-spacing:0.12em;text-transform:uppercase;color:#6b6560;margin-top:4px;transition:opacity 0.4s"></p>' +
    '</div>';
}

var thinkingTimers = [];

function clearThinkingTimers() {
  thinkingTimers.forEach(function(id) { clearTimeout(id); });
  thinkingTimers = [];
}

function showThinkingModal(foodText) {
  clearThinkingTimers();
  openModal(function() {
    renderThinkingModal(foodText);
    document.getElementById('thinking-close').addEventListener('click', function() {
      clearThinkingTimers();
      closeModal();
      setLogBtn('idle');
    });

    var messages = [
      'beep boop',
      'consulting the food oracle',
      'asking the nutrition gods',
      'rummaging through the pantry',
      'sending a fax to calorie HQ',
      'checking the ancient recipe scrolls',
      'bribing the database',
      'phoning a friend',
      'dusting off the nutrition textbooks',
      'asking someone who knows',
      'pinging the macro mainframe',
      'carrier pigeon is on its way back',
      'cross-referencing with grandma\'s cookbook',
      'negotiating with the algorithm',
      'reading the nutritional tea leaves',
      'dispatching a field agent',
      'rifling through old food diaries',
      'waiting for the lab results',
      'asking the chef in the back',
      'counting on our fingers',
      'running the numbers through the abacus',
      'checking under the couch cushions',
      'consulting the calorie council',
      'letting the soup cool',
      'decoding the nutrition matrix',
      'flipping through the encyclopedia',
      'asking a guy who knows a guy',
      'warming up the calorie calculator',
      'on hold with the USDA',
      'leafing through the recipe rolodex',
      'waking up the intern',
      'doing the math on a napkin',
      'checking the back of the box',
      'waiting for the microwave to finish',
      'sending a telegram to headquarters',
      'consulting the pocket nutritionist',
      'pulling strings at the data center',
      'digging through the filing cabinet',
      'squinting at the fine print',
      'getting a second opinion',
      'asking the nutritionist next door',
      're-reading the ingredients list',
      'triangulating the portion size',
      'checking with the committee',
      'running it by the board',
      'polling the panel',
      'sourcing from a trusted contact',
      'telephoning the test kitchen',
      'fetching from the mothership',
      'reviewing the field notes',
      'excavating the database',
      'making some calls',
      'waiting for the smoke signal',
      'cross-checking with the council of elders',
      'consulting the forbidden spreadsheet',
      'decrypting the nutrition label',
      'searching between the couch cushions',
      'awaiting dispatch',
      'asking the guy at the deli',
      'fact-checking the chef',
      'sending a strongly worded inquiry',
      'calling in a favor',
      'flagging down the data truck',
      'checking the almanac',
      'paging the macro department',
      'scheduling a meeting about the calories',
      'forwarding your request up the chain',
      'waiting for committee approval',
      'filing the paperwork',
      'hailing a cab to the food lab',
      'knocking on the server room door',
      'flipping a coin to check the fat content',
      'asking the vending machine',
      'letting the algorithm marinate',
      'still counting, bear with us'
    ];
    var lastMsg = null;

    function cycleMessage(instant) {
      var pool = messages.filter(function(m) { return m !== lastMsg; });
      var next = pool[Math.floor(Math.random() * pool.length)];
      lastMsg = next;
      var el = document.getElementById('thinking-status');
      if (!el) return;
      if (instant) {
        el.textContent = next;
      } else {
        el.style.opacity = '0';
        setTimeout(function() {
          var el2 = document.getElementById('thinking-status');
          if (!el2) return;
          el2.textContent = next;
          el2.style.opacity = '1';
        }, 400);
      }
      thinkingTimers.push(setTimeout(cycleMessage, 5000));
    }

    cycleMessage(true);
  });
}

function normalizeItem(e) {
  return {
    name:       e.name       || '',
    calories:   e.cal        !== undefined ? e.cal : (e.calories || 0),
    protein:    e.p          !== undefined ? e.p   : (e.protein  || 0),
    carbs:      e.c          !== undefined ? e.c   : (e.carbs    || 0),
    fat:        e.f          !== undefined ? e.f   : (e.fat      || 0),
    confidence: e.conf       || e.confidence || 'medium'
  };
}

function showEstimateModal(rawInput, clarificationAnswer) {
  setLogBtn('loading');
  showThinkingModal(rawInput);

  fetch('/api/estimate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ food: rawInput, clarification: clarificationAnswer || null })
  })
  .then(function(r) { return r.json(); })
  .then(function(data) {
    if (data.error) { clearThinkingTimers(); closeModal(); setLogBtn('idle'); showLogError('API error: ' + data.error); return; }
    var result;
    try { result = JSON.parse(extractJSON(data.text)); }
    catch (e) { clearThinkingTimers(); closeModal(); setLogBtn('idle'); showLogError('Could not parse response. Try again.'); return; }

    clearThinkingTimers();
    if (result.clarification) {
      pendingFlow.clarification = result.clarification;
      setLogBtn('idle');
      openModal(function() { renderClarifyModal(rawInput, result.clarification); });
      return;
    }
    var items = result.items ? result.items.map(normalizeItem) : [normalizeItem(result)];
    pendingFlow.estimates = items;
    pendingFlow.title     = result.title || null;
    setLogBtn('idle');
    openModal(renderConfirmModal);
  })
  .catch(function(e) { clearThinkingTimers(); closeModal(); setLogBtn('idle'); showLogError('Network error. Is the server running?'); });
}

logSubmitBtn.addEventListener('click', function() {
  var rawInput = foodInput.value.trim();
  if (!rawInput) { showLogError('Please describe what you ate.'); return; }
  pendingFlow = { rawInput: rawInput };
  showEstimateModal(rawInput, null);
});

// Auto-grow textarea
foodInput.addEventListener('input', function() {
  this.style.height = 'auto';
  this.style.height = Math.min(this.scrollHeight, 200) + 'px';
});

// Submit on Cmd/Ctrl+Enter
foodInput.addEventListener('keydown', function(e) {
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
    e.preventDefault();
    logSubmitBtn.click();
  }
});

// ── Extract JSON from a Claude response (handles code blocks) ────────────────
function extractJSON(text) {
  var block = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (block) return block[1].trim();
  var arr = text.match(/\[[\s\S]*\]/);
  var obj = text.match(/\{[\s\S]*\}/);
  if (arr && obj) return text.indexOf('[') < text.indexOf('{') ? arr[0] : obj[0];
  if (arr) return arr[0];
  if (obj) return obj[0];
  return text.trim();
}

// ── Clarify modal (single question) ──────────────────────────────────────────
function renderClarifyModal(rawInput, question) {
  var content = document.getElementById('modal-content');

  content.innerHTML =
    '<div class="flex items-center justify-between mb-5">' +
      '<h2 style="font-family:\'Cormorant Garamond\',Georgia,serif;font-size:1.5rem;font-weight:400;color:#1c1917;line-height:1">One question</h2>' +
      '<button id="clarify-close" style="color:#c4bdb5;padding:4px">' + CLOSE_ICON + '</button>' +
    '</div>' +
    '<p style="font-size:0.85rem;color:#6b6560;margin-bottom:16px;line-height:1.5">' + esc(question) + '</p>' +
    '<input type="text" id="clarify-answer" autocomplete="off" ' +
      'style="width:100%;border:1px solid #e0dbd3;border-radius:1px;padding:10px 12px;font-size:0.875rem;color:#1c1917;background:#faf8f4;outline:none;margin-bottom:16px" ' +
      'placeholder="Your answer…">' +
    '<button id="clarify-next" style="width:100%;background:#1c1917;color:#f4f1ec;border-radius:1px;padding:10px;font-size:0.65rem;letter-spacing:0.1em;text-transform:uppercase;font-weight:500;transition:all 0.15s">' +
      'Continue' +
    '</button>';

  document.getElementById('clarify-close').addEventListener('click', function() {
    closeModal(); setLogBtn('idle');
  });

  document.getElementById('clarify-next').addEventListener('click', function() {
    var answer = document.getElementById('clarify-answer').value.trim() || 'not specified';
    showEstimateModal(rawInput, answer);
  });

  document.getElementById('clarify-answer').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') document.getElementById('clarify-next').click();
  });

  setTimeout(function() {
    var inp = document.getElementById('clarify-answer');
    if (inp) inp.focus();
  }, 50);
}

// ── Confirm modal ─────────────────────────────────────────────────────────────
async function renderConfirmModal() {
  var content   = document.getElementById('modal-content');
  var estimates = pendingFlow.estimates;
  var multi     = estimates.length > 1;

  var totals = estimates.reduce(function(acc, e) {
    return {
      calories: acc.calories + (e.calories || 0),
      protein:  acc.protein  + (e.protein  || 0),
      carbs:    acc.carbs    + (e.carbs    || 0),
      fat:      acc.fat      + (e.fat      || 0)
    };
  }, { calories: 0, protein: 0, carbs: 0, fat: 0 });

  var combinedName = pendingFlow.title || estimates.map(function(e) { return e.name; }).join(' + ');

  var confStyles = {
    high:   { bg: '#e4ece4', text: '#2a4330' },
    medium: { bg: '#ede8d5', text: '#4a360a' },
    low:    { bg: '#f2ebe3', text: '#5c3018' }
  };
  var CONF_MARGIN = { high: 0.10, medium: 0.25, low: 0.45 };

  // Per-item margin sums (more accurate than applying worst-case to total)
  var calRange  = Math.round(estimates.reduce(function(s, e) { return s + e.calories * (CONF_MARGIN[e.confidence] || 0.25); }, 0));
  var proRange  = Math.round(estimates.reduce(function(s, e) { return s + e.protein  * (CONF_MARGIN[e.confidence] || 0.25); }, 0));
  var carbRange = Math.round(estimates.reduce(function(s, e) { return s + e.carbs    * (CONF_MARGIN[e.confidence] || 0.25); }, 0));
  var fatRange  = Math.round(estimates.reduce(function(s, e) { return s + e.fat      * (CONF_MARGIN[e.confidence] || 0.25); }, 0));

  // Confidence % = how much of the calorie estimate is "certain"
  var confPct   = Math.round(Math.max(0, Math.min(100, (1 - calRange / Math.max(totals.calories, 1)) * 100)));
  var confLabel = confPct >= 90 ? 'High Confidence' : confPct >= 75 ? 'Medium Confidence' : 'Low Confidence';
  // Badge colour based on pct bracket
  var worstConf = confPct >= 90 ? 'high' : confPct >= 75 ? 'medium' : 'low';

  // Total row (always shown)
  var totalSection =
    '<div class="mb-2">' +
      macroBox(Math.round(totals.calories), 'calories', P.cal.bg, P.cal.text, calRange ? '±' + calRange : '') +
    '</div>' +
    '<div class="grid grid-cols-3 gap-2 mb-4">' +
      macroBox(Math.round(totals.protein) + 'g', 'protein', P.pro.bg,  P.pro.text,  '±' + proRange  + 'g') +
      macroBox(Math.round(totals.carbs)   + 'g', 'carbs',   P.carb.bg, P.carb.text, '±' + carbRange + 'g') +
      macroBox(Math.round(totals.fat)     + 'g', 'fat',     P.fat.bg,  P.fat.text,  '±' + fatRange  + 'g') +
    '</div>';

  // Per-item breakdown (always shown)
  var itemsSection =
    '<div class="pt-3 mb-4 space-y-2" style="border-top:1px solid #e0dbd3">' +
    estimates.map(function(e) {
      return '<div class="flex items-center gap-2">' +
        '<p style="font-size:0.65rem;color:#a09a93;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(e.name) + '</p>' +
        '<div class="flex gap-1 flex-shrink-0">' +
          tinyChip(Math.round(e.calories),      P.cal.bg,  P.cal.text)  +
          tinyChip(Math.round(e.protein) + 'g', P.pro.bg,  P.pro.text)  +
          tinyChip(Math.round(e.carbs)   + 'g', P.carb.bg, P.carb.text) +
          tinyChip(Math.round(e.fat)     + 'g', P.fat.bg,  P.fat.text)  +
        '</div>' +
      '</div>';
    }).join('') +
    '</div>';

  var cs = confStyles[worstConf] || { bg: '#f3f4f6', text: '#6b7280' };

  // Day totals preview
  var confirmTargetDate = logDate;
  var [_initJournal, _initGoals] = await Promise.all([getJournal(logDate), getGoals()]);
  var existing = computeTotals(_initJournal.entries);
  var targets  = _initGoals && _initGoals.targets ? _initGoals.targets : null;

  var daySection =
    '<div class="pt-4 mb-4" style="border-top:1px solid #e0dbd3">' +
      renderDaySectionWithDelta(existing, totals, targets) +
    '</div>';

  content.innerHTML =
    '<div class="flex items-center justify-between mb-4">' +
      '<h2 style="font-family:\'Cormorant Garamond\',Georgia,serif;font-size:1.5rem;font-weight:400;color:#1c1917;line-height:1">Estimate</h2>' +
      '<div class="flex items-center gap-2">' +
        '<span style="font-size:0.6rem;letter-spacing:0.06em;text-transform:uppercase;padding:3px 8px;background:' + cs.bg + ';color:' + cs.text + ';border-radius:1px">' +
          esc(confLabel) +
        '</span>' +
        '<button id="confirm-close" style="color:#c4bdb5;padding:4px">' + CLOSE_ICON + '</button>' +
      '</div>' +
    '</div>' +
    '<p style="font-size:0.85rem;color:#6b6560;margin-bottom:16px;line-height:1.4;font-style:italic">' + esc(combinedName) + '</p>' +
    '<div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid #f0ece6">' +
      '<div style="position:relative;display:inline-block">' +
        '<button id="confirm-cal-btn" style="color:#c4bdb5;padding:4px" title="Change date">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>' +
        '</button>' +
        '<input type="date" id="confirm-date-input" max="' + todayKey() + '" value="' + logDate + '" style="position:absolute;top:0;left:0;opacity:0;width:100%;height:100%;cursor:pointer" tabindex="-1">' +
      '</div>' +
      '<span id="confirm-date-label" style="font-size:0.7rem;letter-spacing:0.05em;color:#6b6560">' + (logDate === todayKey() ? 'Today' : new Date(logDate + 'T12:00:00').toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })) + '</span>' +
    '</div>' +
    totalSection +
    itemsSection +
    '<div id="confirm-day-section">' + daySection + '</div>';

  var actions = document.getElementById('modal-actions');
  actions.innerHTML =
    '<div class="grid grid-cols-2 gap-2">' +
      '<button id="confirm-discard" style="border:1px solid #e0dbd3;color:#a09a93;border-radius:1px;padding:10px;font-size:0.65rem;letter-spacing:0.1em;text-transform:uppercase;font-weight:500;transition:all 0.15s">Discard</button>' +
      '<button id="confirm-add" style="background:#1c1917;color:#f4f1ec;border-radius:1px;padding:10px;font-size:0.65rem;letter-spacing:0.1em;text-transform:uppercase;font-weight:500;transition:all 0.15s">Add to Journal</button>' +
    '</div>';
  actions.style.display = '';

  document.getElementById('confirm-cal-btn').addEventListener('click', function() {
    document.getElementById('confirm-date-input').showPicker();
  });

  document.getElementById('confirm-date-input').addEventListener('change', async function() {
    if (!this.value) return;
    confirmTargetDate = this.value;
    var label = confirmTargetDate === todayKey() ? 'Today'
      : new Date(confirmTargetDate + 'T12:00:00').toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
    document.getElementById('confirm-date-label').textContent = label;
    var [updatedJournal, updatedGoals] = await Promise.all([getJournal(confirmTargetDate), getGoals()]);
    var updatedExisting = computeTotals(updatedJournal.entries);
    var updatedTargets  = updatedGoals && updatedGoals.targets ? updatedGoals.targets : null;
    document.getElementById('confirm-day-section').innerHTML =
      '<div class="pt-4 mb-4" style="border-top:1px solid #e0dbd3">' +
        renderDaySectionWithDelta(updatedExisting, totals, updatedTargets) +
      '</div>';
  });

  document.getElementById('confirm-close').addEventListener('click', function() {
    closeModal(); setLogBtn('idle');
  });
  document.getElementById('confirm-discard').addEventListener('click', function() {
    closeModal(); setLogBtn('idle');
  });
  document.getElementById('confirm-add').addEventListener('click', async function() {
    var estimates = pendingFlow.estimates;
    var totals = estimates.reduce(function(acc, e) {
      return {
        calories: acc.calories + (e.calories || 0),
        protein:  acc.protein  + (e.protein  || 0),
        carbs:    acc.carbs    + (e.carbs    || 0),
        fat:      acc.fat      + (e.fat      || 0)
      };
    }, { calories: 0, protein: 0, carbs: 0, fat: 0 });

    var saveMarg = { high: 0.10, medium: 0.25, low: 0.45 };
    var entry = {
      id:        generateId(),
      name:      pendingFlow.title || estimates.map(function(e) { return e.name; }).join(' + '),
      calories:  Math.round(totals.calories),
      protein:   Math.round(totals.protein),
      carbs:     Math.round(totals.carbs),
      fat:       Math.round(totals.fat),
      calRange:  Math.round(estimates.reduce(function(s, e) { return s + e.calories * (saveMarg[e.confidence] || 0.25); }, 0)),
      proRange:  Math.round(estimates.reduce(function(s, e) { return s + e.protein  * (saveMarg[e.confidence] || 0.25); }, 0)),
      carbRange: Math.round(estimates.reduce(function(s, e) { return s + e.carbs    * (saveMarg[e.confidence] || 0.25); }, 0)),
      fatRange:  Math.round(estimates.reduce(function(s, e) { return s + e.fat      * (saveMarg[e.confidence] || 0.25); }, 0)),
      createdAt: new Date().toISOString(),
      items:     estimates.map(function(e) {
        return { name: e.name, calories: Math.round(e.calories), protein: Math.round(e.protein), carbs: Math.round(e.carbs), fat: Math.round(e.fat), conf: e.confidence };
      })
    };

    var journal = await getJournal(confirmTargetDate);
    journal.entries.push(entry);
    await saveJournal(journal);
    foodInput.value = '';
    foodInput.style.height = '';
    closeModal();
    pendingFlow = null;
    viewDate = confirmTargetDate;
    switchTab('journal');
  });
}

function macroBox(value, label, bg, color, uncertainty) {
  return '<div class="p-3 text-center" style="background:' + bg + ';border-radius:1px">' +
    '<div style="display:flex;justify-content:center;align-items:baseline">' +
      '<div style="position:relative;display:inline-block">' +
        '<span style="font-size:1.1rem;font-weight:600;color:' + color + '">' + value + '</span>' +
        (uncertainty ? '<span style="position:absolute;left:100%;top:50%;transform:translateY(-50%);font-size:0.6rem;font-weight:400;color:' + color + ';opacity:0.5;white-space:nowrap;padding-left:3px">' + uncertainty + '</span>' : '') +
      '</div>' +
    '</div>' +
    '<div style="font-size:0.6rem;letter-spacing:0.08em;text-transform:uppercase;color:' + color + ';opacity:0.6;margin-top:2px">' + label + '</div>' +
  '</div>';
}

function miniChip(value, label, bg, color) {
  return '<div class="text-center py-1.5" style="background:' + bg + ';border-radius:1px">' +
    '<div style="font-size:0.7rem;font-weight:600;line-height:1;color:' + color + '">' + value + '</div>' +
    '<div style="font-size:0.55rem;letter-spacing:0.06em;text-transform:uppercase;color:' + color + ';opacity:0.55;margin-top:2px">' + label + '</div>' +
  '</div>';
}

function tinyChip(value, bg, color) {
  return '<div class="text-center py-1 px-1.5" style="background:' + bg + ';min-width:2.5rem;border-radius:1px">' +
    '<div style="font-size:0.65rem;font-weight:600;line-height:1;color:' + color + '">' + value + '</div>' +
  '</div>';
}

// ── JOURNAL TAB ───────────────────────────────────────────────────────────────
async function renderJournal() {
  var [journal, goals, allDates] = await Promise.all([getJournal(viewDate), getGoals(viewDate), getPastJournalDates()]);
  var totals  = computeTotals(journal.entries);

  // Date navigation header
  var idx      = allDates.indexOf(viewDate);
  var prevDate = allDates.slice(0, idx).filter(function(d) { return d < viewDate; }).pop() || null;
  // also check if today has entries but isn't yet in allDates
  var isToday  = viewDate === todayKey();
  var nextDate = allDates.filter(function(d) { return d > viewDate; })[0] || (!isToday ? todayKey() : null);

  var dateLabel = isToday ? 'Today' : new Date(viewDate + 'T12:00:00').toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });


  var PREV_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 18l-6-6 6-6"/></svg>';
  var NEXT_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 18l6-6-6-6"/></svg>';

  document.getElementById('journal-date').innerHTML =
    '<div class="flex items-center justify-between">' +
      '<div class="flex items-center gap-2">' +
        '<button id="journal-prev" class="p-1 transition-colors" style="color:#c4bdb5"' + (prevDate ? '' : ' disabled style="color:#e0dbd3;cursor:default"') + '>' + PREV_SVG + '</button>' +
        '<button id="journal-next" class="p-1 transition-colors" style="color:#c4bdb5"' + (nextDate ? '' : ' disabled style="color:#e0dbd3;cursor:default"') + '>' + NEXT_SVG + '</button>' +
        '<span style="font-size:0.75rem;letter-spacing:0.06em;text-transform:uppercase;color:#6b6560;font-weight:500">' + dateLabel + '</span>' +
        '<div style="position:relative;display:inline-block">' +
          '<button id="journal-cal-btn" class="p-1" style="color:#c4bdb5" title="Pick date">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>' +
          '</button>' +
          '<input type="date" id="journal-cal-input" max="' + todayKey() + '" value="' + viewDate + '" style="position:absolute;top:0;left:0;opacity:0;width:100%;height:100%;cursor:pointer" tabindex="-1">' +
        '</div>' +
      '</div>' +
      (!isToday ? '<button id="journal-today" style="font-size:0.6rem;letter-spacing:0.08em;text-transform:uppercase;color:#1c1917;border-bottom:1px solid #1c1917;padding-bottom:1px;background:transparent;line-height:1.2">Go to today</button>' : '<div></div>') +
    '</div>';

  if (prevDate) {
    document.getElementById('journal-prev').addEventListener('click', function() {
      viewDate = prevDate; renderJournal();
    });
  }
  if (nextDate) {
    document.getElementById('journal-next').addEventListener('click', function() {
      viewDate = nextDate; renderJournal();
    });
  }
  if (!isToday) {
    document.getElementById('journal-today').addEventListener('click', function() {
      viewDate = todayKey(); renderJournal();
    });
  }

  document.getElementById('journal-cal-btn').addEventListener('click', function() {
    document.getElementById('journal-cal-input').showPicker();
  });

  document.getElementById('journal-cal-input').addEventListener('change', function() {
    if (this.value) { viewDate = this.value; renderJournal(); }
  });

  // Totals card
  var totalsEl = document.getElementById('daily-totals');
  if (journal.entries.length === 0) {
    totalsEl.innerHTML = '<p class="text-sm text-gray-400 text-center py-1">No entries yet — switch to Log to add food</p>';
  } else {
    var t = goals && goals.targets ? goals.targets : null;
    var rField = { calories: 'calRange', protein: 'proRange', carbs: 'carbRange', fat: 'fatRange' };
    var eRange = function(e, k) { return e[rField[k]] !== undefined ? e[rField[k]] : Math.max(1, Math.round(e[k] * (e.margin || 0.10))); };
    var sumLow  = function(k) { return journal.entries.reduce(function(s, e) { return s + e[k] - eRange(e, k); }, 0); };
    var sumHigh = function(k) { return journal.entries.reduce(function(s, e) { return s + e[k] + eRange(e, k); }, 0); };
    totalsEl.innerHTML = renderMacroSummary(
      null, totals, t,
      sumLow('calories'), sumHigh('calories'),
      Math.round((sumHigh('protein')  - sumLow('protein'))  / 2),
      Math.round((sumHigh('carbs')    - sumLow('carbs'))    / 2),
      Math.round((sumHigh('fat')      - sumLow('fat'))      / 2)
    );
  }

  // Entry list
  var listEl = document.getElementById('entry-list');
  if (journal.entries.length === 0) {
    listEl.innerHTML =
      '<div class="text-center py-14 text-gray-300">' +
        '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" class="mx-auto mb-3">' +
          '<path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/>' +
          '<path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/>' +
        '</svg>' +
        '<p class="text-sm">Nothing logged yet today</p>' +
      '</div>';
    return;
  }

  // Reverse so newest is at top
  var entries = journal.entries.slice().reverse();
  listEl.innerHTML = entries.map(function(entry) {
    return '<div class="entry-card bg-white p-4 mb-3" style="border:1px solid #e0dbd3;border-radius:2px" data-id="' + esc(entry.id) + '">' +
      '<div class="flex justify-between items-start mb-3">' +
        '<div class="flex-1 min-w-0">' +
          '<p class="font-medium text-[#1c1917] text-sm leading-snug truncate mb-1">' + esc(entry.name) + '</p>' +
          '<p style="font-size:0.65rem;color:#a09a93">' + formatTime(entry.createdAt) + '</p>' +
        '</div>' +
        '<div class="flex items-center gap-0.5 ml-2">' +
          (function() {
            var r = entry.calRange !== undefined ? entry.calRange : Math.round(entry.calories * (entry.margin || 0.05));
            var pct = Math.round(Math.max(0, Math.min(100, (1 - r / Math.max(entry.calories, 1)) * 100)));
            var tier = pct >= 90 ? 'High conf.' : pct >= 75 ? 'Med conf.' : 'Low conf.';
            var col  = pct >= 90 ? '#2a4330' : pct >= 75 ? '#4a360a' : '#5c3018';
            var bg   = pct >= 90 ? '#e4ece4' : pct >= 75 ? '#ede8d5' : '#f2ebe3';
            return '<span style="font-size:0.6rem;letter-spacing:0.06em;text-transform:uppercase;padding:2px 6px;background:' + bg + ';color:' + col + ';border-radius:1px">' + tier + '</span>';
          })() +
          '<button class="edit-btn p-1.5 transition-colors" style="color:#c4bdb5" data-id="' + esc(entry.id) + '" title="Edit">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>' +
          '</button>' +
          '<button class="delete-btn p-1.5 transition-colors" style="color:#c4bdb5" data-id="' + esc(entry.id) + '" title="Delete">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>' +
          '</button>' +
        '</div>' +
      '</div>' +
      '<div style="margin-bottom:4px">' +
        macroChip(entry.calories,      'calories', P.cal.bg,  P.cal.text,  (entry.calRange  !== undefined ? entry.calRange  : Math.round(entry.calories * (entry.margin || 0.05)))      ) +
      '</div>' +
      '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px">' +
        macroChip(entry.protein + 'g', 'Pro',   P.pro.bg,  P.pro.text,  (entry.proRange  !== undefined ? entry.proRange  : Math.round(entry.protein  * (entry.margin || 0.05)))) +
        macroChip(entry.carbs   + 'g', 'Carbs', P.carb.bg, P.carb.text, (entry.carbRange !== undefined ? entry.carbRange : Math.round(entry.carbs    * (entry.margin || 0.05)))) +
        macroChip(entry.fat     + 'g', 'Fat',   P.fat.bg,  P.fat.text,  (entry.fatRange  !== undefined ? entry.fatRange  : Math.round(entry.fat      * (entry.margin || 0.05)))) +
      '</div>' +
      (entry.items && entry.items.length > 0
        ? '<div class="mt-3 pt-3 space-y-2" style="border-top:1px solid #f0ece6">' +
            entry.items.map(function(item) {
              return '<div class="flex items-center gap-2">' +
                '<p style="font-size:0.65rem;color:#a09a93;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(item.name) + '</p>' +
                '<div class="flex gap-1 flex-shrink-0">' +
                  tinyChip(item.calories,      P.cal.bg,  P.cal.text)  +
                  tinyChip(item.protein + 'g', P.pro.bg,  P.pro.text)  +
                  tinyChip(item.carbs   + 'g', P.carb.bg, P.carb.text) +
                  tinyChip(item.fat     + 'g', P.fat.bg,  P.fat.text)  +
                '</div>' +
              '</div>';
            }).join('') +
          '</div>'
        : '') +
    '</div>';
  }).join('');

  listEl.querySelectorAll('.edit-btn').forEach(function(btn) {
    btn.addEventListener('click', function() { openEditModal(btn.dataset.id); });
  });
  listEl.querySelectorAll('.delete-btn').forEach(function(btn) {
    btn.addEventListener('click', function() { confirmDeleteEntry(btn.dataset.id); });
  });
}

function macroChip(value, label, bg, color, uncertainty) {
  return '<div class="text-center py-2 px-1" style="background:' + bg + ';border-radius:1px">' +
    '<div style="font-size:0.85rem;font-weight:600;color:' + color + '">' + value +
      (uncertainty ? '<span style="font-weight:400;opacity:0.4;font-size:0.6rem"> ±' + uncertainty + '</span>' : '') +
      ' <span style="opacity:0.65;font-weight:400;font-size:0.65rem;letter-spacing:0.04em;text-transform:uppercase">' + label + '</span>' +
    '</div>' +
  '</div>';
}

function confirmDeleteEntry(id) {
  getJournal(viewDate).then(function(journal) {
    var entry = journal.entries.find(function(e) { return e.id === id; });
    if (!entry) return;
    openModal(function() {
      var content = document.getElementById('modal-content');
      content.innerHTML =
        '<div class="flex items-center justify-between mb-5">' +
          '<h2 style="font-family:\'Cormorant Garamond\',Georgia,serif;font-size:1.5rem;font-weight:400;color:#1c1917;line-height:1">Delete entry?</h2>' +
          '<button id="del-close" style="color:#c4bdb5;padding:4px">' + CLOSE_ICON + '</button>' +
        '</div>' +
        '<p style="font-size:0.85rem;color:#6b6560;margin-bottom:20px;line-height:1.4;font-style:italic">' + esc(entry.name) + '</p>' +
        '<div class="grid grid-cols-2 gap-2">' +
          '<button id="del-cancel" style="border:1px solid #e0dbd3;color:#a09a93;border-radius:1px;padding:10px;font-size:0.65rem;letter-spacing:0.1em;text-transform:uppercase;font-weight:500;transition:all 0.15s">Cancel</button>' +
          '<button id="del-confirm" style="background:#8b3a3a;color:#f4f1ec;border-radius:1px;padding:10px;font-size:0.65rem;letter-spacing:0.1em;text-transform:uppercase;font-weight:500;transition:all 0.15s">Delete</button>' +
        '</div>';
      document.getElementById('del-close').addEventListener('click', closeModal);
      document.getElementById('del-cancel').addEventListener('click', closeModal);
      document.getElementById('del-confirm').addEventListener('click', function() {
        deleteEntry(id);
        closeModal();
      });
    });
  });
}

async function deleteEntry(id) {
  var journal = await getJournal(viewDate);
  journal.entries = journal.entries.filter(function(e) { return e.id !== id; });
  await saveJournal(journal);
  renderJournal();
}

// ── Edit entry modal ──────────────────────────────────────────────────────────
function showEditUnsavedPrompt() {
  if (document.getElementById('edit-unsaved-prompt')) return;
  var content = document.getElementById('modal-content');
  var prompt = document.createElement('div');
  prompt.id = 'edit-unsaved-prompt';
  prompt.style.cssText = 'margin-top:16px;padding-top:16px;border-top:1px solid #e0dbd3';
  prompt.innerHTML =
    '<p style="font-size:0.7rem;letter-spacing:0.06em;text-transform:uppercase;color:#6b6560;margin-bottom:10px;text-align:center">You have unsaved changes</p>' +
    '<div class="grid grid-cols-2 gap-2">' +
      '<button id="edit-discard-btn" style="border:1px solid #e0dbd3;color:#a09a93;border-radius:1px;padding:10px;font-size:0.65rem;letter-spacing:0.1em;text-transform:uppercase;font-weight:500">Discard</button>' +
      '<button id="edit-save-from-prompt-btn" style="background:#1c1917;color:#f4f1ec;border-radius:1px;padding:10px;font-size:0.65rem;letter-spacing:0.1em;text-transform:uppercase;font-weight:500">Save Changes</button>' +
    '</div>';
  content.appendChild(prompt);
  document.getElementById('edit-discard-btn').addEventListener('click', function() {
    editModalDirty = false;
    closeModal();
  });
  document.getElementById('edit-save-from-prompt-btn').addEventListener('click', function() {
    document.getElementById('edit-save-btn').click();
  });
}

async function openEditModal(id) {
  var journal = await getJournal(viewDate);
  var entry   = journal.entries.find(function(e) { return e.id === id; });
  if (!entry) return;

  var workingItems = (entry.items && entry.items.length > 0)
    ? entry.items.map(function(it) { return { name: it.name, calories: it.calories, protein: it.protein, carbs: it.carbs, fat: it.fat, conf: it.conf || it.confidence || 'medium' }; })
    : [{ name: entry.name, calories: entry.calories, protein: entry.protein, carbs: entry.carbs, fat: entry.fat, conf: 'medium' }];

  editModalDirty = false;
  var selectedDate = viewDate;

  function formatEditDate(d) {
    return d === todayKey() ? 'Today'
      : new Date(d + 'T12:00:00').toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  }

  function computeEditTotals() {
    var rows = document.querySelectorAll('.edit-item-row');
    var totals = { calories: 0, protein: 0, carbs: 0, fat: 0 };
    rows.forEach(function(row) {
      totals.calories += parseFloat(row.querySelector('.edit-cal').value)  || 0;
      totals.protein  += parseFloat(row.querySelector('.edit-pro').value)  || 0;
      totals.carbs    += parseFloat(row.querySelector('.edit-carb').value) || 0;
      totals.fat      += parseFloat(row.querySelector('.edit-fat').value)  || 0;
    });
    return totals;
  }

  function refreshTotals() {
    var t = computeEditTotals();
    document.getElementById('edit-totals').innerHTML =
      '<div style="margin-bottom:4px">' +
        macroChip(Math.round(t.calories), 'calories', P.cal.bg, P.cal.text) +
      '</div>' +
      '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px">' +
        macroChip(Math.round(t.protein)  + 'g', 'Protein', P.pro.bg,  P.pro.text) +
        macroChip(Math.round(t.carbs)    + 'g', 'Carbs',   P.carb.bg, P.carb.text) +
        macroChip(Math.round(t.fat)      + 'g', 'Fat',     P.fat.bg,  P.fat.text) +
      '</div>';
  }

  var EDIT_CONF_STYLES = {
    high:   { bg: '#e4ece4', text: '#2a4330' },
    medium: { bg: '#ede8d5', text: '#4a360a' },
    low:    { bg: '#f2ebe3', text: '#5c3018' }
  };
  var EDIT_CONF_CYCLE = { high: 'medium', medium: 'low', low: 'high' };
  var EDIT_CONF_LABEL = { high: 'High conf.', medium: 'Med conf.', low: 'Low conf.' };

  function buildItemRowHtml(item, idx) {
    var conf = item.conf || 'medium';
    var cs = EDIT_CONF_STYLES[conf];
    return '<div class="edit-item-row" style="padding:12px 0;border-top:1px solid #f0ece6" data-idx="' + idx + '">' +
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">' +
        '<input type="text" class="edit-item-name" value="' + esc(item.name) + '" ' +
          'style="border:none;border-bottom:1px solid #e0dbd3;background:transparent;font-size:0.8rem;color:#1c1917;flex:1;min-width:0;outline:none;padding-bottom:4px" ' +
          'placeholder="Item name">' +
        '<button class="edit-conf-btn" data-conf="' + conf + '" title="Click to change confidence" ' +
          'style="flex-shrink:0;padding:2px 7px;border-radius:2px;font-size:0.6rem;letter-spacing:0.06em;text-transform:uppercase;font-weight:500;cursor:pointer;background:' + cs.bg + ';color:' + cs.text + ';border:none;white-space:nowrap">' +
          (EDIT_CONF_LABEL[conf] || conf) +
        '</button>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px">' +
        '<div>' +
          '<label style="font-size:0.6rem;letter-spacing:0.08em;text-transform:uppercase;color:#a09a93;display:block;margin-bottom:4px">Cal</label>' +
          '<input type="number" class="edit-cal" min="0" inputmode="decimal" value="' + item.calories + '" ' +
            'style="border:1px solid #e0dbd3;border-radius:1px;background:transparent;width:100%;padding:6px 8px;font-size:0.8rem;color:#1c1917;outline:none">' +
        '</div>' +
        '<div>' +
          '<label style="font-size:0.6rem;letter-spacing:0.08em;text-transform:uppercase;color:#a09a93;display:block;margin-bottom:4px">Pro</label>' +
          '<input type="number" class="edit-pro" min="0" inputmode="decimal" value="' + item.protein + '" ' +
            'style="border:1px solid #e0dbd3;border-radius:1px;background:transparent;width:100%;padding:6px 8px;font-size:0.8rem;color:#1c1917;outline:none">' +
        '</div>' +
        '<div>' +
          '<label style="font-size:0.6rem;letter-spacing:0.08em;text-transform:uppercase;color:#a09a93;display:block;margin-bottom:4px">Carb</label>' +
          '<input type="number" class="edit-carb" min="0" inputmode="decimal" value="' + item.carbs + '" ' +
            'style="border:1px solid #e0dbd3;border-radius:1px;background:transparent;width:100%;padding:6px 8px;font-size:0.8rem;color:#1c1917;outline:none">' +
        '</div>' +
        '<div>' +
          '<label style="font-size:0.6rem;letter-spacing:0.08em;text-transform:uppercase;color:#a09a93;display:block;margin-bottom:4px">Fat</label>' +
          '<input type="number" class="edit-fat" min="0" inputmode="decimal" value="' + item.fat + '" ' +
            'style="border:1px solid #e0dbd3;border-radius:1px;background:transparent;width:100%;padding:6px 8px;font-size:0.8rem;color:#1c1917;outline:none">' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  openModal(function() {
    var content = document.getElementById('modal-content');

    var initialTotals = workingItems.reduce(function(acc, it) {
      acc.calories += it.calories; acc.protein += it.protein;
      acc.carbs    += it.carbs;   acc.fat      += it.fat;
      return acc;
    }, { calories: 0, protein: 0, carbs: 0, fat: 0 });

    content.innerHTML =
      '<div class="flex items-center justify-between mb-4">' +
        '<input type="text" id="edit-meal-name" value="' + esc(entry.name) + '" ' +
          'style="font-family:\'Cormorant Garamond\',Georgia,serif;font-size:1.4rem;font-weight:400;color:#1c1917;border:none;border-bottom:1px solid #e0dbd3;background:transparent;outline:none;flex:1;min-width:0;padding-bottom:2px;line-height:1.2" ' +
          'placeholder="Meal name">' +
        '<button id="edit-close" style="color:#c4bdb5;padding:4px;margin-left:8px;flex-shrink:0">' + CLOSE_ICON + '</button>' +
      '</div>' +
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid #f0ece6">' +
        '<div style="position:relative;display:inline-block">' +
          '<button id="edit-cal-btn" style="color:#c4bdb5;padding:4px" title="Change date">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>' +
          '</button>' +
          '<input type="date" id="edit-date-input" max="' + todayKey() + '" value="' + viewDate + '" style="position:absolute;top:0;left:0;opacity:0;width:100%;height:100%;cursor:pointer" tabindex="-1">' +
        '</div>' +
        '<span id="edit-date-label" style="font-size:0.7rem;letter-spacing:0.05em;color:#6b6560">' + formatEditDate(viewDate) + '</span>' +
      '</div>' +
      '<div id="edit-totals" class="mb-4">' +
        '<div style="margin-bottom:4px">' +
          macroChip(Math.round(initialTotals.calories), 'calories', P.cal.bg, P.cal.text) +
        '</div>' +
        '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px">' +
          macroChip(Math.round(initialTotals.protein) + 'g', 'Protein', P.pro.bg,  P.pro.text) +
          macroChip(Math.round(initialTotals.carbs)   + 'g', 'Carbs',   P.carb.bg, P.carb.text) +
          macroChip(Math.round(initialTotals.fat)     + 'g', 'Fat',     P.fat.bg,  P.fat.text) +
        '</div>' +
      '</div>' +
      '<div id="edit-items-list" style="max-height:40vh;overflow-y:auto">' +
        workingItems.map(buildItemRowHtml).join('') +
      '</div>' +
      '<button id="edit-save-btn" class="w-full mt-4" style="background:#1c1917;color:#f4f1ec;border-radius:1px;padding:12px;font-size:0.65rem;letter-spacing:0.1em;text-transform:uppercase;font-weight:500">Save</button>';

    document.getElementById('edit-close').addEventListener('click', function() {
      if (editModalDirty) { showEditUnsavedPrompt(); } else { closeModal(); }
    });

    document.getElementById('edit-cal-btn').addEventListener('click', function() {
      document.getElementById('edit-date-input').showPicker();
    });

    document.getElementById('edit-date-input').addEventListener('change', function() {
      if (!this.value) return;
      selectedDate = this.value;
      editModalDirty = true;
      document.getElementById('edit-date-label').textContent = formatEditDate(selectedDate);
    });

    document.getElementById('edit-meal-name').addEventListener('input', function() {
      editModalDirty = true;
    });

    document.getElementById('edit-items-list').addEventListener('input', function(e) {
      if (e.target.matches('input')) {
        editModalDirty = true;
        if (!e.target.classList.contains('edit-item-name')) refreshTotals();
      }
    });

    document.getElementById('edit-items-list').addEventListener('click', function(e) {
      var btn = e.target.closest('.edit-conf-btn');
      if (!btn) return;
      var current = btn.getAttribute('data-conf');
      var next = EDIT_CONF_CYCLE[current] || 'medium';
      var cs = EDIT_CONF_STYLES[next];
      btn.setAttribute('data-conf', next);
      btn.textContent = EDIT_CONF_LABEL[next] || next;
      btn.style.background = cs.bg;
      btn.style.color = cs.text;
      editModalDirty = true;
    });

    document.getElementById('edit-save-btn').addEventListener('click', async function() {
      var updatedItems = [];
      document.querySelectorAll('.edit-item-row').forEach(function(row) {
        updatedItems.push({
          name:     row.querySelector('.edit-item-name').value.trim() || entry.name,
          calories: parseFloat(row.querySelector('.edit-cal').value)  || 0,
          protein:  parseFloat(row.querySelector('.edit-pro').value)  || 0,
          carbs:    parseFloat(row.querySelector('.edit-carb').value) || 0,
          fat:      parseFloat(row.querySelector('.edit-fat').value)  || 0,
          conf:     row.querySelector('.edit-conf-btn').getAttribute('data-conf') || 'medium',
        });
      });

      var totals = updatedItems.reduce(function(acc, it) {
        acc.calories += it.calories; acc.protein += it.protein;
        acc.carbs    += it.carbs;   acc.fat      += it.fat;
        return acc;
      }, { calories: 0, protein: 0, carbs: 0, fat: 0 });

      var SAVE_CONF_MARGIN = { high: 0.10, medium: 0.25, low: 0.45 };
      entry.name     = document.getElementById('edit-meal-name').value.trim() || entry.name;
      entry.items    = updatedItems;
      entry.calories = Math.round(totals.calories);
      entry.protein  = Math.round(totals.protein);
      entry.carbs    = Math.round(totals.carbs);
      entry.fat      = Math.round(totals.fat);
      entry.calRange  = Math.round(updatedItems.reduce(function(s, it) { return s + it.calories * (SAVE_CONF_MARGIN[it.conf] || 0.25); }, 0));
      entry.proRange  = Math.round(updatedItems.reduce(function(s, it) { return s + it.protein  * (SAVE_CONF_MARGIN[it.conf] || 0.25); }, 0));
      entry.carbRange = Math.round(updatedItems.reduce(function(s, it) { return s + it.carbs    * (SAVE_CONF_MARGIN[it.conf] || 0.25); }, 0));
      entry.fatRange  = Math.round(updatedItems.reduce(function(s, it) { return s + it.fat      * (SAVE_CONF_MARGIN[it.conf] || 0.25); }, 0));

      if (selectedDate === viewDate) {
        await saveJournal(journal);
      } else {
        journal.entries = journal.entries.filter(function(e) { return e.id !== id; });
        await saveJournal(journal);
        var targetJournal = await getJournal(selectedDate);
        targetJournal.entries.push(entry);
        await saveJournal(targetJournal);
        viewDate = selectedDate;
      }
      editModalDirty = false;
      closeModal();
      renderJournal();
    });
  });
}

// ── Week bar chart helper ─────────────────────────────────────────────────────
function renderWeekChart(el, title, days, overThreshold, normalColor, overColor, underPct) {
  if (!el) return;
  var unit = overThreshold <= 15 ? 'g' : '';

  var daysWithData = days.filter(function(d) { return d.value > 0 && !d.isToday; });

  if (daysWithData.length === 0) {
    el.innerHTML =
      '<p style="font-size:0.6rem;letter-spacing:0.1em;text-transform:uppercase;color:#a09a93;margin-bottom:10px">' + title + '</p>' +
      '<p style="font-size:0.75rem;color:#c4bdb5;font-style:italic">Keep logging to see weekly trends</p>';
    return;
  }
  var avg = daysWithData.length
    ? daysWithData.reduce(function(s, d) { return s + d.value; }, 0) / daysWithData.length
    : 0;

  var maxVal = Math.max.apply(null,
    days.map(function(d) { return Math.max(d.value + (d.range || 0), d.target || 0); }).concat([avg || 0, 1])
  ) * 1.2;

  var avgTopPct    = avg > 0 ? (1 - avg / maxVal) * 100 : null;

  var gridHtml = [0.25, 0.5, 0.75].map(function(p) {
    return '<div style="position:absolute;left:0;right:0;top:' + ((1-p)*100) + '%;border-top:1px solid #ede9e2;pointer-events:none"></div>';
  }).join('');

  var barsHtml = days.map(function(day) {
    var h    = day.value > 0 ? Math.max((day.value / maxVal) * 100, 3) : 0;
    var over = day.target && (underPct != null
      ? day.value < day.target * (1 - underPct)
      : day.value > day.target + overThreshold);
    var color = !day.hasData ? '#e8e4dc' : over ? overColor : normalColor;
    var show = h > 20 && days.length <= 10;

    var barPad = days.length > 10 ? '2px' : '4px';
    return '<div style="flex:1;min-width:0;display:flex;align-items:flex-end;justify-content:stretch;height:100%;padding:0 ' + barPad + '">' +
      '<div style="position:relative;width:100%;height:' + h + '%">' +
        '<div style="width:100%;height:100%;background:' + color + ';border-radius:1px 1px 0 0"></div>' +
        (day.value > 0 && show
          ? '<div style="position:absolute;bottom:4px;left:0;right:0;text-align:center;font-size:0.62rem;font-weight:600;color:rgba(255,255,255,0.85);line-height:1;letter-spacing:0.02em">' + Math.round(day.value) + '</div>'
          : '') +
      '</div>' +
    '</div>';
  }).join('');

  var errorsHtml = days.map(function(day, i) {
    if (!day.hasData || !day.range || day.range <= 0) return '';
    var low  = Math.max(0, day.value - day.range);
    var high = day.value + day.range;
    var lowTopPct  = (1 - low  / maxVal) * 100;
    var highTopPct = Math.max(0, (1 - high / maxVal) * 100);
    var centerPct  = ((i + 0.5) / days.length * 100).toFixed(1);
    var heightPct  = (lowTopPct - highTopPct).toFixed(1);
    return '<div style="position:absolute;left:' + centerPct + '%;top:' + highTopPct.toFixed(1) + '%;height:' + heightPct + '%;width:0;transform:translateX(-50%);pointer-events:none;z-index:3">' +
      '<div style="position:absolute;top:0;left:-3px;right:-3px;height:1.5px;background:rgba(0,0,0,0.25)"></div>' +
      '<div style="position:absolute;top:0;bottom:0;left:50%;width:1.5px;transform:translateX(-50%);background:rgba(0,0,0,0.25)"></div>' +
      '<div style="position:absolute;bottom:0;left:-3px;right:-3px;height:1.5px;background:rgba(0,0,0,0.25)"></div>' +
    '</div>';
  }).join('');

  var goalLine = (function() {
    var pts = days.map(function(day, i) {
      return day.target ? { x: (i + 0.5) / days.length * 100, y: (1 - day.target / maxVal) * 100 } : null;
    });
    var segments = [];
    var cur = [];
    pts.forEach(function(p) {
      if (p) { cur.push(p); }
      else if (cur.length) { segments.push(cur); cur = []; }
    });
    if (cur.length) segments.push(cur);
    if (!segments.length) return '';
    var hw = 50 / days.length;
    var elems = segments.map(function(seg) {
      if (seg.length === 1) {
        return '<line x1="' + (seg[0].x - hw) + '" y1="' + seg[0].y + '" x2="' + (seg[0].x + hw) + '" y2="' + seg[0].y + '"/>';
      }
      var d = 'M ' + seg[0].x + ',' + seg[0].y;
      for (var i = 1; i < seg.length; i++) {
        var p = seg[i - 1], q = seg[i], mx = (p.x + q.x) / 2;
        d += ' C ' + mx + ',' + p.y + ' ' + mx + ',' + q.y + ' ' + q.x + ',' + q.y;
      }
      return '<path d="' + d + '"/>';
    });
    return '<svg style="position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none;z-index:2" viewBox="0 0 100 100" preserveAspectRatio="none">' +
      '<g fill="none" stroke="#c47c2b" stroke-width="2" stroke-dasharray="4,3" vector-effect="non-scaling-stroke">' +
      elems.join('') + '</g></svg>';
  })();

  var avgText = avgTopPct !== null
    ? '<span style="position:absolute;right:2px;top:2px;font-size:0.55rem;font-weight:500;color:#a09a93;letter-spacing:0.04em;pointer-events:none;z-index:3">avg ' + Math.round(avg) + (unit || ' cal') + '</span>'
    : '';

  var avgLine = goalLine + avgText;
  var targetLine = '';

  el.innerHTML =
    '<p style="font-size:0.6rem;letter-spacing:0.1em;text-transform:uppercase;color:#a09a93;margin-bottom:14px">' + title + '</p>' +
    '<div style="position:relative;height:130px">' +
      gridHtml +
      '<div style="position:absolute;inset:0;display:flex;align-items:flex-end">' + barsHtml + '</div>' +
      errorsHtml +
      avgLine + targetLine +
    '</div>' +
    '<div style="display:flex;margin-top:8px">' +
      days.map(function(d) {
        return '<div style="flex:1;min-width:0;text-align:center;font-size:0.6rem;letter-spacing:0.06em;text-transform:uppercase;color:#a09a93;padding:0 1.5px">' + d.label + '</div>';
      }).join('') +
    '</div>';
}

// ── Weight scatter chart ──────────────────────────────────────────────────────
function renderWeightChart(el, days) {
  if (!el) return;

  var daysWithData = days.filter(function(d) { return d.hasData; });

  if (daysWithData.length === 0) {
    el.innerHTML =
      '<p style="font-size:0.6rem;letter-spacing:0.1em;text-transform:uppercase;color:#a09a93;margin-bottom:10px">Weight (lbs)</p>' +
      '<p style="font-size:0.75rem;color:#c4bdb5;font-style:italic">Keep logging to see weekly trends</p>';
    return;
  }

  var allVals = daysWithData.map(function(d) { return d.value; });
  var minVal = Math.min.apply(null, allVals);
  var maxVal = Math.max.apply(null, allVals);
  var padding = Math.max((maxVal - minVal) * 0.4, 2);
  var lo = minVal - padding;
  var hi = maxVal + padding;
  var range = hi - lo || 1;

  function yPct(v) { return (1 - (v - lo) / range) * 100; }

  var gridHtml = [0.25, 0.5, 0.75].map(function(p) {
    return '<div style="position:absolute;left:0;right:0;top:' + ((1-p)*100) + '%;border-top:1px solid #ede9e2;pointer-events:none"></div>';
  }).join('');

  var n = days.length;
  var dotsHtml = days.map(function(d, i) {
    if (!d.hasData) return '';
    var x = ((i + 0.5) / n * 100);
    var y = yPct(d.value);
    return '<div style="position:absolute;left:' + x + '%;top:' + y + '%;width:7px;height:7px;border-radius:50%;background:#6b6560;transform:translate(-50%,-50%);pointer-events:none"></div>';
  }).join('');

  el.innerHTML =
    '<p style="font-size:0.6rem;letter-spacing:0.1em;text-transform:uppercase;color:#a09a93;margin-bottom:14px">Weight (lbs)</p>' +
    '<div style="position:relative;height:130px">' +
      gridHtml + dotsHtml +
    '</div>' +
    '<div style="display:flex;margin-top:8px">' +
      days.map(function(d) {
        return '<div style="flex:1;min-width:0;text-align:center;font-size:0.6rem;letter-spacing:0.06em;text-transform:uppercase;color:#a09a93;padding:0 1.5px">' + d.label + '</div>';
      }).join('') +
    '</div>';
}

// ── GOALS TAB ─────────────────────────────────────────────────────────────────
function openTargetsModal() {
  openModal(async function() {
    var content = document.getElementById('modal-content');
    var goals = await getGoals();
    var t = goals && goals.targets ? goals.targets : {};
    content.innerHTML =
      '<div class="flex items-center justify-between mb-5">' +
        '<h2 id="targets-modal-title" style="font-family:\'Cormorant Garamond\',Georgia,serif;font-size:1.5rem;font-weight:400;color:#1c1917;line-height:1;cursor:default;user-select:none">Daily Targets</h2>' +
        '<button id="targets-close" style="color:#c4bdb5;padding:4px">' + CLOSE_ICON + '</button>' +
      '</div>' +
      '<div class="grid grid-cols-2 gap-3 mb-4">' +
        '<div>' +
          '<label class="text-xs tracking-widest uppercase text-[#a09a93] block mb-1.5">Calories</label>' +
          '<input type="number" id="modal-target-calories" min="0" inputmode="numeric" class="w-full border border-[#e0dbd3] px-3 py-2 text-sm focus:outline-none focus:border-[#1c1917] transition-colors bg-transparent" style="border-radius:1px" placeholder="2000" value="' + (t.calories || '') + '">' +
        '</div>' +
        '<div>' +
          '<label class="text-xs tracking-widest uppercase text-[#a09a93] block mb-1.5">Protein (g)</label>' +
          '<input type="number" id="modal-target-protein" min="0" inputmode="numeric" class="w-full border border-[#e0dbd3] px-3 py-2 text-sm focus:outline-none focus:border-[#1c1917] transition-colors bg-transparent" style="border-radius:1px" placeholder="150" value="' + (t.protein || '') + '">' +
        '</div>' +
        '<div>' +
          '<label class="text-xs tracking-widest uppercase text-[#a09a93] block mb-1.5">Carbs (g)</label>' +
          '<input type="number" id="modal-target-carbs" min="0" inputmode="numeric" class="w-full border border-[#e0dbd3] px-3 py-2 text-sm focus:outline-none focus:border-[#1c1917] transition-colors bg-transparent" style="border-radius:1px" placeholder="200" value="' + (t.carbs || '') + '">' +
        '</div>' +
        '<div>' +
          '<label class="text-xs tracking-widest uppercase text-[#a09a93] block mb-1.5">Fat (g)</label>' +
          '<input type="number" id="modal-target-fat" min="0" inputmode="numeric" class="w-full border border-[#e0dbd3] px-3 py-2 text-sm focus:outline-none focus:border-[#1c1917] transition-colors bg-transparent" style="border-radius:1px" placeholder="65" value="' + (t.fat || '') + '">' +
        '</div>' +
      '</div>' +
      '<button id="modal-save-targets-btn" class="w-full text-xs tracking-widest uppercase py-3 font-medium transition-all" style="background:#1c1917;color:#f4f1ec;border-radius:1px">Save Targets</button>';

    document.getElementById('targets-close').addEventListener('click', closeModal);

    var tapCount = 0;
    var tapTimer = null;
    document.getElementById('targets-modal-title').addEventListener('click', function() {
      tapCount++;
      clearTimeout(tapTimer);
      tapTimer = setTimeout(function() { tapCount = 0; }, 2000);
      var remaining = 7 - tapCount;
      if (tapCount >= 3 && remaining > 0) {
        showToast(remaining + ' more tap' + (remaining === 1 ? '' : 's') + ' to ' + (localStorage.getItem('devMode') === '1' ? 'disable' : 'enable') + ' dev mode');
      } else if (tapCount >= 7) {
        tapCount = 0;
        var enabled = localStorage.getItem('devMode') !== '1';
        localStorage.setItem('devMode', enabled ? '1' : '0');
        document.getElementById('dev-section').style.display = enabled ? '' : 'none';
        showToast('Developer mode ' + (enabled ? 'enabled' : 'disabled'));
      }
    });

    document.getElementById('modal-save-targets-btn').addEventListener('click', async function() {
      var targets = {
        calories: parseInt(document.getElementById('modal-target-calories').value, 10) || 0,
        protein:  parseInt(document.getElementById('modal-target-protein').value,  10) || 0,
        carbs:    parseInt(document.getElementById('modal-target-carbs').value,    10) || 0,
        fat:      parseInt(document.getElementById('modal-target-fat').value,      10) || 0
      };
      await saveGoals(targets);
      closeModal();
      renderGoals();
    });
  });
}

document.getElementById('goals-settings-btn').addEventListener('click', openTargetsModal);

// ── Chart range helpers ───────────────────────────────────────────────────────
async function buildRangeData(range) {
  var totalDays = range === '1m' ? 30 : range === '3m' ? 91 : range === '1y' ? 365 : 7;
  var today = new Date();
  var dateKeys = [];
  var dates = [];
  for (var i = totalDays - 1; i >= 0; i--) {
    var d = new Date(today);
    d.setDate(today.getDate() - i);
    dates.push(d);
    dateKeys.push([d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-'));
  }

  var [djList, dgList, dwList] = await Promise.all([
    Promise.all(dateKeys.map(getJournal)),
    Promise.all(dateKeys.map(getGoals)),
    Promise.all(dateKeys.map(getWeight))
  ]);

  var wRField = { calories: 'calRange', protein: 'proRange' };
  var wER = function(e, k) { return e[wRField[k]] !== undefined ? e[wRField[k]] : Math.max(1, Math.round(e[k] * (e.margin || 0.10))); };

  var dailyData = dateKeys.map(function(dk, i) {
    var dj = djList[i], dg = dgList[i], dd = dates[i];
    var tot = computeTotals(dj.entries);
    var calRange = dj.entries.reduce(function(s, e) { return s + wER(e, 'calories'); }, 0);
    var proRange = dj.entries.reduce(function(s, e) { return s + wER(e, 'protein');  }, 0);
    var wEntry = dwList[i];
    return {
      date:      dd,
      calories:  tot.calories,
      protein:   tot.protein,
      calTarget: dg && dg.targets ? dg.targets.calories : null,
      proTarget: dg && dg.targets ? dg.targets.protein  : null,
      calRange:  calRange,
      proRange:  proRange,
      hasData:   dj.entries.length > 0,
      isToday:   i === totalDays - 1,
      weight:    wEntry && wEntry.weight ? wEntry.weight : 0,
      hasWeight: !!(wEntry && wEntry.weight)
    };
  });

  function makeDayLabel(dd, i) {
    if (range === '7d') return dd.toLocaleDateString([], { weekday: 'short' });
    return '';
  }

  function bucketWeekly(data) {
    var buckets = [];
    for (var i = 0; i < data.length; i += 7) {
      var chunk = data.slice(i, i + 7);
      var withCal = chunk.filter(function(d) { return d.hasData; });
      var withWt  = chunk.filter(function(d) { return d.hasWeight; });
      var startDate = chunk[0].date;
      var label = startDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
      buckets.push({
        label:     label,
        calories:  withCal.length ? withCal.reduce(function(s,d){return s+d.calories;},0)/withCal.length : 0,
        protein:   withCal.length ? withCal.reduce(function(s,d){return s+d.protein;},0)/withCal.length  : 0,
        calTarget: chunk[chunk.length-1].calTarget,
        proTarget: chunk[chunk.length-1].proTarget,
        calRange:  withCal.length ? withCal.reduce(function(s,d){return s+d.calRange;},0)/withCal.length : 0,
        proRange:  withCal.length ? withCal.reduce(function(s,d){return s+d.proRange;},0)/withCal.length : 0,
        hasData:   withCal.length > 0,
        isToday:   chunk.some(function(d){return d.isToday;}),
        weight:    withWt.length ? withWt.reduce(function(s,d){return s+d.weight;},0)/withWt.length : 0,
        hasWeight: withWt.length > 0
      });
    }
    return buckets;
  }

  function bucketMonthly(data) {
    var map = {};
    var order = [];
    data.forEach(function(d) {
      var key = d.date.getFullYear() + '-' + d.date.getMonth();
      if (!map[key]) { map[key] = []; order.push(key); }
      map[key].push(d);
    });
    return order.map(function(key) {
      var chunk = map[key];
      var withCal = chunk.filter(function(d) { return d.hasData; });
      var withWt  = chunk.filter(function(d) { return d.hasWeight; });
      var label = chunk[0].date.toLocaleDateString([], { month: 'short' });
      return {
        label:     label,
        calories:  withCal.length ? withCal.reduce(function(s,d){return s+d.calories;},0)/withCal.length : 0,
        protein:   withCal.length ? withCal.reduce(function(s,d){return s+d.protein;},0)/withCal.length  : 0,
        calTarget: chunk[chunk.length-1].calTarget,
        proTarget: chunk[chunk.length-1].proTarget,
        calRange:  withCal.length ? withCal.reduce(function(s,d){return s+d.calRange;},0)/withCal.length : 0,
        proRange:  withCal.length ? withCal.reduce(function(s,d){return s+d.proRange;},0)/withCal.length : 0,
        hasData:   withCal.length > 0,
        isToday:   chunk.some(function(d){return d.isToday;}),
        weight:    withWt.length ? withWt.reduce(function(s,d){return s+d.weight;},0)/withWt.length : 0,
        hasWeight: withWt.length > 0
      };
    });
  }

  var buckets;
  if (range === '3m') {
    buckets = bucketWeekly(dailyData);
  } else if (range === '1y') {
    buckets = bucketMonthly(dailyData);
  } else {
    buckets = dailyData.map(function(d, i) {
      return Object.assign({}, d, { label: makeDayLabel(d.date, i) });
    });
  }

  var calDays    = buckets.map(function(b) { return { label: b.label, value: b.calories,  target: b.calTarget, hasData: b.hasData, range: b.calRange, isToday: b.isToday }; });
  var proDays    = buckets.map(function(b) { return { label: b.label, value: b.protein,   target: b.proTarget, hasData: b.hasData, range: b.proRange, isToday: b.isToday }; });
  var weightDays = buckets.map(function(b) { return { label: b.label, value: b.weight,    hasData: b.hasWeight }; });

  return { calDays: calDays, proDays: proDays, weightDays: weightDays };
}

function renderChartControls(activeRange) {
  var ranges = [
    { key: '7d', label: '7D' },
    { key: '1m', label: '1M' },
    { key: '3m', label: '3M' },
    { key: '1y', label: '1Y' }
  ];
  var btns = ranges.map(function(r) {
    var active = r.key === activeRange;
    var style = active
      ? 'background:#1c1917;color:#f4f1ec;border:1px solid #1c1917'
      : 'background:transparent;color:#6b6560;border:1px solid #e0dbd3';
    return '<button data-range="' + r.key + '" style="' + style + ';font-size:0.65rem;letter-spacing:0.1em;font-weight:500;padding:4px 10px;border-radius:1px;cursor:pointer;transition:all 0.15s">' + r.label + '</button>';
  }).join('');
  return '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">' +
    '<p style="font-size:0.6rem;letter-spacing:0.1em;text-transform:uppercase;color:#a09a93;margin:0">Progress</p>' +
    '<div style="display:flex;gap:4px">' + btns + '</div>' +
  '</div>';
}

async function renderGoals() {
  var [goals, todayJournal] = await Promise.all([getGoals(), getJournal()]);
  var totals = computeTotals(todayJournal.entries);

  // Progress card
  var progressEl = document.getElementById('goals-progress');
  if (!goals || !goals.targets) {
    progressEl.innerHTML =
      '<p class="text-sm text-gray-400 text-center py-1">Set your targets below to see progress</p>';
  } else {
    var t = goals.targets;
    var gEntries    = todayJournal.entries;
    var gRF         = { calories: 'calRange', protein: 'proRange', carbs: 'carbRange', fat: 'fatRange' };
    var gER         = function(e, k) { return e[gRF[k]] !== undefined ? e[gRF[k]] : Math.max(1, Math.round(e[k] * (e.margin || 0.10))); };
    var gSumLow  = function(k) { return gEntries.reduce(function(s, e) { return s + e[k] - gER(e, k); }, 0); };
    var gSumHigh = function(k) { return gEntries.reduce(function(s, e) { return s + e[k] + gER(e, k); }, 0); };
    progressEl.innerHTML = renderMacroSummary(
      'Today\'s Progress', totals, t,
      gSumLow('calories'), gSumHigh('calories'),
      Math.round((gSumHigh('protein')  - gSumLow('protein'))  / 2),
      Math.round((gSumHigh('carbs')    - gSumLow('carbs'))    / 2),
      Math.round((gSumHigh('fat')      - gSumLow('fat'))      / 2)
    );
  }

  // Range selector
  var controlsEl = document.getElementById('chart-controls');
  controlsEl.innerHTML = renderChartControls(currentChartRange);
  controlsEl.querySelectorAll('button[data-range]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      currentChartRange = btn.dataset.range;
      renderGoals();
    });
  });

  // Loading state
  var loadingMsg = '<p style="font-size:0.75rem;color:#c4bdb5;font-style:italic">Loading…</p>';
  document.getElementById('calorie-chart').innerHTML = loadingMsg;
  document.getElementById('protein-chart').innerHTML = loadingMsg;
  document.getElementById('weight-chart').innerHTML  = loadingMsg;

  var chartData = await buildRangeData(currentChartRange);

  renderWeekChart(
    document.getElementById('calorie-chart'),
    'Calories',
    chartData.calDays,
    100,
    P.cal.text,
    '#8b3a3a'
  );

  renderWeekChart(
    document.getElementById('protein-chart'),
    'Protein (g)',
    chartData.proDays,
    10,
    P.pro.text,
    '#8b3a3a',
    0.15
  );

  renderWeightChart(document.getElementById('weight-chart'), chartData.weightDays);
}



// ── Init ──────────────────────────────────────────────────────────────────────
switchTab('log');

document.getElementById('test-thinking-btn').addEventListener('click', function() {
  showThinkingModal('grilled chicken sandwich with fries');
});

document.getElementById('dev-copy-prompt-btn').addEventListener('click', function() {
  var btn = this;
  var food = foodInput.value.trim() || '(no food typed yet)';
  fetch('/api/prompt?food=' + encodeURIComponent(food))
    .then(function(r) { return r.json(); })
    .then(function(data) {
      var formatted = '=== SYSTEM ===\n' + data.system + '\n\n=== USER ===\n' + data.user;
      document.getElementById('dev-prompt-display').value = formatted;
      document.getElementById('dev-prompt-panel').style.display = '';
      navigator.clipboard.writeText(formatted).then(function() {
        btn.textContent = 'Copied!';
        setTimeout(function() { btn.textContent = 'Copy prompt'; }, 1500);
      }).catch(function() {
        btn.textContent = 'Copy prompt';
      });
    })
    .catch(function() {
      document.getElementById('dev-prompt-panel').style.display = '';
      document.getElementById('dev-prompt-display').value = '(error fetching prompt from server)';
    });
});

document.getElementById('dev-use-response-btn').addEventListener('click', function() {
  var raw = document.getElementById('dev-response-input').value.trim();
  var errEl = document.getElementById('dev-response-error');
  errEl.classList.add('hidden');
  errEl.textContent = '';
  if (!raw) { errEl.textContent = 'Paste a response first.'; errEl.classList.remove('hidden'); return; }
  var result;
  try { result = JSON.parse(extractJSON(raw)); }
  catch (e) { errEl.textContent = 'Could not parse JSON: ' + e.message; errEl.classList.remove('hidden'); return; }
  if (result.clarification) { errEl.textContent = 'Response contains a clarification request — paste a final answer response.'; errEl.classList.remove('hidden'); return; }
  var items = result.items ? result.items.map(normalizeItem) : [normalizeItem(result)];
  var food = foodInput.value.trim() || '(dev response)';
  pendingFlow = { rawInput: food, estimates: items, title: result.title || null };
  openModal(renderConfirmModal);
});
