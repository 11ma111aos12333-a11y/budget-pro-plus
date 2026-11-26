/*
 * Budget Pro+ — v1.0.10 «معلومة مالية»: occasional educational notifications + an in-app financial dictionary.
 *
 * Content: app features, saving wisdom, financial concepts, company/workplace terms (Valuation, Salaries…)
 * and the investor vocabulary of Shark Tank. Every item opens in full inside the app when tapped.
 *
 * Timing rules (the sensitive part — designed to be helpful, never annoying):
 *   • Default 3 per week (Sat / Mon / Wed). User can pick: 3/week · 2/week · weekly · daily · off.
 *   • Max ONE tip per day, never two in a row on consecutive days with the 3/week & 2/week plans.
 *   • Only inside the "awake" window: time choices are 13:30, 19:00, 21:00, or Auto. Never at night/morning.
 *   • Auto = 19:00 (evening rest time); moved to 21:00 / 18:00 / 21:30 when the daily reminder is within 90 min,
 *     so the two notifications never arrive together.
 *   • Not on the day the tips are enabled (first one comes on the next planned day).
 *   • Only the next 14 days are planned, re-planned on every open/close → if the user stops opening the
 *     app, the tips stop by themselves after ≤ 2 weeks (no nagging of inactive users).
 *   • Own Android channel "معلومات ونصائح مالية" (default importance, no vibration) → the user can mute
 *     just the tips from the phone's settings without losing budget alerts.
 *   • Times are computed with the PHONE's local clock & time zone and fire exactly when exact alarms are allowed.
 *   • No repeats: tips are used in order (round-robin across the 5 categories) → ~1 year of 3/week before repeating.
 */
(function () {
  'use strict';
  var W = window, CAP = W.Capacitor;
  var isNative = !!(CAP && typeof CAP.isNativePlatform === 'function' && CAP.isNativePlatform());
  function LN() { return isNative && CAP.Plugins ? CAP.Plugins.LocalNotifications : null; }
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
  function save() { if (typeof saveData === 'function') saveData(); }
  var BP = W.BP = W.BP || {};

  var CATS = {
    feature: { n: 'ميزة في التطبيق', ic: '✨', col: '#10b981' },
    term:    { n: 'مفهوم مالي', ic: '📘', col: '#6366f1' },
    company: { n: 'من عالم الشركات', ic: '🏢', col: '#0ea5e9' },
    shark:   { n: 'مصطلحات شارك تانك', ic: '🦈', col: '#ef4444' },
    wisdom:  { n: 'حكمة ادخار', ic: '💡', col: '#f59e0b' }
  };
  var CAT_ORDER = ['feature', 'term', 'company', 'shark', 'wisdom'];

  /* [category, title, english, explanation, example (optional), action (features only)] */
  var T = [
    /* ---------------- features ---------------- */
    ['feature', 'التسجيل السريع', 'Quick entry', 'سجّل أي مصروف أو دخل في ثانيتين من زر «مصروف» أو «دخل» في الصفحة الرئيسية، والتطبيق يحطه في خانة النهارده في الجدول تلقائيًا.', 'بعد الحفظ هيظهرلك زر «عرض في الجدول» يوديك للخانة بالظبط.', 'quick'],
    ['feature', 'اسأل المساعد الذكي', 'AI assistant', 'اكتب للمساعد بالعربي «صرفت 50 أكل النهارده» وهو يسجّلها لك، أو اسأله «كام فاضلي؟» و«إيه أكتر فئة بصرف فيها؟».', 'لو عمل حاجة غلط، هيظهرلك زر «تراجع» فورًا.', 'ai'],
    ['feature', 'صورة الفاتورة', 'Receipt photo', 'ارفع صورة فاتورة أو إيصال في المساعد الذكي بزر 📎، وهو يقرأ المبلغ ويقترح تسجيله.', '', 'ai'],
    ['feature', 'الديون والسلف', 'Debts & loans', 'سجّل الفلوس اللي عليك أو اللي ليك عند حد، وحدد ميعاد السداد، والتطبيق يفكّرك بإشعار في اليوم ده.', 'متضيعش حقك ومتنساش التزام عليك.', 'debts'],
    ['feature', 'حاسبة الزكاة', 'Zakat calculator', 'من الإعدادات ← أدوات مالية ← حاسبة الزكاة: دخّل فلوسك وذهبك ومدخراتك، وهي تحسب لك هل بلغت النصاب وكام الزكاة المستحقة.', '', 'zakat'],
    ['feature', 'حد صرف لكل فئة', 'Category budgets', 'حدد سقف شهري لكل فئة (أكل، مواصلات…) والتطبيق ينبهك لما تقرب منه قبل ما تتخطاه.', 'مثال: الأكل 2000 جنيه في الشهر، توصلك رسالة عند 80%.', 'catb'],
    ['feature', 'المصاريف المتكررة', 'Recurring expenses', 'الإيجار والاشتراكات والأقساط سجّلها مرة واحدة كمصروف متكرر، والتطبيق يضيفها في يومها كل شهر لوحده.', '', 'recurring'],
    ['feature', 'الحاسبة جوه الخانة', 'In-cell calculator', 'وانت بتكتب في أي خانة في الجدول، دوس 🧮 «حاسبة» في الشريط اللي تحت واحسب مثلًا 35+20+15 وحط الناتج مباشرة.', '', 'table'],
    ['feature', 'ملاحظة على أي مصروف', 'Notes', 'وانت في خانة في الجدول دوس 📝 «ملاحظة» واكتب اتصرفت في إيه، عشان لما ترجع آخر الشهر تفتكر كل جنيه راح فين.', '', 'table'],
    ['feature', 'توقعات الشهر', 'Monthly forecast', 'صفحة الإحصائيات بتتوقع لك هتخلّص الشهر بكام لو كمّلت بنفس معدل صرفك الحالي، عشان تلحق نفسك بدري.', '', 'stats'],
    ['feature', 'إخفاء المبالغ', 'Privacy mode', 'دوس على 👁️ في الشريط اللي فوق وكل الأرقام تستخبى، مفيد لو بتفتح التطبيق قدام حد.', '', ''],
    ['feature', 'قفل التطبيق', 'App lock', 'تقدر تقفل التطبيق برمز سري من 4 أرقام من الإعدادات ← الأمان والخصوصية، عشان محدش يشوف تفاصيل فلوسك.', '', 'settings'],
    ['feature', 'النسخة الاحتياطية', 'Backup', 'اعمل نسخة احتياطية من الإعدادات ← تصدير، وهتتحفظ في ملفات الموبايل. لو غيّرت موبايلك ترجع كل بياناتك في ثواني.', 'خليها عادة: نسخة كل أول شهر.', 'settings'],
    ['feature', 'زرار التراجع', 'Undo', 'مسحت حاجة بالغلط؟ بعد أي حذف بيظهر شريط تحت فيه «تراجع» يرجّع كل حاجة زي ما كانت.', '', ''],
    ['feature', 'اختصارات أيقونة التطبيق', 'App shortcuts', 'اضغط ضغطة طويلة على أيقونة التطبيق في الشاشة الرئيسية، هتلاقي اختصارات: مصروف سريع، دخل، الحاسبة، والمساعد الذكي.', '', ''],
    ['feature', 'تنبيهات الميزانية', 'Budget alerts', 'التطبيق يبعتلك إشعار لما توصل 75% ثم 90% من ميزانيتك، عشان تاخد قرارك قبل ما الفلوس تخلص مش بعدها.', '', 'settings'],
    ['feature', 'التذكير اليومي', 'Daily reminder', 'فعّل التذكير اليومي واختار الساعة اللي تناسبك، ويوصلك في الدقيقة دي بالظبط حسب ساعة موبايلك عشان متنساش تسجّل.', '', 'settings'],
    ['feature', 'التقرير الشهري الذكي', 'AI monthly report', 'من الإعدادات دوس «تقرير شهري بالذكاء الاصطناعي» وهتاخد تحليل لمصاريفك ونصايح مخصوصة ليك.', '', 'settings'],
    ['feature', 'آخر العمليات', 'Recent activity', 'في الصفحة الرئيسية دوس على أي عملية من «آخر العمليات» وهيوديك لخانتها في الجدول على طول عشان تعدّلها.', '', ''],
    ['feature', 'شرح التطبيق', 'Guided tour', 'لو حبيت تشوف شرح أي صفحة تاني، من الإعدادات دوس «إعادة الشرح».', '', 'tour'],
    ['feature', 'الوضع الليلي التلقائي', 'Auto theme', 'خلّي التطبيق يقلب فاتح أو داكن مع إعداد موبايلك تلقائيًا، أريح لعينك بالليل.', '', 'settings'],
    ['feature', 'القاموس المالي', 'Financial dictionary', 'كل المعلومات اللي بتوصلك موجودة في «القاموس المالي» في الإعدادات ← أدوات مالية، وتقدر تدوّر فيه على أي مصطلح.', '', 'lib'],

    /* ---------------- financial concepts ---------------- */
    ['term', 'التضخم', 'Inflation', 'هو ارتفاع الأسعار مع الوقت، يعني نفس الفلوس بتشتري حاجات أقل. لو التضخم 25% في السنة، الـ 100 جنيه بعد سنة قيمتها كأنها 80 بس.', 'عشان كده الفلوس اللي قاعدة في الدرج من غير ما تستثمرها بتخسر قيمتها.', ''],
    ['term', 'الفائدة المركبة', 'Compound interest', 'هي إن الفايدة اللي بتكسبها تتضاف لأصل المبلغ، فتكسب فايدة على الفايدة. مع الوقت المبلغ بيكبر بسرعة أكبر بكتير من الفايدة العادية.', '10,000 بعائد 20% سنويًا: بعد سنة 12,000، وبعد 5 سنين حوالي 24,900 مش 20,000 بس.', ''],
    ['term', 'صندوق الطوارئ', 'Emergency fund', 'مبلغ محجوز للظروف المفاجئة بس: مرض، عطل عربية، أو فقدان شغل. المتعارف عليه إنه يغطي مصاريف 3 إلى 6 شهور.', 'لو مصاريفك 8,000 في الشهر، هدفك 24,000 لـ 48,000 في مكان سهل تسحب منه.', ''],
    ['term', 'قاعدة 50/30/20', '50/30/20 rule', 'طريقة بسيطة لتقسيم الدخل: 50% للأساسيات (سكن، أكل، فواتير)، 30% للرغبات (خروج، هدايا)، و20% ادخار أو سداد ديون.', 'مرتب 10,000: 5,000 أساسيات، 3,000 رغبات، 2,000 ادخار.', ''],
    ['term', 'السيولة', 'Liquidity', 'يعني قد إيه سهل تحوّل الشيء لفلوس كاش بسرعة ومن غير خسارة. الكاش أعلى سيولة، والعقار سيولته ضعيفة لأن بيعه بياخد وقت.', '', ''],
    ['term', 'الأصول والخصوم', 'Assets & Liabilities', 'الأصول: حاجات بتملكها ليها قيمة أو بتجيبلك دخل (مدخرات، ذهب، شقة). الخصوم: التزامات عليك (قروض، أقساط، ديون).', '', ''],
    ['term', 'صافي الثروة', 'Net worth', 'هو كل اللي تملكه ناقص كل اللي عليك. ده المقياس الحقيقي لوضعك المالي مش المرتب لوحده.', 'عندك 150,000 مدخرات وذهب، وعليك قسط باقي فيه 40,000 ← صافي ثروتك 110,000.', ''],
    ['term', 'التنويع', 'Diversification', 'متحطش كل البيض في سلة واحدة: وزّع فلوسك على أكتر من نوع (شهادات، ذهب، أسهم، صناديق) عشان لو واحد خسر الباقي يعوّض.', '', ''],
    ['term', 'تكلفة الفرصة البديلة', 'Opportunity cost', 'كل قرار صرف له تمن خفي: الحاجة التانية اللي كنت هتعملها بنفس الفلوس. قبل أي شراء كبير اسأل «إيه اللي هتنازل عنه؟».', 'موبايل بـ 30,000 ممكن يكون معناه تأجيل صندوق الطوارئ سنة.', ''],
    ['term', 'قاعدة 72', 'Rule of 72', 'طريقة سريعة تعرف بيها فلوسك هتتضاعف إمتى: اقسم 72 على نسبة العائد السنوي.', 'عائد 12% ← 72 ÷ 12 = 6 سنين تقريبًا والفلوس تبقى الضعف.', ''],
    ['term', 'ادفع لنفسك أولًا', 'Pay yourself first', 'أول ما المرتب ينزل، حوّل جزء الادخار فورًا قبل أي صرف، بدل ما تستنى «اللي يفضل» آخر الشهر — لأنه غالبًا مش هيفضل.', '', ''],
    ['term', 'المصاريف الثابتة والمتغيرة', 'Fixed vs variable costs', 'الثابتة نفس المبلغ كل شهر (إيجار، اشتراكات، أقساط). المتغيرة بتتغير حسب استخدامك (أكل برة، خروج). التوفير الأسهل بيبدأ من المتغيرة.', '', ''],
    ['term', 'التدفق النقدي', 'Cash flow', 'حركة الفلوس الداخلة والخارجة في فترة معينة. لو الداخل أكتر من الخارج يبقى التدفق موجب، ولو العكس يبقى بتصرف من مدخراتك أو بتستلف.', '', ''],
    ['term', 'تضخم نمط المعيشة', 'Lifestyle inflation', 'لما دخلك يزيد فتزوّد مصاريفك بنفس النسبة، فتفضل مفيش ادخار مهما المرتب زاد. الحل: مع كل زيادة، خلي نصها على الأقل للادخار.', '', ''],
    ['term', 'الشهادات البنكية', 'Certificates of deposit', 'تحط مبلغ في البنك لمدة محددة (سنة أو 3 سنين مثلًا) مقابل عائد ثابت أو متغير. أمانها عالي، بس كسرها قبل الميعاد غالبًا بيكلفك غرامة أو عائد أقل.', '', ''],
    ['term', 'الأسهم', 'Stocks', 'السهم جزء صغير من ملكية شركة. لو الشركة كبرت وكسبت سعر السهم ممكن يرتفع وتاخد أرباح، ولو خسرت ممكن ينزل. مخاطرته أعلى وعائده على المدى الطويل أعلى.', '', ''],
    ['term', 'السندات', 'Bonds', 'السند يعني إنك بتسلّف حكومة أو شركة فلوس لمدة محددة مقابل فايدة دورية، وفي الآخر بترجعلك فلوسك. أقل مخاطرة من الأسهم غالبًا.', '', ''],
    ['term', 'صناديق الاستثمار', 'Mutual funds', 'وعاء بيجمع فلوس ناس كتير ويديرها متخصصين في أسهم أو سندات أو ذهب. مناسبة لو عايز تستثمر بمبلغ صغير ومن غير خبرة كبيرة.', '', ''],
    ['term', 'صناديق المؤشرات', 'Index funds', 'نوع من الصناديق بيشتري كل أسهم مؤشر معين (زي أكبر 30 شركة في البورصة) بدل ما يختار. مصاريفها قليلة وبتمشي مع السوق ككل.', '', ''],
    ['term', 'الذهب كمخزن قيمة', 'Gold as store of value', 'الذهب مش بيجيب دخل زي الشهادات، لكنه تاريخيًا بيحافظ على قيمة الفلوس قدام التضخم وتقلبات العملة. ممكن يكون جزء من مدخراتك مش كلها.', 'خد بالك من المصنعية: السبائك والجنيهات الذهب مصنعيتها أقل من المشغولات.', ''],
    ['term', 'الدين الجيد والسيئ', 'Good vs bad debt', 'الدين الجيد بيمول حاجة قيمتها بتزيد أو بتجيب دخل (تعليم، مشروع). الدين السيئ بيمول استهلاك قيمته بتقل (خروجات، كماليات بالتقسيط).', '', ''],
    ['term', 'الجدارة الائتمانية', 'Credit score', 'تقييم لمدى التزامك بسداد ديونك وأقساطك. في مصر بتتسجل في شركة I-Score، والتأخير في الأقساط بيقلل فرصتك تاخد قرض أو كارت بعد كده.', '', ''],
    ['term', 'الحد الائتماني', 'Credit limit', 'أقصى مبلغ مسموحلك تصرفه بكارت الائتمان. صرفه كله مش معناه إنه فلوسك؛ ده دين لازم يتسدد، ولو مسددتوش كله في الميعاد عليه فوايد عالية.', '', ''],
    ['term', 'القيمة الزمنية للنقود', 'Time value of money', 'الجنيه النهارده أقيم من الجنيه بعد سنة، لأنك تقدر تستثمره وتكسب منه، ولأن التضخم بياكل قيمته. عشان كده «ابدأ بدري» أهم نصيحة ادخار.', '', ''],
    ['term', 'الدخل السلبي', 'Passive income', 'دخل بيجيلك من غير ما تشتغل بإيدك كل يوم: إيجار، عائد شهادات، أرباح أسهم، أو منتج رقمي بيتباع لوحده.', '', ''],
    ['term', 'العائد على الاستثمار', 'ROI', 'نسبة بتقيس كسبت قد إيه مقارنة باللي دفعته: (الربح ÷ التكلفة) × 100.', 'دفعت 10,000 ورجعولك 13,000 ← الربح 3,000 والعائد 30%.', ''],
    ['term', 'العائد الحقيقي', 'Real return', 'هو عائد استثمارك بعد ما تطرح منه التضخم. لو الشهادة بتديك 20% والتضخم 25%، عائدك الحقيقي سالب رغم إن الرقم زاد.', '', ''],
    ['term', 'الميزانية الصفرية', 'Zero-based budget', 'تدّي لكل جنيه من دخلك وظيفة: أساسيات، ادخار، ترفيه… لحد ما يفضل صفر من غير تخطيط. مش معناها تصرف كل حاجة، معناها مفيش جنيه سايب.', '', ''],
    ['term', 'القسط والفايدة', 'Installment & APR', 'في التقسيط ركّز على إجمالي اللي هتدفعه مش القسط الشهري بس. «قسط صغير» على مدة طويلة ممكن يخلي الحاجة بضعف تمنها.', 'جهاز بـ 20,000 بقسط 1,100 لمدة 24 شهر = 26,400 يعني 6,400 زيادة.', ''],
    ['term', 'الفلوس الطايرة', 'Latte factor', 'المصاريف الصغيرة المتكررة (قهوة، توصيل، اشتراك مش مستخدم) بتبان تافهة، لكن مجموعها في السنة ممكن يبقى مبلغ كبير.', '40 جنيه في اليوم = حوالي 14,600 جنيه في السنة.', ''],

    /* ---------------- company & workplace terms ---------------- */
    ['company', 'التقييم (الإيفاليويشن)', 'Valuation', 'هو الرقم اللي بيقول الشركة كلها تساوي كام. بيتحدد بالأرباح والمبيعات وسرعة النمو وحجم السوق، وعلى أساسه بيتحسب المستثمر ياخد كام في المية مقابل فلوسه.', 'لو مستثمر دفع مليون مقابل 10%، يبقى التقييم 10 مليون.', ''],
    ['company', 'الرواتب (السالريز)', 'Salaries / Payroll', 'Salaries هي الرواتب الثابتة اللي بتدفعها الشركة للموظفين كل شهر، وكشف الرواتب كله اسمه Payroll. غالبًا ده من أكبر بنود المصاريف في أي شركة.', '', ''],
    ['company', 'المرتب الإجمالي والصافي', 'Gross vs Net salary', 'الإجمالي (Gross) هو المرتب قبل الخصومات. الصافي (Net) هو اللي بينزل في حسابك فعلًا بعد خصم الضرايب والتأمينات وغيرها. ميزانيتك لازم تتبني على الصافي.', '', ''],
    ['company', 'البدلات والحوافز', 'Allowances & Bonus', 'البدلات مبالغ إضافية لغرض معين (مواصلات، سكن، اتصالات). البونص مكافأة مرتبطة بالأداء أو أرباح الشركة. والعمولة (Commission) نسبة من المبيعات اللي حققتها.', '', ''],
    ['company', 'الإيرادات', 'Revenue', 'كل الفلوس اللي دخلت الشركة من بيع منتجاتها أو خدماتها، قبل خصم أي مصاريف. إيرادات عالية مش معناها أرباح عالية.', '', ''],
    ['company', 'صافي الربح', 'Net profit', 'اللي بيفضل فعلًا بعد خصم كل المصاريف: تكلفة البضاعة، المرتبات، الإيجار، الضرايب والفوايد. ده الرقم اللي بيوضح هل الشركة بتكسب ولا لأ.', '', ''],
    ['company', 'هامش الربح', 'Profit margin', 'نسبة الربح من كل جنيه مبيعات. هامش 20% معناه إن كل 100 جنيه مبيعات بيفضل منها 20 ربح.', '', ''],
    ['company', 'إبيتدا', 'EBITDA', 'الأرباح قبل الفوايد والضرايب والإهلاك. بيستخدمها المستثمرين عشان يقارنوا أداء الشركات التشغيلي من غير تأثير طريقة التمويل أو الضرايب.', '', ''],
    ['company', 'معدل الحرق', 'Burn rate', 'قد إيه الشركة (غالبًا ستارت أب) بتصرف من فلوسها كل شهر وهي لسه مش بتكسب. حرق 500 ألف في الشهر يعني محتاجة تمويل باستمرار.', '', ''],
    ['company', 'المدرج (الرن واي)', 'Runway', 'عدد الشهور اللي الشركة تقدر تعيشها بالفلوس اللي معاها قبل ما تخلص: الكاش ÷ معدل الحرق.', 'معاها 6 مليون وبتحرق 500 ألف شهريًا ← رن واي 12 شهر.', ''],
    ['company', 'نقطة التعادل', 'Break-even point', 'النقطة اللي الإيرادات فيها بتساوي المصاريف بالظبط: لا مكسب ولا خسارة. بعدها أي مبيعات زيادة تبقى ربح.', '', ''],
    ['company', 'الشركة الناشئة', 'Startup', 'شركة جديدة بفكرة قابلة للنمو السريع، غالبًا بتعتمد على التكنولوجيا وبتدوّر على مستثمرين عشان تكبر بسرعة قبل ما تحقق أرباح.', '', ''],
    ['company', 'التمويل الذاتي', 'Bootstrapping', 'إنك تبني مشروعك بفلوسك أو من أرباحه من غير مستثمرين. أبطأ، بس بتفضل مالك الشركة كلها وصاحب القرار.', '', ''],
    ['company', 'جولات التمويل', 'Seed / Series A', 'الـ Seed أول تمويل لإثبات الفكرة. بعدها Series A لما المنتج يثبت نجاحه ويحتاج يكبر، ثم B وC للتوسع الكبير. كل جولة بتقييم أعلى غالبًا.', '', ''],
    ['company', 'المستثمر الملاك', 'Angel investor', 'شخص غني بيستثمر فلوسه الخاصة في شركات صغيرة جدًا في بدايتها، وغالبًا بيقدم كمان خبرة وعلاقات.', '', ''],
    ['company', 'رأس المال المخاطر', 'Venture Capital (VC)', 'شركات استثمار بتجمع فلوس وتستثمرها في ستارت أبس عالية المخاطرة على أمل إن واحدة منها تنجح نجاح ضخم يغطي خسارة الباقي.', '', ''],
    ['company', 'الطرح العام', 'IPO', 'لما شركة خاصة تطرح أسهمها في البورصة لأول مرة عشان أي حد يقدر يشتري فيها، وبكده تجمع فلوس كتير للتوسع.', '', ''],
    ['company', 'القيمة السوقية', 'Market cap', 'قيمة الشركة في البورصة = سعر السهم × عدد الأسهم كلها.', 'سهم بـ 50 جنيه و10 مليون سهم ← قيمة سوقية 500 مليون.', ''],
    ['company', 'توزيعات الأرباح', 'Dividends', 'جزء من أرباح الشركة بيتوزع على حاملي الأسهم، كاش أو أسهم مجانية. مش كل الشركات بتوزع؛ بعضها بيعيد استثمار الأرباح.', '', ''],
    ['company', 'مؤشر الأداء', 'KPI', 'رقم بيقيس هل الهدف بيتحقق ولا لأ: زي عدد العملاء الجدد في الشهر أو نسبة رضا العملاء. معظم تقييمات الموظفين بتتبني عليه.', '', ''],
    ['company', 'تكلفة جذب العميل', 'CAC', 'متوسط اللي الشركة بتصرفه (إعلانات وتسويق ومبيعات) عشان تجيب عميل واحد جديد.', 'صرفت 10,000 إعلانات وجبت 100 عميل ← CAC = 100 جنيه.', ''],
    ['company', 'قيمة العميل مدى الحياة', 'LTV', 'إجمالي الربح اللي العميل الواحد بيجيبه طول فترة تعامله مع الشركة. الشركة الصحية الـ LTV بتاعها أكبر بكتير من الـ CAC.', '', ''],
    ['company', 'المنتج الأولي', 'MVP', 'أبسط نسخة من المنتج تكفي إنك تجربه على عملاء حقيقيين وتتعلم منهم قبل ما تصرف كتير على التفاصيل.', '', ''],
    ['company', 'تغيير الاتجاه', 'Pivot', 'لما الشركة تكتشف إن فكرتها الأصلية مش ماشية فتغيّر المنتج أو السوق أو طريقة الربح، مع الاحتفاظ باللي اتعلمته.', '', ''],
    ['company', 'B2B و B2C', 'B2B vs B2C', 'B2B يعني الشركة بتبيع لشركات تانية (زي برامج المحاسبة). B2C يعني بتبيع للمستهلك العادي مباشرة (زي المطاعم والملابس).', '', ''],
    ['company', 'المصاريف التشغيلية والرأسمالية', 'OPEX vs CAPEX', 'OPEX مصاريف التشغيل اليومي المتكررة (مرتبات، إيجار، كهربا). CAPEX شراء أصول طويلة العمر (مكن، عربيات، مقر).', '', ''],
    ['company', 'المصاريف العامة', 'Overhead', 'مصاريف لازمة لتشغيل الشركة لكنها مش مرتبطة بمنتج معين: الإيجار، الإدارة، المحاسبة، الإنترنت.', '', ''],
    ['company', 'السنة المالية', 'Fiscal year', 'الـ 12 شهر اللي الشركة أو الحكومة بتقفل عليها حساباتها. مش لازم تبدأ في يناير؛ السنة المالية للحكومة المصرية مثلًا بتبدأ أول يوليو.', '', ''],
    ['company', 'اليونيكورن', 'Unicorn', 'لقب لأي شركة ناشئة خاصة وصل تقييمها مليار دولار أو أكتر قبل ما تنزل البورصة.', '', ''],
    ['company', 'الاندماج والاستحواذ', 'M&A', 'الاستحواذ: شركة تشتري شركة تانية أو حصة مسيطرة فيها. الاندماج: شركتين يبقوا شركة واحدة. ده من أشهر طرق «الخروج» للمستثمرين.', '', ''],
    ['company', 'الأسهم للموظفين', 'ESOP / Stock options', 'نظام بيدي الموظف حق امتلاك أسهم في الشركة بعد فترة معينة (Vesting)، عشان يفضل فيها ويحس إنه شريك في نجاحها.', '', ''],

    /* ---------------- Shark Tank vocabulary ---------------- */
    ['shark', 'الطلب (الآسك)', 'The Ask', 'أول جملة يقولها صاحب المشروع: «أنا طالب مبلغ كذا مقابل نسبة كذا من شركتي». المبلغ والنسبة دول بيحددوا التقييم على طول.', '«طالب 2 مليون مقابل 10%» ← التقييم 20 مليون.', ''],
    ['shark', 'إزاي تحسب التقييم في ثانية', 'Valuation math', 'اقسم المبلغ المطلوب على النسبة المعروضة: المبلغ ÷ النسبة = قيمة الشركة كلها. ده أول حساب بيعمله المستثمرين في دماغهم.', '500 ألف مقابل 20% ← 500,000 ÷ 0.20 = 2.5 مليون.', ''],
    ['shark', 'الحصة (الإكويتي)', 'Equity', 'نسبة الملكية اللي المستثمر بياخدها في الشركة مقابل فلوسه. 25% إكويتي يعني ربع الشركة وربع أرباحها وربع قيمتها لو اتباعت.', '', ''],
    ['shark', 'قبل وبعد الاستثمار', 'Pre-money / Post-money', 'Post-money هو تقييم الشركة بعد ما فلوس المستثمر تدخل. Pre-money قبلها: Post ناقص مبلغ الاستثمار.', 'مليون مقابل 20% ← Post = 5 مليون، Pre = 4 مليون.', ''],
    ['shark', 'العرض المضاد', 'Counter-offer', 'لما المستثمر يقول «أنا هدفع المبلغ بس عايز نسبة أكبر» أو العكس. هنا يبدأ التفاوض، وصاحب المشروع يقرر يقبل أو يرد بعرض تاني.', '', ''],
    ['shark', 'صفقة الإتاوة', 'Royalty deal', 'بدل ما ياخد نسبة كبيرة من الشركة، المستثمر ياخد مبلغ ثابت أو نسبة من كل قطعة تتباع لحد ما يسترد فلوسه وأكتر.', 'مثلًا 5 جنيه عن كل منتج لحد ما يرجع ضعف استثماره.', ''],
    ['shark', 'صفقة القرض', 'Debt deal', 'المستثمر يسلّف الشركة الفلوس بفايدة بدل ما ياخد منها حصة كبيرة. صاحب المشروع يحتفظ بملكيته بس لازم يسدد.', '', ''],
    ['shark', '«أنا خارج»', "I'm out", 'الجملة الأشهر في البرنامج: المستثمر بيعلن إنه مش هيستثمر، وبيقول السبب غالبًا: التقييم مبالغ فيه، أو المنتج سهل يتقلد، أو المبيعات ضعيفة.', '', ''],
    ['shark', 'المبيعات حتى الآن', 'Sales to date', 'إجمالي اللي المشروع باعه من أول يوم. ده أول دليل للمستثمر إن في ناس فعلًا بتشتري المنتج مش مجرد فكرة حلوة.', '', ''],
    ['shark', 'تكلفة البضاعة المباعة', 'COGS', 'تكلفة تصنيع القطعة الواحدة (خامات وتصنيع وتغليف). المستثمرين دايمًا بيسألوا «بتصنعها بكام وبتبيعها بكام؟».', 'تكلفة 30 وبيع 100 ← هامش إجمالي 70%.', ''],
    ['shark', 'سعر الجملة والقطاعي', 'Wholesale vs Retail', 'القطاعي هو السعر اللي المستهلك بيدفعه، والجملة اللي بتبيع بيه للمحلات (غالبًا نص القطاعي أو أقل). لازم هامشك يكفي الاتنين.', '', ''],
    ['shark', 'براءة الاختراع', 'Patent', 'حماية قانونية بتمنع غيرك يقلّد اختراعك لعدد سنين. المستثمرين بيحبوها لأنها بتصعّب على المنافسين يدخلوا.', '', ''],
    ['shark', 'إثبات الفكرة', 'Proof of concept', 'دليل عملي إن الفكرة شغالة والناس عايزاها: مبيعات حقيقية، طلبات مسبقة، أو تجربة ناجحة. من غيره المستثمر بيعتبرها مجرد حلم.', '', ''],
    ['shark', 'التخفيف', 'Dilution', 'كل ما الشركة تدخل مستثمر جديد وتطلع أسهم جديدة، نسبة الملاك القدام بتقل — بس لو التقييم زاد، قيمة حصتهم ممكن تزيد رغم إن النسبة قلّت.', '', ''],
    ['shark', 'استراتيجية الخروج', 'Exit strategy', 'إزاي المستثمر هيرجّع فلوسه بمكسب في الآخر: بيع الشركة لشركة أكبر، طرحها في البورصة، أو بيع حصته لمستثمر تاني.', '', ''],
    ['shark', 'الشريك الاستراتيجي', 'Strategic partner', 'مستثمر بيقدم أكتر من الفلوس: خبرة في المجال، مصانع، توزيع، أو علاقات. ساعات صاحب المشروع يقبل نسبة أكبر عشان «الشارك» المناسب.', '', ''],
    ['shark', 'الترخيص', 'Licensing', 'بدل ما تصنّع وتبيع بنفسك، تدّي شركة كبيرة حق تصنيع منتجك أو استخدام علامتك مقابل نسبة من كل بيعة.', '', ''],
    ['shark', 'المخزون', 'Inventory', 'البضاعة المتخزنة اللي لسه متباعتش. مخزون كبير معناه فلوس محبوسة على الرف، والمستثمرين بيقلقوا منه.', '', ''],
    ['shark', 'التوزيع', 'Distribution', 'إزاي المنتج بيوصل للعميل: محلات، سوبر ماركت، أونلاين، موزعين. كتير من الصفقات بتتعمل عشان المستثمر عنده قنوات توزيع جاهزة.', '', ''],
    ['shark', 'تكلفة الاستحواذ على العميل', 'Customer acquisition', 'بتصرف كام عشان تجيب عميل؟ لو بتصرف 200 إعلانات عشان تبيع منتج ربحه 50، يبقى المشروع بيخسر مع كل بيعة.', '', ''],
    ['shark', 'الصفقة المشروطة', 'Contingent deal', 'عرض مربوط بشرط: «هستثمر لو جبت عقد مع سلسلة كذا» أو «لو براءة الاختراع اتقبلت». الفلوس متدخلش غير لما الشرط يتحقق.', '', ''],
    ['shark', 'الشراكة بين اتنين شاركس', 'Joint offer', 'أحيانًا مستثمرين اتنين يدخلوا مع بعض ويقسموا المبلغ والنسبة، فالمشروع ياخد فلوس وخبرة الاتنين.', '', ''],
    ['shark', 'التقييم المبالغ فيه', 'Overvaluation', 'لما صاحب المشروع يطلب تقييم أكبر بكتير من مبيعاته وأرباحه. من أكتر أسباب «أنا خارج»: الشركة بتبيع مليون في السنة وطالب تقييم 50 مليون.', '', ''],
    ['shark', 'مضاعف المبيعات', 'Sales multiple', 'طريقة سريعة للتقييم: قيمة الشركة كام ضعف مبيعاتها السنوية. 3 أضعاف مثلًا شائعة للمشاريع العادية، والتكنولوجيا سريعة النمو ممكن تاخد أكتر.', 'مبيعات سنوية 2 مليون × 3 ← تقييم حوالي 6 مليون.', ''],
    ['shark', 'القابلية للتوسع', 'Scalability', 'هل المشروع يقدر يكبر 10 أضعاف من غير ما التكاليف تكبر بنفس النسبة؟ تطبيق موبايل مثلًا أسهل يتوسع من مطعم.', '', ''],

    /* ---------------- saving wisdom ---------------- */
    ['wisdom', 'قاعدة الـ 48 ساعة', '48-hour rule', 'أي حاجة مش ضرورية ونفسك فيها، استنى 48 ساعة قبل ما تشتريها. نص الرغبات بتختفي لوحدها.', '', ''],
    ['wisdom', 'القرش الأبيض', 'Save for a rainy day', '«القرش الأبيض ينفع في اليوم الإسود». حتى لو بتدخر 5% بس من دخلك، الاستمرار أهم من المبلغ.', '', ''],
    ['wisdom', 'على قد لحافك', 'Live within your means', '«على قد لحافك مد رجليك» هي أقدم قاعدة ميزانية: صرفك لازم يمشي ورا دخلك، مش ورا اللي الناس بتصرفه.', '', ''],
    ['wisdom', 'وارن بافيت', 'Warren Buffett', '«متدخرش اللي يفضل بعد الصرف، اصرف اللي يفضل بعد الادخار». — وارن بافيت', '', ''],
    ['wisdom', 'التكلفة بساعات الشغل', 'Price in work hours', 'قبل ما تشتري حاجة، احسب تمنها بساعات شغلك. لو بتكسب 60 جنيه في الساعة، جزمة بـ 1,800 = 30 ساعة شغل. لسه عايزها؟', '', ''],
    ['wisdom', 'السوبر ماركت والجوع', 'Never shop hungry', 'متنزلش السوبر ماركت وانت جعان ومن غير ليستة. الدراسات بتقول إنك هتشتري أكتر بكتير من اللي محتاجه.', '', ''],
    ['wisdom', 'الاشتراكات المنسية', 'Forgotten subscriptions', 'راجع اشتراكاتك كل شهر (تطبيقات، منصات، باقات). اشتراك 99 جنيه مش بتستخدمه = حوالي 1,200 جنيه في السنة.', '', ''],
    ['wisdom', 'بنجامين فرانكلين', 'Benjamin Franklin', '«احذر من المصاريف الصغيرة، فالتسريب الصغير يُغرق السفينة الكبيرة». — بنجامين فرانكلين', '', ''],
    ['wisdom', 'الخصم مش توفير', 'A discount is not saving', 'لو اشتريت حاجة مش محتاجها عشان عليها خصم 50%، انت مكسبتش 50%، انت صرفت 50%.', '', ''],
    ['wisdom', 'ابدأ صغير', 'Start small', 'متستناش مرتب أكبر عشان تبدأ تدخر. ادخار 20 جنيه في اليوم = أكتر من 7,000 في السنة من غير ما تحس.', '', ''],
    ['wisdom', 'افصل حساب الادخار', 'Separate your savings', 'خلّي فلوس الادخار في حساب أو مكان منفصل عن فلوس الصرف اليومي. اللي مش قدام عينك أسهل متصرفوش.', '', ''],
    ['wisdom', 'مقارنة الناس', 'Comparison trap', 'أسرع طريقة تبوّظ ميزانيتك إنك تصرف عشان تبان زي غيرك. الناس بتشوف صرفك، بس محدش بيشوف مدخراتك ولا ديونك.', '', ''],
    ['wisdom', 'روبرت كيوساكي', 'Robert Kiyosaki', '«المهم مش قد إيه بتكسب، المهم قد إيه بتحتفظ بيه، وقد إيه بيشتغلك، ولكام جيل». — روبرت كيوساكي', '', ''],
    ['wisdom', 'الكاش بيوجع أكتر', 'Pay with cash', 'لما تدفع كاش بتحس بالفلوس وهي خارجة، فبتصرف أقل من الكارت. جرّب أسبوع تدفع الترفيه كاش بس.', '', ''],
    ['wisdom', 'الزيادة للادخار', 'Save your raises', 'لما مرتبك يزيد، حوّل الزيادة أو نصها للادخار قبل ما تتعود عليها. انت كنت عايش من غيرها امبارح.', '', ''],
    ['wisdom', 'سجّل كل جنيه', 'Track every pound', 'اللي مبيتقاسش مبيتحسنش. مجرد إنك تسجل مصاريفك كل يوم بيقللها، لأنك بتبقى واعي بكل قرار.', '', ''],
    ['wisdom', 'الجودة توفير', 'Buy quality', 'الحاجة الرخيصة اللي بتتغير كل شوية ممكن تكلفك أكتر من حاجة أغلى بتعيش سنين. احسب التكلفة على مدة الاستخدام.', '', ''],
    ['wisdom', 'هدف بإسم', 'Name your goal', 'سمّي هدف الادخار: «عربية»، «جواز»، «طوارئ». الهدف اللي ليه اسم ومبلغ وميعاد أسهل تلتزم بيه من «هحوّش وخلاص».', '', ''],
    ['wisdom', 'أكل البيت', 'Cook at home', 'وجبة الدليفري الواحدة ممكن تساوي أكل يومين في البيت. تقليل الطلبات مرتين في الأسبوع بيفرق آلاف في السنة.', '', ''],
    ['wisdom', 'سقراط', 'Socrates', '«القناعة ثروة طبيعية، والترف فقر مصطنع». — سقراط', '', ''],
    ['wisdom', 'المصاريف السنوية', 'Annual expenses', 'مصاريف المدارس والتأمين والصيانة والأعياد معروفة مسبقًا. قسّمها على 12 وحوّش جزءها كل شهر بدل ما تتفاجئ بيها.', '', ''],
    ['wisdom', 'كلمة «لأ»', 'Learn to say no', 'مش لازم توافق على كل خروجة أو جمعية أو سلفة. «لأ» بأدب أحيانًا هي أذكى قرار مالي تاخده في الأسبوع.', '', ''],
    ['wisdom', 'السلف والأصحاب', 'Lending to friends', 'متسلّفش غير المبلغ اللي تقدر تستغنى عنه لو مرجعش. وسجّله في «الديون والسلف» عشان ميضيعش لا الفلوس ولا الصحوبية.', '', ''],
    ['wisdom', 'آخر الشهر', 'End-of-month review', 'خصص 10 دقايق آخر كل شهر تراجع فيها: صرفت فين أكتر؟ إيه اللي ممكن يتقلل؟ إيه هدف الشهر الجاي؟', '', ''],
    ['wisdom', 'الاستثمار في نفسك', 'Invest in yourself', '«الاستثمار في المعرفة بيدّي أعلى عائد». — بنجامين فرانكلين. كورس أو مهارة جديدة ممكن تزوّد دخلك أكتر من أي شهادة بنكية.', '', '']
  ];

  /* round-robin order across categories → variety, no repeats */
  var ORDER = (function () {
    var by = {}; CAT_ORDER.forEach(function (c) { by[c] = []; });
    T.forEach(function (t, i) { if (by[t[0]]) by[t[0]].push(i); });
    var out = [], k = 0, left = T.length;
    while (left > 0) { CAT_ORDER.forEach(function (c) { if (by[c].length > k) { out.push(by[c][k]); left--; } }); k++; }
    return out;
  })();
  BP.tips = T; BP.tipsOrder = ORDER;

  /* ------------------------------------------------------------------ settings & timing */
  var FREQ = {
    '3w': { n: '3 مرات أسبوعيًا', days: [6, 1, 3] },  // Sat · Mon · Wed
    '2w': { n: 'مرتين أسبوعيًا', days: [6, 3] },      // Sat · Wed
    '1w': { n: 'مرة أسبوعيًا', days: [6] },           // Sat
    'daily': { n: 'كل يوم', days: [0, 1, 2, 3, 4, 5, 6] },
    'off': { n: 'إيقاف', days: [] }
  };
  var TIMES = { auto: 'تلقائي (الأنسب)', '13:30': 'الظهر 1:30', '19:00': 'المساء 7:00', '21:00': 'بالليل 9:00' };
  var TIP_BASE = 3000, TIP_MAX = 16, HORIZON = 14;

  function ensure() {
    if (typeof appData === 'undefined') return;
    if (!FREQ[appData.tipsFreq]) appData.tipsFreq = '3w';
    if (!TIMES[appData.tipsTime]) appData.tipsTime = 'auto';
    if (!appData.tipsStart) { appData.tipsStart = ymd(new Date()); save(); }
  }
  function ymd(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function parseYmd(s) { var p = String(s || '').split('-').map(Number); return new Date(p[0], (p[1] || 1) - 1, p[2] || 1, 12); }
  function mins(hm) { var p = String(hm).split(':').map(Number); return (p[0] || 0) * 60 + (p[1] || 0); }
  function dayNum(d) { return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5); }

  /* Effective time of day (minutes) — keeps ≥ 90 min away from the daily reminder. */
  function tipMinutes() {
    var dailyOn = appData.notificationsEnabled && appData.notifDaily;
    var dm = mins(appData.notifDailyTime || '20:00');
    var far = function (m) { return !dailyOn || Math.abs(m - dm) >= 90; };
    if (appData.tipsTime !== 'auto') {
      var m = mins(appData.tipsTime);
      if (dailyOn && Math.abs(m - dm) < 30) m = dm + 45 <= 22 * 60 ? dm + 45 : dm - 45;   // never together with the reminder
      return m;
    }
    var cands = [19 * 60, 21 * 60, 18 * 60, 21 * 60 + 30, 13 * 60 + 30];   // evening first; midday only as a last resort
    for (var i = 0; i < cands.length; i++) if (far(cands[i])) return cands[i];
    return 13 * 60 + 30;
  }
  /* Planned tip moments in the next `horizon` days (phone clock), each with its tip index. */
  function plan(horizon) {
    ensure();
    var f = FREQ[appData.tipsFreq] || FREQ['3w'], out = [];
    if (!f.days.length) return out;
    var tm = tipMinutes(), now = new Date(), start = parseYmd(appData.tipsStart);
    var startN = dayNum(start), todayN = dayNum(now);
    // slot counter: number of planned days since tips were enabled (stateless & stable across re-plans)
    var slot = 0;
    for (var n = startN + 1; n < todayN; n++) { if (f.days.indexOf(new Date(n * 864e5 + 43200000).getUTCDay()) >= 0) slot++; }
    for (var i = 0; i <= horizon; i++) {
      var d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, Math.floor(tm / 60), tm % 60, 0, 0);
      var dn = dayNum(d);
      if (dn <= startN) continue;                         // never on the day the tips were enabled
      if (f.days.indexOf(d.getDay()) < 0) continue;
      var s = slot; slot++;
      if (d.getTime() <= now.getTime() + 60000) continue; // already passed today
      out.push({ at: d, idx: ORDER[s % ORDER.length], slot: s });
    }
    return out;
  }
  BP.tipsPlan = plan;

  function shortText(s) {
    var cut = s.search(/[.؟!](\s|$)/);
    var t = cut > 20 && cut < 130 ? s.slice(0, cut + 1) : s;
    return t.length > 130 ? t.slice(0, 127).replace(/\s+\S*$/, '') + '…' : t;
  }
  function notifTitle(t) { var c = CATS[t[0]]; return c.ic + ' ' + c.n + ': ' + t[1]; }

  var _chan = false;
  function ensureTipChannel() {
    var L = LN(); if (!L || _chan) return; _chan = true;
    L.createChannel({ id: 'tips', name: 'معلومات ونصائح مالية', description: 'معلومة مالية خفيفة كل كام يوم: ميزة في التطبيق، حكمة ادخار، أو مصطلح مالي', importance: 3, visibility: 1, vibration: false }).catch(function () {});
  }
  function tipIds() { var a = []; for (var i = 0; i < TIP_MAX; i++) a.push({ id: TIP_BASE + i }); return a; }

  var _busy = null;
  async function scheduleTips() {
    var L = LN(); if (!L) return;
    if (_busy) { try { await _busy; } catch (e) {} }
    _busy = (async function () {
      try { await L.cancel({ notifications: tipIds() }); } catch (e) {}
      if (typeof appData === 'undefined' || !appData.notificationsEnabled || appData.tipsFreq === 'off') return;
      try { var p = await L.checkPermissions(); if (p.display !== 'granted') return; } catch (e) { return; }
      var exact = true; try { exact = BP.exactAllowed ? await BP.exactAllowed() : true; } catch (e) {}
      ensureTipChannel();
      var list = plan(HORIZON).slice(0, TIP_MAX).map(function (p, i) {
        var t = T[p.idx];
        var big = t[3] + (t[4] ? '\n' + t[4] : '');
        return { id: TIP_BASE + i, title: notifTitle(t), body: shortText(t[3]), largeBody: big, summaryText: 'ميزانية Pro+',
          channelId: 'tips', smallIcon: 'ic_stat_notify', iconColor: CATS[t[0]].col, isExactNotification: exact,
          schedule: { at: p.at, allowWhileIdle: true }, extra: { bpTip: p.idx } };
      });
      if (list.length) { try { await L.schedule({ notifications: list }); } catch (e) { console.warn('tips schedule', e); } }
      BP._tipsScheduled = list.map(function (n) { return n.schedule.at; });
    })();
    return _busy;
  }
  BP.scheduleTips = scheduleTips;

  /* Hook into the app's own notification life-cycle */
  function hook(name, after) {
    var orig = W[name]; if (typeof orig !== 'function' || orig._bpTips) return;
    var f = function () { var r = orig.apply(this, arguments); try { Promise.resolve(r).then(function () { after(); }, function () { after(); }); } catch (e) {} return r; };
    f._bpTips = true; W[name] = f;
  }
  function hookAll() {
    hook('scheduleNotifications', function () { scheduleTips(); paintTipsUI(); });
    hook('clearNotificationTimers', function () { scheduleTips(); paintTipsUI(); });  // re-plans (or cancels when notifications are off)
    hook('toggleMainNotifications', function () { paintTipsUI(); });
    hook('toggleNotifOption', function () { scheduleTips(); paintTipsUI(); });
    hook('saveNotifTime', function () { scheduleTips(); paintTipsUI(); });
  }

  /* ------------------------------------------------------------------ settings UI */
  function opt(map, cur) { return Object.keys(map).map(function (k) { var n = typeof map[k] === 'string' ? map[k] : map[k].n; return '<option value="' + k + '"' + (k === cur ? ' selected' : '') + '>' + n + '</option>'; }).join(''); }
  function fmtTime(m) { var h = Math.floor(m / 60), mm = String(m % 60).padStart(2, '0'); var ap = h >= 12 ? 'م' : 'ص'; var h12 = h % 12 || 12; return h12 + ':' + mm + ' ' + ap; }
  function fmtDay(d) {
    var now = new Date(), diff = dayNum(d) - dayNum(now);
    if (diff === 0) return 'النهارده'; if (diff === 1) return 'بكرة';
    try { return d.toLocaleDateString('ar-EG-u-nu-latn', { weekday: 'long', day: 'numeric', month: 'long' }); } catch (e) { return ymd(d); }
  }
  function injectTipsUI() {
    ensure();
    var sub = $('notif-sub-settings');
    if (sub && !$('bp-tips-box')) {
      var box = document.createElement('div'); box.id = 'bp-tips-box'; box.className = 'bp-tips-box';
      box.innerHTML =
        '<div class="bp-tips-head"><div><div class="sr-label">💡 معلومة مالية من وقت للتاني</div>' +
        '<div class="sr-desc">ميزة في التطبيق، حكمة ادخار، مصطلح مالي، أو من عالم الشركات وشارك تانك</div></div></div>' +
        '<div class="bp-tips-grid"><label>كام مرة؟<select id="bp-tips-freq" onchange="BP.setTipsFreq(this.value)">' + opt(FREQ, appData.tipsFreq) + '</select></label>' +
        '<label>إمتى؟<select id="bp-tips-time" onchange="BP.setTipsTime(this.value)">' + opt(TIMES, appData.tipsTime) + '</select></label></div>' +
        '<div class="bp-tips-next" id="bp-tips-next"></div>' +
        '<div class="bp-tips-btns"><button class="action-btn outline" onclick="BP.openTipsLibrary()">📚 القاموس المالي</button>' +
        '<button class="action-btn outline" onclick="BP.showTip()">👀 معلومة دلوقتي</button></div>';
      var testBtn = sub.querySelector('button[onclick^="sendTestNotification"]');
      sub.insertBefore(box, testBtn || null);
    }
    var tools = document.querySelector('.bp-tools');
    if (tools && !$('bp-tools-lib')) {
      var b = document.createElement('button'); b.id = 'bp-tools-lib'; b.setAttribute('onclick', 'BP.openTipsLibrary()');
      b.innerHTML = '<span>📚</span>القاموس المالي'; tools.appendChild(b);
    }
    paintTipsUI();
  }
  function paintTipsUI() {
    var el = $('bp-tips-next'); if (!el || typeof appData === 'undefined') return;
    var fq = $('bp-tips-freq'); if (fq && fq.value !== appData.tipsFreq) fq.value = appData.tipsFreq;
    var tt = $('bp-tips-time'); if (tt && tt.value !== appData.tipsTime) tt.value = appData.tipsTime;
    if (appData.tipsFreq === 'off') { el.textContent = 'المعلومات المالية متوقفة. تقدر تقراها في أي وقت من «القاموس المالي».'; return; }
    var p = plan(HORIZON);
    if (!p.length) { el.textContent = ''; return; }
    var n = p[0], line = '🗓️ الجاية: ' + fmtDay(n.at) + ' — ' + fmtTime(n.at.getHours() * 60 + n.at.getMinutes());
    if (appData.tipsTime === 'auto' && appData.notifDaily) line += ' (بعيد عن التذكير اليومي)';
    el.textContent = line;
  }
  BP.setTipsFreq = function (v) {
    if (!FREQ[v]) return; appData.tipsFreq = v; save(); scheduleTips(); paintTipsUI();
    if (typeof showToast === 'function') showToast(v === 'off' ? 'تم إيقاف المعلومات المالية' : '💡 تمام — ' + FREQ[v].n, 'success');
  };
  BP.setTipsTime = function (v) { if (!TIMES[v]) return; appData.tipsTime = v; save(); scheduleTips(); paintTipsUI(); };

  /* ------------------------------------------------------------------ tip card & library */
  var GO = {
    quick: ['سجّل مصروف', function () { if (typeof showQuickEntry === 'function') showQuickEntry('expense'); }],
    ai: ['افتح المساعد', function () { nav('ai'); }],
    debts: ['افتح الديون', function () { BP.openDebts && BP.openDebts(); }],
    zakat: ['افتح الحاسبة', function () { BP.openZakat && BP.openZakat(); }],
    catb: ['حدد الحدود', function () { BP.openCatBudgets && BP.openCatBudgets(); }],
    recurring: ['افتحها', function () { nav('settings', 'recurring-section'); }],
    table: ['افتح الجدول', function () { nav('table'); }],
    stats: ['افتح الإحصائيات', function () { nav('stats'); }],
    settings: ['افتح الإعدادات', function () { nav('settings'); }],
    tour: ['ابدأ الشرح', function () { BP.replayTour && BP.replayTour(); }],
    lib: ['افتح القاموس', function () { BP.openTipsLibrary(); }]
  };
  function nav(page, scrollId) {
    try { (typeof bnNavigate === 'function' ? bnNavigate : switchPage)(page); } catch (e) {}
    if (scrollId) setTimeout(function () { var s = $(scrollId); if (s) s.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 900);
  }
  var _cur = 0;
  BP.showTip = function (idx) {
    if (!BP.sheet) return;
    if (idx == null || !T[idx]) {   // "a tip now" → the next one that hasn't been planned yet, rotating
      ensure(); appData.tipsManual = ((appData.tipsManual || 0) + 1) % ORDER.length; save();
      idx = ORDER[(ORDER.length - 1 - appData.tipsManual + ORDER.length) % ORDER.length];
    }
    _cur = idx;
    var t = T[idx], c = CATS[t[0]], go = t[5] && GO[t[5]];
    var html = '<div class="bp-tip-card"><span class="bp-tip-badge" style="background:' + c.col + '">' + c.ic + ' ' + esc(c.n) + '</span>' +
      '<div class="bp-tip-title">' + esc(t[1]) + '</div>' + (t[2] ? '<div class="bp-tip-en">' + esc(t[2]) + '</div>' : '') +
      '<div class="bp-tip-body">' + esc(t[3]) + '</div>' + (t[4] ? '<div class="bp-tip-ex">💬 ' + esc(t[4]) + '</div>' : '') + '</div>' +
      '<div class="bp-tip-actions">' + (go ? '<button class="action-btn primary" onclick="BP._tipGo()">' + go[0] + '</button>' : '') +
      '<button class="action-btn outline" onclick="BP._tipNext()">معلومة تانية ←</button></div>';
    BP.sheet('bp-tip-sheet', '💡 معلومة مالية', html);
  };
  BP._tipGo = function () { var t = T[_cur], go = t && t[5] && GO[t[5]]; BP.closeSheet('bp-tip-sheet'); if (go) setTimeout(go[1], 250); };
  BP._tipNext = function () { var p = ORDER.indexOf(_cur); BP.showTip(ORDER[(p + 1) % ORDER.length]); };

  var _libCat = 'all', _libQ = '';
  BP.openTipsLibrary = function () {
    if (!BP.sheet) return;
    _libCat = 'all'; _libQ = '';
    var chips = '<button data-c="all" class="on">الكل (' + T.length + ')</button>' + CAT_ORDER.map(function (k) {
      var n = T.filter(function (t) { return t[0] === k; }).length;
      return '<button data-c="' + k + '">' + CATS[k].ic + ' ' + CATS[k].n + ' (' + n + ')</button>';
    }).join('');
    var html = '<input class="bp-lib-search" id="bp-lib-q" type="search" placeholder="🔎 دوّر على مصطلح… مثلًا: التقييم، Valuation، تضخم" oninput="BP._libFilter(null, this.value)">' +
      '<div class="bp-lib-chips" id="bp-lib-chips">' + chips + '</div><div class="bp-lib-list" id="bp-lib-list"></div>';
    BP.sheet('bp-lib-sheet', '📚 القاموس المالي', html);
    var ch = $('bp-lib-chips');
    ch.addEventListener('click', function (e) { var b = e.target.closest('button[data-c]'); if (b) BP._libFilter(b.getAttribute('data-c'), null); });
    paintLib();
  };
  BP._libFilter = function (cat, q) {
    if (cat != null) { _libCat = cat; [].forEach.call(document.querySelectorAll('#bp-lib-chips button'), function (b) { b.classList.toggle('on', b.getAttribute('data-c') === cat); }); }
    if (q != null) _libQ = q;
    paintLib();
  };
  function norm(s) { return String(s || '').toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/[\u064B-\u0652]/g, ''); }
  function paintLib() {
    var list = $('bp-lib-list'); if (!list) return;
    var q = norm(_libQ.trim()), html = '';
    ORDER.slice().sort(function (a, b) { return CAT_ORDER.indexOf(T[a][0]) - CAT_ORDER.indexOf(T[b][0]) || a - b; }).forEach(function (i) {
      var t = T[i];
      if (_libCat !== 'all' && t[0] !== _libCat) return;
      if (q && norm(t[1] + ' ' + t[2] + ' ' + t[3]).indexOf(q) < 0) return;
      html += '<button class="bp-lib-item" onclick="BP.showTip(' + i + ')"><span class="li-ic">' + CATS[t[0]].ic + '</span><span><b>' + esc(t[1]) +
        (t[2] ? ' <span style="font-weight:500;opacity:.6;font-size:12px">· ' + esc(t[2]) + '</span>' : '') + '</b><small>' + esc(shortText(t[3])) + '</small></span></button>';
    });
    list.innerHTML = html || '<div class="bp-lib-empty">مفيش نتايج — جرّب كلمة تانية</div>';
  }

  /* ------------------------------------------------------------------ notification tap → open the tip in full */
  function openFromNotif(idx) {
    var tries = 0;
    (function go() {
      var lock = $('bp-lock'), intro = $('intro-overlay');
      var blocked = (lock && lock.classList.contains('show')) || (intro && !intro.classList.contains('hidden')) || !BP.sheet;
      if (blocked && tries++ < 120) { setTimeout(go, 500); return; }
      BP.showTip(idx);
    })();
  }
  if (isNative && LN()) {
    try {
      LN().addListener('localNotificationActionPerformed', function (e) {
        var x = e && e.notification && e.notification.extra;
        if (x && x.bpTip != null && T[x.bpTip]) openFromNotif(+x.bpTip);
      });
    } catch (e) {}
  }

  /* ------------------------------------------------------------------ boot */
  function boot() {
    hookAll(); ensure(); injectTipsUI();
    if (isNative) {
      ensureTipChannel();
      setTimeout(scheduleTips, 1500);   // later re-plans ride on the app's own scheduleNotifications (open/close)
    }
    setInterval(paintTipsUI, 5 * 60000);
  }
  document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 60); });
})();
