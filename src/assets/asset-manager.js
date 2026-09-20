// src/assets/asset-manager.js

class AssetManager {
  constructor(root, store) {
    this.root = root;
    this.store = store;
    this.root.innerHTML = `
      <div class="asset-toolbar">
        <label class="btn-file" style="flex: 1;">Загрузить PNG
          <input type="file" accept="image/png,image/jpeg" multiple hidden>
        </label>
      </div>
      <div class="asset-list"></div>
    `;
    this.root.querySelector('input[type=file]').addEventListener('change', (e) => this._onUpload(e.target.files));
    this.list = this.root.querySelector('.asset-list');
    
    // Collapsible toggle
    const title = document.querySelector('[data-section="resources"]');
    if (title) {
      title.addEventListener('click', (e) => {
        if (e.target.classList.contains('toggle-btn')) {
          this.toggleResources();
        }
      });
    }
    
    // Load saved state
    const collapsed = localStorage.getItem('resources-collapsed');
    if (collapsed === 'true') {
      this.collapseResources();
    }
  }
  
  toggleResources() {
    const content = document.querySelector('[data-section="resources"].collapsible-content');
    const btn = document.querySelector('[data-section="resources"] .toggle-btn');
    if (content.classList.contains('collapsed')) {
      content.classList.remove('collapsed');
      btn.textContent = '▼';
      localStorage.setItem('resources-collapsed', 'false');
    } else {
      content.classList.add('collapsed');
      btn.textContent = '▶';
      localStorage.setItem('resources-collapsed', 'true');
    }
  }
  
  collapseResources() {
    const content = document.querySelector('[data-section="resources"].collapsible-content');
    const btn = document.querySelector('[data-section="resources"] .toggle-btn');
    if (content) {
      content.classList.add('collapsed');
      btn.textContent = '▶';
    }
  }

  _onUpload(files) {
    for (const file of files) {
      if (!/image\/(png|jpeg)/.test(file.type)) {
        alert(`Неподдерживаемый формат: ${file.name}. Ресурсы циферблата Zepp OS должны быть PNG.`);
        continue;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          this.store.addAsset({
            id: makeAssetId(),
            name: file.name.replace(/\.(png|jpe?g)$/i, ''),
            dataUrl: reader.result,
            width: img.width,
            height: img.height,
            format: file.type.includes('png') ? 'PNG' : 'JPEG',
            size: file.size,
          });
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    }
  }

  render() {
    const assets = this.store.state.assets;
    if (assets.length === 0) { this.list.innerHTML = `<div class="empty-hint">Пока нет ресурсов. Загрузите PNG, чтобы использовать как изображение или фон.</div>`; return; }
    this.list.innerHTML = assets.map((a) => `
      <div class="asset-card" data-id="${a.id}">
        <img src="${a.dataUrl}" alt="${a.name}">
        <div class="asset-meta">
          <input class="asset-name" value="${a.name}" data-id="${a.id}">
          <div class="asset-sub">${a.width}×${a.height} · ${a.format} · ${(a.size / 1024).toFixed(1)} KB</div>
        </div>
        <button class="asset-del" data-id="${a.id}" title="Удалить">✕</button>
      </div>
    `).join('');
    this.list.querySelectorAll('.asset-del').forEach((btn) => {
      btn.onclick = () => this.store.removeAsset(btn.dataset.id);
    });
    this.list.querySelectorAll('.asset-name').forEach((input) => {
      input.onchange = () => this.store.renameAsset(input.dataset.id, input.value);
    });
  }
}
