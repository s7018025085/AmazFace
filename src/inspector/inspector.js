// src/inspector/inspector.js

class Inspector {
  constructor(root, store) {
    this.root = root;
    this.store = store;
    // true, пока изменение прилетело из поля ввода самого Inspector:
    // в этот момент перерисовывать панель нельзя — innerHTML пересоздаёт
    // <input>, и фокус слетает после каждой введённой цифры.
    this._selfEdit = false;
  }

  // Запоминает, какое поле было в фокусе и где стоял курсор, чтобы вернуть
  // их после перерисовки (перерисовка приходит, например, по Enter).
  _captureFocus() {
    const el = document.activeElement;
    if (!el || !this.root.contains(el)) return null;
    const sel = el.dataset && (el.dataset.prop ? `[data-prop="${el.dataset.prop}"]` : el.dataset.field ? `[data-field="${el.dataset.field}"]` : null);
    if (!sel) return null;
    const desc = { sel };
    // selectionStart у input[type=number] в Chrome бросает исключение —
    // сохраняем каретку только для текстовых полей.
    if (el.type === 'text') { desc.start = el.selectionStart; desc.end = el.selectionEnd; }
    return desc;
  }

  _restoreFocus(desc) {
    if (!desc) return;
    const el = this.root.querySelector(desc.sel);
    if (!el || typeof el.focus !== 'function') return;
    el.focus();
    if (desc.start != null && typeof el.setSelectionRange === 'function') {
      try { el.setSelectionRange(desc.start, desc.end); } catch (e) { /* не текстовое поле */ }
    }
  }

  render() {
    if (this._selfEdit) return;
    const focusDesc = this._captureFocus();
    const result = this._render();
    this._restoreFocus(focusDesc);
    // В панели появились новые элементы с data-tip — их нужно привязать
    // к менеджеру подсказок заново (см. src/ui/tooltips.js).
    if (window.tooltipManager) window.tooltipManager.refresh();
    return result;
  }

  _render() {
    const sel = [...this.store.selection];
    if (sel.length === 0) { this.root.innerHTML = `<div class="empty-hint">Выберите компонент, чтобы изменить его свойства.</div>`; return; }
    if (sel.length > 1) { this._renderMulti(sel); return; }

    // Background is a first-class layer, but remains stored in the scene
    // background object so old projects and exports stay compatible.
    if (sel[0] === '__background__') {
      this._renderBackground();
      return;
    }

    const selectedId = sel[0];
    const tapParentId = this._tapParentId(selectedId);
    const comp = this.store.state.components.find((c) => c.id === (tapParentId || selectedId));
    if (!comp) { this.root.innerHTML = ''; return; }
    if (tapParentId) {
      const tapLabel = `Tap zone для ${comp.name}`;
      this.root.innerHTML = `
        <div class="insp-header">
          <div class="insp-name">${this._esc(tapLabel)}</div>
          <div class="insp-id">${selectedId}</div>
        </div>
        <div class="insp-section-title">Прозрачная зона тап</div>
        <div class="insp-grid">
          ${['tap_x', 'tap_y', 'tap_w', 'tap_h'].map((key) => this._fieldFor(comp, { key, label: key.replace('tap_', 'tap ').toUpperCase(), kind: 'number', default: comp.props[key] ?? (key.endsWith('_x') ? comp.x : key.endsWith('_y') ? comp.y : key.endsWith('_w') ? comp.w : comp.h), min: 0, max: 10000 }))
            .join('')}
        </div>
      `;
      this.root.querySelectorAll('[data-prop]').forEach((el) => {
        const key = el.dataset.prop;
        if (!Object.prototype.hasOwnProperty.call(comp.props, key)) return;
        const readValue = () => el.type === 'number' ? Number(el.value) : el.value;
        el.addEventListener('change', () => this.store.updateComponentProp(comp.id, key, readValue()));
      });
      return;
    }
    const def = REGISTRY[comp.defId];
    const compat = isApiCompatible(def.apiLevel, this.store.state.apiLevel);

    const rows = [];
    rows.push(`
      <div class="insp-header">
        <input class="insp-name" value="${this._esc(comp.name)}" data-field="name" data-tip="Имя компонента в панели слоёв и в комментарии сгенерированного кода. На сам циферблат не выводится." />
        <div class="insp-id">${comp.id} · ${def.widgetId}</div>
        <div class="api-badge ${compat ? 'ok' : 'bad'}">API ${def.apiLevel}${def.apiLevel.includes('+') ? '' : '+'} ${compat ? '✓' : '⚠ несовместимо с API проекта ' + this.store.state.apiLevel}</div>
        ${def.confidence === 'unverified' ? '<div class="api-badge warn">⚠ Непроверенный набор свойств — сверьтесь с docs.zepp.com перед публикацией</div>' : ''}
      </div>
    `);

    rows.push(`<div class="insp-section-title">Позиция и размер</div>`);
    rows.push(`<div class="insp-grid">`);
    for (const key of ['x', 'y', 'w', 'h']) {
      const isCircle = def.widgetId === 'CIRCLE' || def.widgetId === 'STROKE_CIRCLE';
      if (isCircle) continue;
      rows.push(this._numberField(key, key.toUpperCase(), comp[key]));
    }
    rows.push(`</div>`);
    if (this.store.state.mode === 'aod') {
      rows.push(`<div class="insp-section-title">Трансформация AOD</div>`);
      rows.push(`<div class="insp-grid">`);
      rows.push(this._numberField('rotation', 'ПОВОРОТ °', Number(comp.props.rotation || 0)));
      rows.push(this._numberField('scale', 'МАСШТАБ', Number(comp.props.scale || 1)));
      rows.push(`</div>`);
    }

    const groups = {};
    for (const p of def.properties) {
      if (['x', 'y', 'w', 'h'].includes(p.key)) continue;
      const groupName = this._groupFor(p.key);
      groups[groupName] = groups[groupName] || [];
      groups[groupName].push(p);
    }

    // Открытие по тапу: поля App ID/URL и «Какое приложение открыть» нужны
    // только для соответствующего варианта tap_action — остальное время они
    // только загромождают панель, поэтому показываем их условно, а не всегда.
    const tapGroupName = this._groupFor('tap_action');
    if (groups[tapGroupName]) {
      const tapAction = comp.props.tap_action || 'NONE';
      groups[tapGroupName] = groups[tapGroupName].filter((p) => {
        if (p.key === 'tap_app_id' || p.key === 'tap_app_url') return tapAction === 'APP';
        if (p.key === 'tap_metric') return tapAction === 'METRIC';
        return true;
      });
    }

    // Универсальный TEXT с выбором источника данных (data_source): добавляем
    // в группу "Источник данных" поля, специфичные для текущего выбранного
    // источника (DATA_SOURCES[val].fields) — они не входят в def.properties,
    // потому что зависят от значения, выбранного пользователем "на лету".
    let dsNote = null;
    if (def.dataSourceSelectable) {
      const dsVal = comp.props.data_source || 'NONE';
      const dsDef = DATA_SOURCES[dsVal];
      if (dsDef && dsDef.fields && dsDef.fields.length) {
        const groupName = this._groupFor('data_source');
        groups[groupName] = groups[groupName] || [];
        groups[groupName].push(...dsDef.fields);
      }
      if (dsDef && dsVal !== 'NONE') {
        dsNote = (dsDef.confidence === 'unverified' ? '⚠ ' : '') +
          (dsDef.note || '') +
          ' Значение поля «Текст» при этом игнорируется — оно подставляется автоматически из источника данных.';
      }
    }

    for (const [groupName, props] of Object.entries(groups)) {
      rows.push(`<div class="insp-section-title">${groupName}</div>`);
      rows.push(`<div class="insp-grid">`);
      for (const p of props) rows.push(this._fieldFor(comp, p));
      rows.push(`</div>`);
    }
    if (dsNote) rows.push(`<div class="insp-note">${dsNote}</div>`);

    rows.push(`<div class="insp-section-title">Поведение</div>`);
    rows.push(`<div class="insp-grid">`);
    rows.push(`
      <label class="field checkbox" data-tip="Снятая галочка прячет компонент и в редакторе, и при экспорте: он не попадёт в сгенерированный index.js.">
        <input type="checkbox" data-field="visible" ${comp.visible !== false ? 'checked' : ''}>
        Видимый
      </label>
      <label class="field checkbox" data-tip="Заблокированный компонент нельзя двигать и растягивать мышью на холсте — удобно, чтобы не сдвинуть готовый фон или стрелки. Свойства при этом редактируются как обычно.">
        <input type="checkbox" data-field="locked" ${comp.locked ? 'checked' : ''}>
        Заблокирован
      </label>
    `);
    if (def.dataBindable) {
      rows.push(`<div class="field"><label>Источник данных</label><input type="text" value="${def.dataSource}" disabled></div>`);
    } else if (def.dataSourceSelectable) {
      const eff = getEffectiveDataSource(comp, def);
      rows.push(`<div class="field"><label>Эффективный источник данных</label><input type="text" value="${eff || 'нет (статический текст)'}" disabled></div>`);
    }
    rows.push(`</div>`);

    if (def.id === 'time_pointer_second' && (comp.props.motion || 'TICK') === 'SMOOTH') {
      rows.push(`<div class="insp-note">⚠ Плавный ход: штатный TIME_POINTER двигает секундную стрелку скачками,
        поэтому при экспорте она будет создана отдельным виджетом IMG и повёрнута вручную из таймера
        '@zos/timer' (${Number(comp.props.smooth_fps ?? 20)} к/с). Свойство поворота IMG не подтверждено цитатой из
        docs.zepp.com — проверьте результат в симуляторе. Учтите также расход батареи: чем выше частота кадров,
        тем дороже анимация; в AOD-режиме плавный ход обычно недоступен.</div>`);
    }
    if (def.note) rows.push(`<div class="insp-note">${def.note}</div>`);

    this.root.innerHTML = rows.join('');
    this._bind(comp, def);
  }

  _tapParentId(selectedId) {
    if (typeof selectedId !== 'string') return null;
    const idx = selectedId.indexOf('::tap');
    return idx > 0 ? selectedId.slice(0, idx) : null;
  }

  _renderBackground() {
    const bg = this.store.state.background || { color: '#000000', imageAssetId: null, alpha: 100 };
    const assets = this.store.state.assets || [];
    const aod = this.store.state.mode === 'aod';
    this.root.innerHTML = `
      <div class="insp-header">
        <div class="insp-name-static">🎨 Фон</div>
        <div class="insp-id">Слой фона · ${aod ? 'AOD' : 'Normal'}</div>
      </div>
      <div class="insp-section-title">Внешний вид</div>
      <div class="insp-grid">
        <div class="field"><label>Цвет</label><input type="color" data-bg="color" value="${this._escAttr(bg.color || '#000000')}"></div>
        <div class="field"><label>Прозрачность</label><input type="number" data-bg="alpha" min="0" max="100" value="${Number(bg.alpha ?? 100)}"></div>
        <div class="field wide"><label>Изображение</label>
          <select data-bg="imageAssetId">
            <option value="">— нет (только цвет) —</option>
            ${assets.map((a) => `<option value="${this._escAttr(a.id)}" ${bg.imageAssetId === a.id ? 'selected' : ''}>${this._esc(a.name)}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="insp-note">Фон находится в списке слоёв и сохраняется отдельно для Normal и AOD.</div>
    `;
    const apply = (key, value) => {
      this.store.state.background = Object.assign({ color: '#000000', imageAssetId: null, alpha: 100 }, this.store.state.background || {}, { [key]: value });
      if (aod && key === 'color') {
        const settings = this.store.getAodSettings();
        settings.background = value;
      }
      this.store.commit();
    };
    this.root.querySelectorAll('[data-bg]').forEach((el) => {
      const key = el.dataset.bg;
      const read = () => key === 'alpha' ? Number(el.value) : el.value;
      el.addEventListener('change', () => apply(key, read()));
      if (el.type === 'number') el.addEventListener('input', () => {
        this._selfEdit = true;
        try {
          this.store.state.background = Object.assign({}, this.store.state.background || {}, { [key]: read() });
          if (aod && key === 'alpha') { /* live editor only */ }
          this.store._emit();
        } finally { this._selfEdit = false; }
      });
    });
  }

  _renderMulti(ids) {
    this.root.innerHTML = `
      <div class="insp-header"><div class="insp-id">${ids.length} компонентов выбрано</div></div>
      <div class="insp-section-title">Выравнивание</div>
      <div class="align-row">
        <button data-align="left">⯇ Слева</button>
        <button data-align="center-h">По центру X</button>
        <button data-align="right">Справа ⯈</button>
      </div>
      <div class="align-row">
        <button data-align="top">⯅ Сверху</button>
        <button data-align="center-v">По центру Y</button>
        <button data-align="bottom">Снизу ⯆</button>
      </div>
      <div class="insp-section-title">Распределение</div>
      <div class="align-row">
        <button data-align="dist-h">По горизонтали</button>
        <button data-align="dist-v">По вертикали</button>
      </div>
      <div class="insp-section-title">Слой</div>
      <div class="align-row">
        <button data-layer="top">На передний план</button>
        <button data-layer="bottom">На задний план</button>
      </div>
    `;
    this.root.querySelectorAll('[data-align]').forEach((btn) => {
      btn.onclick = () => this._align(ids, btn.dataset.align);
    });
    this.root.querySelectorAll('[data-layer]').forEach((btn) => {
      btn.onclick = () => { for (const id of ids) this.store.moveLayer(id, btn.dataset.layer); };
    });
  }

  _align(ids, mode) {
    const comps = ids.map((id) => this.store.state.components.find((c) => c.id === id)).filter(Boolean);
    if (!comps.length) return;
    if (mode === 'left') { const v = Math.min(...comps.map((c) => c.x)); comps.forEach((c) => c.x = v); }
    if (mode === 'right') { const v = Math.max(...comps.map((c) => c.x + c.w)); comps.forEach((c) => c.x = v - c.w); }
    if (mode === 'top') { const v = Math.min(...comps.map((c) => c.y)); comps.forEach((c) => c.y = v); }
    if (mode === 'bottom') { const v = Math.max(...comps.map((c) => c.y + c.h)); comps.forEach((c) => c.y = v - c.h); }
    if (mode === 'center-h') { const cx = this.store.state.device.w / 2; comps.forEach((c) => c.x = cx - c.w / 2); }
    if (mode === 'center-v') { const cy = this.store.state.device.h / 2; comps.forEach((c) => c.y = cy - c.h / 2); }
    if (mode === 'dist-h' && comps.length > 2) {
      comps.sort((a, b) => a.x - b.x);
      const first = comps[0], last = comps[comps.length - 1];
      const span = (last.x) - (first.x);
      const step = span / (comps.length - 1);
      comps.forEach((c, i) => { if (i > 0 && i < comps.length - 1) c.x = first.x + step * i; });
    }
    if (mode === 'dist-v' && comps.length > 2) {
      comps.sort((a, b) => a.y - b.y);
      const first = comps[0], last = comps[comps.length - 1];
      const span = (last.y) - (first.y);
      const step = span / (comps.length - 1);
      comps.forEach((c, i) => { if (i > 0 && i < comps.length - 1) c.y = first.y + step * i; });
    }
    this.store.commit();
  }

  _groupFor(key) {
    if (key.startsWith('tap_')) return 'Открытие по тапу';
    if (key === 'data_source' || /^(time_|ampm_|date_|weekday_|battery_|step_|heart_|calorie_|distance_|weather_|hour_|minute_|second_|day_|month_|year_)/.test(key)) return 'Источник данных';
    if (['color', 'text_size', 'align_h', 'align_v', 'text_style', 'font'].includes(key)) return 'Типографика';
    if (['text', 'format', 'prefix', 'suffix', 'unit'].includes(key)) return 'Содержимое';
    if (['src'].includes(key)) return 'Изображение';
    if (['center_x', 'center_y', 'radius', 'start_angle', 'end_angle', 'line_width'].includes(key)) return 'Форма';
    if (['alpha'].includes(key)) return 'Внешний вид';
    if (key.startsWith('pos_') || key.startsWith('center')) return 'Точка опоры';
    if (key === 'path' || key === 'cover_path') return 'Изображение стрелки';
    if (['motion', 'smooth_fps', 'smooth_step_deg'].includes(key)) return 'Ход стрелки';
    return 'Свойства';
  }

  _numberField(key, label, value) {
    const tip = hintForProperty({ key });
    return `<div class="field"${tip ? ` data-tip="${this._escAttr(tip)}"` : ''}><label>${label}</label><input type="number" data-field="${key}" value="${Math.round(value)}"></div>`;
  }

  _fieldFor(comp, p) {
    const val = comp.props[p.key];
    // Подсказка к свойству (см. PROPERTY_HINTS в registry.js). Вешаем её на
    // контейнер поля, чтобы всплывала и при наведении на подпись, и при
    // переходе в поле с клавиатуры.
    const tip = hintForProperty(p);
    const T = tip ? ` data-tip="${this._escAttr(tip)}"` : '';
    switch (p.kind) {
      case 'number':
        return `<div class="field"${T}><label>${p.label}${p.confidence === 'unverified' ? ' ⚠' : ''}</label><input type="number" data-prop="${p.key}" value="${val ?? p.default ?? 0}" ${p.min !== undefined ? `min="${p.min}"` : ''} ${p.max !== undefined ? `max="${p.max}"` : ''}></div>`;
      case 'color':
        return `<div class="field"${T}><label>${p.label}</label><input type="color" data-prop="${p.key}" value="${val || p.default || '#ffffff'}"></div>`;
      case 'text':
        return `<div class="field wide"${T}><label>${p.label}</label><input type="text" data-prop="${p.key}" value="${this._esc(val ?? p.default ?? '')}"></div>`;
      case 'select': {
        // options: массив строк ИЛИ массив { value, label } — второй вариант
        // нужен, когда машинное значение (TICK/SMOOTH) не годится как подпись.
        const opts = p.options.map((o) => (typeof o === 'object' ? o : { value: o, label: o }));
        const cur = val ?? p.default;
        const wide = opts.some((o) => String(o.label).length > 18) ? ' wide' : '';
        return `<div class="field${wide}"${T}><label>${p.label}${p.confidence === 'unverified' ? ' ⚠' : ''}</label><select data-prop="${p.key}">${opts.map((o) => `<option value="${o.value}" ${cur === o.value ? 'selected' : ''}>${this._esc(o.label)}</option>`).join('')}</select></div>`;
      }
      case 'checkbox': {
        const checked = val !== undefined ? !!val : !!p.default;
        return `<label class="field checkbox"${T}><input type="checkbox" data-prop="${p.key}" ${checked ? 'checked' : ''}> ${p.label}${p.confidence === 'unverified' ? ' ⚠' : ''}</label>`;
      }
      case 'font':
        return this._fontField(comp, p, val, T);
      case 'asset':
        return this._assetField(p, val, T);
      case 'weathericon': {
        const curIcon = normalizeWeatherIconId(val) || p.default;
        return `<div class="field wide"${T}><label>${p.label} (34 состояния — см. подсказку)</label><div class="icon-picker" data-prop="${p.key}">${WEATHER_ICON_SET.map((w) => `<button type="button" class="icon-opt ${curIcon === w.id ? 'active' : ''}" data-icon="${w.id}" title="${this._escAttr(w.label)}">${w.glyph} ${this._esc(w.label)}</button>`).join('')}</div></div>`;
      }
      default:
        return '';
    }
  }

  _fontField(comp, p, val, tipAttr = '') {
    const fonts = this.store.state.fonts || [];
    const options = fonts.map((f) => `<option value="${this._escAttr(f.id)}" ${val === f.id ? 'selected' : ''}>${this._esc(f.name)}</option>`).join('');
    return `<div class="field wide font-field"${tipAttr}>
      <label>${p.label}</label>
      <select data-prop="${p.key}">
        <option value="" ${!val ? 'selected' : ''}>Системный шрифт</option>
        ${options}
      </select>
      <label class="btn-file font-upload">＋ Добавить файл шрифта
        <input type="file" accept=".ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2" hidden data-font-upload>
      </label>
    </div>`;
  }

  _assetField(p, val, tipAttr = '') {
    const assets = this.store.state.assets;
    return `<div class="field wide"${tipAttr}><label>${p.label}</label>
      <select data-prop="${p.key}">
        <option value="">— нет —</option>
        ${assets.map((a) => `<option value="${a.id}" ${val === a.id ? 'selected' : ''}>${a.name}</option>`).join('')}
      </select>
    </div>`;
  }

  _bind(comp, def) {
    this.root.querySelectorAll('[data-field]').forEach((el) => {
      const field = el.dataset.field;
      const readValue = () => (el.type === 'number' ? Number(el.value) : el.type === 'checkbox' ? el.checked : el.value);
      el.addEventListener('change', () => {
        if (this.store.state.mode === 'aod' && (field === 'rotation' || field === 'scale')) this.store.updateComponentProp(comp.id, field, readValue());
        else this.store.updateComponent(comp.id, { [field]: readValue() });
      });
      if (el.type === 'number' || el.type === 'text') {
        el.addEventListener('input', () => {
          this._selfEdit = true;
          try {
            if (this.store.state.mode === 'aod' && (field === 'rotation' || field === 'scale')) this.store.updateComponentProp(comp.id, field, readValue(), { silent: true });
            else this.store.updateComponent(comp.id, { [field]: readValue() }, { silent: true });
          }
          finally { this._selfEdit = false; }
        });
      }
    });
    this.root.querySelectorAll('[data-prop]').forEach((el) => {
      if (el.classList.contains('icon-picker')) return;
      const key = el.dataset.prop;
      const readValue = () => {
        if (el.type === 'checkbox') return el.checked;
        if (el.type === 'number') return Number(el.value);
        return el.value;
      };
      const commit = () => this.store.updateComponentProp(comp.id, key, readValue());
      el.addEventListener('change', commit);
      if (el.type === 'text' || el.type === 'number') el.addEventListener('input', () => {
        // Холст и слои обновляются вживую, а сам Inspector пропускает эту
        // перерисовку (_selfEdit), иначе поле теряет фокус на каждом символе.
        this._selfEdit = true;
        try { this.store.updateComponentProp(comp.id, key, readValue(), { silent: true }); }
        finally { this._selfEdit = false; }
      });
    });
    this.root.querySelectorAll('.icon-picker').forEach((wrap) => {
      const key = wrap.dataset.prop;
      wrap.querySelectorAll('.icon-opt').forEach((btn) => {
        btn.onclick = () => this.store.updateComponentProp(comp.id, key, btn.dataset.icon);
      });
    });
    this.root.querySelectorAll('[data-font-upload]').forEach((input) => {
      input.addEventListener('change', () => {
        const file = input.files && input.files[0];
        if (!file) return;
        const ext = (file.name.match(/\.[^.]+$/) || [''])[0].toLowerCase();
        if (!['.ttf','.otf','.woff','.woff2'].includes(ext)) {
          alert('Поддерживаются TTF, OTF, WOFF и WOFF2.');
          input.value = '';
          return;
        }
        const reader = new FileReader();
        reader.onload = async () => {
          const id = makeFontId();
          const family = `ProjectFont_${id.replace(/[^a-zA-Z0-9_]/g, '_')}`;
          const font = { id, name: file.name.replace(/\.[^.]+$/, ''), filename: file.name, ext, dataUrl: reader.result, size: file.size, cssFamily: family };
          this.store.addFont(font);
          if (typeof registerProjectFont === 'function') await registerProjectFont(font);
          this.store.updateComponentProp(comp.id, 'font', id);
        };
        reader.readAsDataURL(file);
      });
    });
  }

  _esc(s) { return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }

  // Для data-tip: подсказки содержат кавычки и угловые скобки (<= 20 px и т.п.).
  _escAttr(s) { return this._esc(s == null ? '' : s).replace(/\n/g, ' '); }
}
