# SVG2Stencil

Generate 3D-printable solder paste stencils from PCB Gerber or SVG files. Runs entirely in your browser — no install, no upload.

This is a fork of [user-will/svg2stencil](https://github.com/user-will/svg2stencil) with additions oriented toward FDM printing, broader Gerber dialect support, and Russian localization.

Live demo: [djobsidian.github.io/svg2stencil](https://djobsidian.github.io/svg2stencil/)

## What's added in this fork

### Altium Gerber support
The original parser dropped Altium-style flashes — Altium emits `X..Y..D02*` (move) and `D03*` (flash) as separate commands, while KiCad collapses them into a single `X..Y..D03*`. This fork handles both. Region blocks with a trailing `D02*` before `G37*` (also Altium-specific) are parsed correctly too.

### FDM aperture merging
Set the **Nozzle (FDM merge)** parameter to your printer's nozzle diameter (e.g. 0.4mm). Adjacent apertures whose gap is smaller than that nozzle get merged into a single slot, because FDM can't reliably print walls thinner than one nozzle.

Total paste volume is preserved by shrinking the slot's cross-axis dimension proportionally — surface tension during reflow redistributes the paste back to each pad. The info panel shows aperture count and how many were merged.

`0` disables the feature (use this for resin printing where fine detail is reliable).

### Watertight STL output
Three issues from the original output are fixed:
- **Sub-micron coordinate jitter** breaks earcut's coalinearity edge cases that produced ~140 open edges on dense pad rows.
- **`mergeVertices` on export** welds duplicates from `ExtrudeGeometry`'s non-indexed buffer.
- **Stencil↔lip topology** rebuilt so their walls coincide on the inner edge instead of stacking back-to-back annular faces.

Result: 0 open edges. A handful of non-manifold edges remain where stencil and lip walls coincide; every slicer we've tested ignores them.

### Offline-first
Three.js is bundled in `vendor/` instead of pulled from a CDN, so the tool works offline and isn't blocked by ad blockers / corporate proxies.

### Bilingual UI (English / Русский)
Language is detected from the browser, defaulting to English. Switch with the **EN / RU** buttons in the header. Selection isn't persisted.

### Brand colors
Light theme using a fixed palette (CSS variables in `index.html`).

---

## Что добавлено в этом форке

### Поддержка Gerber'ов от Altium
Оригинальный парсер пропускал Altium-style flashes — Altium пишет `X..Y..D02*` (move) и `D03*` (flash) отдельными командами, а KiCad одной `X..Y..D03*`. Форк понимает оба варианта. Регионы с лишним `D02*` перед `G37*` (тоже Altium-специфика) тоже парсятся корректно.

### Объединение апертур для FDM
Параметр **Сопло (объединение для FDM)** — диаметр сопла твоего принтера (напр. 0.4мм). Близко расположенные апертуры, между которыми зазор меньше сопла, объединяются в одну прорезь, потому что FDM физически не напечатает перегородку тоньше одной экструзионной линии.

Объём пасты сохраняется: ширина прорези поджимается так, чтобы суммарная площадь равнялась площади оригинальных апертур. Поверхностное натяжение при reflow растащит пасту обратно по пинам. В инфо-панели видно количество апертур и сколько объединено.

`0` — фича выключена (использовать для смоляной печати где мелкие апертуры воспроизводятся точно).

### Watertight STL
Исправлены три проблемы оригинального экспорта:
- **Микро-jitter координат** ломает чувствительность earcut к коллинеарным рёбрам, которая давала ~140 открытых рёбер на плотных рядах пинов.
- **`mergeVertices` на экспорте** склеивает дубли вершин в non-indexed буфере `ExtrudeGeometry`.
- **Топология стенцила и бортика** перестроена так, что их стенки совпадают по innerEdge, а не лежат двумя параллельными аннулярными плоскостями.

Итог: 0 открытых рёбер. Остаётся пара non-manifold рёбер на стыке стенцила и бортика — слайсеры на это не жалуются.

### Работа без интернета
Three.js лежит локально в `vendor/`, не тянется с CDN. Сайт работает оффлайн и не падает за корпоративным фильтром / AdGuard'ом.

### Двуязычный интерфейс (EN / RU)
Язык определяется по браузеру, по умолчанию английский. Переключатель **EN / RU** в шапке. Выбор не сохраняется.

---

## Usage / Использование

Module imports require an HTTP server — `file://` won't work. Two options:

- **Windows:** double-click `serve.bat` (uses Python's built-in `http.server` on port 8765 and opens the browser).
- **Anywhere:** run any static server in this folder, e.g. `python -m http.server 8765`, then open `http://localhost:8765/`.

Then:

1. Drop a paste-layer file (`.gtp`, `.gbr`, `.gbp`, `.svg`, ...) on the **Paste Layer File** zone.
2. Optionally drop the edge-cuts file (`.gm1`, `.gko`, `Edge_Cuts.gbr`, ...) on the **Edge Cuts Layer** zone — enables auto-alignment via a board lip.
3. Set **Nozzle (FDM merge)** to your printer's nozzle diameter for FDM. Leave at 0 for resin / no merging.
4. Click **Download STL**.

## Supported formats

### Gerber (RS-274X)
Accepts `.gbr`, `.ger`, `.gtp`, `.gbp`, `.gm1`, `.gko`. Supports:
- Standard aperture types: circle (C), rectangle (R), obround (O), polygon (P)
- Aperture macros (`%AM...%`), including KiCad `RoundRect` and Altium-style absolute-baked macros
- Pre-instantiated aperture macros (KiCad 6+)
- Region fills (G36/G37) for polygon-defined apertures
- Bare D-codes (Altium-style separate move + flash)
- Stroke-based edge cuts with linear and arc segments (G01/G02/G03)
- Both metric (mm) and imperial (inch) units

### SVG
Accepts `.svg` files exported from KiCad's plot function. Filled paths become paste apertures; stroke-only paths become edge cuts outlines.

## License

MIT, same as upstream.
