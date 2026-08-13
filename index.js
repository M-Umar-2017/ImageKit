/* ImageKit — converter logic
   Built by MADEC. Runs entirely in the browser. */

(function () {
  "use strict";

  var state = {
    files: [],
    target: "webp",
    optimize: true,
    converting: false,
  };

  // Cache DOM references
  var input = document.getElementById("fileInput");
  var zone = document.getElementById("dropZone");
  var browse = document.getElementById("browseButton");
  var format = document.getElementById("formatSelect");
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

  // ---- Events ----
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

  format.addEventListener("change", function (e) {
    state.target = e.target.value;
    // If files were already converted, their stale output stays valid per file
    render();
  });
  qualityToggle.addEventListener("change", function (e) { state.optimize = e.target.checked; });

  convertBtn.addEventListener("click", convertStack);
  clearAll.addEventListener("click", clearFiles);
  downloadAll.addEventListener("click", function () { download(state.files.filter(hasOutput)); });
  downloadSelected.addEventListener("click", function () {
    download(state.files.filter(function (f) { return hasOutput(f) && f.selected; }));
  });

  // ---- State mutation ----
  function addFiles(files) {
    files.forEach(function (source) {
      var isImage = source.type && source.type.indexOf("image/") === 0;
      if (!isImage && !ACCEPT_RE.test(source.name)) return;
      state.files.push({
        id: uid(),
        source: source,
        output: null,
        preview: null,
        status: "Queued",
        selected: true,
      });
    });
    render();
  }

  function clearFiles() {
    if (state.converting) return;
    state.files.forEach(revokePreview);
    state.files = [];
    render();
  }

  function hasOutput(f) { return !!f.output; }

  function uid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "f" + Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  // ---- Rendering ----
  function render() {
    var count = state.files.length;
    var ready = state.files.filter(hasOutput).length;
    var hasError = state.files.some(function (f) { return f.status === "Error"; });

    convertBtn.disabled = !count || state.converting || !state.files.some(function (f) { return !f.output; });
    convertBtn.classList.toggle("is-loading", state.converting);
    convertBtn.querySelector(".btn-label").textContent = state.converting
      ? "Converting…"
      : ready && !state.files.some(function (f) { return !f.output; })
        ? "Convert again"
        : "Convert";

    downloadAll.disabled = !ready;
    downloadSelected.disabled = !state.files.some(function (f) { return hasOutput(f) && f.selected; });
    clearAll.disabled = !count || state.converting;

    resultsTitle.textContent = !count
      ? "No files yet"
      : ready === count
        ? ready + (ready === 1 ? " file ready" : " files ready")
        : count + (count === 1 ? " file" : " files") + " in queue";

    resultsSub.textContent = !count
      ? "Add images above to get started."
      : hasError
        ? "Some files could not be converted in this browser."
        : state.converting
          ? "Processing your images locally…"
          : "Select files and download, or download all at once.";

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
        if (f) { revokePreview(f); state.files = state.files.filter(function (x) { return x.id !== f.id; }); render(); }
      });
    });
    forEach("[data-download]", function (btn) {
      btn.addEventListener("click", function (e) {
        var f = find(e.currentTarget.dataset.download);
        if (f && hasOutput(f)) download([f]);
      });
    });
  }

  function buildRow(file, i) {
    var statusClass =
      file.status === "Ready" ? " is-ready" :
      file.status === "Error" ? " is-error" :
      file.status === "Reading" || file.status === "Converting" ? " is-processing" : "";

    var thumb = file.preview
      ? '<img class="thumb" src="' + file.preview + '" alt="Preview of ' + esc(file.source.name) + '">'
      : '<span class="thumb-placeholder" aria-hidden="true">' +
        '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 16l5-5 4 4 3-3 6 6"/></svg></span>';

    var meta = bytes(file.source.size) +
      (file.output ? " · " + state.target.toUpperCase() : " · waiting");

    var canDownload = hasOutput(file);
    var label = file.status === "Queued" ? "Queued" :
                file.status === "Reading" ? "Reading" :
                file.status === "Converting" ? "Converting" :
                file.status === "Ready" ? "Ready" : "Error";

    return (
      '<article class="file-row" role="listitem" style="animation-delay:' + Math.min(i * 40, 320) + 'ms">' +
        '<input class="file-check" type="checkbox" ' + (file.selected ? "checked" : "") +
        (canDownload ? "" : " disabled") + ' data-check="' + file.id + '" aria-label="Select ' + esc(file.source.name) + '">' +
        thumb +
        '<div class="file-info">' +
          '<div class="file-name" title="' + esc(file.source.name) + '">' + esc(file.source.name) + "</div>" +
          '<div class="file-meta">' + meta + "</div>" +
        "</div>" +
        '<span class="file-status' + statusClass + '"><span class="pip"></span>' + label + "</span>" +
        '<button class="row-download" type="button" data-download="' + file.id + '" ' +
        (canDownload ? "" : "disabled") + ' aria-label="Download ' + esc(file.source.name) + '">' +
        '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12m0 0l-4-4m4 4l4-4"/><path d="M5 19h14"/></svg></button>' +
        '<button class="row-remove" type="button" data-remove="' + file.id + '" aria-label="Remove ' + esc(file.source.name) + '">×</button>' +
      "</article>"
    );
  }

  // ---- Conversion ----
  function convertStack() {
    if (state.converting) return;
    var queue = state.files.filter(function (f) { return !f.output; });
    if (!queue.length) return;

    state.converting = true;
    showProgress(0, queue.length);

    // Process sequentially to keep the device responsive
    queue.reduce(function (chain, file, index) {
      return chain.then(function () {
        if (state.converting === false) return; // cancelled by clear
        file.status = "Reading";
        render();
        updateProgress(index, queue.length);
        return convertFile(file.source, state.target, state.optimize)
          .then(function (result) {
            revokePreview(file);
            file.output = result.blob;
            file.preview = result.preview;
            file.status = "Ready";
          })
          .catch(function (err) {
            file.status = "Error";
            file.errorMsg = (err && err.message) ? err.message : "Conversion failed";
          })
          .then(function () { render(); });
      });
    }, Promise.resolve())
      .then(function () {
        state.converting = false;
        updateProgress(queue.length, queue.length);
        render();
        setTimeout(hideProgress, 600);
      });
  }

  function convertFile(source, target, optimize) {
    return readAsDataURL(source).then(function (dataUrl) {
      return loadImage(dataUrl);
    }).then(function (img) {
      var canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      var ctx = canvas.getContext("2d");

      // Flatten transparency for formats that do not support it
      if (target === "jpeg" || target === "jpg") {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.drawImage(img, 0, 0);

      var mime = mimeFor(target);
      var quality = optimize && (target === "jpeg" || target === "jpg" || target === "webp") ? 0.9 : undefined;

      return new Promise(function (resolve, reject) {
        canvas.toBlob(function (blob) {
          if (!blob) { reject(new Error("Format not supported in this browser")); return; }
          resolve({ blob: blob, preview: URL.createObjectURL(blob) });
        }, mime, quality);
      });
    });
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
      case "jpeg":
      case "jpg": return "image/jpeg";
      case "gif": return "image/gif";
      case "ico": return "image/x-icon";
      case "heic": return "image/heic";
      case "heif": return "image/heif";
      case "tiff": return "image/tiff";
      default: return "image/png";
    }
  }

  // ---- Download ----
  function download(files) {
    files.forEach(function (file, i) {
      setTimeout(function () {
        var a = document.createElement("a");
        a.href = file.preview;
        a.download = extFor(file.source.name, state.target);
        document.body.appendChild(a);
        a.click();
        a.remove();
      }, i * 120);
    });
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
  function revokePreview(file) { if (file.preview) { URL.revokeObjectURL(file.preview); file.preview = null; } }
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

  render();
})();
