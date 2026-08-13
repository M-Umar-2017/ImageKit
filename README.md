# ImageKit

### A small, private image converter for the work in between.

ImageKit is a browser-based image format converter built for people who just need to change a file and keep moving. Drop in one image or a whole stack, choose a destination format, and let the browser process each file in sequence.

No account. No upload queue. No mysterious server in the middle.

> Built with care by ✩𝐌𝐀𝐃𝐄𝐂✩.

## What it does

ImageKit accepts common image files and offers a single, uncomplicated conversion shelf for:

| Input and output formats |
| --- |
| WEBP · PNG · JPEG · JPG · ICO · ICNS · HEIC · HEIF · TIFF · GIF |

The interface is intentionally quiet. Files appear as horizontal records, browser-readable previews show up after conversion, and each finished file can be selected for download or included in a full batch download.

## Why it exists

Most quick conversion tools ask for more than they need: an account, an upload, a waiting room, or a subscription prompt. ImageKit is meant to feel closer to a useful little desktop utility. It keeps the interaction direct and keeps the files in the tab.

## Features

- Drag-and-drop or file-picker uploads.
- Batch conversion with one-by-one processing to reduce handoff problems.
- Per-file status states for queued, reading, ready, and error conditions.
- Preview apertures for converted images when the browser can render them.
- Download selected files or download the entire converted stack.
- Responsive layout for smaller screens.
- No framework runtime or build step required for GitHub Pages.

## Run it locally

Clone the repository, then open `index.html` in a browser. That is the whole setup.

```bash
git clone https://github.com/M-Umar-2017/ImageKit.git
cd ImageKit
```

For local development with a simple static server, use any server you already have installed. For example:

```bash
python3 -m http.server 8080
```

Then visit `http://localhost:8080`.

## Project shape

ImageKit keeps the public surface deliberately small:

| File | Purpose |
| --- | --- |
| `index.html` | Page structure and accessible controls |
| `index.css` | Dark indie visual system and responsive layout |
| `index.js` | File queue, sequential conversion, previews, and downloads |
| `README.md` | Project notes and setup instructions |

## Browser note

ImageKit uses the browser canvas for its conversion path. PNG, JPEG, JPG, and WEBP are the most dependable browser-native outputs. For formats that depend on browser codec support, ImageKit will show the file-level result rather than hiding the limitation behind a fake success state.

## GitHub Pages

This repository is already structured as a static site. To publish it through GitHub Pages, open the repository settings, choose **Pages**, select the `main` branch as the source, and save.

## License

This project is shared as a small personal utility by ✩𝐌𝐀𝐃𝐄𝐂✩. Add the license that matches how you want ImageKit to be reused.
