# ImageKit

A fast, private, in-browser image format converter. Add images, choose a target format, and convert. Every conversion runs locally in the browser. No uploads, no accounts, no servers in the middle.

Built by [MADEC](https://github.com/M-Umar-2017).

---

## Overview

ImageKit is a single-purpose utility for converting images between common formats. It is designed around one principle: the fastest, safest way to convert a file is to never send it anywhere.

The entire application is static HTML, CSS, and JavaScript. There is no build step, no runtime framework, and no backend. Open `index.html` in any modern browser and it works.

### Why it exists

Most online converters ask for more than they need: an account, an upload, a wait, or a subscription. ImageKit strips all of that away. It behaves like a small, dependable desktop utility that happens to live in a browser tab. Files stay on the device where they belong.

---

## Key features

- **Fully private.** Files are processed on the device using the HTML canvas. Nothing is uploaded.
- **Multiple formats at once.** Select several target formats and every image is converted to all of them in a single pass.
- **Batch conversion.** Add one image or a whole stack. Files convert sequentially to keep the device responsive.
- **One-click download.** Download individual files, a selection, or the entire converted batch.
- **Progress feedback.** A live progress bar and per-file status track queued, reading, ready, and error states.
- **Mobile friendly.** A responsive layout that works from small phones to wide desktops.
- **Accessible.** Keyboard navigation, visible focus states, ARIA labels, and reduced-motion support.
- **Zero dependencies.** No frameworks, no build tools, no package manager required.

---

## Supported formats

ImageKit converts between the following formats:

| Format | Notes |
| --- | --- |
| JPEG / JPG | Photos and small files. Transparency is flattened to white. |
| PNG | Lossless with alpha channel support. |
| WEBP | Modern, efficient format. Best general-purpose output. |
| GIF | Simple graphics. |
| TIFF | High-fidelity output. Support depends on the browser. |
| HEIC / HEIF | Apple and modern container formats. Support depends on the browser. |
| ICO | Favicons and small icons. |

Outputs rely on your browser's built-in image codecs. JPEG, PNG, and WEBP are reliably supported everywhere. Formats such as HEIC, HEIF, and TIFF depend on the browser and platform, so ImageKit reports an explicit error for an unsupported format rather than silently failing.

---

## How it works

1. **Add images.** Drag and drop files onto the dropzone, or click to browse. Multiple files are supported.
2. **Choose formats.** Toggle one or more target formats. Each image is converted to every selected format.
3. **Convert.** Click Convert. Files are processed one at a time using the browser canvas.
4. **Download.** Download each format individually, a selection, or all outputs at once with one click.

---

## Run it locally

Clone the repository and open `index.html` in a browser. That is the entire setup.

```bash
git clone https://github.com/M-Umar-2017/ImageKit.git
cd ImageKit
```

For local development, serve the directory with any static server. For example:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080` in your browser.

---

## Deploy to GitHub Pages

ImageKit is already structured as a static site. To publish it:

1. Open the repository on GitHub and go to **Settings**.
2. Select **Pages** from the left sidebar.
3. Under **Source**, choose the `main` branch and the root directory.
4. Save. The site will be available at `https://<username>.github.io/ImageKit/` shortly after.

---

## Project structure

The public surface is intentionally small:

| File | Purpose |
| --- | --- |
| `index.html` | Page structure, converter controls, and content sections. |
| `index.css` | Design system, responsive layout, and accessibility styles. |
| `index.js` | File queue, sequential conversion, progress, and downloads. |
| `README.md` | Project documentation and setup instructions. |

---

## Browser support

ImageKit works in any modern browser that supports the HTML canvas and the `canvas.toBlob` API. This includes current versions of Chrome, Edge, Firefox, and Safari.

Format availability depends on the browser's codec support. ImageKit never claims success for a conversion it could not actually produce. If a format is unsupported, the file is marked with an error so the result is always trustworthy.

---

## Privacy

ImageKit does not collect, store, or transmit any data. There is no backend, no analytics, and no network calls during conversion. Your images never leave your device.

---

## License

This project is maintained by [MADEC](https://github.com/M-Umar-2017) as a personal utility. See the `LICENSE` file for terms.
