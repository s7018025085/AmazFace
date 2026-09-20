// src/editor/canvas.js

const GRID = 10;

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

const WEEKDAYS_SHORT = { EN: ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'], RU: ['ВС', 'ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ'] };
const WEEKDAYS_RU_3 = ['ВОС', 'ПОН', 'ВТР', 'СРД', 'ЧТВ', 'ПТН', 'СБТ'];
const WEEKDAYS_FULL = { EN: ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'], RU: ['ВОСКРЕСЕНЬЕ', 'ПОНЕДЕЛЬНИК', 'ВТОРНИК', 'СРЕДА', 'ЧЕТВЕРГ', 'ПЯТНИЦА', 'СУББОТА'] };
const MONTHS_SHORT = { EN: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], RU: ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'] };
const MONTHS_FULL = { EN: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'], RU: ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'] };
const pad2 = (n) => String(n).padStart(2, '0');
const loc = (v) => (v === 'RU' ? 'RU' : 'EN');

// Реальное текущее время используется, чтобы предпросмотр в редакторе как можно
// точнее соответствовал тому, что покажет симулятор/устройство (там всегда
// живые данные, а не фиксированный "12:45"), а не только совпадал по размеру.
function componentPreviewText(comp, def) {
  if (def.widgetId !== 'TEXT') return null;
  if (comp.props.text) return comp.props.text;
  const now = new Date();
  if (def.dataSource === 'TIME') {
    const h24 = now.getHours();
    const h12 = ((h24 + 11) % 12) + 1;
    const isHms = def.id === 'time_hms';
    const use12h = (comp.props.format || '').startsWith('hh');
    const hh = pad2(use12h ? h12 : h24);
    return isHms ? `${hh}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}` : `${hh}:${pad2(now.getMinutes())}`;
  }
  if (def.dataSource === 'AMPM') return now.getHours() < 12 ? 'AM' : 'PM';
  if (def.dataSource === 'DATE') {
    const dateLoc = loc(comp.props.date_locale);
    const dd = pad2(now.getDate()), mm = pad2(now.getMonth() + 1), yyyy = now.getFullYear();
    const mmm = MONTHS_SHORT[dateLoc][now.getMonth()], mmmm = MONTHS_FULL[dateLoc][now.getMonth()];
    switch (comp.props.format) {
      case 'DD MMM': return `${dd} ${mmm}`;
      case 'MMM DD': return `${mmm} ${dd}`;
      case 'DD/MM': return `${dd}/${mm}`;
      case 'YYYY-MM-DD': return `${yyyy}-${mm}-${dd}`;
      case 'DD MMMM': return `${dd} ${mmmm}`;
      default: return `${dd}.${mm}.${yyyy}`;
    }
  }
  if (def.dataSource === 'WEEKDAY') {
    const weekdayLoc = loc(comp.props.weekday_locale);
    if (weekdayLoc === 'RU' && comp.props.format === 'EEE3') return WEEKDAYS_RU_3[now.getDay()];
    return (comp.props.format === 'EEEE' ? WEEKDAYS_FULL : WEEKDAYS_SHORT)[weekdayLoc][now.getDay()];
  }
  if (def.dataSource === 'HOUR') {
    const h24 = now.getHours();
    const h12 = ((h24 + 11) % 12) + 1;
    const use12h = (comp.props.hour_format || 'HH') === 'hh';
    const h = use12h ? h12 : h24;
    return comp.props.hour_leading_zero === false ? String(h) : pad2(h);
  }
  if (def.dataSource === 'MINUTE') {
    const m = now.getMinutes();
    return comp.props.minute_leading_zero === false ? String(m) : pad2(m);
  }
  if (def.dataSource === 'SECOND') {
    const s = now.getSeconds();
    return comp.props.second_leading_zero === false ? String(s) : pad2(s);
  }
  if (def.dataSource === 'DAY') {
    const d = now.getDate();
    return comp.props.day_leading_zero === false ? String(d) : pad2(d);
  }
  if (def.dataSource === 'MONTH') {
    const mIdx = now.getMonth();
    const fmt = comp.props.month_format || 'MM';
    const monthLoc = loc(comp.props.month_locale);
    if (fmt === 'M') return String(mIdx + 1);
    if (fmt === 'MMM') return MONTHS_SHORT[monthLoc][mIdx];
    if (fmt === 'MMMM') return MONTHS_FULL[monthLoc][mIdx];
    return pad2(mIdx + 1);
  }
  if (def.dataSource === 'YEAR') {
    const y = now.getFullYear();
    return (comp.props.year_format === 'YY') ? String(y).slice(-2) : String(y);
  }
  if (def.dataSource === 'BATTERY') return (comp.props.suffix ? '82' + comp.props.suffix : '82%');
  if (def.dataSource === 'STEP') return '8 452' + (comp.props.suffix || '');
  if (def.dataSource === 'HEART') return (comp.props.prefix || '') + '72';
  if (def.dataSource === 'CALORIE') return '340' + (comp.props.suffix || '');
  if (def.dataSource === 'DISTANCE') return '4.2 ' + (comp.props.unit || 'km');
  if (def.dataSource === 'WEATHER_TEMP') return '24' + (comp.props.unit || '°C');
  return def.name;
}

// Источники данных, которые в предпросмотре редактора должны «идти» сами
// (обновляются посекундным тиком без полной перерисовки сцены).
const LIVE_PREVIEW_SOURCES = new Set(['TIME', 'AMPM', 'DATE', 'WEEKDAY', 'HOUR', 'MINUTE', 'SECOND', 'DAY', 'MONTH', 'YEAR']);

class CanvasEditor {
  constructor(root, store) {
    this.root = root;
    this.store = store;
    this.zoom = 1;
    this.pan = { x: 0, y: 0 };
    this.snapGrid = true;
    this.showGrid = true;
    this.showTapZones = true;
    this.drag = null;

    this.root.innerHTML = `
      <div class="canvas-viewport">
        <div class="test-hands-toolbar">
          <button class="test-hands-btn" data-act="test-hands" title="Ускоренно прокрутить стрелки, чтобы проверить часовую, минутную и секундную">▶ Проверить стрелки</button>
          <select class="test-speed-select" title="Скорость перемотки при проверке стрелок">
            <option value="1">1× — реальное время</option>
            <option value="60">60× — мин. стрелка: круг за 60 с</option>
            <option value="360">360× — мин. стрелка: круг за 10 с</option>
            <option value="720" selected>720× — мин. стрелка: круг за 5 с (по умолч.)</option>
            <option value="3600">3600× — час. стрелка: круг за 12 с</option>
            <option value="43200">43200× — час. стрелка: круг за 1 с (максимум)</option>
          </select>
        </div>
        <div class="canvas-stage">
          <div class="device-frame"></div>
          <div class="guide guide-h"></div>
          <div class="guide guide-v"></div>
        </div>
      </div>
    `;
    this.viewport = this.root.querySelector('.canvas-viewport');
    this.stage = this.root.querySelector('.canvas-stage');
    this.frame = this.root.querySelector('.device-frame');
    this.guideH = this.root.querySelector('.guide-h');
    this.guideV = this.root.querySelector('.guide-v');
    this.testBtn = this.root.querySelector('.test-hands-btn');
    this.testSpeedSelect = this.root.querySelector('.test-speed-select');
    this.testSpeed = Number(this.testSpeedSelect.value) || 720;
    this.testBtn.onclick = () => this._toggleHandTest();
    this.testSpeedSelect.onchange = () => this._changeTestSpeed(Number(this.testSpeedSelect.value) || 720);

    // Слой тестовых стрелок: постоянные DOM-узлы поверх device-frame, которые
    // используются ТОЛЬКО во время ускоренной проверки (см. _toggleHandTest).
    // Позиционируются в 1:1 device-пикселях напрямую по center_x/center_y и
    // pos_x/pos_y (точка опоры "в изображении") и реальному размеру
    // ресурса — то есть так же, как настоящий TIME_POINTER-виджет на
    // устройстве, а не по произвольному прямоугольнику x/y/w/h редактора.
    this.testHour = document.createElement('div');
    this.testMinute = document.createElement('div');
    this.testSecond = document.createElement('div');
    for (const el of [this.testHour, this.testMinute, this.testSecond]) {
      el.className = 'test-hand';
      this.frame.appendChild(el);
    }

    this._bindToolbar();
    this._bindPan();
    this._bindKeys();
    this.testMode = false;
    this._testRafId = null;
    this.aodBrightness = null;
  }

  _toggleHandTest() {
    this.testMode = !this.testMode;
    this.testBtn.textContent = this.testMode ? '⏸ Остановить проверку' : '▶ Проверить стрелки';
    this.testBtn.classList.toggle('active', this.testMode);

    if (this.testMode) {
      // Скорость перемотки задаётся выбором в .test-speed-select (по
      // умолчанию 720× — минутная стрелка делает полный круг примерно за
      // 5 секунд, часовая — примерно за минуту). Несколько предустановок
      // позволяют проверить и быстрое "долистывание" суток целиком (43200×),
      // и почти естественный, неспешный ход стрелок (1×/60×) — удобно
      // заметить рывки/дрожание при плавном ходе секундной стрелки.
      this._testStartPerf = performance.now();
      this._testStartDate = new Date();
      const loop = () => {
        if (!this.testMode) return;
        const elapsedRealSec = (performance.now() - this._testStartPerf) / 1000;
        const simDate = new Date(this._testStartDate.getTime() + elapsedRealSec * this.testSpeed * 1000);
        try { this._updateTestHands(simDate); }
        catch (err) { console.error('Ошибка проверки вращения стрелок:', err); }
        this._testRafId = requestAnimationFrame(loop);
      };
      this._testRafId = requestAnimationFrame(loop);
    } else {
      if (this._testRafId) cancelAnimationFrame(this._testRafId);
      this._testRafId = null;
      for (const el of [this.testHour, this.testMinute, this.testSecond]) el.style.display = 'none';
    }
    this.render();
  }

  // Смена скорости во время работающей проверки: пересчитываем точку отсчёта
  // так, чтобы симулированное время осталось непрерывным (иначе стрелки
  // дёрнутся скачком в момент переключения скорости в выпадающем списке).
  _changeTestSpeed(newSpeed) {
    if (this.testMode && this._testStartPerf != null) {
      const elapsedRealSec = (performance.now() - this._testStartPerf) / 1000;
      const simDate = new Date(this._testStartDate.getTime() + elapsedRealSec * this.testSpeed * 1000);
      this._testStartDate = simDate;
      this._testStartPerf = performance.now();
    }
    this.testSpeed = newSpeed;
  }

  _updateTestHands(virtualDate) {
    const device = this.store.state.device;
    const h = virtualDate.getHours() % 12, m = virtualDate.getMinutes(), s = virtualDate.getSeconds(), ms = virtualDate.getMilliseconds();
    const minAngle = ((m + s / 60) / 60) * 360;
    const hourAngle = ((h + m / 60) / 12) * 360;

    // Ход секундной стрелки зависит от настройки motion выбранного компонента:
    // TICK — дискретные скачки по 6° (как штатный TIME_POINTER), SMOOTH —
    // непрерывное вращение с учётом миллисекунд (как ручная анимация,
    // которую генерирует экспортёр).
    const secondComp = this.store.state.components.find((c) => c.defId === 'time_pointer_second');
    const motion = (secondComp && secondComp.props.motion) || 'TICK';
    let secAngle;
    if (motion === 'SMOOTH') {
      secAngle = ((s + ms / 1000) / 60) * 360;
      const step = Number(secondComp && secondComp.props.smooth_step_deg) || 0;
      if (step > 0) secAngle = Math.floor(secAngle / step) * step;
    } else {
      secAngle = (s / 60) * 360;
    }

    const specs = [
      { el: this.testHour, defId: 'time_pointer_hour', angle: hourAngle },
      { el: this.testMinute, defId: 'time_pointer_minute', angle: minAngle },
      { el: this.testSecond, defId: 'time_pointer_second', angle: secAngle },
    ];

    for (const spec of specs) {
      const el = spec.el;
      const comp = this.store.state.components.find((c) => c.defId === spec.defId);
      if (!comp) { el.style.display = 'none'; continue; }
      const asset = this.store.state.assets.find((a) => a.id === comp.props.path || a.name === comp.props.path);
      if (!asset) { el.style.display = 'none'; continue; }
      const cx = comp.props.center_x ?? device.w / 2;
      const cy = comp.props.center_y ?? device.h / 2;
      const px = comp.props.pos_x ?? asset.width / 2;
      const py = comp.props.pos_y ?? asset.height / 2;
      el.style.display = 'block';
      el.style.width = asset.width + 'px';
      el.style.height = asset.height + 'px';
      el.style.left = (cx - px) + 'px';
      el.style.top = (cy - py) + 'px';
      el.style.backgroundImage = `url(${asset.dataUrl})`;
      el.style.transformOrigin = `${px}px ${py}px`;
      // CSS 0° points right; watch-face 0° points to 12 o'clock.
      el.style.transform = `rotate(${spec.angle - 90}deg)`;
    }
  }

  _bindToolbar() {
    // Use header toolbar elements from document
    const zoomInBtn = document.getElementById('zoom-in');
    const zoomOutBtn = document.getElementById('zoom-out');
    const zoomSelect = document.getElementById('zoom-select');
    const gridToggle = document.getElementById('grid-toggle');
    const snapToggle = document.getElementById('snap-toggle');
    const tapZoneToggle = document.getElementById('tap-zone-toggle');
    
    if (zoomInBtn) zoomInBtn.onclick = () => this.setZoom(this.zoom + 0.25);
    if (zoomOutBtn) zoomOutBtn.onclick = () => this.setZoom(this.zoom - 0.25);
    if (zoomSelect) {
      zoomSelect.onchange = () => this.setZoom(Number(zoomSelect.value) / 100);
      this._zoomSelect = zoomSelect;
    }
    if (gridToggle) gridToggle.onchange = (e) => { this.showGrid = e.target.checked; this.render(); };
    if (snapToggle) snapToggle.onchange = (e) => { this.snapGrid = e.target.checked; };
    if (tapZoneToggle) tapZoneToggle.onchange = (e) => { this.showTapZones = e.target.checked; this.render(this.store.state); };
  }

  _bindPan() {
    let panning = false, start = null;
    this.viewport.addEventListener('mousedown', (e) => {
      if (e.target === this.viewport || e.target === this.stage) {
        this.store.setSelection([]);
      }
      if (e.button === 1 || e.altKey) {
        panning = true;
        start = { x: e.clientX, y: e.clientY, panX: this.pan.x, panY: this.pan.y };
        e.preventDefault();
      }
    });
    window.addEventListener('mousemove', (e) => {
      if (panning) {
        this.pan.x = start.panX + (e.clientX - start.x);
        this.pan.y = start.panY + (e.clientY - start.y);
        this._applyStageTransform();
      }
    });
    window.addEventListener('mouseup', () => { panning = false; });
    this.viewport.addEventListener('wheel', (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        this.setZoom(this.zoom + (e.deltaY < 0 ? 0.1 : -0.1));
      }
    }, { passive: false });
  }

  _bindKeys() {
    window.addEventListener('keydown', (e) => {
      const tag = document.activeElement.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const sel = [...this.store.selection];
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); this.store.undo(); }
      else if (mod && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) { e.preventDefault(); this.store.redo(); }
      else if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); if (sel.length) this.store.duplicateComponents(sel); }
      else if (mod && e.key.toLowerCase() === 'c') { this._clipboard = sel.map((id) => JSON.parse(JSON.stringify(this.store.state.components.find((c) => c.id === id)))); }
      else if (mod && e.key.toLowerCase() === 'v') {
        if (this._clipboard && this._clipboard.length) {
          e.preventDefault();
          const ids = [];
          for (const c of this._clipboard) {
            const idx = (this.store.state.nextIndex[c.defId] || 0) + 1;
            this.store.state.nextIndex[c.defId] = idx;
            const copy = JSON.parse(JSON.stringify(c));
            copy.id = `${c.defId}_${String(idx).padStart(3, '0')}`;
            copy.x += 20; copy.y += 20;
            this.store.state.components.push(copy);
            ids.push(copy.id);
          }
          this.store.selection = new Set(ids);
          this.store.commit();
        }
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && sel.length) {
        e.preventDefault();
        confirmRemoveComponents(this.store, sel);
      } else if (e.key.startsWith('Arrow') && sel.length) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        for (const id of sel) {
          const c = this.store.state.components.find((x) => x.id === id);
          if (c) { c.x += dx; c.y += dy; }
        }
        this.store.commit();
      }
    });
  }

  setZoom(z) {
    this.zoom = clamp(z, 0.25, 4);
    this._zoomSelect.value = String(Math.round(this.zoom * 100));
    this._applyStageTransform();
  }

  _applyStageTransform() {
    this.stage.style.transform = `translate(${this.pan.x}px, ${this.pan.y}px) scale(${this.zoom})`;
  }

  // Точечное обновление текста виджетов, привязанных ко времени. Вызывается
  // раз в секунду вместо полного render(): трогает только textContent уже
  // существующих узлов, поэтому не сбрасывает выделение, ручки resize и
  // не создаёт мусора для сборщика.
  tickLiveText() {
    if (!this.frame) return;
    for (const comp of this.store.state.components) {
      const def = REGISTRY[comp.defId];
      if (!def || def.widgetId !== 'TEXT') continue;
      const source = def.dataSource || (comp.props && comp.props.data_source);
      if (!LIVE_PREVIEW_SOURCES.has(source)) continue;
      if (comp.props && comp.props.text) continue; // статический текст перекрывает данные
      const el = this.frame.querySelector(`.comp-node[data-id="${comp.id}"] .comp-visual`);
      if (!el) continue;
      const text = componentPreviewText(comp, def);
      if (text != null && el.textContent !== text) el.textContent = text;
    }
  }

  _tapSelectionId(compId) {
    return `${compId}::tap`;
  }

  _isTapSelectionId(id) {
    return typeof id === 'string' && id.includes('::tap');
  }

  _tapZoneRect(comp) {
    const p = comp.props || {};
    const hasTap = Object.prototype.hasOwnProperty.call(p, 'tap_x') || Object.prototype.hasOwnProperty.call(p, 'tap_y') || Object.prototype.hasOwnProperty.call(p, 'tap_w') || Object.prototype.hasOwnProperty.call(p, 'tap_h');
    if (!hasTap) {
      return { x: comp.x, y: comp.y, w: comp.w, h: comp.h };
    }
    return {
      x: Number(p.tap_x ?? comp.x),
      y: Number(p.tap_y ?? comp.y),
      w: Number(p.tap_w ?? comp.w),
      h: Number(p.tap_h ?? comp.h),
    };
  }

  render() {
    const state = this.store.state;
    const { w, h, shape } = state.device;
    const aodSettings = state.mode === 'aod' && state.scenes?.aod?.settings ? state.scenes.aod.settings : null;
    this.frame.style.width = w + 'px';
    this.frame.style.height = h + 'px';
    this.frame.style.borderRadius = shape === 'round' ? '50%' : '12px';
    // ВАЖНО: раньше картинка фона задавалась через style.background, а следом
    // style.backgroundImage безусловно перезаписывался паттерном сетки — из-за
    // этого назначенное фоновое изображение никогда не было видно (стирался
    // именно background-image, а не background-color). Собираем оба слоя
    // (сетку и картинку) в один многослойный background-image, чтобы сетка
    // была поверх, а фото — под ней.
    const layers = [], sizes = [], positions = [], repeats = [];
    if (this.showGrid) {
      layers.push('linear-gradient(rgba(255,255,255,.08) 1px, transparent 1px)', 'linear-gradient(90deg, rgba(255,255,255,.08) 1px, transparent 1px)');
      sizes.push(`${GRID}px ${GRID}px`, `${GRID}px ${GRID}px`);
      positions.push('0 0', '0 0');
      repeats.push('repeat', 'repeat');
    }
    if (state.background.imageAssetId) {
      layers.push(`url(${this._assetUrl(state.background.imageAssetId)})`);
      sizes.push('cover');
      positions.push('center');
      repeats.push('no-repeat');
    }
    const bgVisible = Number(state.background?.alpha ?? 100) > 0;
    this.frame.style.backgroundColor = bgVisible ? (state.mode === 'aod' ? (aodSettings?.background || state.background?.color || '#000000') : (state.background?.color || '#000000')) : 'transparent';
    this.frame.style.backgroundImage = bgVisible && state.background.imageAssetId ? layers.join(', ') : (this.showGrid ? layers.slice(0, 2).join(', ') : 'none');
    this.frame.style.backgroundSize = sizes.length ? sizes.join(', ') : 'auto';
    this.frame.style.backgroundPosition = positions.length ? positions.join(', ') : '0 0';
    this.frame.style.backgroundRepeat = repeats.length ? repeats.join(', ') : 'repeat';
    this.frame.style.filter = state.mode === 'aod' ? `brightness(${Math.max(0.01, Number(aodSettings?.brightness ?? 100)) / 100})` : '';

    const testToolbar = this.root.querySelector('.test-hands-toolbar');
    if (testToolbar) testToolbar.style.display = state.mode === 'aod' ? 'none' : '';

    // The same raster renderer used for exported preview is the visual source here.
    let previewCanvas = this.frame.querySelector('.shared-preview-canvas');
    if (!previewCanvas) {
      previewCanvas = document.createElement('canvas');
      previewCanvas.className = 'shared-preview-canvas';
      previewCanvas.style.position = 'absolute';
      previewCanvas.style.left = '0';
      previewCanvas.style.top = '0';
      previewCanvas.style.width = w + 'px';
      previewCanvas.style.height = h + 'px';
      previewCanvas.style.pointerEvents = 'none';
      this.frame.insertBefore(previewCanvas, this.frame.firstChild);
    }
    previewCanvas.width = w; previewCanvas.height = h;
    WatchfacePreviewRenderer.draw(state, previewCanvas, { size: w, testMode: this.testMode && state.mode !== 'aod', previewMode: state.mode === 'aod' }).catch(console.warn);

    let side = this.root.querySelector('.aod-side-preview');
    if (state.mode === 'aod' && aodSettings?.previewMode === 'SIDE') {
      if (!side) {
        side = document.createElement('div');
        side.className = 'aod-side-preview';
        side.innerHTML = '<div class="aod-side-card"><b>Normal</b><canvas class="aod-side-normal"></canvas></div><div class="aod-side-card"><b>AOD</b><canvas class="aod-side-aod"></canvas></div>';
        this.root.appendChild(side);
      }
      side.style.display = 'grid';
      const normalCanvas = side.querySelector('.aod-side-normal');
      const aodCanvas = side.querySelector('.aod-side-aod');
      normalCanvas.width = normalCanvas.height = Math.min(240, w);
      aodCanvas.width = aodCanvas.height = Math.min(240, w);
      const normalScene = Object.assign({}, state, {
        mode: 'normal',
        components: state.scenes?.normal?.components || [],
        background: state.scenes?.normal?.background || { color:'#000000' }
      });
      WatchfacePreviewRenderer.draw(normalScene, normalCanvas, { size: normalCanvas.width, previewMode: true }).catch(console.warn);
      WatchfacePreviewRenderer.draw(state, aodCanvas, { size: aodCanvas.width, previewMode: true }).catch(console.warn);
    } else if (side) {
      side.style.display = 'none';
    }

    // remove old comp nodes
    this.frame.querySelectorAll('.comp-node').forEach((n) => n.remove());

    for (const comp of state.components) {
      const def = REGISTRY[comp.defId];
      if (!def) continue;
      const node = document.createElement('div');
      node.className = 'comp-node';
      node.dataset.id = comp.id;
      const tapEnabled = (comp.props && comp.props.tap_action && comp.props.tap_action !== 'NONE');
      const tapSelected = this.store.selection.has(this._tapSelectionId(comp.id));
      if (tapEnabled && this.showTapZones) node.classList.add('tap-zone-active');
      if (tapSelected) node.classList.add('selected');
      const isCircleLike = def.widgetId === 'CIRCLE' || def.widgetId === 'STROKE_CIRCLE';
      const x = isCircleLike ? (comp.props.center_x ?? comp.x) - (comp.props.radius ?? comp.w / 2) : comp.x;
      const y = isCircleLike ? (comp.props.center_y ?? comp.y) - (comp.props.radius ?? comp.h / 2) : comp.y;
      const wpx = isCircleLike ? (comp.props.radius ?? comp.w / 2) * 2 : comp.w;
      const hpx = isCircleLike ? (comp.props.radius ?? comp.h / 2) * 2 : comp.h;
      node.style.left = x + 'px';
      node.style.top = y + 'px';
      node.style.width = wpx + 'px';
      node.style.height = hpx + 'px';
      if (state.mode === 'aod') {
        const rotation = Number(comp.props?.rotation || 0);
        const scale = Number(comp.props?.scale || 1);
        node.style.transformOrigin = 'center center';
        node.style.transform = `rotate(${rotation}deg) scale(${Math.max(0.05, scale)})`;
      }
      node.style.display = (comp.visible === false || (this.testMode && def.widgetId === 'TIME_POINTER')) ? 'none' : '';
      node.style.opacity = comp.visible === false ? '0.3' : '1';

      const inner = document.createElement('div');
      inner.className = `comp-visual comp-${def.widgetId.toLowerCase()}`;
      this._styleVisual(inner, comp, def);
      inner.style.visibility = 'hidden';
      inner.style.pointerEvents = 'none';
      node.appendChild(inner);

      if (tapEnabled && this.showTapZones) {
        const tapRect = this._tapZoneRect(comp);
        const tapNode = document.createElement('div');
        tapNode.className = 'comp-tap-zone';
        tapNode.dataset.tapZone = 'true';
        tapNode.dataset.compId = comp.id;
        tapNode.style.left = tapRect.x + 'px';
        tapNode.style.top = tapRect.y + 'px';
        tapNode.style.width = tapRect.w + 'px';
        tapNode.style.height = tapRect.h + 'px';
        if (this.store.selection.has(this._tapSelectionId(comp.id)) || this.store.selection.has(comp.id)) {
          tapNode.classList.add('selected');
          for (const corner of ['nw', 'ne', 'sw', 'se']) {
            const h2 = document.createElement('div');
            h2.className = `tap-handle tap-handle-${corner}`;
            h2.dataset.corner = corner;
            h2.dataset.tapZone = 'true';
            tapNode.appendChild(h2);
          }
        }
        node.appendChild(tapNode);
      }

      if (this.store.selection.has(comp.id)) {
        node.classList.add('selected');
        for (const corner of ['nw', 'ne', 'sw', 'se']) {
          const h2 = document.createElement('div');
          h2.className = `handle handle-${corner}`;
          h2.dataset.corner = corner;
          node.appendChild(h2);
        }
      }

      if (!comp.locked) {
        node.addEventListener('mousedown', (e) => this._onNodeMouseDown(e, comp));
        node.addEventListener('click', (e) => {
          if (e.target && e.target.dataset && e.target.dataset.tapZone === 'true') {
            this.store.setSelection([this._tapSelectionId(comp.id)]);
          }
        });
      } else {
        node.classList.add('locked');
      }
      this.frame.appendChild(node);
    }
  }

  _assetUrl(assetId) {
    const a = this.store.state.assets.find((x) => x.id === assetId);
    return a ? a.dataUrl : '';
  }

  _styleVisual(el, comp, def) {
    switch (def.widgetId) {
      case 'TEXT': {
        el.textContent = componentPreviewText(comp, def);
        el.style.color = comp.props.color || '#ffffff';
        // text_size, как и x/y/w/h, задаётся в device-пикселях, а device-frame
        // рендерится 1:1 в CSS-пикселях (см. .canvas-stage margin = -w/2). Поэтому
        // font-size должен браться напрямую, без произвольного коэффициента —
        // раньше здесь стоял множитель 0.55, из-за которого текст в редакторе
        // был заметно мельче, чем на реальном устройстве/симуляторе.
        el.style.fontSize = (comp.props.text_size || 28) + 'px';
        el.style.lineHeight = '1';
        el.style.display = 'flex';
        el.style.alignItems = (comp.props.align_v === 'TOP') ? 'flex-start' : (comp.props.align_v === 'BOTTOM') ? 'flex-end' : 'center';
        el.style.justifyContent = (comp.props.align_h === 'LEFT') ? 'flex-start' : (comp.props.align_h === 'RIGHT') ? 'flex-end' : 'center';
        el.style.whiteSpace = 'nowrap';
        el.style.overflow = 'hidden';
        const fontId = comp.props.font;
        const projectFont = (this.store.state.fonts || []).find((f) => f.id === fontId);
        if (projectFont) {
          if (typeof registerProjectFont === 'function') registerProjectFont(projectFont);
          el.style.fontFamily = `'${projectFont.cssFamily || projectFont.name}', sans-serif`;
        } else {
          el.style.fontFamily = "'Segoe UI', sans-serif";
        }
        el.style.fontWeight = String(comp.props.font_weight || '400');
        el.style.fontStyle = comp.props.font_style || 'normal';
        el.style.letterSpacing = `${Number(comp.props.letter_spacing || 0)}px`;
        el.style.lineHeight = String(comp.props.line_height || 1);
        break;
      }
      case 'TIME_POINTER': {
        // Стрелки хранят ресурс в props.path (а не props.src, как обычные IMG-виджеты) —
        // раньше этот case отсутствовал вовсе, поэтому назначенная картинка стрелки
        // никогда не подхватывалась и рисовалась только серая заглушка.
        const assetId = comp.props.path;
        const asset = this.store.state.assets.find((a) => a.id === assetId || a.name === assetId);
        if (asset) {
          el.style.backgroundImage = `url(${asset.dataUrl})`;
          el.style.backgroundSize = 'contain';
          el.style.backgroundRepeat = 'no-repeat';
          el.style.backgroundPosition = 'center';
        } else {
          el.style.background = 'repeating-linear-gradient(45deg, #445, #445 6px, #303645 6px, #303645 12px)';
        }
        break;
      }
      case 'IMG': {
        const assetId = comp.props.src;
        const asset = this.store.state.assets.find((a) => a.id === assetId || a.name === assetId);
        if (asset) {
          el.style.backgroundImage = `url(${asset.dataUrl})`;
          el.style.backgroundSize = 'contain';
          el.style.backgroundRepeat = 'no-repeat';
          el.style.backgroundPosition = 'center';
        } else if (def.id === 'weather_icon') {
          el.textContent = this._weatherGlyph(comp.props.src);
          el.style.display = 'flex'; el.style.alignItems = 'center'; el.style.justifyContent = 'center';
          el.style.fontSize = '32px';
        } else {
          el.style.background = 'repeating-linear-gradient(45deg, #333, #333 6px, #222 6px, #222 12px)';
        }
        el.style.opacity = (comp.props.alpha ?? 100) / 100;
        break;
      }
      case 'FILL_RECT':
        el.style.background = comp.props.color || '#3366ff';
        el.style.borderRadius = (comp.props.radius || 0) + 'px';
        break;
      case 'STROKE_RECT':
        el.style.border = `${comp.props.line_width || 4}px solid ${comp.props.color || '#3366ff'}`;
        el.style.borderRadius = (comp.props.radius || 0) + 'px';
        break;
      case 'CIRCLE':
        el.style.background = comp.props.color || '#3366ff';
        el.style.borderRadius = '50%';
        break;
      case 'STROKE_CIRCLE':
        el.style.border = `${comp.props.line_width || 4}px solid ${comp.props.color || '#3366ff'}`;
        el.style.borderRadius = '50%';
        break;
      case 'ARC': {
        const start = comp.props.start_angle ?? 0;
        const end = comp.props.end_angle ?? 270;
        const color = comp.props.color || '#3366ff';
        el.style.borderRadius = '50%';
        el.style.background = `conic-gradient(${color} ${start}deg ${end}deg, transparent ${end}deg ${start + 360}deg)`;
        el.style.mask = `radial-gradient(farthest-side, transparent calc(100% - ${(comp.props.line_width || 8)}px), #000 calc(100% - ${(comp.props.line_width || 8)}px))`;
        el.style.webkitMask = el.style.mask;
        break;
      }
      case 'CANVAS':
        el.style.background = 'repeating-linear-gradient(-45deg, #223 0, #223 6px, #1a1a26 6px, #1a1a26 12px)';
        el.style.border = '1px dashed #556';
        el.textContent = 'ХОЛСТ';
        el.style.display = 'flex'; el.style.alignItems = 'center'; el.style.justifyContent = 'center';
        el.style.color = '#889'; el.style.fontSize = '11px';
        break;
      default:
        el.style.background = '#444';
    }
  }

  _weatherGlyph(cond) {
    const id = normalizeWeatherIconId(cond);
    const entry = WEATHER_ICON_SET.find((w) => w.id === id);
    return (entry && entry.glyph) || '☀';
  }

  _onTapZoneMouseDown(e, comp) {
    e.stopPropagation();
    this.store.setSelection([this._tapSelectionId(comp.id)]);
    const state = this.store.state;
    const tapRect = this._tapZoneRect(comp);
    const isHandle = e.target.classList.contains('tap-handle');
    const corner = isHandle ? e.target.dataset.corner : null;
    const startMouse = { x: e.clientX, y: e.clientY };
    const startTap = { x: Number(comp.props.tap_x ?? comp.x), y: Number(comp.props.tap_y ?? comp.y), w: Number(comp.props.tap_w ?? comp.w), h: Number(comp.props.tap_h ?? comp.h) };

    const onMove = (ev) => {
      const dx = (ev.clientX - startMouse.x) / this.zoom;
      const dy = (ev.clientY - startMouse.y) / this.zoom;
      const p = comp.props;
      const live = { x: startTap.x, y: startTap.y, w: startTap.w, h: startTap.h };

      if (corner) {
        let { x, y, w, h } = live;
        if (corner.includes('e')) w = live.w + dx;
        if (corner.includes('s')) h = live.h + dy;
        if (corner.includes('w')) { w = live.w - dx; x = live.x + dx; }
        if (corner.includes('n')) { h = live.h - dy; y = live.y + dy; }
        w = Math.max(8, w); h = Math.max(8, h);
        if (this.snapGrid) { x = Math.round(x / GRID) * GRID; y = Math.round(y / GRID) * GRID; w = Math.round(w / GRID) * GRID; h = Math.round(h / GRID) * GRID; }
        p.tap_x = x; p.tap_y = y; p.tap_w = w; p.tap_h = h;
      } else {
        let x = live.x + dx;
        let y = live.y + dy;
        if (this.snapGrid) { x = Math.round(x / GRID) * GRID; y = Math.round(y / GRID) * GRID; }
        p.tap_x = x; p.tap_y = y; p.tap_w = live.w; p.tap_h = live.h;
      }
      this.store._emit();
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      this.store.commit();
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  _onNodeMouseDown(e, comp) {
    e.stopPropagation();
    if (e.target && e.target.dataset && e.target.dataset.tapZone === 'true') {
      this._onTapZoneMouseDown(e, comp);
      return;
    }
    const isHandle = e.target.classList.contains('handle');
    const state = this.store.state;

    if (!isHandle) {
      if (e.shiftKey) {
        const sel = new Set(this.store.selection);
        if (sel.has(comp.id)) sel.delete(comp.id); else sel.add(comp.id);
        this.store.setSelection([...sel]);
      } else if (!this.store.selection.has(comp.id)) {
        this.store.setSelection([comp.id]);
      }
    }

    const selectedIds = [...this.store.selection];
    const startPositions = selectedIds.map((id) => {
      const c = state.components.find((x) => x.id === id);
      return { id, x: c.x, y: c.y };
    });
    const startMouse = { x: e.clientX, y: e.clientY };
    const corner = isHandle ? e.target.dataset.corner : null;
    const startBox = { x: comp.x, y: comp.y, w: comp.w, h: comp.h };

    const onMove = (ev) => {
      const dx = (ev.clientX - startMouse.x) / this.zoom;
      const dy = (ev.clientY - startMouse.y) / this.zoom;

      if (corner) {
        const target = state.components.find((c) => c.id === comp.id);
        let { x, y, w, h } = startBox;
        if (corner.includes('e')) w = startBox.w + dx;
        if (corner.includes('s')) h = startBox.h + dy;
        if (corner.includes('w')) { w = startBox.w - dx; x = startBox.x + dx; }
        if (corner.includes('n')) { h = startBox.h - dy; y = startBox.y + dy; }
        w = Math.max(8, w); h = Math.max(8, h);
        if (this.snapGrid) { x = Math.round(x / GRID) * GRID; y = Math.round(y / GRID) * GRID; w = Math.round(w / GRID) * GRID; h = Math.round(h / GRID) * GRID; }
        Object.assign(target, { x, y, w, h });

        this.store._emit();
      } else {
        for (const sp of startPositions) {
          const target = state.components.find((c) => c.id === sp.id);
          if (target.locked) continue;
          let nx = sp.x + dx;
          let ny = sp.y + dy;
          if (this.snapGrid) { nx = Math.round(nx / GRID) * GRID; ny = Math.round(ny / GRID) * GRID; }
          target.x = nx; target.y = ny;
        }
        const t = state.components.find((c) => c.id === comp.id);

        this._showCenterGuides(t);
        this.store._emit();
      }
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      this.guideH.style.display = 'none';
      this.guideV.style.display = 'none';

      this.store.commit();
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  _showCenterGuides(comp) {
    const { w, h } = this.store.state.device;
    const cx = comp.x + comp.w / 2;
    const cy = comp.y + comp.h / 2;
    const nearCenterX = Math.abs(cx - w / 2) < 6;
    const nearCenterY = Math.abs(cy - h / 2) < 6;
    this.guideV.style.display = nearCenterX ? 'block' : 'none';
    this.guideV.style.left = w / 2 + 'px';
    this.guideH.style.display = nearCenterY ? 'block' : 'none';
    this.guideH.style.top = h / 2 + 'px';
    if (nearCenterX) comp.x = w / 2 - comp.w / 2;
    if (nearCenterY) comp.y = h / 2 - comp.h / 2;
  }
}
