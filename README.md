# kt-maimaidx-site-importer

Import scores from maimaidx-eng.com/maimai-mobile to Kamaitachi

## Features

- [x] Import recent scores
- [x] Import PBs
- [x] Import dan status

## Installation
### With a userscript manager

1. Install a userscript manager (e.g. Greasemonkey or Tampermonkey).
2. Click [here](https://github.com/j1nxie/kt-maimaidx-site-importer/raw/main/kt-maimaidx-site-importer.user.js).

### With a bookmarklet
(view this site from <https://j1nxie.github.io/kt-maimaidx-site-importer/>)

1. Bookmark this link by dragging it to the bookmarks bar: [Kamaitachi maimaiDX Score Importer](javascript:void(function(d){if(d.location.host==='maimaidx-eng.com'||d.location.host==='maimaidx.jp')document.body.appendChild(document.createElement('script')).src='https://j1nxie.github.io/kt-maimaidx-site-importer/kt-maimaidx-site-importer.min.js?t='+Math.floor(Date.now()/60000)})(document);).

## Usage
1. Go to the maimaiNET website (https://maimaidx-eng.com/maimai-mobile) and log in.
2. Set up your API key following the instructions you see on the page.
3. ALWAYS IMPORT RECENT SCORES FIRST.
4. Jump to recent scores page, and click the "Import recent scores" button.
5. To backfill all PBs, jump to the PBs page and click the "Import all PBs" button.
