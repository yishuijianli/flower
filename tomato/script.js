(() => {
  'use strict';

  const STORAGE_KEY = 'tomata_state_v1';
  const FOCUS_MINUTES = 25;
  const FOCUS_MS = FOCUS_MINUTES * 60 * 1000;

  const FLOWERS = {
    rose: { name: '白蔷薇', emoji: '🌹', photo: 'img/a.jpg' },
    bluebell: { name: '蓝铃花', emoji: '🔔', photo: 'img/d.jpg' },
    orchid: { name: '蝴蝶兰', emoji: '🌺', photo: 'img/i.jpg' },
    lily: { name: '粉百合', emoji: '🌷', photo: 'img/s.jpg' },
  };
  const FLOWER_KEYS = Object.keys(FLOWERS);

  // 页面背景：每次打开随机挑一张花卉照片
  const BG_IMAGES = ['a', 'd', 'i', 'q', 'r', 's', 't', 'u', 'w', 'y'].map((n) => `img/${n}.jpg`);

  const els = {
    minutes: document.getElementById('minutes'),
    seconds: document.getElementById('seconds'),
    timerDisplay: document.getElementById('timerDisplay'),
    primaryBtn: document.getElementById('primaryBtn'),
    interruptBtn: document.getElementById('interruptBtn'),
    timerHint: document.getElementById('timerHint'),
    gardenContent: document.getElementById('gardenContent'),
    gardenHint: document.getElementById('gardenHint'),
    encyclopediaGrid: document.getElementById('encyclopediaGrid'),
    encyclopediaCount: document.getElementById('encyclopediaCount'),
    stats: document.getElementById('stats'),
    bloomOverlay: document.getElementById('bloomOverlay'),
    bloomEmoji: document.getElementById('bloomEmoji'),
    bloomText: document.getElementById('bloomText'),
    bloomClose: document.getElementById('bloomClose'),
    toast: document.getElementById('toast'),
  };

  /* ---------------- 状态 ---------------- */

  function defaultState() {
    return {
      planting: null, // { type, progress, plantedAt }
      encyclopedia: {}, // { [type]: { firstAt, lastAt, count } }
      sessions: [], // { at, minutes, type, completed }
      timer: { status: 'idle', remainingMs: FOCUS_MS, endAt: null },
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      const base = defaultState();
      const state = {
        ...base,
        ...parsed,
        encyclopedia:
          parsed.encyclopedia && typeof parsed.encyclopedia === 'object' ? parsed.encyclopedia : {},
        sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
        timer: { ...base.timer, ...(parsed.timer || {}) },
      };
      if (state.planting && !FLOWERS[state.planting.type]) state.planting = null;
      return state;
    } catch (err) {
      return defaultState();
    }
  }

  let state = loadState();

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      /* localStorage 不可用时静默降级 */
    }
  }

  /* ---------------- 计时 ---------------- */

  function currentRemaining() {
    const t = state.timer;
    if (t.status === 'running') return Math.max(0, t.endAt - Date.now());
    return t.remainingMs;
  }

  function updateTimerDisplay(ms) {
    const total = Math.max(0, Math.ceil(ms / 1000));
    els.minutes.textContent = String(Math.floor(total / 60)).padStart(2, '0');
    els.seconds.textContent = String(total % 60).padStart(2, '0');
  }

  /** 花当前的实际进度（包含本次正在计时、尚未落盘的部分） */
  function liveProgress() {
    const p = state.planting;
    if (!p) return 0;
    let prog = p.progress;
    const t = state.timer;
    if (t.status === 'running') {
      prog += (FOCUS_MS - Math.max(0, t.endAt - Date.now())) / FOCUS_MS;
    } else if (t.status === 'paused') {
      prog += (FOCUS_MS - t.remainingMs) / FOCUS_MS;
    }
    return Math.min(1, Math.max(0, prog));
  }

  function tick() {
    if (state.timer.status !== 'running') return;
    const remaining = state.timer.endAt - Date.now();
    if (remaining <= 0) {
      completeSession();
      return;
    }
    updateTimerDisplay(remaining);
    updateLiveProgress();
  }

  function startFocus() {
    if (!state.planting) {
      showToast('先种下一颗种子吧 🌱');
      return;
    }
    if (state.timer.status === 'running') return;
    state.timer.status = 'running';
    state.timer.endAt = Date.now() + state.timer.remainingMs;
    save();
    renderAll();
  }

  function pauseFocus() {
    const t = state.timer;
    if (t.status !== 'running') return;
    t.remainingMs = Math.max(0, t.endAt - Date.now());
    t.status = 'paused';
    t.endAt = null;
    save();
    renderAll();
  }

  function interruptFocus() {
    const t = state.timer;
    if (t.status === 'idle') return;

    const remaining = t.status === 'running' ? Math.max(0, t.endAt - Date.now()) : t.remainingMs;
    const elapsed = Math.max(0, FOCUS_MS - remaining);

    t.status = 'idle';
    t.remainingMs = FOCUS_MS;
    t.endAt = null;

    const bloomed = elapsed > 0 ? growBy(elapsed / FOCUS_MS) : null;
    save();
    renderAll();

    if (bloomed) {
      showBloom(bloomed.type);
    } else if (state.planting) {
      showToast('已中断，花苞保存好了，下次继续 🌾');
    } else {
      showToast('已中断');
    }
  }

  function completeSession() {
    const t = state.timer;
    t.status = 'idle';
    t.remainingMs = FOCUS_MS;
    t.endAt = null;

    const typeBefore = state.planting ? state.planting.type : null;
    let bloomed = null;

    if (state.planting) {
      bloomed = growBy(1);
      state.sessions.push({
        at: Date.now(),
        minutes: FOCUS_MINUTES,
        type: typeBefore,
        completed: true,
      });
    }

    save();
    renderAll();

    if (bloomed) {
      showBloom(bloomed.type);
    } else {
      showToast('这次专注完成啦 🌿');
    }
  }

  /* ---------------- 花朵生长 ---------------- */

  function growBy(fraction) {
    const p = state.planting;
    if (!p || fraction <= 0) return null;
    p.progress = Math.min(1, p.progress + fraction);
    if (p.progress >= 1) return bloomPlanting();
    return null;
  }

  function bloomPlanting() {
    const p = state.planting;
    if (!p) return null;
    const type = p.type;
    state.planting = null;

    const rec = state.encyclopedia[type] || { firstAt: Date.now(), count: 0 };
    rec.count = (rec.count || 0) + 1;
    rec.lastAt = Date.now();
    state.encyclopedia[type] = rec;

    return { type };
  }

  function cropEmoji(type, prog) {
    if (prog >= 1) return FLOWERS[type].emoji;
    if (prog >= 0.66) return '🌾';
    if (prog >= 0.33) return '🌿';
    return '🌱';
  }

  /** 花朵随进度从轻微柔化变清晰，开花时完全显影 */
  function photoFilter(prog) {
    const blur = ((1 - prog) * 1.5).toFixed(1);
    const sat = (0.85 + prog * 0.15).toFixed(2);
    return `blur(${blur}px) saturate(${sat})`;
  }

  function photoOpacity(prog) {
    return (0.8 + prog * 0.2).toFixed(2);
  }

  function cropStatus(prog) {
    if (prog >= 1) return '开花了！';
    if (prog >= 0.66) return '花苞饱满，就要开花';
    if (prog >= 0.33) return '正在生长';
    if (prog > 0) return '花苞孕育中';
    return '种子已种下';
  }

  /* ---------------- 渲染 ---------------- */

  function renderAll() {
    renderTimer();
    renderGarden();
    renderEncyclopedia();
    renderStats();
  }

  function renderTimer() {
    const t = state.timer;
    updateTimerDisplay(currentRemaining());
    els.timerDisplay.classList.toggle('running', t.status === 'running');

    if (t.status === 'running') {
      els.primaryBtn.textContent = '暂停';
      els.interruptBtn.hidden = false;
    } else if (t.status === 'paused') {
      els.primaryBtn.textContent = '继续专注';
      els.interruptBtn.hidden = false;
    } else {
      els.primaryBtn.textContent = '开始专注';
      els.interruptBtn.hidden = true;
    }

    els.primaryBtn.disabled = !state.planting;

    if (!state.planting) {
      els.timerHint.textContent = '先种下一颗种子，再开始专注哦';
    } else if (t.status === 'running') {
      els.timerHint.textContent = '正在专注，别走开～';
    } else if (t.status === 'paused') {
      els.timerHint.textContent = '已暂停，花苞会等你回来';
    } else if (state.planting.progress > 0) {
      els.timerHint.textContent = '花苞已保存，再专注 25 分钟就能开花';
    } else {
      els.timerHint.textContent = '专注 25 分钟，让花朵绽放';
    }
  }

  function renderGarden() {
    const p = state.planting;

    if (!p) {
      els.gardenHint.textContent = '选择一颗种子种下';
      els.gardenContent.innerHTML = `
        <div class="seed-picker">
          <p>点击种子，开始一段 25 分钟的专注。</p>
          <div class="seed-grid">
            ${FLOWER_KEYS.map(
              (key) => `
              <button class="seed-btn" data-type="${key}" type="button">
                <img class="seed-photo" src="${FLOWERS[key].photo}" alt="${FLOWERS[key].name}">
                <span class="seed-name">${FLOWERS[key].name}</span>
              </button>`
            ).join('')}
          </div>
        </div>`;
      els.gardenContent.querySelectorAll('.seed-btn').forEach((btn) => {
        btn.addEventListener('click', () => plantFlower(btn.dataset.type));
      });
      return;
    }

    const prog = liveProgress();
    const flower = FLOWERS[p.type];
    els.gardenHint.textContent = '一株正在成长';
    els.gardenContent.innerHTML = `
      <div class="plant-card">
        <div class="plant-visual">
          <img class="plant-photo" id="plantPhoto" src="${flower.photo}" alt="${flower.name}"
               style="filter:${photoFilter(prog)};opacity:${photoOpacity(prog)}">
          <span class="plant-stage-badge" id="plantStageBadge"
                style="${prog >= 1 ? 'display:none' : ''}">${cropEmoji(p.type, prog)}</span>
        </div>
        <div class="plant-info">
          <div class="plant-title-row">
            <h3>${flower.name}</h3>
            <span class="plant-status" id="plantStatus">${cropStatus(prog)}</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill" id="plantProgressFill" style="width:${Math.round(prog * 100)}%"></div>
          </div>
          <div class="plant-progress-text" id="plantProgressText">${Math.round(prog * 100)}%</div>
        </div>
      </div>`;
  }

  function updateLiveProgress() {
    if (!state.planting) return;
    const prog = liveProgress();
    const fill = document.getElementById('plantProgressFill');
    const text = document.getElementById('plantProgressText');
    const status = document.getElementById('plantStatus');
    const photo = document.getElementById('plantPhoto');
    const badge = document.getElementById('plantStageBadge');

    if (fill) fill.style.width = `${Math.round(prog * 100)}%`;
    if (text) text.textContent = `${Math.round(prog * 100)}%`;
    if (status) status.textContent = cropStatus(prog);
    if (photo) {
      photo.style.filter = photoFilter(prog);
      photo.style.opacity = photoOpacity(prog);
    }
    if (badge) {
      badge.textContent = cropEmoji(state.planting.type, prog);
      badge.style.display = prog >= 1 ? 'none' : '';
    }
  }

  function renderEncyclopedia() {
    const acquiredCount = FLOWER_KEYS.filter((key) => state.encyclopedia[key]).length;
    els.encyclopediaCount.textContent = `${acquiredCount} / ${FLOWER_KEYS.length} 已收集`;

    els.encyclopediaGrid.innerHTML = FLOWER_KEYS.map((key) => {
      const flower = FLOWERS[key];
      const rec = state.encyclopedia[key];

      if (rec) {
        return `
          <div class="encyclopedia-card acquired">
            ${rec.count > 1 ? `<span class="count">×${rec.count}</span>` : ''}
            <img class="card-photo" src="${flower.photo}" alt="${flower.name}">
            <h3>${flower.name}</h3>
            <div class="card-status">${formatDate(rec.firstAt)}</div>
            <span class="badge">专注获得</span>
          </div>`;
      }

      return `
        <div class="encyclopedia-card locked">
          <img class="card-photo" src="${flower.photo}" alt="">
          <h3>${flower.name}</h3>
          <div class="card-status">尚未获得</div>
        </div>`;
    }).join('');
  }

  function renderStats() {
    const completed = state.sessions.filter((s) => s.completed);
    const totalMinutes = completed.reduce((sum, s) => sum + (s.minutes || 0), 0);
    const bloomed = FLOWER_KEYS.reduce(
      (sum, key) => sum + ((state.encyclopedia[key] && state.encyclopedia[key].count) || 0),
      0
    );

    els.stats.innerHTML = `
      <div class="stat">
        <div class="stat-num">${completed.length}</div>
        <div class="stat-label">专注次数</div>
      </div>
      <div class="stat">
        <div class="stat-num">${totalMinutes}</div>
        <div class="stat-label">专注分钟</div>
      </div>
      <div class="stat">
        <div class="stat-num">${bloomed}</div>
        <div class="stat-label">开花数量</div>
      </div>`;
  }

  /* ---------------- 交互 ---------------- */

  function plantFlower(type) {
    if (!FLOWERS[type] || state.planting) return;
    if (state.timer.status !== 'idle') return;

    state.planting = { type, progress: 0, plantedAt: Date.now() };
    state.timer = { status: 'idle', remainingMs: FOCUS_MS, endAt: null };
    save();
    renderAll();
    showToast(`已种下${FLOWERS[type].name}，开始专注吧 🌱`);
  }

  function showBloom(type) {
    const flower = FLOWERS[type];
    els.bloomEmoji.innerHTML = `<img class="bloom-photo" src="${flower.photo}" alt="${flower.name}">`;
    els.bloomText.textContent = `${flower.name}已开花，并作为「专注获得」收入图鉴。`;
    els.bloomOverlay.hidden = false;
  }

  function hideBloom() {
    els.bloomOverlay.hidden = true;
  }

  let toastTimer = null;
  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.remove('show'), 2200);
  }

  function formatDate(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getMonth() + 1}月${d.getDate()}日 · ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  /* ---------------- 启动 ---------------- */

  function setupBackground() {
    const pick = BG_IMAGES[Math.floor(Math.random() * BG_IMAGES.length)];
    const img = new Image();
    img.onload = () => {
      document.body.style.setProperty('--bg-photo', `url("${pick}")`);
    };
    img.src = pick;
  }

  function init() {
    els.primaryBtn.addEventListener('click', () => {
      if (state.timer.status === 'running') {
        pauseFocus();
      } else {
        startFocus();
      }
    });
    els.interruptBtn.addEventListener('click', interruptFocus);
    els.bloomClose.addEventListener('click', hideBloom);
    els.bloomOverlay.addEventListener('click', (e) => {
      if (e.target === els.bloomOverlay) hideBloom();
    });

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) tick();
    });

    setupBackground();
    setInterval(tick, 250);

    // 页面刷新时，如果计时已结束，直接结算
    if (state.timer.status === 'running') {
      if (!state.timer.endAt || state.timer.endAt - Date.now() <= 0) {
        completeSession();
        return;
      }
    }

    renderAll();
  }

  init();
})();