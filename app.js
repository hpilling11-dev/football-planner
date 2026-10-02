/* Football Coaching Planner
   Plain JavaScript, no build tools. The drills come from data/drills.js.
   Sections in this file:
     1. Setup and helpers
     2. Saving plans in the browser
     3. Drill library (search and filters)
     4. Drill detail pop-up
     5. 6-week plan builder
     6. Suggest a session, and recommend a whole plan from a description
     7. Share links
     8. Printing, and saving as a PDF file
     9. Start-up
*/
(function () {
  'use strict';

  /* ---------- 1. Setup and helpers ---------- */

  var DRILLS = window.DRILLS || [];
  var NOTES = window.SECTION_NOTES || {};
  var RULES = window.SESSION_RULES || [];
  var WEEKS = 6;
  var STORE_KEY = 'football-planner-v1';
  var GROUP_ORDER = ['Warm-up & physical', 'Technical', 'Skill practice', 'Opposed practice', 'Game'];

  var byId = {};
  DRILLS.forEach(function (d) {
    byId[d.id] = d;
    // One lower-case string per drill so the search box can look everywhere at once.
    d._text = [d.id, d.name, d.category, d.section, d.skill, d.phase]
      .concat(d.coach.map(function (f) { return f[1]; })).join(' ').toLowerCase();
  });

  function $(id) { return document.getElementById(id); }

  // Picture address. FLAT_SITE is set by index.html when all the files sit in one folder.
  function pic(d) { return window.FLAT_SITE ? d.img.split('/').pop() : d.img; }

  // Make text safe to put into HTML.
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function lines(s) { return esc(s).replace(/\n/g, '<br>'); }
  function mins(d) { return esc(d.duration.replace('minutes', 'min')); }

  function field(d, label) {
    for (var i = 0; i < d.coach.length; i++) if (d.coach[i][0] === label) return d.coach[i][1];
    return '';
  }

  function intensityBucket(d) {
    var t = d.intensity.toLowerCase();
    if (t.indexOf('low') === 0) return 'low';
    if (t === 'moderate') return 'moderate';
    return 'high';
  }

  var toastTimer = null;
  function toast(msg) {
    var t = $('toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 2600);
  }

  /* ---------- 2. Saving plans in the browser ---------- */

  function emptyWeeks() {
    var w = [];
    for (var i = 0; i < WEEKS; i++) w.push({ focus: '', notes: '', drills: [] });
    return w;
  }
  function newPlan(title) {
    return {
      id: 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      title: title || 'New 6-week plan', start: '', length: 60, weeks: emptyWeeks()
    };
  }
  // Repair anything odd (for example a drill that has since been removed from the library).
  function tidyPlan(p) {
    var plan = newPlan(typeof p.title === 'string' ? p.title.slice(0, 80) : '');
    if (typeof p.id === 'string') plan.id = p.id;
    if (/^\d{4}-\d{2}-\d{2}$/.test(p.start || '')) plan.start = p.start;
    var len = parseInt(p.length, 10);
    if (len >= 20 && len <= 180) plan.length = len;
    (p.weeks || []).slice(0, WEEKS).forEach(function (w, i) {
      plan.weeks[i].focus = String(w.focus || '').slice(0, 80);
      plan.weeks[i].notes = String(w.notes || '').slice(0, 600);
      plan.weeks[i].drills = (w.drills || []).filter(function (id) { return byId[id]; }).slice(0, 12);
    });
    return plan;
  }
  function loadStore() {
    try {
      var s = JSON.parse(localStorage.getItem(STORE_KEY));
      if (s && Array.isArray(s.plans) && s.plans.length) {
        s.plans = s.plans.map(tidyPlan);
        return s;
      }
    } catch (e) { /* nothing saved yet, or storage is switched off */ }
    var p = newPlan('My first 6-week plan');
    return { plans: [p], currentId: p.id };
  }
  function saveStore() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); }
    catch (e) { toast('This browser would not save the plan.'); }
  }

  var store = loadStore();
  var sharedPlan = null;   // a plan opened from a share link (read-only)
  var addingWeek = null;   // week number (0-5) while "Add drills" is in progress

  function myPlan() {
    for (var i = 0; i < store.plans.length; i++) if (store.plans[i].id === store.currentId) return store.plans[i];
    store.currentId = store.plans[0].id;
    return store.plans[0];
  }
  function shownPlan() { return sharedPlan || myPlan(); }

  function weeksContaining(plan, id) {
    var out = [];
    plan.weeks.forEach(function (w, i) { if (w.drills.indexOf(id) !== -1) out.push(i + 1); });
    return out;
  }
  function updateBadge() {
    var n = 0;
    myPlan().weeks.forEach(function (w) { n += w.drills.length; });
    $('plan-count').textContent = n;
  }

  /* ---------- 3. Drill library ---------- */

  function readFilters() {
    return {
      q: $('f-search').value.trim().toLowerCase(),
      category: $('f-category').value,
      group: $('f-group').value,
      intensity: $('f-intensity').value,
      duration: parseInt($('f-duration').value, 10) || 0,
      players: parseInt($('f-players').value, 10) || 0,
      star: $('f-star').checked
    };
  }
  function matches(d, f) {
    if (f.category && d.category !== f.category) return false;
    if (f.group && d.group !== f.group) return false;
    if (f.intensity && intensityBucket(d) !== f.intensity) return false;
    if (f.duration && d.durMin > f.duration) return false;
    if (f.players && d.playersMin > f.players) return false;
    if (f.star && !d.star) return false;
    if (f.q) {
      var words = f.q.split(/\s+/);
      for (var i = 0; i < words.length; i++) if (d._text.indexOf(words[i]) === -1) return false;
    }
    return true;
  }

  function cardHtml(d) {
    var inWeeks = weeksContaining(myPlan(), d.id);
    var addLabel = addingWeek === null ? 'Add to plan' : 'Add to week ' + (addingWeek + 1);
    return '<article class="card">' +
      '<button class="card-img" data-open="' + d.id + '" aria-label="Open ' + esc(d.name) + '">' +
        '<img loading="lazy" src="' + pic(d) + '" alt="" width="' + d.imgW + '" height="' + d.imgH + '"></button>' +
      '<div class="card-body">' +
        '<p class="eyebrow">' + esc(d.category) + (d.star ? ' <span class="star" title="Favourite">★</span>' : '') + '</p>' +
        '<h2 class="card-title"><button class="linklike" data-open="' + d.id + '">' + esc(d.name) + '</button></h2>' +
        '<p class="meta">' + mins(d) + ' · ' + esc(d.intensity) + ' · ' + esc(d.group) + '</p>' +
        '<p class="meta">Skill: ' + esc(d.skill) + '</p>' +
        '<div class="card-foot">' +
          '<button class="btn small" data-add="' + d.id + '">' + addLabel + '</button>' +
          (inWeeks.length ? '<span class="in-plan">In week ' + inWeeks.join(', ') + '</span>' : '<span class="id">' + d.id + '</span>') +
        '</div>' +
      '</div></article>';
  }

  function renderLibrary() {
    var f = readFilters();
    var list = DRILLS.filter(function (d) { return matches(d, f); });
    $('drill-list').innerHTML = list.length ? list.map(cardHtml).join('')
      : '<p class="empty">No drills match those filters. Try clearing one.</p>';
    $('result-count').textContent = list.length + ' of ' + DRILLS.length + ' drills';

    // Show the section's introduction when one category is picked.
    var note = $('section-note'); note.hidden = true;
    if (f.category && list.length && NOTES[list[0].section]) {
      note.innerHTML = NOTES[list[0].section].map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('');
      note.hidden = false;
    }
    var banner = $('adding-banner');
    banner.hidden = addingWeek === null;
    if (addingWeek !== null) $('adding-week').textContent = 'week ' + (addingWeek + 1);
  }

  function addDrill(weekIndex, id) {
    var week = myPlan().weeks[weekIndex];
    if (week.drills.indexOf(id) !== -1) { toast('Already in week ' + (weekIndex + 1)); return; }
    if (week.drills.length >= 12) { toast('Week ' + (weekIndex + 1) + ' is full'); return; }
    week.drills.push(id);
    saveStore(); updateBadge(); renderLibrary(); renderPlan();
    toast('Added “' + byId[id].name + '” to week ' + (weekIndex + 1));
  }

  function weekButtonsHtml(id) {
    var plan = myPlan(), html = '';
    for (var i = 0; i < WEEKS; i++) {
      var has = plan.weeks[i].drills.indexOf(id) !== -1;
      html += '<button class="week-btn' + (has ? ' has' : '') + '" data-week-add="' + i + '" data-id="' + id + '">' +
        'Week ' + (i + 1) + (has ? ' ✓' : '') + '</button>';
    }
    return html;
  }
  function chooseWeek(id) {
    if (addingWeek !== null) { addDrill(addingWeek, id); return; }
    $('week-chooser').innerHTML =
      '<h2 class="dialog-title">Add to which week?</h2>' +
      '<p class="muted">' + esc(byId[id].name) + ' · ' + esc(myPlan().title) + '</p>' +
      '<div class="week-buttons">' + weekButtonsHtml(id) + '</div>' +
      '<button class="btn ghost" data-close>Cancel</button>';
    $('week-dialog').showModal();
  }

  /* ---------- 4. Drill detail pop-up ---------- */

  function relatedHtml(label, ids) {
    if (!ids.length) return '';
    return '<p class="related"><span>' + label + '</span> ' + ids.map(function (id) {
      return '<button class="chip-btn" data-open="' + id + '">' + esc(byId[id].name) + '</button>';
    }).join(' ') + '</p>';
  }
  function openDrill(id) {
    var d = byId[id]; if (!d) return;
    var skip = { 'Phase': 1, 'Duration': 1, 'Intensity': 1, 'Primary skill': 1 };
    var fields = d.coach.filter(function (f) { return !skip[f[0]]; }).map(function (f) {
      return '<dt>' + esc(f[0]) + '</dt><dd>' + lines(f[1]) + '</dd>';
    }).join('');
    var meta = d.meta.map(function (f) { return '<dt>' + esc(f[0]) + '</dt><dd>' + lines(f[1]) + '</dd>'; }).join('');
    $('drill-detail').innerHTML =
      '<div class="detail-head"><div>' +
        '<p class="eyebrow">' + d.id + ' · ' + esc(d.category) + '</p>' +
        '<h2 class="dialog-title">' + esc(d.name) + (d.star ? ' <span class="star">★</span>' : '') + '</h2>' +
      '</div><button class="icon-btn" data-close aria-label="Close">×</button></div>' +
      '<a class="detail-img" href="' + pic(d) + '" target="_blank" rel="noopener" title="Open the picture full size">' +
        '<img src="' + pic(d) + '" alt="Infographic for ' + esc(d.name) + '" width="' + d.imgW + '" height="' + d.imgH + '"></a>' +
      '<div class="chips">' +
        '<span class="chip">' + esc(d.duration) + '</span><span class="chip">' + esc(d.intensity) + ' intensity</span>' +
        '<span class="chip">' + esc(d.phase) + '</span><span class="chip">Skill: ' + esc(d.skill) + '</span>' +
        '<span class="chip">Goalkeeper: ' + esc(d.gk.toLowerCase()) + '</span></div>' +
      '<div class="add-row"><span class="add-label">Add to</span><div class="week-buttons">' + weekButtonsHtml(id) + '</div></div>' +
      '<dl class="fields">' + fields + '</dl>' +
      relatedHtml('Works well after', d.before) + relatedHtml('Leads on to', d.after) +
      '<details class="more"><summary>More details</summary><dl class="fields">' + meta + '</dl></details>' +
      '<div class="detail-foot"><button class="btn ghost" data-print-drill="' + id + '">Print this drill</button>' +
      '<button class="btn ghost" data-pdf-drill="' + id + '">Save as PDF</button>' +
      '<button class="btn" data-close>Close</button></div>';
    var dlg = $('drill-dialog');
    if (!dlg.open) dlg.showModal();
    dlg.scrollTop = 0;
  }

  /* ---------- 5. 6-week plan builder ---------- */

  function weekDate(plan, i) {
    if (!plan.start) return '';
    var p = plan.start.split('-');
    var dt = new Date(+p[0], +p[1] - 1, +p[2] + 7 * i);
    return dt.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  }
  function weekTotal(week) {
    var lo = 0, hi = 0;
    week.drills.forEach(function (id) { lo += byId[id].durMin; hi += byId[id].durMax; });
    return { lo: lo, hi: hi, text: lo === hi ? lo + ' min' : lo + '–' + hi + ' min' };
  }

  function weekHtml(plan, i, readOnly) {
    var w = plan.weeks[i], total = weekTotal(w), dis = readOnly ? ' disabled' : '';
    var state = !w.drills.length ? '' : (total.lo > plan.length ? ' over' : ' ok');
    var rows = w.drills.map(function (id, n) {
      var d = byId[id];
      return '<li class="plan-drill">' +
        '<div class="plan-drill-main"><button class="linklike" data-open="' + id + '">' + esc(d.name) + '</button>' +
        '<span class="meta">' + esc(d.group) + ' · ' + mins(d) + '</span></div>' +
        (readOnly ? '' : '<div class="row-actions">' +
          '<button class="icon-btn" data-act="up" data-week="' + i + '" data-i="' + n + '" aria-label="Move up"' + (n === 0 ? ' disabled' : '') + '>↑</button>' +
          '<button class="icon-btn" data-act="down" data-week="' + i + '" data-i="' + n + '" aria-label="Move down"' + (n === w.drills.length - 1 ? ' disabled' : '') + '>↓</button>' +
          '<button class="icon-btn" data-act="remove" data-week="' + i + '" data-i="' + n + '" aria-label="Remove">×</button></div>') +
        '</li>';
    }).join('');
    return '<section class="week">' +
      '<header class="week-head"><h2>Week ' + (i + 1) + '</h2>' +
        '<span class="muted">' + esc(weekDate(plan, i)) + '</span>' +
        '<span class="total' + state + '">' + (w.drills.length ? total.text.replace(' min', '') + ' / ' + plan.length + ' min' : 'Empty') + '</span></header>' +
      '<label class="field"><span>Focus</span><input type="text" list="focus-list" maxlength="80" placeholder="e.g. Receiving" ' +
        'data-field="focus" data-week="' + i + '" value="' + esc(w.focus) + '"' + dis + '></label>' +
      (rows ? '<ol class="plan-drills">' + rows + '</ol>' : '<p class="empty small">No drills yet.</p>') +
      '<label class="field"><span>Notes for coaches</span><textarea rows="2" maxlength="600" data-field="notes" data-week="' + i + '"' + dis + '>' + esc(w.notes) + '</textarea></label>' +
      '<div class="week-actions">' +
        (readOnly ? '' : '<button class="btn small" data-act="add" data-week="' + i + '">Add drills</button>' +
          '<button class="btn ghost small" data-act="suggest" data-week="' + i + '">Suggest a session</button>') +
        '<button class="btn ghost small" data-act="print" data-week="' + i + '"' + (w.drills.length ? '' : ' disabled') + '>Print</button>' +
        '<button class="btn ghost small" data-act="pdf" data-week="' + i + '"' + (w.drills.length ? '' : ' disabled') + '>PDF</button>' +
        (readOnly || !w.drills.length ? '' : '<button class="btn ghost small danger" data-act="clear" data-week="' + i + '">Clear</button>') +
      '</div></section>';
  }

  function renderPlan() {
    var plan = shownPlan(), readOnly = !!sharedPlan;
    $('shared-banner').hidden = !readOnly;
    $('plan-toolbar').hidden = readOnly;
    $('plan-select').innerHTML = store.plans.map(function (p) {
      return '<option value="' + p.id + '"' + (p.id === store.currentId ? ' selected' : '') + '>' + esc(p.title || 'Untitled plan') + '</option>';
    }).join('');
    $('btn-delete').disabled = store.plans.length < 2;
    var t = $('plan-title'), s = $('plan-start'), l = $('plan-length');
    if (document.activeElement !== t) t.value = plan.title;
    s.value = plan.start; if (document.activeElement !== l) l.value = plan.length;
    t.disabled = s.disabled = l.disabled = readOnly;
    var html = '';
    for (var i = 0; i < WEEKS; i++) html += weekHtml(plan, i, readOnly);
    $('weeks').innerHTML = html;
    updateBadge();
  }

  function onWeekClick(e) {
    var btn = e.target.closest('[data-act]'); if (!btn) return;
    var i = +btn.dataset.week, n = +btn.dataset.i, act = btn.dataset.act;
    if (act === 'print') { printPlan(shownPlan(), [i], $('print-sheets').checked); return; }
    if (act === 'pdf') { pdfPlan(shownPlan(), [i], $('print-sheets').checked); return; }
    if (sharedPlan) return;
    var week = myPlan().weeks[i], list = week.drills;
    if (act === 'up' && n > 0) list.splice(n - 1, 0, list.splice(n, 1)[0]);
    else if (act === 'down' && n < list.length - 1) list.splice(n + 1, 0, list.splice(n, 1)[0]);
    else if (act === 'remove') list.splice(n, 1);
    else if (act === 'clear') { if (!confirm('Remove all drills from week ' + (i + 1) + '?')) return; week.drills = []; }
    else if (act === 'add') {
      addingWeek = i; showView('drills'); renderLibrary(); window.scrollTo(0, 0); return;
    }
    else if (act === 'suggest') { suggestSession(i); return; }
    saveStore(); renderPlan(); renderLibrary();
  }
  function onWeekInput(e) {
    var f = e.target.dataset.field; if (!f || sharedPlan) return;
    myPlan().weeks[+e.target.dataset.week][f] = e.target.value;
    saveStore();
  }

  /* ---------- 6. Suggest a session ---------- */

  // Builds: arrival activity, a warm-up, then technical > skill > opposed practice on the
  // week's focus, finishing with a game, until the session length is used up.
  function suggestSession(i) {
    var plan = myPlan(), week = plan.weeks[i], focus = week.focus.trim().toLowerCase();
    if (!focus) { toast('Type a focus for week ' + (i + 1) + ' first, for example “Receiving”.'); return; }
    function exactMatch(d) {
      return d.category.toLowerCase().indexOf(focus) !== -1 || d.skill.toLowerCase().indexOf(focus) !== -1 ||
        d.section.toLowerCase().indexOf(focus) !== -1;
    }
    var mainDrills = DRILLS.filter(function (d) { return d.group !== 'Warm-up & physical'; });
    var pool = mainDrills.filter(exactMatch);
    // Fewer than two exact matches: fall back to any drill that mentions the focus.
    if (pool.length < 2) pool = mainDrills.filter(function (d) { return d._text.indexOf(focus) !== -1; });
    if (!pool.length) { toast('No drills found for “' + week.focus + '”. Try a category or skill name.'); return; }
    if (week.drills.length && !confirm('Replace the drills already in week ' + (i + 1) + '?')) return;

    var used = {};   // drills already used in the other weeks
    plan.weeks.forEach(function (w, k) { if (k !== i) w.drills.forEach(function (id) { used[id] = true; }); });
    var picked = [], minutes = 0;
    function fits(d) { return minutes + d.durMax <= plan.length; }
    function take(d) { if (d && picked.indexOf(d.id) === -1) { picked.push(d.id); minutes += d.durMax; return true; } return false; }
    function best(list) {   // prefer exact category matches and drills not used in other weeks
      var fresh = list.filter(function (d) { return !used[d.id] && picked.indexOf(d.id) === -1 && fits(d); });
      var any = list.filter(function (d) { return picked.indexOf(d.id) === -1 && fits(d); });
      var from = fresh.length ? fresh : any;
      return from[0];
    }
    take(byId['WU-001'] || DRILLS[0]);
    take(best(DRILLS.filter(function (d) { return d.group === 'Warm-up & physical' && d.id !== 'WU-001'; })));
    var game = best(pool.filter(function (d) { return d.group === 'Game'; })) ||
               best(DRILLS.filter(function (d) { return d.group === 'Game'; }));
    var gameTime = game ? game.durMax : 0;
    minutes += gameTime;   // keep room for the game at the end
    ['Technical', 'Skill practice', 'Opposed practice'].forEach(function (g) {
      take(best(pool.filter(function (d) { return d.group === g; })));
    });
    var extra;
    while ((extra = best(pool.filter(function (d) { return d.group !== 'Game'; }))) && picked.length < 7) take(extra);
    minutes -= gameTime;
    var first = picked.slice(0, 2), rest = picked.slice(2).sort(function (a, b) {
      return GROUP_ORDER.indexOf(byId[a].group) - GROUP_ORDER.indexOf(byId[b].group);
    });
    week.drills = first.concat(rest);
    if (game) week.drills.push(game.id);
    saveStore(); renderPlan(); renderLibrary();
    toast('Suggested a session for week ' + (i + 1) + '. Change anything you like.');
  }

  /* ---------- 6b. Recommend a plan from a description ---------- */

  var rec = { variant: 0, result: null };

  function quoteList(list) {
    return list.map(function (e) { return '“' + esc(e) + '”'; }).join(', ');
  }
  function weekList(nums) {
    if (!nums.length) return 'week 6';
    return 'week' + (nums.length > 1 ? 's ' : ' ') + nums.join(', ').replace(/, (\d+)$/, ' and $1') + ', then week 6';
  }
  function runRecommend(another) {
    var text = $('rec-text').value.trim();
    if (!text) { toast('Describe the challenges first.'); $('rec-text').focus(); return; }
    rec.variant = another ? rec.variant + 1 : 0;
    rec.result = window.Recommender.recommend(text, {
      players: parseInt($('rec-players').value, 10) || 0,
      length: parseInt($('rec-length').value, 10) || 0,
      variant: rec.variant
    });
    if (rec.result.ok) {   // show the numbers that were actually used
      $('rec-length').value = rec.result.length;
      if (rec.result.players) $('rec-players').value = rec.result.players;
    }
    renderRecommendation();
    $('rec-result').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function renderRecommendation() {
    var r = rec.result, box = $('rec-result');
    if (!r) { box.innerHTML = ''; return; }
    if (!r.ok) { box.innerHTML = '<div class="banner"><p>' + esc(r.message) + '</p></div>'; return; }
    var actions = '<div class="rec-actions"><button class="btn" data-rec="save">Save as a new plan</button>' +
      '<button class="btn ghost" data-rec="again">Show another version</button></div>';
    var html = '<h2 class="section-title">What I picked up</h2><div class="rec-themes">';
    r.themes.forEach(function (t, i) {
      html += '<div class="rec-theme"><p class="eyebrow">Priority ' + (i + 1) + ' · ' + weekList(t.weeks) + '</p>' +
        '<h3>' + esc(t.label) + '</h3><p class="meta">From ' + quoteList(t.evidence) + '</p><p>' + esc(t.why) + '</p></div>';
    });
    html += '</div>';
    var extra = [];
    if (r.later.length) extra.push('<strong>Also mentioned, kept for the next block:</strong> ' + r.later.map(function (t) { return esc(t.label); }).join('; ') + '.');
    if (r.strengths.length) extra.push('<strong>Noted as strengths, so left out:</strong> ' + r.strengths.map(function (t) { return esc(t.label); }).join('; ') + '.');
    extra.push('Sessions of ' + r.length + ' minutes' + (r.players ? ', drills that work with ' + r.players + ' players' : '') +
      (r.gentle ? ', with a gentler build-up for newer players' : '') + '.');
    html += '<p class="rec-extra">' + extra.join(' ') + '</p>' + actions + '<div class="weeks">';
    r.weeks.forEach(function (w, i) {
      var total = weekTotal(w);
      html += '<section class="week"><header class="week-head"><h2>Week ' + (i + 1) + '</h2>' +
        '<span class="chip">' + esc(w.stage) + '</span><span class="total ok">' + total.text + '</span></header>' +
        '<p class="rec-focus">' + esc(w.focus) + '</p><p class="meta">' + esc(w.notes) + '</p><ol class="plan-drills">' +
        w.drills.map(function (id) {
          var d = byId[id];
          return '<li class="plan-drill"><div class="plan-drill-main"><button class="linklike" data-open="' + id + '">' + esc(d.name) + '</button>' +
            '<span class="meta">' + esc(d.group) + ' · ' + mins(d) + '</span><span class="reason">' + esc(w.reasons[id] || '') + '</span></div></li>';
        }).join('') + '</ol></section>';
    });
    box.innerHTML = html + '</div>' + actions;
  }
  function saveRecommendation() {
    var r = rec.result; if (!r || !r.ok) return;
    var p = tidyPlan({ title: r.title, length: r.length, weeks: r.weeks });
    p.id = newPlan().id;
    store.plans.push(p); store.currentId = p.id; sharedPlan = null; addingWeek = null;
    saveStore(); showView('plan'); renderPlan(); renderLibrary(); window.scrollTo(0, 0);
    toast('Saved. Change any week you like.');
  }

  /* ---------- 7. Share links ---------- */

  // The whole plan is packed into the link, so nothing is uploaded anywhere.
  function encodePlan(plan) {
    var compact = { t: plan.title, s: plan.start, l: plan.length,
      w: plan.weeks.map(function (w) { return [w.focus, w.notes, w.drills]; }) };
    var b64 = btoa(unescape(encodeURIComponent(JSON.stringify(compact))));
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function decodePlan(code) {
    try {
      var b64 = code.replace(/-/g, '+').replace(/_/g, '/');
      while (b64.length % 4) b64 += '=';
      var c = JSON.parse(decodeURIComponent(escape(atob(b64))));
      return tidyPlan({ title: c.t, start: c.s, length: c.l,
        weeks: (c.w || []).map(function (w) { return { focus: w[0], notes: w[1], drills: w[2] }; }) });
    } catch (e) { return null; }
  }
  function shareLink(plan) {
    return location.href.split('#')[0] + '#plan=' + encodePlan(plan);
  }
  function sharePlan() {
    var plan = shownPlan(), url = shareLink(plan);
    // On phones and tablets use the built-in share sheet; elsewhere copy the link.
    if (navigator.share && window.matchMedia && window.matchMedia('(pointer: coarse)').matches) {
      navigator.share({ title: plan.title, text: plan.title, url: url }).catch(function () {});
      return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function () { toast('Link copied. Paste it into a message to the coaches.'); },
        function () { prompt('Copy this link:', url); });
    } else { prompt('Copy this link:', url); }
  }
  function readHash() {
    var m = location.hash.match(/^#plan=(.+)$/);
    if (!m) return false;
    var plan = decodePlan(m[1]);
    if (!plan) { toast('That share link could not be read.'); return false; }
    sharedPlan = plan; addingWeek = null;
    showView('plan'); renderPlan();
    return true;
  }
  function clearHash() {
    if (history.replaceState) history.replaceState(null, '', location.href.split('#')[0]);
    else location.hash = '';
  }

  /* ---------- 8. Printing ---------- */

  function printPlan(plan, weekIndexes, withSheets) {
    var seen = {}, sheets = [], html = '<h1>' + esc(plan.title) + '</h1>';
    weekIndexes.forEach(function (i) {
      var w = plan.weeks[i], total = weekTotal(w), date = weekDate(plan, i);
      html += '<section class="p-week"><h2>Week ' + (i + 1) + (w.focus ? ' — ' + esc(w.focus) : '') +
        (date ? ' <small>' + esc(date) + '</small>' : '') + '</h2>';
      if (!w.drills.length) { html += '<p>No drills chosen.</p></section>'; return; }
      html += '<table><thead><tr><th>#</th><th>Drill</th><th>Time</th><th>Coaching points</th></tr></thead><tbody>';
      w.drills.forEach(function (id, n) {
        var d = byId[id];
        html += '<tr><td>' + (n + 1) + '</td><td><strong>' + esc(d.name) + '</strong><br>' + d.id + ' · ' + esc(d.group) +
          '</td><td>' + esc(d.duration) + '</td><td>' + lines(field(d, 'Coaching points')) + '</td></tr>';
        if (!seen[id]) { seen[id] = true; sheets.push(d); }
      });
      html += '</tbody></table><p class="p-total">Total: ' + total.text + '</p>' +
        (w.notes ? '<p class="p-notes"><strong>Notes:</strong> ' + lines(w.notes) + '</p>' : '') + '</section>';
    });
    if (withSheets) sheets.forEach(function (d) { html += drillSheetHtml(d); });
    doPrint(html);
  }
  function drillSheetHtml(d) {
    var skip = { 'Phase': 1, 'Duration': 1, 'Intensity': 1, 'Primary skill': 1, 'Secondary skills': 1 };
    return '<section class="p-sheet"><h2>' + esc(d.name) + ' <small>' + d.id + '</small></h2>' +
      '<p class="p-facts">' + esc(d.phase) + ' · ' + esc(d.duration) + ' · ' + esc(d.intensity) + ' intensity · Skill: ' + esc(d.skill) + '</p>' +
      '<img src="' + pic(d) + '" alt="">' +
      '<dl>' + d.coach.filter(function (f) { return !skip[f[0]]; }).map(function (f) {
        return '<dt>' + esc(f[0]) + '</dt><dd>' + lines(f[1]) + '</dd>';
      }).join('') + '</dl></section>';
  }
  function doPrint(html) {
    var root = $('print-root');
    root.innerHTML = html;
    // Wait for the pictures before opening the print window.
    var imgs = Array.prototype.slice.call(root.querySelectorAll('img'));
    Promise.all(imgs.map(function (img) {
      return img.complete ? null : new Promise(function (done) { img.onload = img.onerror = done; });
    })).then(function () { window.print(); });
  }

  /* ---------- 8b. Saving as a PDF file ---------- */
  // The PDF itself is built by js/pdf.js; here we just gather what goes into it.

  function safeFileName(s) {
    return String(s).replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Training plan';
  }
  function sheetData(d) {
    var skip = { 'Phase': 1, 'Duration': 1, 'Intensity': 1, 'Primary skill': 1, 'Secondary skills': 1 };
    return { title: d.name,
      facts: d.id + ' · ' + d.phase + ' · ' + d.duration + ' · ' + d.intensity + ' intensity · Skill: ' + d.skill,
      img: pic(d), imgW: d.imgW, imgH: d.imgH,
      fields: d.coach.filter(function (f) { return !skip[f[0]]; }) };
  }
  function makePdf(data, name) {
    if (!window.PlanPdf) { toast('The PDF maker (pdf.js) has not been uploaded.'); return; }
    toast('Making the PDF…');
    window.PlanPdf.save(data, name).then(function (res) {
      toast(res.missingPictures ? 'PDF saved without pictures. Use the online site to include them.'
        : 'PDF saved. Look in your Downloads folder.');
    }, function () { toast('Sorry, the PDF could not be made.'); });
  }
  function pdfPlan(plan, weekIndexes, withSheets) {
    var seen = {}, sheets = [], weeks = [];
    weekIndexes.forEach(function (i) {
      var w = plan.weeks[i], total = weekTotal(w);
      weeks.push({ heading: 'Week ' + (i + 1) + (w.focus ? ' – ' + w.focus : ''), date: weekDate(plan, i),
        rows: w.drills.map(function (id) {
          var d = byId[id];
          if (!seen[id]) { seen[id] = true; sheets.push(sheetData(d)); }
          return { name: d.name, sub: d.id + ' · ' + d.group, time: d.duration.replace('minutes', 'min'), points: field(d, 'Coaching points') };
        }),
        total: w.drills.length ? 'Total: ' + total.text + ' (session length ' + plan.length + ' min)' : '', notes: w.notes });
    });
    var one = weekIndexes.length === 1;
    makePdf({ title: plan.title || 'Training plan',
      subtitle: (one ? 'Week ' + (weekIndexes[0] + 1) + ' of 6' : '6-week plan') + ' · sessions of ' + plan.length + ' minutes' +
        (!one && plan.start ? ' · first session ' + weekDate(plan, 0) : ''),
      weeks: weeks, sheets: withSheets ? sheets : [], footer: 'Football Coaching Planner' },
      safeFileName(plan.title || 'Training plan') + (one ? ' - week ' + (weekIndexes[0] + 1) : '') + '.pdf');
  }
  function pdfDrill(id) {
    var d = byId[id];
    makePdf({ weeks: [], sheets: [sheetData(d)], footer: 'Football Coaching Planner' }, safeFileName(d.id + ' ' + d.name) + '.pdf');
  }

  /* ---------- 9. Start-up ---------- */

  function showView(name) {
    ['drills', 'recommend', 'plan'].forEach(function (v) { $('view-' + v).hidden = v !== name; });
    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (t) {
      t.classList.toggle('is-active', t.dataset.view === name);
    });
  }

  function fillSelect(sel, values) {
    values.forEach(function (v) {
      var n = DRILLS.filter(function (d) { return d.category === v || d.group === v; }).length;
      var o = document.createElement('option'); o.value = v; o.textContent = v + ' (' + n + ')'; sel.appendChild(o);
    });
  }

  function init() {
    var cats = [], skills = [];
    DRILLS.forEach(function (d) {
      if (cats.indexOf(d.category) === -1) cats.push(d.category);
      if (skills.indexOf(d.skill) === -1) skills.push(d.skill);
    });
    fillSelect($('f-category'), cats);
    fillSelect($('f-group'), GROUP_ORDER);
    $('focus-list').innerHTML = cats.concat(skills.sort()).map(function (v) { return '<option value="' + esc(v) + '">'; }).join('');
    $('rules-list').innerHTML = RULES.map(function (r) { return '<li>' + esc(r) + '</li>'; }).join('');

    // Tabs
    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (t) {
      t.addEventListener('click', function () {
        if (t.dataset.view === 'plan') addingWeek = null;
        showView(t.dataset.view); renderLibrary(); renderPlan();
      });
    });

    // Filters
    ['f-search', 'f-category', 'f-group', 'f-intensity', 'f-duration', 'f-players', 'f-star'].forEach(function (id) {
      $(id).addEventListener('input', renderLibrary);
    });
    $('f-clear').addEventListener('click', function () {
      ['f-search', 'f-category', 'f-group', 'f-intensity', 'f-duration', 'f-players'].forEach(function (id) { $(id).value = ''; });
      $('f-star').checked = false; renderLibrary();
    });
    $('btn-adding-done').addEventListener('click', function () { addingWeek = null; showView('plan'); renderLibrary(); renderPlan(); });

    // Clicks anywhere: open a drill, add a drill, choose a week, close a pop-up.
    document.addEventListener('click', function (e) {
      var t = e.target.closest('[data-open],[data-add],[data-week-add],[data-close],[data-print-drill],[data-pdf-drill]');
      if (!t) return;
      if (t.dataset.open) { openDrill(t.dataset.open); }
      else if (t.dataset.add) { chooseWeek(t.dataset.add); }
      else if (t.dataset.weekAdd !== undefined) {
        addDrill(+t.dataset.weekAdd, t.dataset.id);
        if ($('week-dialog').open) $('week-dialog').close();
        if ($('drill-dialog').open) openDrill(t.dataset.id);
      }
      else if (t.dataset.printDrill) { doPrint(drillSheetHtml(byId[t.dataset.printDrill])); }
      else if (t.dataset.pdfDrill) { pdfDrill(t.dataset.pdfDrill); }
      else if (t.hasAttribute('data-close')) { t.closest('dialog').close(); }
    });
    ['drill-dialog', 'week-dialog'].forEach(function (id) {
      $(id).addEventListener('click', function (e) { if (e.target === $(id)) $(id).close(); });
    });

    // Plan toolbar
    $('plan-select').addEventListener('change', function (e) { store.currentId = e.target.value; saveStore(); renderPlan(); renderLibrary(); });
    $('btn-new').addEventListener('click', function () {
      var p = newPlan('New 6-week plan'); store.plans.push(p); store.currentId = p.id;
      saveStore(); renderPlan(); renderLibrary(); $('plan-title').focus(); $('plan-title').select();
    });
    $('btn-copy').addEventListener('click', function () {
      var p = tidyPlan(JSON.parse(JSON.stringify(myPlan())));
      p.id = newPlan().id; p.title = (p.title + ' (copy)').slice(0, 80);
      store.plans.push(p); store.currentId = p.id; saveStore(); renderPlan(); renderLibrary(); toast('Plan duplicated');
    });
    $('btn-delete').addEventListener('click', function () {
      if (store.plans.length < 2 || !confirm('Delete “' + myPlan().title + '”? This cannot be undone.')) return;
      store.plans = store.plans.filter(function (p) { return p.id !== store.currentId; });
      store.currentId = store.plans[0].id; saveStore(); renderPlan(); renderLibrary();
    });
    $('plan-title').addEventListener('input', function (e) {
      if (sharedPlan) return;
      myPlan().title = e.target.value; saveStore();
      var o = $('plan-select').selectedOptions[0]; if (o) o.textContent = e.target.value || 'Untitled plan';
    });
    $('plan-start').addEventListener('change', function (e) { if (sharedPlan) return; myPlan().start = e.target.value; saveStore(); renderPlan(); });
    $('plan-length').addEventListener('change', function (e) {
      if (sharedPlan) return;
      var v = Math.min(180, Math.max(20, parseInt(e.target.value, 10) || 60));
      myPlan().length = v; e.target.value = v; saveStore(); renderPlan();
    });
    $('weeks').addEventListener('click', onWeekClick);
    $('weeks').addEventListener('input', onWeekInput);

    // Recommend a plan
    $('rec-length').value = myPlan().length;
    $('btn-recommend').addEventListener('click', function () { runRecommend(false); });
    $('rec-examples').addEventListener('click', function (e) {
      var b = e.target.closest('[data-example]'); if (!b) return;
      var box = $('rec-text');
      box.value = (box.value.trim() ? box.value.trim() + ' ' : '') + b.dataset.example;
      box.focus();
    });
    $('rec-result').addEventListener('click', function (e) {
      var b = e.target.closest('[data-rec]'); if (!b) return;
      if (b.dataset.rec === 'save') saveRecommendation(); else runRecommend(true);
    });

    // Share and print
    $('btn-share').addEventListener('click', sharePlan);
    $('btn-print').addEventListener('click', function () {
      printPlan(shownPlan(), [0, 1, 2, 3, 4, 5], $('print-sheets').checked);
    });
    $('btn-pdf').addEventListener('click', function () {
      pdfPlan(shownPlan(), [0, 1, 2, 3, 4, 5], $('print-sheets').checked);
    });
    $('btn-save-shared').addEventListener('click', function () {
      var p = sharedPlan; p.id = newPlan().id;
      store.plans.push(p); store.currentId = p.id; sharedPlan = null;
      saveStore(); clearHash(); renderPlan(); renderLibrary(); toast('Saved to your plans');
    });
    $('btn-exit-shared').addEventListener('click', function () { sharedPlan = null; clearHash(); renderPlan(); renderLibrary(); });
    window.addEventListener('hashchange', readHash);
    window.addEventListener('afterprint', function () { $('print-root').innerHTML = ''; });

    renderLibrary(); renderPlan();
    readHash();
  }

  init();
})();
