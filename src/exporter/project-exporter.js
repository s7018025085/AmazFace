// src/exporter/project-exporter.js
//
// Собирает из состояния проекта полноценный проект Zepp OS (структуру,
// которую ожидает Zeus CLI / студия разработки), а не один файл index.js:
//
//   app.json
//   app.js
//   package.json
//   README.md
//   assets/<device>/...          (загруженные пользователем PNG/JPEG)
//   icon.png / Preview.png / preview_en.png (phone-side metadata resources)
//   assets/<device>/icon.png     (device-side icon resource)
//   assets/<device>/weather/*.png (29 PNG-иконок погоды)
//   watchface/index.js           (тот же код, что и в обычном экспорте)

function dataUrlToBytes(dataUrl) {
  const comma = dataUrl.indexOf(',');
  const meta = dataUrl.slice(5, comma);
  const data = dataUrl.slice(comma + 1);
  if (/;base64/.test(meta)) {
    const binary = atob(data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }
  return new TextEncoder().encode(decodeURIComponent(data));
}

function canvasToPngBytes(canvas) {
  return dataUrlToBytes(canvas.toDataURL('image/png'));
}

function drawPlaceholderIcon(size, bgColor, glyph) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = bgColor || '#20242c';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#ffffff';
  ctx.font = `${Math.round(size * 0.55)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(glyph, size / 2, size / 2 + Math.round(size * 0.04));
  return canvas;
}

function weatherGlyphFor(cond) {
  const id = normalizeWeatherIconId(cond);
  const entry = WEATHER_ICON_SET.find((w) => w.id === id);
  return (entry && entry.glyph) || '☀';
}

// Реальные PNG-ассеты погодных состояний: рисуем простые векторные пиктограммы
// на прозрачном canvas, чтобы экспорт содержал физические файлы, а не emoji/заглушки.
function drawWeatherIcon(index, size = 64) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const x = c.getContext('2d'); const s = size / 64;
  x.clearRect(0, 0, size, size); x.strokeStyle = '#ffffff'; x.fillStyle = '#ffffff';
  x.lineWidth = Math.max(2, 3*s); x.lineCap = 'round'; x.lineJoin = 'round';
  const sun = (cx, cy, r) => { x.beginPath(); x.arc(cx*s, cy*s, r*s, 0, Math.PI*2); x.stroke(); for(let a=0;a<8;a++){const t=a*Math.PI/4; x.beginPath(); x.moveTo((cx+Math.cos(t)*(r+6))*s,(cy+Math.sin(t)*(r+6))*s); x.lineTo((cx+Math.cos(t)*(r+11))*s,(cy+Math.sin(t)*(r+11))*s); x.stroke();} };
  const cloud = (cx=34, cy=38) => { x.beginPath(); x.arc((cx-10)*s,cy*s,9*s,Math.PI,0); x.arc(cx*s,(cy-5)*s,12*s,Math.PI,0); x.arc((cx+11)*s,cy*s,8*s,Math.PI,0); x.lineTo((cx+19)*s,(cy+9)*s); x.lineTo((cx-19)*s,(cy+9)*s); x.closePath(); x.fill(); };
  const rain = (n=3) => { for(let i=0;i<n;i++){const xx=(25+i*8); x.beginPath(); x.moveTo(xx*s,50*s); x.lineTo((xx-3)*s,59*s); x.stroke();} };
  const snow = (n=3) => { for(let i=0;i<n;i++){const xx=(25+i*8), yy=50; x.beginPath(); x.arc(xx*s,yy*s,2.2*s,0,Math.PI*2); x.fill();} };
  const moon = (cx=32, cy=30, r=12) => { x.save(); x.beginPath(); x.arc(cx*s,cy*s,r*s,0,Math.PI*2); x.arc((cx+r*0.55)*s,(cy-r*0.45)*s,r*s,0,Math.PI*2,true); x.fill(); x.restore(); };
  if (index === 3) sun(32,32,10);
  else if (index === 28) moon(32,32,12);
  else if (index === 26) { moon(22,26,9); cloud(37,40); }
  else if (index === 27) { moon(22,24,8); cloud(37,38); rain(3); }
  else if ([0,4].includes(index)) cloud();
  else if ([1,5,7,10,18,21,24].includes(index)) { cloud(); rain(index===10||index===18||index===21||index===24?4:3); }
  else if ([2,6,8,9,16].includes(index)) { cloud(37,39); snow(3); }
  else if ([11,22,23,17,30,31].includes(index)) { x.beginPath(); x.arc(32*s,32*s,18*s,0,Math.PI*2); x.stroke(); x.beginPath(); x.moveTo(16*s,42*s); x.quadraticCurveTo(32*s,24*s,48*s,42*s); x.stroke(); }
  else if ([13,14,25].includes(index)) { for(let i=0;i<4;i++){x.beginPath();x.moveTo(10*s,(22+i*8)*s);x.lineTo(54*s,(22+i*8)*s);x.stroke();} }
  else if ([15,20].includes(index)) { cloud(); x.beginPath();x.moveTo(34*s,44*s);x.lineTo(28*s,54*s);x.lineTo(34*s,51*s);x.lineTo(31*s,60*s);x.stroke(); }
  else if (index === 19) { cloud(); x.beginPath();x.arc(45*s,52*s,4*s,0,Math.PI*2);x.stroke(); }
  else if (index === 12) { cloud(); rain(2); snow(2); }
  else { sun(32,32,10); }
  return c;
}

// Коды разрешений взяты из docs.zepp.com (раздел sensor, блок "permission code"
// у каждого датчика). У датчика Weather такого блока нет — отдельного разрешения
// он не требует, поэтому для погоды ничего не добавляется. Учитывается и
// источник данных универсального TEXT (props.data_source), а не только пресеты.
const PERMISSION_BY_SOURCE = {
  HEART: 'data:user.hd.heart_rate',
  STEP: 'data:user.hd.step',
  CALORIE: 'data:user.hd.calorie',
  DISTANCE: 'data:user.hd.distance',
};

function computePermissions(project) {
  const perms = new Set();
  for (const comp of project.components) {
    const def = REGISTRY[comp.defId];
    if (!def) continue;
    const source = (comp.props && comp.props.data_source) || def.dataSource;
    const perm = PERMISSION_BY_SOURCE[source];
    if (perm) perms.add(perm);
  }
  return [...perms];
}


function loadPreviewImage(dataUrl) {
  return new Promise((resolve) => {
    if (!dataUrl) return resolve(null);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

function previewTextForComponent(comp, def) {
  const source = comp.props?.data_source || def.dataSource || 'NONE';
  if (source === 'TIME' || source === 'TIME_POINTER_HOUR' || source === 'TIME_POINTER_MINUTE' || source === 'TIME_POINTER_SECOND') return '10:10';
  if (source === 'AMPM') return 'AM';
  if (source === 'DATE') return '17.09';
  if (source === 'WEEKDAY') return 'Thu';
  if (source === 'HOUR') return '10';
  if (source === 'MINUTE') return '10';
  if (source === 'SECOND') return '00';
  if (source === 'DAY') return '17';
  if (source === 'MONTH') return '09';
  if (source === 'YEAR') return '2026';
  if (source === 'BATTERY') return '85';
  if (source === 'HEART') return '72';
  if (source === 'STEP') return '8452';
  if (source === 'CALORIE') return '340';
  if (source === 'DISTANCE') return '4.2 km';
  if (source === 'WEATHER_TEMP') return '24°';
  return String(comp.props?.text ?? def.name ?? '');
}


async function buildPreviewDataUrl(project, size = 324) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  await WatchfacePreviewRenderer.draw(project, canvas, { size, previewMode: true });
  return canvas.toDataURL('image/png');
}

function buildAppJson(project) {
  const device = project.device;
  const app = project.app || {};
  const apiVersion = `${project.apiLevel}.0`;
  return JSON.stringify({
    configVersion: 'v3',
    app: {
      appId: Number(app.appId) || 10001,
      appName: project.meta.name,
      appType: 'watchface',
      version: { code: Number(app.versionCode) || 1, name: app.versionName || '1.0.0' },
      icon: 'Preview.png',
      cover: ['Preview.png'],
      vender: app.vendor || 'designer',
      description: `${project.meta.name} — экспортировано из Watch Face Designer`,
    },
    permissions: computePermissions(project),
    runtime: { apiVersion: { compatible: apiVersion, target: apiVersion, minVersion: apiVersion } },
    targets: {
      [device.targetKey]: {
        module: { watchface: { path: 'watchface/index', main: 1, editable: 0, lockscreen: 1, photoscreen: 0 } },
        platforms: (device.deviceSources || []).map((id) => ({ deviceSource: id })),
        designWidth: device.designWidth || device.w,
      },
    },
    i18n: { 'en-US': { appName: project.meta.name } },
    defaultLanguage: 'en-US',
    debug: true,
  }, null, 2);
}

function buildPackageJson(project) {
  // npm-имя пакета обязано быть ASCII и в нижнем регистре: транслитерируем
  // название проекта, а не режем его до 'asset' при кириллице.
  const slug = latinSlug(project.meta.name, 'watchface').toLowerCase();
  return JSON.stringify({
    name: slug,
    version: '1.0.0',
    private: true,
    description: `${project.meta.name} — watch face, экспортировано из Watch Face Designer`,
  }, null, 2);
}

const APP_JS_TEMPLATE = `App({\n  globalData: {},\n})\n`;

function buildReadme(project) {
  return `# ${project.meta.name}\n\n` +
    `Проект циферблата Zepp OS (API 3.0), сгенерирован в Watch Face Designer.\n` +
    `Код watchface/index.js использует современный ESM-стиль API 3.0:\n` +
    `import из '@zos/ui' / '@zos/sensor' / '@zos/timer' и обёртку WatchFace({...}).\n\n` +
    `## Сборка (ВАЖНО: не просто открыть эту папку как есть)\n\n` +
    `Экспорт из Designer содержит только "полезную нагрузку" (app.json, app.js,\n` +
    `watchface/index.js, assets/) — но НЕ служебные файлы сборщика Zeus CLI,\n` +
    `которые создаёт \`zeus create\`. Поэтому:\n\n` +
    `1. Установите Zeus CLI: \`npm install -g @zeppos/zeus-cli\` (см. docs.zepp.com).\n` +
    `2. В отдельной пустой папке выполните \`zeus create\` и выберите: тип — Watchface,\n` +
    `   API — 3.0, устройство — то же, что выбрано в Designer (${project.device.name}).\n` +
    `   Это создаст полноценный скаффолд со всеми служебными файлами сборщика.\n` +
    `3. Скопируйте поверх шаблона файлы из этого архива: \`app.json\`, \`app.js\`,\n` +
    `   \`watchface/index.js\` и папку \`assets/\`. Служебные файлы самого шаблона\n` +
    `   Zeus (которые Designer не создаёт) не трогайте.\n` +
    `4. Выполните \`npm install\` в корне свежесозданного проекта.\n` +
    `5. Запустите \`zeus dev\` при включённом Device Simulator.\n\n` +
    `## На что обратить внимание\n\n` +
    `- Свойства компонентов, помеченные в Designer значком ⚠ (unverified), стоит сверить с\n` +
    `  официальной документацией docs.zepp.com перед публикацией.\n` +
    `- \`assets/.../icon.png\` и \`assets/.../weather/*.png\` — автосгенерированные заглушки.\n` +
    `  Замените их своими изображениями перед публикацией.\n` +
    `- Список \`permissions\` в app.json подобран автоматически по использованным источникам\n` +
    `  данных на циферблате — проверьте его вручную.\n` +
    `- Погода использует нативные hmUI.data_type.WEATHER_CURRENT/WEATHER_LOW/WEATHER_HIGH и WEATHER_CURRENT для иконки.\n` +
    `  (поля high / low — прогноз на сегодня в °C, index — код состояния 0..28).\n` +
    `  «Текущей» температуры этот API не отдаёт; что показывать — настраивается\n` +
    `  в свойствах компонента. Данные появляются только после синхронизации\n` +
    `  погоды с телефоном: без неё виджеты покажут '--' и стартовую иконку.\n` +
    `- Калории — new Calorie().getCurrent(), дистанция — new Distance().getCurrent()\n` +
    `  (отдельные датчики @zos/sensor, а не методы Step).\n` +
    `- В архиве лежат aod-config.json и AOD_INTEGRATION.md. Runtime AOD также встраивается непосредственно в watchface/index.js; режим определяется через @zos/app.getScene() / SCENE_AOD, а AOD-виджеты получают hmUI.show_level.ONAL_AOD.\n` +
     `- Данные пульса/шагов/батареи/погоды подключены через реальные сенсоры\n` +
    `  '@zos/sensor'; если сенсор недоступен (часть симуляторов), виджет покажет '--'.\n` +
    `  Проверьте, что \`appId\` в app.json заменён на свой перед публикацией (сейчас заглушка).\n`;
}

/**
 * Собирает полный проект и возвращает Blob (.zip), готовый к скачиванию.
 */
async function exportFullProject(project) {
  const assetMap = computeAssetFilenames(project);
  const zip = new ZipWriter();
  const device = project.device;
  const assetsRoot = `assets/${device.targetKey}`;

  const previewDataUrl = await buildPreviewDataUrl(project, 324);
  const previewBytes = dataUrlToBytes(previewDataUrl);
  zip.addFile('app.json', buildAppJson(project));
  // Keep a root copy for the exported project and a target asset copy for Zeus.
  // Zeus resolves target resources from assets/<target>; the cover metadata
  // therefore points to Preview.png below.
  zip.addFile('Preview.png', previewBytes);
  zip.addFile('preview_en.png', previewBytes);
  // Keep both names in the target asset directory for compatibility with
  // Zeus/Zepp tooling versions; Preview.png is the legacy name used by v2.
  // The phone-side package is produced by Zeus; it must retain the root preview/icon
  // resources referenced by app.json rather than relying only on encoded device assets.
  zip.addFile(`${assetsRoot}/Preview.png`, previewBytes);
  zip.addFile(`${assetsRoot}/preview_en.png`, previewBytes);
  zip.addFile('app.js', APP_JS_TEMPLATE);
  zip.addFile('package.json', buildPackageJson(project));
  zip.addFile('README.md', buildReadme(project));
  zip.addFile('aod-config.json', JSON.stringify(buildAodConfig(project), null, 2));
  zip.addFile('AOD_INTEGRATION.md', `# AOD Studio runtime export\n\nThis project exports Normal and AOD together into watchface/index.js. Both sets of widgets are created in the same WatchFace build; Normal uses show_level.ONLY_NORMAL and AOD uses show_level.ONAL_AOD. app.json enables watchface lockscreen/AOD support. The editor configuration aod-config.json is also included for round-trip editing.\n\nImportant: AOD support depends on the target Zepp OS firmware/device. The exporter does not claim unsupported widget APIs.\n`);

  for (const a of project.assets || []) {
    const filename = assetMap[a.id];
    zip.addFile(`${assetsRoot}/${filename}`, dataUrlToBytes(a.dataUrl));
  }

  // Встроенные шрифты — физические файлы внутри проекта. Каждый выбранный
  // TEXT получает путь assets/<target>/fonts/<filename> в index.js.
  const fontMap = {};
  for (const f of project.fonts || []) {
    const safe = (f.filename || `${f.name || f.id}.ttf`).replace(/[^a-zA-Z0-9._-]+/g, '_');
    const filename = `${assetsRoot}/fonts/${f.id}_${safe}`;
    fontMap[f.id] = `fonts/${f.id}_${safe}`;
    zip.addFile(filename, dataUrlToBytes(f.dataUrl));
  }

  // Legacy icon paths are kept for compatibility, but use the same real watchface preview.
  // app.json explicitly points to Preview.png, which is the primary watchface preview.
  zip.addFile('icon.png', previewBytes);
  zip.addFile(`${assetsRoot}/icon.png`, previewBytes);

  const exportNormalComponents = Array.isArray(project.scenes?.normal?.components)
    ? project.scenes.normal.components
    : (project.mode === 'normal' ? project.components : []);
  const exportAodComponents = Array.isArray(project.scenes?.aod?.components) ? project.scenes.aod.components : [];
  const exportComponents = [...exportNormalComponents, ...exportAodComponents];
  const usesWeatherIcon = exportComponents.some((comp) => {
    const def = REGISTRY[comp.defId];
    return def && def.id === 'weather_icon';
  });
  if (usesWeatherIcon) {
    const weatherFiles = [
      '0_cloudy.png','1_showers.png','2_snow_showers.png','3_sunny.png','4_overcast.png',
      '5_light_rain.png','6_light_snow.png','7_moderate_rain.png','8_moderate_snow.png','9_heavy_snow.png',
      '10_heavy_rain.png','11_sandstorm.png','12_rain_snow.png','13_fog.png','14_hazy.png',
      '15_thunderstorm.png','16_snowstorm.png','17_floating_dust.png','18_very_heavy_rainstorm.png',
      '19_rain_hail.png','20_thunderstorm_hail.png','21_heavy_rainstorm.png','22_dust.png','23_heavy_sandstorm.png',
      '24_rainstorm.png','25_unknown.png','26_cloudy_night.png','27_showers_night.png','28_sunny_night.png'
    ];
    weatherFiles.forEach((name, index) => zip.addFile(`${assetsRoot}/weather/${name}`, canvasToPngBytes(drawWeatherIcon(index))));
  }

  const { code, validation } = exportIndexJsDual(project, assetMap, fontMap);
  zip.addFile('watchface/index.js', code);

  return { blob: zip.generate(), validation };
}
