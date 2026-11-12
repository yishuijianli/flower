/* 知花屿 · 花笺（诗词填字）交互层
 * 数据来自 data/huajian.js（window.HUAJIAN），格子由 tools/gen_huajian.py 生成并校验。
 */
(function () {
  'use strict';

  var DATA = window.HUAJIAN;
  if (!DATA || !DATA.puzzles || !DATA.puzzles.length) return;

  var NUM = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
  var STORE = 'flora_huajian_v1';
  var CJK = /[\u3400-\u4dbf\u4e00-\u9fff]/;

  var board = document.getElementById('hjBoard');
  var volsEl = document.getElementById('hjVols');
  var meterEl = document.getElementById('hjMeter');
  var barEl = document.getElementById('hjBar');
  var actEl = document.getElementById('hjActions');
  var cluesEl = document.getElementById('hjClues');
  var wordsEl = document.getElementById('hjWords');
  var doneEl = document.getElementById('hjDone');

  var S = { vol: 0, puz: null, cells: {}, lineCells: [], blankNum: {}, sel: null, line: 0, hints: 0, done: false };

  /* ---------- 存档 ---------- */
  function readStore() {
    try { return JSON.parse(localStorage.getItem(STORE) || '{}') || {}; } catch (e) { return {}; }
  }
  function writeStore() {
    var all = readStore();
    var vals = {};
    Object.keys(S.cells).forEach(function (k) {
      if (S.cells[k].blank && S.cells[k].val) vals[k] = S.cells[k].val;
    });
    all[S.puz.id] = { vals: vals, hints: S.hints, done: S.done };
    try { localStorage.setItem(STORE, JSON.stringify(all)); } catch (e) { /* 隐私模式忽略 */ }
  }

  /* ---------- 建卷 ---------- */
  function buildCells(puz) {
    var cells = {};
    var lineCells = [];
    puz.lines.forEach(function (ln, li) {
      var dr = ln.dir === 'H' ? 0 : 1, dc = ln.dir === 'H' ? 1 : 0;
      var keys = [];
      for (var k = 0; k < ln.text.length; k++) {
        var key = (ln.r + dr * k) + ',' + (ln.c + dc * k);
        keys.push(key);
        if (!cells[key]) cells[key] = { char: ln.text.charAt(k), blank: false, val: '', ok: false, lines: [] };
        cells[key].lines.push(li);
      }
      lineCells.push(keys);
    });
    puz.blanks.forEach(function (b) {
      var key = b.r + ',' + b.c;
      cells[key].blank = true;
      cells[key].lines = b.lines;   // 经过该格的所有诗句，用于高亮
    });
    return { cells: cells, lineCells: lineCells };
  }

  function mount(id) {
    var puz = null;
    DATA.puzzles.forEach(function (p) { if (p.id === id) puz = p; });
    if (!puz) puz = DATA.puzzles[0];

    S.puz = puz;
    S.vol = puz.id;
    S.sel = null;
    S.line = 0;
    S.done = false;
    S.hints = 0;

    var built = buildCells(puz);
    S.cells = built.cells;
    S.lineCells = built.lineCells;

    // 空格编号（按出现顺序）
    S.blankNum = {};
    puz.blanks.forEach(function (b, i) { S.blankNum[b.r + ',' + b.c] = i + 1; });

    var saved = readStore()[puz.id];
    if (saved) {
      S.hints = saved.hints || 0;
      S.done = !!saved.done;
      if (saved.vals) {
        Object.keys(saved.vals).forEach(function (k) {
          if (S.cells[k] && S.cells[k].blank) S.cells[k].val = saved.vals[k];
        });
      }
    }

    renderVols();
    renderBoard();
    fitBoard();
    renderClues();
    renderWords();
    renderMeter();
    if (S.done) complete(true); else doneEl.classList.remove('is-on');
    selectLine(0, false);
  }

  /* ---------- 渲染 ---------- */
  function renderVols() {
    volsEl.innerHTML = DATA.puzzles.map(function (p) {
      var saved = readStore()[p.id];
      var done = saved && saved.done ? ' is-done' : '';
      return '<button class="hj-vol' + (p.id === S.vol ? ' is-on' : '') + done + '" data-id="' + p.id + '">' +
        '<b>卷' + NUM[p.id - 1] + ' · ' + p.title + '</b>' +
        '<small>' + p.level + ' · ' + p.lines.length + '句 · ' + p.blanks.length + '空</small></button>';
    }).join('');
  }

  function renderBoard() {
    var p = S.puz, html = '';
    board.style.setProperty('--cols', p.cols);
    board.style.setProperty('--rows', p.rows);
    board.classList.toggle('is-done', S.done);
    for (var r = 0; r < p.rows; r++) {
      for (var c = 0; c < p.cols; c++) {
        var key = r + ',' + c, cell = S.cells[key];
        if (!cell) { html += '<div class="hj-cell is-void"></div>'; continue; }
        if (!cell.blank) {
          html += '<div class="hj-cell is-given" data-k="' + key + '">' + cell.char + '</div>';
        } else {
          var label = '第' + (S.blankNum[key]) + '空，' + cell.lines.length + '句共用';
          html += '<div class="hj-cell is-blank" data-k="' + key + '">' +
            '<input class="hj-in" data-k="' + key + '" value="' + (cell.val || '') + '" ' +
            'autocomplete="off" autocapitalize="off" spellcheck="false" ' +
            'inputmode="text" aria-label="' + label + '"></div>';
        }
      }
    }
    board.innerHTML = html;
    paint();
  }

  function renderClues() {
    var hs = [], vs = [];
    S.puz.lines.forEach(function (ln, i) {
      var item = '<button class="hj-clue" data-line="' + i + '">' +
        '<b></b><span>' + ln.source + '</span>' +
        '<em>' + ln.answer.length + '字</em></button>';
      (ln.dir === 'H' ? hs : vs).push(item);
    });
    // 横、竖各自从「一」重新编号，避免出现跳号
    function number(list) {
      return list.map(function (html, i) {
        return html.replace('<b></b>', '<b>' + NUM[i] + '</b>');
      }).join('');
    }
    cluesEl.innerHTML =
      '<div class="hj-box"><h3>横读</h3>' + number(hs) + '</div>' +
      '<div class="hj-box"><h3>竖读</h3>' + number(vs) + '</div>';
  }

  /* 格子随容器宽度自动定尺寸：宽卷变小格，窄屏也不横向溢出 */
  function fitBoard() {
    if (!S.puz) return;
    var card = board.parentElement;
    var avail = card.clientWidth - 48;
    var cell = Math.floor(avail / S.puz.cols);
    cell = Math.max(22, Math.min(54, cell));
    board.style.setProperty('--cell', cell + 'px');
  }

  function renderWords() {
    var count = {}, order = [];
    S.puz.lines.forEach(function (ln) {
      if (!count[ln.answer]) { count[ln.answer] = 0; order.push(ln.answer); }
      count[ln.answer]++;
    });
    order.sort(function (a, b) { return a.length - b.length || a.localeCompare(b, 'zh'); });
    wordsEl.innerHTML = order.map(function (w) {
      return '<span class="hj-word">' + w + (count[w] > 1 ? '<small>×' + count[w] + '</small>' : '') + '</span>';
    }).join('');
  }

  function renderMeter() {
    var total = S.puz.blanks.length, filled = 0;
    S.puz.blanks.forEach(function (b) {
      if ((S.cells[b.r + ',' + b.c].val || '').length) filled++;
    });
    barEl.style.width = (total ? (filled / total * 100) : 0) + '%';
    meterEl.querySelector('b').textContent = filled + ' / ' + total;
    meterEl.querySelector('small').textContent = S.hints ? '已用提示 ' + S.hints + ' 次' : '空格即花名';
  }

  /* 把状态刷到已渲染的 DOM 上 */
  function paint() {
    var selKeys = {};
    if (S.line != null && S.lineCells[S.line]) {
      S.lineCells[S.line].forEach(function (k) { selKeys[k] = 1; });
    }
    Object.keys(S.cells).forEach(function (key) {
      var cell = S.cells[key];
      if (!cell.blank) return;
      var wrap = board.querySelector('.hj-cell[data-k="' + key + '"]');
      if (!wrap) return;
      var input = wrap.querySelector('input');
      if (input && input.value !== (cell.val || '')) input.value = cell.val || '';
      wrap.classList.toggle('is-sel', S.sel === key);
      wrap.classList.toggle('in-line', !!selKeys[key] && S.sel !== key);
      wrap.classList.toggle('is-ok', !!cell.ok && !!cell.val);
      if (!cell.ok) wrap.classList.remove('is-bad');
    });
    // 横向/竖向的高亮也要落在已给字上
    board.querySelectorAll('.hj-cell.is-given').forEach(function (el) {
      el.classList.toggle('in-line', !!selKeys[el.dataset.k] && S.sel !== el.dataset.k);
      el.classList.toggle('is-sel', S.sel === el.dataset.k);
    });
    // 侧栏
    cluesEl.querySelectorAll('.hj-clue').forEach(function (el) {
      var li = +el.dataset.line;
      el.classList.toggle('is-on', li === S.line);
      var keys = S.lineCells[li] || [];
      var allOk = keys.every(function (k) { return !S.cells[k].blank || (S.cells[k].ok && S.cells[k].val); });
      el.classList.toggle('is-ok', allOk);
    });
    renderMeter();
  }

  /* ---------- 选择 ---------- */
  function selectLine(li, focus) {
    if (li == null) return;
    S.line = li;
    if (focus !== false) {
      var keys = S.lineCells[li] || [];
      var target = null;
      keys.forEach(function (k) {
        var cell = S.cells[k];
        if (!target && cell.blank && !cell.val) target = k;
      });
      if (!target) keys.forEach(function (k) { if (!target && S.cells[k].blank) target = k; });
      if (target) selectCell(target, true);
    }
    paint();
  }

  function selectCell(key, focus) {
    S.sel = key;
    var cell = S.cells[key];
    if (cell && cell.lines && cell.lines.length && cell.lines.indexOf(S.line) < 0) {
      S.line = cell.lines[0];   // 当前句不经过这格时，切到该格所属的第一句
    }
    if (focus) {
      var input = board.querySelector('.hj-cell[data-k="' + key + '"] input');
      if (input) input.focus({ preventScroll: true });
    }
    paint();
  }

  /* ---------- 输入 ---------- */
  function takeChar(raw) {
    var s = String(raw || '').replace(/[\s]/g, '');
    if (!s) return '';
    var chars = Array.from(s);
    for (var i = chars.length - 1; i >= 0; i--) if (CJK.test(chars[i])) return chars[i];
    return '';
  }

  function handleInput(input) {
    var key = input.dataset.k;
    var cell = S.cells[key];
    if (!cell) return;
    var ch = takeChar(input.value);
    input.value = ch;
    cell.val = ch;
    cell.ok = false;
    if (ch) {
      writeStore();
      var next = nextBlank(key);
      if (next) selectCell(next, true);
      else paint();
    } else {
      writeStore();
      paint();
    }
  }

  function nextBlank(key) {
    var keys = S.lineCells[S.line] || [];
    var at = keys.indexOf(key);
    for (var i = at + 1; i < keys.length; i++) {
      var c = S.cells[keys[i]];
      if (c.blank && !c.val) return keys[i];
    }
    for (var j = 0; j < at; j++) {
      var b = S.cells[keys[j]];
      if (b.blank && !b.val) return keys[j];
    }
    return null;
  }

  function prevBlank(key) {
    var keys = S.lineCells[S.line] || [];
    var at = keys.indexOf(key);
    for (var i = at - 1; i >= 0; i--) {
      if (S.cells[keys[i]].blank) return keys[i];
    }
    return null;
  }

  /* ---------- 校对 / 提示 / 重来 ---------- */
  function check() {
    var total = 0, filled = 0, wrong = 0;
    S.puz.blanks.forEach(function (b) {
      var key = b.r + ',' + b.c, cell = S.cells[key];
      total++;
      if (!cell.val) return;
      filled++;
      if (cell.val === cell.char) cell.ok = true;
      else { cell.ok = false; wrong++; }
    });
    paint();
    if (wrong) {
      board.querySelectorAll('.hj-cell.is-blank').forEach(function (el) {
        var cell = S.cells[el.dataset.k];
        if (cell && cell.val && !cell.ok) {
          el.classList.remove('is-bad');
          void el.offsetWidth;
          el.classList.add('is-bad');
        }
      });
      toast('有 ' + wrong + ' 格还不是花名，朱砂处再想想');
      return;
    }
    if (filled < total) {
      toast('已确认 ' + filled + ' 格，还差 ' + (total - filled) + ' 格');
      return;
    }
    complete();
  }

  function hint() {
    var target = null;
    if (S.sel && S.cells[S.sel].blank && S.cells[S.sel].val !== S.cells[S.sel].char) target = S.sel;
    if (!target) {
      var keys = S.lineCells[S.line] || [];
      keys.forEach(function (k) {
        var c = S.cells[k];
        if (!target && c.blank && c.val !== c.char) target = k;
      });
    }
    if (!target) {
      S.puz.blanks.forEach(function (b) {
        var k = b.r + ',' + b.c;
        if (!target && S.cells[k].val !== S.cells[k].char) target = k;
      });
    }
    if (!target) { toast('这卷已经填满了'); return; }
    var cell = S.cells[target];
    cell.val = cell.char;
    cell.ok = true;
    S.hints++;
    S.sel = target;
    writeStore();
    paint();
    if (allRight()) complete();
  }

  function allRight() {
    return S.puz.blanks.every(function (b) {
      var cell = S.cells[b.r + ',' + b.c];
      return cell.val === cell.char;
    });
  }

  function reset() {
    S.puz.blanks.forEach(function (b) {
      var cell = S.cells[b.r + ',' + b.c];
      cell.val = '';
      cell.ok = false;
    });
    S.hints = 0;
    S.done = false;
    board.classList.remove('is-done');
    doneEl.classList.remove('is-on');
    writeStore();
    renderVols();
    paint();
    toast('花笺已拂净，重新落笔');
  }

  function complete(silent) {
    S.done = true;
    S.puz.blanks.forEach(function (b) {
      var cell = S.cells[b.r + ',' + b.c];
      if (cell.val === cell.char) cell.ok = true;
    });
    board.classList.add('is-done');
    paint();
    writeStore();
    doneEl.innerHTML =
      '<div class="hj-scroll">' +
        '<h2>卷' + NUM[S.puz.id - 1] + ' · ' + S.puz.title + ' 已补齐</h2>' +
        '<p class="hj-sub">横读竖读，皆成诗句。共 ' + S.puz.lines.length + ' 句，' +
          (S.hints ? '用提示 ' + S.hints + ' 次。' : '未用提示。') + '</p>' +
        S.puz.lines.map(function (ln, i) {
          return '<div class="hj-poem">' +
            '<i class="' + (ln.dir === 'V' ? 'v' : '') + '">' + (ln.dir === 'V' ? '竖' : '横') + '</i>' +
            '<span>' + ln.text + '</span><em>' + ln.source + '</em></div>';
        }).join('') +
        '<div class="hj-seal">知花屿 · 花笺</div>' +
      '</div>';
    doneEl.classList.add('is-on');
    renderVols();
    if (!silent) toast('花笺已补齐，可换一卷');
  }

  function toast(msg) {
    if (window.Flora && window.Flora.toast) window.Flora.toast(msg);
  }

  /* ---------- 事件 ---------- */
  volsEl.addEventListener('click', function (e) {
    var btn = e.target.closest('.hj-vol');
    if (!btn) return;
    mount(+btn.dataset.id);
    var top = board.getBoundingClientRect().top + window.pageYOffset - 110;
    window.scrollTo({ top: top, behavior: 'smooth' });
  });

  actEl.addEventListener('click', function (e) {
    var btn = e.target.closest('button');
    if (!btn) return;
    if (btn.dataset.act === 'check') check();
    if (btn.dataset.act === 'hint') hint();
    if (btn.dataset.act === 'reset') reset();
  });

  cluesEl.addEventListener('click', function (e) {
    var btn = e.target.closest('.hj-clue');
    if (!btn) return;
    selectLine(+btn.dataset.line, true);
  });

  board.addEventListener('focusin', function (e) {
    var input = e.target;
    if (!input.classList || !input.classList.contains('hj-in')) return;
    selectCell(input.dataset.k, false);
  });

  board.addEventListener('compositionstart', function (e) {
    if (e.target.classList && e.target.classList.contains('hj-in')) e.target.dataset.comp = '1';
  });

  board.addEventListener('compositionend', function (e) {
    var t = e.target;
    if (!t.classList || !t.classList.contains('hj-in')) return;
    delete t.dataset.comp;
    handleInput(t);
  });

  board.addEventListener('input', function (e) {
    var t = e.target;
    if (!t.classList || !t.classList.contains('hj-in')) return;
    if (t.dataset.comp || e.isComposing) return;
    handleInput(t);
  });

  board.addEventListener('keydown', function (e) {
    var t = e.target;
    if (!t.classList || !t.classList.contains('hj-in')) return;
    var key = t.dataset.k;
    if (e.key === 'Backspace') {
      if (S.cells[key].val) { e.preventDefault(); t.value = ''; S.cells[key].val = ''; S.cells[key].ok = false; writeStore(); paint(); }
      else {
        var p = prevBlank(key);
        if (p) { e.preventDefault(); selectCell(p, true); }
      }
      return;
    }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      var keys = S.lineCells[S.line] || [];
      var at = keys.indexOf(key);
      var blanks = keys.filter(function (k) { return S.cells[k].blank; });
      var bi = blanks.indexOf(key);
      var ni = e.key === 'ArrowLeft' ? bi - 1 : bi + 1;
      if (ni >= 0 && ni < blanks.length) { e.preventDefault(); selectCell(blanks[ni], true); }
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      var cur = S.line;
      for (var i = 1; i <= S.puz.lines.length; i++) {
        var li = (cur + i) % S.puz.lines.length;
        var has = (S.lineCells[li] || []).some(function (k) { return S.cells[k].blank && !S.cells[k].val; });
        if (has) { selectLine(li, true); break; }
      }
    }
  });

  // 已给字也能点：高亮它所在的句子（想换横/竖就读侧栏词条）
  board.addEventListener('click', function (e) {
    var given = e.target.closest('.hj-cell.is-given');
    if (given) selectCell(given.dataset.k, false);
  });

  mount(DATA.puzzles[0].id);
  var rt;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(fitBoard, 120);
  });
  window.FloraHuajian = { mount: mount, check: check, hint: hint, reset: reset, state: S };
})();
