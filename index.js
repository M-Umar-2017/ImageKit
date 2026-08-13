/* ImageKit — converter logic
   Built by MADEC. Runs entirely in the browser.
   Supports converting each image into multiple target formats at once. */

(function () {
  "use strict";

  var state = {
    files: [],
    targets: ["webp"], // selected target formats (array of strings)
    optimize: true,
    converting: false,
  };

  var ALL_FORMATS = ["webp", "png", "jpeg", "ico", "heic", "tiff", "gif"];

  // Cache DOM references
  var input = document.getElementById("fileInput");
  var zone = document.getElementById("dropZone");
  var browse = document.getElementById("browseButton");
  var formatChips = document.getElementById("formatChips");
  var selectAllFormats = document.getElementById("selectAllFormats");
  var clearFormats = document.getElementById("clearFormats");
  var formatsHint = document.getElementById("formatsHint");
  var qualityToggle = document.getElementById("qualityToggle");
  var convertBtn = document.getElementById("convertButton");
  var clearAll = document.getElementById("clearAll");
  var downloadSelected = document.getElementById("downloadSelected");
  var downloadAll = document.getElementById("downloadAll");
  var list = document.getElementById("fileList");
  var resultsTitle = document.getElementById("resultsTitle");
  var resultsSub = document.getElementById("resultsSub");
  var progressBar = document.getElementById("progressBar");
  var progressFill = document.getElementById("progressFill");
  var progressText = document.getElementById("progressText");

  // Accepted inputs (browsers may not flag HEIC/TIFF/ICO as image/*)
  var ACCEPT_RE = /\.(heic|heif|tif|tiff|ico|icns)$/i;

  // ---- Events: file input ----
  browse.addEventListener("click", function (e) { e.stopPropagation(); input.click(); });
  zone.addEventListener("click", function (e) { if (e.target !== browse) input.click(); });
  zone.addEventListener("keydown", function (e) {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.click(); }
  });
  input.addEventListener("change", function (e) { addFiles([].slice.call(e.target.files)); input.value = ""; });

  ["dragenter", "dragover"].forEach(function (type) {
    zone.addEventListener(type, function (e) { e.preventDefault(); zone.classList.add("is-dragging"); });
  });
  ["dragleave", "drop"].forEach(function (type) {
    zone.addEventListener(type, function (e) { e.preventDefault(); zone.classList.remove("is-dragging"); });
  });
  // Prevent the browser from opening dropped files outside the zone
  ["dragover", "drop"].forEach(function (type) {
    window.addEventListener(type, function (e) { e.preventDefault(); });
  });
  zone.addEventListener("drop", function (e) { addFiles([].slice.call(e.dataTransfer.files)); });

  // ---- Events: format chips ----
  formatChips.addEventListener("click", function (e) {
    var chip = e.target.closest(".format-chip");
    if (!chip || state.converting) return;
    var fmt = chip.dataset.format;
    var idx = state.targets.indexOf(fmt);
    if (idx >= 0) {
      if (state.targets.length === 1) return; // keep at least one format selected
      state.targets.splice(idx, 1);
    } else {
      state.targets.push(fmt);
    }
    syncChips();
    render();
  });
  selectAllFormats.addEventListener("click", function () {
    if (state.converting) return;
    state.targets = ALL_FORMATS.slice();
    syncChips();
    render();
  });
  clearFormats.addEventListener("click", function () {
    if (state.converting) return;
    state.targets = ["webp"]; // never empty — keep webp as default
    syncChips();
    render();
  });
  qualityToggle.addEventListener("change", function (e) { state.optimize = e.target.checked; });

  convertBtn.addEventListener("click", convertStack);
  clearAll.addEventListener("click", clearFiles);
  downloadAll.addEventListener("click", function () {
    download(collectOutputs(state.files));
  });
  downloadSelected.addEventListener("click", function () {
    download(collectOutputs(state.files.filter(function (f) { return f.selected; })));
  });

  // Keep the chips' visual/aria state in sync with state.targets
  function syncChips() {
    forEach(".format-chip", function (chip) {
      var on = state.targets.indexOf(chip.dataset.format) >= 0;
      chip.classList.toggle("is-on", on);
      chip.setAttribute("aria-pressed", on ? "true" : "false");
    });
    var n = state.targets.length;
    formatsHint.textContent = n === 1
      ? "One format selected. Tap more to convert each image to several formats at once."
      : n + " formats selected — each image will be converted to all of them.";
  }

  // ---- State mutation ----
  function addFiles(files) {
    files.forEach(function (source) {
      var isImage = source.type && source.type.indexOf("image/") === 0;
      if (!isImage && !ACCEPT_RE.test(source.name)) return;
      state.files.push({
        id: uid(),
        source: source,
        preview: null,       // shared preview (source-derived) shown in thumb
        outputs: {},         // { [format]: { status, blob, preview, error } }
        status: "Queued",
        selected: true,
      });
    });
    render();
  }

  function clearFiles() {
    if (state.converting) return;
    state.files.forEach(revokeOutputs);
    state.files = [];
    render();
  }

  function anyOutputReady(file) {
    return Object.keys(file.outputs).some(function (fmt) {
      return file.outputs[fmt] && file.outputs[fmt].status === "Ready";
    });
  }

  function uid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "f" + Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  // ---- Rendering ----
  function render() {
    var count = state.files.length;
    var readyFiles = state.files.filter(anyOutputReady).length;
    var hasError = state.files.some(function (f) {
      return Object.keys(f.outputs).some(function (fmt) {
        return f.outputs[fmt] && f.outputs[fmt].status === "Error";
      });
    });

    // Convert button: enabled when there are files and at least one not fully converted
    var pending = state.files.some(function (f) {
      return state.targets.some(function (fmt) { return !f.outputs[fmt] || f.outputs[fmt].status === "Queued"; });
    });
    convertBtn.disabled = !count || state.converting || !pending || !state.targets.length;
    convertBtn.classList.toggle("is-loading", state.converting);
    convertBtn.querySelector(".btn-label").textContent = state.converting
      ? "Converting…"
      : (!pending && count) ? "Convert again"
      : "Convert";

    downloadAll.disabled = !readyFiles;
    downloadSelected.disabled = !state.files.some(function (f) { return f.selected && anyOutputReady(f); });
    clearAll.disabled = !count || state.converting;

    resultsTitle.textContent = !count
      ? "No files yet"
      : readyFiles === count && !pending
        ? count + (count === 1 ? " file ready" : " files ready")
        : count + (count === 1 ? " file" : " files") + " in queue";

    resultsSub.textContent = !count
      ? "Add images above to get started."
      : hasError
        ? "Some outputs could not be produced in this browser."
        : state.converting
          ? "Processing your images locally…"
          : "Tap a format chip to download, or download all at once.";

    if (!count) {
      list.innerHTML =
        '<div class="empty-state">' +
        '<svg viewBox="0 0 64 48" width="56" height="42" aria-hidden="true" focusable="false"><rect x="6" y="8" width="52" height="32" rx="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M10 34l12-12 8 8 6-6 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="20" cy="18" r="3" fill="none" stroke="currentColor" stroke-width="2"/></svg>' +
        "<p>Your converted files will appear here.</p></div>";
      hideProgress();
      return;
    }

    list.innerHTML = state.files.map(buildRow).join("");

    // Wire row controls
    forEach("[data-check]", function (box) {
      box.addEventListener("change", function (e) {
        var f = find(e.target.dataset.check);
        if (f) { f.selected = e.target.checked; render(); }
      });
    });
    forEach("[data-remove]", function (btn) {
      btn.addEventListener("click", function (e) {
        if (state.converting) return;
        var f = find(e.currentTarget.dataset.remove);
        if (f) { revokeOutputs(f); state.files = state.files.filter(function (x) { return x.id !== f.id; }); render(); }
      });
    });
    forEach("[data-output]", function (btn) {
      btn.addEventListener("click", function (e) {
        var parts = e.currentTarget.dataset.output.split("|");
        var f = find(parts[0]);
        var fmt = parts[1];
        if (f && f.outputs[fmt] && f.outputs[fmt].status === "Ready") {
          download([{ file: f, format: fmt, blob: f.outputs[fmt].blob, preview: f.outputs[fmt].preview }]);
        }
      });
    });
  }

  function buildRow(file, i) {
    var canSelect = anyOutputReady(file);
    var thumb = file.preview
      ? '<img class="thumb" src="' + file.preview + '" alt="Preview of ' + esc(file.source.name) + '">'
      : '<span class="thumb-placeholder" aria-hidden="true">' +
        '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 16l5-5 4 4 3-3 6 6"/></svg></span>';

    var meta = bytes(file.source.size) + " · " + state.targets.length +
      (state.targets.length === 1 ? " format" : " formats");

    // Build one chip per target format
    var chips = state.targets.map(function (fmt) {
      var out = file.outputs[fmt];
      var status = out ? out.status : "Queued";
      var cls = "output-chip";
      var inner;
      if (status === "Ready") {
        cls += " is-ready";
        inner = '<span class="chip-format">' + labelFor(fmt) + "</span>" +
          '<span class="chip-dl" aria-hidden="true"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12m0 0l-4-4m4 4l4-4"/><path d="M5 19h14"/></svg></span>';
        return '<button type="button" class="' + cls + '" data-output="' + file.id + "|" + fmt +
          '" aria-label="Download ' + esc(file.source.name) + " as " + labelFor(fmt) + '">' + inner + "</button>";
      }
      if (status === "Error") {
        cls += " is-error";
        inner = '<span class="chip-format">' + labelFor(fmt) + "</span><span class=\"chip-pip\"></span>";
        return '<span class="' + cls + '" title="' + esc((out && out.error) || "Failed") + '">' + inner + "</span>";
      }
      if (status === "Reading" || status === "Converting") {
        cls += " is-processing";
        inner = '<span class="chip-format">' + labelFor(fmt) + "</span><span class=\"chip-pip\"></span>";
        return '<span class="' + cls + '" aria-label="' + labelFor(fmt) + " converting\">" + inner + "</span>";
      }
      // Queued
      inner = '<span class="chip-format">' + labelFor(fmt) + "</span><span class=\"chip-pip\"></span>";
      return '<span class="' + cls + '" aria-label="' + labelFor(fmt) + " queued\">" + inner + "</span>";
    }).join("");

    return (
      '<article class="file-row" role="listitem" style="animation-delay:' + Math.min(i * 40, 320) + 'ms">' +
        '<input class="file-check" type="checkbox" ' + (file.selected ? "checked" : "") +
        (canSelect ? "" : " disabled") + ' data-check="' + file.id + '" aria-label="Select ' + esc(file.source.name) + '">' +
        thumb +
        '<div class="file-info">' +
          '<div class="file-name" title="' + esc(file.source.name) + '">' + esc(file.source.name) + "</div>" +
          '<div class="file-meta">' + meta + "</div>" +
        "</div>" +
        '<div class="file-outputs">' + chips + "</div>" +
        '<button class="row-remove" type="button" data-remove="' + file.id + '" aria-label="Remove ' + esc(file.source.name) + '" ' + (state.converting ? "disabled" : "") + ">×</button>" +
      "</article>"
    );
  }

  function labelFor(fmt) {
    return { webp: "WEBP", png: "PNG", jpeg: "JPEG", jpg: "JPG", ico: "ICO",
      heic: "HEIC", heif: "HEIF", tiff: "TIFF", gif: "GIF" }[fmt] || fmt.toUpperCase();
  }

  // ---- Conversion ----
  function convertStack() {
    if (state.converting) return;
    if (!state.targets.length) return;
    var queue = state.files.slice();
    if (!queue.length) return;

    state.converting = true;
    var totalUnits = queue.length * state.targets.length;
    showProgress(0, totalUnits);
    var done = 0;

    // Process files sequentially; each file converts to all selected formats.
    queue.reduce(function (chain, file) {
      return chain.then(function () {
        file.status = "Reading";
        // Ensure output slots exist for every selected format
        state.targets.forEach(function (fmt) {
          if (!file.outputs[fmt] || file.outputs[fmt].status === "Queued") {
            file.outputs[fmt] = { status: "Queued", blob: null, preview: null, error: null };
          }
        });
        render();
        return readAndDecode(file)
          .then(function (decoded) {
            return state.targets.reduce(function (p, fmt) {
              return p.then(function () {
                var out = file.outputs[fmt];
                if (out.status === "Ready") { done++; updateProgress(done, totalUnits); return; }
                out.status = "Converting";
                render();
                return convertCanvas(decoded.canvas, fmt, state.optimize, decoded.hasAlpha)
                  .then(function (blob) {
                    if (out.preview) URL.revokeObjectURL(out.preview);
                    out.blob = blob;
                    out.preview = URL.createObjectURL(blob);
                    out.status = "Ready";
                  })
                  .catch(function (err) {
                    out.status = "Error";
                    out.error = (err && err.message) ? err.message : "Conversion failed";
                  })
                  .then(function () { done++; updateProgress(done, totalUnits); render(); });
              });
            }, Promise.resolve());
          })
          .catch(function (err) {
            // Source image could not be decoded at all — fail every format for this file
            state.targets.forEach(function (fmt) {
              var out = file.outputs[fmt] || (file.outputs[fmt] = { status: "Queued", blob: null, preview: null, error: null });
              if (out.status !== "Ready") {
                out.status = "Error";
                out.error = (err && err.message) ? err.message : "Could not decode image";
              }
              done++;
            });
            updateProgress(done, totalUnits);
          })
          .then(function () {
            file.status = anyOutputReady(file) ? "Ready" : "Error";
            render();
          });
      });
    }, Promise.resolve())
      .then(function () {
        state.converting = false;
        updateProgress(totalUnits, totalUnits);
        render();
        setTimeout(hideProgress, 700);
      });
  }

  // Read + decode the source once, returning a canvas and alpha flag shared across formats.
  function readAndDecode(file) {
    return readAsDataURL(file.source).then(function (dataUrl) {
      return loadImage(dataUrl);
    }).then(function (img) {
      var canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      var ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      // Keep a source preview thumbnail from the decoded image
      if (!file.preview) file.preview = canvas.toDataURL("image/png");
      var hasAlpha = formatHasAlpha(file.source.type, file.source.name);
      return { canvas: canvas, hasAlpha: hasAlpha };
    });
  }

  function convertCanvas(sourceCanvas, target, optimize, hasAlpha) {
    // Clone so flattening for JPEG does not corrupt the shared source canvas
    var canvas = document.createElement("canvas");
    canvas.width = sourceCanvas.width;
    canvas.height = sourceCanvas.height;
    var ctx = canvas.getContext("2d");
    if (target === "jpeg" || target === "jpg") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(sourceCanvas, 0, 0);

    var mime = mimeFor(target);
    var quality = optimize && (target === "jpeg" || target === "jpg" || target === "webp") ? 0.9 : undefined;

    return new Promise(function (resolve, reject) {
      canvas.toBlob(function (blob) {
        if (!blob) { reject(new Error("Format not supported in this browser")); return; }
        resolve(blob);
      }, mime, quality);
    });
  }

  function formatHasAlpha(type, name) {
    if (type === "image/png" || type === "image/webp" || type === "image/gif") return true;
    return /\.(png|webp|gif)$/i.test(name || "");
  }

  function readAsDataURL(source) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = function () { reject(new Error("Could not read file")); };
      reader.readAsDataURL(source);
    });
  }

  function loadImage(src) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error("Could not decode image")); };
      img.src = src;
    });
  }

  function mimeFor(target) {
    switch (target) {
      case "png": return "image/png";
      case "webp": return "image/webp";
      case "jpeg": case "jpg": return "image/jpeg";
      case "gif": return "image/gif";
      case "ico": return "image/x-icon";
      case "heic": return "image/heic";
      case "heif": return "image/heif";
      case "tiff": return "image/tiff";
      default: return "image/png";
    }
  }

  // ---- Download ----
  // items: array of { file, format, blob, preview }
  function download(items) {
    items.forEach(function (item, i) {
      setTimeout(function () {
        var a = document.createElement("a");
        a.href = item.preview;
        a.download = extFor(item.file.source.name, item.format);
        document.body.appendChild(a);
        a.click();
        a.remove();
      }, i * 120);
    });
  }

  // Collect every ready output across the given files as download items
  function collectOutputs(files) {
    var items = [];
    files.forEach(function (f) {
      state.targets.forEach(function (fmt) {
        var out = f.outputs[fmt];
        if (out && out.status === "Ready") {
          items.push({ file: f, format: fmt, blob: out.blob, preview: out.preview });
        }
      });
    });
    return items;
  }

  function extFor(name, target) {
    var base = name.replace(/\.[^/.]+$/, "");
    var ext = (target === "jpeg" || target === "jpg") ? "jpg" : target;
    return base + "." + ext;
  }

  // ---- Progress ----
  function showProgress(done, total) {
    progressBar.hidden = false;
    updateProgress(done, total);
  }
  function updateProgress(done, total) {
    var pct = total ? Math.round((done / total) * 100) : 0;
    progressFill.style.width = pct + "%";
    progressText.textContent = "Converting " + done + " of " + total + (done >= total ? " — done" : "…");
  }
  function hideProgress() { progressBar.hidden = true; }

  // ---- Helpers ----
  function find(id) { return state.files.filter(function (f) { return f.id === id; })[0]; }
  function revokeOutputs(file) {
    Object.keys(file.outputs).forEach(function (fmt) {
      var out = file.outputs[fmt];
      if (out && out.preview) { URL.revokeObjectURL(out.preview); out.preview = null; }
    });
  }
  function forEach(selector, fn) { [].forEach.call(document.querySelectorAll(selector), fn); }

  function bytes(value) {
    if (!value) return "0 B";
    var units = ["B", "KB", "MB", "GB"];
    var i = Math.floor(Math.log(value) / Math.log(1024));
    return (value / Math.pow(1024, i)).toFixed(i ? 1 : 0) + " " + units[i];
  }

  function esc(value) {
    return String(value).replace(/[&<>'"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;" }[c];
    });
  }

  // ---- Footer year ----
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  syncChips();
  render();
})();
