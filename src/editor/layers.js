// src/editor/layers.js
class LayersPanel {
  constructor(root, store) {
    this.root = root;
    this.store = store;
  }

  render() {
    const comps = [...this.store.state.components].reverse(); // top layer first
    const bg = this.store.state.background || {};
    const rows = [];

    rows.push(`
      <div class="layer-row layer-background ${this.store.selection.has('__background__') ? 'active' : ''}" data-id="__background__">
        <span class="layer-drag">▰</span>
        <span class="layer-name">🎨 Фон</span>
        <span class="layer-id">BACKGROUND</span>
        <button class="layer-btn" data-act="visible" title="Показать/скрыть фон">${Number(bg.alpha ?? 100) > 0 ? '👁' : '🚫'}</button>
        <button class="layer-btn" data-act="lock" title="Фон всегда закреплён">🔒</button>
      </div>
    `);

    for (const c of comps) {
      const tapEnabled = !!(c.props && c.props.tap_action && c.props.tap_action !== 'NONE');
      const tapId = `${c.id}::tap`;
      rows.push(`
        <div class="layer-row layer-parent ${this.store.selection.has(c.id) ? 'active' : ''}" data-id="${c.id}">
          <span class="layer-drag">☰</span>
          <span class="layer-name">${c.name}</span>
          <span class="layer-id">${c.id}</span>
          <button class="layer-btn" data-act="visible" title="Показать/скрыть">${c.visible === false ? '🚫' : '👁'}</button>
          <button class="layer-btn" data-act="lock" title="Заблокировать">${c.locked ? '🔒' : '🔓'}</button>
          <button class="layer-btn" data-act="dup" title="Дублировать">⎘</button>
          <button class="layer-btn" data-act="del" title="Удалить">🗑</button>
        </div>
      `);
      if (tapEnabled) {
        rows.push(`
          <div class="layer-row layer-child ${this.store.selection.has(tapId) ? 'active' : ''}" data-id="${tapId}" data-parent-id="${c.id}">
            <span class="layer-drag">◧</span>
            <span class="layer-name">Tap zone</span>
            <span class="layer-id">${c.id}::tap</span>
          </div>
        `);
      }
    }

    this.root.innerHTML = rows.join('');

    this.root.querySelectorAll('.layer-row').forEach((row) => {
      const id = row.dataset.id;
      const isTapChild = String(id).includes('::tap');
      row.addEventListener('click', (e) => {
        if (e.target.closest('.layer-btn')) return;
        if (isTapChild) {
          this.store.setSelection([id]);
          return;
        }
        if (e.shiftKey) {
          const sel = new Set(this.store.selection);
          sel.has(id) ? sel.delete(id) : sel.add(id);
          this.store.setSelection([...sel]);
        } else {
          this.store.setSelection([id]);
        }
      });
      if (id === '__background__') {
        row.querySelector('[data-act="visible"]').onclick = () => {
          const current = Number(this.store.state.background?.alpha ?? 100);
          this.store.state.background.alpha = current > 0 ? 0 : 100;
          this.store.commit();
        };
        row.querySelector('[data-act="lock"]').onclick = (e) => e.stopPropagation();
        return;
      }
      if (isTapChild) return;
      row.querySelector('[data-act="visible"]').onclick = () => {
        const c = this.store.state.components.find((x) => x.id === id);
        this.store.updateComponent(id, { visible: c.visible === false ? true : false });
      };
      row.querySelector('[data-act="lock"]').onclick = () => {
        const c = this.store.state.components.find((x) => x.id === id);
        this.store.updateComponent(id, { locked: !c.locked });
      };
      row.querySelector('[data-act="dup"]').onclick = () => this.store.duplicateComponents([id]);
      row.querySelector('[data-act="del"]').onclick = () => confirmRemoveComponents(this.store, [id]);
    });

    // simple drag-to-reorder
    let draggedId = null;
    this.root.querySelectorAll('.layer-row').forEach((row) => {
      if (row.dataset.id === '__background__') return;
      row.draggable = true;
      row.addEventListener('dragstart', () => { draggedId = row.dataset.id; });
      row.addEventListener('dragover', (e) => e.preventDefault());
      row.addEventListener('drop', (e) => {
        e.preventDefault();
        const targetId = row.dataset.id;
        if (!draggedId || draggedId === targetId) return;
        const arr = this.store.state.components;
        const from = arr.findIndex((c) => c.id === draggedId);
        const to = arr.findIndex((c) => c.id === targetId);
        const [item] = arr.splice(from, 1);
        arr.splice(to, 0, item);
        this.store.commit();
      });
    });
  }
}
