/* Football Coaching Planner – PDF maker
   Builds real PDF files in the browser with no outside library, so nothing extra has to be
   installed and nothing is sent anywhere. Text uses the standard Helvetica font built into
   every PDF reader; drill pictures are placed in the file exactly as they are.

   Used by app.js:  PlanPdf.save(data, 'file name.pdf')  ->  Promise
*/
(function () {
  'use strict';

  var PAGE_W = 595.28, PAGE_H = 841.89;   // A4 in points
  var MARGIN = 40, CONTENT_W = PAGE_W - MARGIN * 2, BOTTOM = PAGE_H - 48;
  var INK = [0.11, 0.14, 0.13], GREY = [0.36, 0.40, 0.37], GREEN = [0.11, 0.42, 0.18], LINE = [0.78, 0.82, 0.78], TINT = [0.90, 0.95, 0.91];

  // Character widths (per 1000 units) for codes 32-255: F1 = Helvetica, F2 = Helvetica-Bold.
  var WIDTHS = {
    F1: [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584,761,556,0,222,556,333,1000,556,556,333,1000,667,333,1000,0,611,0,0,222,222,333,333,350,556,1000,333,1000,500,333,944,0,500,667,278,333,556,556,556,556,260,556,333,737,370,556,584,333,737,333,400,584,333,333,333,556,537,278,333,333,365,556,834,834,834,611,667,667,667,667,667,667,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,500,556,556,556,556,278,278,278,278,556,556,556,556,556,556,556,584,611,556,556,556,556,500,556,500],
    F2: [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584,761,556,0,278,556,500,1000,556,556,333,1000,667,333,1000,0,611,0,0,278,278,500,500,350,556,1000,333,1000,556,333,944,0,500,667,278,333,556,556,556,556,280,556,333,737,370,556,584,333,737,333,400,584,333,333,333,611,556,278,333,333,365,556,834,834,834,611,722,722,722,722,722,722,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,556,556,556,556,556,278,278,278,278,611,611,611,611,611,611,611,584,611,611,611,611,611,556,611,556]
  };

  /* ---------- Text encoding (Windows-1252, which the built-in fonts understand) ---------- */
  var SPECIAL = { 0x2018: 0x91, 0x2019: 0x92, 0x201C: 0x93, 0x201D: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x2026: 0x85, 0x20AC: 0x80, 0x00A0: 0x20 };
  var SPELL = { 0x2192: '->', 0x2190: '<-', 0x2194: '<->', 0x2265: '>=', 0x2264: '<=', 0x2605: '*', 0x2B50: '*', 0x2713: 'v' };
  function encode(str) {
    var out = [];
    str = String(str == null ? '' : str);
    for (var i = 0; i < str.length; i++) {
      var c = str.codePointAt(i);
      if (c > 0xFFFF) i++;
      if (c === 9) c = 32;
      if ((c >= 32 && c < 127) || (c >= 161 && c <= 255)) out.push(c);
      else if (SPECIAL[c]) out.push(SPECIAL[c]);
      else if (SPELL[c]) { for (var k = 0; k < SPELL[c].length; k++) out.push(SPELL[c].charCodeAt(k)); }
      else if (c === 0xFE0F || c < 32) { /* invisible: skip */ }
      else out.push(63);   // "?"
    }
    return out;
  }
  function widthOf(codes, font, size) {
    var w = 0, table = WIDTHS[font];
    for (var i = 0; i < codes.length; i++) w += table[codes[i] - 32] || 556;
    return w * size / 1000;
  }
  function textWidth(str, font, size) { return widthOf(encode(str), font, size); }

  // Split text into lines that fit a width. Returns an array of strings.
  function wrap(str, font, size, maxW) {
    var lines = [];
    String(str == null ? '' : str).split('\n').forEach(function (para) {
      var words = para.split(/\s+/).filter(Boolean), line = '';
      if (!words.length) { lines.push(''); return; }
      words.forEach(function (word) {
        while (textWidth(word, font, size) > maxW && word.length > 1) {   // a single very long word
          var cut = word.length - 1;
          while (cut > 1 && textWidth(word.slice(0, cut), font, size) > maxW) cut--;
          if (line) { lines.push(line); line = ''; }
          lines.push(word.slice(0, cut)); word = word.slice(cut);
        }
        var test = line ? line + ' ' + word : word;
        if (textWidth(test, font, size) <= maxW) line = test;
        else { lines.push(line); line = word; }
      });
      lines.push(line);
    });
    return lines;
  }

  /* ---------- A very small PDF writer ---------- */
  function Pdf() { this.pages = []; this.images = []; this.addPage(); }
  Pdf.prototype.addPage = function () { this.ops = []; this.pages.push(this.ops); };
  function n(v) { return (Math.round(v * 100) / 100).toString(); }
  function rgb(c) { return n(c[0]) + ' ' + n(c[1]) + ' ' + n(c[2]); }
  Pdf.prototype.text = function (str, x, y, font, size, color) {
    var codes = encode(str), hex = '';
    for (var i = 0; i < codes.length; i++) hex += (codes[i] < 16 ? '0' : '') + codes[i].toString(16);
    this.ops.push('BT /' + font + ' ' + n(size) + ' Tf ' + rgb(color || INK) + ' rg 1 0 0 1 ' + n(x) + ' ' + n(PAGE_H - y) + ' Tm <' + hex + '> Tj ET');
  };
  Pdf.prototype.rect = function (x, y, w, h, fill, stroke) {
    var op = (fill ? rgb(fill) + ' rg ' : '') + (stroke ? rgb(stroke) + ' RG 0.6 w ' : '') +
      n(x) + ' ' + n(PAGE_H - y - h) + ' ' + n(w) + ' ' + n(h) + ' re ' + (fill && stroke ? 'B' : fill ? 'f' : 'S');
    this.ops.push(op);
  };
  Pdf.prototype.line = function (x1, y1, x2, y2, color, width) {
    this.ops.push(rgb(color || LINE) + ' RG ' + n(width || 0.6) + ' w ' + n(x1) + ' ' + n(PAGE_H - y1) + ' m ' + n(x2) + ' ' + n(PAGE_H - y2) + ' l S');
  };
  // bytes: the JPEG file itself (Uint8Array); pxW/pxH: its size in pixels.
  Pdf.prototype.image = function (bytes, pxW, pxH, x, y, w, h) {
    this.images.push({ bytes: bytes, w: pxW, h: pxH });
    this.ops.push('q ' + n(w) + ' 0 0 ' + n(h) + ' ' + n(x) + ' ' + n(PAGE_H - y - h) + ' cm /Im' + this.images.length + ' Do Q');
  };
  Pdf.prototype.build = function (footer) {
    var chunks = [], offsets = [], length = 0, self = this;
    function ascii(s) { var a = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) a[i] = s.charCodeAt(i) & 255; return a; }
    function put(part) { var a = typeof part === 'string' ? ascii(part) : part; chunks.push(a); length += a.length; }
    function obj(num, body, stream) {
      offsets[num] = length;
      put(num + ' 0 obj\n' + body + '\n');
      if (stream) { put('stream\n'); put(stream); put('\nendstream\n'); }
      put('endobj\n');
    }
    var firstImage = 5, firstPage = firstImage + this.images.length, total = firstPage + this.pages.length * 2 - 1;
    put('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
    var kids = this.pages.map(function (p, i) { return (firstPage + i * 2) + ' 0 R'; }).join(' ');
    obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
    obj(2, '<< /Type /Pages /Kids [' + kids + '] /Count ' + this.pages.length + ' >>');
    obj(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    obj(4, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    this.images.forEach(function (im, i) {
      obj(firstImage + i, '<< /Type /XObject /Subtype /Image /Width ' + im.w + ' /Height ' + im.h +
        ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + im.bytes.length + ' >>', im.bytes);
    });
    var xobjects = this.images.map(function (im, i) { return '/Im' + (i + 1) + ' ' + (firstImage + i) + ' 0 R'; }).join(' ');
    this.pages.forEach(function (ops, i) {
      if (footer) {
        var keep = self.ops; self.ops = ops;
        self.text(footer + '  ·  page ' + (i + 1) + ' of ' + self.pages.length, MARGIN, PAGE_H - 24, 'F1', 8, GREY);
        self.ops = keep;
      }
      var content = ascii(ops.join('\n'));
      obj(firstPage + i * 2, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + PAGE_W + ' ' + PAGE_H + '] /Contents ' + (firstPage + i * 2 + 1) +
        ' 0 R /Resources << /Font << /F1 3 0 R /F2 4 0 R >> /XObject << ' + xobjects + ' >> >> >>');
      obj(firstPage + i * 2 + 1, '<< /Length ' + content.length + ' >>', content);
    });
    var xref = length, table = 'xref\n0 ' + (total + 1) + '\n0000000000 65535 f \n';
    for (var k = 1; k <= total; k++) table += ('0000000000' + offsets[k]).slice(-10) + ' 00000 n \n';
    put(table + 'trailer\n<< /Size ' + (total + 1) + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF\n');
    return new Blob(chunks, { type: 'application/pdf' });
  };

  /* ---------- Laying out a plan and drill sheets ---------- */
  function layout(data, pictures) {
    var pdf = new Pdf(), y = MARGIN, fresh = true;
    function newPage() { pdf.addPage(); y = MARGIN; fresh = true; }
    function need(h) { if (y + h > BOTTOM) { newPage(); return true; } return false; }
    function para(str, font, size, color, x, w, gap) {
      wrap(str, font, size, w).forEach(function (ln) { need(size * 1.3); pdf.text(ln, x, y + size, font, size, color); y += size * 1.3; });
      y += gap || 0; fresh = false;
    }

    if (data.title) { para(data.title, 'F2', 18, INK, MARGIN, CONTENT_W, 2); }
    if (data.subtitle) { para(data.subtitle, 'F1', 10, GREY, MARGIN, CONTENT_W, 8); }

    // Weekly session tables
    var COLS = [22, 150, 68, CONTENT_W - 240], HEAD = ['#', 'Drill', 'Time', 'Coaching points'];
    function tableHead() {
      pdf.rect(MARGIN, y, CONTENT_W, 18, TINT, LINE);
      var x = MARGIN;
      HEAD.forEach(function (h, i) { pdf.text(h, x + 4, y + 12.5, 'F2', 9, INK); x += COLS[i]; });
      y += 18;
    }
    (data.weeks || []).forEach(function (wk) {
      need(70);
      y += 6;
      pdf.text(wk.heading, MARGIN, y + 13, 'F2', 13, GREEN);
      if (wk.date) pdf.text(wk.date, MARGIN + CONTENT_W - textWidth(wk.date, 'F1', 9.5), y + 13, 'F1', 9.5, GREY);
      y += 19; pdf.line(MARGIN, y, MARGIN + CONTENT_W, y, GREEN, 1.4); y += 6; fresh = false;
      if (!wk.rows.length) { para('No drills chosen.', 'F1', 9.5, GREY, MARGIN, CONTENT_W, 6); return; }
      tableHead();
      wk.rows.forEach(function (r, i) {
        var name = wrap(r.name, 'F2', 9.5, COLS[1] - 8), sub = wrap(r.sub, 'F1', 8, COLS[1] - 8),
            time = wrap(r.time, 'F1', 9, COLS[2] - 8), pts = wrap(r.points, 'F1', 9, COLS[3] - 8);
        var h = Math.max(name.length * 11.5 + sub.length * 10, pts.length * 11, time.length * 11) + 8;
        if (need(h)) tableHead();
        var x = MARGIN, top = y;
        pdf.text(String(i + 1), x + 4, top + 12.5, 'F1', 9, INK); x += COLS[0];
        var ty = top + 12.5;
        name.forEach(function (ln) { pdf.text(ln, x + 4, ty, 'F2', 9.5, INK); ty += 11.5; });
        sub.forEach(function (ln) { pdf.text(ln, x + 4, ty - 1, 'F1', 8, GREY); ty += 10; });
        x += COLS[1];
        time.forEach(function (ln, k) { pdf.text(ln, x + 4, top + 12.5 + k * 11, 'F1', 9, INK); }); x += COLS[2];
        pts.forEach(function (ln, k) { pdf.text(ln, x + 4, top + 12.5 + k * 11, 'F1', 9, INK); });
        pdf.rect(MARGIN, top, CONTENT_W, h, null, LINE);
        var vx = MARGIN;
        for (var c = 0; c < 3; c++) { vx += COLS[c]; pdf.line(vx, top, vx, top + h); }
        y += h;
      });
      y += 5;
      if (wk.total) para(wk.total, 'F2', 9.5, INK, MARGIN, CONTENT_W, 2);
      if (wk.notes) para('Notes: ' + wk.notes, 'F1', 9.5, INK, MARGIN, CONTENT_W, 2);
      y += 10;
    });

    // One page (or more) per drill
    (data.sheets || []).forEach(function (s, index) {
      if (!fresh) newPage();
      para(s.title, 'F2', 16, INK, MARGIN, CONTENT_W, 0);
      para(s.facts, 'F1', 9.5, GREY, MARGIN, CONTENT_W, 6);
      var bytes = pictures[index];
      if (bytes) {
        var w = CONTENT_W, h = w * s.imgH / s.imgW;
        if (h > 300) { h = 300; w = h * s.imgW / s.imgH; }
        pdf.image(bytes, s.imgW, s.imgH, MARGIN + (CONTENT_W - w) / 2, y, w, h);
        y += h + 10;
      }
      var LABEL = 100, size = 9, lh = 11.5;
      s.fields.forEach(function (f) {
        var label = wrap(f[0], 'F2', size, LABEL - 8), value = wrap(f[1], 'F1', size, CONTENT_W - LABEL);
        need(lh + 6);
        pdf.line(MARGIN, y, MARGIN + CONTENT_W, y); y += 3;
        var rows = Math.max(label.length, value.length);
        for (var i = 0; i < rows; i++) {
          need(lh);
          if (label[i]) pdf.text(label[i], MARGIN, y + size, 'F2', size, INK);
          if (value[i] !== undefined) pdf.text(value[i], MARGIN + LABEL, y + size, 'F1', size, INK);
          y += lh;
        }
        y += 3;
      });
      fresh = false;
    });
    return pdf.build(data.footer || '');
  }

  function download(blob, filename) {
    var url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  // Fetch the picture files. This fails when the site is opened straight from a folder
  // (file://) because browsers block it there; the PDF is then made without pictures.
  function loadPictures(sheets) {
    return Promise.all((sheets || []).map(function (s) {
      if (!s.img || location.protocol === 'file:') return null;
      return fetch(s.img).then(function (r) { return r.ok ? r.arrayBuffer() : null; })
        .then(function (buf) { return buf ? new Uint8Array(buf) : null; })
        .catch(function () { return null; });
    }));
  }

  function save(data, filename) {
    return loadPictures(data.sheets).then(function (pictures) {
      var blob = layout(data, pictures);
      download(blob, filename);
      var missing = pictures.filter(function (p, i) { return !p && data.sheets[i].img; }).length;
      return { pages: null, missingPictures: missing, size: blob.size };
    });
  }

  window.PlanPdf = { save: save, _layout: layout };
})();
