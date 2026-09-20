// src/project/project.js

// Профили устройств.
//
// ВАЖНО: `targetKey` и `deviceSources` — это идентификаторы конкретной модели
// из app.json, которые Zeus CLI подставляет сам при `zeus create`. Выдумывать
// их для моделей, которых мы не видели, нельзя (см. правило «не выдумывать
// Zepp API»), поэтому кроме проверенного профиля Balance 2 здесь только
// ГЕОМЕТРИЧЕСКИЕ пресеты: размер/форма заданы, а targetKey/deviceSource
// пользователь вписывает вручную из app.json своего zeus-шаблона.
// Незаполненные поля блокируют экспорт проекта ошибкой валидации.
const DEVICES = {
  amazfit_balance_2: {
    id: 'amazfit_balance_2', name: 'Amazfit Balance 2 (480×480)', w: 480, h: 480, shape: 'round',
    // Данные для сборки app.json ("targets" по документации Zepp OS SDK).
    targetKey: '480x480-amazfit-balance-2',
    deviceSources: [9568512, 9568513, 9568515],
    designWidth: 480,
  },
  round_480: {
    id: 'round_480', name: 'Круглый 480×480 — target вручную', w: 480, h: 480, shape: 'round',
    targetKey: '', deviceSources: [], designWidth: 480,
  },
  round_466: {
    id: 'round_466', name: 'Круглый 466×466 — target вручную', w: 466, h: 466, shape: 'round',
    targetKey: '', deviceSources: [], designWidth: 466,
  },
  square_390_450: {
    id: 'square_390_450', name: 'Прямоугольный 390×450 — target вручную', w: 390, h: 450, shape: 'square',
    targetKey: '', deviceSources: [], designWidth: 390,
  },
  custom: {
    id: 'custom', name: 'Другое устройство (все поля вручную)', w: 480, h: 480, shape: 'round',
    targetKey: '', deviceSources: [], designWidth: 480,
  },
};

function makeDevice(deviceId) {
  const base = DEVICES[deviceId] || DEVICES.amazfit_balance_2;
  return JSON.parse(JSON.stringify(base));
}

// appId 10001 — заведомая заглушка: перед публикацией его нужно заменить на
// идентификатор, выданный в Zepp Developer Console. Валидатор об этом напомнит.
const PLACEHOLDER_APP_ID = 10001;

function defaultAppMeta() {
  return { appId: PLACEHOLDER_APP_ID, vendor: 'designer', versionName: '1.0.0', versionCode: 1 };
}

function uid(prefix) {
  return `${prefix}_${String(Math.floor(Math.random() * 900) + 100)}`;
}

function defaultProject() {
  return {
    meta: { name: 'My Watch Face', createdAt: Date.now() },
    apiLevel: '3.0',
    device: makeDevice('amazfit_balance_2'),
    app: defaultAppMeta(),
    background: { color: '#000000', imageAssetId: null, alpha: 100 },
    components: [],
    assets: [],
    fonts: [],
    nextIndex: {},
    preview: { dataUrl: null, width: 324, height: 324, handsTime: '10:10' },
    mode: 'normal',
    scenes: {
      aod: {
        components: [],
        background: { color: '#000000', imageAssetId: null, alpha: 100 },
        settings: {
          width: 480, height: 480, background: '#000000',
          previewMode: 'AOD', brightness: 100, showSeconds: false,
          testTime: '10:10', testDate: '18.09.2026',
          sensorValues: { battery: 85, steps: 8452, heart: 72 }
        }
      }
    }
  };
}

class ProjectStore {
  constructor() {
    this.state = defaultProject();
    this.history = [];
    this.future = [];
    this.selection = new Set();
    this.listeners = new Set();
    this._pushHistory(true);
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  _emit() {
    for (const l of this.listeners) l(this.state, this.selection);
  }

  _snapshot() {
    // Ассеты (PNG/JPEG в виде base64 dataURL) намеренно НЕ попадают в снапшот
    // истории: иначе каждый шаг undo хранил бы полную копию всех картинок, и
    // при десятке изображений история из 100 шагов съедала бы сотни мегабайт.
    // Плата за это — добавление/удаление ресурса не откатывается через undo
    // (управляется отдельно в панели «Ресурсы»).
    const { assets, fonts, ...rest } = this.state;
    return JSON.stringify({ state: rest, selection: [...this.selection] });
  }

  // Восстанавливает состояние из снапшота, подставляя АКТУАЛЬНЫЙ список
  // ресурсов (он вне истории, см. _snapshot).
  _restore(snapshotJson) {
    const snap = JSON.parse(snapshotJson);
    const assets = this.state.assets || [];
    const fonts = this.state.fonts || [];
    this.state = Object.assign({}, snap.state, { assets, fonts });
    this.selection = new Set(snap.selection);
    this._emit();
  }

  _pushHistory(initial = false) {
    if (!initial) this.future = [];
    this.history.push(this._snapshot());
    if (this.history.length > 100) this.history.shift();
  }

  commit() {
    this._saveActiveScene();
    this._pushHistory();
    this._emit();
  }

  undo() {
    if (this.history.length <= 1) return;
    this.future.push(this.history.pop());
    this._restore(this.history[this.history.length - 1]);
  }

  redo() {
    if (this.future.length === 0) return;
    const snap = this.future.pop();
    this.history.push(this._snapshot());
    this._restore(snap);
  }

  // ---- components ----
  addComponent(defId, x = 100, y = 100) {
    const def = REGISTRY[defId];
    if (!def) return null;
    const idx = (this.state.nextIndex[defId] || 0) + 1;
    this.state.nextIndex[defId] = idx;
    const id = `${defId}_${String(idx).padStart(3, '0')}`;
    const props = {};
    for (const p of def.properties) {
      if (p.default !== undefined) props[p.key] = p.default;
    }
    const comp = {
      id,
      defId,
      name: def.name,
      x, y,
      w: def.defaultSize.w,
      h: def.defaultSize.h,
      visible: true,
      locked: false,
      props,
    };
    this.state.components.push(comp);
    this.selection = new Set([id]);
    this.commit();
    return comp;
  }

  removeComponents(ids) {
    this.state.components = this.state.components.filter((c) => !ids.includes(c.id));
    for (const id of ids) this.selection.delete(id);
    this.commit();
  }

  duplicateComponents(ids) {
    const newIds = [];
    for (const id of ids) {
      const c = this.state.components.find((x) => x.id === id);
      if (!c) continue;
      const idx = (this.state.nextIndex[c.defId] || 0) + 1;
      this.state.nextIndex[c.defId] = idx;
      const newId = `${c.defId}_${String(idx).padStart(3, '0')}`;
      const copy = JSON.parse(JSON.stringify(c));
      copy.id = newId;
      copy.x += 20;
      copy.y += 20;
      this.state.components.push(copy);
      newIds.push(newId);
    }
    this.selection = new Set(newIds);
    this.commit();
  }

  updateComponent(id, patch, opts = {}) {
    const c = this.state.components.find((x) => x.id === id);
    if (!c) return;
    Object.assign(c, patch);
    if (!opts.silent) this.commit(); else this._emit();
  }

  updateComponentProp(id, key, value, opts = {}) {
    const c = this.state.components.find((x) => x.id === id);
    if (!c) return;
    c.props[key] = value;
    if (!opts.silent) this.commit(); else this._emit();
  }

  moveLayer(id, direction) {
    const arr = this.state.components;
    const i = arr.findIndex((c) => c.id === id);
    if (i < 0) return;
    let j;
    if (direction === 'up') j = i + 1;
    else if (direction === 'down') j = i - 1;
    else if (direction === 'top') j = arr.length - 1;
    else if (direction === 'bottom') j = 0;
    if (j < 0 || j >= arr.length) return;
    const [item] = arr.splice(i, 1);
    arr.splice(j, 0, item);
    this.commit();
  }

  setSelection(ids) {
    this.selection = new Set(ids);
    this._emit();
  }

  // ---- Normal / AOD scenes ----
  _sceneSnapshot() {
    return {
      components: JSON.parse(JSON.stringify(this.state.components || [])),
      background: JSON.parse(JSON.stringify(this.state.background || {})),
      nextIndex: JSON.parse(JSON.stringify(this.state.nextIndex || {}))
    };
  }

  _saveActiveScene() {
    this.state.scenes = this.state.scenes || {};
    if (this.state.mode === 'aod') {
      const aod = this.state.scenes.aod || {};
      aod.components = JSON.parse(JSON.stringify(this.state.components || []));
      aod.background = JSON.parse(JSON.stringify(this.state.background || {}));
      aod.settings = Object.assign({}, aod.settings || {});
      this.state.scenes.aod = aod;
    } else {
      this.state.scenes.normal = this._sceneSnapshot();
    }
  }

  switchScene(mode) {
    mode = mode === 'aod' ? 'aod' : 'normal';
    if (mode === this.state.mode) return;
    this._saveActiveScene();
    const scenes = this.state.scenes || {};
    if (mode === 'aod') {
      const aod = scenes.aod || {};
      this.state.components = JSON.parse(JSON.stringify(aod.components || []));
      this.state.background = Object.assign({ color: '#000000', imageAssetId: null, alpha: 100 }, aod.background || {});
      this.state.nextIndex = {};
      for (const c of this.state.components) {
        const n = Number(String(c.id || '').split('_').pop());
        if (c.defId && Number.isFinite(n)) this.state.nextIndex[c.defId] = Math.max(this.state.nextIndex[c.defId] || 0, n);
      }
    } else {
      const normal = scenes.normal || { components: [], background: { color: '#000000', imageAssetId: null, alpha: 100 }, nextIndex: {} };
      this.state.components = JSON.parse(JSON.stringify(normal.components || []));
      this.state.background = Object.assign({ color: '#000000', imageAssetId: null, alpha: 100 }, normal.background || {});
      this.state.nextIndex = JSON.parse(JSON.stringify(normal.nextIndex || {}));
    }
    this.state.mode = mode;
    this.selection = new Set();
    this.commit();
  }

  getAodSettings() {
    this.state.scenes = this.state.scenes || {};
    this.state.scenes.aod = this.state.scenes.aod || {};
    this.state.scenes.aod.settings = Object.assign({
      width: this.state.device?.w || 480, height: this.state.device?.h || 480,
      background: '#000000', previewMode: 'AOD', brightness: 100,
      showSeconds: false, testTime: '10:10', testDate: '18.09.2026',
      sensorValues: { battery: 85, steps: 8452, heart: 72 }
    }, this.state.scenes.aod.settings || {});
    return this.state.scenes.aod.settings;
  }

  updateAodSettings(patch) {
    const settings = this.getAodSettings();
    this.state.scenes.aod.settings = Object.assign({}, settings, patch);
    if (patch.background) {
      this.state.background.color = patch.background;
    }
    this.commit();
  }

  createAodFromNormal(options = {}) {
    // Always take the source from the actual Normal scene. If the user is
    // currently in Normal, first capture the live editor state. This avoids
    // copying a stale/empty scenes.normal from older projects.
    if (this.state.mode === 'normal') this._saveActiveScene();

    const normal = (this.state.scenes && this.state.scenes.normal) || {
      components: [],
      background: { color: '#000000', imageAssetId: null, alpha: 100 },
      nextIndex: {}
    };

    let comps = JSON.parse(JSON.stringify(normal.components || []));
    if (typeof options.filter === 'function') comps = comps.filter(options.filter);

    // AOD receives its own component objects. IDs may remain the same because
    // the scenes are independent; subsequent edits therefore cannot mutate
    // Normal by reference.
    this.state.scenes = this.state.scenes || {};
    this.state.scenes.aod = this.state.scenes.aod || {};
    this.state.scenes.aod.components = comps;
    this.state.scenes.aod.background = { color: '#000000', imageAssetId: null, alpha: 100 };
    this.state.scenes.aod.nextIndex = JSON.parse(JSON.stringify(normal.nextIndex || {}));

    // Load the newly created AOD scene into the live editor.
    this.state.components = JSON.parse(JSON.stringify(comps));
    this.state.background = JSON.parse(JSON.stringify(this.state.scenes.aod.background));
    this.state.nextIndex = JSON.parse(JSON.stringify(this.state.scenes.aod.nextIndex));
    this.state.mode = 'aod';
    this.selection = new Set(comps.map(c => c.id));
    this.commit();
    return comps.length;
  }

  clearAod() {
    this._saveActiveScene();
    this.state.scenes.aod = Object.assign({}, this.state.scenes.aod || {}, {
      components: [], background: { color: '#000000', imageAssetId: null, alpha: 100 }, nextIndex: {}
    });
    if (this.state.mode === 'aod') {
      this.state.components = [];
      this.state.background = { color: '#000000', imageAssetId: null, alpha: 100 };
      this.state.nextIndex = {};
      this.selection = new Set();
    }
    this.commit();
  }

  // ---- device & app metadata ----
  setDevice(deviceId) {
    this.state.device = makeDevice(deviceId);
    this.commit();
  }

  updateDevice(patch) {
    Object.assign(this.state.device, patch);
    // designWidth по умолчанию совпадает с шириной экрана (см. app.json targets).
    if (patch.w !== undefined && !patch.designWidth) this.state.device.designWidth = patch.w;
    this.commit();
  }

  updateApp(patch) {
    this.state.app = Object.assign({}, defaultAppMeta(), this.state.app, patch);
    this.commit();
  }

  // ---- assets ----
  addAsset(asset) {
    this.state.assets.push(asset);
    this.commit();
  }

  removeAsset(id) {
    this.state.assets = this.state.assets.filter((a) => a.id !== id);
    this.commit();
  }

  renameAsset(id, name) {
    const a = this.state.assets.find((x) => x.id === id);
    if (a) { a.name = name; this.commit(); }
  }

  // ---- fonts ----
  addFont(font) {
    this.state.fonts = this.state.fonts || [];
    this.state.fonts.push(font);
    this.commit();
    return font;
  }

  removeFont(id) {
    this.state.fonts = (this.state.fonts || []).filter((f) => f.id !== id);
    for (const c of this.state.components) {
      if (c.props && c.props.font === id) delete c.props.font;
    }
    this.commit();
  }

  renameFont(id, name) {
    const f = (this.state.fonts || []).find((x) => x.id === id);
    if (f) { f.name = name; this.commit(); }
  }

  // ---- project io ----
  toJSON() {
    this._saveActiveScene();
    return JSON.stringify(this.state, null, 2);
  }

  loadFromJSON(json) {
    const parsed = JSON.parse(json);
    this.state = migrateProject(parsed);
    // Открытие сохранённого проекта всегда начинается с Normal.
    // AOD остаётся сохранённым в scenes.aod и доступен через AOD Studio.
    this.state.mode = 'normal';
    const normal = this.state.scenes?.normal;
    if (normal) {
      this.state.components = JSON.parse(JSON.stringify(normal.components || []));
      this.state.background = Object.assign({ color: '#000000', imageAssetId: null, alpha: 100 }, normal.background || {});
      this.state.nextIndex = JSON.parse(JSON.stringify(normal.nextIndex || {}));
    }
    this.selection = new Set();
    this.history = [];
    this.future = [];
    this._pushHistory(true);
    for (const font of this.state.fonts || []) {
      if (typeof registerProjectFont === 'function') registerProjectFont(font);
    }
    this._emit();
  }

  newProject() {
    this.state = defaultProject();
    this.selection = new Set();
    this.history = [];
    this.future = [];
    this._pushHistory(true);
    this._emit();
  }
}

// Подмешивает отсутствующие поля в проект, сохранённый более старой версией
// Designer: новые секции состояния и новые свойства компонентов (например,
// «ход секундной стрелки») получают значения по умолчанию из реестра,
// вместо того чтобы стать undefined и уронить рендер/экспорт.
function migrateProject(parsed) {
  const base = defaultProject();
  const state = Object.assign({}, base, parsed);
  state.meta = Object.assign({}, base.meta, parsed.meta || {});
  state.background = Object.assign({}, base.background, parsed.background || {});
  state.device = Object.assign({}, base.device, parsed.device || {});
  state.app = Object.assign({}, base.app, parsed.app || {});
  state.assets = Array.isArray(parsed.assets) ? parsed.assets : [];
  // ВАЖНО: сохраняем пользовательские шрифты при миграции старого проекта.
  // Раньше migrateProject() оставлял fonts из defaultProject() (пустой массив),
  // из-за чего ссылки font_XXX становились «сиротами» после открытия проекта.
  state.fonts = Array.isArray(parsed.fonts) ? parsed.fonts : [];
  state.nextIndex = parsed.nextIndex || {};
  // Старые версии Designer могли сохранять `preview` как готовую строку
  // (а не как объект {dataUrl, width, height, handsTime}). Такой проект
  // должен открываться нормально: старое превью можно безопасно пересоздать.
  if (parsed.preview && typeof parsed.preview === 'object' && !Array.isArray(parsed.preview)) {
    state.preview = Object.assign({}, base.preview, parsed.preview);
  } else {
    state.preview = Object.assign({}, base.preview);
  }
  state.mode = parsed.mode === 'aod' ? 'aod' : 'normal';
  state.scenes = parsed.scenes && typeof parsed.scenes === 'object' ? parsed.scenes : {};
  state.scenes.aod = Object.assign({
    components: [], background: { color: '#000000', imageAssetId: null, alpha: 100 },
    settings: { width: state.device.w, height: state.device.h, background: '#000000', previewMode: 'AOD', brightness: 100, showSeconds: false, testTime: '10:10', testDate: '18.09.2026', sensorValues: { battery: 85, steps: 8452, heart: 72 } }
  }, state.scenes.aod || {});
  state.scenes.normal = state.scenes.normal || {
    components: JSON.parse(JSON.stringify(parsed.components || [])),
    background: Object.assign({}, base.background, parsed.background || {}),
    nextIndex: JSON.parse(JSON.stringify(parsed.nextIndex || {}))
  };
  state.components = (parsed.components || []).map((c) => {
    const def = REGISTRY[c.defId];
    if (!def) return c;
    const props = Object.assign({}, c.props);
    for (const p of def.properties) {
      if (p.default !== undefined && props[p.key] === undefined) props[p.key] = p.default;
    }
    return Object.assign({ visible: true, locked: false }, c, { props });
  });
  return state;
}

function makeAssetId() {
  return uid('asset');
}

function makeFontId() {
  return uid('font');
}

async function registerProjectFont(font) {
  if (!font || !font.dataUrl || !('FontFace' in window)) return;
  try {
    const face = new FontFace(font.cssFamily || font.name, `url(${font.dataUrl})`);
    await face.load();
    document.fonts.add(face);
    return face;
  } catch (e) { console.warn('Не удалось загрузить шрифт в предпросмотр:', e); }
}
