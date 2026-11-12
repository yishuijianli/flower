/* 知花屿 · 公共层：路径、导航页脚、图片位降级、通用工具 */
(function () {
  'use strict';

  // 每个页面在 <body> 上声明 data-base：前台 "."，admin/ 子目录 ".."
  var BASE = document.body.dataset.base || '.';
  function P(path) { return BASE + '/' + path; }

  /* ---------- 花名配色主题 ----------
     一支花名色 = 深墨（文字/按钮）+ 中调（色条/指标）+ 本色（大面积淡色做面），全部同色相
     只换色，不换纸墨；六支色谱见 common.css 顶部注释 */
  var THEMES = [
    { key: 'haitang',   name: '海棠',   desc: '水洗淡紫红，深墨到本色', a: '#A8324A', t: '#E9A3AE' },
    { key: 'zhizi',     name: '栀子',   desc: '果实暖黄橙，深墨到本色', a: '#A05B14', t: '#F0B072' },
    { key: 'songhua',   name: '松花',   desc: '松花嫩黄，深墨到本色',   a: '#7C6A0D', t: '#E2D46B' },
    { key: 'oubi',      name: '欧碧',   desc: '极浅豆绿，深墨到本色',   a: '#4E6431', t: '#C4D49C' },
    { key: 'yuanwei',   name: '鸢尾蓝', desc: '蓝紫交融，深墨到本色',   a: '#3E5187', t: '#A9B6DA' },
    { key: 'dingxiang', name: '丁香',   desc: '素雅淡紫，深墨到本色',   a: '#6A4F80', t: '#C0A9CA' }
  ];
  var THEME_KEY = 'flora_theme';
  var THEME_KEYS = THEMES.map(function (x) { return x.key; });
  function themeOf() {
    // 链接带 ?theme=zhizi 可直接指定配色（方便把某一版发给别人看）
    var fromUrl = new URLSearchParams(window.location.search).get('theme');
    if (fromUrl && THEME_KEYS.indexOf(fromUrl) > -1) return fromUrl;
    var t = null;
    try { t = localStorage.getItem(THEME_KEY); } catch (e) { /* 隐私模式 */ }
    return THEME_KEYS.indexOf(t) > -1 ? t : 'haitang';
  }
  function applyTheme(key) {
    if (THEME_KEYS.indexOf(key) < 0) key = 'haitang';
    document.documentElement.setAttribute('data-theme', key);
    try { localStorage.setItem(THEME_KEY, key); } catch (e) { /* 忽略 */ }
  }
  applyTheme(themeOf());

  // 网站标识：书法「知花」字抠图（透明底 PNG，203×109）
  var MARK = '<img class="brand-mark brand-mark-img" src="' + P('assets/img/brand-zhihua.png') + '" alt="知花屿标识" aria-hidden="true">';

  var SEARCH_ICON = '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true">' +
    '<circle cx="7" cy="7" r="4.6" stroke="currentColor" stroke-width="1.4"/>' +
    '<path d="M10.5 10.5L14 14" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function qs(key) {
    return new URLSearchParams(window.location.search).get(key) || '';
  }

  function toast(msg, isError) {
    var el = document.querySelector('.toast:not(.undo-toast)');
    if (!el) {
      el = document.createElement('div');
      el.className = 'toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.className = 'toast' + (isError ? ' error' : '') + ' show';
    clearTimeout(el._timer);
    el._timer = setTimeout(function () { el.classList.remove('show'); }, 2400);
  }

  /** 生成一个图片位：图片存在则显示图片，不存在则保留带说明的占位框 */
  function imgSlot(file, label, hint, cls) {
    return '<div class="img-slot ' + (cls || '') + '" data-img="' + esc(file) + '" data-alt="' + esc(label) + '">' +
      '<span class="slot-label">' + esc(label) + '<small>' + esc(hint || '图片待提供') + '</small></span></div>';
  }

  /** 图片字段解析成地址：media:xxx 走后台上传的素材，其余按 assets/img/ 下的文件名 */
  function imgSrc(ref) {
    var s = String(ref == null ? '' : ref);
    if (s.indexOf('media:') === 0 && window.FloraMedia) {
      var u = window.FloraMedia.urlOf(s);
      if (u) return u;
    }
    return P('assets/img/' + s);
  }

  /** 探测真实图片；不存在时占位框保持不变 */
  function initImages(root) {
    (root || document).querySelectorAll('.img-slot[data-img]').forEach(function (slot) {
      if (slot.dataset.done) return;
      slot.dataset.done = '1';
      var img = new Image();
      img.alt = slot.dataset.alt || '';
      img.onload = function () {
        slot.appendChild(img);
        slot.classList.add('is-loaded');
      };
      img.onerror = function () { /* 保留占位框，等待组员放图 */ };
      img.src = imgSrc(slot.dataset.img);
    });
  }

  function themePickerHTML() {
    var cur = themeOf();
    var item = function (t) {
      return '<button class="theme-item" type="button" data-theme="' + t.key + '"' +
        ' aria-pressed="' + (t.key === cur ? 'true' : 'false') + '" title="' + esc(t.desc) + '">' +
        '<span class="theme-dot" style="background:' + t.a + '"></span>' +
        '<span class="theme-dot theme-dot-tint" style="background:' + t.t + '"></span>' +
        '<span class="theme-name">' + esc(t.name) + '</span></button>';
    };
    return '<div class="theme-picker" id="themePicker">' +
      '<button class="theme-toggle" type="button" id="themeToggle" aria-expanded="false" aria-haspopup="true" aria-label="切换花名配色" title="换一套花名配色">' +
        '<span class="theme-swatch" aria-hidden="true"></span></button>' +
      '<div class="theme-menu" id="themeMenu" hidden>' +
        '<p class="theme-menu-title">花名配色 · 深墨 / 本色</p>' +
        '<div class="theme-menu-list">' + THEMES.map(item).join('') + '</div>' +
        '<p class="theme-menu-note">六色取自传统花名：海棠、栀子、松花、欧碧、鸢尾蓝、丁香。淡色只做底，深墨供阅读。</p>' +
      '</div></div>';
  }

  function initThemePicker(root) {
    var picker = root.querySelector('#themePicker');
    if (!picker) return;
    var toggle = picker.querySelector('#themeToggle');
    var menu = picker.querySelector('#themeMenu');
    function close() {
      menu.hidden = true;
      toggle.setAttribute('aria-expanded', 'false');
      picker.classList.remove('is-open');
    }
    function open() {
      menu.hidden = false;
      toggle.setAttribute('aria-expanded', 'true');
      picker.classList.add('is-open');
    }
    toggle.addEventListener('click', function (e) {
      e.stopPropagation();
      if (menu.hidden) open(); else close();
    });
    menu.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-theme]');
      if (!btn) return;
      e.stopPropagation();
      applyTheme(btn.dataset.theme);
      menu.querySelectorAll('[data-theme]').forEach(function (b) {
        b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
      });
      close();
    });
    document.addEventListener('click', function (e) {
      if (!menu.hidden && !picker.contains(e.target)) close();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') close();
    });
  }

  function renderHeader(active) {
    var el = document.getElementById('siteHeader');
    if (!el) return;
    var nav = [
      { key: 'home', label: '首页', href: P('index.html') },
      { key: 'list', label: '花卉图鉴', href: P('flowers.html') },
      { key: 'filter', label: '花色筛选', href: P('filter.html') },
      { key: 'picks', label: '本月精选', href: P('index.html') + '#picks' },
      { key: 'about', label: '关于我们', href: P('index.html') + '#about' }
    ];
    el.className = 'site-header';
    el.innerHTML =
      '<div class="wrap">' +
        '<a class="brand" href="' + P('index.html') + '">' + MARK +
          '<span class="brand-name">屿</span><span class="brand-divider"></span>' +
          '<span class="brand-sub">花卉图鉴</span></a>' +
        '<nav class="nav-links">' + nav.map(function (n) {
          return '<a class="' + (n.key === active ? 'active' : '') + '" href="' + n.href + '">' + n.label + '</a>';
        }).join('') + '</nav>' +
        '<div class="header-tools">' +
          '<form class="search-box" id="headerSearch">' + SEARCH_ICON +
            '<input type="search" name="q" placeholder="搜索花名 / 诗句" aria-label="搜索花名或诗句"></form>' +
          themePickerHTML() +
          '<a class="btn btn-primary btn-sm" id="headerAdminBtn" href="' + P('admin/login.html') + '">管理后台</a>' +
        '</div>' +
      '</div>';
    initThemePicker(el);
    var form = el.querySelector('#headerSearch');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var q = form.querySelector('[name="q"]').value.trim();
      window.location.href = P('filter.html') + (q ? '?q=' + encodeURIComponent(q) : '');
    });

    // 已登录就直接进后台，别让人再登一次
    var adminBtn = el.querySelector('#headerAdminBtn');
    if (adminBtn && window.FloraAPI && typeof window.FloraAPI.checkAuth === 'function') {
      window.FloraAPI.checkAuth().then(function (r) {
        if (!r || !r.user) return;
        adminBtn.href = P('admin/index.html');
        adminBtn.textContent = '进入后台';
      }).catch(function () { /* 未登录或接口不可用：保持登录入口 */ });
    }
  }

  function renderFooter() {
    var el = document.getElementById('siteFooter');
    if (!el) return;
    el.className = 'site-footer';
    el.innerHTML =
      '<div class="wrap"><div class="footer-grid">' +
        '<div><a class="brand" href="' + P('index.html') + '">' + MARK +
          '<span class="brand-name">屿</span></a>' +
          '<p class="footer-intro">一花一典故，一句一诗心。收录 50 种花的典故、文案与古诗词，供校园植物认知与课程展示使用。</p></div>' +
        '<div><h4>图鉴导航</h4><ul>' +
          '<li><a href="' + P('index.html') + '">网站首页</a></li>' +
          '<li><a href="' + P('flowers.html') + '">花卉列表</a></li>' +
          '<li><a href="' + P('filter.html') + '">花色筛选</a></li>' +
          '<li><a href="' + P('flower-detail.html') + '?id=1">图文详情</a></li></ul></div>' +
        '<div><h4>分类浏览</h4><ul>' +
          '<li><a href="' + P('flowers.html') + '?season=春">春花</a></li>' +
          '<li><a href="' + P('flowers.html') + '?season=夏">夏花</a></li>' +
          '<li><a href="' + P('flowers.html') + '?season=秋">秋花</a></li>' +
          '<li><a href="' + P('flowers.html') + '?season=冬">冬花</a></li></ul></div>' +
        '<div><h4>管理入口</h4><ul id="footerAdminLinks">' +
          '<li><a id="footerAdminEntry" href="' + P('admin/login.html') + '">管理员登录</a></li></ul></div>' +
      '</div>' +
      '<div class="footer-bottom"><span>知花屿 · 课程项目演示站点</span>' +
      '<span>  </span></div></div>';

    // 后台入口：未登录时只显示「管理员登录」；登录后首项改成「管理后台」并追加三个页面
    var adminLinks = el.querySelector('#footerAdminLinks');
    var entry = el.querySelector('#footerAdminEntry');
    if (adminLinks && window.FloraAPI && typeof window.FloraAPI.checkAuth === 'function') {
      window.FloraAPI.checkAuth().then(function (r) {
        if (!r || !r.user) return;
        if (entry) { entry.href = P('admin/index.html'); entry.textContent = '管理后台'; }
        adminLinks.insertAdjacentHTML('beforeend',
          '<li><a href="' + P('admin/categories.html') + '">分类管理</a></li>' +
          '<li><a href="' + P('admin/contents.html') + '">内容管理</a></li>');
      }).catch(function () { /* 未登录或后端不可用：保持隐藏 */ });
    }
  }

  window.Flora = {
    BASE: BASE, P: P, MARK: MARK, esc: esc, qs: qs, toast: toast,
    imgSlot: imgSlot, imgSrc: imgSrc, initImages: initImages,
    renderHeader: renderHeader, renderFooter: renderFooter,
    THEMES: THEMES, theme: themeOf, setTheme: applyTheme
  };
})();
