# Quiet WhatsApp

Chrome extension (Manifest V3) that makes WhatsApp Web calmer and more private: hide what you don't use, blur what others shouldn't see and give it your own colors.

- **Hide**: Calls, Status, Channels, Communities, Meta AI and notification badges.
- **Blur**: messages, time and date, photos and videos, names, profile photos and chat previews, with adjustable intensity and reveal on hover.
- **Themes**: 10 color themes (including a light one), contrast-checked.
- **Languages**: en, es, fr, pt, de, it, pl, ru.

It never reads, stores or sends your messages: it only changes how the page looks. Settings are kept in `chrome.storage.sync`.

## Load it locally

1. Open `chrome://extensions` and enable *Developer mode*.
2. *Load unpacked* and select this folder.
3. Open <https://web.whatsapp.com/>.

## Layout

| Path | What it is |
| --- | --- |
| `manifest.json` | Extension manifest |
| `themes.js` | Theme palettes and contrast-based color derivation |
| `content.js` / `content.css` | Logic and styles injected into WhatsApp Web |
| `popup.html` / `popup.css` / `popup.js` | Settings popup |
| `_locales/` | Translations |
| `icons/` | Extension icons |
| `store/listing.md` | Chrome Web Store texts (description, privacy answers) |
| `build.sh` | Builds `dist/quiet-whatsapp-<version>.zip` for the store |

## Build for the Chrome Web Store

```sh
./build.sh
```

Not affiliated with or endorsed by WhatsApp or Meta.
