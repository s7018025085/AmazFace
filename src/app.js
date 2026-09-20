// src/app.js

const store = new ProjectStore();

const paletteEl = document.getElementById('palette');
const canvasRoot = document.getElementById('canvas-root');
const layersRoot = document.getElementById('layers-root');
const inspectorRoot = document.getElementById('inspector-root');
const assetsRoot = document.getElementById('assets-root');
const apiSelect = document.getElementById('api-level-select');
const projectNameEl = document.getElementById('project-name');

const canvasEditor = new CanvasEditor(canvasRoot, store);
// Раз в секунду обновляем ТОЛЬКО текст «живых» виджетов (время/дата/AM-PM/день
// недели), а не пересобираем DOM всей сцены: полный render() каждую секунду
// пересоздавал узлы всех компонентов, ронял фокус и грузил браузер на больших
// макетах. См. CanvasEditor.tickLiveText().
setInterval(() => canvasEditor.tickLiveText(), 1000);
const layers = new LayersPanel(layersRoot, store);

// Сворачиваемые секции боковых панелей (кроме «Ресурсов» — ими управляет
// AssetManager). Панель «Слои» по умолчанию свёрнута: список нужен не всегда,
// а в развёрнутом виде он отодвигает «Свойства» вниз. Состояние запоминается
// в localStorage, поэтому развёрнутая панель такой и останется.
function initCollapsibleSections(defaults) {
  document.querySelectorAll('.panel-title.collapsible[data-section]').forEach((title) => {
    const section = title.dataset.section;
    if (section === 'resources') return;
    const content = document.querySelector(`.collapsible-content[data-section="${section}"]`);
    const btn = title.querySelector('.toggle-btn');
    if (!content || !btn) return;

    const apply = (collapsed) => {
      content.classList.toggle('collapsed', collapsed);
      btn.textContent = collapsed ? '▶' : '▼';
    };
    const key = `${section}-collapsed`;
    const saved = localStorage.getItem(key);
    apply(saved === null ? !!(defaults && defaults[section]) : saved === 'true');

    title.addEventListener('click', () => {
      const collapsed = !content.classList.contains('collapsed');
      apply(collapsed);
      localStorage.setItem(key, String(collapsed));
    });
  });
}
initCollapsibleSections({ layers: true });
const inspector = new Inspector(inspectorRoot, store);
const assetManager = new AssetManager(assetsRoot, store);
const projectSettings = new ProjectSettings(document.getElementById('project-settings-root'), store);

// Экранирует текст для безопасной вставки в HTML-атрибут (data-tip, title).
function escAttr(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

// Собирает полный текст подсказки для компонента палитры: описание +
// техническая справка (widget id, мин. API, статус проверки, источник данных).
function paletteTooltipFor(def, compat) {
  const parts = [];
  parts.push(def.description || def.name);
  parts.push(`Виджет: hmUI.widget.${def.widgetId} · Мин. API: ${def.apiLevel}+ · ${def.confidence === 'unverified' ? '⚠ не полностью подтверждено документацией' : '✓ подтверждено docs.zepp.com'}.`);
  if (def.dataBindable) parts.push(`Источник данных: ${def.dataSource} (фиксированный).`);
  if (def.dataSourceSelectable) parts.push('Источник данных выбирается в Inspector после добавления на холст (по умолчанию — статический текст).');
  if (!compat) parts.push(`⚠ Недоступно при текущем уровне API проекта — требуется API ${def.apiLevel}+.`);
  return parts.join(' ');
}

function renderPalette() {
  const byCat = listByCategory();
  paletteEl.innerHTML = CATEGORIES.map((cat) => `
    <div class="palette-cat">
      <div class="palette-cat-title">${cat}</div>
      <div class="palette-items">
        ${byCat[cat].map((def) => {
          const compat = isApiCompatible(def.apiLevel, store.state.apiLevel);
          return `<button class="palette-item ${compat ? '' : 'disabled'}" draggable="true"
              data-def="${def.id}" data-tip="${escAttr(paletteTooltipFor(def, compat))}">
            <span class="palette-item-name">${def.name}</span>
            <span class="palette-item-api">${def.apiLevel}+${def.confidence === 'unverified' ? ' ⚠' : ''}</span>
          </button>`;
        }).join('')}
      </div>
    </div>
  `).join('');

  paletteEl.querySelectorAll('.palette-item').forEach((btn) => {
    if (btn.classList.contains('disabled')) { btn.addEventListener('click', (e) => e.preventDefault()); return; }
    btn.addEventListener('dblclick', () => {
      store.addComponent(btn.dataset.def, 140, 140);
    });
    btn.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', btn.dataset.def);
    });
  });

  // Палитра перерисовывается через innerHTML при каждом renderAll(), поэтому
  // новые кнопки нужно заново привязать к менеджеру подсказок (tooltips.js).
  if (window.tooltipManager) window.tooltipManager.refresh();
}

canvasRoot.addEventListener('dragover', (e) => e.preventDefault());
canvasRoot.addEventListener('drop', (e) => {
  e.preventDefault();
  const defId = e.dataTransfer.getData('text/plain');
  if (!defId || !REGISTRY[defId]) return;
  const frameRect = canvasEditor.frame.getBoundingClientRect();
  const x = (e.clientX - frameRect.left) / canvasEditor.zoom;
  const y = (e.clientY - frameRect.top) / canvasEditor.zoom;
  store.addComponent(defId, Math.max(0, Math.round(x)), Math.max(0, Math.round(y)));
});

// ---- Validation strip ----
// Единственная точка валидации проекта. Раньше renderValidation() вызывал
// validateProject(), но такой функции в Designer не было. Из-за ReferenceError
// выполнение app.js останавливалось прямо во время первого renderAll(): после
// этого не навешивались обработчики «Новый», «Открыть» и «Демо».
function validateProject(project) {
  const errors = [];
  const warnings = [];
  const p = project || {};

  if (!p.meta || !p.meta.name) warnings.push('У проекта нет названия.');
  if (!p.device || !Number.isFinite(Number(p.device.w)) || !Number.isFinite(Number(p.device.h))) {
    errors.push('Не задан корректный размер устройства.');
  }
  if (!Array.isArray(p.components)) errors.push('Поле components должно быть массивом.');
  if (!Array.isArray(p.assets)) errors.push('Поле assets должно быть массивом.');
  if (!Array.isArray(p.fonts)) errors.push('Поле fonts должно быть массивом.');

  const assets = new Set((p.assets || []).map(a => a && a.id).filter(Boolean));
  const fonts = new Set((p.fonts || []).map(f => f && f.id).filter(Boolean));

  for (const c of (p.components || [])) {
    if (!c || !c.defId) { errors.push('Обнаружен компонент без defId.'); continue; }
    const def = REGISTRY[c.defId];
    if (!def) { errors.push(`Неизвестный компонент: ${c.defId}.`); continue; }
    if (!Number.isFinite(Number(c.x)) || !Number.isFinite(Number(c.y)) ||
        !Number.isFinite(Number(c.w)) || !Number.isFinite(Number(c.h))) {
      errors.push(`Некорректные координаты или размер компонента ${c.id || c.defId}.`);
    }
    const props = c.props || {};
    if (props.font && !fonts.has(props.font)) {
      errors.push(`Компонент ${c.id || c.defId} ссылается на отсутствующий шрифт ${props.font}.`);
    }
    if (def.widgetId === 'IMG' && props.src && !assets.has(props.src)) {
      warnings.push(`Изображение компонента ${c.id || c.defId} не найдено среди ресурсов.`);
    }
    if (def.widgetId === 'TIME_POINTER' && props.path && !assets.has(props.path)) {
      warnings.push(`Ресурс стрелки компонента ${c.id || c.defId} не найден среди ресурсов.`);
    }
  }

  if (p.background && p.background.imageAssetId && !assets.has(p.background.imageAssetId)) {
    warnings.push(`Фоновое изображение ${p.background.imageAssetId} не найдено среди ресурсов.`);
  }
  if (p.device && !p.device.targetKey) {
    warnings.push('У устройства не задан targetKey — экспорт полного проекта потребует ручной настройки.');
  }
  return { errors, warnings };
}

const validationEl = document.getElementById('validation-strip');
function renderValidation() {
  const { errors, warnings } = validateProject(store.state);
  if (errors.length === 0 && warnings.length === 0) {
    validationEl.innerHTML = '<span class="valid-ok">✓ Проблем не обнаружено</span>';
    return;
  }
  validationEl.innerHTML = [
    ...errors.map((e) => `<span class="valid-error">ОШИБКА: ${e}</span>`),
    ...warnings.map((w) => `<span class="valid-warn">ПРЕДУПРЕЖДЕНИЕ: ${w}</span>`),
  ].join('');
}

const sceneNormalBtn = document.getElementById('scene-normal');
const sceneAodBtn = document.getElementById('scene-aod');
const aodPanel = document.getElementById('aod-panel');
const aodStatus = document.getElementById('aod-status');

function syncAodControls() {
  if (!aodPanel) return;
  const active = store.state.mode === 'aod';
  aodPanel.hidden = !active;
  document.body.classList.toggle('aod-mode', active);
  sceneNormalBtn?.classList.toggle('active', !active);
  sceneAodBtn?.classList.toggle('active', active);
  if (!active) { if (aodStatus) aodStatus.hidden = true; return; }
  const st = store.getAodSettings();
  const set = (id, val) => { const el=document.getElementById(id); if(el && document.activeElement!==el) el.value=val; };
  set('aod-bg', st.background || '#000000');
  set('aod-brightness', st.brightness ?? 100);
  set('aod-test-time', st.testTime || '10:10');
  set('aod-test-date', st.testDate || '');
  set('aod-battery', st.sensorValues?.battery ?? 85);
  set('aod-steps', st.sensorValues?.steps ?? 8452);
  set('aod-heart', st.sensorValues?.heart ?? 72);
  const sec=document.getElementById('aod-show-seconds'); if(sec) sec.checked=!!st.showSeconds;
  document.querySelectorAll('[data-aod-preview]').forEach(b=>b.classList.toggle('active', b.dataset.aodPreview === (st.previewMode || 'AOD')));
  if (aodStatus) {
    const cfg=buildAodConfig(store.state);
    aodStatus.hidden=false;
    aodStatus.innerHTML=`<b>AOD Studio</b><br>Объектов: ${store.state.components.length}. Экспортируемых: ${cfg.objects.filter(o=>o.exportable).length}. Только конфигурация редактора — без выдуманного Zepp OS AOD API.`;
  }
}

function updateAodSettingFromUi() {
  if (store.state.mode !== 'aod') return;
  const sensorValues = {
    battery: Number(document.getElementById('aod-battery')?.value || 0),
    steps: Number(document.getElementById('aod-steps')?.value || 0),
    heart: Number(document.getElementById('aod-heart')?.value || 0)
  };
  store.updateAodSettings({
    background: document.getElementById('aod-bg')?.value || '#000000',
    brightness: Number(document.getElementById('aod-brightness')?.value || 100),
    testTime: document.getElementById('aod-test-time')?.value || '10:10',
    testDate: document.getElementById('aod-test-date')?.value || '',
    showSeconds: !!document.getElementById('aod-show-seconds')?.checked,
    sensorValues
  });
}

sceneNormalBtn?.addEventListener('click',()=>store.switchScene('normal'));
sceneAodBtn?.addEventListener('click',()=>store.switchScene('aod'));
function createAodSubset(kind) {
  const existingAod = store.state.mode === 'aod' ? store.state.components : (store.state.scenes?.aod?.components || []);
  if (existingAod.length && !confirm('Заменить существующую AOD-сцену выбранными элементами Normal?')) return;

  const filter = (c) => {
    const def = REGISTRY[c.defId];
    if (!def) return false;
    if (kind === 'images') return def.widgetId === 'IMG';
    if (kind === 'hands') return def.widgetId === 'TIME_POINTER';
    if (kind === 'text') return def.widgetId === 'TEXT' || !!def.dataSource || !!c.props?.data_source;
    return true;
  };

  const count = store.createAodFromNormal({ filter });
  if (aodStatus) {
    aodStatus.hidden = false;
    aodStatus.innerHTML = `<b>AOD Studio</b><br>Перенесено из Normal: <strong>${count}</strong> объектов.`;
  }
  renderAll();
}
document.getElementById('aod-from-normal')?.addEventListener('click',()=>createAodSubset('all'));
document.getElementById('aod-from-images')?.addEventListener('click',()=>createAodSubset('images'));
document.getElementById('aod-from-hands')?.addEventListener('click',()=>createAodSubset('hands'));
document.getElementById('aod-from-text')?.addEventListener('click',()=>createAodSubset('text'));
document.getElementById('aod-clear')?.addEventListener('click',()=>{
  if(confirm('Очистить только AOD-сцену? Normal останется без изменений.')) store.clearAod();
});
document.getElementById('aod-export')?.addEventListener('click',()=>{
  const cfg=downloadAodConfig(store.state);
  alert(`AOD-конфигурация экспортирована. Предупреждений: ${cfg.warnings.length}.`);
});
['aod-bg','aod-brightness','aod-test-time','aod-test-date','aod-battery','aod-steps','aod-heart','aod-show-seconds'].forEach(id=>{
  document.getElementById(id)?.addEventListener('change', updateAodSettingFromUi);
});
document.querySelectorAll('[data-aod-preview]').forEach(btn=>btn.addEventListener('click',()=>{
  if(store.state.mode!=='aod') return;
  store.updateAodSettings({previewMode:btn.dataset.aodPreview});
}));

function renderAll() {
  canvasEditor.render();
  layers.render();
  inspector.render();
  assetManager.render();
  projectSettings.render();
  apiSelect.value = store.state.apiLevel;
  projectNameEl.value = store.state.meta.name;
  renderPalette();
  renderValidation();
  syncAodControls();
}

store.subscribe(renderAll);
renderAll();

apiSelect.addEventListener('change', () => {
  store.state.apiLevel = apiSelect.value;
  store.commit();
});

projectNameEl.addEventListener('change', () => {
  store.state.meta.name = projectNameEl.value || 'My Watch Face';
  store.commit();
});

// ---- Toolbar actions ----
document.getElementById('act-undo').onclick = () => store.undo();
document.getElementById('act-redo').onclick = () => store.redo();
document.getElementById('act-dup').onclick = () => store.duplicateComponents([...store.selection]);
document.getElementById('act-del').onclick = () => confirmRemoveComponents(store, [...store.selection]);

document.getElementById('act-new').onclick = () => {
  if (confirm('Создать новый проект? Несохранённые изменения будут потеряны.')) store.newProject();
};

document.getElementById('act-save').onclick = async () => {
  try {
    store.state.preview = store.state.preview || {};
    store.state.preview.dataUrl = await buildPreviewDataUrl(store.state, 324);
    store.state.preview.width = 324;
    store.state.preview.height = 324;
    store.state.preview.handsTime = '10:10';
  } catch (e) { console.warn('Preview generation failed:', e); }
  store._saveActiveScene();
  const blob = new Blob([store.toJSON()], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  // Имя файла всегда латиницей: кириллические названия транслитерируются
  // (см. src/util/slug.js), иначе файл неудобно передавать в Zeus CLI/git/архивы.
  a.download = `${latinSlug(store.state.meta.name, 'watchface')}.watchface.json`;
  a.click();
};

document.getElementById('act-open').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try { store.loadFromJSON(reader.result); }
    catch (err) { alert('Не удалось загрузить проект: ' + err.message); }
  };
  reader.readAsText(file);
  e.target.value = '';
});

// ---- Background is edited from the Layers panel ----
// The old standalone background controls were intentionally removed.
// Selecting the "Фон" layer opens its color/image/opacity properties in Inspector.

// ---- Export: full project (.zip) ----
document.getElementById('act-export-project').onclick = async () => {
  try {
    const { blob, validation } = await exportFullProject(store.state);
    if (validation.errors.length) {
      const proceed = confirm(
        `В проекте ${validation.errors.length} ошибок(-а):\n\n` +
        validation.errors.join('\n') +
        `\n\nЭкспортировать проект как есть?`
      );
      if (!proceed) return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${latinSlug(store.state.meta.name, 'watchface')}.zip`;
    a.click();
  } catch (err) {
    alert('Не удалось собрать проект: ' + err.message);
  }
};

// ---- Demo watch face ----
document.getElementById('act-demo').onclick = () => {
  if (!confirm('Заменить текущие компоненты демо-макетом?')) return;
  store.state.components = [];
  store.state.nextIndex = {};
  const cx = store.state.device.w / 2;
  const add = (defId, x, y, patch = {}) => {
    const idx = (store.state.nextIndex[defId] || 0) + 1;
    store.state.nextIndex[defId] = idx;
    const def = REGISTRY[defId];
    const props = {};
    for (const p of def.properties) if (p.default !== undefined) props[p.key] = p.default;
    Object.assign(props, patch.props || {});
    store.state.components.push({
      id: `${defId}_${String(idx).padStart(3, '0')}`, defId, name: def.name,
      x, y, w: patch.w ?? def.defaultSize.w, h: patch.h ?? def.defaultSize.h,
      visible: true, locked: false, props,
    });
  };
  add('time_hm', cx - 150, 150, { w: 300, h: 100, props: { text_size: 84, color: '#ffffff', align_h: 'CENTER_H', align_v: 'CENTER_V' } });
  add('date_full', cx - 110, 250, { w: 220, h: 36, props: { text_size: 26, color: '#aeb6c2', align_h: 'CENTER_H', align_v: 'CENTER_V', format: 'DD MMM' } });
  add('weather_icon', cx - 90, 300, { w: 48, h: 48, props: { src: 'sunny' } });
  add('weather_temp', cx - 30, 305, { w: 90, h: 40, props: { text_size: 30, color: '#ffffff', align_h: 'LEFT', align_v: 'CENTER_V', unit: '°C' } });
  add('heart_rate', cx - 60, 360, { w: 120, h: 34, props: { text_size: 26, color: '#ff5c7a', align_h: 'CENTER_H', align_v: 'CENTER_V', prefix: '♥ ' } });
  add('steps', cx - 90, 400, { w: 180, h: 34, props: { text_size: 24, color: '#8fd3ff', align_h: 'CENTER_H', align_v: 'CENTER_V', suffix: ' шагов' } });
  add('battery', cx - 40, 440, { w: 80, h: 30, props: { text_size: 22, color: '#8bffb0', align_h: 'CENTER_H', align_v: 'CENTER_V', suffix: '%' } });
  store.commit();
};

// keep palette compatibility in sync visually (re-render already handled by subscribe)
