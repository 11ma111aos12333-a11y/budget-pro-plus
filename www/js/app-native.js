/* =====================================================================
 *  ميزانية Pro+ — Native / Android layer
 *  Loaded right after the main app script. It upgrades the web app into a
 *  real Android app (Capacitor) and adds the new features:
 *   • Runtime permissions screen (notifications + storage)
 *   • Real local notifications (daily reminder, budget alerts, debt due dates)
 *   • Export / backup → saved in Documents/BudgetPro + Android share sheet
 *   • Hardware back button, home-screen shortcuts (deep links), haptics
 *   • Status / navigation bar colors that follow the theme
 *   • Data safety: mirror of all data in native storage (survives WebView wipes)
 *   • Theme "follow system", privacy mode (hide amounts), PIN app-lock
 *   • Debts & loans, Zakat calculator, category budgets, monthly forecast
 *   • Backup reminder, locale-based default currency, reduced-motion support
 *  Everything degrades gracefully in a normal browser.
 * ===================================================================== */
(function () {
  'use strict';
  var W = window;
  var CAP = W.Capacitor;
  var isNative = !!(CAP && typeof CAP.isNativePlatform === 'function' && CAP.isNativePlatform());
  var Plugins = (CAP && CAP.Plugins) || {};
  function plug(name) { return isNative ? Plugins[name] : null; }
  function $(id) { return document.getElementById(id); }
  function esc(s) { return (typeof escapeHtml === 'function') ? escapeHtml(String(s == null ? '' : s)) : String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
  function money(n) { var s = (typeof fmt === 'function') ? fmt(Math.round(n * 100) / 100) : String(n); return s + ' ' + ((typeof appData !== 'undefined' && appData.currencySymbol) || ''); }
  function wrap(name, after, before) {
    var orig = W[name];
    if (typeof orig !== 'function') return;
    W[name] = function () {
      if (before && before.apply(this, arguments) === false) return;
      var r = orig.apply(this, arguments);
      try { if (after) after.apply(this, [r].concat([].slice.call(arguments))); } catch (e) { console.warn('[BP] after ' + name, e); }
      return r;
    };
    W[name]._orig = orig;
  }
  function save() { if (typeof saveData === 'function') saveData(); }
  function toast(m, t) { if (typeof showToast === 'function') showToast(m, t || 'info'); }

  var BP = W.BP = { isNative: isNative };
  document.documentElement.classList.add(isNative ? 'is-native' : 'is-web');

  /* ------------------------------------------------------------------ *
   * 0. Data fields + locale defaults
   * ------------------------------------------------------------------ */
  var TZ_CUR = { 'Africa/Cairo': 'EGP', 'Asia/Riyadh': 'SAR', 'Asia/Dubai': 'AED', 'Asia/Kuwait': 'KWD', 'Asia/Qatar': 'QAR', 'Asia/Bahrain': 'BHD', 'Asia/Muscat': 'OMR', 'Asia/Amman': 'JOD', 'Europe/London': 'GBP' };
  var REGION_CUR = { EG: 'EGP', SA: 'SAR', AE: 'AED', KW: 'KWD', QA: 'QAR', BH: 'BHD', OM: 'OMR', JO: 'JOD', US: 'USD', GB: 'GBP', DE: 'EUR', FR: 'EUR', IT: 'EUR', ES: 'EUR', NL: 'EUR' };
  function guessCurrency() {
    try {
      var tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
      if (TZ_CUR[tz]) return TZ_CUR[tz];
      var m = (navigator.language || '').match(/-([A-Z]{2})/i);
      if (m && REGION_CUR[m[1].toUpperCase()]) return REGION_CUR[m[1].toUpperCase()];
      if (/^Europe\//.test(tz)) return 'EUR';
      if (/^America\//.test(tz)) return 'USD';
    } catch (e) {}
    return null;
  }
  function ensureFields() {
    var d = appData;
    if (d.themeAuto === undefined) d.themeAuto = false;
    if (d.privacyMode === undefined) d.privacyMode = false;
    if (d.lockEnabled === undefined) d.lockEnabled = false;
    if (d.pinHash === undefined) d.pinHash = '';
    if (!Array.isArray(d.debts)) d.debts = [];
    if (!d.catBudgets || typeof d.catBudgets !== 'object') d.catBudgets = {};
    if (!d.zakat || typeof d.zakat !== 'object') d.zakat = {};
    if (d.permAsked === undefined) d.permAsked = false;
    if (d.lastBackupRemind === undefined) d.lastBackupRemind = null;
    if (!d.catAlerts || typeof d.catAlerts !== 'object') d.catAlerts = {};
  }
  wrap('loadData', null, function () { BP._hadData = !!localStorage.getItem(DB_KEY); });
  var _loadAfter = W.loadData;
  W.loadData = function () {
    _loadAfter.apply(this, arguments);
    ensureFields();
    if (!BP._hadData) {
      var cur = guessCurrency();
      if (cur && typeof CURRENCIES !== 'undefined' && CURRENCIES[cur]) { appData.currency = cur; appData.currencySymbol = CURRENCIES[cur].symbol; }
      // weaker phones: lighter page transition on first run
      try {
        if ((navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory && navigator.deviceMemory <= 2)) {
          appData.pageTransitionStyle = 'fade'; appData.pageTransitions = true;
        }
      } catch (e) {}
    }
  };
  // pre-select the guessed currency in onboarding
  wrap('showOnboarding', function () {
    try { if (typeof _ob !== 'undefined' && !_ob.rerun && !_ob.a.currency && appData.currency) _ob.a.currency = appData.currency; } catch (e) {}
  });

  /* ------------------------------------------------------------------ *
   * 1. Native storage mirror (Preferences) — protects against WebView data loss
   * ------------------------------------------------------------------ */
  var PREF_KEY = 'budgetpro_appdata_v1';
  var _mirrorTimer = null;
  function mirrorNow() {
    var Pref = plug('Preferences'); if (!Pref) return;
    try { var v = localStorage.getItem(DB_KEY); if (v) Pref.set({ key: PREF_KEY, value: v }); } catch (e) {}
  }
  wrap('saveData', function () {
    if (!isNative) return;
    clearTimeout(_mirrorTimer); _mirrorTimer = setTimeout(mirrorNow, 800);
  });
  if (isNative) {
    try {
      if (!localStorage.getItem(DB_KEY) && !sessionStorage.getItem('bp_restored')) {
        Plugins.Preferences.get({ key: PREF_KEY }).then(function (r) {
          if (r && r.value && !localStorage.getItem(DB_KEY)) {
            localStorage.setItem(DB_KEY, r.value);
            sessionStorage.setItem('bp_restored', '1');
            location.reload();
          }
        }).catch(function () {});
      }
    } catch (e) {}
  }

  /* ------------------------------------------------------------------ *
   * 2. Theme: system bars, follow-system option
   * ------------------------------------------------------------------ */
  function syncBars() {
    var dark = appData.theme === 'dark-mode';
    var meta = document.querySelector('meta[name="theme-color"]');
    var color = dark ? '#0f0c29' : '#f0f4f8';
    if (meta) meta.setAttribute('content', dark ? '#0f0c29' : '#6366f1');
    var AT = plug('AppTheme');
    if (AT) AT.setBars({ color: color, darkIcons: !dark }).catch(function () {});
  }
  BP.syncBars = syncBars;
  var mq = W.matchMedia ? W.matchMedia('(prefers-color-scheme: dark)') : null;
  function systemTheme() { return mq && mq.matches ? 'dark-mode' : 'light-mode'; }
  wrap('applyTheme', function () {
    syncBars();
    var a = $('theme-auto-switch'); if (a) a.classList.toggle('active', !!appData.themeAuto);
  }, function () {
    if (appData && appData.themeAuto) appData.theme = systemTheme();
  });
  wrap('toggleTheme', null, function () { if (appData.themeAuto) { appData.themeAuto = false; } });
  if (mq) {
    var onMq = function () { if (appData.themeAuto) { applyTheme(); } };
    if (mq.addEventListener) mq.addEventListener('change', onMq); else if (mq.addListener) mq.addListener(onMq);
  }
  BP.toggleThemeAuto = function () {
    appData.themeAuto = !appData.themeAuto;
    applyTheme(); save();
    toast(appData.themeAuto ? 'المظهر يتبع إعداد الجهاز الآن' : 'تم إيقاف المظهر التلقائي', 'info');
  };

  /* ------------------------------------------------------------------ *
   * 3. Haptics
   * ------------------------------------------------------------------ */
  function haptic(kind) {
    var H = plug('Haptics');
    try {
      if (H) {
        if (kind === 'error' || kind === 'warning') H.notification({ type: kind === 'error' ? 'ERROR' : 'WARNING' });
        else if (kind === 'success') H.notification({ type: 'SUCCESS' });
        else H.impact({ style: 'LIGHT' });
      } else if (navigator.vibrate && kind !== 'tap' && navigator.userActivation && navigator.userActivation.hasBeenActive) {
        navigator.vibrate(kind === 'error' ? [30, 40, 30] : 15);
      }
    } catch (e) {}
  }
  BP.haptic = haptic;
  wrap('showToast', null, function (msg, type) { if (type === 'success' || type === 'error' || type === 'warning') haptic(type); });
  wrap('bnNavigate', null, function () { haptic('tap'); });

  /* ------------------------------------------------------------------ *
   * 4. Notifications (native local notifications)
   * ------------------------------------------------------------------ */
  var LN = function () { return plug('LocalNotifications'); };
  var DAILY_ID = 1001, BACKUP_ID = 1002;
  var _nid = 2000 + Math.floor(Math.random() * 1000);
  function ensureChannel() {
    var L = LN(); if (!L || BP._chan) return; BP._chan = true;
    L.createChannel({ id: 'budget', name: 'تنبيهات الميزانية', description: 'التذكير اليومي وتنبيهات تجاوز الميزانية', importance: 4, visibility: 1, vibration: true }).catch(function () {});
  }
  if (isNative) {
    W.requestNotificationPermission = async function () {
      try {
        var L = LN(); ensureChannel();
        var st = await L.checkPermissions();
        if (st.display !== 'granted') st = await L.requestPermissions();
        notifPermission = st.display;
        return st.display === 'granted';
      } catch (e) { return false; }
    };
    W.sendNotification = function (title, body) {
      if (!appData.notificationsEnabled) return;
      var L = LN(); ensureChannel();
      L.schedule({ notifications: [{ id: (_nid++ % 2147483000), title: title, body: body, channelId: 'budget', smallIcon: 'ic_stat_notify', iconColor: '#6366f1', isExactNotification: false }] }).catch(function (e) { console.warn(e); });
    };
    W.sendTestNotification = async function () {
      var ok = await W.requestNotificationPermission();
      if (!ok) { toast('يجب السماح بالإشعارات من إعدادات التطبيق', 'error'); return; }
      var was = appData.notificationsEnabled; appData.notificationsEnabled = true;
      W.sendNotification('🎉 اختبار الإشعارات', 'الإشعارات تعمل بشكل صحيح في تطبيق ميزانية Pro+!');
      appData.notificationsEnabled = was;
      toast('تم إرسال إشعار اختباري', 'success');
    };
    W.clearNotificationTimers = function () { var L = LN(); if (L) L.cancel({ notifications: [{ id: DAILY_ID }] }).catch(function () {}); };
    W.scheduleNotifications = function () {
      var L = LN(); if (!L) return;
      L.cancel({ notifications: [{ id: DAILY_ID }] }).catch(function () {}).then(function () {
        if (!appData.notificationsEnabled || !appData.notifDaily) return;
        var hm = (appData.notifDailyTime || '20:00').split(':').map(Number);
        var body = 'لا تنسَ تسجيل مصاريف اليوم 📝';
        try {
          var all = calcAllData();
          var total = appData.budget + all.totalIncome;
          var pct = total > 0 ? Math.round(all.totalSpent / total * 100) : 0;
          body = 'صرفت ' + money(all.totalSpent) + ' (' + pct + '%) — المتبقي ' + money(all.remaining) + '. سجّل مصاريف اليوم 📝';
        } catch (e) {}
        ensureChannel();
        L.schedule({ notifications: [{ id: DAILY_ID, title: '📊 ' + (appData.userName ? appData.userName + '، ' : '') + 'ميزانيتك اليوم', body: body, channelId: 'budget', smallIcon: 'ic_stat_notify', iconColor: '#6366f1', isExactNotification: false, schedule: { on: { hour: hm[0] || 20, minute: hm[1] || 0 }, allowWhileIdle: true } }] }).catch(function (e) { console.warn('daily schedule', e); });
      });
    };
  }

  /* ------------------------------------------------------------------ *
   * 5. Export / backup → Documents/BudgetPro + share sheet
   * ------------------------------------------------------------------ */
  var _blobs = new Map();
  var _origCreate = URL.createObjectURL.bind(URL);
  URL.createObjectURL = function (obj) { var u = _origCreate(obj); if (obj instanceof Blob) { _blobs.set(u, obj); setTimeout(function () { _blobs.delete(u); }, 60000); } return u; };
  var _origClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (isNative && this.download && _blobs.has(this.href)) {
      var blob = _blobs.get(this.href), name = this.download;
      blob.text().then(function (txt) { BP.saveAndShare(name, txt, blob.type); });
      return;
    }
    return _origClick.apply(this, arguments);
  };
  BP.saveAndShare = async function (name, text, mime) {
    var FS = plug('Filesystem'), SH = plug('Share');
    if (!FS) return;
    var res = null, where = '';
    try {
      try { await FS.requestPermissions(); } catch (e) {}
      res = await FS.writeFile({ path: 'BudgetPro/' + name, data: text, directory: 'DOCUMENTS', encoding: 'utf8', recursive: true });
      where = 'Documents/BudgetPro';
    } catch (e) {
      try { res = await FS.writeFile({ path: name, data: text, directory: 'CACHE', encoding: 'utf8', recursive: true }); where = ''; } catch (e2) { toast('تعذر حفظ الملف: ' + (e2.message || e2), 'error'); return; }
    }
    if (where) toast('📁 تم الحفظ في ' + where + '/' + name, 'success');
    try { if (SH && res && res.uri) await SH.share({ title: name, text: 'ميزانية Pro+ — ' + name, files: [res.uri], dialogTitle: 'مشاركة / حفظ الملف' }); } catch (e) { /* user cancelled */ }
  };

  /* ------------------------------------------------------------------ *
   * 6. Quick-entry fix: add to the day's value instead of overwriting it
   * ------------------------------------------------------------------ */
  // (implemented directly in index.html — see saveQuickEntry)

  /* ------------------------------------------------------------------ *
   * 7. UI helpers: bottom sheets
   * ------------------------------------------------------------------ */
  function sheet(id, title, html, opts) {
    opts = opts || {};
    var ov = $(id);
    if (!ov) {
      ov = document.createElement('div'); ov.id = id; ov.className = 'bp-sheet-overlay';
      ov.addEventListener('click', function (e) { if (e.target === ov && !opts.modal) BP.closeSheet(id); });
      document.body.appendChild(ov);
    }
    ov.innerHTML = '<div class="bp-sheet" role="dialog" aria-modal="true"><div class="bp-sheet-grip"></div>' +
      '<div class="bp-sheet-head"><h3>' + title + '</h3>' + (opts.modal ? '' : '<button class="bp-x" onclick="BP.closeSheet(\'' + id + '\')" aria-label="إغلاق">✕</button>') + '</div>' +
      '<div class="bp-sheet-body">' + html + '</div></div>';
    requestAnimationFrame(function () { ov.classList.add('show'); });
    return ov;
  }
  BP.closeSheet = function (id) {
    var ov = $(id); if (!ov) return;
    ov.classList.remove('show');
    if (BP['_onClose_' + id]) { var f = BP['_onClose_' + id]; BP['_onClose_' + id] = null; f(); }
  };
  function openSheets() { return [].slice.call(document.querySelectorAll('.bp-sheet-overlay.show')); }

  /* ------------------------------------------------------------------ *
   * 8. Permissions screen
   * ------------------------------------------------------------------ */
  async function permStatus() {
    var r = { notif: 'unknown', storage: 'unknown' };
    try {
      if (isNative) {
        var n = await LN().checkPermissions(); r.notif = n.display;
        var s = await plug('Filesystem').checkPermissions(); r.storage = s.publicStorage;
      } else {
        r.notif = (typeof Notification !== 'undefined') ? (Notification.permission === 'default' ? 'prompt' : Notification.permission) : 'unsupported';
        r.storage = 'granted';
      }
    } catch (e) {}
    return r;
  }
  function chip(state) {
    if (state === 'granted') return '<span class="bp-chip ok">✓ مسموح</span>';
    if (state === 'denied') return '<span class="bp-chip bad">✕ مرفوض</span>';
    if (state === 'unsupported') return '<span class="bp-chip">غير مدعوم</span>';
    return '<span class="bp-chip wait">بانتظار الموافقة</span>';
  }
  function permRows(st) {
    return '' +
      '<div class="bp-perm"><div class="bp-perm-ic">🔔</div><div class="bp-perm-tx"><b>الإشعارات</b><small>تذكير يومي بتسجيل المصاريف، وتنبيه عند الوصول لـ 75% و90% من الميزانية، وتذكير بمواعيد الديون.</small>' + chip(st.notif) + '</div>' +
      (st.notif === 'granted' ? '' : '<button class="bp-btn sm" onclick="BP.askNotif()">سماح</button>') + '</div>' +
      '<div class="bp-perm"><div class="bp-perm-ic">📁</div><div class="bp-perm-tx"><b>التخزين</b><small>لحفظ النسخ الاحتياطية وملفات Excel والتقارير في مجلد Documents/BudgetPro على جهازك.</small>' + chip(st.storage) + '</div>' +
      (st.storage === 'granted' ? '' : '<button class="bp-btn sm" onclick="BP.askStorage()">سماح</button>') + '</div>' +
      (st.notif === 'denied' ? '<p class="bp-note">⚠️ رفضت الإشعارات سابقًا. لتفعيلها: إعدادات الجهاز ← التطبيقات ← ميزانية Pro+ ← الإشعارات.</p>' : '');
  }
  BP.openPermissions = async function (first) {
    var st = await permStatus();
    sheet('bp-perm-sheet', first ? '👋 خطوة أخيرة: الأذونات' : '🔐 الأذونات',
      (first ? '<p class="bp-lead">عشان التطبيق يشتغل بكل مميزاته، محتاجين إذنك في الآتي. تقدر تغيّرها في أي وقت من الإعدادات.</p>' : '') +
      '<div id="bp-perm-rows">' + permRows(st) + '</div>' +
      '<button class="bp-btn block" onclick="BP.askAll()">' + (first ? 'السماح بالكل والمتابعة' : 'طلب كل الأذونات') + '</button>' +
      (first ? '<button class="bp-btn ghost block" onclick="BP.closeSheet(\'bp-perm-sheet\')">لاحقًا</button>' : ''));
    if (first) { appData.permAsked = true; save(); }
  };
  async function refreshPerm() {
    var st = await permStatus();
    var r = $('bp-perm-rows'); if (r) r.innerHTML = permRows(st);
    var s = $('bp-perm-settings'); if (s) s.innerHTML = permRows(st);
    return st;
  }
  BP.askNotif = async function () {
    var ok = await W.requestNotificationPermission();
    if (ok) {
      if (!appData.notificationsEnabled) { appData.notificationsEnabled = true; appData.notifDaily = true; save(); }
      if (typeof renderNotificationsUI === 'function') renderNotificationsUI();
      if (typeof scheduleNotifications === 'function') scheduleNotifications();
      toast('✓ تم تفعيل الإشعارات', 'success');
    } else toast('لم يتم السماح بالإشعارات', 'warning');
    return refreshPerm();
  };
  BP.askStorage = async function () {
    try {
      if (isNative) { var r = await plug('Filesystem').requestPermissions(); toast(r.publicStorage === 'granted' ? '✓ تم السماح بالتخزين' : 'لم يتم السماح بالتخزين', r.publicStorage === 'granted' ? 'success' : 'warning'); }
      else toast('المتصفح يحفظ الملفات في مجلد التنزيلات تلقائيًا', 'info');
    } catch (e) { toast('لم يتم السماح بالتخزين', 'warning'); }
    return refreshPerm();
  };
  BP.askAll = async function () {
    await BP.askNotif(); await BP.askStorage();
    setTimeout(function () { BP.closeSheet('bp-perm-sheet'); }, 600);
  };

  /* ------------------------------------------------------------------ *
   * 9. PIN app-lock + privacy mode
   * ------------------------------------------------------------------ */
  async function hashPin(pin) {
    var data = 'bp-salt-v1:' + pin;
    try {
      var buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
      return Array.from(new Uint8Array(buf)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
    } catch (e) {
      var h = 5381; for (var i = 0; i < data.length; i++) h = ((h << 5) + h + data.charCodeAt(i)) | 0; return 'x' + (h >>> 0).toString(16);
    }
  }
  function keypad(prefix) {
    var k = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];
    return '<div class="bp-dots" id="' + prefix + '-dots"><i></i><i></i><i></i><i></i></div><div class="bp-keypad">' + k.map(function (x) {
      if (!x) return '<span></span>';
      return '<button class="bp-key" onclick="BP.pinKey(\'' + prefix + '\',\'' + x + '\')">' + x + '</button>';
    }).join('') + '</div>';
  }
  var _pin = { buf: '', mode: '', first: '', fails: 0, until: 0 };
  function paintDots(prefix) {
    var d = $(prefix + '-dots'); if (!d) return;
    [].forEach.call(d.children, function (el, i) { el.classList.toggle('on', i < _pin.buf.length); });
  }
  function shake(prefix) { var d = $(prefix + '-dots'); if (d) { d.classList.remove('shake'); void d.offsetWidth; d.classList.add('shake'); } haptic('error'); }
  BP.pinKey = async function (prefix, k) {
    if (Date.now() < _pin.until) { toast('محاولات كثيرة. انتظر قليلًا', 'warning'); return; }
    haptic('tap');
    if (k === '⌫') _pin.buf = _pin.buf.slice(0, -1); else if (_pin.buf.length < 4) _pin.buf += k;
    paintDots(prefix);
    if (_pin.buf.length < 4) return;
    var entered = _pin.buf;
    setTimeout(async function () {
      _pin.buf = ''; paintDots(prefix);
      if (prefix === 'lock') {
        if (await hashPin(entered) === appData.pinHash) { _pin.fails = 0; unlock(); }
        else {
          _pin.fails++; shake(prefix);
          var m = $('lock-msg'); if (m) m.textContent = 'رمز غير صحيح' + (_pin.fails >= 3 ? ' (' + _pin.fails + '/5)' : '');
          if (_pin.fails >= 5) { _pin.until = Date.now() + 30000; _pin.fails = 0; if (m) m.textContent = 'انتظر 30 ثانية ثم حاول مجددًا'; }
        }
      } else if (prefix === 'setpin') {
        var t = $('setpin-msg');
        if (!_pin.first) { _pin.first = entered; if (t) t.textContent = 'أعد إدخال الرمز للتأكيد'; }
        else if (_pin.first === entered) {
          appData.pinHash = await hashPin(entered); appData.lockEnabled = true; save();
          _pin.first = ''; BP.closeSheet('bp-setpin'); renderSecurity(); applySecure();
          toast('🔒 تم تفعيل قفل التطبيق', 'success');
        } else { _pin.first = ''; shake(prefix); if (t) t.textContent = 'الرمزان غير متطابقين، ابدأ من جديد'; }
      }
    }, 120);
  };
  BP.toggleLock = function () {
    if (appData.lockEnabled) {
      showModal('🔓', 'إيقاف قفل التطبيق', 'هل تريد إيقاف القفل بالرمز السري؟', function () {
        appData.lockEnabled = false; appData.pinHash = ''; save(); renderSecurity(); applySecure(); toast('تم إيقاف القفل', 'info');
      });
      return;
    }
    _pin.buf = ''; _pin.first = '';
    sheet('bp-setpin', '🔒 إنشاء رمز سري', '<p class="bp-lead center" id="setpin-msg">أدخل رمزًا من 4 أرقام</p>' + keypad('setpin') +
      '<p class="bp-note center">احفظ الرمز جيدًا — لو نسيته ستحتاج لمسح بيانات التطبيق.</p>');
  };
  var _locked = false, _pendingAction = null, _bgAt = 0;
  function lockScreen() {
    if (!appData.lockEnabled || !appData.pinHash || _locked) return;
    _locked = true; _pin.buf = '';
    var el = $('bp-lock'); if (!el) { el = document.createElement('div'); el.id = 'bp-lock'; document.body.appendChild(el); }
    el.innerHTML = '<div class="bp-lock-inner"><div class="bp-lock-logo">💰</div><h2>ميزانية Pro+</h2><p id="lock-msg">أدخل الرمز السري</p>' + keypad('lock') + '</div>';
    el.classList.add('show');
  }
  function unlock() {
    _locked = false; var el = $('bp-lock'); if (el) el.classList.remove('show');
    haptic('success');
    if (_pendingAction) { var a = _pendingAction; _pendingAction = null; setTimeout(function () { runAction(a); }, 250); }
  }
  BP.isLocked = function () { return _locked; };
  function applyPrivacy() {
    document.documentElement.classList.toggle('privacy-on', !!appData.privacyMode);
    var s = $('privacy-switch'); if (s) s.classList.toggle('active', !!appData.privacyMode);
    var e = $('bp-eye-btn'); if (e) e.textContent = appData.privacyMode ? '🙈' : '👁️';
  }
  function applySecure() {
    var AT = plug('AppTheme'); if (AT) AT.setSecure({ enabled: !!(appData.privacyMode || appData.lockEnabled) }).catch(function () {});
  }
  BP.togglePrivacy = function () {
    appData.privacyMode = !appData.privacyMode; save(); applyPrivacy(); applySecure();
    toast(appData.privacyMode ? '🙈 تم إخفاء المبالغ' : '👁️ تم إظهار المبالغ', 'info');
  };
  function renderSecurity() {
    var l = $('lock-switch'); if (l) l.classList.toggle('active', !!appData.lockEnabled);
    applyPrivacy();
  }

  /* ------------------------------------------------------------------ *
   * 10. Debts & loans
   * ------------------------------------------------------------------ */
  var _debtTab = 'me';
  function debtTotals() {
    var me = 0, i = 0;
    appData.debts.forEach(function (d) { if (d.paid) return; if (d.type === 'me') me += +d.amount || 0; else i += +d.amount || 0; });
    return { me: me, i: i };
  }
  function debtList() {
    var list = appData.debts.filter(function (d) { return d.type === _debtTab; }).sort(function (a, b) { return (a.paid - b.paid) || String(a.due || '9').localeCompare(String(b.due || '9')); });
    if (!list.length) return '<div class="bp-empty">' + (_debtTab === 'me' ? 'لا يوجد أحد مدين لك 👌' : 'لا توجد عليك ديون 🎉') + '</div>';
    var today = (typeof todayISO === 'function') ? todayISO() : '';
    return list.map(function (d) {
      var late = !d.paid && d.due && d.due < today;
      return '<div class="bp-debt' + (d.paid ? ' paid' : '') + '">' +
        '<button class="bp-check" onclick="BP.toggleDebt(\'' + d.id + '\')" title="تم السداد">' + (d.paid ? '✓' : '') + '</button>' +
        '<div class="bp-debt-tx"><b>' + esc(d.name) + '</b><small>' + (d.due ? ((late ? '⏰ متأخر — ' : '📅 ') + esc(d.due)) : 'بدون موعد') + (d.note ? ' · ' + esc(d.note) : '') + '</small></div>' +
        '<div class="bp-debt-amt bp-num">' + money(+d.amount || 0) + '</div>' +
        '<button class="bp-del" onclick="BP.delDebt(\'' + d.id + '\')" aria-label="حذف">🗑</button></div>';
    }).join('');
  }
  function paintDebts() {
    var t = debtTotals();
    var b = $('bp-debt-body'); if (!b) return;
    b.innerHTML = '<div class="bp-debt-sum"><div class="g"><small>ليّا عند الناس</small><b class="bp-num">' + money(t.me) + '</b></div><div class="r"><small>عليّا للناس</small><b class="bp-num">' + money(t.i) + '</b></div></div>' +
      '<div class="bp-tabs"><button class="' + (_debtTab === 'me' ? 'on' : '') + '" onclick="BP.debtTab(\'me\')">💚 ليّا</button><button class="' + (_debtTab === 'i' ? 'on' : '') + '" onclick="BP.debtTab(\'i\')">❤️ عليّا</button></div>' +
      '<div class="bp-list">' + debtList() + '</div>' +
      '<div class="bp-form"><div class="bp-row2"><input id="debt-name" placeholder="الاسم" maxlength="40"><input id="debt-amt" type="number" inputmode="decimal" placeholder="المبلغ"></div>' +
      '<div class="bp-row2"><input id="debt-due" type="date" title="موعد السداد (اختياري)"><input id="debt-note" placeholder="ملاحظة (اختياري)" maxlength="60"></div>' +
      '<button class="bp-btn block" onclick="BP.addDebt()">➕ إضافة ' + (_debtTab === 'me' ? '(ليّا عند)' : '(عليّا لـ)') + '</button></div>';
  }
  BP.openDebts = function () { sheet('bp-debts', '🤝 الديون والسلف', '<div id="bp-debt-body"></div>'); paintDebts(); };
  BP.debtTab = function (t) { _debtTab = t; paintDebts(); };
  BP.addDebt = function () {
    var name = ($('debt-name').value || '').trim(), amt = parseFloat($('debt-amt').value), due = $('debt-due').value, note = ($('debt-note').value || '').trim();
    if (!name) { toast('اكتب الاسم', 'error'); return; }
    if (!(amt > 0)) { toast('أدخل مبلغًا صحيحًا', 'error'); return; }
    var d = { id: 'd' + Date.now().toString(36), name: name, amount: amt, type: _debtTab, due: due || '', note: note, paid: false, createdAt: new Date().toISOString() };
    appData.debts.push(d); save(); paintDebts(); scheduleDebt(d);
    toast('✓ تمت الإضافة', 'success');
  };
  BP.toggleDebt = function (id) {
    var d = appData.debts.find(function (x) { return x.id === id; }); if (!d) return;
    d.paid = !d.paid; save(); paintDebts(); if (d.paid) cancelDebt(d); else scheduleDebt(d);
    if (d.paid) toast('✓ تم تسجيل السداد', 'success');
  };
  BP.delDebt = function (id) {
    var d = appData.debts.find(function (x) { return x.id === id; });
    appData.debts = appData.debts.filter(function (x) { return x.id !== id; }); save(); paintDebts(); if (d) cancelDebt(d);
  };
  function debtNid(d) { var h = 0; for (var i = 0; i < d.id.length; i++) h = (h * 31 + d.id.charCodeAt(i)) | 0; return 5000 + Math.abs(h % 100000); }
  function scheduleDebt(d) {
    var L = LN(); if (!L || !d.due || d.paid) return;
    var at = new Date(d.due + 'T10:00:00'); if (isNaN(at) || at < new Date()) return;
    L.schedule({ notifications: [{ id: debtNid(d), title: d.type === 'me' ? '💚 موعد استرداد سلفة' : '❤️ موعد سداد دين', body: (d.type === 'me' ? d.name + ' عليه لك ' : 'عليك لـ ' + d.name + ' ') + money(+d.amount), channelId: 'budget', smallIcon: 'ic_stat_notify', isExactNotification: false, schedule: { at: at, allowWhileIdle: true } }] }).catch(function () {});
  }
  function cancelDebt(d) { var L = LN(); if (L) L.cancel({ notifications: [{ id: debtNid(d) }] }).catch(function () {}); }

  /* ------------------------------------------------------------------ *
   * 11. Zakat calculator
   * ------------------------------------------------------------------ */
  BP.openZakat = function () {
    var z = appData.zakat || {};
    function f(id, label, ph) { return '<label class="bp-field"><span>' + label + '</span><input id="z-' + id + '" type="number" inputmode="decimal" placeholder="' + (ph || '0') + '" value="' + (z[id] != null ? esc(z[id]) : '') + '" oninput="BP.calcZakat()"></label>'; }
    sheet('bp-zakat', '🕌 حاسبة الزكاة',
      '<p class="bp-lead">زكاة المال 2.5% إذا بلغ مجموع أموالك النصاب (قيمة 85 جرام ذهب عيار 24) ومرّ عليها عام هجري.</p>' +
      f('cash', 'النقود والمدخرات في البنك') + f('gold24', 'ذهب عيار 24 (جرام)') + f('gold21', 'ذهب عيار 21 (جرام)') + f('gold18', 'ذهب عيار 18 (جرام)') +
      f('price', 'سعر جرام الذهب عيار 24 اليوم', 'مثال: 4000') + f('invest', 'أسهم / تجارة / ديون مرجوّة لك') + f('debts', 'ديون حالّة عليك (تُخصم)') +
      '<div id="z-out" class="bp-zout"></div><p class="bp-note">الحاسبة للإرشاد فقط — للحالات الخاصة راجع جهة شرعية موثوقة.</p>');
    BP.calcZakat();
  };
  BP.calcZakat = function () {
    var z = {}; ['cash', 'gold24', 'gold21', 'gold18', 'price', 'invest', 'debts'].forEach(function (k) { var el = $('z-' + k); var v = el && el.value !== '' ? parseFloat(el.value) : null; z[k] = v; });
    appData.zakat = z; schedulePersist ? schedulePersist(600) : save();
    var price = z.price || 0;
    var goldValue = price * ((z.gold24 || 0) + (z.gold21 || 0) * 21 / 24 + (z.gold18 || 0) * 18 / 24);
    var total = (z.cash || 0) + goldValue + (z.invest || 0) - (z.debts || 0);
    var nisab = price * 85;
    var out = $('z-out'); if (!out) return;
    if (!price) { out.innerHTML = '<div class="bp-zline">أدخل سعر جرام الذهب لحساب النصاب</div>'; return; }
    var due = total >= nisab && total > 0;
    out.innerHTML = '<div class="bp-zline"><span>إجمالي الأموال الزكوية</span><b class="bp-num">' + money(total) + '</b></div>' +
      '<div class="bp-zline"><span>النصاب (85 جم × ' + money(price) + ')</span><b class="bp-num">' + money(nisab) + '</b></div>' +
      '<div class="bp-zbig ' + (due ? 'due' : '') + '">' + (due ? 'الزكاة الواجبة: <b class="bp-num">' + money(total * 0.025) + '</b>' : 'لم يبلغ المال النصاب — لا زكاة واجبة') + '</div>';
  };

  /* ------------------------------------------------------------------ *
   * 12. Category budgets + monthly forecast (Stats page)
   * ------------------------------------------------------------------ */
  function currentSlot() { try { return getPlanSlotForDate(todayISO()); } catch (e) { return null; } }
  BP.openCatBudgets = function () {
    var cats = appData.categories || [];
    var alloc = appData.months > 0 ? appData.budget / appData.months : appData.budget;
    sheet('bp-catb', '🎯 ميزانية لكل فئة',
      '<p class="bp-lead">حدد حدًا شهريًا لكل فئة (اختياري). هتشوف التقدم في صفحة الإحصائيات، وهيوصلك تنبيه لما توصل 90%.</p>' +
      '<p class="bp-note">مخصص الشهر الواحد: <b class="bp-num">' + money(alloc) + '</b></p>' +
      cats.map(function (c) { return '<label class="bp-field"><span>' + esc(c.icon) + ' ' + esc(c.name) + '</span><input type="number" inputmode="decimal" data-cat="' + esc(c.id) + '" placeholder="بدون حد" value="' + (appData.catBudgets[c.id] || '') + '"></label>'; }).join('') +
      '<button class="bp-btn block" onclick="BP.saveCatBudgets()">💾 حفظ</button>');
  };
  BP.saveCatBudgets = function () {
    var cb = {}; document.querySelectorAll('#bp-catb input[data-cat]').forEach(function (i) { var v = parseFloat(i.value); if (v > 0) cb[i.getAttribute('data-cat')] = v; });
    appData.catBudgets = cb; save(); BP.closeSheet('bp-catb'); renderInsights(); toast('✓ تم حفظ ميزانيات الفئات', 'success');
  };
  function checkCatAlerts() {
    var s = currentSlot(); if (!s) return;
    var md = calcMonthData(s.m);
    (appData.categories || []).forEach(function (c) {
      var lim = appData.catBudgets[c.id]; if (!lim) return;
      var spent = md.catTotals[c.id] || 0, key = 'm' + s.m + '-' + c.id;
      if (spent >= lim * 0.9 && !appData.catAlerts[key]) {
        appData.catAlerts[key] = true; save();
        var msg = c.icon + ' ' + c.name + ': صرفت ' + money(spent) + ' من ' + money(lim) + ' (' + Math.round(spent / lim * 100) + '%)';
        toast(msg, 'warning');
        if (typeof sendNotification === 'function') sendNotification('🎯 تنبيه ميزانية الفئة', msg);
      }
    });
  }
  function renderInsights() {
    var page = $('page-stats'); if (!page) return;
    var box = $('bp-insights');
    if (!box) { box = document.createElement('div'); box.id = 'bp-insights'; box.className = 'chart-card bp-insights'; page.insertBefore(box, page.firstChild); }
    var s = currentSlot();
    if (!s) { box.innerHTML = '<h3>🔮 توقعات الشهر</h3><div class="bp-empty">اليوم خارج مدة الخطة الحالية.</div>'; return; }
    var md = calcMonthData(s.m), days = md.days, day = Math.max(1, s.d);
    var spent = md.totalSpent, avg = spent / day, proj = avg * days;
    var budgetM = md.allocation + md.totalIncome;
    var html = '<h3>🔮 توقعات ' + esc(getMonthName(s.m)) + '</h3><div class="bp-kpis">' +
      '<div><small>صرفت حتى اليوم</small><b class="bp-num">' + money(spent) + '</b></div>' +
      '<div><small>متوسطك اليومي</small><b class="bp-num">' + money(avg) + '</b></div>' +
      '<div><small>المتوقع آخر الشهر</small><b class="bp-num ' + (proj > budgetM ? 'neg' : 'pos') + '">' + money(proj) + '</b></div></div>';
    var msg;
    if (spent === 0) msg = '📝 لسه ما سجلتش مصاريف الشهر ده. ابدأ عشان نطلعلك توقعات دقيقة.';
    else if (proj > budgetM && avg > 0) {
      var runOut = Math.floor(budgetM / avg);
      msg = runOut < day ? '🚨 تجاوزت مخصص الشهر بالفعل بـ ' + money(spent - budgetM) + '.' : '⚠️ على المعدل ده، مخصص الشهر هيخلص يوم <b>' + Math.max(1, runOut) + '</b> من ' + days + '. حاول تخلي متوسطك اليومي ' + money(Math.max(0, (budgetM - spent) / Math.max(1, days - day))) + '.';
    } else msg = '✅ ممتاز! على المعدل ده هتوفر حوالي <b class="bp-num">' + money(budgetM - proj) + '</b> آخر الشهر.';
    html += '<div class="bp-tip">' + msg + '</div>';
    if (s.m > 0) {
      var prev = 0; var cats = appData.categories || [];
      for (var d = 1; d <= Math.min(day, getDaysInMonth(s.m - 1)); d++) cats.forEach(function (c) { prev += getVal(s.m - 1, d, c.id); });
      if (prev > 0) {
        var ch = Math.round((spent - prev) / prev * 100);
        html += '<div class="bp-tip ' + (ch > 0 ? 'warn' : 'good') + '">' + (ch > 0 ? '📈 صرفك أعلى بـ ' + ch + '%' : '📉 صرفك أقل بـ ' + Math.abs(ch) + '%') + ' مقارنة بنفس الفترة من الشهر اللي فات.</div>';
      }
    }
    try { var st = getNoSpendStreak(); if (st >= 1) html += '<div class="bp-tip good">🔥 ' + st + ' ' + (st === 1 ? 'يوم' : 'أيام') + ' متتالية بدون مصروفات!' + (st >= 7 ? ' 🏆 بطل التوفير' : st >= 3 ? ' 🥉 استمر' : '') + '</div>'; } catch (e) {}
    var cb = appData.catBudgets || {};
    var rows = (appData.categories || []).filter(function (c) { return cb[c.id]; }).map(function (c) {
      var sp = md.catTotals[c.id] || 0, lim = cb[c.id], pct = Math.min(100, Math.round(sp / lim * 100));
      var cls = sp > lim ? 'over' : pct >= 90 ? 'hi' : '';
      return '<div class="bp-cb"><div class="bp-cb-top"><span>' + esc(c.icon) + ' ' + esc(c.name) + '</span><span class="bp-num">' + money(sp) + ' / ' + money(lim) + '</span></div><div class="bp-bar ' + cls + '"><i style="width:' + pct + '%;background:' + esc(c.color || '') + '"></i></div></div>';
    }).join('');
    html += '<div class="bp-cb-head"><b>🎯 ميزانية الفئات</b><button class="bp-link" onclick="BP.openCatBudgets()">' + (rows ? 'تعديل' : '+ تحديد') + '</button></div>' + (rows || '<div class="bp-empty sm">حدد حدًا شهريًا لكل فئة لتتابع التزامك.</div>');
    box.innerHTML = html;
  }
  BP.renderInsights = renderInsights;
  wrap('renderCharts', function () { try { renderInsights(); } catch (e) { console.warn(e); } });
  wrap('saveQuickEntry', function () { try { checkCatAlerts(); } catch (e) {} });
  wrap('onInputChange', function () { clearTimeout(BP._cat); BP._cat = setTimeout(function () { try { checkCatAlerts(); } catch (e) {} }, 1500); });

  /* ------------------------------------------------------------------ *
   * 13. Settings UI injection
   * ------------------------------------------------------------------ */
  function sw(id, on, fn, icon) { return '<div class="theme-switch' + (on ? ' active' : '') + '" id="' + id + '" onclick="' + fn + '"><div class="knob">' + icon + '</div></div>'; }
  function row(label, desc, right) { return '<div class="setting-row"><div><div class="sr-label">' + label + '</div><div class="sr-desc">' + desc + '</div></div>' + right + '</div>'; }
  function injectSettings() {
    if ($('bp-settings-injected')) return;
    var themeRow = $('theme-switch') && $('theme-switch').closest('.setting-row');
    if (themeRow) {
      var r = document.createElement('div'); r.innerHTML = row('تلقائي حسب الجهاز', 'اتّباع الوضع الفاتح/الداكن الخاص بالنظام', sw('theme-auto-switch', appData.themeAuto, 'BP.toggleThemeAuto()', '🌓'));
      themeRow.parentNode.insertBefore(r.firstChild, themeRow.nextSibling);
    }
    var anchor = $('notifications-section'); if (!anchor) return;
    var frag = document.createElement('div');
    frag.innerHTML =
      '<div class="settings-section" id="bp-settings-injected"><h3>🔐 الأذونات</h3><div id="bp-perm-settings"></div>' +
      '<button class="action-btn outline" style="width:100%;margin-top:8px" onclick="BP.openPermissions()">مراجعة الأذونات</button></div>' +
      '<div class="settings-section"><h3>🛡️ الأمان والخصوصية</h3>' +
      row('قفل التطبيق برمز', 'رمز من 4 أرقام عند فتح التطبيق', sw('lock-switch', appData.lockEnabled, 'BP.toggleLock()', '🔒')) +
      row('إخفاء المبالغ', 'إخفاء الأرقام عند فتح التطبيق أمام الآخرين', sw('privacy-switch', appData.privacyMode, 'BP.togglePrivacy()', '🙈')) +
      '</div>' +
      '<div class="settings-section"><h3>🧰 أدوات مالية</h3><div class="bp-tools">' +
      '<button onclick="BP.openDebts()"><span>🤝</span>الديون والسلف</button>' +
      '<button onclick="BP.openZakat()"><span>🕌</span>حاسبة الزكاة</button>' +
      '<button onclick="BP.openCatBudgets()"><span>🎯</span>ميزانية الفئات</button>' +
      '<button onclick="bnNavigate(\'stats\')"><span>🔮</span>توقعات الشهر</button>' +
      '</div></div>';
    var ref = anchor.nextSibling;
    while (frag.firstChild) anchor.parentNode.insertBefore(frag.firstChild, ref);
    var page = $('page-settings');
    var ver = document.createElement('div'); ver.className = 'bp-version'; ver.id = 'bp-version'; ver.textContent = 'ميزانية Pro+';
    page.appendChild(ver);
    if (isNative && plug('App')) plug('App').getInfo().then(function (i) { ver.textContent = 'ميزانية Pro+ — الإصدار ' + i.version + ' (' + i.build + ')'; }).catch(function () {});
    refreshPerm();
  }
  function injectEye() {
    var hero = $('budget-hero'); if (!hero || $('bp-eye-btn')) return;
    var b = document.createElement('button'); b.id = 'bp-eye-btn'; b.className = 'bp-eye'; b.title = 'إخفاء/إظهار المبالغ';
    b.textContent = appData.privacyMode ? '🙈' : '👁️';
    b.onclick = function (e) { e.stopPropagation(); BP.togglePrivacy(); };
    hero.appendChild(b);
  }
  wrap('renderSettings', function () { injectSettings(); renderSecurity(); var a = $('theme-auto-switch'); if (a) a.classList.toggle('active', !!appData.themeAuto); refreshPerm(); });

  /* ------------------------------------------------------------------ *
   * 14. Back button, deep links, lifecycle
   * ------------------------------------------------------------------ */
  function vis(id, cls) { var e = $(id); if (!e) return false; if (cls) return e.classList.contains(cls); return e.style.display === 'block'; }
  var _lastBack = 0;
  function handleBack() {
    var App = plug('App');
    if (_locked) { App && App.minimizeApp && App.minimizeApp(); return; }
    var sh = openSheets(); if (sh.length) { BP.closeSheet(sh[sh.length - 1].id); return; }
    if (vis('photo-viewer-overlay', 'show')) return closePhotoViewer();
    if (vis('modal-overlay', 'show')) return closeModal();
    if (vis('secret-overlay', 'show')) return closeSecretOverlay();
    if (vis('note-popup')) return closeNotePopup();
    if (vis('cat-modal')) return closeAddCategoryModal();
    if (vis('recurring-modal')) return closeRecurringModal();
    if (vis('ai-report-modal')) return closeAIReport();
    if (vis('quick-entry-overlay', 'show')) return closeQuickEntry();
    if (vis('calc-panel', 'show')) return closeCalc();
    if (typeof fabOpen !== 'undefined' && fabOpen) return toggleFab();
    var intro = $('intro-overlay');
    if (intro && !intro.classList.contains('hidden') && getComputedStyle(intro).display !== 'none') {
      if (typeof _ob !== 'undefined' && _ob.i > 0) return obBack();
      App && App.minimizeApp && App.minimizeApp(); return;
    }
    if (typeof currentPage !== 'undefined' && currentPage === 'table' && typeof expandedMonthIdx !== 'undefined' && expandedMonthIdx >= 0 && typeof collapseMonth === 'function') return collapseMonth();
    if (typeof currentPage !== 'undefined' && currentPage !== 'dashboard') return bnNavigate('dashboard');
    var now = Date.now();
    if (now - _lastBack < 2000) { App && App.exitApp(); return; }
    _lastBack = now; toast('اضغط رجوع مرة أخرى للخروج', 'info');
  }
  BP.handleBack = handleBack;
  function runAction(a) {
    if (!a) return;
    if (_locked) { _pendingAction = a; return; }
    if (!appData.setupCompleted) return;
    if (a === 'expense' || a === 'income') { if (typeof currentPage !== 'undefined' && currentPage !== 'dashboard') bnNavigate('dashboard'); setTimeout(function () { showQuickEntry(a); }, 200); }
    else if (a === 'calc') openCalc();
    else if (a === 'ai') bnNavigate('ai');
    else if (a === 'stats') bnNavigate('stats');
  }
  function actionFromUrl(u) { var m = String(u || '').match(/budgetpro:\/\/open\/(\w+)/); return m ? m[1] : null; }
  BP.runAction = runAction;

  function onReady() {
    ensureFields();
    applyPrivacy(); applySecure(); syncBars();
    injectSettings(); injectEye(); renderSecurity();
    if (appData.lockEnabled) lockScreen();
    var App = plug('App');
    if (App) {
      App.addListener('backButton', handleBack);
      App.addListener('appUrlOpen', function (e) { runAction(actionFromUrl(e.url)); });
      App.getLaunchUrl().then(function (r) { if (r && r.url) setTimeout(function () { runAction(actionFromUrl(r.url)); }, 700); }).catch(function () {});
      App.addListener('appStateChange', function (st) {
        if (!st.isActive) {
          _bgAt = Date.now();
          try { if (typeof _persistTimer !== 'undefined' && _persistTimer) { clearTimeout(_persistTimer); saveData(); } } catch (e) {}
          mirrorNow();
          if (appData.notificationsEnabled && typeof scheduleNotifications === 'function') scheduleNotifications();
        } else {
          if (appData.lockEnabled && _bgAt && Date.now() - _bgAt > 30000) lockScreen();
          try { renderDashboard(); } catch (e) {}
        }
      });
    }
  }
  wrap('renderDashboard', function () { injectEye(); });
  wrap('finishInit', function () {
    if (isNative) {
      ensureChannel();
      if (appData.notificationsEnabled) LN().checkPermissions().then(function (p) { if (p.display === 'granted') scheduleNotifications(); }).catch(function () {});
      if (!appData.permAsked) setTimeout(function () { BP.openPermissions(true); }, 900);
      appData.debts.forEach(scheduleDebt);
      mirrorNow();
    }
    setTimeout(backupReminder, 5000);
    try { checkCatAlerts(); } catch (e) {}
  });

  /* ------------------------------------------------------------------ *
   * 15. Backup reminder
   * ------------------------------------------------------------------ */
  function backupReminder() {
    if (_locked || openSheets().length) { setTimeout(backupReminder, 8000); return; }
    var n = Object.keys(appData.records || {}).length;
    if (n < 10) return;
    var DAY = 864e5, now = Date.now();
    var last = appData.lastBackupAt ? Date.parse(appData.lastBackupAt) : 0;
    var rem = appData.lastBackupRemind ? Date.parse(appData.lastBackupRemind) : 0;
    if (now - last < 30 * DAY || now - rem < 7 * DAY) return;
    appData.lastBackupRemind = new Date().toISOString(); save();
    showModal('💾', 'نسخة احتياطية', last ? 'آخر نسخة احتياطية كانت من ' + Math.floor((now - last) / DAY) + ' يوم. تحب تعمل نسخة جديدة دلوقتي؟' : 'لم تقم بعمل نسخة احتياطية لبياناتك بعد. تحب تعملها دلوقتي عشان متضيعش؟', function () { exportData(); });
  }

  /* ------------------------------------------------------------------ */
  document.addEventListener('DOMContentLoaded', function () { setTimeout(onReady, 0); });
})();
