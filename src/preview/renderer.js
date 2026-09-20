// Shared preview renderer: the same raster engine is used by the editor and
// exported preview image. Coordinates are always device pixels.
(function () {
  const fontCache = new Map();
  const imageCache = new Map();

  function loadImage(dataUrl) {
    if (!dataUrl) return Promise.resolve(null);
    if (imageCache.has(dataUrl)) return imageCache.get(dataUrl);
    const p = new Promise(resolve => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    });
    imageCache.set(dataUrl, p);
    return p;
  }

  async function registerProjectFont(font) {
    if (!font || !font.dataUrl || !font.cssFamily || !window.FontFace) return;
    if (fontCache.has(font.id)) return fontCache.get(font.id);
    const p = (async () => {
      try {
        const ff = new FontFace(font.cssFamily, `url(${font.dataUrl})`);
        await ff.load();
        document.fonts.add(ff);
      } catch (e) { console.warn('Font preview load failed:', font.name, e); }
    })();
    fontCache.set(font.id, p);
    return p;
  }
  window.registerProjectFont = registerProjectFont;

  const WEEKDAYS_SHORT = {
    EN: ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'],
    RU: ['ВС', 'ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ']
  };
  const WEEKDAYS_RU_3 = ['ВОС', 'ПОН', 'ВТР', 'СРД', 'ЧТВ', 'ПТН', 'СБТ'];
  const WEEKDAYS_FULL = {
    EN: ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'],
    RU: ['ВОСКРЕСЕНЬЕ', 'ПОНЕДЕЛЬНИК', 'ВТОРНИК', 'СРЕДА', 'ЧЕТВЕРГ', 'ПЯТНИЦА', 'СУББОТА']
  };
  const MONTHS_SHORT = {
    EN: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    RU: ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']
  };
  const MONTHS_FULL = {
    EN: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    RU: ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']
  };
  const previewLocale = v => v === 'RU' ? 'RU' : 'EN';

  function textFor(comp, def, fixedTime) {
    const p = comp.props || {};
    if (comp.props && comp.props.text) return comp.props.text;
    if (fixedTime) {
      const source = def.dataSource;
      if (source === 'TIME') return def.id === 'time_hms' ? '10:09:36' : '10:09';
      if (source === 'AMPM') return 'AM';
      if (source === 'HOUR') return '10';
      if (source === 'MINUTE') return '09';
      if (source === 'SECOND') return '36';
      if (source === 'DATE') {
        const loc = previewLocale(p.date_locale);
        const m = 8;
        const short = MONTHS_SHORT[loc][m];
        const full = MONTHS_FULL[loc][m];
        if (p.format === 'DD MMM') return `18 ${short}`;
        if (p.format === 'MMM DD') return `${short} 18`;
        if (p.format === 'DD MMMM') return `18 ${full}`;
        return '18.09.2026';
      }
      if (source === 'WEEKDAY') {
        const loc = previewLocale(p.weekday_locale);
        if (loc === 'RU' && p.format === 'EEE3') return WEEKDAYS_RU_3[5];
        return (p.format === 'EEEE' ? WEEKDAYS_FULL : WEEKDAYS_SHORT)[loc][5];
      }
      if (source === 'DAY') return '18';
      if (source === 'MONTH') {
        const loc = previewLocale(p.month_locale);
        if (p.month_format === 'MMM') return MONTHS_SHORT[loc][8];
        if (p.month_format === 'MMMM') return MONTHS_FULL[loc][8];
        return '09';
      }
      if (source === 'YEAR') return '2026';
      if (source === 'CALORIE') {
        const prefix = p.prefix || '';
        const suffix = p.suffix || ' kcal';
        const temp = '350';
        return prefix + temp + suffix;
      }
      if (source === 'WEATHER_TEMP') {
        const temp = '22';
        const unit = p.unit || p.weather_unit || '°C';
        const degreeSymbol = (p.weather_show_degree !== false) ? '°' : '';
        return temp + degreeSymbol + unit.replace('°', '');
      }
    }
    if (typeof componentPreviewText === 'function') return componentPreviewText(comp, def);
    return String(comp.props?.text ?? def.name ?? '');
  }

  async function draw(project, canvas, opts = {}) {
    const dw = project.device?.w || 480, dh = project.device?.h || 480;
    const size = opts.size || canvas.width || 324;
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    const scale = size / Math.max(dw, dh);
    const X = n => Number(n || 0) * scale;
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = project.background?.color || '#000';
    ctx.fillRect(0, 0, size, size);

    const assets = new Map((project.assets || []).map(a => [a.id, a]));
    const imgs = new Map();
    await Promise.all((project.assets || []).map(async a => imgs.set(a.id, await loadImage(a.dataUrl))));
    for (const f of project.fonts || []) await registerProjectFont(f);

    const bg = assets.get(project.background?.imageAssetId);
    if (bg) { const im = imgs.get(bg.id); if (im) ctx.drawImage(im, 0, 0, size, size); }

    const comps = (project.components || []).filter(c => c.visible !== false);
    for (const comp of comps) {
      const def = REGISTRY[comp.defId]; if (!def) continue;
      if (opts.testMode && def.widgetId === 'TIME_POINTER') continue;
      const p = comp.props || {};
      ctx.save(); ctx.globalAlpha = Math.max(0, Math.min(100, Number(p.alpha ?? 100))) / 100;
      if (def.widgetId === 'FILL_RECT') {
        ctx.fillStyle = p.color || '#fff'; ctx.fillRect(X(comp.x), X(comp.y), X(comp.w), X(comp.h));
      } else if (def.widgetId === 'STROKE_RECT') {
        ctx.strokeStyle = p.color || '#fff'; ctx.lineWidth = X(p.line_width || 2); ctx.strokeRect(X(comp.x), X(comp.y), X(comp.w), X(comp.h));
      } else if (def.widgetId === 'CIRCLE' || def.widgetId === 'STROKE_CIRCLE') {
        const cx = X(p.center_x ?? (comp.x + comp.w/2)), cy = X(p.center_y ?? (comp.y + comp.h/2)), r = X(p.radius ?? comp.w/2);
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
        if (def.widgetId === 'CIRCLE') { ctx.fillStyle = p.color || '#fff'; ctx.fill(); }
        else { ctx.strokeStyle = p.color || '#fff'; ctx.lineWidth = X(p.line_width || 2); ctx.stroke(); }
      } else if (def.widgetId === 'ARC') {
        const cx = X(comp.x + comp.w/2), cy = X(comp.y + comp.h/2), r = X(Math.min(comp.w, comp.h)/2 - (p.line_width || 4)/2);
        ctx.beginPath(); ctx.arc(cx, cy, r, (Number(p.start_angle || 0)-90)*Math.PI/180, (Number(p.end_angle ?? 270)-90)*Math.PI/180);
        ctx.strokeStyle = p.color || '#fff'; ctx.lineWidth = X(p.line_width || 4); ctx.stroke();
      } else if (def.widgetId === 'TEXT') {
        const text = textFor(comp, def, true);
        const pf = (project.fonts || []).find(f => f.id === p.font);
        const family = pf ? `'${pf.cssFamily || pf.name}'` : 'sans-serif';
        ctx.font = `${p.font_style || 'normal'} ${p.font_weight || '400'} ${X(p.text_size || 36)}px ${family}`;
        ctx.fillStyle = p.color || '#fff';
        ctx.textAlign = p.align_h === 'LEFT' ? 'left' : p.align_h === 'RIGHT' ? 'right' : 'center';
        ctx.textBaseline = p.align_v === 'TOP' ? 'top' : p.align_v === 'BOTTOM' ? 'bottom' : 'middle';
        const tx = X(comp.x + (ctx.textAlign === 'left' ? 0 : ctx.textAlign === 'right' ? comp.w : comp.w/2));
        const ty = X(comp.y + (ctx.textBaseline === 'top' ? 0 : ctx.textBaseline === 'bottom' ? comp.h : comp.h/2));
        ctx.fillText(text, tx, ty);
      } else if (def.widgetId === 'IMG') {
        let assetId = p.src;
        // Special handling for weather icons: look for asset with matching weather condition
        if (def.id === 'weather_icon') {
          const weatherId = p.src; // e.g., 'sunny', 'cloudy', etc.
          const matchingAsset = assets.get(weatherId);
          if (matchingAsset) {
            assetId = matchingAsset.id;
          } else {
            // Try to find any asset that looks like a weather icon (fallback to first available weather asset)
            for (const [id, asset] of assets.entries()) {
              if (asset.name && asset.name.includes('weather')) {
                assetId = id;
                break;
              }
            }
          }
        }
        const im = imgs.get(assetId); if (im) ctx.drawImage(im, X(comp.x), X(comp.y), X(comp.w), X(comp.h));
      } else if (def.widgetId === 'TIME_POINTER') {
        const im = imgs.get(p.path);
        if (im) {
          // В обычном редакторе PNG всегда показывается строго вертикально
          // вверх — это исходная раскладка элемента. Координаты оси задаёт
          // center_x/center_y, а точку вращения внутри PNG — pos_x/pos_y.
          // В экспортируемом превью включаем отдельную имитацию времени 10:10.
          const cx = Number(p.center_x ?? dw / 2);
          const cy = Number(p.center_y ?? dh / 2);
          const iw = im.naturalWidth || im.width;
          const ih = im.naturalHeight || im.height;
          const px = Number(p.pos_x ?? iw / 2);
          const py = Number(p.pos_y ?? ih / 2);

          if (opts.previewMode) {
            // 10:10:00: hour = 305°, minute = 60°, second = 0°.
            // Clock angles are clockwise from 12 o'clock. Canvas rotation
            // is measured from +X, hence angle - 90°.
            let clockAngle = 0;
            if (comp.defId === 'time_pointer_hour') clockAngle = 305;
            else if (comp.defId === 'time_pointer_minute') clockAngle = 60;
            else if (comp.defId === 'time_pointer_second') {
              // For smooth second hand, show actual time; otherwise fixed 0°
              if (p.motion === 'SMOOTH') {
                const now = new Date();
                clockAngle = (now.getSeconds() + now.getMilliseconds() / 1000) * 6;
              } else {
                clockAngle = 0;
              }
            }

            ctx.translate(X(cx), X(cy));
            ctx.rotate((clockAngle - 90) * Math.PI / 180);
            ctx.drawImage(im, -X(px), -X(py), X(iw), X(ih));
          } else {
            // Main editor: never rotate the source PNG.
            ctx.drawImage(im, X(cx - px), X(cy - py), X(iw), X(ih));
          }
        }
      }
      ctx.restore();
    }
    if (project.device?.shape === 'round') {
      const out = document.createElement('canvas'); out.width = out.height = size;
      const o = out.getContext('2d'); o.save(); o.beginPath(); o.arc(size/2,size/2,size/2,0,Math.PI*2); o.clip(); o.drawImage(canvas,0,0); o.restore();
      ctx.clearRect(0,0,size,size); ctx.drawImage(out,0,0);
    }
    return canvas;
  }

  window.WatchfacePreviewRenderer = { draw, registerProjectFont };
})();
