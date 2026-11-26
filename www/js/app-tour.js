/* =====================================================================
 * ميزانية Pro+ — Guided tour (coach marks)
 * ---------------------------------------------------------------------
 * • Each screen has its own short tour, shown ONLY the first time the user
 *   opens that screen (Home, Table, a month, Stats, AI, Settings).
 * • Spotlight: the screen is softly dimmed, and a rounded "hole" with a
 *   calm glowing ring highlights one element at a time + an animated
 *   pointing hand + a tooltip explaining it.
 * • Tap anywhere / "التالي" → next step.  "تخطي" → skip this screen.
 *   "لا تعرض الشرح مرة أخرى" → turn all tours off.
 * • Waits politely: never starts over onboarding, the PIN lock, the
 *   permissions sheet, modals, or during a page transition; pauses if one
 *   of those appears and resumes afterwards.
 * • Settings → "عن التطبيق" → "إعادة عرض الشرح" replays everything.
 * ===================================================================== */
(function () {
  'use strict';
  var W = window, D = document;
  function $(id) { return D.getElementById(id); }
  function q(sel, root) { try { return (root || D).querySelector(sel); } catch (e) { return null; } }
  function save() { try { saveData(); } catch (e) {} }
  var RM = W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function done() {
    if (!appData.tourDone || typeof appData.tourDone !== 'object') appData.tourDone = {};
    return appData.tourDone;
  }
  // Find a settings section by (part of) its heading text
  function section(txt) {
    return function () {
      var s = D.querySelectorAll('#page-settings .settings-section');
      for (var i = 0; i < s.length; i++) { var h = s[i].querySelector('h3'); if (h && h.textContent.indexOf(txt) >= 0) return s[i]; }
      return null;
    };
  }
  function visible(el) {
    if (!el) return false;
    var r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return false;
    var cs = getComputedStyle(el);
    return cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > 0.05;
  }

  /* ------------------------------------------------------------------ *
   * Tours content
   * ------------------------------------------------------------------ */
  var TOURS = {
    dashboard: [
      { center: true, icon: '👋', title: 'أهلًا بيك في ميزانية Pro+', text: 'جولة سريعة (أقل من دقيقة) تعرّفك على أهم الحاجات في الشاشة دي. اضغط في أي مكان أو «التالي» للمتابعة.', next: 'يلا نبدأ' },
      { el: '#daily-counter-container', title: 'عدّاد اليوم', text: 'بيقولك إنت في يوم كام من الشهر، وصرفت قد إيه من حصة النهارده.' },
      { el: '.pulse-action', title: '＋ مصروف سريع', text: 'أسرع طريقة تسجّل بيها أي مصروف: اكتب المبلغ واختار الفئة وخلاص. وجنبه «دخل سريع» لو جالك فلوس.' },
      { el: '#financial-pulse', title: 'النبض المالي', text: 'درجة من 100 بتقيس صحة صرفك، ومعاها نصيحة ذكية على حسب أرقامك.' },
      { el: '#budget-hero', title: 'ميزانيتك الإجمالية', text: 'المبلغ الكلي للخطة واللي فاضل منه. القلم ✏️ اللي فوق بيعدّل الميزانية.' },
      { el: '#progress-ring', title: 'نسبة الصرف', text: 'الدايرة بتتملي كل ما تصرف. ولو قربت من النهاية هيجيلك تنبيه عند 75% و90% و100%.' },
      { el: '.stats-grid', title: 'لمحة سريعة', text: 'الدخل والمصروف والمتبقي في مكان واحد.' },
      { el: '#bp-eye-btn', title: '👁️ إخفاء المبالغ', text: 'لو حد قاعد جنبك دوس هنا، وكل الأرقام هتستخبى. دوس تاني عشان تظهر.', round: true },
      { el: '#bottom-nav', title: 'التنقل', text: 'من هنا تروح للجدول والإحصائيات والمساعد الذكي والإعدادات. كل شاشة هتفتحها لأول مرة هيظهرلك شرح قصير ليها.', next: 'تمام 👍' }
    ],
    table: [
      { el: '.month-tile', title: 'شهور خطتك', text: 'كل كارت ده شهر: فيه التخصيص (حصة الشهر) والمتبقي. دوس على الكارت عشان تفتح أيامه وتسجّل مصاريفك.' },
      { el: '.month-tile .mt-remaining', title: 'المتبقي والترحيل ↪', text: 'لو صرفت أكتر من حصة شهر، الزيادة بتتخصم من الشهور اللي بعده لوحدها. ولو خلصت الميزانية هيظهرلك «⛔ الميزانية انتهت».' },
      { el: '#month-tiles-view', title: 'زوّد أو قلّل الشهور ⚙️', text: 'عدد الشهور بيتغيّر من الإعدادات ← «عدد الأشهر» بزرار + و −.', next: 'فهمت' }
    ],
    month: [
      { el: '#expanded-month-view .week-nav-bar', title: 'أسابيع الشهر', text: 'اتنقل بين أسابيع الشهر من «السابق» و«التالي».' },
      { el: '#expanded-month-view .day-table tbody tr:first-child td:nth-child(3)', title: 'خانة المصروف', text: 'كل خانة = يوم × فئة. اكتب المبلغ فيها على طول. أول ما تدوس على خانة هيظهر تحت شريط فيه 🧮 الحاسبة و📝 ملاحظة.', fallback: '#expanded-month-view .day-table' },
      { el: '#expanded-month-view .day-table thead', title: 'الفئات', text: 'كل عمود فئة (مواصلات، أكل، ...). تقدر تضيف فئات جديدة أو تعدّلها من الإعدادات.' },
      { el: '#expanded-month-view .week-summary-row', title: 'ملخص الأسبوع', text: 'إجمالي الدخل والمصروف والصافي للأسبوع ده.' },
      { el: '#expanded-month-view .month-summary-card', title: 'ملخص الشهر', text: 'التخصيص والدخل والمصروف والمتبقي للشهر كله. الأرقام بتتحدث وإنت بتكتب.' },
      { el: '#expanded-month-view .back-btn', title: 'رجوع', text: 'يرجّعك لكروت الشهور.', next: 'تمام 👍' }
    ],
    stats: [
      { el: '#bp-insights', title: '🔮 توقعات ذكية', text: 'على حسب صرفك لحد دلوقتي: هل هتكمّل الشهر بالميزانية؟ وكام تقدر تصرف في اليوم؟' },
      { el: function () { return ($('donut-chart') || {}).closest ? $('donut-chart').closest('.chart-card') : null; }, title: 'توزيع المصروفات', text: 'فلوسك بتروح فين؟ كل لون فئة، والأكبر هو اللي بياخد أكتر.' },
      { el: function () { return ($('weekly-chart') || {}).closest ? $('weekly-chart').closest('.chart-card') : null; }, title: 'الإنفاق الأسبوعي', text: 'قارن صرفك أسبوع بأسبوع وشوف إمتى بتصرف أكتر.' },
      { el: function () { return ($('monthly-chart') || {}).closest ? $('monthly-chart').closest('.chart-card') : null; }, title: 'مقارنة شهرية', text: 'كل شهر جنب التاني عشان تتابع إنت بتتحسن ولا لأ.', next: 'تمام 👍' }
    ],
    ai: [
      { center: true, icon: '🤖', title: 'المساعد الذكي', text: 'اسأله عن ميزانيتك بالعربي، وكمان يقدر يسجّل مصاريف بدالك.' },
      { el: '#chat-api-warning', title: 'مفتاح الذكاء الاصطناعي', text: 'عشان المساعد يشتغل محتاج مفتاح مجاني. دوس «إضافة المفتاح» وهيوديك للإعدادات.', optional: true },
      { el: '.chat-suggestions', title: 'اقتراحات جاهزة', text: 'مش عارف تسأل إيه؟ دوس على أي اقتراح.', optional: true },
      { el: '#chat-input', title: 'اكتب سؤالك', text: 'مثلًا: «كام فاضلي؟» أو «صرفت 50 أكل النهارده» وهو يسجّلها لك.' },
      { el: '#chat-image-btn', title: '📎 صورة فاتورة', text: 'ارفع صورة فاتورة أو إيصال والمساعد يقراها.', round: true },
      { el: '#page-ai .ai-head-btn', title: 'محادثة جديدة', text: '➕ يبدأ محادثة جديدة، و🗑️ اللي جنبه يمسح المحادثة.', round: true, next: 'تمام 👍' }
    ],
    settings: [
      { el: '#settings-profile-section', title: 'حسابك', text: 'اسمك وصورتك. بيظهروا في الشريط اللي فوق وفي التحية.' },
      { el: section('المظهر'), title: 'المظهر', text: 'الوضع الليلي، والتبديل التلقائي حسب الجهاز، والاهتزاز، وشكل الانتقال بين الصفحات.' },
      { el: '#categories-section', title: 'فئات المصروفات', text: 'ضيف فئاتك الخاصة أو احذف اللي مش محتاجه، وحدد حد صرف لكل فئة.' },
      { el: '#ai-user-section', title: 'الذكاء الاصطناعي', text: 'هنا تحط مفاتيح المساعد الذكي (مجانية) عشان يشتغل.' },
      { el: '#notifications-section', title: '🔔 التذكيرات', text: 'تذكير يومي في الوقت اللي تحدده بالظبط بتوقيت موبايلك.' },
      { el: section('الأمان'), title: '🛡️ الأمان والخصوصية', text: 'اقفل التطبيق برمز سري، وامنع تصوير الشاشة.' },
      { el: section('أدوات'), title: '🧰 أدوات مالية', text: 'الديون والسلف، وحاسبة الزكاة، والمصاريف المتكررة.' },
      { el: section('تصدير'), title: '📤 نسخة احتياطية', text: 'صدّر بياناتك واحتفظ بنسخة. مهم لو هتغيّر موبايلك.' },
      { el: '#bp-tour-replay', title: '🎓 إعادة الشرح', text: 'لو حبيت تشوف الشرح ده تاني في أي وقت، دوس هنا.', next: 'تمام 👍' }
    ]
  };

  /* ------------------------------------------------------------------ *
   * Blocking UI detection
   * ------------------------------------------------------------------ */
  function blocked() {
    if (D.hidden) return true;
    if (!appData || !appData.setupCompleted) return true;
    var intro = $('intro-overlay');
    if (intro && !intro.classList.contains('hidden') && getComputedStyle(intro).display !== 'none') return true;
    if (q('#bp-lock.show, .bp-sheet-overlay.show, #modal-overlay.show, #welcome-overlay.show, #secret-overlay.show, #quick-entry-overlay.show, #calc-overlay.show, #photo-viewer-overlay.show')) return true;
    var ov = ['note-popup-overlay', 'cat-modal-overlay', 'recurring-modal-overlay', 'ai-report-overlay'];
    for (var i = 0; i < ov.length; i++) { var e = $(ov[i]); if (e && +getComputedStyle(e).opacity > 0.1) return true; }
    try { if (typeof _pt !== 'undefined' && _pt) return true; } catch (e) {}
    var cur = $('pt-curtain'); if (cur && +getComputedStyle(cur).opacity > 0.05 && getComputedStyle(cur).display !== 'none') return true;
    try { if (typeof fabOpen !== 'undefined' && fabOpen) return true; } catch (e) {}
    return false;
  }
  function screenKey() {
    var p = (typeof currentPage !== 'undefined') ? currentPage : 'dashboard';
    if (p === 'table' && typeof expandedMonthIdx !== 'undefined' && expandedMonthIdx >= 0) return 'month';
    return p;
  }

  /* ------------------------------------------------------------------ *
   * DOM
   * ------------------------------------------------------------------ */
  var ui = null, T = null; // T = running tour state
  function build() {
    if (ui) return ui;
    var root = D.createElement('div'); root.id = 'bp-tour'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-live', 'polite');
    root.innerHTML =
      '<div class="tr-catch"></div>' +
      '<div class="tr-hole"><span class="tr-ring"></span></div>' +
      '<div class="tr-hand" aria-hidden="true"><span class="tr-tap"></span><span class="tr-finger">👆</span></div>' +
      '<div class="tr-tip">' +
        '<div class="tr-arrow"></div>' +
        '<div class="tr-icon"></div>' +
        '<div class="tr-title"></div>' +
        '<div class="tr-text"></div>' +
        '<div class="tr-foot">' +
          '<div class="tr-dots"></div>' +
          '<div class="tr-btns"><button class="tr-skip" type="button">تخطي</button><button class="tr-prev" type="button" aria-label="السابق">→</button><button class="tr-next" type="button">التالي</button></div>' +
        '</div>' +
        '<button class="tr-never" type="button">لا تعرض الشرح مرة أخرى</button>' +
      '</div>';
    D.body.appendChild(root);
    ui = {
      root: root, hole: q('.tr-hole', root), hand: q('.tr-hand', root), tip: q('.tr-tip', root), arrow: q('.tr-arrow', root),
      icon: q('.tr-icon', root), title: q('.tr-title', root), text: q('.tr-text', root), dots: q('.tr-dots', root),
      next: q('.tr-next', root), prev: q('.tr-prev', root), skip: q('.tr-skip', root), never: q('.tr-never', root)
    };
    function stop(e) { e.stopPropagation(); }
    ui.next.addEventListener('click', function (e) { stop(e); go(1); });
    ui.prev.addEventListener('click', function (e) { stop(e); go(-1); });
    ui.skip.addEventListener('click', function (e) { stop(e); finish(true); });
    ui.never.addEventListener('click', function (e) {
      stop(e);
      Object.keys(TOURS).forEach(function (k) { done()[k] = true; });
      appData.toursOff = true; save(); finish(true);
      try { showToast('تمام، مش هيظهر الشرح تاني. تقدر ترجّعه من الإعدادات ← عن التطبيق', 'info'); } catch (er) {}
    });
    ui.tip.addEventListener('click', stop);
    // Tap anywhere else (dim area or the highlighted element) → next
    root.addEventListener('click', function () { go(1); });
    W.addEventListener('resize', function () { if (T) place(true); });
    return ui;
  }

  /* ------------------------------------------------------------------ *
   * Flow
   * ------------------------------------------------------------------ */
  function resolve(step) {
    if (step.center) return null;
    var el = typeof step.el === 'function' ? step.el() : q(step.el);
    if (!visible(el) && step.fallback) el = q(step.fallback);
    return visible(el) ? el : null;
  }
  function usable(step) { return step.center || !!resolve(step); }

  function start(key) {
    var steps = (TOURS[key] || []).filter(usable);
    if (!steps.length) { done()[key] = true; save(); return; }
    build();
    try { var a = D.activeElement; if (a && a.blur && a !== D.body) a.blur(); } catch (e) {}
    T = { key: key, steps: steps, i: 0, paused: false };
    D.body.classList.add('bp-touring');
    ui.root.classList.remove('tr-out');
    ui.root.classList.add('tr-on');
    show(0);
    T.watch = setInterval(watch, 500);
  }
  function go(d) {
    if (!T || T.busy) return;
    var n = T.i + d;
    if (n < 0) return;
    if (n >= T.steps.length) return finish(false);
    show(n);
  }
  function finish(skipped) {
    if (!T) return;
    done()[T.key] = true; save();
    clearInterval(T.watch);
    T = null;
    D.body.classList.remove('bp-touring');
    if (ui) {
      ui.root.classList.add('tr-out');
      setTimeout(function () { if (!T && ui) ui.root.classList.remove('tr-on', 'tr-out', 'tr-paused'); }, 320);
    }
  }
  function watch() {
    if (!T) return;
    // The user left the screen (e.g. Android back) → close quietly; it will not show again.
    if (screenKey() !== T.key) return finish(true);
    var b = blocked();
    if (b !== T.paused) {
      T.paused = b;
      ui.root.classList.toggle('tr-paused', b);
      if (!b) place(true);
    }
  }

  var _scrollT = null;
  function show(i) {
    T.i = i; T.busy = true;
    var s = T.steps[i];
    ui.tip.classList.add('tr-swap');
    var el = resolve(s);
    if (!s.center && !el) { // element disappeared → skip it
      T.steps.splice(i, 1); T.busy = false;
      if (i >= T.steps.length) return finish(false);
      return show(i);
    }
    T.el = el;
    var wait = 0;
    if (el) wait = scrollTo(el);
    clearTimeout(_scrollT);
    _scrollT = setTimeout(function () {
      if (!T) return;
      fill(s, i);
      place(false);
      ui.tip.classList.remove('tr-swap');
      T.busy = false;
    }, wait);
  }
  // Scroll the element into a comfortable position inside its page; returns ms to wait
  function scrollTo(el) {
    var page = el.closest('.page') || null;
    var vh = W.innerHeight, r = el.getBoundingClientRect();
    var bottomNav = $('bottom-nav'), navTop = (bottomNav && visible(bottomNav)) ? bottomNav.getBoundingClientRect().top : vh;
    if (!page || el.closest('#bottom-nav')) return 120;
    var tall = r.height > vh * 0.42;
    var desiredTop = tall ? 96 : Math.max(96, (navTop - r.height) / 2 - 40);
    var delta = r.top - desiredTop;
    if (Math.abs(delta) < 24 && r.bottom < navTop - 8) return 120;
    var before = page.scrollTop, maxTop = Math.max(0, page.scrollHeight - page.clientHeight);
    var target = Math.max(0, Math.min(maxTop, before + delta));
    if (Math.abs(target - before) < 4) return 60;           // nothing to scroll → no waiting
    page.scrollTo({ top: target, behavior: RM ? 'auto' : 'smooth' });
    return RM ? 80 : Math.min(520, 260 + Math.abs(target - before) * 0.4);
  }
  function fill(s, i) {
    ui.icon.textContent = s.icon || '';
    ui.icon.style.display = s.icon ? '' : 'none';
    ui.title.textContent = s.title;
    ui.text.textContent = s.text;
    var last = i === T.steps.length - 1;
    ui.next.textContent = s.next || (last ? 'تمام 👍' : 'التالي');
    ui.prev.style.display = i > 0 ? '' : 'none';
    ui.skip.style.visibility = last ? 'hidden' : 'visible';
    ui.never.style.display = (i === 0 && T.key === 'dashboard') ? '' : 'none';
    var h = '';
    for (var k = 0; k < T.steps.length; k++) h += '<i class="' + (k === i ? 'on' : (k < i ? 'past' : '')) + '"></i>';
    ui.dots.innerHTML = h;
    ui.root.classList.toggle('tr-center', !!s.center);
  }
  function place(instant) {
    if (!T) return;
    var s = T.steps[T.i], vw = W.innerWidth, vh = W.innerHeight;
    var tip = ui.tip, hole = ui.hole, hand = ui.hand;
    if (instant) ui.root.classList.add('tr-instant');
    if (s.center || !T.el) {
      hole.style.cssText = 'left:' + (vw / 2) + 'px;top:' + (vh / 2) + 'px;width:0;height:0;border-radius:50%';
      hand.style.display = 'none';
      tip.style.left = Math.max(12, (vw - tip.offsetWidth) / 2) + 'px';
      tip.style.top = Math.max(24, (vh - tip.offsetHeight) / 2) + 'px';
      ui.arrow.style.display = 'none';
    } else {
      var r = T.el.getBoundingClientRect();
      var pad = s.round ? 8 : 6;
      var top = r.top - pad, left = r.left - pad, w = r.width + pad * 2, h = Math.min(r.height + pad * 2, vh * 0.46);
      left = Math.max(4, left); w = Math.min(w, vw - left - 4);
      var round = s.round || (Math.abs(r.width - r.height) < 14 && r.width < 80);
      var rad = round ? Math.max(w, h) / 2 : Math.min(20, h / 2);
      if (round) { var m = Math.max(w, h); left -= (m - w) / 2; top -= (m - h) / 2; w = h = m; }
      hole.style.cssText = 'left:' + left + 'px;top:' + top + 'px;width:' + w + 'px;height:' + h + 'px;border-radius:' + rad + 'px';
      // Tooltip: below if there is room, otherwise above
      var tw = tip.offsetWidth, th = tip.offsetHeight, gap = 16;
      var below = top + h + gap + th < vh - 12, above = top - gap - th > 12;
      var place = below ? 'below' : above ? 'above' : ((vh - (top + h)) > top ? 'below' : 'above');
      var ty = place === 'below' ? Math.min(top + h + gap, vh - th - 12) : Math.max(12, top - gap - th);
      var cx = left + w / 2;
      var tx = Math.min(Math.max(12, cx - tw / 2), vw - tw - 12);
      tip.style.left = tx + 'px'; tip.style.top = ty + 'px';
      ui.arrow.style.display = '';
      ui.arrow.className = 'tr-arrow ' + (place === 'below' ? 'up' : 'down');
      ui.arrow.style.left = Math.min(Math.max(18, cx - tx - 8), tw - 34) + 'px';
      // Hand: points at the element (finger tip near its centre), kept off the tooltip
      hand.style.display = '';
      var hx = Math.min(Math.max(8, cx - 6), vw - 52);
      var hy = top + Math.min(h, 120) / 2 + 4;
      if (place === 'below' && hy + 40 > ty) hy = Math.max(top + 2, ty - 46);
      if (place === 'above' && hy < ty + th) hy = ty + th + 4;
      hand.style.left = hx + 'px'; hand.style.top = hy + 'px';
    }
    if (instant) requestAnimationFrame(function () { requestAnimationFrame(function () { ui && ui.root.classList.remove('tr-instant'); }); });
  }

  /* ------------------------------------------------------------------ *
   * Triggers
   * ------------------------------------------------------------------ */
  var _pend = null;
  function maybe(delay) {
    clearTimeout(_pend);
    if (T || appData.toursOff) return;
    var key = screenKey();
    if (!TOURS[key] || done()[key]) return;
    var tries = 0;
    (function attempt() {
      _pend = setTimeout(function () {
        if (T || appData.toursOff || screenKey() !== key || done()[key]) return;
        if (blocked()) { if (++tries < 240) attempt(); return; } // keep waiting politely (up to ~2 min)
        // one more beat so the screen is settled and the user can see it first
        _pend = setTimeout(function () {
          if (T || screenKey() !== key || done()[key] || blocked()) { if (!T && !done()[key]) attempt(); return; }
          start(key);
        }, 450);
      }, tries ? 500 : (delay || 700));
    })();
  }

  function wrapFn(name, after) {
    var orig = W[name]; if (typeof orig !== 'function') return;
    W[name] = function () { var r = orig.apply(this, arguments); try { after.apply(this, arguments); } catch (e) {} return r; };
  }
  wrapFn('switchPage', function () { if (T) finish(true); maybe(650); });
  wrapFn('expandMonth', function () { if (T) finish(true); maybe(600); });
  wrapFn('collapseMonth', function () { if (T) finish(true); });

  // Replay from Settings
  W.BP = W.BP || {};
  BP.replayTour = function () {
    appData.tourDone = {}; appData.toursOff = false; save();
    try { showToast('🎓 هيبدأ الشرح من الشاشة الرئيسية', 'info'); } catch (e) {}
    if (typeof bnNavigate === 'function' && (typeof currentPage === 'undefined' || currentPage !== 'dashboard')) bnNavigate('dashboard');
    else maybe(500);
  };
  BP.tourActive = function () { return !!T; };
  BP.endTour = function () { finish(true); };
  BP.startTour = function (k) { if (TOURS[k]) start(k); };

  function addReplayRow() {
    var about = $('bp-about'); if (!about || $('bp-tour-replay')) return;
    var row = D.createElement('div');
    row.className = 'setting-row'; row.id = 'bp-tour-replay'; row.style.cursor = 'pointer';
    row.onclick = function () { BP.replayTour(); };
    row.innerHTML = '<div><div class="sr-label">🎓 إعادة عرض الشرح</div><div class="sr-desc">شرح سريع لكل شاشة بيظهر تاني من الأول</div></div><span style="font-size:20px;opacity:.7">‹</span>';
    var dev = $('bp-dev-row');
    if (dev) about.insertBefore(row, dev); else about.appendChild(row);
  }
  wrapFn('renderSettings', addReplayRow);

  function boot() {
    addReplayRow();
    maybe(1600);
  }
  if (D.readyState === 'complete') setTimeout(boot, 400);
  else W.addEventListener('load', function () { setTimeout(boot, 400); });
  // After onboarding finishes (setupCompleted flips to true), start the Home tour
  var _obT = setInterval(function () {
    if (appData && appData.setupCompleted) { maybe(1200); clearInterval(_obT); }
  }, 1500);
})();
