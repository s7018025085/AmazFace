// src/ui/project-settings.js
//
// Панель «Устройство и сборка»: выбор профиля устройства (размер/форма экрана)
// и метаданных, которые попадают в app.json экспортируемого проекта —
// targetKey, deviceSource, appId, версия, вендор.
//
// Раньше всё это было зашито константами (единственный профиль Balance 2 и
// appId: 10001), из-за чего экспортированный проект нельзя было собрать под
// другую модель или опубликовать без ручной правки app.json.

class ProjectSettings {
  constructor(root, store) {
    this.root = root;
    this.store = store;
  }

  render() {
    const st = this.store.state;
    const d = st.device || {};
    const app = st.app || {};
    const isPlaceholderId = Number(app.appId) === 10001;
    const needsTarget = !d.targetKey || !(d.deviceSources || []).length;

    this.root.innerHTML = `
      <label class="field wide">
        <span>Устройство</span>
        <select data-dev="profile">
          ${Object.values(DEVICES).map((p) => `<option value="${p.id}" ${d.id === p.id ? 'selected' : ''}>${p.name}</option>`).join('')}
        </select>
      </label>
      <div class="ps-row">
        <label class="field"><span>Ширина</span><input type="number" data-dev="w" value="${d.w}" min="64" max="1024"></label>
        <label class="field"><span>Высота</span><input type="number" data-dev="h" value="${d.h}" min="64" max="1024"></label>
        <label class="field"><span>Форма</span>
          <select data-dev="shape">
            <option value="round" ${d.shape === 'round' ? 'selected' : ''}>круглый</option>
            <option value="square" ${d.shape !== 'round' ? 'selected' : ''}>прямоугольный</option>
          </select>
        </label>
      </div>
      <label class="field wide" data-tip="Ключ цели из app.json вашего проекта Zeus CLI, раздел targets — например 480x480-amazfit-balance-2.">
        <span>targetKey (app.json → targets)</span>
        <input type="text" data-dev="targetKey" value="${this._esc(d.targetKey || '')}" placeholder="480x480-amazfit-balance-2">
      </label>
      <label class="field wide" data-tip="Числовые deviceSource вашей модели из app.json, через запятую. Designer не угадывает их за вас.">
        <span>deviceSource (через запятую)</span>
        <input type="text" data-dev="deviceSources" value="${(d.deviceSources || []).join(', ')}" placeholder="9568512, 9568513">
      </label>
      <div class="ps-row">
        <label class="field" data-tip="Идентификатор приложения из Zepp Developer Console. 10001 — заглушка, замените перед публикацией.">
          <span>App ID</span><input type="number" data-app="appId" value="${Number(app.appId) || 10001}">
        </label>
        <label class="field"><span>Версия</span><input type="text" data-app="versionName" value="${this._esc(app.versionName || '1.0.0')}"></label>
        <label class="field"><span>Вендор</span><input type="text" data-app="vendor" value="${this._esc(app.vendor || 'designer')}"></label>
      </div>
      ${needsTarget ? `<div class="ps-note warn">Для выбранного профиля нужно вписать targetKey и deviceSource вручную — возьмите их из app.json, который создаёт <code>zeus create</code> для вашей модели. Без них экспорт проекта заблокирован.</div>` : ''}
      ${isPlaceholderId ? `<div class="ps-note">App ID 10001 — заглушка; перед публикацией замените на выданный в Zepp Developer Console.</div>` : ''}
    `;
    this._bind();
  }

  _bind() {
    this.root.querySelectorAll('[data-dev]').forEach((el) => {
      const key = el.dataset.dev;
      el.addEventListener('change', () => {
        if (key === 'profile') { this.store.setDevice(el.value); return; }
        if (key === 'deviceSources') {
          const list = el.value.split(',').map((x) => Number(String(x).trim())).filter((n) => !isNaN(n) && n > 0);
          this.store.updateDevice({ deviceSources: list });
          return;
        }
        if (key === 'w' || key === 'h') {
          const v = Math.max(64, Math.min(1024, Number(el.value) || 0));
          this.store.updateDevice({ [key]: v, designWidth: key === 'w' ? v : this.store.state.device.designWidth });
          return;
        }
        this.store.updateDevice({ [key]: el.value });
      });
    });
    this.root.querySelectorAll('[data-app]').forEach((el) => {
      const key = el.dataset.app;
      el.addEventListener('change', () => {
        const value = (key === 'appId') ? (Number(el.value) || 10001) : el.value;
        this.store.updateApp({ [key]: value });
      });
    });
  }

  _esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }
}
