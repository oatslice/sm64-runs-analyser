# SM64 Splits Analyser

A web-based speedrun analysis tool for Super Mario 64 (and eventually other games).

## Phase 0 — What's Here

This repo contains the scaffold for all three features, with Phase 0 (infrastructure + validation) complete:

- **Pyodide integration** — NumPy + SciPy run in-browser via WebAssembly
- **`usePyodide` hook** — manages loading, caching, and executing Python code
- **`convolution.py`** — the core analysis engine (KDE smoothing, FFT convolution, PB probability, segment ranking, reset stats)
- **LSS parser** — handles all LiveSplit .lss edge cases (BOM, `<n>` tag, negative IDs, cumulative PB differencing, reset detection)
- **Smoke test UI** — validates the full pipeline end-to-end with known data

## Setup

```bash
npm install
npm run dev
```

Open `http://localhost:5173`, navigate to "Phase 0" and click "Run Smoke Test".

All checks should pass, confirming:
1. Pyodide loads and NumPy/SciPy are installed
2. The convolution module loads without errors
3. `compute_distribution()` returns a valid PDF/CDF with correct PB probability
4. The LSS parser correctly handles negative IDs, resets, and cumulative PB differencing

## Architecture

```
src/
├── pyodide/
│   ├── usePyodide.js      # React hook: Pyodide lifecycle management
│   └── convolution.py     # Python: KDE + FFT convolution (runs in Pyodide)
├── utils/
│   └── lssParser.js       # JS: .lss XML parser
├── components/
│   ├── PyodideLoader.jsx  # Loading gate + progress UI
│   ├── PyodideSmokeTest.jsx # Phase 0 validation
│   ├── SplitsAnalyser/    # Phase 1 (to be built)
│   ├── StarTimer/         # Phase 2 (to be built)
│   └── PlayerSimilarity/  # Phase 3 (to be built)
└── data/
    └── stars_catalogue.json  # Phase 2 (to be added)
```

## Key design decisions

- **Pyodide for computation** — Features 1 & 2 run entirely in-browser. No .lss data leaves the user's machine.
- **FFT convolution** — O(K·N log N) where K = segments, N = grid points. Fast even for 22 segments at 0.1s resolution.
- **KDE before convolution** — Gaussian KDE (Scott's rule) smooths each segment's empirical distribution before FFT, avoiding histogram ringing artefacts, especially for late-game segments with fewer samples.
- **Supabase** — Optional cross-device sync for Feature 2 star attempt history. Free tier, no cost.
- **Vercel + Render free tier** — Frontend and (Feature 3) backend hosted at zero cost.

## Next: Phase 1 (Splits Analyser)

1. Build `SplitsAnalyser/FileUpload.jsx` — file picker + drag-drop, calls `parseLSS()`
2. Build `SplitsAnalyser/SegmentTable.jsx` — segment stats, low-confidence warnings, exclude toggles
3. Build `SplitsAnalyser/DistributionChart.jsx` — Plotly PDF/CDF with PB marker
4. Build `SplitsAnalyser/Recommendations.jsx` — ranked segment improvement suggestions
5. Wire together via Pyodide: `compute_distribution()` + `rank_segments_by_impact()`
