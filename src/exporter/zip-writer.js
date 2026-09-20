// src/exporter/zip-writer.js
//
// Минимальный ZIP-архиватор без внешних зависимостей (метод STORE, без сжатия).
// Работает в браузере (в т.ч. открытом напрямую через file://) без сборки и CDN.
// Формирует корректный .zip: локальные заголовки файлов + центральный каталог + EOCD.

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC32_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date) {
  const dosTime = ((date.getHours() & 0x1f) << 11) | ((date.getMinutes() & 0x3f) << 5) | ((date.getSeconds() >> 1) & 0x1f);
  const dosDate = (((date.getFullYear() - 1980) & 0x7f) << 9) | (((date.getMonth() + 1) & 0xf) << 5) | (date.getDate() & 0x1f);
  return { dosTime, dosDate };
}

function utf8Bytes(str) {
  return new TextEncoder().encode(str);
}

class ByteWriter {
  constructor() { this.chunks = []; this.length = 0; }
  pushU8(v) { this.chunks.push(new Uint8Array([v & 0xff])); this.length += 1; }
  pushU16(v) { const b = new Uint8Array(2); b[0] = v & 0xff; b[1] = (v >>> 8) & 0xff; this.chunks.push(b); this.length += 2; }
  pushU32(v) { const b = new Uint8Array(4); b[0] = v & 0xff; b[1] = (v >>> 8) & 0xff; b[2] = (v >>> 16) & 0xff; b[3] = (v >>> 24) & 0xff; this.chunks.push(b); this.length += 4; }
  pushBytes(bytes) { this.chunks.push(bytes); this.length += bytes.length; }
  toUint8Array() {
    const out = new Uint8Array(this.length);
    let offset = 0;
    for (const c of this.chunks) { out.set(c, offset); offset += c.length; }
    return out;
  }
}

class ZipWriter {
  constructor() {
    this.files = []; // { name, data: Uint8Array }
  }

  /**
   * @param {string} path - путь внутри архива, всегда с '/' (например 'assets/x/icon.png')
   * @param {Uint8Array|string} data - бинарные данные файла или текст (будет закодирован в UTF-8)
   */
  addFile(path, data) {
    const bytes = typeof data === 'string' ? utf8Bytes(data) : data;
    this.files.push({ name: path.replace(/\\/g, '/'), data: bytes });
  }

  generate() {
    const now = new Date();
    const { dosTime, dosDate } = dosDateTime(now);
    const localWriter = new ByteWriter();
    const centralWriter = new ByteWriter();
    const offsets = [];

    for (const file of this.files) {
      const nameBytes = utf8Bytes(file.name);
      const crc = crc32(file.data);
      const size = file.data.length;

      offsets.push(localWriter.length);

      // Local file header
      localWriter.pushU32(0x04034b50);
      localWriter.pushU16(20);       // version needed
      localWriter.pushU16(0x0800);   // flags: bit 11 = UTF-8 filename
      localWriter.pushU16(0);        // compression: store
      localWriter.pushU16(dosTime);
      localWriter.pushU16(dosDate);
      localWriter.pushU32(crc);
      localWriter.pushU32(size);     // compressed size
      localWriter.pushU32(size);     // uncompressed size
      localWriter.pushU16(nameBytes.length);
      localWriter.pushU16(0);        // extra length
      localWriter.pushBytes(nameBytes);
      localWriter.pushBytes(file.data);
    }

    for (let i = 0; i < this.files.length; i++) {
      const file = this.files[i];
      const nameBytes = utf8Bytes(file.name);
      const crc = crc32(file.data);
      const size = file.data.length;

      centralWriter.pushU32(0x02014b50);
      centralWriter.pushU16(20);     // version made by
      centralWriter.pushU16(20);     // version needed
      centralWriter.pushU16(0x0800);
      centralWriter.pushU16(0);
      centralWriter.pushU16(dosTime);
      centralWriter.pushU16(dosDate);
      centralWriter.pushU32(crc);
      centralWriter.pushU32(size);
      centralWriter.pushU32(size);
      centralWriter.pushU16(nameBytes.length);
      centralWriter.pushU16(0);      // extra length
      centralWriter.pushU16(0);      // comment length
      centralWriter.pushU16(0);      // disk number start
      centralWriter.pushU16(0);      // internal attrs
      centralWriter.pushU32(0);      // external attrs
      centralWriter.pushU32(offsets[i]);
      centralWriter.pushBytes(nameBytes);
    }

    const eocd = new ByteWriter();
    eocd.pushU32(0x06054b50);
    eocd.pushU16(0);
    eocd.pushU16(0);
    eocd.pushU16(this.files.length);
    eocd.pushU16(this.files.length);
    eocd.pushU32(centralWriter.length);
    eocd.pushU32(localWriter.length);
    eocd.pushU16(0);

    const total = new Uint8Array(localWriter.length + centralWriter.length + eocd.length);
    total.set(localWriter.toUint8Array(), 0);
    total.set(centralWriter.toUint8Array(), localWriter.length);
    total.set(eocd.toUint8Array(), localWriter.length + centralWriter.length);
    return new Blob([total], { type: 'application/zip' });
  }
}
