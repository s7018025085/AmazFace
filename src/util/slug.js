// src/util/slug.js
//
// Превращает произвольное (в т.ч. кириллическое) название проекта в
// безопасное ЛАТИНСКОЕ имя файла. Нужно потому, что имена файлов проекта
// (.watchface.json, .zip) и поле `name` в package.json экспортируемого
// проекта должны быть ASCII: Zeus CLI / npm / часть файловых систем и
// архиваторов некорректно работают с не-ASCII именами.

const TRANSLIT_MAP = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z',
  и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
  с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh',
  щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
  // казахские/украинские/белорусские дополнительные буквы
  ә: 'a', ғ: 'g', қ: 'q', ң: 'ng', ө: 'o', ұ: 'u', ү: 'u', һ: 'h', і: 'i',
  ї: 'yi', є: 'ye', ґ: 'g', ў: 'u',
};

function transliterate(str) {
  let out = '';
  for (const ch of String(str)) {
    const lower = ch.toLowerCase();
    if (Object.prototype.hasOwnProperty.call(TRANSLIT_MAP, lower)) {
      const mapped = TRANSLIT_MAP[lower];
      out += (ch === lower) ? mapped : (mapped.charAt(0).toUpperCase() + mapped.slice(1));
    } else {
      out += ch;
    }
  }
  return out;
}

/**
 * latinSlug('Мой циферблат') -> 'Moy_ciferblat'
 * latinSlug('', 'watchface') -> 'watchface'
 * Всегда возвращает непустую ASCII-строку без пробелов и спецсимволов.
 */
function latinSlug(name, fallback = 'watchface') {
  let base = transliterate(name || '');
  // снимаем диакритику у латиницы (é -> e)
  if (typeof base.normalize === 'function') base = base.normalize('NFKD');
  const cleaned = base
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return cleaned || fallback;
}

/**
 * Делает безопасное имя файла для ресурсов циферблата.
 * Сохраняет расширение отдельно — вызывающий код добавляет его сам.
 */
function sanitizeAssetFilename(name, fallback = 'asset') {
  return latinSlug(String(name || '').replace(/\.[^.]+$/, ''), fallback).toLowerCase();
}
