// src/ui/tooltips.js
//
// Всплывающие подсказки для кнопок главного меню (топбара).
// В отличие от нативного title, показывают развёрнутое описание
// компонента системы разработки и могут быть полностью скрыты
// пользователем через переключатель в меню (состояние сохраняется
// в localStorage между сеансами).

(function () {
  const STORAGE_KEY = 'wfd_tooltips_enabled';

  class TooltipManager {
    constructor() {
      this.enabled = this._loadState();
      this.showTimer = null;
      this.bubble = document.createElement('div');
      this.bubble.className = 'tooltip-bubble';
      this.bubble.setAttribute('role', 'tooltip');
      document.body.appendChild(this.bubble);

      this.refresh();
      window.addEventListener('scroll', () => this.hide(), true);
      window.addEventListener('resize', () => this.hide());
      window.addEventListener('keydown', (e) => { if (e.key === 'Escape') this.hide(); });
    }

    _loadState() {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw === null ? true : raw === '1';
    }

    _saveState() {
      localStorage.setItem(STORAGE_KEY, this.enabled ? '1' : '0');
    }

    // Привязывает обработчики ко всем ещё не охваченным элементам
    // с data-tip. Можно вызывать повторно, если в меню появились
    // новые элементы.
    refresh() {
      document.querySelectorAll('[data-tip]').forEach((target) => {
        if (target._tipBound) return;
        target._tipBound = true;
        target.addEventListener('mouseenter', () => this._scheduleShow(target));
        target.addEventListener('mouseleave', () => this._cancelShow());
        // focus/blur не всплывают, поэтому для полей Inspector, где data-tip
        // висит на контейнере <div class="field">, слушаем focusin/focusout —
        // тогда подсказка появляется и при переходе по Tab с клавиатуры.
        target.addEventListener('focusin', () => this._scheduleShow(target, 0));
        target.addEventListener('focusout', () => this._cancelShow());
        target.addEventListener('click', () => this.hide());
      });
    }

    _scheduleShow(target, delay = 350) {
      if (!this.enabled) return;
      clearTimeout(this.showTimer);
      this.showTimer = setTimeout(() => this._show(target), delay);
    }

    _cancelShow() {
      clearTimeout(this.showTimer);
      this.hide();
    }

    _show(target) {
      if (!this.enabled) return;
      const text = target.getAttribute('data-tip');
      if (!text) return;

      this.bubble.textContent = text;
      this.bubble.classList.add('visible');

      const r = target.getBoundingClientRect();
      const bw = this.bubble.offsetWidth;
      const bh = this.bubble.offsetHeight;

      let top = r.bottom + 8;
      let left = r.left + r.width / 2 - bw / 2;
      left = Math.max(6, Math.min(left, window.innerWidth - bw - 6));

      if (top + bh > window.innerHeight - 6) {
        top = r.top - bh - 8;
        this.bubble.classList.add('above');
      } else {
        this.bubble.classList.remove('above');
      }
      this.bubble.style.top = `${top}px`;
      this.bubble.style.left = `${left}px`;
    }

    hide() {
      clearTimeout(this.showTimer);
      this.bubble.classList.remove('visible');
    }

    setEnabled(value) {
      this.enabled = value;
      this._saveState();
      if (!value) this.hide();
    }

    toggle() {
      this.setEnabled(!this.enabled);
      return this.enabled;
    }
  }

  const tooltipManager = new TooltipManager();
  window.tooltipManager = tooltipManager;

  // Переключатель в главном меню — прячет/показывает все подсказки.
  const toggleBtn = document.getElementById('act-tips-toggle');
  if (toggleBtn) {
    const syncBtn = () => {
      toggleBtn.classList.toggle('active', tooltipManager.enabled);
      toggleBtn.setAttribute('aria-pressed', String(tooltipManager.enabled));
    };
    syncBtn();
    toggleBtn.addEventListener('click', () => {
      tooltipManager.toggle();
      syncBtn();
    });
  }
})();
