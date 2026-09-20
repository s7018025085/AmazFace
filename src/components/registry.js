// src/components/registry.js
// Internal registry of Zepp OS Watch Face components (hmUI.widget.*).
// Built from ZEPP_API_COMPONENTS.md. DO NOT invent properties not listed here.

const API_LEVELS = ['3.0', '3.5', '4.0', '4.2'];

function apiLevelIndex(level) {
  return API_LEVELS.indexOf(level);
}

function isApiCompatible(componentApiLevel, projectApiLevel) {
  const need = apiLevelIndex(componentApiLevel);
  const have = apiLevelIndex(projectApiLevel);
  return have >= need;
}

// Property field descriptors used by the Inspector to render the right control.
// kind: 'number' | 'color' | 'text' | 'select' | 'checkbox' | 'asset' | 'textarea' | 'weathericon'
const P = (key, kind, opts = {}) => ({ key, kind, ...opts });

const commonGeometry = [
  P('x', 'number', { label: 'X', unit: 'пикс' }),
  P('y', 'number', { label: 'Y', unit: 'пикс' }),
  P('w', 'number', { label: 'Ш', unit: 'пикс' }),
  P('h', 'number', { label: 'В', unit: 'пикс' }),
];

const alignH = ['LEFT', 'CENTER_H', 'RIGHT'];
const alignV = ['TOP', 'CENTER_V', 'BOTTOM'];

const CATEGORIES = [
  'Текст и время', 'Данные', 'Погода', 'Фигуры', 'Холст', 'Изображение', 'Аналоговые стрелки',
];

// ---------------------------------------------------------------------------
// DATA_SOURCES — каталог источников "живых" данных для универсального TEXT
// (см. поле data_source у компонента `text`). Соответствует подсистеме
// hmUI.data_type / @zos/sensor, описанной в ZEPP_API_COMPONENTS.md.
// Точные имена констант hmUI.data_type.* нигде не выдумываются: экспортёр
// (index-js-exporter.js) вставляет явный TODO-комментарий со ссылкой на
// docs.zepp.com вместо угадывания — это сознательное решение проекта.
//
// confidence: 'confirmed' — источник/механизм подтверждён документацией;
//             'unverified' — работает по аналогии/форумным данным, сверьте
//             перед публикацией (в UI помечается значком ⚠).
// ---------------------------------------------------------------------------
const DATA_SOURCES = {
  NONE: {
    label: 'Нет — статический текст',
    confidence: 'confirmed', apiLevel: '3.0',
    note: null,
    fields: [],
  },
  TIME: {
    label: 'Время (часы : минуты [: секунды])',
    confidence: 'confirmed', apiLevel: '3.0',
    note: 'Обновляется через setInterval() из @zos/timer (раз в секунду). Отдельного виджета TIME в hmUI нет — под капотом это TEXT + служебный код автообновления, генерируемый экспортёром.',
    fields: [
      P('time_format', 'select', { label: 'Формат', options: ['HH:MM', 'hh:MM', 'HH:MM:SS', 'hh:MM:SS'], default: 'HH:MM' }),
      P('time_leading_zero', 'checkbox', { label: 'Ведущий ноль у часов', default: true }),
      P('time_separator', 'text', { label: 'Разделитель ЧЧ / ММ / СС', default: ':' }),
    ],
  },
  AMPM: {
    label: 'AM / PM',
    confidence: 'confirmed', apiLevel: '3.0',
    note: 'Обновляется тем же тиком, что и TIME (setInterval из @zos/timer).',
    fields: [
      P('ampm_case', 'select', { label: 'Регистр', options: ['AM/PM', 'am/pm'], default: 'AM/PM' }),
    ],
  },
  DATE: {
    label: 'Дата',
    confidence: 'unverified', apiLevel: '3.0',
    note: 'Готового формат-виджета даты в hmUI нет — Designer генерирует helper-функцию форматирования поверх системного Date().',
    fields: [
      P('date_format', 'select', {
        label: 'Формат',
        options: ['DD.MM.YYYY', 'DD/MM', 'DD MMM', 'MMM DD', 'YYYY-MM-DD', 'DD MMMM'],
        default: 'DD.MM.YYYY',
      }),
      P('date_locale', 'select', { label: 'Язык названий месяцев', options: ['EN', 'RU'], default: 'EN', confidence: 'unverified' }),
    ],
  },
  WEEKDAY: {
    label: 'День недели',
    confidence: 'unverified', apiLevel: '3.0',
    note: 'Название дня — helper-функция на базе Date().getDay(), не отдельный hmUI-виджет.',
    fields: [
      P('weekday_format', 'select', { label: 'Формат', options: [{ value: 'EEE', label: 'Короткий (2 буквы)' }, { value: 'EEE3', label: '3 буквы' }, { value: 'EEEE', label: 'Полностью' }], default: 'EEE' }),
      P('weekday_locale', 'select', { label: 'Язык', options: ['EN', 'RU'], default: 'EN', confidence: 'unverified' }),
    ],
  },
  HOUR: {
    label: 'Часы (отдельно)',
    confidence: 'confirmed', apiLevel: '3.0',
    note: 'Тот же механизм, что и «Время» (TEXT + setInterval из @zos/timer), но выводит только часы — удобно, если часы и минуты нужно стилизовать по отдельности (разный цвет/размер/позиция).',
    fields: [
      P('hour_format', 'select', { label: 'Формат', options: ['HH', 'hh'], default: 'HH' }),
      P('hour_leading_zero', 'checkbox', { label: 'Ведущий ноль', default: true }),
    ],
  },
  MINUTE: {
    label: 'Минуты (отдельно)',
    confidence: 'confirmed', apiLevel: '3.0',
    note: 'TEXT, обновляемый раз в секунду через setInterval — выводит только минуты.',
    fields: [
      P('minute_leading_zero', 'checkbox', { label: 'Ведущий ноль', default: true }),
    ],
  },
  SECOND: {
    label: 'Секунды (отдельно)',
    confidence: 'confirmed', apiLevel: '3.0',
    note: 'TEXT, обновляемый раз в секунду через setInterval — выводит только секунды. Учитывайте влияние частого обновления на батарею.',
    fields: [
      P('second_leading_zero', 'checkbox', { label: 'Ведущий ноль', default: true }),
    ],
  },
  DAY: {
    label: 'День месяца (отдельно)',
    confidence: 'unverified', apiLevel: '3.0',
    note: 'Тот же механизм, что и «Дата» (helper поверх Date(), не отдельный hmUI-виджет) — только число месяца.',
    fields: [
      P('day_leading_zero', 'checkbox', { label: 'Ведущий ноль', default: true }),
    ],
  },
  MONTH: {
    label: 'Месяц (отдельно)',
    confidence: 'unverified', apiLevel: '3.0',
    note: 'Число или название месяца — helper-функция на базе Date().getMonth(), не отдельный hmUI-виджет.',
    fields: [
      P('month_format', 'select', { label: 'Формат', options: ['MM', 'M', 'MMM', 'MMMM'], default: 'MM' }),
      P('month_locale', 'select', { label: 'Язык названия', options: ['EN', 'RU'], default: 'EN', confidence: 'unverified' }),
    ],
  },
  YEAR: {
    label: 'Год (отдельно)',
    confidence: 'unverified', apiLevel: '3.0',
    note: 'Helper-функция на базе Date().getFullYear(), не отдельный hmUI-виджет.',
    fields: [
      P('year_format', 'select', { label: 'Формат', options: ['YYYY', 'YY'], default: 'YYYY' }),
    ],
  },
  BATTERY: {
    label: 'Заряд батареи',
    confidence: 'unverified', apiLevel: '3.0',
    note: 'Значение — new Battery().getCurrent() из @zos/sensor. Точное имя hmUI.data_type.BATTERY не подтверждено цитируемой таблицей документации — при экспорте вставляется TODO со ссылкой на docs.zepp.com вместо угадывания.',
    fields: [
      P('prefix', 'text', { label: 'Префикс', default: '' }),
      P('suffix', 'text', { label: 'Суффикс', default: '%' }),
      P('battery_low_threshold', 'number', {
        label: 'Порог "разряжен", %', default: 15, min: 0, max: 100, confidence: 'unverified',
      }),
    ],
  },
  STEP: {
    label: 'Шаги',
    confidence: 'unverified', apiLevel: '3.0',
    note: 'Значение — new Step().getCurrent() из @zos/sensor.',
    fields: [
      P('prefix', 'text', { label: 'Префикс', default: '' }),
      P('suffix', 'text', { label: 'Суффикс', default: '' }),
      P('step_thousands_sep', 'checkbox', { label: 'Разделитель тысяч (1 000)', default: false }),
    ],
  },
  HEART: {
    label: 'Пульс',
    confidence: 'unverified', apiLevel: '3.0',
    note: '«До 3 символов» подтверждено на официальной странице Watchface Design. Значение — new HeartRate().getCurrent().',
    fields: [
      P('prefix', 'text', { label: 'Префикс', default: '♥ ' }),
      P('suffix', 'text', { label: 'Суффикс', default: '' }),
      P('heart_min_valid', 'number', {
        label: 'Мин. валидное значение (иначе "--")', default: 30, min: 0, max: 250, confidence: 'unverified',
      }),
    ],
  },
  CALORIE: {
    label: 'Калории',
    confidence: 'confirmed', apiLevel: '3.0',
    note: 'Значение — new Calorie().getCurrent() из @zos/sensor (ккал). Отдельный датчик Calorie, не метод Step.',
    fields: [
      P('prefix', 'text', { label: 'Префикс', default: '' }),
      P('suffix', 'text', { label: 'Суффикс', default: ' kcal' }),
      P('calorie_decimals', 'select', { label: 'Знаков после запятой', options: ['0', '1'], default: '0' }),
    ],
  },
  DISTANCE: {
    label: 'Дистанция',
    confidence: 'unverified', apiLevel: '3.0',
    note: 'Значение — new Distance().getCurrent() из @zos/sensor. Сам метод документирован, а вот единица возвращаемого значения в документации не указана — принята за метры (⚠).',
    fields: [
      P('prefix', 'text', { label: 'Префикс', default: '' }),
      P('suffix', 'text', { label: 'Суффикс', default: ' km' }),
      P('distance_unit', 'select', { label: 'Единица', options: ['km', 'mi'], default: 'km', confidence: 'unverified' }),
      P('distance_decimals', 'select', { label: 'Знаков после запятой', options: ['0', '1', '2'], default: '2' }),
    ],
  },
  WEATHER_TEMP: {
    label: 'Погода: температура',
    confidence: 'confirmed', apiLevel: '3.0',
    note: 'Нативная привязка циферблата к hmUI.data_type.WEATHER_CURRENT / WEATHER_LOW / WEATHER_HIGH. Текущее значение берётся самим Zepp OS из синхронизированной погоды.',
    fields: [
      P('weather_temp_source', 'select', {
        label: 'Что показывать', options: ['CURRENT', 'HIGH', 'LOW'], default: 'CURRENT',
      }),
      P('weather_unit', 'select', { label: 'Единица', options: ['°C', '°F'], default: '°C' }),
      P('weather_show_degree', 'checkbox', { label: 'Показывать значок °', default: true }),
    ],
  },
};

const REGISTRY = {
  text: {
    id: 'text', name: 'Текст', category: 'Текст и время',
    widgetId: 'TEXT', apiLevel: '3.0', confidence: 'confirmed',
    description: 'Универсальный текстовый виджет hmUI.widget.TEXT. По умолчанию — статичная надпись, но через поле «Источник данных» можно превратить его в live-текст (время, дата, батарея, пульс, шаги, погода и т.д.) с тонкими настройками формата под конкретный источник — не создавая для этого отдельный специализированный компонент.',
    properties: [
      ...commonGeometry,
      P('text', 'text', { label: 'Текст (если источник данных = "Нет")', default: 'Привет' }),
      P('data_source', 'select', { label: 'Источник данных', options: Object.keys(DATA_SOURCES), default: 'NONE' }),
      P('text_size', 'number', { label: 'Размер шрифта', default: 36, min: 8, max: 160 }),
      P('color', 'color', { label: 'Цвет', default: '#ffffff' }),
      P('align_h', 'select', { label: 'Выравнивание по X', options: alignH, default: 'CENTER_H' }),
      P('align_v', 'select', { label: 'Выравнивание по Y', options: alignV, default: 'CENTER_V' }),
      P('text_style', 'select', { label: 'Стиль', options: ['NONE', 'WRAP', 'SCROLL'], default: 'NONE', confidence: 'unverified' }),
      P('font', 'font', { label: 'Шрифт', optional: true }),
    ],
    dataBindable: false,
    dataSourceSelectable: true,
    defaultSize: { w: 200, h: 50 },
  },

  time_hm: {
    id: 'time_hm', name: 'Время (ЧЧ:ММ)', category: 'Текст и время',
    widgetId: 'TEXT', apiLevel: '3.0', confidence: 'confirmed',
    description: 'Готовый пресет: TEXT, жёстко привязанный к времени в формате ЧЧ:ММ. Для более гибких настроек (разделитель, ведущий ноль, добавление секунд) используйте компонент «Текст» с источником данных «Время».',
    properties: [
      ...commonGeometry,
      P('text_size', 'number', { label: 'Размер шрифта', default: 72, min: 8, max: 200 }),
      P('color', 'color', { label: 'Цвет', default: '#ffffff' }),
      P('align_h', 'select', { label: 'Выравнивание по X', options: alignH, default: 'CENTER_H' }),
      P('align_v', 'select', { label: 'Выравнивание по Y', options: alignV, default: 'CENTER_V' }),
      P('format', 'select', { label: 'Формат', options: ['HH:MM', 'hh:MM'], default: 'HH:MM' }),
    ],
    dataBindable: true, dataSource: 'TIME',
    defaultSize: { w: 300, h: 100 },
  },

  time_hms: {
    id: 'time_hms', name: 'Время (ЧЧ:ММ:СС)', category: 'Текст и время',
    widgetId: 'TEXT', apiLevel: '3.0', confidence: 'confirmed',
    description: 'Готовый пресет времени с секундами. Требует более частого тика (раз в секунду) — учитывайте влияние на батарею. Гибкая версия — компонент «Текст» → источник данных «Время».',
    properties: [
      ...commonGeometry,
      P('text_size', 'number', { label: 'Размер шрифта', default: 48, min: 8, max: 200 }),
      P('color', 'color', { label: 'Цвет', default: '#ffffff' }),
      P('align_h', 'select', { label: 'Выравнивание по X', options: alignH, default: 'CENTER_H' }),
      P('align_v', 'select', { label: 'Выравнивание по Y', options: alignV, default: 'CENTER_V' }),
      P('format', 'select', { label: 'Формат', options: ['HH:MM:SS', 'hh:MM:SS'], default: 'HH:MM:SS' }),
    ],
    dataBindable: true, dataSource: 'TIME',
    defaultSize: { w: 320, h: 70 },
  },

  ampm: {
    id: 'ampm', name: 'AM/PM', category: 'Текст и время',
    widgetId: 'TEXT', apiLevel: '3.0', confidence: 'confirmed',
    description: 'Небольшой TEXT, показывающий только AM или PM — используйте рядом с 12-часовым временем (формат hh:MM).',
    properties: [
      ...commonGeometry,
      P('text_size', 'number', { label: 'Размер шрифта', default: 24, min: 8, max: 100 }),
      P('color', 'color', { label: 'Цвет', default: '#ffffff' }),
      P('align_h', 'select', { label: 'Выравнивание по X', options: alignH, default: 'CENTER_H' }),
      P('align_v', 'select', { label: 'Выравнивание по Y', options: alignV, default: 'CENTER_V' }),
    ],
    dataBindable: true, dataSource: 'AMPM',
    defaultSize: { w: 80, h: 40 },
  },

  date_full: {
    id: 'date_full', name: 'Дата', category: 'Текст и время',
    widgetId: 'TEXT', apiLevel: '3.0', confidence: 'unverified',
    description: 'TEXT с датой, обновляемой раз в минуту. ⚠ Формат дат в Zepp OS реализуется вручную через Date() — Designer генерирует helper, а не использует "магический" виджет даты.',
    properties: [
      ...commonGeometry,
      P('text_size', 'number', { label: 'Размер шрифта', default: 28, min: 8, max: 120 }),
      P('color', 'color', { label: 'Цвет', default: '#ffffff' }),
      P('align_h', 'select', { label: 'Выравнивание по X', options: alignH, default: 'CENTER_H' }),
      P('align_v', 'select', { label: 'Выравнивание по Y', options: alignV, default: 'CENTER_V' }),
      P('format', 'select', {
        label: 'Формат',
        options: ['DD.MM.YYYY', 'DD MMM', 'MMM DD', 'DD/MM'],
        default: 'DD.MM.YYYY',
      }),
      P('date_locale', 'select', { label: 'Язык названий месяцев', options: ['EN', 'RU'], default: 'EN', confidence: 'unverified' }),
    ],
    dataBindable: true, dataSource: 'DATE',
    defaultSize: { w: 220, h: 40 },
  },

  weekday: {
    id: 'weekday', name: 'День недели', category: 'Текст и время',
    widgetId: 'TEXT', apiLevel: '3.0', confidence: 'unverified',
    description: 'TEXT с названием дня недели (Mon/Monday и т.п.). ⚠ Не отдельный hmUI-виджет — форматирование на стороне JS.',
    properties: [
      ...commonGeometry,
      P('text_size', 'number', { label: 'Размер шрифта', default: 24, min: 8, max: 100 }),
      P('color', 'color', { label: 'Цвет', default: '#ffffff' }),
      P('align_h', 'select', { label: 'Выравнивание по X', options: alignH, default: 'CENTER_H' }),
      P('align_v', 'select', { label: 'Выравнивание по Y', options: alignV, default: 'CENTER_V' }),
      P('format', 'select', { label: 'Формат', options: [{ value: 'EEE', label: 'Короткий (2 буквы)' }, { value: 'EEE3', label: '3 буквы' }, { value: 'EEEE', label: 'Полностью' }], default: 'EEE' }),
      P('weekday_locale', 'select', { label: 'Язык', options: ['EN', 'RU'], default: 'EN', confidence: 'unverified' }),
    ],
    dataBindable: true, dataSource: 'WEEKDAY',
    defaultSize: { w: 120, h: 36 },
  },

  time_hour: {
    id: 'time_hour', name: 'Часы (ЧЧ)', category: 'Текст и время',
    widgetId: 'TEXT', apiLevel: '3.0', confidence: 'confirmed',
    description: 'Отдельный TEXT только с часами — удобно, когда часы и минуты стилизуются по-разному (свой цвет/размер/позиция для каждого). Тот же механизм автообновления, что и «Время».',
    properties: [
      ...commonGeometry,
      P('text_size', 'number', { label: 'Размер шрифта', default: 72, min: 8, max: 200 }),
      P('color', 'color', { label: 'Цвет', default: '#ffffff' }),
      P('align_h', 'select', { label: 'Выравнивание по X', options: alignH, default: 'CENTER_H' }),
      P('align_v', 'select', { label: 'Выравнивание по Y', options: alignV, default: 'CENTER_V' }),
      P('hour_format', 'select', { label: 'Формат', options: ['HH', 'hh'], default: 'HH' }),
      P('hour_leading_zero', 'checkbox', { label: 'Ведущий ноль', default: true }),
    ],
    dataBindable: true, dataSource: 'HOUR',
    defaultSize: { w: 150, h: 100 },
  },

  time_minute: {
    id: 'time_minute', name: 'Минуты (ММ)', category: 'Текст и время',
    widgetId: 'TEXT', apiLevel: '3.0', confidence: 'confirmed',
    description: 'Отдельный TEXT только с минутами — используйте вместе с «Часы (ЧЧ)», если нужно развести их по холсту или стилизовать по-разному.',
    properties: [
      ...commonGeometry,
      P('text_size', 'number', { label: 'Размер шрифта', default: 72, min: 8, max: 200 }),
      P('color', 'color', { label: 'Цвет', default: '#ffffff' }),
      P('align_h', 'select', { label: 'Выравнивание по X', options: alignH, default: 'CENTER_H' }),
      P('align_v', 'select', { label: 'Выравнивание по Y', options: alignV, default: 'CENTER_V' }),
      P('minute_leading_zero', 'checkbox', { label: 'Ведущий ноль', default: true }),
    ],
    dataBindable: true, dataSource: 'MINUTE',
    defaultSize: { w: 150, h: 100 },
  },

  time_second: {
    id: 'time_second', name: 'Секунды (СС)', category: 'Текст и время',
    widgetId: 'TEXT', apiLevel: '3.0', confidence: 'confirmed',
    description: 'Отдельный TEXT только с секундами. Требует посекундного тика — учитывайте влияние на батарею.',
    properties: [
      ...commonGeometry,
      P('text_size', 'number', { label: 'Размер шрифта', default: 48, min: 8, max: 200 }),
      P('color', 'color', { label: 'Цвет', default: '#ffffff' }),
      P('align_h', 'select', { label: 'Выравнивание по X', options: alignH, default: 'CENTER_H' }),
      P('align_v', 'select', { label: 'Выравнивание по Y', options: alignV, default: 'CENTER_V' }),
      P('second_leading_zero', 'checkbox', { label: 'Ведущий ноль', default: true }),
    ],
    dataBindable: true, dataSource: 'SECOND',
    defaultSize: { w: 100, h: 70 },
  },

  date_day: {
    id: 'date_day', name: 'День (ДД)', category: 'Текст и время',
    widgetId: 'TEXT', apiLevel: '3.0', confidence: 'unverified',
    description: 'Отдельный TEXT только с числом месяца. ⚠ Как и «Дата» — форматирование на стороне JS, не отдельный hmUI-виджет.',
    properties: [
      ...commonGeometry,
      P('text_size', 'number', { label: 'Размер шрифта', default: 28, min: 8, max: 120 }),
      P('color', 'color', { label: 'Цвет', default: '#ffffff' }),
      P('align_h', 'select', { label: 'Выравнивание по X', options: alignH, default: 'CENTER_H' }),
      P('align_v', 'select', { label: 'Выравнивание по Y', options: alignV, default: 'CENTER_V' }),
      P('day_leading_zero', 'checkbox', { label: 'Ведущий ноль', default: true }),
    ],
    dataBindable: true, dataSource: 'DAY',
    defaultSize: { w: 80, h: 40 },
  },

  date_month: {
    id: 'date_month', name: 'Месяц (ММ)', category: 'Текст и время',
    widgetId: 'TEXT', apiLevel: '3.0', confidence: 'unverified',
    description: 'Отдельный TEXT только с месяцем (числом или названием). ⚠ Форматирование на стороне JS, не отдельный hmUI-виджет.',
    properties: [
      ...commonGeometry,
      P('text_size', 'number', { label: 'Размер шрифта', default: 28, min: 8, max: 120 }),
      P('color', 'color', { label: 'Цвет', default: '#ffffff' }),
      P('align_h', 'select', { label: 'Выравнивание по X', options: alignH, default: 'CENTER_H' }),
      P('align_v', 'select', { label: 'Выравнивание по Y', options: alignV, default: 'CENTER_V' }),
      P('month_format', 'select', { label: 'Формат', options: ['MM', 'M', 'MMM', 'MMMM'], default: 'MM' }),
      P('month_locale', 'select', { label: 'Язык названия', options: ['EN', 'RU'], default: 'EN', confidence: 'unverified' }),
    ],
    dataBindable: true, dataSource: 'MONTH',
    defaultSize: { w: 100, h: 40 },
  },

  date_year: {
    id: 'date_year', name: 'Год (ГГГГ)', category: 'Текст и время',
    widgetId: 'TEXT', apiLevel: '3.0', confidence: 'unverified',
    description: 'Отдельный TEXT только с годом. ⚠ Форматирование на стороне JS, не отдельный hmUI-виджет.',
    properties: [
      ...commonGeometry,
      P('text_size', 'number', { label: 'Размер шрифта', default: 28, min: 8, max: 120 }),
      P('color', 'color', { label: 'Цвет', default: '#ffffff' }),
      P('align_h', 'select', { label: 'Выравнивание по X', options: alignH, default: 'CENTER_H' }),
      P('align_v', 'select', { label: 'Выравнивание по Y', options: alignV, default: 'CENTER_V' }),
      P('year_format', 'select', { label: 'Формат', options: ['YYYY', 'YY'], default: 'YYYY' }),
    ],
    dataBindable: true, dataSource: 'YEAR',
    defaultSize: { w: 120, h: 40 },
  },

  battery: {
    id: 'battery', name: 'Заряд батареи', category: 'Данные',
    widgetId: 'TEXT', apiLevel: '3.0', confidence: 'unverified',
    description: 'TEXT, привязанный к new Battery() из @zos/sensor. ⚠ Точное имя константы hmUI.data_type.BATTERY не подтверждено — при экспорте генерируется TODO-комментарий вместо угадывания.',
    properties: [
      ...commonGeometry,
      P('text_size', 'number', { label: 'Размер шрифта', default: 28, min: 8, max: 120 }),
      P('color', 'color', { label: 'Цвет', default: '#ffffff' }),
      P('align_h', 'select', { label: 'Выравнивание по X', options: alignH, default: 'CENTER_H' }),
      P('align_v', 'select', { label: 'Выравнивание по Y', options: alignV, default: 'CENTER_V' }),
      P('suffix', 'text', { label: 'Суффикс', default: '%' }),
    ],
    dataBindable: true, dataSource: 'BATTERY',
    defaultSize: { w: 100, h: 36 },
  },

  steps: {
    id: 'steps', name: 'Шаги', category: 'Данные',
    widgetId: 'TEXT', apiLevel: '3.0', confidence: 'unverified',
    description: 'TEXT, привязанный к new Step() из @zos/sensor. ⚠ Точное имя hmUI.data_type.STEP не подтверждено цитируемым фрагментом документации.',
    properties: [
      ...commonGeometry,
      P('text_size', 'number', { label: 'Размер шрифта', default: 28, min: 8, max: 120 }),
      P('color', 'color', { label: 'Цвет', default: '#ffffff' }),
      P('align_h', 'select', { label: 'Выравнивание по X', options: alignH, default: 'CENTER_H' }),
      P('align_v', 'select', { label: 'Выравнивание по Y', options: alignV, default: 'CENTER_V' }),
      P('suffix', 'text', { label: 'Суффикс', default: ' шагов' }),
    ],
    dataBindable: true, dataSource: 'STEP',
    defaultSize: { w: 150, h: 36 },
  },

  heart_rate: {
    id: 'heart_rate', name: 'Пульс', category: 'Данные',
    widgetId: 'TEXT', apiLevel: '3.0', confidence: 'unverified',
    description: 'TEXT, привязанный к new HeartRate() из @zos/sensor. «До 3 символов» подтверждено официальной страницей Watchface Design.',
    properties: [
      ...commonGeometry,
      P('text_size', 'number', { label: 'Размер шрифта', default: 28, min: 8, max: 120 }),
      P('color', 'color', { label: 'Цвет', default: '#ffffff' }),
      P('align_h', 'select', { label: 'Выравнивание по X', options: alignH, default: 'CENTER_H' }),
      P('align_v', 'select', { label: 'Выравнивание по Y', options: alignV, default: 'CENTER_V' }),
      P('prefix', 'text', { label: 'Префикс', default: '♥ ' }),
    ],
    dataBindable: true, dataSource: 'HEART',
    defaultSize: { w: 100, h: 36 },
  },

  calories: {
    id: 'calories', name: 'Калории', category: 'Данные',
    widgetId: 'TEXT', apiLevel: '3.0', confidence: 'confirmed',
    description: 'TEXT, привязанный к new Calorie().getCurrent() из @zos/sensor — текущий расход калорий за день, в ккал.',
    properties: [
      ...commonGeometry,
      P('text_size', 'number', { label: 'Размер шрифта', default: 24, min: 8, max: 120 }),
      P('color', 'color', { label: 'Цвет', default: '#ffffff' }),
      P('align_h', 'select', { label: 'Выравнивание по X', options: alignH, default: 'CENTER_H' }),
      P('align_v', 'select', { label: 'Выравнивание по Y', options: alignV, default: 'CENTER_V' }),
      P('suffix', 'text', { label: 'Суффикс', default: ' kcal' }),
    ],
    dataBindable: true, dataSource: 'CALORIE',
    defaultSize: { w: 120, h: 32 },
  },

  distance: {
    id: 'distance', name: 'Расстояние', category: 'Данные',
    widgetId: 'TEXT', apiLevel: '3.0', confidence: 'unverified',
    description: 'TEXT, привязанный к new Distance().getCurrent() из @zos/sensor. ⚠ Единица возвращаемого значения в документации не указана — код исходит из метров и пересчитывает в км/мили.',
    properties: [
      ...commonGeometry,
      P('text_size', 'number', { label: 'Размер шрифта', default: 24, min: 8, max: 120 }),
      P('color', 'color', { label: 'Цвет', default: '#ffffff' }),
      P('align_h', 'select', { label: 'Выравнивание по X', options: alignH, default: 'CENTER_H' }),
      P('align_v', 'select', { label: 'Выравнивание по Y', options: alignV, default: 'CENTER_V' }),
      P('unit', 'select', { label: 'Единица', options: ['km', 'mi'], default: 'km' }),
    ],
    dataBindable: true, dataSource: 'DISTANCE',
    defaultSize: { w: 120, h: 32 },
  },

  weather_temp: {
    id: 'weather_temp', name: 'Температура', category: 'Погода',
    widgetId: 'TEXT', apiLevel: '3.0', confidence: 'confirmed',
    description: 'Нативная температура циферблата через hmUI.data_type.WEATHER_CURRENT / WEATHER_HIGH / WEATHER_LOW. Данные предоставляет Zepp OS после синхронизации погоды с телефоном.',
    properties: [
      ...commonGeometry,
      P('text_size', 'number', { label: 'Размер шрифта', default: 32, min: 8, max: 140 }),
      P('color', 'color', { label: 'Цвет', default: '#ffffff' }),
      P('align_h', 'select', { label: 'Выравнивание по X', options: alignH, default: 'CENTER_H' }),
      P('align_v', 'select', { label: 'Выравнивание по Y', options: alignV, default: 'CENTER_V' }),
      P('weather_temp_source', 'select', { label: 'Что показывать', options: ['CURRENT', 'HIGH', 'LOW'], default: 'CURRENT' }),
      P('unit', 'select', { label: 'Единица', options: ['°C', '°F'], default: '°C' }),
      P('weather_show_degree', 'checkbox', { label: 'Показывать значок °', default: true }),
    ],
    dataBindable: true, dataSource: 'WEATHER_TEMP',
    defaultSize: { w: 120, h: 40 },
  },

  weather_icon: {
    id: 'weather_icon', name: 'Значок погоды', category: 'Погода',
    widgetId: 'IMG', apiLevel: '3.0', confidence: 'confirmed',
    description: 'Нативная иконка погоды через hmUI.data_type.WEATHER_CURRENT. Индекс 0..28 выбирается прошивкой часов; выбранное в Designer условие используется только как стартовое превью.',
    properties: [
      ...commonGeometry,
      P('src', 'weathericon', { label: 'Условие', default: 'sunny' }),
      P('alpha', 'number', { label: 'Прозрачность', default: 100, min: 0, max: 100 }),
    ],
    dataBindable: true, dataSource: 'WEATHER_ICON',
    defaultSize: { w: 64, h: 64 },
  },

  image: {
    id: 'image', name: 'Изображение', category: 'Изображение',
    widgetId: 'IMG', apiLevel: '3.0', confidence: 'confirmed',
    description: 'Статичное изображение hmUI.widget.IMG из ваших ресурсов (Asset Manager). Поддерживает прозрачность (alpha).',
    properties: [
      ...commonGeometry,
      P('src', 'asset', { label: 'Файл изображения' }),
      P('alpha', 'number', { label: 'Прозрачность', default: 100, min: 0, max: 100 }),
    ],
    dataBindable: false,
    defaultSize: { w: 100, h: 100 },
  },

  fill_rect: {
    id: 'fill_rect', name: 'Прямоугольник (заливка)', category: 'Фигуры',
    widgetId: 'FILL_RECT', apiLevel: '3.0', confidence: 'confirmed',
    description: 'Залитый прямоугольник hmUI.widget.FILL_RECT с опциональным скруглением углов. Свойство line_width недоступно (удалено из API) — Designer его не выставляет.',
    properties: [
      ...commonGeometry,
      P('radius', 'number', { label: 'Радиус скругления', default: 0, min: 0, max: 240 }),
      P('color', 'color', { label: 'Цвет', default: '#3366ff' }),
    ],
    dataBindable: false,
    defaultSize: { w: 150, h: 80 },
  },

  stroke_rect: {
    id: 'stroke_rect', name: 'Прямоугольник (контур)', category: 'Фигуры',
    widgetId: 'STROKE_RECT', apiLevel: '3.0', confidence: 'unverified',
    description: 'Прямоугольник-контур по аналогии с FILL_RECT/CIRCLE-семейством. ⚠ Точный набор полей не подтверждён отдельной документацией — сверьтесь перед публикацией.',
    properties: [
      ...commonGeometry,
      P('radius', 'number', { label: 'Радиус скругления', default: 0, min: 0, max: 240 }),
      P('color', 'color', { label: 'Цвет', default: '#3366ff' }),
      P('line_width', 'number', { label: 'Толщина линии', default: 4, min: 1, max: 40 }),
    ],
    dataBindable: false,
    defaultSize: { w: 150, h: 80 },
  },

  circle: {
    id: 'circle', name: 'Круг (заливка)', category: 'Фигуры',
    widgetId: 'CIRCLE', apiLevel: '3.0', confidence: 'unverified',
    description: 'Залитый круг hmUI.widget.CIRCLE. Задаётся центром и радиусом, а не x/y/w/h.',
    properties: [
      P('center_x', 'number', { label: 'Центр X' }),
      P('center_y', 'number', { label: 'Центр Y' }),
      P('radius', 'number', { label: 'Радиус', default: 40 }),
      P('color', 'color', { label: 'Цвет', default: '#3366ff' }),
    ],
    dataBindable: false,
    defaultSize: { w: 80, h: 80 }, // maps to radius on export
  },

  stroke_circle: {
    id: 'stroke_circle', name: 'Круг (контур)', category: 'Фигуры',
    widgetId: 'STROKE_CIRCLE', apiLevel: '3.0', confidence: 'unverified',
    description: 'Контур круга hmUI.widget.STROKE_CIRCLE с настраиваемой толщиной линии.',
    properties: [
      P('center_x', 'number', { label: 'Центр X' }),
      P('center_y', 'number', { label: 'Центр Y' }),
      P('radius', 'number', { label: 'Радиус', default: 40 }),
      P('color', 'color', { label: 'Цвет', default: '#3366ff' }),
      P('line_width', 'number', { label: 'Толщина линии', default: 4, min: 1, max: 40 }),
    ],
    dataBindable: false,
    defaultSize: { w: 80, h: 80 },
  },

  arc: {
    id: 'arc', name: 'Дуга', category: 'Фигуры',
    widgetId: 'ARC', apiLevel: '3.0', confidence: 'confirmed',
    description: 'Дуга hmUI.widget.ARC от start_angle до end_angle — удобна для колец прогресса (шаги, активность).',
    properties: [
      ...commonGeometry,
      P('start_angle', 'number', { label: 'Начальный угол', default: 0, min: 0, max: 360 }),
      P('end_angle', 'number', { label: 'Конечный угол', default: 270, min: 0, max: 360 }),
      P('color', 'color', { label: 'Цвет', default: '#3366ff' }),
      P('line_width', 'number', { label: 'Толщина линии', default: 8, min: 1, max: 60 }),
    ],
    dataBindable: false,
    defaultSize: { w: 160, h: 160 },
  },

  canvas: {
    id: 'canvas', name: 'Холст', category: 'Холст',
    widgetId: 'CANVAS', apiLevel: '3.0', confidence: 'confirmed',
    description: 'hmUI.widget.CANVAS — область для рисования примитивов вручную (drawLine/drawRect/drawCircle/drawArc/drawText/drawImage) через методы canvas.* внутри build(). Сам по себе холст на экране не рисует ничего, кроме размеченной области.',
    properties: [
      ...commonGeometry,
    ],
    dataBindable: false,
    defaultSize: { w: 200, h: 200 },
    note: 'Draw primitives (line/rect/circle/arc/text/image) via canvas.* methods inside build().',
  },

  time_pointer_hour: {
    id: 'time_pointer_hour', name: 'Часовая стрелка', category: 'Аналоговые стрелки',
    widgetId: 'TIME_POINTER', apiLevel: '3.0', confidence: 'confirmed',
    description: 'Часовая стрелка аналогового циферблата (hmUI.widget.TIME_POINTER). Все три стрелки (часовая/минутная/секундная) экспортируются одним общим виджетом TIME_POINTER с параметрами hour_*/minute_*/second_*.',
    properties: [
      P('center_x', 'number', { label: 'Центр X', default: 240 }),
      P('center_y', 'number', { label: 'Центр Y', default: 240 }),
      P('pos_x', 'number', { label: 'Точка опоры X (в изображении)', default: 19 }),
      P('pos_y', 'number', { label: 'Точка опоры Y (в изображении)', default: 100 }),
      P('path', 'asset', { label: 'Изображение стрелки' }),
      P('cover_path', 'asset', { label: 'Изображение накладки', optional: true }),
    ],
    dataBindable: true, dataSource: 'TIME_POINTER_HOUR',
    defaultSize: { w: 40, h: 200 },
    single: true, group: 'time_pointer',
  },

  time_pointer_minute: {
    id: 'time_pointer_minute', name: 'Минутная стрелка', category: 'Аналоговые стрелки',
    widgetId: 'TIME_POINTER', apiLevel: '3.0', confidence: 'confirmed',
    description: 'Минутная стрелка аналогового циферблата (hmUI.widget.TIME_POINTER, параметры minute_*).',
    properties: [
      P('center_x', 'number', { label: 'Центр X', default: 240 }),
      P('center_y', 'number', { label: 'Центр Y', default: 240 }),
      P('pos_x', 'number', { label: 'Точка опоры X (в изображении)', default: 19 }),
      P('pos_y', 'number', { label: 'Точка опоры Y (в изображении)', default: 130 }),
      P('path', 'asset', { label: 'Изображение стрелки' }),
      P('cover_path', 'asset', { label: 'Изображение накладки', optional: true }),
    ],
    dataBindable: true, dataSource: 'TIME_POINTER_MINUTE',
    defaultSize: { w: 30, h: 240 },
    single: true, group: 'time_pointer',
  },

  time_pointer_second: {
    id: 'time_pointer_second', name: 'Секундная стрелка', category: 'Аналоговые стрелки',
    widgetId: 'TIME_POINTER', apiLevel: '3.0', confidence: 'confirmed',
    description: 'Секундная стрелка аналогового циферблата (hmUI.widget.TIME_POINTER, параметры second_*). Учитывайте влияние частого обновления на энергопотребление.',
    properties: [
      P('center_x', 'number', { label: 'Центр X', default: 240 }),
      P('center_y', 'number', { label: 'Центр Y', default: 240 }),
      P('pos_x', 'number', { label: 'Точка опоры X (в изображении)', default: 10 }),
      P('pos_y', 'number', { label: 'Точка опоры Y (в изображении)', default: 150 }),
      P('path', 'asset', { label: 'Изображение стрелки' }),
      P('cover_path', 'asset', { label: 'Изображение накладки', optional: true }),
      // --- Ход стрелки -------------------------------------------------
      // TICK   — штатное поведение TIME_POINTER: один скачок в секунду.
      // SMOOTH — плавный «sweep»: TIME_POINTER не умеет этого сам, поэтому
      //          экспортёр рисует секундную стрелку отдельным IMG-виджетом
      //          и крутит его вручную по таймеру из '@zos/timer'. Свойство
      //          поворота IMG (angle/center_x/center_y) не подтверждено
      //          цитатой из офиц. документации → помечено ⚠ (unverified).
      P('motion', 'select', {
        label: 'Ход стрелки',
        options: [
          { value: 'TICK', label: 'Тик — 1 скачок в секунду (штатный TIME_POINTER)' },
          { value: 'SMOOTH', label: '⚠ Плавный ход — ручная анимация по таймеру' },
        ],
        default: 'TICK',
      }),
      P('smooth_fps', 'number', {
        label: 'Частота кадров плавного хода, к/с',
        default: 20, min: 5, max: 60, confidence: 'unverified',
      }),
      P('smooth_step_deg', 'number', {
        label: 'Мин. шаг поворота, ° (0 — без ограничения)',
        default: 0, min: 0, max: 6,
      }),
    ],
    dataBindable: true, dataSource: 'TIME_POINTER_SECOND',
    defaultSize: { w: 20, h: 260 },
    single: true, group: 'time_pointer',
  },
};

// Все текстовые компоненты получают единый набор типографики. Свойство `font`
// хранит id встроенного в проект файла шрифта; exporter заменяет его на путь.
// weight/style/spacing/line-height используются в предпросмотре браузера.
for (const def of Object.values(REGISTRY)) {
  if (def.widgetId !== 'TEXT') continue;
  const keys = new Set(def.properties.map((p) => p.key));
  if (!keys.has('font')) def.properties.push(P('font', 'font', { label: 'Шрифт', optional: true }));
  if (!keys.has('font_weight')) def.properties.push(P('font_weight', 'select', {
    label: 'Жирность', options: [
      { value: '400', label: 'Обычный' }, { value: '500', label: 'Средний' },
      { value: '600', label: 'Полужирный' }, { value: '700', label: 'Жирный' },
      { value: '800', label: 'Очень жирный' }
    ], default: '400'
  }));
  if (!keys.has('font_style')) def.properties.push(P('font_style', 'select', {
    label: 'Наклон', options: [
      { value: 'normal', label: 'Обычный' }, { value: 'italic', label: 'Курсив' },
      { value: 'oblique', label: 'Наклонный' }
    ], default: 'normal'
  }));
  if (!keys.has('letter_spacing')) def.properties.push(P('letter_spacing', 'number', {
    label: 'Межбуквенный интервал, px', default: 0, min: -10, max: 20
  }));
  if (!keys.has('line_height')) def.properties.push(P('line_height', 'number', {
    label: 'Высота строки, ×', default: 1, min: 0.5, max: 3
  }));
}

// ---------------------------------------------------------------------------
// PROPERTY_HINTS — текст всплывающих подсказок для полей Inspector.
// Ключ — имя свойства (см. P(...) в определениях компонентов). Подсказка
// объясняет, что поле означает на устройстве и в каких единицах задаётся;
// у компонента подсказку можно переопределить, передав tip в опциях P().
// ---------------------------------------------------------------------------
const PROPERTY_HINTS = {
  x: 'Левый край виджета в пикселях экрана, считая от левого края циферблата. Те же координаты попадут в createWidget({ x: ... }).',
  y: 'Верхний край виджета в пикселях экрана, считая от верха циферблата.',
  w: 'Ширина области виджета в пикселях. Для текста это рамка, внутри которой работает выравнивание align_h.',
  h: 'Высота области виджета в пикселях. Для текста это рамка, внутри которой работает выравнивание align_v.',

  center_x: 'Ось вращения стрелки на ЭКРАНЕ: X центра циферблата в пикселях (для экрана 480×480 это обычно 240).',
  center_y: 'Ось вращения стрелки на ЭКРАНЕ: Y центра циферблата в пикселях (для экрана 480×480 это обычно 240).',
  pos_x: 'Точка опоры ВНУТРИ картинки стрелки: сколько пикселей от ЛЕВОГО края изображения до оси вращения. Для симметричной стрелки шириной 20 px это 10.',
  pos_y: 'Точка опоры ВНУТРИ картинки стрелки: сколько пикселей от ВЕРХНЕГО края изображения до оси вращения. Обычно это длина стрелки от кончика до центра циферблата.',
  path: 'PNG-изображение стрелки из панели «Ресурсы». Рисуйте стрелку вертикально, кончиком вверх — поворот на 0° соответствует 12 часам.',
  cover_path: 'Необязательная накладка поверх стрелок — например, декоративная гайка в центре циферблата.',
  motion: 'Тик — штатное поведение TIME_POINTER: один скачок в секунду, дёшево по батарее. Плавный ход — непрерывное вращение; стрелка выносится в отдельный виджет IMG и крутится вручную по таймеру (помечено ⚠, проверьте в симуляторе).',
  smooth_fps: 'Сколько раз в секунду пересчитывается угол при плавном ходе. 15–20 к/с выглядят плавно; больше — заметно дороже по батарее. Работает только в режиме «Плавный ход».',
  smooth_step_deg: 'Квантование угла в градусах: 0 — максимально плавно, 0.5–1 — экономнее (стрелка двигается мелкими ступеньками). Работает только в режиме «Плавный ход».',

  color: 'Цвет элемента. При экспорте переводится в формат Zepp OS 0xRRGGBB.',
  text_size: 'Высота шрифта в пикселях устройства — ровно то же число, что увидит createWidget({ text_size }). В редакторе текст показан 1:1.',
  align_h: 'Горизонтальное выравнивание текста внутри рамки W: LEFT / CENTER_H / RIGHT (hmUI.align.*).',
  align_v: 'Вертикальное выравнивание текста внутри рамки H: TOP / CENTER_V / BOTTOM (hmUI.align.*).',
  text_style: 'Поведение длинной строки: NONE — обрезать, WRAP — перенос, SCROLL — бегущая строка (hmUI.text_style.*).',
  font: 'Встроенный в проект файл шрифта. После экспорта он копируется в assets/<target>/fonts/.',
  font_weight: 'Жирность предпросмотра. Для устройства фактическая жирность определяется выбранным файлом шрифта.',
  font_style: 'Наклон предпросмотра. Для устройства используйте файл шрифта с соответствующим начертанием.',
  letter_spacing: 'Межбуквенный интервал предпросмотра в пикселях. Zepp TEXT не гарантирует поддержку этого параметра.',
  line_height: 'Высота строки в предпросмотре. Для однострочного текста обычно оставляйте 1.',
  alpha: 'Непрозрачность 0–100 %. Поддержка на части прошивок подтверждена не для всех виджетов.',

  text: 'Статический текст. Если выбран источник данных, это поле игнорируется — значение подставляется автоматически.',
  format: 'Шаблон вывода значения. Форматирование выполняет сгенерированная helper-функция в index.js, а не сам виджет.',
  prefix: 'Строка перед значением, например «♥ ». Подставляется при каждом обновлении данных.',
  suffix: 'Строка после значения, например «%» или « шагов».',
  unit: 'Единица измерения, дописываемая к значению (км/мили, °C/°F).',
  src: 'Файл изображения из панели «Ресурсы». При экспорте попадёт в assets/<устройство>/ под этим же именем.',
  data_source: 'Живые данные, которыми заполняется текст: время, дата, батарея, пульс, шаги и т.д. Для каждого источника ниже появляется свой набор настроек.',

  radius: 'Радиус в пикселях. Для круга — от центра до края, для скруглённого прямоугольника — радиус углов.',
  line_width: 'Толщина линии контура в пикселях.',
  time_format: 'Шаблон времени: HH — 24-часовой формат, hh — 12-часовой (тогда рядом обычно ставят отдельный текст AM/PM). Вариант с :SS обновляется каждую секунду.',
  time_leading_zero: 'Показывать ли ноль перед часами: 09:05 против 9:05. На минуты не влияет.',
  time_separator: 'Разделитель между часами и минутами — обычно «:», но можно поставить точку или пробел.',
  ampm_case: 'Регистр индикатора: AM/PM или am/pm.',
  date_format: 'Порядок и вид частей даты. Собирается helper-функцией в сгенерированном index.js.',
  date_locale: 'Язык названий месяцев (EN/RU) для форматов с MMM и MMMM.',
  weekday_format: 'EEE — сокращение (Пн), EEE3 — 3 буквы (ПОН), EEEE — полное название (Понедельник).',
  weekday_locale: 'Язык названий дней недели (EN/RU).',
  battery_low_threshold: 'Порог низкого заряда в процентах — ниже него значение можно подсветить своим кодом в блоке USER ANIMATION CODE.',
  heart_min_valid: 'Минимальное правдоподобное значение пульса. Всё ниже считается «нет данных» и показывается как «--» — датчик отдаёт нули, когда часы сняты с руки.',
  step_thousands_sep: 'Разделять ли тысячи пробелом: 8 452 против 8452.',
  calorie_decimals: 'Сколько знаков после запятой показывать у калорий. 0 — целое число.',
  distance_unit: 'Единица дистанции: км или мили. Конвертация приближённая — исходная единица датчика официально не подтверждена (⚠).',
  distance_decimals: 'Сколько знаков после запятой у дистанции. Обычно 1–2.',
  weather_unit: 'Шкала температуры: °C или °F. Датчик отдаёт °C, пересчёт выполняет сгенерированный код.',
  weather_temp_source: 'Что показывать: CURRENT — текущая температура, HIGH — максимум, LOW — минимум. Значение берётся нативным weather data binding Zepp OS.',
  unit: 'Единица измерения значения.',
  weather_show_degree: 'Дописывать ли знак градуса к числу температуры.',

  hour_format: 'HH — 24-часовой формат, hh — 12-часовой (тогда рядом обычно ставят отдельный текст AM/PM).',
  hour_leading_zero: 'Показывать ли ноль перед часами: 09 против 9.',
  minute_leading_zero: 'Показывать ли ноль перед минутами: 05 против 5. Обычно оставляют включённым.',
  second_leading_zero: 'Показывать ли ноль перед секундами: 05 против 5. Обычно оставляют включённым.',
  day_leading_zero: 'Показывать ли ноль перед числом месяца: 03 против 3.',
  month_format: 'MM/M — число месяца (с ведущим нулём или без), MMM/MMMM — короткое или полное название.',
  month_locale: 'Язык названия месяца (EN/RU) — влияет только на форматы MMM/MMMM.',
  year_format: 'YYYY — год из 4 цифр (2026), YY — из 2 (26).',

  start_angle: 'Начальный угол дуги в градусах. 0° — направление «на 3 часа», отсчёт по часовой стрелке.',
  end_angle: 'Конечный угол дуги в градусах; дуга рисуется от начального угла по часовой стрелке.',

  tap_action: 'Что произойдёт при тапе по этому компоненту. «Ничего» — тап не обрабатывается (поля ниже скрыты). «Встроенное приложение из списка» — открыть один из штатных экранов часов (пульс, погода, тренировка и т.д.) — ниже появится список. «Другое приложение» — открыть произвольное приложение вручную по его App ID — ниже появятся поля App ID и путь.',
  tap_metric: 'Штатный экран часов, который откроется по тапу. Список закрытый — это системные экраны Zepp OS, а не установленные пользователем приложения.',
  tap_x: 'Левая координата прозрачной тап-зоны относительно верхнего левого угла экрана. Если не задано, используется прямоугольник компонента.',
  tap_y: 'Верхняя координата прозрачной тап-зоны относительно верхнего левого угла экрана. Если не задано, используется прямоугольник компонента.',
  tap_w: 'Ширина прозрачной тап-зоны. Если не задана, берётся ширина компонента.',
  tap_h: 'Высота прозрачной тап-зоны. Если не задана, берётся высота компонента.',
  tap_app_id: 'Числовой App ID целевого приложения (обычно — вашего собственного второго приложения в том же проекте, id указывается в app.json этого приложения). Без верного App ID переход при экспорте не сработает.',
  tap_app_url: 'Путь до страницы внутри целевого приложения, например «pages/index». Соответствует полю url у createWidget → click_func → launchApp({ appId, url }).',
};

function hintForProperty(p) {
  if (!p) return '';
  if (p.tip) return p.tip;
  return PROPERTY_HINTS[p.key] || '';
}

// ---------------------------------------------------------------------------
// WEATHER_ICON_SET — полный набор из 29 погодных состояний (weather index 0..28).
//
// ⚠ ВАЖНО насчёт достоверности источника: официальной цитируемой таблицы
// hmUI.data_type.WEATHER_ICON / полного списка иконок на docs.zepp.com не
// найдено (см. ZEPP_API_COMPONENTS.md, раздел "Данные"). Этот список —
// не выдумка Designer, а константы из реального открытого кода проекта
// Gadgetbridge (ZeppOsWeatherHandler.java), которые сверены с фактическими
// ответами API Zepp OS в реальном устройстве (Amazfit GTR 4), а не взяты
// из документации:
//   https://codeberg.org/Freeyourgadget/Gadgetbridge/src/branch/master/app/src/main/java/nodomain/freeyourgadget/gadgetbridge/service/devices/huami/zeppos/ZeppOsWeatherHandler.java
// Это более полный и достоверный список, чем прежние 11 "придуманных по
// аналогии" условий (sunny/cloudy/rain/...), но статус — 🟡 подтверждено
// реверс-инжинирингом реального трафика устройства, НЕ официальной
// документацией. Индексы соответствуют порядковому номеру в реальном API
// (0 = Sunny ... 33 = Snow) — при экспорте используются как имена файлов
// assets/.../weather/<id>.png.
const WEATHER_ICON_SET = [
  { id: 'cloudy', label: 'Облачно', glyph: '☁', index: 0 },
  { id: 'showers', label: 'Ливни', glyph: '☔', index: 1 },
  { id: 'snow_showers', label: 'Снегопад', glyph: '❄', index: 2 },
  { id: 'sunny', label: 'Солнечно', glyph: '☀', index: 3 },
  { id: 'overcast', label: 'Пасмурно', glyph: '☁', index: 4 },
  { id: 'light_rain', label: 'Небольшой дождь', glyph: '🌧', index: 5 },
  { id: 'light_snow', label: 'Небольшой снег', glyph: '❄', index: 6 },
  { id: 'moderate_rain', label: 'Умеренный дождь', glyph: '🌧', index: 7 },
  { id: 'moderate_snow', label: 'Умеренный снег', glyph: '❄', index: 8 },
  { id: 'heavy_snow', label: 'Сильный снег', glyph: '❄', index: 9 },
  { id: 'heavy_rain', label: 'Сильный дождь', glyph: '🌧', index: 10 },
  { id: 'sandstorm', label: 'Песчаная буря', glyph: '🌪', index: 11 },
  { id: 'rain_snow', label: 'Дождь со снегом', glyph: '🌨', index: 12 },
  { id: 'fog', label: 'Туман', glyph: '🌫', index: 13 },
  { id: 'hazy', label: 'Мгла', glyph: '🌫', index: 14 },
  { id: 'thunderstorm', label: 'Гроза', glyph: '⛈', index: 15 },
  { id: 'snowstorm', label: 'Метель', glyph: '❄', index: 16 },
  { id: 'floating_dust', label: 'Пыльная взвесь', glyph: '🌫', index: 17 },
  { id: 'very_heavy_rainstorm', label: 'Очень сильный ливень', glyph: '⛈', index: 18 },
  { id: 'rain_hail', label: 'Дождь с градом', glyph: '🌨', index: 19 },
  { id: 'thunderstorm_hail', label: 'Гроза с градом', glyph: '⛈', index: 20 },
  { id: 'heavy_rainstorm', label: 'Сильный ливень', glyph: '⛈', index: 21 },
  { id: 'dust', label: 'Пыль', glyph: '🌫', index: 22 },
  { id: 'heavy_sandstorm', label: 'Сильная песчаная буря', glyph: '🌪', index: 23 },
  { id: 'rainstorm', label: 'Ливень', glyph: '🌧', index: 24 },
  { id: 'unknown', label: 'Неизвестно', glyph: '?', index: 25 },
  { id: 'cloudy_night', label: 'Облачно ночью', glyph: '☾', index: 26 },
  { id: 'showers_night', label: 'Ливни ночью', glyph: '☔', index: 27 },
  { id: 'sunny_night', label: 'Ясно ночью', glyph: '☾', index: 28 },
];


// Обратная совместимость: проекты, сохранённые до этого обновления, могли
// содержать старые "придуманные по аналогии" id погодных условий. Не ломаем
// такие файлы при загрузке — сопоставляем их с ближайшим id из нового
// подтверждённого набора.
const WEATHER_ICON_LEGACY_ALIASES = {
  some_clouds: 'cloudy', partly_cloudy: 'cloudy', rain: 'moderate_rain', wind: 'floating_dust',
  night_clear: 'sunny_night', night_cloudy: 'cloudy_night', hail: 'rain_hail', sleet: 'rain_snow',
  rain_with_sun: 'showers', rainstorm: 'rainstorm', dense_fog: 'fog', snow: 'moderate_snow',
};

function normalizeWeatherIconId(id) {
  if (!id) return id;
  if (WEATHER_ICON_SET.some((w) => w.id === id)) return id;
  return WEATHER_ICON_LEGACY_ALIASES[id] || id;
}

// Эффективный источник данных для компонента-инстанса: у "жёстких" пресетов
// (time_hm, battery, heart_rate, ...) он фиксирован в def.dataSource; у
// универсального "text" — выбирается динамически через comp.props.data_source.
function getEffectiveDataSource(comp, def) {
  if (!def) return null;
  if (def.dataBindable && def.dataSource) return def.dataSource;
  if (def.dataSourceSelectable) {
    const v = comp && comp.props && comp.props.data_source;
    if (v && v !== 'NONE') return v;
  }
  return null;
}


// Общие настройки действия по тапу для ЛЮБОГО компонента.
// Реальный обработчик создаётся экспортёром отдельной прозрачной BUTTON-зоной:
// это надёжнее, чем полагаться на click_func у TEXT/IMG/CIRCLE и других виджетов.
const TAP_ACTION_PROPERTIES = [
  P('tap_action', 'select', {
    label: 'Открытие по тапу',
    options: [
      { value: 'NONE', label: 'Ничего (тап не обрабатывается)' },
      { value: 'METRIC', label: 'Встроенное приложение из списка' },
      { value: 'APP', label: 'Другое приложение (вручную по App ID)' },
    ],
    default: 'NONE',
  }),
  P('tap_x', 'number', { label: 'X тап-зоны', default: 0, min: 0, max: 10000 }),
  P('tap_y', 'number', { label: 'Y тап-зоны', default: 0, min: 0, max: 10000 }),
  P('tap_w', 'number', { label: 'Ширина тап-зоны', default: 0, min: 0, max: 10000 }),
  P('tap_h', 'number', { label: 'Высота тап-зоны', default: 0, min: 0, max: 10000 }),
  P('tap_metric', 'select', {
    label: 'Какое встроенное приложение открыть',
    options: [
      { value: 'STATUS', label: 'Активность' },
      { value: 'HR', label: 'Пульс' },
      { value: 'SPORT', label: 'Тренировка' },
      { value: 'WEATHER', label: 'Погода' },
      { value: 'SPORT_HISTORY', label: 'История тренировок' },
      { value: 'PAI', label: 'PAI' },
      { value: 'SLEEP', label: 'Сон' },
      { value: 'SPO2', label: 'Кислород крови' },
      { value: 'CALENDAR', label: 'Календарь' },
      { value: 'MEASUREMENT', label: 'Измерение' },
      { value: 'READINESS', label: 'Готовность' },
    ],
    default: 'STATUS',
  }),
  P('tap_app_id', 'number', { label: 'App ID приложения', default: 0, min: 0, max: 999999999 }),
  P('tap_app_url', 'text', { label: 'Путь / URL приложения', default: 'pages/index' }),
];

// Не меняем существующие проекты: старые компоненты получают значения по умолчанию
// только при открытии/экспорте, а новые компоненты сразу содержат эти свойства.
for (const def of Object.values(REGISTRY)) {
  if (!def.properties.some((x) => x.key === 'tap_action')) {
    def.properties.push(...TAP_ACTION_PROPERTIES.map((x) => ({ ...x, options: x.options ? x.options.map(o => ({...o})) : undefined })));
  }
}

function getComponentDef(componentId) {
  return REGISTRY[componentId];
}

function listByCategory() {
  const map = {};
  for (const cat of CATEGORIES) map[cat] = [];
  for (const key of Object.keys(REGISTRY)) {
    map[REGISTRY[key].category].push(REGISTRY[key]);
  }
  return map;
}
