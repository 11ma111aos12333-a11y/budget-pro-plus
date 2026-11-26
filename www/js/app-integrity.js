/* Budget Pro+ — data integrity & "where did my entry go?" fixes (v1.0.9)
   - Quick entry: tells you exactly where the amount went + "عرض في الجدول" jumps to the cell and highlights it
   - Table: opens the current month on TODAY's week, highlights today, tiles show spent / current month / carried savings
   - Undo (تراجع) for every destructive action + confirmation before deleting data
   - Start date change keeps every amount on its real calendar date
   - Recurring expenses: applied once per occurrence when the date arrives (never resurrected / never in the future)
   - Safe category ids, no negative amounts in cells, AI delete-month can't scramble months
*/
(function () {
  'use strict';
  var W = window, BP = W.BP = W.BP || {};
  function $(id) { return document.getElementById(id); }
  function wrap(name, after, before) {
    var orig = W[name]; if (typeof orig !== 'function') return;
    W[name] = function () {
      if (before && before.apply(this, arguments) === false) return;
      var r = orig.apply(this, arguments);
      try { if (after) after.apply(this, [r].concat([].slice.call(arguments))); } catch (e) { console.warn('[BPI] ' + name, e); }
      return r;
    };
    W[name]._orig = orig;
  }
  function ops(n) { return n === 1 ? 'عملية واحدة' : n === 2 ? 'عمليتين' : (n <= 10 ? n + ' عمليات' : n + ' عملية'); }
  function cur() { return ' ' + (appData.currencySymbol || ''); }
  function money(n) { return fmt(Math.round((Number(n) || 0) * 100) / 100) + cur(); }
  function catName(t) {
    if (t === 'i') return '💰 دخل';
    var c = (appData.categories || []).find(function (x) { return x.id === t; });
    return c ? ((c.icon || '') + ' ' + c.name) : t;
  }
  function dayLabel(m, d) {
    try { return getDayDate(m, d - 1).toLocaleDateString('ar-EG-u-ca-gregory', { weekday: 'long', day: 'numeric', month: 'long' }); }
    catch (e) { return 'يوم ' + d; }
  }
  function curMonthIdx() {
    var st = _startDate(), now = new Date();
    return (now.getFullYear() - st.getFullYear()) * 12 + (now.getMonth() - st.getMonth());
  }
  function rerenderAll() {
    ['renderDashboard', 'renderTable', 'renderSettings', 'renderCategoryList', 'renderRecurringList', 'renderCharts', 'renderPTChips'].forEach(function (f) {
      try { if (typeof W[f] === 'function') W[f](); } catch (e) {}
    });
    var mc = $('month-count-display'); if (mc) mc.textContent = appData.months;
    var sd = $('start-date-input'); if (sd) sd.value = appData.startDate;
  }
  BP.rerenderAll = rerenderAll;

  /* ---------------- snackbar (tappable, unlike toasts) ---------------- */
  var snackTimer = 0;
  function snack(msg, actionLabel, action, ms) {
    var el = $('bp-snack');
    if (!el) {
      el = document.createElement('div'); el.id = 'bp-snack'; el.setAttribute('role', 'status');
      el.innerHTML = '<span class="bs-msg"></span><button class="bs-act" type="button"></button><button class="bs-x" type="button" aria-label="إغلاق">✕</button>';
      document.body.appendChild(el);
      el.querySelector('.bs-x').onclick = hideSnack;
    }
    el.querySelector('.bs-msg').textContent = msg;
    var b = el.querySelector('.bs-act');
    if (actionLabel) {
      b.style.display = ''; b.textContent = actionLabel;
      b.onclick = function () { hideSnack(); try { action(); } catch (e) { console.warn(e); } };
    } else b.style.display = 'none';
    el.classList.add('show');
    clearTimeout(snackTimer); snackTimer = setTimeout(hideSnack, ms || 6000);
  }
  function hideSnack() { var el = $('bp-snack'); if (el) el.classList.remove('show'); clearTimeout(snackTimer); }
  BP.snack = snack; BP.hideSnack = hideSnack;

  /* ---------------- undo ---------------- */
  function snapshot() { return JSON.stringify(appData); }
  function restore(json) {
    try {
      var data = JSON.parse(json);
      Object.keys(appData).forEach(function (k) { if (!(k in data)) delete appData[k]; });
      Object.assign(appData, data);
      saveData(); rerenderAll();
      if (typeof showToast === 'function') showToast('↩️ تم التراجع — رجعت بياناتك زي ما كانت', 'success');
    } catch (e) { console.warn(e); }
  }
  function withUndo(label, fn) {
    var snap = snapshot(), r = fn();
    if (snapshot() !== snap) snack(label, '↩️ تراجع', function () { restore(snap); }, 8000);
    return r;
  }
  BP.withUndo = withUndo;

  /* ---------------- modal: real confirm vs info-only ---------------- */
  wrap('showModal', function (r, icon, title, msg, onConfirm, onCancel) {
    var box = $('modal-overlay'); if (!box) return;
    var cancel = box.querySelector('.cancel-btn'), ok = $('modal-confirm');
    var info = !onConfirm && !onCancel;
    if (cancel) cancel.style.display = info ? 'none' : '';
    if (ok) {
      ok.textContent = info ? 'حسناً' : (BP._okLabel || 'تأكيد');
      ok.classList.toggle('bp-danger', !!BP._okDanger);
    }
    BP._okLabel = null; BP._okDanger = false;
  });
  function confirmBox(icon, title, msg, okLabel, onOk, danger, onCancel) {
    BP._okLabel = okLabel; BP._okDanger = !!danger;
    showModal(icon, title, msg, onOk, onCancel || function () {});
  }

  /* ---------------- helpers about data ---------------- */
  var KEY = /^m(\d+)-d(\d+)-(.+)$/;
  function monthData(m) {
    var n = 0, sum = 0;
    Object.keys(appData.records || {}).forEach(function (k) {
      var x = KEY.exec(k); if (!x || +x[1] !== m) return;
      var v = parseFloat(appData.records[k]) || 0; if (v) { n++; sum += x[3] === 'i' ? 0 : v; }
    });
    return { n: n, spent: sum };
  }
  function catData(id) {
    var n = 0, sum = 0;
    Object.keys(appData.records || {}).forEach(function (k) {
      var x = KEY.exec(k); if (!x || x[3] !== id) return;
      var v = parseFloat(appData.records[k]) || 0; if (v) { n++; sum += v; }
    });
    return { n: n, sum: sum };
  }

  /* =========== 1) QUICK ENTRY: say where it went + jump there =========== */
  W.saveQuickEntry = function () {
    var ov = $('quick-entry-overlay'); if (ov && !ov.classList.contains('show')) return; // 2nd tap of a double-tap while the sheet is closing
    var raw = String(($('quick-entry-amount') || {}).value || '').replace(/[٠-٩]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(d); }).replace(',', '.');
    var amount = Number(raw);
    var type = ($('quick-entry-type') || {}).value || 'expense';
    var date = ($('quick-entry-date') || {}).value || '';
    var category = ($('quick-entry-category') || {}).value || '';
    var note = (($('quick-entry-note') || {}).value || '').trim().slice(0, 120);
    if (!Number.isFinite(amount) || amount <= 0) { showToast('أدخل مبلغًا صحيحًا أكبر من صفر', 'error'); return; }
    if (amount > 1e9) { showToast('المبلغ كبير جدًا', 'error'); return; }
    var slot = getPlanSlotForDate(date);
    if (!slot) { showToast('التاريخ ده برا مدة خطتك (من الإعدادات تقدر تغيّر تاريخ البدء أو عدد الأشهر)', 'error'); return; }
    var field = type === 'income' ? 'i' : category;
    if (!field) { showToast('اختر فئة المصروف', 'error'); return; }
    var prevVal = getVal(slot.m, slot.d, field);
    var newVal = Math.round((prevVal + amount) * 100) / 100;
    setRec(slot.m, slot.d, field, newVal);
    var key = 'm' + slot.m + '-d' + slot.d + '-' + field;
    if (note) appData.notes[key] = (prevVal > 0 && appData.notes[key]) ? (appData.notes[key] + ' • ' + note).slice(0, 200) : note;
    appData.smartEntryCount = (Number(appData.smartEntryCount) || 0) + 1;
    saveData();
    closeQuickEntry();
    refreshViews();
    snack('✓ اتسجّل ' + money(amount) + ' في «' + catName(field) + '» — ' + dayLabel(slot.m, slot.d) + (prevVal > 0 ? ' (إجمالي اليوم ' + money(newVal) + ')' : ''),
      '📋 عرض في الجدول', function () { reveal(slot.m, slot.d, field); }, 7000);
    if (BP.haptic) try { BP.haptic('success'); } catch (e) {}
  };

  // Jump to the table → month → week of that day → highlight the cell
  function reveal(m, d, t) {
    BP._reveal = { m: m, d: d, t: t };
    var go = function () {
      if (typeof _pt !== 'undefined' && _pt) { requestAnimationFrame(go); return; }
      expandMonth(m);
    };
    if (currentPage !== 'table') switchPage('table');
    go();
  }
  BP.reveal = reveal;

  /* =========== 2) TABLE: open on today's week, highlight today / the revealed cell =========== */
  // Pick the week BEFORE the first render (one render instead of two)
  W.expandMonth = (function (orig) {
    var f = function (m) {
      var rv = BP._reveal && BP._reveal.m === m ? BP._reveal : null;
      var target = rv ? rv.d : (m === curMonthIdx() ? new Date().getDate() : 0);
      BP._pendWeek = target ? Math.floor((target - 1) / 7) : null;
      var r = orig.apply(this, arguments);
      BP._pendWeek = null;
      if (rv) { BP._reveal = null; flashCell(rv); }
      return r;
    };
    f._orig = orig; return f;
  })(W.expandMonth);
  W.renderExpandedMonth = (function (orig) {
    var f = function () { if (BP._pendWeek != null) { currentWeekIdx = BP._pendWeek; BP._pendWeek = null; } return orig.apply(this, arguments); };
    f._orig = orig; return f;
  })(W.renderExpandedMonth);

  // calcMonthData memo while the tiles are being built (the tile decorator reuses the numbers)
  var mdMemo = null;
  W.calcMonthData = (function (orig) {
    var f = function (m) { if (mdMemo) { if (!mdMemo[m]) mdMemo[m] = orig.apply(this, arguments); return mdMemo[m]; } return orig.apply(this, arguments); };
    f._orig = orig; return f;
  })(W.calcMonthData);
  W.renderTable = (function (orig) {
    var f = function () { mdMemo = {}; try { return orig.apply(this, arguments); } finally { BP._tileMemo = mdMemo; mdMemo = null; } };
    f._orig = orig; return f;
  })(W.renderTable);

  wrap('renderExpandedMonth', function () {
    var m = expandedMonthIdx; if (m < 0) return;
    var view = $('expanded-month-view'); if (!view) return;
    if (m === curMonthIdx()) {
      var td = new Date().getDate();
      var inp = view.querySelector('.day-table input[data-d="' + td + '"]');
      if (inp) { var tr = inp.closest('tr'); if (tr) { tr.classList.add('bp-today'); tr.style.opacity = ''; } }
    }
  });
  function flashCell(rv) {
    setTimeout(function () {
      var cell = document.querySelector('#expanded-month-view .day-table input[data-d="' + rv.d + '"][data-t="' + rv.t + '"]');
      if (!cell) return;
      try { cell.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' }); } catch (e) { cell.scrollIntoView(); }
      var tdEl = cell.closest('td'); if (!tdEl) return;
      tdEl.classList.remove('bp-flash'); void tdEl.offsetWidth; tdEl.classList.add('bp-flash');
      setTimeout(function () { tdEl.classList.remove('bp-flash'); }, 2700);
    }, 60);
  }

  // Tiles: spent, "current month" badge, ended months show the saving that rolled over (not a fake "remaining")
  wrap('renderTable', function () {
    var tiles = document.querySelectorAll('#month-tiles-container .month-tile'); var cm = curMonthIdx();
    for (var m = 0; m < tiles.length; m++) {
      var t = tiles[m], md = (BP._tileMemo && BP._tileMemo[m]) || calcMonthData(m);
      var al = t.querySelector('.mt-allocation');
      if (al) al.insertAdjacentHTML('afterend', '<div class="mt-spent">المصروف: ' + fmt(Math.round(md.totalSpent * 100) / 100) + (md.totalIncome > 0 ? ' · الدخل: ' + fmt(Math.round(md.totalIncome * 100) / 100) : '') + '</div>');
      if (m === cm) { t.classList.add('is-current'); t.insertAdjacentHTML('afterbegin', '<div class="mt-now">📍 الشهر الحالي</div>'); }
      if (m < cm) {
        t.classList.add('is-past');
        var rem = t.querySelector('.mt-remaining');
        if (rem && md.remaining > 0.004) { rem.className = 'mt-remaining pos'; rem.textContent = '✓ وفّرت ' + fmt(Math.round(md.remaining * 100) / 100) + ' ↪ اترحّلت للشهور الجاية'; }
      }
    }
  });

  // Recent transactions → tap to open that exact cell
  wrap('renderRecentTransactions', function () {
    var list = $('recent-list'); if (!list) return;
    var cats = appData.categories || [], entries = [];
    for (var m = 0; m < appData.months; m++) {
      var days = getDaysInMonth(m);
      for (var d = 1; d <= days; d++) {
        var date = getDayDate(m, d - 1);
        if (getVal(m, d, 'i') > 0) entries.push({ m: m, d: d, t: 'i', date: date });
        cats.forEach(function (c) { if (getVal(m, d, c.id) > 0) entries.push({ m: m, d: d, t: c.id, date: date }); });
      }
    }
    entries.sort(function (a, b) { return b.date - a.date; });
    list.querySelectorAll('.recent-item').forEach(function (el, i) {
      var e = entries[i]; if (!e) return;
      el.classList.add('bp-tappable'); el.setAttribute('role', 'button');
      el.onclick = function () { reveal(e.m, e.d, e.t); };
    });
  });

  /* =========== 3) cells: no negative / absurd amounts =========== */
  wrap('onInputChange', null, function (el) {
    if (!el || el.value === '') return;
    var v = String(el.value);
    if (v.indexOf('-') > -1) { el.value = v.replace(/-/g, ''); }
    var n = parseFloat(el.value);
    if (n > 1e9) el.value = '1000000000';
  });

  /* =========== 4) confirmations + undo for destructive actions =========== */
  W.changeMonthCount = (function (orig) {
    var f = function (delta) {
      var args = arguments, self = this;
      if (delta < 0 && appData.months > 1) {
        var last = appData.months - 1, info = monthData(last);
        if (info.n > 0) {
          confirmBox('🗑️', 'تقليل عدد الأشهر', 'شهر «' + getMonthName(last) + '» فيه ' + ops(info.n) + (info.spent > 0 ? ' (مصروف ' + money(info.spent) + ')' : '') + ' وهتتمسح. متأكد؟', 'امسح الشهر', function () {
            withUndo('اتمسح شهر «' + getMonthName(last) + '»', function () { orig.apply(self, args); });
          }, true);
          return;
        }
      }
      return orig.apply(this, args);
    };
    f._orig = orig; return f;
  })(W.changeMonthCount);

  W.deleteCategory = (function (orig) {
    var f = function (id) {
      var args = arguments, self = this;
      var c = (appData.categories || []).find(function (x) { return x.id === id; });
      if (!c || c.default) return orig.apply(this, args);
      var info = catData(id);
      var msg = info.n > 0 ? 'فئة «' + c.name + '» فيها ' + ops(info.n) + ' بمجموع ' + money(info.sum) + '، وهتتمسح كلها من الجدول والإحصائيات. متأكد؟' : 'هتتمسح فئة «' + c.name + '». متأكد؟';
      confirmBox('🗑️', 'حذف فئة', msg, 'احذف', function () {
        withUndo('اتحذفت فئة «' + c.name + '»', function () { orig.apply(self, args); });
        if (typeof expandedMonthIdx !== 'undefined' && expandedMonthIdx >= 0) { try { collapseMonth(); } catch (e) {} }
        refreshViews();
      }, true);
    };
    f._orig = orig; return f;
  })(W.deleteCategory);

  /* =========== 5) start date change keeps amounts on their real dates =========== */
  function ym(s) { var p = String(s).split('-'); return (+p[0]) * 12 + (+p[1] - 1); }
  function remapPlan(shift) {
    // record of plan month k → k - shift (same calendar month & day)
    var dropped = 0, droppedSum = 0;
    ['records', 'notes'].forEach(function (store) {
      var src = appData[store] || {}, out = {};
      Object.keys(src).forEach(function (k) {
        var x = KEY.exec(k); if (!x) { out[k] = src[k]; return; }
        var nm = +x[1] - shift;
        if (nm < 0 || nm >= appData.months) { if (store === 'records') { dropped++; droppedSum += parseFloat(src[k]) || 0; } return; }
        out['m' + nm + '-d' + x[2] + '-' + x[3]] = src[k];
      });
      appData[store] = out;
    });
    var sg = appData.savingsGoals || {}, nsg = {};
    Object.keys(sg).forEach(function (k) { var x = /^m(\d+)$/.exec(k); if (!x) { nsg[k] = sg[k]; return; } var nm = +x[1] - shift; if (nm >= 0 && nm < appData.months) nsg['m' + nm] = sg[k]; });
    appData.savingsGoals = nsg;
    appData.alertsShown = {};
    return { n: dropped, sum: droppedSum };
  }
  function outOfRange(shift) {
    var n = 0, sum = 0;
    Object.keys(appData.records || {}).forEach(function (k) { var x = KEY.exec(k); if (!x) return; var nm = +x[1] - shift; if (nm < 0 || nm >= appData.months) { n++; sum += parseFloat(appData.records[k]) || 0; } });
    return { n: n, sum: sum };
  }
  function applyStartDate(date) {
    var shift = ym(date) - ym(appData.startDate);
    var r = shift ? remapPlan(shift) : { n: 0, sum: 0 };
    appData.startDate = date;
    saveData(); rerenderAll();
    return r;
  }
  W.changeStartDate = function (val) {
    if (!val || !/^\d{4}-\d{2}-\d{2}$/.test(val)) return;
    var old = appData.startDate; if (val === old) return;
    var shift = ym(val) - ym(old), lost = outOfRange(shift);
    var msg = shift === 0 ? 'هيتغيّر يوم البدء بس، وكل مبالغك هتفضل في أيامها.'
      : 'مبالغك هتفضل في تواريخها الحقيقية (مش هتتنقل لشهور تانية).' + (lost.n ? '\n⚠️ ' + ops(lost.n) + ' (' + money(lost.sum) + ') هتبقى برا مدة الخطة الجديدة وهتتمسح.' : '');
    confirmBox('📅', 'تغيير تاريخ البدء', msg, 'غيّر', function () {
      withUndo('اتغيّر تاريخ البدء', function () { applyStartDate(val); });
      showToast('تم تغيير تاريخ البدء', 'success');
    }, false, function () { var sd = $('start-date-input'); if (sd) sd.value = appData.startDate; });
  };

  /* =========== 6) safe category ids =========== */
  function safeCatId(name) {
    var base = String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 10);
    if (!base || base === 'i' || /^\d/.test(base)) base = 'c' + Date.now().toString(36);
    var id = base, n = 2, ids = (appData.categories || []).map(function (c) { return c.id; });
    while (ids.indexOf(id) > -1) id = base + '_' + (n++);
    return id;
  }
  BP.safeCatId = safeCatId;
  W.saveNewCategory = function () {
    var name = ($('cat-name-input').value || '').trim();
    if (!name) { showToast('أدخل اسم الفئة', 'error'); return; }
    if ((appData.categories || []).some(function (c) { return (c.name || '').trim() === name; })) { showToast('في فئة بنفس الاسم بالفعل', 'error'); return; }
    appData.categories.push({ id: safeCatId(name), name: name.slice(0, 24), icon: typeof selectedCatEmoji !== 'undefined' ? selectedCatEmoji : '📌', color: typeof selectedCatColor !== 'undefined' ? selectedCatColor : '#6366f1' });
    saveData(); renderCategoryList(); closeAddCategoryModal();
    showToast('تم إضافة فئة ' + name, 'success');
  };

  /* =========== 7) recurring expenses: once per occurrence, only when the date arrives =========== */
  function occKey(m) { var st = _startDate(), d = new Date(st.getFullYear(), st.getMonth() + m, 1); return d.getFullYear() + '-' + (d.getMonth() + 1); }
  // One-time migration: rules made by older versions were already written into every month → mark them done.
  function migrateRecurring() {
    if (appData.recurV2) return;
    (appData.recurringExpenses || []).forEach(function (rec) {
      if (!rec || rec.applied) return;
      rec.applied = {}; for (var k = 0; k < appData.months; k++) rec.applied[occKey(k)] = 1;
      rec.since = todayISO();
    });
    appData.recurV2 = true; saveData();
  }
  document.addEventListener('DOMContentLoaded', function () { setTimeout(function () { try { migrateRecurring(); } catch (e) {} }, 0); });
  function applyRecurring() {
    migrateRecurring();
    var recs = appData.recurringExpenses || []; if (!recs.length) return 0;
    var cats = appData.categories || [], today = new Date(), changed = 0;
    today.setHours(23, 59, 59, 0);
    recs.forEach(function (rec) {
      if (!rec) return;
      if (!cats.some(function (c) { return c.id === rec.category; })) { if (cats[0]) rec.category = cats[0].id; else return; }
      if (!rec.applied) { rec.applied = {}; rec.since = rec.since || todayISO(); changed++; }
      if (!rec.active) return;
      var since = new Date((rec.since || todayISO()) + 'T00:00:00'); since.setDate(1);
      for (var m = 0; m < appData.months; m++) {
        var ok = occKey(m); if (rec.applied[ok]) continue;
        var dim = getDaysInMonth(m), day = Math.min(Math.max(1, parseInt(rec.day) || 1), dim);
        var when = getDayDate(m, day - 1);
        if (when > today || when < since) continue;
        var prev = getVal(m, day, rec.category);
        setRec(m, day, rec.category, Math.round((prev + (Number(rec.amount) || 0)) * 100) / 100);
        var nk = 'm' + m + '-d' + day + '-' + rec.category, tag = '🔁 ' + rec.name;
        if (!appData.notes[nk]) appData.notes[nk] = tag; else if (appData.notes[nk].indexOf(tag) < 0) appData.notes[nk] = (appData.notes[nk] + ' • ' + tag).slice(0, 200);
        rec.applied[ok] = 1; changed++;
      }
    });
    if (changed) { saveData(); refreshViews(); }
    return changed;
  }
  BP.applyRecurring = applyRecurring;
  W.applyRecurringToCurrentMonths = function () { applyRecurring(); };
  W.saveRecurringExpense = (function (orig) {
    var f = function () {
      var before = (appData.recurringExpenses || []).length;
      var r = orig.apply(this, arguments);
      var list = appData.recurringExpenses || [];
      if (list.length > before) { var rec = list[list.length - 1]; rec.applied = rec.applied || {}; rec.since = todayISO(); applyRecurring(); }
      return r;
    };
    f._orig = orig; return f;
  })(W.saveRecurringExpense);
  document.addEventListener('visibilitychange', function () { if (!document.hidden && appData && appData.setupCompleted) applyRecurring(); });

  /* =========== 8) AI actions: safe delete_month / start date / categories / recurring + undo =========== */
  var DESTRUCTIVE = { delete_month: 1, clear_month: 1, clear_day: 1, delete_category: 1, set_month_count: 1, set_start_date: 1, set_budget: 1, modify: 1, delete_recurring: 1 };
  var AI_LBL = { delete_month: 'حذف شهر', clear_month: 'مسح شهر', clear_day: 'مسح يوم', delete_category: 'حذف فئة', set_month_count: 'عدد الأشهر', set_start_date: 'تاريخ البدء', set_budget: 'الميزانية', modify: 'تعديل مبلغ', delete_recurring: 'حذف مصروف متكرر' };
  var aiSnap = null, aiLabels = [];
  W.executeAIAction = (function (orig) {
    var f = function (type, params) {
      params = params || {};
      if (DESTRUCTIVE[type] && aiSnap === null) {
        aiSnap = snapshot(); aiLabels = [];
        setTimeout(function () {
          var s = aiSnap; aiSnap = null;
          if (s && s !== snapshot()) snack('🤖 الذكاء الاصطناعي غيّر في بياناتك' + (aiLabels.length ? ' (' + aiLabels.join('، ') + ')' : ''), '↩️ تراجع', function () { restore(s); }, 10000);
        }, 0);
      }
      var res;
      if (type === 'delete_month') res = aiDeleteMonth(params);
      else if (type === 'set_start_date') {
        var date = String(params.date || '').trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(new Date(date + 'T12:00:00'))) res = { success: false, message: 'تاريخ غير صحيح. التنسيق المطلوب: YYYY-MM-DD' };
        else { var old = appData.startDate, lost = applyStartDate(date); res = { success: true, message: 'تم تغيير تاريخ البدء من ' + old + ' إلى ' + date + ' (المبالغ فضلت في تواريخها' + (lost.n ? '، و' + lost.n + ' عملية بقت برا المدة' : '') + ')' }; }
      } else if (type === 'add_category') {
        var name = String(params.name || '').trim();
        if (!name) res = { success: false, message: 'اسم الفئة مطلوب' };
        else if ((appData.categories || []).some(function (c) { return c.name === name; })) res = { success: false, message: 'الفئة موجودة بالفعل' };
        else { appData.categories.push({ id: safeCatId(name), name: name.slice(0, 24), icon: params.icon || '📌', color: params.color || '#6366f1' }); saveData(); try { renderCategoryList(); } catch (e) {} res = { success: true, message: 'تم إضافة فئة ' + name }; }
      } else {
        if (type === 'add_recurring') {
          var cats = appData.categories || [];
          if (!cats.some(function (c) { return c.id === params.category; }) && cats[0]) params.category = cats[0].id;
          var d = parseInt(params.day); if (!(d >= 1 && d <= 28)) params.day = String(Math.min(28, Math.max(1, d || 1)));
        }
        if ((type === 'modify') && parseFloat(params.value) < 0) params.value = String(Math.abs(parseFloat(params.value)));
        res = orig.call(this, type, params);
        if (type === 'add_recurring' && res && res.success) {
          var list = appData.recurringExpenses || [], rec = list[list.length - 1];
          if (rec) { rec.applied = rec.applied || {}; rec.since = todayISO(); applyRecurring(); }
        }
      }
      if (res && res.success && DESTRUCTIVE[type]) aiLabels.push(AI_LBL[type] || type);
      if (res && res.success) { if (type === 'delete_category' && expandedMonthIdx >= 0) { try { collapseMonth(); } catch (e) {} } refreshViews(); }
      return res;
    };
    f._orig = orig; return f;
  })(W.executeAIAction);

  function aiDeleteMonth(params) {
    var n = parseInt(params.month);
    if (isNaN(n) || n < 1 || n > appData.months) return { success: false, message: 'شهر غير صحيح للحذف: ' + params.month + '. الأشهر المتاحة: 1 إلى ' + appData.months };
    if (appData.months <= 1) return { success: false, message: 'لا يمكن حذف آخر شهر متبقي' };
    var idx = n - 1;
    if (idx === appData.months - 1) {                     // last month → shrink the plan
      purgeMonthData(idx, idx + 1); appData.months -= 1; saveData(); rerenderAll();
      return { success: true, message: 'تم حذف الشهر ' + n + ' (آخر شهر) — إجمالي الأشهر الآن: ' + appData.months };
    }
    if (idx === 0) {                                     // first month → plan starts one month later, dates preserved
      purgeMonthData(0, 1);
      var st = _startDate(), ns = new Date(st.getFullYear(), st.getMonth() + 1, 1);
      var iso = ns.getFullYear() + '-' + String(ns.getMonth() + 1).padStart(2, '0') + '-01';
      remapPlan(1); appData.startDate = iso; appData.months -= 1; saveData(); rerenderAll();
      return { success: true, message: 'تم حذف الشهر الأول — الخطة بقت تبدأ من ' + getMonthName(0) + '، وإجمالي الأشهر: ' + appData.months };
    }
    return { success: false, message: 'مينفعش أحذف شهر من النص لأن كل شهر مربوط بتاريخه الحقيقي. أقدر أمسح بياناته (clear_month) أو أقلل الشهور من الآخر.' };
  }

  /* =========== 9) onboarding re-run must not hide categories that have amounts =========== */
  W._obFinish = (function (orig) {
    if (typeof orig !== 'function') return orig;
    var f = function () {
      var keep = (appData.categories || []).filter(function (c) { return catData(c.id).n > 0; });
      var r = orig.apply(this, arguments);
      keep.forEach(function (c) { if (!appData.categories.some(function (x) { return x.id === c.id; })) appData.categories.push(c); });
      saveData();
      return r;
    };
    f._orig = orig; return f;
  })(W._obFinish);

  /* =========== 10) backup restore: keep Arabic category ids, all notes, debts, limits, zakat, recurring state =========== */
  W.normalizeImportedData = (function (orig) {
    if (typeof orig !== 'function') return orig;
    var f = function (raw) {
      var out = orig.apply(this, arguments), src = (raw && typeof raw === 'object') ? raw : {};
      var ID = /[^\p{L}\p{N}_-]/gu, KEYRX = /^m\d{1,2}-d\d{1,2}-[\p{L}\p{N}_-]{1,40}$/u;
      if (Array.isArray(src.categories)) {
        var seen = {};
        out.categories = src.categories.map(function (c, i) {
          var id = String((c && c.id) || ('cat' + i)).replace(ID, '').slice(0, 40) || ('cat' + i);
          if (id === 'i') id = 'cat_i';
          return { id: id, name: String((c && c.name) || 'فئة').slice(0, 40), icon: String((c && c.icon) || '📌').slice(0, 8),
                   color: /^#[0-9a-f]{3,8}$/i.test(String((c && c.color) || '')) ? String(c.color) : '#6366f1', default: !!(c && c.default) };
        }).filter(function (c) { if (seen[c.id]) return false; seen[c.id] = 1; return true; }).slice(0, 40);
        if (!out.categories.some(function (c) { return c.id === 't'; })) out.categories.unshift(DEFAULT_CATEGORIES[0]);
        if (!out.categories.some(function (c) { return c.id === 'p'; })) out.categories.splice(1, 0, DEFAULT_CATEGORIES[1]);
      }
      if (src.records && typeof src.records === 'object') {
        out.records = {};
        Object.keys(src.records).forEach(function (k) {
          if (!KEYRX.test(k)) return; var n = Number(src.records[k]);
          if (Number.isFinite(n) && n > 0 && n <= 1e9) out.records[k] = n;
        });
      }
      if (src.notes && typeof src.notes === 'object') {
        out.notes = {};
        Object.keys(src.notes).slice(0, 20000).forEach(function (k) { if (KEYRX.test(k)) out.notes[k] = String(src.notes[k]).slice(0, 300); });
      }
      if (Array.isArray(src.recurringExpenses)) {
        out.recurringExpenses.forEach(function (r, i) {
          var o = src.recurringExpenses.find(function (x) { return x && Number(x.id) === r.id; }) || src.recurringExpenses[i] || {};
          if (o.applied && typeof o.applied === 'object') { r.applied = {}; Object.keys(o.applied).forEach(function (k) { if (/^\d{4}-\d{1,2}$/.test(k)) r.applied[k] = 1; }); }
          if (/^\d{4}-\d{2}-\d{2}$/.test(String(o.since || ''))) r.since = o.since;
          r.day = Math.min(28, Math.max(1, r.day));
        });
      }
      out.recurV2 = !!src.recurV2;   // old backups → migration marks their rules as already applied (no duplicates)
      var plain = function (v) { try { return JSON.parse(JSON.stringify(v)); } catch (e) { return undefined; } };
      if (Array.isArray(src.debts)) out.debts = plain(src.debts.slice(0, 500));
      ['catBudgets', 'catAlerts', 'zakat'].forEach(function (k) { if (src[k] && typeof src[k] === 'object' && !Array.isArray(src[k])) out[k] = plain(src[k]); });
      ['hapticsEnabled', 'themeAuto', 'privacyMode'].forEach(function (k) { if (typeof src[k] === 'boolean') out[k] = src[k]; });
      return out;
    };
    f._orig = orig; return f;
  })(W.normalizeImportedData);

  /* =========== 11) keep an open month view in sync after any data change =========== */
  function refreshViews() {
    try { renderDashboard(); } catch (e) {}
    try { if (typeof expandedMonthIdx !== 'undefined' && expandedMonthIdx >= 0) renderExpandedMonth(); else renderTable_ifTilesVisible(); } catch (e) {}
    try { renderCharts(); } catch (e) {}
  }
  BP.refreshViews = refreshViews;
})();
