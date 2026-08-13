const formats = ['webp', 'png', 'jpeg', 'jpg', 'ico', 'icns', 'heic', 'heif', 'tiff', 'gif'];
const state = { files: [], target: 'webp', converting: false };
const fileInput = document.querySelector('#fileInput');
const dropZone = document.querySelector('#dropZone');
const browseButton = document.querySelector('#browseButton');
const formatSelect = document.querySelector('#formatSelect');
const convertButton = document.querySelector('#convertButton');
const downloadSelected = document.querySelector('#downloadSelected');
const downloadAll = document.querySelector('#downloadAll');
const fileList = document.querySelector('#fileList');
const fileCount = document.querySelector('#fileCount');
const resultsTitle = document.querySelector('#resultsTitle');

browseButton.addEventListener('click', event => { event.stopPropagation(); fileInput.click(); });
dropZone.addEventListener('click', event => { if (event.target !== browseButton) fileInput.click(); });
dropZone.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') fileInput.click(); });
fileInput.addEventListener('change', event => addFiles([...event.target.files]));
['dragenter', 'dragover'].forEach(type => dropZone.addEventListener(type, event => { event.preventDefault(); dropZone.classList.add('is-dragging'); }));
['dragleave', 'drop'].forEach(type => dropZone.addEventListener(type, event => { event.preventDefault(); dropZone.classList.remove('is-dragging'); }));
dropZone.addEventListener('drop', event => addFiles([...event.dataTransfer.files]));
formatSelect.addEventListener('change', event => { state.target = event.target.value; });
convertButton.addEventListener('click', convertStack);
downloadAll.addEventListener('click', () => downloadFiles(state.files.filter(file => file.output)));
downloadSelected.addEventListener('click', () => downloadFiles(state.files.filter(file => file.output && file.selected)));

function addFiles(files) {
  const additions = files.filter(file => file.type.startsWith('image/') || /\.(heic|heif|tif|tiff|ico|icns)$/i.test(file.name)).map(file => ({ id: crypto.randomUUID(), source: file, output: null, preview: null, status: 'Queued', selected: true }));
  state.files.push(...additions);
  render();
}

function render() {
  const ready = state.files.filter(file => file.output).length;
  fileCount.textContent = `${state.files.length} ${state.files.length === 1 ? 'file' : 'files'}`;
  convertButton.disabled = !state.files.length || state.converting;
  downloadAll.disabled = !ready;
  downloadSelected.disabled = !state.files.some(file => file.output && file.selected);
  resultsTitle.textContent = ready ? `${ready} converted ${ready === 1 ? 'file' : 'files'}` : 'Your converted files';
  if (!state.files.length) {
    fileList.innerHTML = '<div class="empty-state"><span class="empty-line"></span><p>Your processed images will appear here.</p><span class="empty-line"></span></div>';
    return;
  }
  fileList.innerHTML = state.files.map((file, index) => `
    <article class="file-row" style="animation-delay:${Math.min(index * 45, 360)}ms">
      <input class="file-check" type="checkbox" ${file.selected ? 'checked' : ''} ${file.output ? '' : 'disabled'} data-check="${file.id}" aria-label="Select ${escapeHtml(file.source.name)}">
      ${file.preview ? `<img class="thumb" src="${file.preview}" alt="Preview of ${escapeHtml(file.source.name)}">` : '<div class="thumb" aria-hidden="true"></div>'}
      <div class="file-name" title="${escapeHtml(file.source.name)}">${escapeHtml(file.source.name)}</div>
      <div class="file-meta">${formatBytes(file.source.size)} · ${file.output ? `to ${state.target.toUpperCase()}` : 'waiting'}</div>
      <div class="file-status ${file.status === 'Ready' ? 'is-done' : file.status === 'Error' ? 'is-error' : ''}"><span class="status-pip"></span>${file.status}</div>
      <button class="row-action" type="button" data-remove="${file.id}" aria-label="Remove ${escapeHtml(file.source.name)}">×</button>
    </article>`).join('');
  document.querySelectorAll('[data-check]').forEach(input => input.addEventListener('change', event => { const file = state.files.find(item => item.id === event.target.dataset.check); if (file) file.selected = event.target.checked; render(); }));
  document.querySelectorAll('[data-remove]').forEach(button => button.addEventListener('click', event => { state.files = state.files.filter(file => file.id !== event.target.dataset.remove); render(); }));
}

async function convertStack() {
  if (state.converting) return;
  state.converting = true;
  for (const file of state.files) {
    if (file.output) continue;
    file.status = 'Reading';
    render();
    await pause(180);
    try {
      const converted = await convertFile(file.source, state.target);
      file.output = converted.blob;
      file.preview = converted.preview;
      file.status = 'Ready';
    } catch (error) {
      file.status = error.message || 'Error';
    }
    render();
  }
  state.converting = false;
  render();
}

function convertFile(source, target) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const reader = new FileReader();
    reader.onload = () => { image.src = reader.result; };
    reader.onerror = () => reject(new Error('Read failed'));
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d');
      if (target === 'jpeg' || target === 'jpg') { context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height); }
      context.drawImage(image, 0, 0);
      const mime = target === 'png' ? 'image/png' : target === 'webp' ? 'image/webp' : target === 'jpeg' || target === 'jpg' ? 'image/jpeg' : 'image/png';
      canvas.toBlob(blob => {
        if (!blob) { reject(new Error('Codec unavailable')); return; }
        const preview = URL.createObjectURL(blob);
        resolve({ blob, preview });
      }, mime, target === 'jpeg' || target === 'jpg' ? .92 : undefined);
    };
    image.onerror = () => reject(new Error('Preview unavailable'));
    reader.readAsDataURL(source);
  });
}

function downloadFiles(files) {
  files.forEach((file, index) => setTimeout(() => { const link = document.createElement('a'); link.href = file.preview; link.download = outputName(file.source.name, state.target); document.body.appendChild(link); link.click(); link.remove(); }, index * 120));
}
function outputName(name, target) { return `${name.replace(/\.[^/.]+$/, '')}.${target === 'jpeg' || target === 'jpg' ? 'jpg' : target}`; }
function formatBytes(bytes) { if (!bytes) return '0 B'; const units = ['B', 'KB', 'MB', 'GB']; const index = Math.floor(Math.log(bytes) / Math.log(1024)); return `${(bytes / Math.pow(1024, index)).toFixed(index ? 1 : 0)} ${units[index]}`; }
function escapeHtml(value) { return value.replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#039;', '"':'&quot;' }[char])); }
function pause(time) { return new Promise(resolve => setTimeout(resolve, time)); }

render();
