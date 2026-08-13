/* ImageKit — pure-JS image encoders
   Built by MADEC. Self-contained, no external dependencies.
   Provides real encoders for GIF, ICO, and TIFF using only RGBA pixel data,
   because browsers cannot reliably encode these formats via canvas.toBlob. */

(function (global) {
  "use strict";

  /* ------------------------------------------------------------------ *
   * Shared helpers
   * ------------------------------------------------------------------ */

  function u8(n) { return [n & 0xff]; }
  function u16le(n) { return [n & 0xff, (n >>> 8) & 0xff]; }
  function u16be(n) { return [(n >>> 8) & 0xff, n & 0xff]; }
  function u32le(n) { return [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff]; }
  function u32be(n) { return [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff]; }

  function pushBytes(arr, bytes) { for (var i = 0; i < bytes.length; i++) arr.push(bytes[i]); }
  function pushStr(arr, str) { for (var i = 0; i < str.length; i++) arr.push(str.charCodeAt(i) & 0xff); }

  // Read RGBA pixels from a canvas context
  function readRGBA(ctx, w, h) {
    var img = ctx.getImageData(0, 0, w, h);
    return { data: img.data, width: w, height: h };
  }

  // ----------------------------------------------------------------
  // PNG encoder (minimal, for embedding inside ICO frames)
  // Produces a valid PNG with zlib-compressed IDAT using deflate stored blocks.
  // ----------------------------------------------------------------
  function crc32Table() {
    var t = new Uint32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  }
  var CRC_TABLE = crc32Table();
  function crc32(bytes, start, end) {
    var c = 0xffffffff;
    for (var i = start; i < end; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  function adler32(bytes) {
    var a = 1, b = 0;
    for (var i = 0; i < bytes.length; i++) { a = (a + bytes[i]) % 65521; b = (b + a) % 65521; }
    return ((b << 16) | a) >>> 0;
  }

  // Build a PNG (RGBA) as a Uint8Array using uncompressed deflate stored blocks.
  function buildPNG(rgba, w, h) {
    var out = [];
    var sig = [137, 80, 78, 71, 13, 10, 26, 10];
    pushBytes(out, sig);

    // IHDR
    var ihdr = [].concat(u32be(w), u32be(h), [8, 6, 0, 0, 0]); // 8-bit, colour type 6 (RGBA)
    var ihdrChunk = chunk("IHDR", ihdr);
    pushBytes(out, ihdrChunk);

    // IDAT — filter bytes (0 = none) per scanline + raw RGBA
    var raw = new Uint8Array(h * (1 + w * 4));
    var p = 0;
    for (var y = 0; y < h; y++) {
      raw[p++] = 0; // filter type none
      for (var x = 0; x < w; x++) {
        var idx = (y * w + x) * 4;
        raw[p++] = rgba[idx];
        raw[p++] = rgba[idx + 1];
        raw[p++] = rgba[idx + 2];
        raw[p++] = rgba[idx + 3];
      }
    }

    // zlib stream: CMF=0x78, FLG=0x01, then stored deflate blocks, then adler32
    var z = [];
    z.push(0x78); z.push(0x01);
    var offset = 0;
    while (offset < raw.length) {
      var len = Math.min(raw.length - offset, 65535);
      var last = (offset + len >= raw.length) ? 1 : 0;
      z.push(last); // BFINAL + BTYPE=00 (stored)
      z.push(len & 0xff); z.push((len >> 8) & 0xff);
      var nlen = (~len) & 0xffff;
      z.push(nlen & 0xff); z.push((nlen >> 8) & 0xff);
      for (var i = 0; i < len; i++) z.push(raw[offset + i]);
      offset += len;
    }
    var adler = adler32(raw);
    pushBytes(z, u32be(adler));

    var idatChunk = chunk("IDAT", z);
    pushBytes(out, idatChunk);

    // IEND
    pushBytes(out, chunk("IEND", []));

    return new Uint8Array(out);
  }

  function chunk(type, data) {
    var body = (data instanceof Uint8Array) ? data : new Uint8Array(data);
    var out = new Uint8Array(8 + body.length + 4);
    var dv = new DataView(out.buffer);
    dv.setUint32(0, body.length); // length
    for (var i = 0; i < type.length; i++) out[4 + i] = type.charCodeAt(i);
    out.set(body, 8);
    var crc = crc32(out, 4, 8 + body.length);
    dv.setUint32(8 + body.length, crc);
    return out;
  }

  /* ------------------------------------------------------------------ *
   * GIF encoder (GIF89a, single frame, 256-color median-cut quantization)
   * ------------------------------------------------------------------ */
  function encodeGIF(ctx, w, h) {
    return new Promise(function (resolve, reject) {
      try {
        var rgba = ctx.getImageData(0, 0, w, h).data;
        // Flatten alpha onto a checkerboard-free white if needed; GIF has 1-bit alpha.
        var hasAlpha = false;
        for (var i = 3; i < rgba.length; i += 4) {
          if (rgba[i] < 250) { hasAlpha = true; break; }
        }
        // Build palette via median cut (max 256 colors)
        var quant = medianCut(rgba, 256, hasAlpha);
        var palette = quant.palette;   // [[r,g,b]...]
        var index = quant.index;       // Uint8Array length w*h
        var transparent = quant.transparent; // index of transparent color or -1

        var out = [];
        // Header
        pushStr(out, "GIF89a");
        pushBytes(out, u16le(w));
        pushBytes(out, u16le(h));
        // Logical screen descriptor: global color table, depth 8 => 0x80|0x70|0x00
        // Global Color Table Flag=1, Color Resolution=8 (0+1), Sort=0, Size=7 (256 entries) => 0xF7
        out.push(0xF7);
        out.push(transparent >= 0 ? transparent : 0); // background color index
        out.push(0); // pixel aspect ratio

        // Global color table (256 entries)
        for (var c = 0; c < 256; c++) {
          if (c < palette.length) {
            out.push(palette[c][0], palette[c][1], palette[c][2]);
          } else {
            out.push(0, 0, 0);
          }
        }

        // Graphic Control Extension (for transparency)
        if (transparent >= 0) {
          out.push(0x21, 0xF9, 4);
          out.push(0x01); // transparent color flag set
          pushBytes(out, u16le(0)); // delay
          out.push(transparent);
          out.push(0);
        }

        // Image descriptor
        out.push(0x2C);
        pushBytes(out, u16le(0)); // left
        pushBytes(out, u16le(0)); // top
        pushBytes(out, u16le(w));
        pushBytes(out, u16le(h));
        out.push(0); // no local color table

        // LZW minimum code size
        var minCodeSize = 8;
        out.push(minCodeSize);

        // LZW encode the index stream
        var codes = lzwEncode(index, minCodeSize);
        // Write sub-blocks
        var pos = 0;
        while (pos < codes.length) {
          var block = Math.min(255, codes.length - pos);
          out.push(block);
          for (var b = 0; b < block; b++) out.push(codes[pos + b]);
          pos += block;
        }
        out.push(0); // block terminator

        // Trailer
        out.push(0x3B);

        resolve(new Blob([new Uint8Array(out)], { type: "image/gif" }));
      } catch (err) {
        reject(err);
      }
    });
  }

  // Median-cut color quantization. Returns { palette, index, transparent }.
  function medianCut(rgba, maxColors, hasAlpha) {
    var pixels = [];
    var transparent = -1;
    var n = 0;
    for (var i = 0; i < rgba.length; i += 4) {
      var a = rgba[i + 3];
      if (a < 128) {
        // transparent pixel — index handled later
        continue;
      }
      pixels.push([rgba[i], rgba[i + 1], rgba[i + 2], i >> 2]);
      n++;
    }

    if (n === 0) {
      // fully transparent image
      return { palette: [[0, 0, 0]], index: new Uint8Array(rgba.length >> 2), transparent: 0 };
    }

    // Recursively split boxes by longest channel
    var boxes = [pixels];
    while (boxes.length < maxColors) {
      // find box with greatest range
      var bestIdx = -1, bestRange = -1, bestChannel = 0;
      for (var bi = 0; bi < boxes.length; bi++) {
        if (boxes[bi].length < 2) continue;
        var ranges = channelRange(boxes[bi]);
        var max = Math.max(ranges[0], ranges[1], ranges[2]);
        if (max > bestRange) { bestRange = max; bestIdx = bi; bestChannel = ranges[0] === max ? 0 : (ranges[1] === max ? 1 : 2); }
      }
      if (bestIdx < 0) break;
      var box = boxes[bestIdx];
      box.sort(function (a, b) { return a[bestChannel] - b[bestChannel]; });
      var mid = box.length >> 1;
      var b1 = box.slice(0, mid);
      var b2 = box.slice(mid);
      boxes.splice(bestIdx, 1, b1, b2);
    }

    // Build palette + average colors
    var palette = [];
    var colorToIdx = [];
    for (var bi2 = 0; bi2 < boxes.length; bi2++) {
      var bx = boxes[bi2];
      if (!bx.length) continue;
      var r = 0, g = 0, bl = 0;
      for (var p = 0; p < bx.length; p++) { r += bx[p][0]; g += bx[p][1]; bl += bx[p][2]; }
      var idx = palette.length;
      palette.push([Math.round(r / bx.length), Math.round(g / bx.length), Math.round(bl / bx.length)]);
      for (var q = 0; q < bx.length; q++) colorToIdx[bx[q][3]] = idx;
    }

    // Add a transparent entry if needed
    if (hasAlpha) {
      transparent = palette.length;
      palette.push([0, 0, 0]);
    }

    var total = rgba.length >> 2;
    var index = new Uint8Array(total);
    for (var px = 0; px < total; px++) {
      var ai = px * 4 + 3;
      if (rgba[ai] < 128) {
        index[px] = transparent >= 0 ? transparent : 0;
      } else {
        index[px] = colorToIdx[px] != null ? colorToIdx[px] : 0;
      }
    }
    return { palette: palette, index: index, transparent: transparent };
  }

  function channelRange(box) {
    var rmin = 256, gmin = 256, bmin = 256, rmax = -1, gmax = -1, bmax = -1;
    for (var i = 0; i < box.length; i++) {
      var p = box[i];
      if (p[0] < rmin) rmin = p[0]; if (p[0] > rmax) rmax = p[0];
      if (p[1] < gmin) gmin = p[1]; if (p[1] > gmax) gmax = p[1];
      if (p[2] < bmin) bmin = p[2]; if (p[2] > bmax) bmax = p[2];
    }
    return [rmax - rmin, gmax - gmin, bmax - bmin];
  }

  // LZW encoder for GIF
  function lzwEncode(pixels, minCodeSize) {
    var clearCode = 1 << minCodeSize;
    var endCode = clearCode + 1;
    var nextCode = endCode + 1;
    var codeSize = minCodeSize + 1;
    var dict = {};
    for (var i = 0; i < clearCode; i++) dict[String.fromCharCode(i)] = i;

    var out = [];
    var bitBuf = 0, bitCount = 0;

    function emit(code) {
      bitBuf |= (code << bitCount);
      bitCount += codeSize;
      while (bitCount >= 8) { out.push(bitBuf & 0xff); bitBuf >>= 8; bitCount -= 8; }
    }

    emit(clearCode);
    var w = String.fromCharCode(pixels[0]);
    for (var k = 1; k < pixels.length; k++) {
      var c = String.fromCharCode(pixels[k]);
      var wc = w + c;
      if (dict[wc] != null) {
        w = wc;
      } else {
        emit(dict[w]);
        if (nextCode < 4096) {
          dict[wc] = nextCode++;
          if (nextCode > (1 << codeSize) && codeSize < 12) codeSize++;
        } else {
          emit(clearCode);
          dict = {};
          for (var d = 0; d < clearCode; d++) dict[String.fromCharCode(d)] = d;
          nextCode = endCode + 1;
          codeSize = minCodeSize + 1;
        }
        w = c;
      }
    }
    emit(dict[w]);
    emit(endCode);
    if (bitCount > 0) out.push(bitBuf & 0xff);
    return out;
  }

  /* ------------------------------------------------------------------ *
   * ICO encoder (multi-resolution, PNG-embedded frames)
   * Produces a high-quality .ico with several sizes for crisp display.
   * ------------------------------------------------------------------ */
  function encodeICO(sourceCanvas, w, h) {
    return new Promise(function (resolve, reject) {
      try {
        // Choose target sizes <= min(w,h) and downscale from source for crispness.
        var max = Math.min(w, h);
        var sizes = [16, 32, 48, 64, 128, 256].filter(function (s) { return s <= max; });
        if (sizes.length === 0) sizes = [16];

        var images = [];
        for (var i = 0; i < sizes.length; i++) {
          var size = sizes[i];
          var c = document.createElement("canvas");
          c.width = size; c.height = size;
          var ctx = c.getContext("2d");
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          // Cover the square so the icon fills the frame without distortion artefacts
          ctx.drawImage(sourceCanvas, 0, 0, w, h, 0, 0, size, size);
          var rgba = ctx.getImageData(0, 0, size, size).data;
          var png = buildPNG(rgba, size, size);
          images.push({ size: size, png: png });
        }

        var headerSize = 6;
        var dirEntrySize = 16;
        var offset = headerSize + dirEntrySize * images.length;

        var out = [];
        // ICONDIR
        pushBytes(out, u16le(0)); // reserved
        pushBytes(out, u16le(1));  // type 1 = icon
        pushBytes(out, u16le(images.length));

        // ICONDIRENTRY per image
        for (var j = 0; j < images.length; j++) {
          var im = images[j];
          var sz = im.size;
          out.push(sz >= 256 ? 0 : sz); // width (0 => 256)
          out.push(sz >= 256 ? 0 : sz); // height
          out.push(0); // color count (0 => >=256)
          out.push(0); // reserved
          pushBytes(out, u16le(1));  // planes
          pushBytes(out, u16le(32)); // bpp
          pushBytes(out, u32le(im.png.length)); // size
          pushBytes(out, u32le(offset)); // offset
          offset += im.png.length;
        }

        // Image data
        for (var k = 0; k < images.length; k++) {
          var pngBytes = images[k].png;
          for (var b = 0; b < pngBytes.length; b++) out.push(pngBytes[b]);
        }

        resolve(new Blob([new Uint8Array(out)], { type: "image/x-icon" }));
      } catch (err) {
        reject(err);
      }
    });
  }

  /* ------------------------------------------------------------------ *
   * TIFF encoder (lossless RGBA, uncompressed, little-endian)
   * Full-fidelity output preserving alpha.
   * ------------------------------------------------------------------ */
  function encodeTIFF(ctx, w, h) {
    return new Promise(function (resolve, reject) {
      try {
        var imageData = ctx.getImageData(0, 0, w, h);
        var rgba = imageData.data;
        // RGBA pixel data, with ExtraSamples=2 (unassociated alpha)
        var pixelBytes = rgba;

        // Build IFD entries (sorted by tag)
        var width = w, height = h;
        var bitsPerSample = [8, 8, 8, 8];
        var bpsValues = [].concat(u16le(8), u16le(8), u16le(8), u16le(8));
        var extraSamples = [2]; // unassociated alpha

        var entries = [];
        function entry(tag, type, count, valueOrOffset) {
          // valueOrOffset: array of bytes; we compute offsets later
          entries.push({ tag: tag, type: type, count: count, raw: valueOrOffset });
        }

        entry(256, 3, 1, u16le(width).concat([0, 0]));         // ImageWidth (SHORT)
        entry(257, 3, 1, u16le(height).concat([0, 0]));         // ImageLength
        entry(258, 3, 4, bpsValues);                            // BitsPerSample (4 shorts = 8 bytes -> offset)
        entry(259, 3, 1, u16le(1).concat([0, 0]));              // Compression: 1 = none
        entry(262, 3, 1, u16le(2).concat([0, 0]));              // PhotometricInterpretation: 2 = RGB
        entry(273, 4, 1, null);                                  // StripOffsets (LONG) — fill later
        entry(277, 3, 1, u16le(4).concat([0, 0]));              // SamplesPerPixel: 4
        entry(278, 3, 1, u16le(height).concat([0, 0]));         // RowsPerStrip
        entry(279, 4, 1, null);                                  // StripByteCounts (LONG)
        entry(284, 3, 1, u16le(1).concat([0, 0]));              // PlanarConfiguration: 1 = chunky
        entry(338, 3, 1, u16le(2).concat([0, 0]));              // ExtraSamples: 2 = unassociated alpha

        // Sort by tag (TIFF requires ascending)
        entries.sort(function (a, b) { return a.tag - b.tag; });

        // Layout:
        //  [0..7]    header (II, 42, offset to IFD)
        //  [8..]     IFD: count(2) + N*12 + nextIFD(4)
        //  after IFD: auxiliary data (BitsPerSample values already inline? no, 4 shorts=8bytes=>offset)
        //  then strip data
        var headerLen = 8;
        var ifdCount = entries.length;
        var ifdLen = 2 + ifdCount * 12 + 4;
        var dataAreaStart = headerLen + ifdLen;

        // BitsPerSample needs 8 bytes (4 shorts) -> store in data area
        var bpsOffset = dataAreaStart;
        var dataCursor = dataAreaStart + 8; // after bps block
        var stripOffset = dataCursor;

        var out = [];
        // Header
        pushStr(out, "II");          // little-endian
        pushBytes(out, u16le(42));   // magic
        pushBytes(out, u32le(headerLen)); // offset to first IFD

        // IFD count
        pushBytes(out, u16le(ifdCount));

        for (var i = 0; i < entries.length; i++) {
          var e = entries[i];
          pushBytes(out, u16le(e.tag));
          pushBytes(out, u16le(e.type));
          pushBytes(out, u32le(e.count));
          if (e.tag === 258) {
            // BitsPerSample -> offset to bps block
            pushBytes(out, u32le(bpsOffset));
          } else if (e.tag === 273) {
            pushBytes(out, u32le(stripOffset)); // StripOffsets
          } else if (e.tag === 279) {
            pushBytes(out, u32le(pixelBytes.length)); // StripByteCounts
          } else {
            // inline value, padded to 4 bytes
            var val = e.raw;
            while (val.length < 4) val = val.concat([0]);
            pushBytes(out, val.slice(0, 4));
          }
        }
        // Next IFD offset = 0
        pushBytes(out, u32le(0));

        // BitsPerSample data block (4 shorts)
        pushBytes(out, bpsValues);

        // Strip data (RGBA pixels)
        for (var p = 0; p < pixelBytes.length; p++) out.push(pixelBytes[p]);

        resolve(new Blob([new Uint8Array(out)], { type: "image/tiff" }));
      } catch (err) {
        reject(err);
      }
    });
  }

  global.ImageKitEncoders = {
    encodeGIF: encodeGIF,
    encodeICO: encodeICO,
    encodeTIFF: encodeTIFF,
    buildPNG: buildPNG, // exposed for testing/internal use
  };
})(typeof window !== "undefined" ? window : this);
