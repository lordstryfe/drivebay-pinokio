# Changelog

All user-facing Drivebay versions. Newest first.

## 3.17
- Settings **Drive access**: scan all drives on load; toggle any drive off; saved in `data/drive-access.json`.
- Disabled drives hidden from sidebar and blocked for browse/download/upload/search.
- Android APK: downloads go to phone **Downloads** via DownloadManager (with session cookies).

## 3.16
- Server-lock policy (`data/server-lock.json` on host only): delete/rename/mkdir/upload/port/max upload/allowed roots.
- Settings shows live lock status (read-only from web/APK).
- File APIs enforce lock server-side; browser toolbar disables locked actions.
- Download route honors `allowedRoots`.

## 3.15
- Large files download via streaming `/api/download` (no more 24 MB base64 ceiling).
- Sort toolbar: name, type, size, date.
- Group by type (folders, images, videos, archives, etc.).
- Upload size ceiling raised to 512 MB (still base64-bound).

## 3.14
- Search walks subfolders.
- Hidden folders (`.` names) are included when the eye is on.
- Toggling the eye re-runs the current search.

## 3.13
- Opens on Home instead of Workspace.
- Settings shows the version number.
- Request a feature in Settings opens a GitHub issue.

## 3.12
- Home page no longer loads the file-browser module on the server (Windows 500).
- Update force-resets to GitHub main.

## 3.11
- Removed leftover file-list code that crashed the home page.

## 3.10
- Fixed vite.config.ts typo that blocked Start.

## 3.9
- Stopped a Windows database crash from returning JSON 500.

## 3.8
- Search this folder (Enter or Ctrl/Cmd+K).

## 3.7
- Settings page (password + port).
- Login lock stored in `data/` so Update does not wipe it.

## 3.6
- Random or static port at Install / Set port.

## 3.5
- Static port picker for router forwarding.

## 3.4
- Login works from public / Tailscale / phone addresses.

## 3.3
- Pinokio package, X: and Z: drives, password lock, file browser.
