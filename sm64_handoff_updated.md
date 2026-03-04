# SM64 Speedrun Analysis — Handoff Document

> **Last updated:** Session 3 — All changes through multi-swap segment swap, run filters,
> true PB probability box, average run time (via AttemptHistory started/ended), LSS file
> persistence across tabs, CSV export/import for Star Timer, and recentN/minDuration
> filters operating on attempt IDs.

## For: New chat session continuing Phase 2 (Star Timer)
---

## 1. Project Overview

React + Vite frontend. All computation runs in-browser via **Pyodide** (Python with NumPy/SciPy). No backend. Deployed locally with `npm run dev`. The user runs Windows and deploys changes via PowerShell scripts.

**Tech stack:**
- React (Vite), functional components, hooks only
- Pyodide v0.26.2 loaded from CDN, numpy + scipy bundled
- Plotly.js loaded from CDN for charts
- localStorage for Star Timer persistence
- Design: dark theme with CSS variables (`var(--bg)`, `var(--star)`, `var(--purple)`, etc.)
- Font: Space Mono (monospace display)

**CSS variables used throughout (defined in index.css):**
```
--bg, --bg-card, --bg-raised
--border, --border-hi
--text-1, --text-2, --text-3
--star (gold), --purple, --green, --red
--font-mono, --font-display
--radius, --radius-lg
--transition
```

---

## 2. Repository Structure

```
sm64-splits/
  src/
    App.jsx                          # Top-level nav + state threading
    App.css
    index.css                        # Global CSS variables + reset
    main.jsx
    pyodide/
      convolution.py                 # Python analysis engine (KDE, FFT conv, percentiles)
      usePyodide.js                  # React hook — loads Pyodide, exposes runPython()
    utils/
      lssParser.js                   # Parses LiveSplit .lss XML files
    components/
      PyodideLoader.jsx/css          # Wraps app, shows loading state
      PyodideSmokeTest.jsx/css       # Dev tab: validates Pyodide loads correctly
      SplitsAnalyser/                # Phase 1 — COMPLETE
        index.jsx                    # Main orchestrator, calls runPython
        FileUpload.jsx/css
        SegmentTable.jsx/css
        DistributionChart.jsx/css
        Recommendations.jsx/css
        MidRunCalculator.jsx/css
        SplitsAnalyser.css
      StarTimer/                     # Phase 2 — IN PROGRESS
        index.jsx                    # Tab orchestrator + all state + Pyodide calls
        useStarTimer.js              # localStorage CRUD hook
        StarPicker.jsx/css           # 3-level catalogue dropdown
        AttemptLog.jsx/css           # Per-star attempt entry + collapsible history
        CollectionBuilder.jsx/css    # Create/edit collections + per-collection offset
        CollectionChart.jsx/css      # Single collection PDF distribution
        CompareView.jsx/css          # Two-collection overlay chart
        SegmentSwap.jsx/css          # Swap collection into run distribution
        StarTimer.css                # Shared layout + log tab styles
    data/
      stars_catalogue.json           # All 120 stars, stages, strategies
      presets.js                     # PRESET_CATEGORIES array — user edits this file
      segmentOffsets.js              # Static offsets — user fills in manually
```

---

## 3. Phase 1 (Splits Analyser) — COMPLETE

Features built:
- .lss file upload + XML parsing (handles BOM, negative IDs, resets, carry-over exclusion)
- KDE + FFT convolution via Pyodide → full-run PDF/CDF
- SegmentTable: mean, best (gold), std, reset rate, exclusion toggles
- DistributionChart: Plotly PDF with auto-zoom, PB marker, CDF toggle
- Recommendations: top segments ranked by variance contribution and δPB
- MidRunCalculator: enter current split times mid-run → compute remaining distribution + PB probability

SplitsAnalyser props:
```jsx
<SplitsAnalyser
  onRunDataChange={fn}       // called with parsed runData when .lss loaded
  onDistributionChange={fn}  // called with distribution result when computed
/>
```

runData shape (from lssParser):
```js
{
  gameName, categoryName, attemptCount,
  segments: [{
    name,          // string
    times,         // float[] seconds — cleaned attempt times
    pbTime,        // float seconds — per-segment PB
    resetRate,     // float 0–1
    goldTime,      // float seconds — best ever
  }]
}
```

distribution shape (from convolution.py compute_distribution):
```js
{
  x,              // float[] seconds — time axis
  pdf,            // float[] — probability density
  cdf,            // float[] — cumulative
  pb_time,        // float seconds
  pb_probability, // float 0–1
  percentiles,    // {p10, p25, p50, p75, p90} seconds
  segment_stats,  // [{n, mean, std}]
}
```

---

## 4. Phase 2 (Star Timer) — IN PROGRESS

### 4.1 What's built and working

**useStarTimer.js** — localStorage hook
Collection shape:
```js
{
  id, name,
  stars: [{ stage, star, strategy }],
  offsetSeconds: number | null,
  lssSegmentName: string | null,
}
```
Exported ops: `addAttempt, deleteAttempt, editAttempt, getAttempts, getSuccessTimes, createCollection, deleteCollection, renameCollection, setCollectionOffset, addStarToCollection, removeStarFromCollection, getCollectionTimes, clearAll`

**Log tab** — select star via 3-level picker, log success/fail attempts with time, collapsible history, checkboxes to select stars, "Create collection from selected" panel with name + optional offset + segment fields.

**Collections tab** — create/rename/delete collections, presets grouped by speedrun category (120/70/16/1/0 star), per-collection offset row (offsetSeconds + lssSegmentName), add/remove stars.

**Distribution tab** — select a collection, compute its convolved PDF via Pyodide, show p10–p90, Plotly chart, per-star breakdown table.

**Compare tab** — select two collections, overlay their PDFs.

**Segment Swap tab** — select a collection (uses its stored offsetSeconds + lssSegmentName), optionally override segment/offset, replaces that segment in the full-run distribution and shows the δPB probability. Requires a run to be loaded in Splits Analyser first.

**presets.js** — `PRESET_CATEGORIES` array, user edits this file directly. Structure:
```js
export const PRESET_CATEGORIES = [
  {
    id: '120', label: '120 Star',
    presets: [
      { id: 'bob', label: 'Bob-omb Battlefield', stars: [{stage, star, strategy}] },
      ...
    ]
  },
  { id: '70', label: '70 Star', presets: [...] },
  ...
]
```

**segmentOffsets.js** — user fills manually:
```js
export const SEGMENT_OFFSETS = {
  // no longer used by SegmentSwap — offset is now stored on each collection
  // kept as reference / future use
}
```
Note: the offset mechanism moved fully onto collections. `segmentOffsets.js` is currently stubbed but kept for potential future use.

### 4.2 Known issues / things to verify on first run

1. **Pyodide globals injection** — `index.jsx` calls `runPython` with globals like `seg_times`, `pb_times` etc. These are injected via `py.globals.set(key, value)` in `usePyodide.js`. Lists pass fine; numpy arrays come back as Pyodide proxies needing `.to_py()`.

2. **computeCollection augmentation** — The inline Python in `index.jsx` (`computeCollection` function) augments `segment_stats` with `best` and `variance_share`. If `convolution.py` ever gets `best` natively, remove the augmentation.

3. **SegmentSwap Python** — The swap computation in `handleSwapCompute` is a large inline Python block in `index.jsx` (lines ~100–230). It recomputes all segment KDEs from scratch on a shared grid, replaces the target segment with the collection's shifted PDF, convolves, and computes δPB probability. This has not yet been tested end-to-end. The most likely issues are grid size mismatches and the `orig_times.to_py()` / `col_times.to_py()` calls — Pyodide passes these as proxy objects and `.to_py()` must be called on the Python side.

4. **stars_catalogue.json** — Lives at `src/data/stars_catalogue.json`. Structure:
```json
{
  "stars_catalogue": [
    {
      "stage": "1. Bob-omb Battlefield",
      "stars": [
        { "name": "Big Bob-omb on the Summit", "strategies": ["Standard", "Left side strat", "Other"] },
        ...
      ]
    },
    ...17 stages total, 120 stars
  ]
}
```

### 4.3 Remaining work / open questions

The following has **not** been built yet:

1. **Phase 3: Player Similarity** — specified in the FSD but not started. Involves comparing a user's split times against a reference dataset to find similar runners.

2. **UI polish** — no known blocking bugs but untested end-to-end. In particular: Segment Swap Python computation, Compare tab when one collection has very few data points.

3. **Deployment workflow** — each change requires running a PowerShell script that overwrites files. The pattern is established. New scripts should follow the same `[System.IO.File]::WriteAllText(path, @'...content...'@, UTF8)` pattern.

4. **The user mentioned wanting to fill in segmentOffsets.js manually** — this file is now mostly superseded since offsets moved onto collections. If the user asks about it, clarify that offsets are now set per-collection in the Collections tab.

---

## 5. How to generate a PowerShell deployment script

When writing files the user needs to deploy:

```python
utf8 = "New-Object System.Text.UTF8Encoding $false"
lines = ["# script-name.ps1", 'Write-Host "Deploying..." -ForegroundColor Yellow', ""]

for src_path in files_to_deploy:
    win_path = src_path.replace('/', '\\')
    with open(f"/home/claude/sm64-splits/{src_path}", encoding='utf-8') as f:
        content = f.read()
    # IMPORTANT: check content does not contain "\n'@" (here-string terminator)
    lines += [
        f'Write-Host "  {win_path}" -ForegroundColor Green',
        "[System.IO.File]::WriteAllText(",
        f"    (Join-Path (Get-Location) '{win_path}'),",
        "    @'",
        content,
        "'@,",
        f"    ({utf8})",
        ")", ""
    ]
```

The user runs scripts from inside `sm64-splits/` with:
```
powershell -ExecutionPolicy Bypass -File .\script-name.ps1
```

Then hard-refreshes the browser (`Ctrl+Shift+R`).

---

## 6. Source files (current state)


### `src/App.jsx`
```jsx
import { useState } from 'react'
import { PyodideLoader } from './components/PyodideLoader'
import { PyodideSmokeTest } from './components/PyodideSmokeTest'
import { SplitsAnalyser } from './components/SplitsAnalyser/index'
import { StarTimer } from './components/StarTimer/index'
import './App.css'

const NAV_ITEMS = [
  { id: 'smoke',      label: 'Phase 0',        icon: '#', dev: true  },
  { id: 'splits',     label: 'Splits',          icon: '>', dev: false },
  { id: 'stars',      label: 'Star Timer',      icon: '*', dev: false },
  { id: 'similarity', label: 'Similar Players', icon: '~', dev: false },
]

function Placeholder({ name }) {
  return (
    <div className="placeholder">
      <div className="placeholder__icon">[wip]</div>
      <h2 className="placeholder__title">{name}</h2>
      <p className="placeholder__body text-2">Coming in a future phase.</p>
    </div>
  )
}

export default function App() {
  const [tab, setTab] = useState('smoke')
  const [runData, setRunData] = useState(null)
  const [distribution, setDistribution] = useState(null)

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar__logo">
          <span className="topbar__star">*</span>
          <span className="topbar__name">SM64 Splits</span>
          <span className="topbar__tag badge badge-star">DEV</span>
        </div>
        <nav className="topbar__nav">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              className={'topbar__nav-btn' + (tab === item.id ? ' is-active' : '')}
              onClick={() => setTab(item.id)}
            >
              <span className="topbar__nav-label">{item.label}</span>
              {item.dev && <span className="topbar__nav-dev">dev</span>}
            </button>
          ))}
        </nav>
      </header>

      <main className="app__main">
        <PyodideLoader>
          {tab === 'smoke'      && <PyodideSmokeTest />}

          {/* SplitsAnalyser stays mounted when switching to stars so the
              loaded .lss file and computed distribution persist.
              Hidden with display:none rather than unmounted. */}
          <div style={{ display: tab === 'splits' ? 'contents' : 'none' }}>
            <SplitsAnalyser onRunDataChange={setRunData} onDistributionChange={setDistribution} />
          </div>

          {tab === 'stars'      && <StarTimer runData={runData} distribution={distribution} />}
          {tab === 'similarity' && <Placeholder name="Player Similarity" />}
        </PyodideLoader>
      </main>
    </div>
  )
}

```

### `src/pyodide/convolution.py`
```python
"""
convolution.py  —  SM64 Splits Analysis Engine
Runs inside Pyodide (NumPy + SciPy available).

Public API (called from JS via runPython):
  compute_distribution(segment_times_list, pb_times_list, resolution=0.1)
    -> dict with keys: x, pdf, cdf, pb_time, pb_probability, percentiles

  rank_segments_by_impact(segment_times_list, pb_times_list, resolution=0.1)
    -> list of dicts: {index, name, delta_pb, variance_share, std, mean, n}

  compute_reset_stats(segment_reset_rates)
    -> dict: {completion_probability, per_segment: [{reset_rate, ...}]}
"""

import numpy as np
from scipy.stats import gaussian_kde
from scipy.signal import fftconvolve


# ── Helpers ─────────────────────────────────────────────────────────────────

def _parse_seconds(times):
    """Accept a list/array of floats (seconds). Returns np.ndarray."""
    arr = np.asarray(times, dtype=float)
    return arr[np.isfinite(arr)]


def _kde_pdf(times, x_grid):
    """
    Fit a Gaussian KDE (Scott's rule) to `times` and evaluate on `x_grid`.
    Returns a non-negative, normalised probability density array.
    Falls back to a uniform distribution if fewer than 2 data points.
    """
    if len(times) < 2:
        # With 0 or 1 point, return a narrow spike at the observed time (or 0)
        pdf = np.zeros_like(x_grid)
        center = times[0] if len(times) == 1 else x_grid[len(x_grid) // 2]
        idx = np.argmin(np.abs(x_grid - center))
        pdf[idx] = 1.0
        return pdf

    kde = gaussian_kde(times, bw_method='scott')
    pdf = kde(x_grid)
    pdf = np.clip(pdf, 0, None)

    # Normalise so integral ≈ 1 (KDE already is, but guard against numerics)
    integral = np.trapz(pdf, x_grid)
    if integral > 0:
        pdf /= integral
    return pdf


def _build_common_grid(all_times_list, resolution=0.1, padding_factor=1.3):
    """
    Build a shared time grid that spans the range of all observed times,
    with some right-padding.
    """
    flat = np.concatenate([np.asarray(t, dtype=float) for t in all_times_list if len(t) > 0])
    flat = flat[np.isfinite(flat)]
    if len(flat) == 0:
        raise ValueError("No valid time data provided")

    lo = 0.0
    hi = flat.max() * padding_factor
    n_points = int(np.ceil((hi - lo) / resolution)) + 1
    return np.linspace(lo, hi, n_points)


def _fft_convolve_pdfs(pdfs):
    """
    Convolve a list of per-segment PDF arrays using FFT.
    Each array should be evaluated on the same x_grid.
    Returns the joint PDF of the sum (total run time).
    """
    result = pdfs[0].copy()
    for pdf in pdfs[1:]:
        result = fftconvolve(result, pdf, mode='full')
        result = np.clip(result, 0, None)

    # Normalise
    total = result.sum()
    if total > 0:
        result /= total
    return result


# ── Public API ───────────────────────────────────────────────────────────────

def compute_distribution(segment_times_list, pb_times_list, resolution=0.1):
    """
    Parameters
    ----------
    segment_times_list : list of list of float
        Each inner list is the set of recorded times (seconds) for one segment.
    pb_times_list : list of float
        Per-segment PB times (seconds), same length as segment_times_list.
    resolution : float
        Grid resolution in seconds.

    Returns
    -------
    dict with:
      x                : list[float]  — time axis for the total run (seconds)
      pdf              : list[float]  — KDE-smoothed probability density
      cdf              : list[float]  — cumulative distribution
      pb_time          : float        — current PB (sum of pb_times_list)
      pb_probability   : float        — P(run < pb_time), 0–1
      percentiles      : dict         — {p10, p25, p50, p75, p90} in seconds
      segment_stats    : list[dict]   — per-segment {mean, std, n} for UI table
    """
    # Validate and clean input
    cleaned = [_parse_seconds(t) for t in segment_times_list]
    pb_times = np.asarray(pb_times_list, dtype=float)

    if len(cleaned) == 0:
        raise ValueError("segment_times_list is empty")

    # Build shared per-segment x grid
    seg_x = _build_common_grid(cleaned, resolution=resolution)

    # Fit KDE for each segment
    pdfs = [_kde_pdf(times, seg_x) for times in cleaned]

    # Convolve to get total-run PDF
    # The total run x-axis is longer: it spans n_segments × seg_x range
    joint_pdf = _fft_convolve_pdfs(pdfs)

    # Build the x-axis for the joint distribution.
    # After convolving N arrays each of length M, result has length (N-1)*(M-1)+1
    n_seg = len(pdfs)
    m = len(seg_x)
    joint_len = (n_seg - 1) * (m - 1) + m
    # Trim to actual length of joint_pdf
    joint_len = min(joint_len, len(joint_pdf))
    joint_pdf = joint_pdf[:joint_len]

    dx = seg_x[1] - seg_x[0]
    joint_x = np.arange(joint_len) * dx

    # Re-normalise after trimming
    total = np.trapz(joint_pdf, joint_x)
    if total > 0:
        joint_pdf /= total

    # CDF
    joint_cdf = np.cumsum(joint_pdf) * dx
    joint_cdf = np.clip(joint_cdf, 0, 1)

    # PB probability
    pb_time = float(pb_times.sum())
    pb_idx = np.searchsorted(joint_x, pb_time, side='right')
    pb_probability = float(joint_cdf[min(pb_idx, len(joint_cdf) - 1)])

    # Percentiles (find x where CDF crosses p)
    def _percentile(p):
        idx = np.searchsorted(joint_cdf, p / 100.0)
        idx = min(idx, len(joint_x) - 1)
        return float(joint_x[idx])

    percentiles = {
        'p10': _percentile(10),
        'p25': _percentile(25),
        'p50': _percentile(50),
        'p75': _percentile(75),
        'p90': _percentile(90),
    }

    # Per-segment stats for the UI table
    segment_stats = []
    for times in cleaned:
        segment_stats.append({
            'n':    int(len(times)),
            'mean': float(times.mean()) if len(times) > 0 else None,
            'std':  float(times.std())  if len(times) > 1 else None,
        })

    return {
        'x':               joint_x.tolist(),
        'pdf':             joint_pdf.tolist(),
        'cdf':             joint_cdf.tolist(),
        'pb_time':         pb_time,
        'pb_probability':  pb_probability,
        'percentiles':     percentiles,
        'segment_stats':   segment_stats,
    }


def rank_segments_by_impact(segment_times_list, pb_times_list, resolution=0.1):
    """
    For each segment, compute the counterfactual PB probability if that
    segment were replaced by its PB time (zero variance, best-case).

    Returns a list of dicts sorted by delta_pb descending:
      index, delta_pb, variance_share, std, mean, n
    """
    cleaned = [_parse_seconds(t) for t in segment_times_list]
    pb_times = np.asarray(pb_times_list, dtype=float)

    # Baseline
    baseline = compute_distribution(cleaned, pb_times, resolution)
    baseline_pb_prob = baseline['pb_probability']

    stds = np.array([
        float(t.std()) if len(t) > 1 else 0.0
        for t in cleaned
    ])
    total_std = stds.sum()

    results = []
    for i in range(len(cleaned)):
        # Replace segment i with its PB time (point mass)
        modified = list(cleaned)
        modified[i] = np.array([pb_times[i]])

        try:
            cf = compute_distribution(modified, pb_times, resolution)
            delta_pb = cf['pb_probability'] - baseline_pb_prob
        except Exception:
            delta_pb = 0.0

        results.append({
            'index':          i,
            'delta_pb':       float(delta_pb),
            'variance_share': float(stds[i] / total_std) if total_std > 0 else 0.0,
            'std':            float(stds[i]),
            'mean':           float(cleaned[i].mean()) if len(cleaned[i]) > 0 else None,
            'n':              int(len(cleaned[i])),
        })

    results.sort(key=lambda r: r['delta_pb'], reverse=True)
    return results


def compute_reset_stats(segment_reset_rates):
    """
    Parameters
    ----------
    segment_reset_rates : list of float
        Pre-computed survival-based reset rate per segment (0-1).
        Computed in lssParser as (prev_reached - reached_i) / prev_reached.

    Returns
    -------
    dict with completion_probability and per_segment list of {reset_rate}
    """
    per_segment = []
    completion_prob = 1.0
    for rate in segment_reset_rates:
        r = float(max(0.0, min(1.0, rate)))
        completion_prob *= (1.0 - r)
        per_segment.append({'reset_rate': r})
    return {
        'completion_probability': float(completion_prob),
        'per_segment':            per_segment,
    }


print("✓ SM64 analysis engine loaded")

```

### `src/pyodide/usePyodide.js`
```js
/**
 * usePyodide.js
 *
 * Manages the Pyodide runtime lifecycle:
 *   - Loads Pyodide from CDN on first use
 *   - Installs NumPy + SciPy (micropip, from Pyodide's bundled packages)
 *   - Caches the loaded runtime in a module-level singleton so the
 *     expensive initialisation only happens once per page session
 *   - Exposes `runPython(code, globals)` for executing Python snippets
 *     and returning JS-friendly results
 *
 * Usage:
 *   const { ready, loading, error, runPython } = usePyodide()
 */

import { useState, useEffect, useCallback, useRef } from 'react'

// ── Module-level singleton ──────────────────────────────────────────────────
// Keeps the Pyodide instance alive across React re-renders and hot-reloads.
let pyodideInstance = null
let pyodideLoadPromise = null

const PYODIDE_CDN = 'https://cdn.jsdelivr.net/pyodide/v0.26.2/full/pyodide.js'

async function initialisePyodide(onProgress) {
  // Already loaded – return immediately
  if (pyodideInstance) return pyodideInstance

  // Already loading – wait for the in-flight promise
  if (pyodideLoadPromise) return pyodideLoadPromise

  pyodideLoadPromise = (async () => {
    onProgress?.('Loading Pyodide runtime…')

    // Dynamically inject the Pyodide loader script if not already present
    if (!window.loadPyodide) {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script')
        script.src = PYODIDE_CDN
        script.onload = resolve
        script.onerror = () => reject(new Error(`Failed to load Pyodide from ${PYODIDE_CDN}`))
        document.head.appendChild(script)
      })
    }

    onProgress?.('Initialising Python environment…')
    const pyodide = await window.loadPyodide()

    onProgress?.('Installing NumPy & SciPy…')
    await pyodide.loadPackage(['numpy', 'scipy'])

    // Pre-load our convolution module so it's ready to call
    onProgress?.('Loading analysis modules…')
    const convolutionCode = await fetch('/src/pyodide/convolution.py').then(r => r.text())
    await pyodide.runPythonAsync(convolutionCode)

    pyodideInstance = pyodide
    onProgress?.('Ready')
    return pyodide
  })()

  return pyodideLoadPromise
}

// ── Hook ───────────────────────────────────────────────────────────────────
export function usePyodide() {
  const [state, setState] = useState({
    ready: false,
    loading: false,
    progress: '',
    error: null,
  })

  // Keep a stable ref to pyodide so runPython doesn't need it in deps
  const pyRef = useRef(null)

  useEffect(() => {
    // If already loaded, mark ready immediately
    if (pyodideInstance) {
      pyRef.current = pyodideInstance
      setState({ ready: true, loading: false, progress: 'Ready', error: null })
      return
    }

    setState(s => ({ ...s, loading: true, error: null }))

    initialisePyodide((msg) => {
      setState(s => ({ ...s, progress: msg }))
    })
      .then((py) => {
        pyRef.current = py
        setState({ ready: true, loading: false, progress: 'Ready', error: null })
      })
      .catch((err) => {
        pyodideLoadPromise = null // allow retry
        setState({ ready: false, loading: false, progress: '', error: err.message })
      })
  }, [])

  /**
   * runPython(code, globals?)
   *
   * Executes `code` in the Pyodide runtime.
   * `globals` is an optional plain JS object whose keys are injected
   * as Python variables before execution.
   *
   * Returns the value of the last expression, converted to JS.
   * Throws if Pyodide is not ready or execution fails.
   */
  const runPython = useCallback(async (code, globals = {}) => {
    if (!pyRef.current) throw new Error('Pyodide is not ready yet')

    const py = pyRef.current

    // Inject JS variables into the Python global namespace
    for (const [key, value] of Object.entries(globals)) {
      py.globals.set(key, value)
    }

    const result = await py.runPythonAsync(code)

    // Convert Pyodide proxy objects to plain JS values where possible
    if (result && typeof result.toJs === 'function') {
      return result.toJs({ dict_converter: Object.fromEntries })
    }
    return result
  }, [])

  return { ...state, runPython }
}

```

### `src/utils/lssParser.js`
```js
/**
 * lssParser.js
 *
 * Reset rate: survival formula — (prev_reached - reached_i) / prev_reached
 *   "reached_i" = count of positive-id <Time> entries in segment i's history
 *   prev_reached starts at AttemptCount.
 *
 * Segment times: only count attempt IDs that have NOT self-closed on any
 *   earlier segment, to avoid anomalous carry-over times from aborted runs.
 *   Each segment stores { times: number[], attemptIds: number[] } in parallel
 *   so that run-level filters (by total duration) can gate by ID.
 *
 * Attempt durations: computed from started/ended wall-clock attributes on
 *   <Attempt> elements in <AttemptHistory>. This captures ALL attempts
 *   including resets, unlike RealTime which only appears on completed runs.
 *   Returned as attemptDurationById: Map<number, number> (id -> seconds).
 */

export function parseLSSTime(str) {
  if (!str) return null
  const match = str.trim().match(/^(\d+):(\d{2}):(\d{2})\.(\d+)$/)
  if (!match) return null
  const [, h, m, s, frac] = match
  return parseInt(h,10)*3600 + parseInt(m,10)*60 + parseInt(s,10) + parseFloat('0.'+frac)
}

function parseLSSWallClock(str) {
  // LiveSplit format: "MM/DD/YYYY HH:MM:SS"
  if (!str) return null
  const match = str.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})$/)
  if (!match) return null
  const [, mo, day, yr, hr, min, sec] = match
  return new Date(
    parseInt(yr,10), parseInt(mo,10)-1, parseInt(day,10),
    parseInt(hr,10), parseInt(min,10), parseInt(sec,10)
  ).getTime() / 1000  // unix epoch seconds
}

function getText(el, tagName) {
  if (!el) return null
  const child = el.querySelector(tagName) || el.querySelector(tagName.toLowerCase())
  return child?.textContent?.trim() || null
}

export function parseLSS(fileText) {
  const xml = fileText.replace(/^\uFEFF/, '')
  const parser = new DOMParser()
  const doc = parser.parseFromString(xml, 'text/xml')
  const parseError = doc.querySelector('parsererror')
  if (parseError) throw new Error('XML parse error: ' + parseError.textContent.slice(0,200))

  const root = doc.documentElement
  const gameName     = getText(root,'GameName')     || 'Unknown Game'
  const categoryName = getText(root,'CategoryName') || 'Unknown Category'
  const attemptCount = parseInt(getText(root,'AttemptCount') || '0', 10)

  // ── Attempt durations from AttemptHistory (started/ended wall-clock) ──
  // This is the correct approach: RealTime children only exist on completed
  // runs and would exclude resets. started/ended captures every attempt.
  const attemptHistoryEl = root.querySelector('AttemptHistory')
  const attemptDurationById = new Map()  // id -> seconds
  if (attemptHistoryEl) {
    for (const attempt of attemptHistoryEl.querySelectorAll('Attempt')) {
      const id      = parseInt(attempt.getAttribute('id') ?? '0', 10)
      const started = parseLSSWallClock(attempt.getAttribute('started'))
      const ended   = parseLSSWallClock(attempt.getAttribute('ended'))
      if (id > 0 && started != null && ended != null && ended > started) {
        attemptDurationById.set(id, ended - started)
      }
    }
  }

  const segmentEls = Array.from(root.querySelectorAll('Segments > Segment'))

  // ── Per-segment PB from cumulative SplitTimes ──
  const cumulativePBTimes = segmentEls.map(seg => {
    const splitTimesEl = seg.querySelector('SplitTimes')
    if (!splitTimesEl) return null
    const pbEl = Array.from(splitTimesEl.querySelectorAll('SplitTime'))
      .find(el => el.getAttribute('name') === 'Personal Best')
    if (!pbEl) return null
    const rt = pbEl.querySelector('RealTime')
    return parseLSSTime(rt?.textContent?.trim())
  })
  const perSegmentPBTimes = cumulativePBTimes.map((cumulative, i) => {
    if (cumulative === null) return null
    const prev = cumulativePBTimes.slice(0,i).findLast(t => t !== null) ?? 0
    return cumulative - prev
  })

  // ── Count positive-id entries per segment for survival reset rate ──
  const reachedCounts = segmentEls.map(seg => {
    const hist = seg.querySelector('SegmentHistory')
    if (!hist) return 0
    return Array.from(hist.querySelectorAll('Time'))
      .filter(t => parseInt(t.getAttribute('id') ?? '0', 10) > 0)
      .length
  })

  // ── Build segment objects ──
  // Track IDs that reset on an earlier segment to exclude carry-over times.
  // Store attemptIds in parallel with times so callers can filter by total
  // run duration via attemptDurationById.
  const cumulativeResetIds = new Set()
  let prevReached = attemptCount

  const segments = segmentEls.map((seg, i) => {
    const nameEl = seg.querySelector('n') || seg.querySelector('Name')
    const name = nameEl?.textContent?.trim() || ('Segment ' + (i+1))

    const bestSegEl = seg.querySelector('BestSegmentTime')
    const bestSegRt = bestSegEl?.querySelector('RealTime')
    const bestSegment = parseLSSTime(bestSegRt?.textContent?.trim())

    const historyEl = seg.querySelector('SegmentHistory')
    const timeEls = historyEl ? Array.from(historyEl.querySelectorAll('Time')) : []

    const times = []
    const attemptIds = []  // parallel to times
    let onSegmentResets = 0
    const thisSegResetIds = new Set()

    for (const timeEl of timeEls) {
      const id = parseInt(timeEl.getAttribute('id') ?? '0', 10)
      if (id <= 0) continue
      const rt = timeEl.querySelector('RealTime')
      if (!rt) {
        onSegmentResets++
        thisSegResetIds.add(id)
      } else if (!cumulativeResetIds.has(id)) {
        const t = parseLSSTime(rt.textContent?.trim())
        if (t !== null && t > 0) {
          times.push(t)
          attemptIds.push(id)
        }
      }
    }

    for (const id of thisSegResetIds) cumulativeResetIds.add(id)

    const reachedI = reachedCounts[i]
    const resetRate = prevReached > 0 ? (prevReached - reachedI) / prevReached : 0
    prevReached = reachedI

    return {
      name,
      pbTime:        perSegmentPBTimes[i],
      bestSegment,
      times,
      attemptIds,    // parallel to times; use with attemptDurationById to filter by run duration
      resets:        onSegmentResets,
      resetRate,
      lowConfidence: reachedI < 10,
    }
  })

  // Flat array for convenience (no ID needed for general stats)
  const attemptDurations = Array.from(attemptDurationById.values())

  return { gameName, categoryName, attemptCount, segments, attemptDurations, attemptDurationById }
}

```

### `src/components/StarTimer/useStarTimer.js`
```js
/**
 * useStarTimer.js
 *
 * Central state for the Star Timer feature, persisted in localStorage.
 *
 * Collection shape:
 *   { id, name, stars: [{stage, star, strategy}], offsetSeconds: number|null, lssSegmentName: string|null }
 *
 * starKey = `${stage}||${star}||${strategy}`
 */
import { useState, useCallback, useEffect } from 'react'

const STORAGE_KEY = 'sm64_star_timer'

export function makeStarKey(stage, star, strategy) {
  return `${stage}||${star}||${strategy}`
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { attempts: {}, collections: [] }
    return JSON.parse(raw)
  } catch { return { attempts: {}, collections: [] } }
}

function save(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) } catch { /* quota */ }
}

// ── CSV export/import helpers ────────────────────────────────────────────────

const CSV_HEADER = 'stage,star,strategy,timestamp,success,time_seconds'

/**
 * Export all attempts to a CSV string, sorted by stage > star > strategy > timestamp.
 * Each row is one attempt.
 */
export function exportToCSV(attempts, collections) {
  const rows = []

  for (const [key, attemptList] of Object.entries(attempts)) {
    const [stage, star, strategy] = key.split('||')
    for (const attempt of attemptList) {
      rows.push({
        stage, star, strategy,
        timestamp:    attempt.timestamp,
        success:      attempt.success ? '1' : '0',
        time_seconds: attempt.timeSeconds != null ? String(attempt.timeSeconds) : '',
        _ts:          new Date(attempt.timestamp).getTime(),
      })
    }
  }

  // Sort: stage asc (numeric prefix sorts correctly), then star, strategy, then timestamp
  rows.sort((a, b) => {
    if (a.stage !== b.stage)       return a.stage.localeCompare(b.stage)
    if (a.star !== b.star)         return a.star.localeCompare(b.star)
    if (a.strategy !== b.strategy) return a.strategy.localeCompare(b.strategy)
    return a._ts - b._ts
  })

  const csvRows = rows.map(r => [
    csvEscape(r.stage),
    csvEscape(r.star),
    csvEscape(r.strategy),
    csvEscape(r.timestamp),
    r.success,
    r.time_seconds,
  ].join(','))

  return [CSV_HEADER, ...csvRows].join('\n')
}

function csvEscape(str) {
  if (str == null) return ''
  const s = String(str)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"'
  }
  return s
}

/**
 * Parse a CSV string back into { attempts, collections }.
 * Returns { data, errors } where data is the parsed state and errors is a string[] of warnings.
 */
export function importFromCSV(csvText) {
  const lines  = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  const errors = []
  const attempts = {}

  // Skip header line
  const dataLines = lines[0]?.trim().toLowerCase().startsWith('stage') ? lines.slice(1) : lines

  for (let i = 0; i < dataLines.length; i++) {
    const line = dataLines[i].trim()
    if (!line) continue

    const cols = parseCSVRow(line)
    if (cols.length < 5) {
      errors.push(`Row ${i + 2}: too few columns (got ${cols.length}, expected 6) — skipped`)
      continue
    }

    const [stage, star, strategy, timestamp, successStr, timeSecondsStr] = cols
    if (!stage || !star || !strategy) {
      errors.push(`Row ${i + 2}: missing stage/star/strategy — skipped`)
      continue
    }

    const success     = successStr.trim() === '1' || successStr.trim().toLowerCase() === 'true'
    const timeSeconds = timeSecondsStr?.trim() ? parseFloat(timeSecondsStr) : null

    const attempt = {
      id:          crypto.randomUUID(),
      timestamp:   timestamp || new Date().toISOString(),
      success,
      timeSeconds: success && timeSeconds != null && !isNaN(timeSeconds) ? timeSeconds : null,
    }

    const key = makeStarKey(stage.trim(), star.trim(), strategy.trim())
    if (!attempts[key]) attempts[key] = []
    attempts[key].push(attempt)
  }

  return { data: { attempts, collections: [] }, errors }
}

function parseCSVRow(line) {
  const cols = []
  let i = 0
  while (i < line.length) {
    if (line[i] === '"') {
      // Quoted field
      let field = ''
      i++ // skip opening quote
      while (i < line.length) {
        if (line[i] === '"' && line[i + 1] === '"') { field += '"'; i += 2 }
        else if (line[i] === '"') { i++; break }
        else { field += line[i++] }
      }
      cols.push(field)
      if (line[i] === ',') i++
    } else {
      const end = line.indexOf(',', i)
      if (end === -1) { cols.push(line.slice(i)); break }
      cols.push(line.slice(i, end))
      i = end + 1
    }
  }
  return cols
}

export function useStarTimer() {
  const [data, setData] = useState(load)
  useEffect(() => { save(data) }, [data])

  // ── Attempts ──────────────────────────────────────────────────────────────

  const addAttempt = useCallback((stage, star, strategy, timeSeconds, success) => {
    const key = makeStarKey(stage, star, strategy)
    const attempt = {
      id: crypto.randomUUID(), timestamp: new Date().toISOString(),
      success: Boolean(success), timeSeconds: success ? Number(timeSeconds) : null,
    }
    setData(p => ({ ...p, attempts: { ...p.attempts, [key]: [...(p.attempts[key] ?? []), attempt] } }))
  }, [])

  const deleteAttempt = useCallback((stage, star, strategy, id) => {
    const key = makeStarKey(stage, star, strategy)
    setData(p => ({ ...p, attempts: { ...p.attempts, [key]: (p.attempts[key] ?? []).filter(a => a.id !== id) } }))
  }, [])

  const editAttempt = useCallback((stage, star, strategy, id, updates) => {
    const key = makeStarKey(stage, star, strategy)
    setData(p => ({
      ...p, attempts: { ...p.attempts, [key]: (p.attempts[key] ?? []).map(a => a.id === id ? { ...a, ...updates } : a) },
    }))
  }, [])

  const getAttempts = useCallback((stage, star, strategy) =>
    data.attempts[makeStarKey(stage, star, strategy)] ?? [], [data.attempts])

  const getSuccessTimes = useCallback((stage, star, strategy) =>
    (data.attempts[makeStarKey(stage, star, strategy)] ?? [])
      .filter(a => a.success && a.timeSeconds != null).map(a => a.timeSeconds),
  [data.attempts])

  // ── Collections ───────────────────────────────────────────────────────────

  const createCollection = useCallback((name, stars = [], offsetSeconds = null, lssSegmentName = null) => {
    const col = { id: crypto.randomUUID(), name, stars, offsetSeconds, lssSegmentName }
    setData(p => ({ ...p, collections: [...p.collections, col] }))
    return col.id
  }, [])

  const deleteCollection = useCallback((id) =>
    setData(p => ({ ...p, collections: p.collections.filter(c => c.id !== id) })), [])

  const renameCollection = useCallback((id, name) =>
    setData(p => ({ ...p, collections: p.collections.map(c => c.id === id ? { ...c, name } : c) })), [])

  const setCollectionOffset = useCallback((id, offsetSeconds, lssSegmentName) =>
    setData(p => ({
      ...p, collections: p.collections.map(c =>
        c.id === id ? { ...c, offsetSeconds: offsetSeconds ?? null, lssSegmentName: lssSegmentName ?? null } : c
      ),
    })), [])

  const addStarToCollection = useCallback((colId, stage, star, strategy) =>
    setData(p => ({
      ...p, collections: p.collections.map(c => {
        if (c.id !== colId) return c
        if (c.stars.some(s => s.stage === stage && s.star === star && s.strategy === strategy)) return c
        return { ...c, stars: [...c.stars, { stage, star, strategy }] }
      }),
    })), [])

  const removeStarFromCollection = useCallback((colId, stage, star, strategy) =>
    setData(p => ({
      ...p, collections: p.collections.map(c =>
        c.id !== colId ? c : {
          ...c, stars: c.stars.filter(s => !(s.stage === stage && s.star === star && s.strategy === strategy))
        }
      ),
    })), [])

  const getCollectionTimes = useCallback((colId) => {
    const col = data.collections.find(c => c.id === colId)
    if (!col) return []
    return col.stars.map(({ stage, star, strategy }) => ({
      stage, star, strategy, times: getSuccessTimes(stage, star, strategy),
    }))
  }, [data.collections, getSuccessTimes])

  const clearAll = useCallback(() => setData({ attempts: {}, collections: [] }), [])

  /**
   * Merge imported attempts into existing data.
   * mode: 'merge' (add alongside existing) | 'replace' (replace attempts only, keep collections)
   */
  const importData = useCallback((importedAttempts, mode = 'merge') => {
    setData(prev => {
      if (mode === 'replace') {
        return { ...prev, attempts: importedAttempts }
      }
      // merge: append imported attempts to existing ones
      const merged = { ...prev.attempts }
      for (const [key, list] of Object.entries(importedAttempts)) {
        merged[key] = [...(merged[key] ?? []), ...list]
      }
      return { ...prev, attempts: merged }
    })
  }, [])

  return {
    attempts: data.attempts, collections: data.collections,
    addAttempt, deleteAttempt, editAttempt, getAttempts, getSuccessTimes,
    createCollection, deleteCollection, renameCollection, setCollectionOffset,
    addStarToCollection, removeStarFromCollection, getCollectionTimes,
    clearAll, makeStarKey, importData,
  }
}

```

### `src/components/StarTimer/StarPicker.jsx`
```jsx
import { useState, useMemo } from 'react'
import catalogue from '../../data/stars_catalogue.json'
import './StarPicker.css'

const STAGES = catalogue.stars_catalogue

export function StarPicker({ onSelect, label = 'Add star', compact = false }) {
  const [stageIdx, setStageIdx] = useState('')
  const [starIdx,  setStarIdx]  = useState('')
  const [stratIdx, setStratIdx] = useState('')

  const stage   = stageIdx !== '' ? STAGES[+stageIdx] : null
  const star    = stage && starIdx !== '' ? stage.stars[+starIdx] : null
  const strategy = star && stratIdx !== '' ? star.strategies[+stratIdx] : null

  function handleSelect() {
    if (!stage || !star || !strategy) return
    onSelect({ stage: stage.stage, star: star.name, strategy })
    setStageIdx(''); setStarIdx(''); setStratIdx('')
  }

  const ready = stage && star && strategy

  return (
    <div className={'star-picker' + (compact ? ' star-picker--compact' : '')}>
      <select className="star-picker__select"
        value={stageIdx} onChange={e => { setStageIdx(e.target.value); setStarIdx(''); setStratIdx('') }}>
        <option value="">Stage...</option>
        {STAGES.map((s, i) => <option key={i} value={i}>{s.stage}</option>)}
      </select>

      <select className="star-picker__select"
        value={starIdx} onChange={e => { setStarIdx(e.target.value); setStratIdx('') }}
        disabled={!stage}>
        <option value="">Star...</option>
        {stage?.stars.map((s, i) => <option key={i} value={i}>{s.name}</option>)}
      </select>

      <select className="star-picker__select"
        value={stratIdx} onChange={e => setStratIdx(e.target.value)}
        disabled={!star}>
        <option value="">Strategy...</option>
        {star?.strategies.map((s, i) => <option key={i} value={i}>{s}</option>)}
      </select>

      <button className="star-picker__btn" onClick={handleSelect} disabled={!ready}>
        {label}
      </button>
    </div>
  )
}

```

### `src/components/StarTimer/StarPicker.css`
```css
.star-picker {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  align-items: center;
}

.star-picker--compact {
  gap: 0.4rem;
}

.star-picker__select {
  background: var(--bg-raised);
  border: 1px solid var(--border-hi);
  border-radius: var(--radius);
  color: var(--text-1);
  font-family: var(--font-mono);
  font-size: 0.75rem;
  padding: 0.4rem 0.6rem;
  outline: none;
  transition: border-color var(--transition);
  flex: 1;
  min-width: 120px;
}

.star-picker__select:focus { border-color: var(--star); }
.star-picker__select:disabled { opacity: 0.4; cursor: not-allowed; }
.star-picker__select option { background: var(--bg-raised); }

.star-picker__btn {
  background: transparent;
  border: 1px solid var(--star);
  border-radius: var(--radius);
  color: var(--star);
  font-family: var(--font-mono);
  font-size: 0.75rem;
  padding: 0.4rem 0.9rem;
  cursor: pointer;
  white-space: nowrap;
  transition: background var(--transition), color var(--transition);
  flex-shrink: 0;
}

.star-picker__btn:hover:not(:disabled) {
  background: var(--star);
  color: var(--bg);
}

.star-picker__btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

```

### `src/components/StarTimer/AttemptLog.jsx`
```jsx
import { useState } from 'react'
import './AttemptLog.css'

function parseTime(str) {
  str = str.trim()
  if (!str) return null
  const m = str.match(/^(\d+):([0-5]\d)(\.\d+)?$/)
  if (m) return parseInt(m[1], 10) * 60 + parseFloat(m[2] + (m[3] || ''))
  const n = parseFloat(str)
  return isNaN(n) ? null : n
}

export function fmtTime(s) {
  if (s == null) return '--'
  const m = Math.floor(s / 60)
  const sec = (s % 60).toFixed(2).padStart(5, '0')
  return m > 0 ? `${m}:${sec}` : `${sec}s`
}

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function AttemptLog({
  stage, star, strategy,
  attempts,
  onAdd, onDelete, onEdit,
  // selection support
  checked, onCheckedChange,
  // close button
  onClose,
}) {
  const [timeStr,  setTimeStr]  = useState('')
  const [success,  setSuccess]  = useState(true)
  const [inputErr, setInputErr] = useState(null)
  const [editId,   setEditId]   = useState(null)
  const [editStr,  setEditStr]  = useState('')
  const [histOpen, setHistOpen] = useState(true)

  const successTimes = attempts.filter(a => a.success && a.timeSeconds != null).map(a => a.timeSeconds)
  const mean = successTimes.length ? successTimes.reduce((a, b) => a + b, 0) / successTimes.length : null
  const best = successTimes.length ? Math.min(...successTimes) : null
  const successRate = attempts.length
    ? ((attempts.filter(a => a.success).length / attempts.length) * 100).toFixed(0)
    : null

  function handleAdd() {
    setInputErr(null)
    if (success) {
      const t = parseTime(timeStr)
      if (!t || t <= 0) { setInputErr('Enter a valid time (e.g. 1:23.45 or 83.45)'); return }
      onAdd(stage, star, strategy, t, true)
    } else {
      onAdd(stage, star, strategy, null, false)
    }
    setTimeStr('')
  }

  function startEdit(a) { setEditId(a.id); setEditStr(a.timeSeconds != null ? fmtTime(a.timeSeconds) : '') }

  function saveEdit(a) {
    if (a.success) {
      const t = parseTime(editStr)
      if (!t || t <= 0) return
      onEdit(stage, star, strategy, a.id, { timeSeconds: t })
    }
    setEditId(null)
  }

  return (
    <div className={'alog' + (checked ? ' alog--checked' : '')}>
      {/* Header row */}
      <div className="alog__header">
        {onCheckedChange != null && (
          <input
            type="checkbox"
            className="alog__checkbox"
            checked={!!checked}
            onChange={e => onCheckedChange(e.target.checked)}
            title="Select for collection"
          />
        )}
        <div className="alog__title">
          <span className="alog__star">{star}</span>
          <span className="alog__strategy text-3">{strategy}</span>
        </div>
        {attempts.length > 0 && (
          <div className="alog__stats">
            <span className="alog__stat"><span className="text-3">att</span> <b>{attempts.length}</b></span>
            <span className="alog__stat"><span className="text-3">ok</span> <b className="text-green">{successRate}%</b></span>
            {best != null && <span className="alog__stat"><span className="text-3">best</span> <b className="text-star">{fmtTime(best)}</b></span>}
            {mean != null && <span className="alog__stat"><span className="text-3">avg</span>  <b className="text-2">{fmtTime(mean)}</b></span>}
          </div>
        )}
        <div className="alog__hdr-actions">
          {attempts.length > 0 && (
            <button
              className="alog__collapse-btn"
              onClick={() => setHistOpen(v => !v)}
              title={histOpen ? 'Collapse history' : 'Expand history'}
            >
              {histOpen ? '▲' : '▼'} {attempts.length}
            </button>
          )}
          {onClose && (
            <button className="alog__close-btn" onClick={onClose} title="Close">✕</button>
          )}
        </div>
      </div>

      {/* Entry row */}
      <div className="alog__entry">
        <button
          className={'alog__toggle' + (success ? ' alog__toggle--success' : ' alog__toggle--fail')}
          onClick={() => setSuccess(v => !v)}
        >
          {success ? 'Success' : 'Fail'}
        </button>
        {success && (
          <input
            className={'alog__input' + (inputErr ? ' alog__input--err' : '')}
            type="text" placeholder="e.g. 1:23.45"
            value={timeStr}
            onChange={e => setTimeStr(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
          />
        )}
        <button className="alog__add-btn" onClick={handleAdd}>+ Log</button>
        {inputErr && <span className="alog__err">{inputErr}</span>}
      </div>

      {/* History — collapsible */}
      {histOpen && attempts.length > 0 && (
        <div className="alog__history">
          {[...attempts].reverse().map(a => (
            <div key={a.id} className={'alog__row' + (a.success ? '' : ' alog__row--fail')}>
              <span className="alog__row-date text-3">{fmtDate(a.timestamp)}</span>

              {editId === a.id ? (
                <input
                  className="alog__input alog__input--inline"
                  value={editStr}
                  onChange={e => setEditStr(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveEdit(a); if (e.key === 'Escape') setEditId(null) }}
                  autoFocus
                />
              ) : (
                <span className={'alog__row-time' + (a.success ? ' text-star' : ' text-3')}>
                  {a.success ? fmtTime(a.timeSeconds) : 'fail'}
                </span>
              )}

              <div className="alog__row-actions">
                {editId === a.id ? (
                  <>
                    <button className="alog__action alog__action--save" onClick={() => saveEdit(a)}>save</button>
                    <button className="alog__action" onClick={() => setEditId(null)}>cancel</button>
                  </>
                ) : (
                  <>
                    {a.success && <button className="alog__action" onClick={() => startEdit(a)}>edit</button>}
                    <button className="alog__action alog__action--del" onClick={() => onDelete(stage, star, strategy, a.id)}>del</button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

```

### `src/components/StarTimer/AttemptLog.css`
```css
.alog {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 0.9rem 1rem;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  transition: border-color var(--transition);
}

.alog--checked {
  border-color: var(--purple);
  background: rgba(168,85,247,0.04);
}

.alog__header {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.alog__checkbox {
  width: 15px; height: 15px;
  accent-color: var(--purple);
  cursor: pointer;
  flex-shrink: 0;
}

.alog__hdr-actions {
  margin-left: auto;
  display: flex;
  gap: 0.4rem;
  align-items: center;
  flex-shrink: 0;
}

.alog__collapse-btn,
.alog__close-btn {
  background: transparent;
  border: none;
  color: var(--text-3);
  font-family: var(--font-mono);
  font-size: 0.65rem;
  cursor: pointer;
  padding: 0.15rem 0.35rem;
  border-radius: var(--radius);
  transition: color var(--transition);
  line-height: 1;
}
.alog__collapse-btn:hover { color: var(--text-1); }
.alog__close-btn:hover    { color: var(--red); }

.alog__title { display: flex; flex-direction: column; gap: 0.15rem; }

.alog__star {
  font-family: var(--font-display);
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--text-1);
}

.alog__strategy { font-size: 0.7rem; }

.alog__stats {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  align-items: center;
}

.alog__stat { font-family: var(--font-mono); font-size: 0.72rem; display: flex; gap: 0.3rem; align-items: baseline; }

/* Entry row */
.alog__entry {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.alog__toggle {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  padding: 0.35rem 0.65rem;
  border-radius: var(--radius);
  border: 1px solid;
  cursor: pointer;
  transition: all var(--transition);
  white-space: nowrap;
}

.alog__toggle--success {
  border-color: var(--green);
  color: var(--green);
  background: transparent;
}
.alog__toggle--success:hover { background: var(--green); color: var(--bg); }

.alog__toggle--fail {
  border-color: var(--red);
  color: var(--red);
  background: transparent;
}
.alog__toggle--fail:hover { background: var(--red); color: var(--bg); }

.alog__input {
  background: var(--bg-raised);
  border: 1px solid var(--border-hi);
  border-radius: var(--radius);
  color: var(--text-1);
  font-family: var(--font-mono);
  font-size: 0.75rem;
  padding: 0.35rem 0.6rem;
  outline: none;
  width: 110px;
  transition: border-color var(--transition);
}
.alog__input:focus { border-color: var(--star); }
.alog__input--err { border-color: var(--red); }
.alog__input--inline { width: 90px; }

.alog__add-btn {
  background: transparent;
  border: 1px solid var(--purple);
  border-radius: var(--radius);
  color: var(--purple);
  font-family: var(--font-mono);
  font-size: 0.72rem;
  padding: 0.35rem 0.75rem;
  cursor: pointer;
  transition: all var(--transition);
}
.alog__add-btn:hover { background: var(--purple); color: var(--bg); }

.alog__err { font-size: 0.7rem; color: var(--red); font-family: var(--font-mono); }

/* History */
.alog__history {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  max-height: 200px;
  overflow-y: auto;
  border-top: 1px solid var(--border);
  padding-top: 0.5rem;
}

.alog__row {
  display: grid;
  grid-template-columns: 60px 80px 1fr;
  align-items: center;
  gap: 0.5rem;
  padding: 0.15rem 0;
}
.alog__row--fail { opacity: 0.55; }

.alog__row-date { font-size: 0.65rem; }
.alog__row-time { font-family: var(--font-mono); font-size: 0.75rem; }

.alog__row-actions { display: flex; gap: 0.4rem; }

.alog__action {
  background: transparent;
  border: none;
  color: var(--text-3);
  font-family: var(--font-mono);
  font-size: 0.65rem;
  cursor: pointer;
  padding: 0.1rem 0.3rem;
  border-radius: var(--radius);
  transition: color var(--transition);
}
.alog__action:hover { color: var(--text-1); }
.alog__action--del:hover { color: var(--red); }
.alog__action--save:hover { color: var(--green); }

```

### `src/components/StarTimer/CollectionBuilder.jsx`
```jsx
import { useState } from 'react'
import { StarPicker } from './StarPicker'
import { PRESET_CATEGORIES } from '../../data/presets'
import './CollectionBuilder.css'

function OffsetFields({ col, onSetOffset }) {
  const [editing, setEditing] = useState(false)
  const [seg,     setSeg]     = useState(col.lssSegmentName ?? '')
  const [off,     setOff]     = useState(col.offsetSeconds != null ? String(col.offsetSeconds) : '')

  function save() {
    const parsed = off.trim() ? parseFloat(off) : null
    onSetOffset(col.id, isNaN(parsed) ? null : parsed, seg.trim() || null)
    setEditing(false)
  }

  if (!editing) {
    const hasOffset = col.offsetSeconds != null
    return (
      <div className="cb__offset-row">
        {hasOffset ? (
          <span className="cb__offset-pill">
            +{col.offsetSeconds}s{col.lssSegmentName ? ` → "${col.lssSegmentName}"` : ''}
          </span>
        ) : (
          <span className="text-3 cb__offset-none">no offset</span>
        )}
        <button className="cb__action" onClick={() => setEditing(true)}>
          {hasOffset ? 'edit offset' : 'add offset'}
        </button>
      </div>
    )
  }

  return (
    <div className="cb__offset-edit">
      <input
        className="cb__input cb__input--sm"
        type="number" min="0" step="0.1"
        placeholder="seconds (optional)"
        value={off}
        onChange={e => setOff(e.target.value)}
      />
      <input
        className="cb__input cb__input--seg"
        type="text"
        placeholder=".lss segment name (optional)"
        value={seg}
        onChange={e => setSeg(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && save()}
      />
      <button className="cb__action cb__action--save" onClick={save}>save</button>
      <button className="cb__action" onClick={() => setEditing(false)}>cancel</button>
    </div>
  )
}

export function CollectionBuilder({
  collections,
  onCreateCollection,
  onDeleteCollection,
  onRenameCollection,
  onSetOffset,
  onAddStar,
  onRemoveStar,
  getSuccessTimes,
}) {
  const [newName,     setNewName]     = useState('')
  const [renamingId,  setRenamingId]  = useState(null)
  const [renameVal,   setRenameVal]   = useState('')
  const [expandedId,  setExpandedId]  = useState(null)
  const [activeCategory, setActiveCategory] = useState(PRESET_CATEGORIES[0]?.id ?? '')

  function handleCreate() {
    const name = newName.trim()
    if (!name) return
    onCreateCollection(name)
    setNewName('')
  }

  function handlePreset(preset) {
    onCreateCollection(preset.label, preset.stars)
  }

  function commitRename(id) {
    const v = renameVal.trim()
    if (v) onRenameCollection(id, v)
    setRenamingId(null)
  }

  const activePresets = PRESET_CATEGORIES.find(c => c.id === activeCategory)?.presets ?? []

  return (
    <div className="cb">
      {/* ── New collection ─────────────────────────────────────── */}
      <section className="cb__section">
        <h3 className="cb__section-title">New collection</h3>
        <div className="cb__new-row">
          <input
            className="cb__input"
            placeholder="Collection name..."
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
          />
          <button className="cb__btn cb__btn--create" onClick={handleCreate} disabled={!newName.trim()}>
            + Create
          </button>
        </div>
      </section>

      {/* ── Presets by category ────────────────────────────────── */}
      <section className="cb__section">
        <h3 className="cb__section-title">Create from preset</h3>
        <div className="cb__cat-tabs">
          {PRESET_CATEGORIES.map(cat => (
            <button
              key={cat.id}
              className={'cb__cat-tab' + (activeCategory === cat.id ? ' is-active' : '')}
              onClick={() => setActiveCategory(cat.id)}
            >
              {cat.label}
            </button>
          ))}
        </div>
        {activePresets.length > 0 ? (
          <div className="cb__presets">
            {activePresets.map(p => (
              <button key={p.id} className="cb__preset-btn" onClick={() => handlePreset(p)}>
                {p.label}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-3 cb__empty" style={{ paddingTop: '0.4rem' }}>
            No presets defined for this category — edit <code>src/data/presets.js</code> to add some.
          </p>
        )}
      </section>

      {/* ── Existing collections ───────────────────────────────── */}
      {collections.length > 0 && (
        <section className="cb__section">
          <h3 className="cb__section-title">Your collections</h3>
          <div className="cb__list">
            {collections.map(col => {
              const starCount  = col.stars.length
              const timedStars = col.stars.filter(s => getSuccessTimes(s.stage, s.star, s.strategy).length > 0).length
              const expanded   = expandedId === col.id

              return (
                <div key={col.id} className="cb__col">
                  <div className="cb__col-header">
                    {renamingId === col.id ? (
                      <input
                        className="cb__input cb__input--inline"
                        value={renameVal}
                        onChange={e => setRenameVal(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') commitRename(col.id); if (e.key === 'Escape') setRenamingId(null) }}
                        onBlur={() => commitRename(col.id)}
                        autoFocus
                      />
                    ) : (
                      <span className="cb__col-name">{col.name}</span>
                    )}
                    <span className="cb__col-meta text-3">{timedStars}/{starCount} timed</span>
                    <div className="cb__col-actions">
                      <button className="cb__action" onClick={() => setExpandedId(expanded ? null : col.id)}>
                        {expanded ? 'collapse' : 'edit'}
                      </button>
                      <button className="cb__action" onClick={() => { setRenamingId(col.id); setRenameVal(col.name) }}>rename</button>
                      <button className="cb__action cb__action--del" onClick={() => onDeleteCollection(col.id)}>delete</button>
                    </div>
                  </div>

                  {/* Offset row always visible */}
                  <div className="cb__col-offset">
                    <OffsetFields col={col} onSetOffset={onSetOffset} />
                  </div>

                  {expanded && (
                    <div className="cb__col-body">
                      <div className="cb__star-list">
                        {col.stars.length === 0 && (
                          <p className="text-3 cb__empty">No stars yet — add some below.</p>
                        )}
                        {col.stars.map((s, i) => {
                          const n = getSuccessTimes(s.stage, s.star, s.strategy).length
                          return (
                            <div key={i} className="cb__star-row">
                              <span className="cb__star-name">{s.star}</span>
                              <span className="cb__star-strat text-3">{s.strategy}</span>
                              <span className={'cb__star-count text-3' + (n === 0 ? ' cb__star-count--zero' : '')}>
                                {n}×
                              </span>
                              <button className="cb__action cb__action--del"
                                onClick={() => onRemoveStar(col.id, s.stage, s.star, s.strategy)}>
                                remove
                              </button>
                            </div>
                          )
                        })}
                      </div>
                      <div className="cb__add-star">
                        <span className="text-3">Add star:</span>
                        <StarPicker compact label="Add"
                          onSelect={({ stage, star, strategy }) => onAddStar(col.id, stage, star, strategy)} />
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {collections.length === 0 && (
        <p className="text-3 cb__empty-state">No collections yet. Create one above or start from a preset.</p>
      )}
    </div>
  )
}

```

### `src/components/StarTimer/CollectionBuilder.css`
```css
.cb {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.cb__section { display: flex; flex-direction: column; gap: 0.6rem; }

.cb__section-title {
  font-family: var(--font-display);
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--text-2);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.cb__new-row { display: flex; gap: 0.5rem; }

.cb__input {
  background: var(--bg-raised);
  border: 1px solid var(--border-hi);
  border-radius: var(--radius);
  color: var(--text-1);
  font-family: var(--font-mono);
  font-size: 0.78rem;
  padding: 0.45rem 0.65rem;
  outline: none;
  transition: border-color var(--transition);
  flex: 1;
}
.cb__input:focus { border-color: var(--star); }
.cb__input--inline { flex: none; width: 200px; }

.cb__btn {
  background: transparent;
  border: 1px solid var(--border-hi);
  border-radius: var(--radius);
  color: var(--text-2);
  font-family: var(--font-mono);
  font-size: 0.75rem;
  padding: 0.45rem 0.9rem;
  cursor: pointer;
  white-space: nowrap;
  transition: all var(--transition);
}
.cb__btn:disabled { opacity: 0.35; cursor: not-allowed; }
.cb__btn--create { border-color: var(--star); color: var(--star); }
.cb__btn--create:hover:not(:disabled) { background: var(--star); color: var(--bg); }

/* Category tab bar */
.cb__cat-tabs {
  display: flex;
  gap: 0;
  border-bottom: 1px solid var(--border);
  margin-bottom: 0.6rem;
  flex-wrap: wrap;
}

.cb__cat-tab {
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--text-3);
  font-family: var(--font-mono);
  font-size: 0.72rem;
  padding: 0.4rem 0.85rem;
  cursor: pointer;
  margin-bottom: -1px;
  transition: color var(--transition), border-color var(--transition);
  white-space: nowrap;
}
.cb__cat-tab:hover { color: var(--text-1); }
.cb__cat-tab.is-active { color: var(--star); border-bottom-color: var(--star); }

/* Presets */
.cb__presets {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.cb__preset-btn {
  background: transparent;
  border: 1px solid var(--border-hi);
  border-radius: var(--radius);
  color: var(--text-3);
  font-family: var(--font-mono);
  font-size: 0.7rem;
  padding: 0.3rem 0.65rem;
  cursor: pointer;
  transition: all var(--transition);
}
.cb__preset-btn:hover { border-color: var(--purple); color: var(--purple); }

/* Per-collection offset */
.cb__col-offset {
  padding: 0.4rem 1rem 0.5rem;
  border-top: 1px solid var(--border);
  background: rgba(0,0,0,0.15);
}

.cb__offset-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.cb__offset-pill {
  font-family: var(--font-mono);
  font-size: 0.68rem;
  color: var(--star);
  background: rgba(201,162,39,0.1);
  border: 1px solid rgba(201,162,39,0.25);
  border-radius: var(--radius);
  padding: 0.15rem 0.45rem;
}

.cb__offset-none { font-size: 0.68rem; }

.cb__offset-edit {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.cb__input--sm  { width: 110px; flex-shrink: 0; }
.cb__input--seg { flex: 1; min-width: 160px; }
.cb__action--save { color: var(--green); }
.cb__action--save:hover { color: var(--green); background: rgba(61,214,140,0.1); }

/* Collection list */
.cb__list { display: flex; flex-direction: column; gap: 0.75rem; }

.cb__col {
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--bg-card);
  overflow: hidden;
}

.cb__col-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.7rem 1rem;
  flex-wrap: wrap;
}

.cb__col-name {
  font-family: var(--font-display);
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--text-1);
  flex: 1;
  min-width: 120px;
}

.cb__col-meta { font-size: 0.68rem; }

.cb__col-actions { display: flex; gap: 0.4rem; margin-left: auto; }

.cb__action {
  background: transparent;
  border: none;
  color: var(--text-3);
  font-family: var(--font-mono);
  font-size: 0.68rem;
  cursor: pointer;
  padding: 0.2rem 0.4rem;
  border-radius: var(--radius);
  transition: color var(--transition);
}
.cb__action:hover { color: var(--text-1); }
.cb__action--del:hover { color: var(--red); }

/* Collection body */
.cb__col-body {
  border-top: 1px solid var(--border);
  padding: 0.75rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.cb__star-list { display: flex; flex-direction: column; gap: 0.3rem; }

.cb__star-row {
  display: grid;
  grid-template-columns: 1fr auto auto auto;
  align-items: center;
  gap: 0.75rem;
  padding: 0.2rem 0;
}

.cb__star-name { font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-1); }
.cb__star-strat { font-size: 0.67rem; }
.cb__star-count { font-size: 0.67rem; }
.cb__star-count--zero { color: var(--red); }

.cb__add-star {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
  padding-top: 0.5rem;
  border-top: 1px solid var(--border);
}
.cb__add-star-label { font-size: 0.7rem; white-space: nowrap; }

.cb__empty { font-size: 0.75rem; padding: 0.3rem 0; }
.cb__empty-state { font-size: 0.8rem; text-align: center; padding: 2rem 0; }

```

### `src/components/StarTimer/CollectionChart.jsx`
```jsx
import { useEffect, useRef, useState } from 'react'
import './CollectionChart.css'

function fmtTime(s) {
  if (s == null) return '--'
  const m = Math.floor(s / 60)
  const sec = (s % 60).toFixed(2).padStart(5, '0')
  return m > 0 ? `${m}:${sec}` : `${sec}s`
}

function autoZoom(x, pdf) {
  const dx = x[1] - x[0]
  const total = pdf.reduce((a, b) => a + b, 0) * dx
  let lo = x[0], hi = x[x.length - 1], cum = 0
  for (let i = 0; i < pdf.length; i++) {
    cum += pdf[i] * dx
    if (cum / total >= 0.005 && lo === x[0]) lo = x[i]
    if (cum / total >= 0.995) { hi = x[i]; break }
  }
  const span = hi - lo
  return [Math.max(0, lo - span * 0.05), hi + span * 0.05]
}

export function CollectionChart({ collection, starRows, result, computing, onCompute }) {
  const containerRef = useRef(null)
  const plotRef = useRef(null)

  // Load Plotly once
  useEffect(() => {
    if (window.Plotly) return
    const s = document.createElement('script')
    s.src = 'https://cdn.jsdelivr.net/npm/plotly.js-dist-min@2.35.2/plotly.min.js'
    document.head.appendChild(s)
  }, [])

  useEffect(() => {
    if (!result || !containerRef.current || !window.Plotly) return

    const { x, pdf, cdf, percentiles } = result
    const xMin = x.map(v => v / 60)
    const [zLo, zHi] = autoZoom(xMin, pdf)

    const pdfTrace = {
      x: xMin, y: pdf, type: 'scatter', mode: 'lines', name: 'PDF',
      line: { color: '#a855f7', width: 2, shape: 'spline' },
      fill: 'tozeroy', fillcolor: 'rgba(168,85,247,0.08)',
      hovertemplate: '%{x:.2f} min<br>density: %{y:.4f}<extra></extra>',
    }

    const p50Min = percentiles.p50 / 60
    const shapes = [{
      type: 'line', x0: p50Min, x1: p50Min, y0: 0, y1: 1,
      xref: 'x', yref: 'paper',
      line: { color: 'rgba(144,144,168,0.6)', width: 1, dash: 'dash' },
    }]
    const annotations = [{
      x: p50Min, y: 0.9, xref: 'x', yref: 'paper',
      text: `median<br>${fmtTime(percentiles.p50)}`,
      showarrow: false,
      font: { color: 'rgba(144,144,168,0.8)', size: 10, family: 'Space Mono' },
      bgcolor: 'rgba(10,10,15,0.7)', borderpad: 3,
    }]

    const layout = {
      paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
      margin: { t: 16, r: 30, b: 44, l: 50 },
      font: { family: 'Space Mono, monospace', color: '#9090a8', size: 11 },
      showlegend: false,
      xaxis: {
        title: { text: 'Time (minutes)', standoff: 8 },
        gridcolor: '#1e1e28', zerolinecolor: '#2a2a38',
        tickformat: '.1f', color: '#55556a',
        range: [zLo, zHi],
      },
      yaxis: {
        title: { text: 'Density' }, gridcolor: '#1e1e28',
        zerolinecolor: '#2a2a38', color: '#55556a', rangemode: 'tozero',
      },
      shapes, annotations,
    }

    const config = {
      displayModeBar: false,
      toImageButtonOptions: { format: 'png', filename: `collection_${collection?.name ?? 'dist'}` },
    }

    if (!plotRef.current) {
      window.Plotly.newPlot(containerRef.current, [pdfTrace], layout, config)
      plotRef.current = true
    } else {
      window.Plotly.react(containerRef.current, [pdfTrace], layout, config)
    }
  }, [result])

  if (!collection) {
    return <p className="cc__empty text-3">Select a collection to compute its distribution.</p>
  }

  const totalTimed = starRows.filter(r => r.times.length > 0).length
  const missing    = starRows.filter(r => r.times.length < 5)
  const canCompute = totalTimed > 0

  return (
    <div className="cc">
      <div className="cc__header">
        <div>
          <h3 className="cc__title">{collection.name}</h3>
          <p className="cc__meta text-3">
            {totalTimed} / {starRows.length} stars have data
            {missing.length > 0 && (
              <span className="cc__warn"> — {missing.length} with &lt;5 times (low confidence)</span>
            )}
          </p>
          {collection.offsetSeconds != null && (
            <p className="cc__offset-pill">
              offset +{collection.offsetSeconds}s
              {collection.lssSegmentName ? ` → "${collection.lssSegmentName}"` : ''}
            </p>
          )}
        </div>
        <button className="cc__compute-btn" onClick={onCompute} disabled={computing || !canCompute}>
          {computing ? 'Computing...' : '> Compute distribution'}
        </button>
      </div>

      {result && (
        <>
          {/* Stats row */}
          <div className="cc__stats">
            {[
              { label: 'p10 (great)', value: fmtTime(result.percentiles.p10), color: 'var(--green)' },
              { label: 'p25',         value: fmtTime(result.percentiles.p25) },
              { label: 'p50 (median)',value: fmtTime(result.percentiles.p50), color: 'var(--star)' },
              { label: 'p75',         value: fmtTime(result.percentiles.p75) },
              { label: 'p90 (bad)',   value: fmtTime(result.percentiles.p90), color: 'var(--red)' },
            ].map(({ label, value, color }) => (
              <div key={label} className="cc__stat">
                <span className="cc__stat-label">{label}</span>
                <span className="cc__stat-value" style={{ color: color || 'var(--text-1)' }}>{value}</span>
              </div>
            ))}
          </div>

          {/* Chart */}
          <div className="cc__chart" ref={containerRef} />

          {/* Per-star breakdown */}
          <div className="cc__breakdown">
            <h4 className="cc__breakdown-title">Per-star breakdown</h4>
            <div className="cc__breakdown-table">
              <div className="cc__breakdown-hdr">
                <span>Star</span><span>Strategy</span><span>n</span><span>Best</span><span>Mean</span><span>Std</span><span>Var%</span>
              </div>
              {result.segment_stats.map((stat, i) => {
                const row = starRows[i]
                if (!row) return null
                return (
                  <div key={i} className={'cc__breakdown-row' + (stat.n < 5 ? ' cc__breakdown-row--warn' : '')}>
                    <span className="cc__bd-name">{row.star}</span>
                    <span className="cc__bd-strat text-3">{row.strategy}</span>
                    <span className={'cc__bd-n' + (stat.n < 5 ? ' text-red' : ' text-3')}>{stat.n}</span>
                    <span className="cc__bd-val text-star">{fmtTime(stat.best)}</span>
                    <span className="cc__bd-val text-2">{fmtTime(stat.mean)}</span>
                    <span className="cc__bd-val text-3">{fmtTime(stat.std)}</span>
                    <span className="cc__bd-val text-3">{(stat.variance_share * 100).toFixed(1)}%</span>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}

      {!result && !computing && canCompute && (
        <p className="text-3 cc__hint">Press compute to see the distribution for this collection.</p>
      )}
      {!canCompute && (
        <p className="text-3 cc__hint">Log at least one successful attempt to compute a distribution.</p>
      )}
    </div>
  )
}

```

### `src/components/StarTimer/CollectionChart.css`
```css
.cc { display: flex; flex-direction: column; gap: 1rem; }

.cc__empty { text-align: center; padding: 3rem 0; }
.cc__hint  { text-align: center; padding: 1.5rem 0; font-size: 0.75rem; }

.cc__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.cc__title {
  font-family: var(--font-display);
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-1);
}

.cc__meta { font-size: 0.7rem; margin-top: 0.2rem; }
.cc__warn { color: var(--star); }

.cc__offset-pill {
  margin-top: 0.25rem;
  font-family: var(--font-mono);
  font-size: 0.65rem;
  color: var(--star);
  background: rgba(201,162,39,0.08);
  border: 1px solid rgba(201,162,39,0.2);
  border-radius: var(--radius);
  display: inline-block;
  padding: 0.1rem 0.4rem;
}

.cc__compute-btn {
  background: transparent;
  border: 1px solid var(--purple);
  border-radius: var(--radius);
  color: var(--purple);
  font-family: var(--font-mono);
  font-size: 0.75rem;
  padding: 0.45rem 1rem;
  cursor: pointer;
  white-space: nowrap;
  transition: all var(--transition);
  flex-shrink: 0;
}
.cc__compute-btn:hover:not(:disabled) { background: var(--purple); color: var(--bg); }
.cc__compute-btn:disabled { opacity: 0.4; cursor: not-allowed; }

/* Stats row */
.cc__stats {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
  gap: 0.5rem;
}

.cc__stat {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 0.5rem 0.6rem;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}
.cc__stat-label { font-size: 0.6rem; text-transform: uppercase; letter-spacing: 0.07em; color: var(--text-3); }
.cc__stat-value { font-family: var(--font-mono); font-size: 0.82rem; font-weight: 600; }

.cc__chart { height: 240px; }

/* Breakdown table */
.cc__breakdown { display: flex; flex-direction: column; gap: 0.4rem; }

.cc__breakdown-title {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-3);
  font-weight: 600;
}

.cc__breakdown-hdr,
.cc__breakdown-row {
  display: grid;
  grid-template-columns: 1fr auto 2.5rem 4rem 4rem 4rem 3.5rem;
  gap: 0.5rem;
  align-items: center;
  padding: 0.25rem 0.4rem;
  font-family: var(--font-mono);
  font-size: 0.7rem;
}

.cc__breakdown-hdr {
  color: var(--text-3);
  border-bottom: 1px solid var(--border);
  padding-bottom: 0.35rem;
}

.cc__breakdown-row { border-bottom: 1px solid var(--border); }
.cc__breakdown-row:last-child { border-bottom: none; }
.cc__breakdown-row--warn { background: rgba(201,162,39,0.04); }

.cc__bd-name { color: var(--text-1); font-size: 0.72rem; }
.cc__bd-strat { font-size: 0.63rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cc__bd-n { text-align: right; }
.cc__bd-val { text-align: right; }
.text-red { color: var(--red); }

```

### `src/components/StarTimer/CompareView.jsx`
```jsx
import { useEffect, useRef } from 'react'
import './CompareView.css'

function fmtTime(s) {
  if (s == null) return '--'
  const m = Math.floor(s / 60)
  const sec = (s % 60).toFixed(2).padStart(5, '0')
  return m > 0 ? `${m}:${sec}` : `${sec}s`
}

function autoZoom(results) {
  let lo = Infinity, hi = -Infinity
  for (const r of results) {
    if (!r) continue
    const xMin = r.x.map(v => v / 60)
    const pdf  = r.pdf
    const dx   = xMin[1] - xMin[0]
    const tot  = pdf.reduce((a, b) => a + b, 0) * dx
    let cum = 0
    for (let i = 0; i < pdf.length; i++) {
      cum += pdf[i] * dx
      if (cum / tot >= 0.005 && lo === Infinity) lo = xMin[i]
      if (cum / tot >= 0.995) { hi = xMin[i]; break }
    }
  }
  if (!isFinite(lo)) return [0, 10]
  const span = hi - lo
  return [Math.max(0, lo - span * 0.08), hi + span * 0.08]
}

const COLORS = [
  { line: '#a855f7', fill: 'rgba(168,85,247,0.09)' },
  { line: '#f5c842', fill: 'rgba(245,200,66,0.09)'  },
]

export function CompareView({ collections, results, computing, onCompute }) {
  const containerRef = useRef(null)
  const plotRef      = useRef(null)

  useEffect(() => {
    if (window.Plotly) return
    const s = document.createElement('script')
    s.src = 'https://cdn.jsdelivr.net/npm/plotly.js-dist-min@2.35.2/plotly.min.js'
    document.head.appendChild(s)
  }, [])

  useEffect(() => {
    const r0 = results[0], r1 = results[1]
    if (!r0 || !r1 || !containerRef.current || !window.Plotly) return

    const [zLo, zHi] = autoZoom([r0, r1])

    const traces = [r0, r1].map((r, i) => ({
      x: r.x.map(v => v / 60), y: r.pdf,
      type: 'scatter', mode: 'lines',
      name: collections[i]?.name ?? `Collection ${i + 1}`,
      line:      { color: COLORS[i].line, width: 2, shape: 'spline' },
      fill:      'tozeroy',
      fillcolor: COLORS[i].fill,
      hovertemplate: '%{x:.2f} min<extra></extra>',
    }))

    const layout = {
      paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
      margin: { t: 16, r: 30, b: 44, l: 50 },
      font: { family: 'Space Mono, monospace', color: '#9090a8', size: 11 },
      showlegend: true,
      legend: { bgcolor: 'rgba(17,17,24,0.9)', bordercolor: '#2a2a38', borderwidth: 1,
        font: { size: 10 }, x: 1, xanchor: 'right', y: 1 },
      xaxis: { title: { text: 'Time (minutes)', standoff: 8 }, gridcolor: '#1e1e28',
        zerolinecolor: '#2a2a38', tickformat: '.1f', color: '#55556a', range: [zLo, zHi] },
      yaxis: { title: { text: 'Density' }, gridcolor: '#1e1e28',
        zerolinecolor: '#2a2a38', color: '#55556a', rangemode: 'tozero' },
    }

    if (!plotRef.current) {
      window.Plotly.newPlot(containerRef.current, traces, layout, { displayModeBar: false })
      plotRef.current = true
    } else {
      window.Plotly.react(containerRef.current, traces, layout)
    }
  }, [results, collections])

  const col0 = collections[0], col1 = collections[1]
  const r0   = results[0],   r1   = results[1]
  const bothSelected = col0 && col1

  return (
    <div className="cmp">
      <div className="cmp__selectors">
        {[0, 1].map(i => (
          <div key={i} className="cmp__selector" style={{ '--accent': COLORS[i].line }}>
            <span className="cmp__selector-dot" />
            <span className="cmp__selector-label text-3">Collection {i + 1}:</span>
            <span className="cmp__selector-name">{collections[i]?.name ?? <em className="text-3">not selected</em>}</span>
          </div>
        ))}
      </div>

      {!bothSelected && (
        <p className="text-3 cmp__hint">Select two collections in the Collections tab to compare them here.</p>
      )}

      {bothSelected && (
        <>
          <button className="cmp__compute-btn" onClick={onCompute} disabled={computing}>
            {computing ? 'Computing...' : '> Compare distributions'}
          </button>

          {r0 && r1 && (
            <>
              <div className="cmp__chart" ref={containerRef} />

              {/* Stat comparison table */}
              <div className="cmp__table">
                <div className="cmp__table-hdr">
                  <span />
                  <span style={{ color: COLORS[0].line }}>{col0.name}</span>
                  <span style={{ color: COLORS[1].line }}>{col1.name}</span>
                  <span className="text-3">diff</span>
                </div>
                {['p10', 'p25', 'p50', 'p75', 'p90'].map(p => {
                  const v0 = r0.percentiles[p], v1 = r1.percentiles[p]
                  const diff = v0 - v1
                  return (
                    <div key={p} className="cmp__table-row">
                      <span className="text-3">{p}</span>
                      <span className="text-star">{fmtTime(v0)}</span>
                      <span className="text-star">{fmtTime(v1)}</span>
                      <span style={{ color: diff < 0 ? 'var(--green)' : diff > 0 ? 'var(--red)' : 'var(--text-3)' }}>
                        {diff === 0 ? '--' : (diff > 0 ? '+' : '') + fmtTime(Math.abs(diff))}
                      </span>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

```

### `src/components/StarTimer/CompareView.css`
```css
.cmp { display: flex; flex-direction: column; gap: 1rem; }

.cmp__hint { text-align: center; padding: 2rem 0; font-size: 0.75rem; }

.cmp__selectors { display: flex; gap: 1.5rem; flex-wrap: wrap; }

.cmp__selector {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 0.5rem 0.75rem;
  flex: 1;
  min-width: 180px;
}

.cmp__selector-dot {
  width: 10px; height: 10px;
  border-radius: 50%;
  background: var(--accent);
  flex-shrink: 0;
}

.cmp__selector-label { font-size: 0.68rem; white-space: nowrap; }

.cmp__selector-name {
  font-family: var(--font-mono);
  font-size: 0.78rem;
  color: var(--text-1);
  font-weight: 600;
}

.cmp__compute-btn {
  align-self: flex-start;
  background: transparent;
  border: 1px solid var(--purple);
  border-radius: var(--radius);
  color: var(--purple);
  font-family: var(--font-mono);
  font-size: 0.75rem;
  padding: 0.45rem 1rem;
  cursor: pointer;
  transition: all var(--transition);
}
.cmp__compute-btn:hover:not(:disabled) { background: var(--purple); color: var(--bg); }
.cmp__compute-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.cmp__chart { height: 260px; }

/* Comparison table */
.cmp__table { display: flex; flex-direction: column; gap: 0; }

.cmp__table-hdr,
.cmp__table-row {
  display: grid;
  grid-template-columns: 3rem 1fr 1fr 5rem;
  gap: 0.75rem;
  padding: 0.3rem 0.5rem;
  font-family: var(--font-mono);
  font-size: 0.75rem;
  align-items: center;
}

.cmp__table-hdr {
  font-size: 0.7rem;
  font-weight: 600;
  border-bottom: 1px solid var(--border);
  padding-bottom: 0.4rem;
}

.cmp__table-row { border-bottom: 1px solid var(--border); }
.cmp__table-row:last-child { border-bottom: none; }

```

### `src/components/StarTimer/SegmentSwap.jsx`
```jsx
import { useEffect, useRef, useState } from 'react'
import './SegmentSwap.css'

function fmtTime(s) {
  if (s == null) return '--'
  const m = Math.floor(s / 60)
  const sec = (s % 60).toFixed(2).padStart(5, '0')
  return m > 0 ? `${m}:${sec}` : `${sec}s`
}

function fmtPct(v) {
  if (v == null) return '--'
  return (v * 100).toFixed(1) + '%'
}

function autoZoom(traces) {
  let lo = Infinity, hi = -Infinity
  for (const t of traces) {
    if (!t) continue
    const dx = t.x[1] - t.x[0]
    const tot = t.pdf.reduce((a, b) => a + b, 0) * dx
    let cum = 0
    for (let i = 0; i < t.pdf.length; i++) {
      cum += t.pdf[i] * dx
      if (cum / tot >= 0.005 && lo === Infinity) lo = t.x[i]
      if (cum / tot >= 0.995) { hi = t.x[i]; break }
    }
  }
  if (!isFinite(lo)) return [0, 10]
  const span = hi - lo
  return [Math.max(0, lo - span * 0.08), hi + span * 0.08]
}

// One swap slot row in the controls panel
function SwapSlot({ slot, index, segments, collections, onChange, onRemove, canRemove }) {
  const selectedCol = collections.find(c => c.id === slot.collectionId) ?? null
  const resolvedSegment = slot.manualSegment.trim() || selectedCol?.lssSegmentName || ''
  const resolvedOffset = slot.manualOffset !== ''
    ? (parseFloat(slot.manualOffset) || 0)
    : (selectedCol?.offsetSeconds ?? 0)
  const segmentOk = resolvedSegment && segments.includes(resolvedSegment)

  return (
    <div className="sswap__slot">
      <div className="sswap__slot-header">
        <span className="sswap__slot-label">Swap {index + 1}</span>
        {canRemove && (
          <button className="sswap__slot-remove" onClick={onRemove} title="Remove this swap">
            [x]
          </button>
        )}
      </div>

      {/* Collection picker */}
      <div className="sswap__field">
        <label className="sswap__label">Collection</label>
        <select className="sswap__select" value={slot.collectionId}
          onChange={e => onChange({ ...slot, collectionId: e.target.value, manualOffset: '', manualSegment: '' })}>
          <option value="">-- select collection --</option>
          {collections.map(c => (
            <option key={c.id} value={c.id}>
              {c.name}{c.lssSegmentName ? ` [${c.lssSegmentName}]` : ''}
              {c.offsetSeconds != null ? ` (+${c.offsetSeconds}s)` : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Stored segment/offset info */}
      {selectedCol && (
        <div className="sswap__col-offset-info">
          {selectedCol.lssSegmentName
            ? <span className="text-3">Segment: <b className="text-2">{selectedCol.lssSegmentName}</b></span>
            : <span className="text-3 sswap__warn">No segment set — select below or set in Collections tab.</span>}
          {selectedCol.offsetSeconds != null &&
            <span className="text-3">Offset: <b className="text-star">+{selectedCol.offsetSeconds}s</b></span>}
        </div>
      )}

      {/* Manual overrides */}
      <div className="sswap__slot-overrides">
        <div className="sswap__field">
          <label className="sswap__label">
            LSS segment{selectedCol?.lssSegmentName ? ' (override)' : ' (required)'}
          </label>
          <select className="sswap__select" value={slot.manualSegment}
            onChange={e => onChange({ ...slot, manualSegment: e.target.value })}>
            <option value="">
              {selectedCol?.lssSegmentName
                ? `-- use default (${selectedCol.lssSegmentName}) --`
                : '-- select segment --'}
            </option>
            {segments.map(name => <option key={name} value={name}>{name}</option>)}
          </select>
        </div>
        <div className="sswap__field">
          <label className="sswap__label">
            Offset (s){selectedCol?.offsetSeconds != null ? ` (override — has ${selectedCol.offsetSeconds}s)` : ' (optional)'}
          </label>
          <input
            className="sswap__input"
            type="number" min="0" step="0.1"
            placeholder={selectedCol?.offsetSeconds != null ? String(selectedCol.offsetSeconds) : '0'}
            value={slot.manualOffset}
            onChange={e => onChange({ ...slot, manualOffset: e.target.value })}
          />
        </div>
      </div>

      {/* Validation hint */}
      {slot.collectionId && !segmentOk && (
        <p className="sswap__err">
          {!resolvedSegment
            ? 'Set a segment on the collection or select one above.'
            : `Segment "${resolvedSegment}" not found in loaded .lss file.`}
        </p>
      )}
    </div>
  )
}

function emptySlot() {
  return { collectionId: '', manualSegment: '', manualOffset: '' }
}

export function SegmentSwap({
  collections,
  runData,
  distribution,
  onCompute,   // (swaps: [{collectionId, segmentName, offsetSeconds}]) => void
  swapResult,  // { original, swapped, resetDelta } or null
  computing,
}) {
  const containerRef = useRef(null)
  const plotRef      = useRef(null)

  const [slots, setSlots] = useState([emptySlot()])

  useEffect(() => {
    if (window.Plotly) return
    const s = document.createElement('script')
    s.src = 'https://cdn.jsdelivr.net/npm/plotly.js-dist-min@2.35.2/plotly.min.js'
    document.head.appendChild(s)
  }, [])

  useEffect(() => {
    const orig = swapResult?.original
    const swpd = swapResult?.swapped
    if (!orig || !swpd || !containerRef.current || !window.Plotly) return

    const origX = orig.x.map(v => v / 60)
    const swpdX = swpd.x.map(v => v / 60)
    const [zLo, zHi] = autoZoom([
      { x: origX, pdf: orig.pdf },
      { x: swpdX, pdf: swpd.pdf },
    ])

    const origPbMin = orig.pb_time / 60
    const swpdPbMin = swpd.pb_time / 60
    const origPbIdx = orig.x.findIndex(v => v >= orig.pb_time)
    const swpdPbIdx = swpd.x.findIndex(v => v >= swpd.pb_time)

    const traces = [
      {
        x: [...origX.slice(0, origPbIdx + 1), origPbMin, origPbMin],
        y: [...orig.pdf.slice(0, origPbIdx + 1), orig.pdf[origPbIdx] ?? 0, 0],
        type: 'scatter', mode: 'none', fill: 'tozeroy',
        fillcolor: 'rgba(61,214,140,0.08)',
        name: 'Original PB zone (' + (orig.pb_probability * 100).toFixed(1) + '%)',
        hoverinfo: 'skip',
      },
      {
        x: [...swpdX.slice(0, swpdPbIdx + 1), swpdPbMin, swpdPbMin],
        y: [...swpd.pdf.slice(0, swpdPbIdx + 1), swpd.pdf[swpdPbIdx] ?? 0, 0],
        type: 'scatter', mode: 'none', fill: 'tozeroy',
        fillcolor: 'rgba(168,85,247,0.10)',
        name: 'Swapped PB zone (' + (swpd.pb_probability * 100).toFixed(1) + '%)',
        hoverinfo: 'skip',
      },
      {
        x: origX, y: orig.pdf, type: 'scatter', mode: 'lines',
        name: 'Original run',
        line: { color: '#3dd68c', width: 2, shape: 'spline' },
        fill: 'tozeroy', fillcolor: 'rgba(61,214,140,0.05)',
        hovertemplate: '%{x:.2f} min<extra>Original</extra>',
      },
      {
        x: swpdX, y: swpd.pdf, type: 'scatter', mode: 'lines',
        name: 'With swapped segment(s)',
        line: { color: '#a855f7', width: 2, shape: 'spline', dash: 'dot' },
        fill: 'tozeroy', fillcolor: 'rgba(168,85,247,0.05)',
        hovertemplate: '%{x:.2f} min<extra>Swapped</extra>',
      },
    ]

    const shapes = [
      { type: 'line', x0: origPbMin, x1: origPbMin, y0: 0, y1: 1, xref: 'x', yref: 'paper',
        line: { color: '#3dd68c', width: 1.5, dash: 'dot' } },
      { type: 'line', x0: swpdPbMin, x1: swpdPbMin, y0: 0, y1: 1, xref: 'x', yref: 'paper',
        line: { color: '#a855f7', width: 1.5, dash: 'dot' } },
    ]

    const annotations = [
      { x: origPbMin, y: 1, xref: 'x', yref: 'paper',
        text: 'Original PB<br><b>' + (orig.pb_probability * 100).toFixed(1) + '%</b>',
        showarrow: true, arrowhead: 0, arrowcolor: '#3dd68c', ax: 30, ay: -36,
        font: { color: '#3dd68c', size: 10, family: 'Space Mono' },
        bgcolor: 'rgba(10,10,15,0.85)', bordercolor: '#3dd68c', borderwidth: 1, borderpad: 3 },
      { x: swpdPbMin, y: 0.75, xref: 'x', yref: 'paper',
        text: 'Swapped PB<br><b>' + (swpd.pb_probability * 100).toFixed(1) + '%</b>',
        showarrow: true, arrowhead: 0, arrowcolor: '#a855f7', ax: -40, ay: -30,
        font: { color: '#a855f7', size: 10, family: 'Space Mono' },
        bgcolor: 'rgba(10,10,15,0.85)', bordercolor: '#a855f7', borderwidth: 1, borderpad: 3 },
    ]

    const layout = {
      paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
      margin: { t: 16, r: 30, b: 44, l: 50 },
      font: { family: 'Space Mono, monospace', color: '#9090a8', size: 11 },
      showlegend: true,
      legend: { bgcolor: 'rgba(17,17,24,0.9)', bordercolor: '#2a2a38', borderwidth: 1,
        font: { size: 10 }, x: 1, xanchor: 'right', y: 1 },
      xaxis: { title: { text: 'Run time (minutes)', standoff: 8 }, gridcolor: '#1e1e28',
        zerolinecolor: '#2a2a38', tickformat: '.1f', color: '#55556a', range: [zLo, zHi] },
      yaxis: { title: { text: 'Density' }, gridcolor: '#1e1e28',
        zerolinecolor: '#2a2a38', color: '#55556a', rangemode: 'tozero' },
      shapes, annotations,
    }

    if (!plotRef.current) {
      window.Plotly.newPlot(containerRef.current, traces, layout, { displayModeBar: false })
      plotRef.current = true
    } else {
      window.Plotly.react(containerRef.current, traces, layout)
    }
  }, [swapResult])

  if (!runData || !distribution) {
    return (
      <div className="sswap__no-run">
        <p className="text-3">No run loaded. Load an .lss file in the Splits Analyser first.</p>
      </div>
    )
  }

  const segments = runData.segments.map(s => s.name)

  // Resolve each slot to its final segment + offset
  function resolveSlot(slot) {
    const col = collections.find(c => c.id === slot.collectionId) ?? null
    const segmentName = slot.manualSegment.trim() || col?.lssSegmentName || ''
    const offsetSeconds = slot.manualOffset !== ''
      ? (parseFloat(slot.manualOffset) || 0)
      : (col?.offsetSeconds ?? 0)
    return { collectionId: slot.collectionId, segmentName, offsetSeconds }
  }

  const resolvedSlots = slots.map(resolveSlot)

  // A slot is valid if it has a collection and a segment that exists in the run
  function slotValid(rs) {
    return rs.collectionId && rs.segmentName && segments.includes(rs.segmentName)
  }

  // Check for duplicate segment assignments
  const usedSegments = resolvedSlots.filter(slotValid).map(rs => rs.segmentName)
  const hasDuplicateSegments = usedSegments.length !== new Set(usedSegments).size

  const canCompute = resolvedSlots.some(slotValid) && !hasDuplicateSegments

  function handleCompute() {
    const validSwaps = resolvedSlots.filter(slotValid)
    onCompute(validSwaps)
  }

  function updateSlot(i, newSlot) {
    setSlots(prev => prev.map((s, idx) => idx === i ? newSlot : s))
  }

  function removeSlot(i) {
    setSlots(prev => prev.filter((_, idx) => idx !== i))
  }

  function addSlot() {
    setSlots(prev => [...prev, emptySlot()])
  }

  const pbDelta = swapResult
    ? swapResult.swapped.pb_probability - swapResult.original.pb_probability
    : null

  const resetDelta = swapResult?.resetDelta ?? null  // { original, swapped } both 0-1

  return (
    <div className="sswap">
      <div className="sswap__intro">
        <h3 className="sswap__title">Segment Swap</h3>
        <p className="sswap__desc text-3">
          Replace one or more segments in your run distribution with star collection
          distributions and see the combined impact on PB probability and reset rate.
        </p>
      </div>

      <div className="sswap__controls">
        {slots.map((slot, i) => (
          <SwapSlot
            key={i}
            slot={slot}
            index={i}
            segments={segments}
            collections={collections}
            onChange={newSlot => updateSlot(i, newSlot)}
            onRemove={() => removeSlot(i)}
            canRemove={slots.length > 1}
          />
        ))}

        <div className="sswap__slot-actions">
          <button className="sswap__add-slot-btn" onClick={addSlot}>
            + Add another swap
          </button>
        </div>

        {hasDuplicateSegments && (
          <p className="sswap__err">Two swaps target the same segment — each segment can only be swapped once.</p>
        )}

        <button className="sswap__compute-btn" onClick={handleCompute}
          disabled={computing || !canCompute}>
          {computing ? 'Computing...' : '> Compare'}
        </button>
      </div>

      {swapResult && !computing && (
        <>
          {/* Delta headline */}
          <div className="sswap__delta">
            <div className="sswap__delta-main">
              <span className="sswap__delta-value" style={{
                color: pbDelta > 0.001 ? 'var(--green)' : pbDelta < -0.001 ? 'var(--red)' : 'var(--text-3)'
              }}>
                {pbDelta > 0 ? '+' : ''}{(pbDelta * 100).toFixed(1)}%
              </span>
              <span className="sswap__delta-label">PB probability change</span>
            </div>
            <div className="sswap__delta-stats">
              <div className="sswap__delta-stat">
                <span className="text-3">Original PB chance</span>
                <span className="text-green">{fmtPct(swapResult.original.pb_probability)}</span>
              </div>
              <div className="sswap__delta-stat">
                <span className="text-3">Swapped PB chance</span>
                <span className="text-purple">{fmtPct(swapResult.swapped.pb_probability)}</span>
              </div>
              {resetDelta && (
                <>
                  <div className="sswap__delta-divider" />
                  <div className="sswap__delta-stat">
                    <span className="text-3">Original reset rate</span>
                    <span style={{ color: resetDelta.original > 0.5 ? 'var(--red)' : resetDelta.original > 0.2 ? 'var(--star)' : 'var(--text-2)' }}>
                      {fmtPct(resetDelta.original)}
                    </span>
                  </div>
                  <div className="sswap__delta-stat">
                    <span className="text-3">Swapped reset rate</span>
                    <span style={{ color: resetDelta.swapped > 0.5 ? 'var(--red)' : resetDelta.swapped > 0.2 ? 'var(--star)' : 'var(--text-2)' }}>
                      {fmtPct(resetDelta.swapped)}
                    </span>
                  </div>
                  <div className="sswap__delta-stat">
                    <span className="text-3">Reset rate change</span>
                    {(() => {
                      const d = resetDelta.swapped - resetDelta.original
                      const color = d < -0.005 ? 'var(--green)' : d > 0.005 ? 'var(--red)' : 'var(--text-3)'
                      return <span style={{ color }}>{d > 0 ? '+' : ''}{(d * 100).toFixed(1)}%</span>
                    })()}
                  </div>
                </>
              )}
              <div className="sswap__delta-divider" />
              <div className="sswap__delta-stat">
                <span className="text-3">Segments replaced</span>
                <span className="text-2">
                  {resolvedSlots.filter(slotValid).map(rs => rs.segmentName).join(', ')}
                </span>
              </div>
            </div>
          </div>

          <div className="sswap__chart" ref={containerRef} />

          {/* Percentile comparison */}
          <div className="sswap__ptable">
            <div className="sswap__ptable-hdr">
              <span />
              <span className="text-green">Original</span>
              <span className="text-purple">Swapped</span>
              <span className="text-3">diff</span>
            </div>
            {['p10', 'p25', 'p50', 'p75', 'p90'].map(p => {
              const v0 = swapResult.original.percentiles[p]
              const v1 = swapResult.swapped.percentiles[p]
              const diff = v1 - v0
              return (
                <div key={p} className="sswap__ptable-row">
                  <span className="text-3">{p}</span>
                  <span className="text-green">{fmtTime(v0)}</span>
                  <span className="text-purple">{fmtTime(v1)}</span>
                  <span style={{ color: diff < 0 ? 'var(--green)' : diff > 0 ? 'var(--red)' : 'var(--text-3)' }}>
                    {diff === 0 ? '--' : (diff > 0 ? '+' : '') + fmtTime(Math.abs(diff))}
                  </span>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

```

### `src/components/StarTimer/SegmentSwap.css`
```css
.sswap { display: flex; flex-direction: column; gap: 1.25rem; }

.sswap__no-run {
  display: flex; align-items: center; justify-content: center;
  min-height: 120px; border: 1px dashed var(--border); border-radius: var(--radius-lg);
}

.sswap__intro { display: flex; flex-direction: column; gap: 0.25rem; }
.sswap__title { font-family: var(--font-display); font-size: 1rem; font-weight: 700; color: var(--text-1); }
.sswap__desc  { font-size: 0.72rem; }

.sswap__controls {
  display: flex; flex-direction: column; gap: 1rem;
  background: var(--bg-card); border: 1px solid var(--border);
  border-radius: var(--radius-lg); padding: 1rem 1.25rem;
}

/* Individual swap slot */
.sswap__slot {
  display: flex; flex-direction: column; gap: 0.6rem;
  border: 1px solid var(--border); border-radius: var(--radius-lg);
  padding: 0.85rem 1rem;
  background: rgba(0,0,0,0.12);
}

.sswap__slot-header {
  display: flex; align-items: center; justify-content: space-between;
}

.sswap__slot-label {
  font-size: 0.62rem; text-transform: uppercase; letter-spacing: 0.1em;
  color: var(--purple); font-family: var(--font-mono); font-weight: 600;
}

.sswap__slot-remove {
  background: transparent; border: none; color: var(--text-3);
  font-family: var(--font-mono); font-size: 0.65rem;
  cursor: pointer; padding: 0.1rem 0.3rem; border-radius: var(--radius);
  transition: color var(--transition);
}
.sswap__slot-remove:hover { color: var(--red); }

.sswap__slot-overrides {
  display: grid; grid-template-columns: 1fr auto; gap: 0.6rem; align-items: start;
}

.sswap__slot-actions {
  display: flex; gap: 0.5rem;
  border-top: 1px solid var(--border); padding-top: 0.75rem;
}

.sswap__add-slot-btn {
  background: transparent; border: 1px dashed var(--border-hi);
  border-radius: var(--radius); color: var(--text-3);
  font-family: var(--font-mono); font-size: 0.72rem;
  padding: 0.35rem 0.85rem; cursor: pointer;
  transition: all var(--transition);
}
.sswap__add-slot-btn:hover { border-color: var(--purple); color: var(--purple); }

.sswap__field { display: flex; flex-direction: column; gap: 0.3rem; }

.sswap__label {
  font-size: 0.63rem; letter-spacing: 0.09em; text-transform: uppercase; color: var(--text-3);
}

.sswap__select,
.sswap__input {
  background: var(--bg-raised); border: 1px solid var(--border-hi);
  border-radius: var(--radius); color: var(--text-1);
  font-family: var(--font-mono); font-size: 0.76rem;
  padding: 0.42rem 0.65rem; outline: none;
  transition: border-color var(--transition);
}
.sswap__select:focus, .sswap__input:focus { border-color: var(--star); }
.sswap__select option { background: var(--bg-raised); }
.sswap__input { width: 110px; }

.sswap__col-offset-info {
  display: flex; gap: 1rem; flex-wrap: wrap;
  background: rgba(0,0,0,0.15); border-radius: var(--radius);
  padding: 0.4rem 0.7rem; font-size: 0.7rem;
}
.sswap__warn { color: var(--star); font-size: 0.7rem; }

.sswap__compute-btn {
  align-self: flex-start;
  background: transparent; border: 1px solid var(--purple); border-radius: var(--radius);
  color: var(--purple); font-family: var(--font-mono); font-size: 0.75rem;
  padding: 0.45rem 1rem; cursor: pointer; transition: all var(--transition);
}
.sswap__compute-btn:hover:not(:disabled) { background: var(--purple); color: var(--bg); }
.sswap__compute-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.sswap__err { font-size: 0.7rem; color: var(--red); font-family: var(--font-mono); }

/* Delta panel */
.sswap__delta {
  display: flex; align-items: center; gap: 1.5rem; flex-wrap: wrap;
  padding: 1rem 1.25rem;
  background: rgba(168,85,247,0.05); border: 1px solid rgba(168,85,247,0.2);
  border-radius: var(--radius-lg);
}

.sswap__delta-main { display: flex; flex-direction: column; align-items: center; gap: 0.2rem; flex-shrink: 0; }

.sswap__delta-value {
  font-family: var(--font-display); font-size: 2.2rem;
  font-weight: 800; line-height: 1; letter-spacing: -0.03em;
}

.sswap__delta-label {
  font-size: 0.6rem; text-transform: uppercase; letter-spacing: 0.08em;
  color: var(--text-3); white-space: nowrap;
}

.sswap__delta-stats { display: flex; gap: 1.25rem; flex-wrap: wrap; align-items: flex-start; }
.sswap__delta-stat { display: flex; flex-direction: column; gap: 0.2rem; }
.sswap__delta-stat span:first-child { font-size: 0.62rem; letter-spacing: 0.07em; text-transform: uppercase; }
.sswap__delta-stat span:last-child  { font-family: var(--font-mono); font-size: 0.82rem; }

.sswap__delta-divider {
  width: 1px; align-self: stretch;
  background: var(--border); flex-shrink: 0;
  margin: 0 0.1rem;
}

.text-purple { color: var(--purple); }

.sswap__chart { height: 280px; }

/* Percentile table */
.sswap__ptable { display: flex; flex-direction: column; }

.sswap__ptable-hdr,
.sswap__ptable-row {
  display: grid;
  grid-template-columns: 3rem 1fr 1fr 5rem;
  gap: 0.75rem; padding: 0.3rem 0.5rem;
  font-family: var(--font-mono); font-size: 0.75rem; align-items: center;
}
.sswap__ptable-hdr { font-size: 0.7rem; font-weight: 600; border-bottom: 1px solid var(--border); padding-bottom: 0.4rem; }
.sswap__ptable-row { border-bottom: 1px solid var(--border); }
.sswap__ptable-row:last-child { border-bottom: none; }

```

### `src/components/StarTimer/StarTimer.css`
```css
/* StarTimer shared layout */
.st-wrap {
  display: flex;
  flex-direction: column;
  gap: 0;
  height: 100%;
}

/* Tab bar */
.st-tabs {
  display: flex;
  gap: 0;
  border-bottom: 1px solid var(--border);
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}

.st-tab {
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--text-3);
  font-family: var(--font-mono);
  font-size: 0.78rem;
  padding: 0.6rem 1.1rem;
  cursor: pointer;
  transition: color var(--transition), border-color var(--transition);
  white-space: nowrap;
  margin-bottom: -1px;
}

.st-tab:hover { color: var(--text-1); }

.st-tab.is-active {
  color: var(--star);
  border-bottom-color: var(--star);
}

/* Tab body */
.st-body { flex: 1; }

/* ── Log tab ──────────────────────────────────────────────── */
.st-log { display: flex; flex-direction: column; gap: 1rem; }

.st-log__picker-wrap {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 1rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.st-log__picker-title {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-3);
}

/* Collection creation bar */
.st-log__collection-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.5rem 0.75rem;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
}

.st-log__create-col-btn {
  background: transparent;
  border: 1px solid var(--purple);
  border-radius: var(--radius);
  color: var(--purple);
  font-family: var(--font-mono);
  font-size: 0.72rem;
  padding: 0.3rem 0.75rem;
  cursor: pointer;
  transition: all var(--transition);
  white-space: nowrap;
}
.st-log__create-col-btn:hover { background: var(--purple); color: var(--bg); }

/* Create panel */
.st-log__create-panel {
  background: rgba(168,85,247,0.05);
  border: 1px solid rgba(168,85,247,0.25);
  border-radius: var(--radius-lg);
  padding: 0.9rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.st-log__create-row {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  align-items: center;
}

.st-log__create-input {
  background: var(--bg-raised);
  border: 1px solid var(--border-hi);
  border-radius: var(--radius);
  color: var(--text-1);
  font-family: var(--font-mono);
  font-size: 0.75rem;
  padding: 0.4rem 0.65rem;
  outline: none;
  flex: 1;
  min-width: 130px;
  transition: border-color var(--transition);
}
.st-log__create-input:focus { border-color: var(--purple); }
.st-log__create-input--sm { flex: 0 0 120px; min-width: 0; }

.st-log__create-btn {
  background: var(--purple);
  border: none;
  border-radius: var(--radius);
  color: var(--bg);
  font-family: var(--font-mono);
  font-size: 0.75rem;
  padding: 0.4rem 0.9rem;
  cursor: pointer;
  transition: opacity var(--transition);
  white-space: nowrap;
}
.st-log__create-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.st-log__create-hint { font-size: 0.68rem; }

.st-log__open-stars { display: flex; flex-direction: column; gap: 0.75rem; }

.st-log__empty {
  text-align: center;
  padding: 2.5rem 0;
  font-size: 0.8rem;
}

/* ── Export / Import toolbar ─────────────────────────────────────────────── */
.st-log__io-bar {
  display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap;
  padding: 0.5rem 0;
}

.st-log__io-btn {
  background: transparent;
  border: 1px solid var(--border-hi);
  border-radius: var(--radius);
  color: var(--text-3);
  font-family: var(--font-mono);
  font-size: 0.7rem;
  padding: 0.35rem 0.8rem;
  cursor: pointer;
  transition: all var(--transition);
  user-select: none;
}
.st-log__io-btn:hover { border-color: var(--star); color: var(--star); }
.st-log__io-btn--import { display: inline-flex; align-items: center; }
.st-log__io-btn--import:hover { border-color: var(--purple); color: var(--purple); }

.st-log__io-status {
  font-family: var(--font-mono);
  font-size: 0.68rem;
  padding: 0.2rem 0.6rem;
  border-radius: var(--radius);
}
.st-log__io-status--ok  { color: var(--green); background: rgba(61,214,140,0.08); }
.st-log__io-status--err { color: var(--red);   background: rgba(232,64,64,0.08); }

/* ── Distribution tab ─────────────────────────────────────── */
.st-dist { display: flex; flex-direction: column; gap: 1rem; }

.st-dist__selector {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.st-dist__select {
  background: var(--bg-raised);
  border: 1px solid var(--border-hi);
  border-radius: var(--radius);
  color: var(--text-1);
  font-family: var(--font-mono);
  font-size: 0.78rem;
  padding: 0.45rem 0.65rem;
  outline: none;
  transition: border-color var(--transition);
  flex: 1;
  max-width: 320px;
}
.st-dist__select:focus { border-color: var(--star); }
.st-dist__select option { background: var(--bg-raised); }

/* ── Compare tab ──────────────────────────────────────────── */
.st-compare { display: flex; flex-direction: column; gap: 1rem; }

.st-compare__selectors {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.st-compare__col-pick {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  flex: 1;
  min-width: 200px;
}

.st-compare__col-label {
  font-size: 0.63rem;
  text-transform: uppercase;
  letter-spacing: 0.09em;
}

.st-compare__select {
  background: var(--bg-raised);
  border: 1px solid var(--border-hi);
  border-radius: var(--radius);
  color: var(--text-1);
  font-family: var(--font-mono);
  font-size: 0.76rem;
  padding: 0.42rem 0.65rem;
  outline: none;
}
.st-compare__select option { background: var(--bg-raised); }

```

### `src/components/StarTimer/index.jsx`
```jsx
import { useState, useCallback } from 'react'
import { usePyodide } from '../../pyodide/usePyodide'
import { useStarTimer, exportToCSV, importFromCSV } from './useStarTimer'
import { StarPicker } from './StarPicker'
import { AttemptLog } from './AttemptLog'
import { CollectionBuilder } from './CollectionBuilder'
import { CollectionChart } from './CollectionChart'
import { CompareView } from './CompareView'
import { SegmentSwap } from './SegmentSwap'
import './StarTimer.css'

const TABS = [
  { id: 'log',         label: 'Log' },
  { id: 'dist',        label: 'Distribution' },
  { id: 'collections', label: 'Collections' },
  { id: 'compare',     label: 'Compare' },
  { id: 'swap',        label: 'Segment Swap' },
]

/**
 * Compute collection failure rate from star rows with attempt data.
 * failure rate = 1 - product(per-star success rates)
 * Stars with no attempts are ignored.
 */
function computeCollectionFailureRate(starRows) {
  let product = 1.0
  let hasData = false
  for (const row of starRows) {
    const total = row.total ?? 0
    if (total === 0) continue
    const successes = row.successes ?? 0
    const rate = successes / total
    product *= rate
    hasData = true
  }
  if (!hasData) return null
  return 1 - product
}

export function StarTimer({ runData, distribution }) {
  const { ready, runPython } = usePyodide()
  const timer = useStarTimer()

  const [tab, setTab] = useState('log')

  // Log tab
  const [openStars, setOpenStars] = useState([])
  const [checkedKeys, setCheckedKeys] = useState(new Set())
  const [newColName,    setNewColName]    = useState('')
  const [newColOffset,  setNewColOffset]  = useState('')
  const [newColSegment, setNewColSegment] = useState('')
  const [showCreatePanel, setShowCreatePanel] = useState(false)
  const [importStatus,    setImportStatus]    = useState(null)  // { ok, msg }

  // Distribution tab
  const [distCollId,    setDistCollId]    = useState('')
  const [distResult,    setDistResult]    = useState(null)
  const [distComputing, setDistComputing] = useState(false)

  // Compare tab
  const [cmpIds,       setCmpIds]       = useState(['', ''])
  const [cmpResults,   setCmpResults]   = useState([null, null])
  const [cmpComputing, setCmpComputing] = useState(false)

  // Segment Swap tab
  const [swapResult,    setSwapResult]    = useState(null)
  const [swapComputing, setSwapComputing] = useState(false)

  // ── Helpers ───────────────────────────────────────────────────────────────

  /**
   * Get star rows augmented with attempt-count data for failure rate display.
   * Returns rows with: { stage, star, strategy, times, total, successes, resetRate }
   */
  function getAugmentedRows(colId) {
    const rows = timer.getCollectionTimes(colId)
    return rows.map(row => {
      const allAttempts = timer.getAttempts(row.stage, row.star, row.strategy)
      const total = allAttempts.length
      const successes = allAttempts.filter(a => a.success).length
      const resetRate = total > 0 ? (1 - successes / total) : null
      return { ...row, total, successes, resetRate }
    })
  }

  async function computeCollection(colId) {
    const rows = timer.getCollectionTimes(colId)
    const segTimes = rows.map(r => r.times)
    const pbTimes = rows.map(r =>
      r.times.length > 0 ? Math.min(...r.times) : 0
    )

    const json = await runPython(`
import json, numpy as np
result = compute_distribution(seg_times.to_py(), pb_times.to_py(), resolution=0.1)
# Augment segment_stats with best time and variance share
times_list = seg_times.to_py()
stds = [float(np.std(t)) if len(t) >= 2 else 0.0 for t in times_list]
total_std = sum(stds) or 1.0
for i, (stat, t) in enumerate(zip(result['segment_stats'], times_list)):
    stat['best'] = float(min(t)) if t else None
    stat['variance_share'] = stds[i] / total_std
json.dumps(result)
`, { seg_times: segTimes, pb_times: pbTimes })

    return JSON.parse(json)
  }

  const handleDistCompute = useCallback(async () => {
    if (!distCollId || !ready) return
    setDistComputing(true)
    setDistResult(null)
    try {
      const result = await computeCollection(distCollId)
      setDistResult(result)
    } catch (e) {
      console.error('Distribution compute error:', e)
    } finally {
      setDistComputing(false)
    }
  }, [distCollId, ready, timer])

  // FIX: Run sequentially to avoid Pyodide globals race condition.
  // Promise.all would cause both calls to share the same globals namespace,
  // resulting in both computations using the last-written seg_times/pb_times.
  const handleCmpCompute = useCallback(async () => {
    if (!cmpIds[0] || !cmpIds[1] || !ready) return
    setCmpComputing(true)
    setCmpResults([null, null])
    try {
      const r0 = await computeCollection(cmpIds[0])
      const r1 = await computeCollection(cmpIds[1])
      setCmpResults([r0, r1])
    } catch (e) {
      console.error('Compare compute error:', e)
    } finally {
      setCmpComputing(false)
    }
  }, [cmpIds, ready, timer])

  // swaps: [{collectionId, segmentName, offsetSeconds}]
  const handleSwapCompute = useCallback(async (swaps) => {
    if (!runData || !distribution || !ready || swaps.length === 0) return
    setSwapComputing(true)
    setSwapResult(null)

    try {
      const allSegs   = runData.segments
      const origTimes = allSegs.map(s => s.times)
      const origPBs   = allSegs.map(s => s.pbTime ?? (s.times.length > 0 ? Math.min(...s.times) : 0))
      // Per-segment reset rates from the loaded run (0-1, survival-based)
      const origResetRates = allSegs.map(s => s.resetRate ?? 0)

      // For each swap, gather collection times, PBs, reset rate, and segment index
      const swapData = swaps.map(sw => {
        const segIdx = runData.segments.findIndex(s => s.name === sw.segmentName)
        if (segIdx === -1) throw new Error(`Segment "${sw.segmentName}" not found`)
        const rows   = timer.getCollectionTimes(sw.collectionId)
        const times  = rows.map(r => r.times)
        const pbs    = rows.map(r => r.times.length > 0 ? Math.min(...r.times) : 0)
        // Collection failure rate = 1 - product(per-star success rates)
        const augRows = getAugmentedRows(sw.collectionId)
        const colFailRate = computeCollectionFailureRate(augRows) ?? 0
        return { segIdx, times, pbs, offsetSeconds: sw.offsetSeconds, colFailRate }
      })

      // Original run reset rate = 1 - product(1 - resetRate_i)
      const origRunResetRate = 1 - origResetRates.reduce((acc, r) => acc * (1 - r), 1)

      // Swapped reset rate: replace swapped segments' reset rates with collection fail rates
      const swappedResetRates = [...origResetRates]
      for (const sd of swapData) {
        swappedResetRates[sd.segIdx] = sd.colFailRate
      }
      const swappedRunResetRate = 1 - swappedResetRates.reduce((acc, r) => acc * (1 - r), 1)

      // Build JS arrays to pass into Python
      // swapEntries: list of [segIdx, colTimes, colPBs, offsetSecs]
      const swapEntries = swapData.map(sd => ({
        seg_idx: sd.segIdx,
        col_times: sd.times,
        col_pbs: sd.pbs,
        offset_secs: sd.offsetSeconds,
      }))

      const json = await runPython(`
import json, numpy as np
from scipy.signal import fftconvolve
from scipy.stats import gaussian_kde

orig_times_list = orig_times.to_py()
orig_pbs_list   = orig_pbs.to_py()
swap_entries_raw = swap_entries_js.to_py()
# Normalise nested proxies from Pyodide JS->Python conversion
swap_entries = []
for e in swap_entries_raw:
    col_times = [list(tl) if hasattr(tl, '__iter__') and not isinstance(tl, (str, float, int)) else tl for tl in e['col_times']]
    col_pbs   = [float(p) for p in e['col_pbs']]
    swap_entries.append({'seg_idx': int(e['seg_idx']), 'offset_secs': float(e['offset_secs']), 'col_times': col_times, 'col_pbs': col_pbs})

# -- Original full-run distribution
orig_result = compute_distribution(orig_times_list, orig_pbs_list, resolution=0.1)

# -- Build shared seg grid (covers all orig + collection times)
all_times_flat = [t for tl in orig_times_list for t in tl]
for entry in swap_entries:
    for tl in entry['col_times']:
        all_times_flat.extend(tl)
max_t = max(all_times_flat) if all_times_flat else 10.0
N_GRID = 2000
seg_x = np.linspace(0, max_t * 1.35, N_GRID)
dx = float(seg_x[1] - seg_x[0])

def kde_pdf_on_grid(times, x_grid):
    arr = np.asarray(times, dtype=float)
    arr = arr[np.isfinite(arr)]
    if len(arr) < 2:
        pdf = np.zeros_like(x_grid)
        c = arr[0] if len(arr) == 1 else x_grid[len(x_grid)//2]
        pdf[np.argmin(np.abs(x_grid - c))] = 1.0
        return pdf
    kde  = gaussian_kde(arr, bw_method='scott')
    pdf  = np.clip(kde(x_grid), 0, None)
    integral = np.trapz(pdf, x_grid)
    return pdf / integral if integral > 0 else pdf

# Start with original segment PDFs
orig_pdfs = [kde_pdf_on_grid(t, seg_x) for t in orig_times_list]

# For each swap: compute collection distribution, shift, interpolate onto seg_x, replace
for entry in swap_entries:
    si = int(entry['seg_idx'])
    offset = float(entry['offset_secs'])
    col_result = compute_distribution(entry['col_times'], entry['col_pbs'], resolution=0.1)
    col_x   = np.array(col_result['x'])
    col_pdf = np.array(col_result['pdf'])
    col_dx  = float(col_x[1] - col_x[0])
    # Shift right by offset
    shift_bins = int(round(offset / col_dx))
    col_pdf_shifted = np.zeros_like(col_pdf)
    if shift_bins < len(col_pdf):
        col_pdf_shifted[shift_bins:] = col_pdf[:len(col_pdf) - shift_bins]
    else:
        col_pdf_shifted[-1] = 1.0
    # Interpolate onto shared grid
    col_on_seg = np.interp(seg_x, col_x, col_pdf_shifted)
    integral = np.trapz(col_on_seg, seg_x)
    if integral > 0:
        col_on_seg /= integral
    orig_pdfs[si] = col_on_seg

def fft_convolve(pdfs):
    result = pdfs[0].copy()
    for p in pdfs[1:]:
        result = fftconvolve(result, p, mode='full')
        result = np.clip(result, 0, None)
    tot = result.sum()
    if tot > 0: result /= tot
    return result

swp_pdf = fft_convolve(orig_pdfs)
n_seg = len(orig_pdfs)
m = N_GRID
joint_len = min((n_seg - 1) * (m - 1) + m, len(swp_pdf))
swp_pdf = swp_pdf[:joint_len]
dx2 = dx
swp_x = np.arange(joint_len) * dx2
tot2 = np.trapz(swp_pdf, swp_x)
if tot2 > 0: swp_pdf /= tot2

swp_cdf = np.clip(np.cumsum(swp_pdf) * dx2, 0, 1)
orig_pb_total = float(sum(float(p) for p in orig_pbs_list))
swp_pb_idx = np.searchsorted(swp_x, orig_pb_total)
swp_pb_prob = float(swp_cdf[min(swp_pb_idx, len(swp_cdf)-1)])

def ptile(cdf, x, p):
    idx = min(np.searchsorted(cdf, p/100.0), len(x)-1)
    return float(x[idx])

swapped = {
    'x': swp_x.tolist(), 'pdf': swp_pdf.tolist(), 'cdf': swp_cdf.tolist(),
    'pb_time': orig_pb_total, 'pb_probability': swp_pb_prob,
    'percentiles': {k: ptile(swp_cdf, swp_x, v)
                    for k, v in [('p10',10),('p25',25),('p50',50),('p75',75),('p90',90)]},
}

json.dumps({'original': orig_result, 'swapped': swapped})
`, {
        orig_times:     origTimes,
        orig_pbs:       origPBs,
        swap_entries_js: swapEntries,
      })

      const parsed = JSON.parse(json)
      parsed.resetDelta = {
        original: origRunResetRate,
        swapped:  swappedRunResetRate,
      }
      setSwapResult(parsed)
    } catch (e) {
      console.error('Swap compute error:', e)
    } finally {
      setSwapComputing(false)
    }
  }, [runData, distribution, ready, runPython, timer])

  // ── Log tab helpers ───────────────────────────────────────────────────────

  function openStar({ stage, star, strategy }) {
    setOpenStars(prev => {
      const already = prev.some(s => s.stage === stage && s.star === star && s.strategy === strategy)
      return already ? prev : [{ stage, star, strategy }, ...prev]
    })
  }

  function closeStar(stage, star, strategy) {
    setOpenStars(prev => prev.filter(s => !(s.stage === stage && s.star === star && s.strategy === strategy)))
    const key = `${stage}||${star}||${strategy}`
    setCheckedKeys(prev => { const n = new Set(prev); n.delete(key); return n })
  }

  function toggleChecked(stage, star, strategy, checked) {
    const key = `${stage}||${star}||${strategy}`
    setCheckedKeys(prev => { const n = new Set(prev); checked ? n.add(key) : n.delete(key); return n })
  }

  function createCollectionFromSelection() {
    const name = newColName.trim()
    if (!name || checkedKeys.size === 0) return
    const stars = openStars
      .filter(({ stage, star, strategy }) => checkedKeys.has(`${stage}||${star}||${strategy}`))
      .map(({ stage, star, strategy }) => ({ stage, star, strategy }))
    const offsetParsed = newColOffset.trim() ? parseFloat(newColOffset) : null
    const seg = newColSegment.trim() || null
    timer.createCollection(name, stars, isNaN(offsetParsed) ? null : offsetParsed, seg)
    setNewColName('')
    setNewColOffset('')
    setNewColSegment('')
    setCheckedKeys(new Set())
    setShowCreatePanel(false)
  }

  // ── Export / Import ──────────────────────────────────────────────────────

  function handleExport() {
    const csv      = exportToCSV(timer.attempts, timer.collections)
    const blob     = new Blob([csv], { type: 'text/csv' })
    const url      = URL.createObjectURL(blob)
    const a        = document.createElement('a')
    a.href         = url
    a.download     = 'sm64_star_timer_' + new Date().toISOString().slice(0, 10) + '.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleImport(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = evt => {
      try {
        const { data, errors } = importFromCSV(evt.target.result)
        const totalAttempts = Object.values(data.attempts).reduce((s, a) => s + a.length, 0)
        if (totalAttempts === 0) {
          setImportStatus({ ok: false, msg: 'No valid rows found in file.' })
          return
        }
        // Ask user: merge or replace
        const doReplace = window.confirm(
          `Found ${totalAttempts} attempts across ${Object.keys(data.attempts).length} stars.\n\n` +
          `Click OK to REPLACE existing attempts, or Cancel to MERGE (add alongside existing).`
        )
        timer.importData(data.attempts, doReplace ? 'replace' : 'merge')
        const warnMsg = errors.length > 0 ? ` (${errors.length} rows skipped)` : ''
        setImportStatus({ ok: true, msg: `Imported ${totalAttempts} attempts${warnMsg}` })
        setTimeout(() => setImportStatus(null), 5000)
      } catch (err) {
        setImportStatus({ ok: false, msg: 'Import failed: ' + err.message })
      }
    }
    reader.readAsText(file)
  }

  function handleDistCollChange(id) {
    setDistCollId(id)
    setDistResult(null)
  }

  // ── Derived data ──────────────────────────────────────────────────────────

  const distCollection = timer.collections.find(c => c.id === distCollId) ?? null
  const distStarRows   = distCollection ? getAugmentedRows(distCollId) : []
  const distFailureRate = distCollection ? computeCollectionFailureRate(distStarRows) : null

  const cmpCollections = [
    timer.collections.find(c => c.id === cmpIds[0]) ?? null,
    timer.collections.find(c => c.id === cmpIds[1]) ?? null,
  ]
  const cmpStarRowsList = [
    cmpIds[0] ? getAugmentedRows(cmpIds[0]) : [],
    cmpIds[1] ? getAugmentedRows(cmpIds[1]) : [],
  ]
  const cmpFailureRates = [
    computeCollectionFailureRate(cmpStarRowsList[0]),
    computeCollectionFailureRate(cmpStarRowsList[1]),
  ]

  return (
    <div className="st-wrap">
      <nav className="st-tabs">
        {TABS.map(t => (
          <button
            key={t.id}
            className={'st-tab' + (tab === t.id ? ' is-active' : '')}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="st-body">

        {/* ── Log ─────────────────────────────────────────────────────── */}
        {tab === 'log' && (
          <div className="st-log">
            {/* Export / Import toolbar */}
            <div className="st-log__io-bar">
              <button className="st-log__io-btn" onClick={handleExport} title="Export all attempt data to CSV">
                Export CSV
              </button>
              <label className="st-log__io-btn st-log__io-btn--import" title="Import attempts from CSV">
                Import CSV
                <input
                  type="file" accept=".csv" style={{ display: 'none' }}
                  onChange={handleImport}
                  onClick={e => { e.target.value = '' }}
                />
              </label>
              {importStatus && (
                <span className={`st-log__io-status ${importStatus.ok ? 'st-log__io-status--ok' : 'st-log__io-status--err'}`}>
                  {importStatus.msg}
                </span>
              )}
            </div>

            <div className="st-log__picker-wrap">
              <p className="st-log__picker-title">Log an attempt</p>
              <StarPicker onSelect={openStar} label="Open star" />
            </div>

            {openStars.length === 0 && (
              <p className="st-log__empty text-3">
                Select a stage, star, and strategy above to start logging times.
              </p>
            )}

            {openStars.length > 0 && (
              <div className="st-log__collection-bar">
                <span className="text-3">
                  {checkedKeys.size === 0
                    ? 'Check stars to add to a new collection'
                    : `${checkedKeys.size} star${checkedKeys.size !== 1 ? 's' : ''} selected`}
                </span>
                {checkedKeys.size > 0 && (
                  <button
                    className="st-log__create-col-btn"
                    onClick={() => setShowCreatePanel(v => !v)}
                  >
                    {showCreatePanel ? 'cancel' : '+ Create collection'}
                  </button>
                )}
              </div>
            )}

            {showCreatePanel && checkedKeys.size > 0 && (
              <div className="st-log__create-panel">
                <div className="st-log__create-row">
                  <input
                    className="st-log__create-input"
                    placeholder="Collection name..."
                    value={newColName}
                    onChange={e => setNewColName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && createCollectionFromSelection()}
                    autoFocus
                  />
                  <input
                    className="st-log__create-input st-log__create-input--sm"
                    type="number" min="0" step="0.1"
                    placeholder="offset (s, optional)"
                    value={newColOffset}
                    onChange={e => setNewColOffset(e.target.value)}
                  />
                  <input
                    className="st-log__create-input"
                    placeholder=".lss segment name (optional)"
                    value={newColSegment}
                    onChange={e => setNewColSegment(e.target.value)}
                  />
                  <button
                    className="st-log__create-btn"
                    onClick={createCollectionFromSelection}
                    disabled={!newColName.trim()}
                  >
                    Create
                  </button>
                </div>
                <p className="text-3 st-log__create-hint">
                  Stars: {openStars
                    .filter(({ stage, star, strategy }) => checkedKeys.has(`${stage}||${star}||${strategy}`))
                    .map(s => s.star).join(', ')}
                </p>
              </div>
            )}

            <div className="st-log__open-stars">
              {openStars.map(({ stage, star, strategy }) => {
                const key = `${stage}||${star}||${strategy}`
                return (
                  <AttemptLog
                    key={key}
                    stage={stage} star={star} strategy={strategy}
                    attempts={timer.getAttempts(stage, star, strategy)}
                    onAdd={timer.addAttempt}
                    onDelete={timer.deleteAttempt}
                    onEdit={timer.editAttempt}
                    checked={checkedKeys.has(key)}
                    onCheckedChange={v => toggleChecked(stage, star, strategy, v)}
                    onClose={() => closeStar(stage, star, strategy)}
                  />
                )
              })}
            </div>
          </div>
        )}

        {/* ── Collections ─────────────────────────────────────────────── */}
        {tab === 'collections' && (
          <CollectionBuilder
            collections={timer.collections}
            attempts={timer.attempts}
            onCreateCollection={timer.createCollection}
            onDeleteCollection={timer.deleteCollection}
            onRenameCollection={timer.renameCollection}
            onSetOffset={timer.setCollectionOffset}
            onAddStar={timer.addStarToCollection}
            onRemoveStar={timer.removeStarFromCollection}
            getSuccessTimes={timer.getSuccessTimes}
          />
        )}

        {/* ── Distribution ─────────────────────────────────────────────── */}
        {tab === 'dist' && (
          <div className="st-dist">
            <div className="st-dist__selector">
              <select
                className="st-dist__select"
                value={distCollId}
                onChange={e => handleDistCollChange(e.target.value)}
              >
                <option value="">-- select collection --</option>
                {timer.collections.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <CollectionChart
              collection={distCollection}
              starRows={distStarRows}
              result={distResult}
              computing={distComputing}
              onCompute={handleDistCompute}
              failureRate={distFailureRate}
            />
          </div>
        )}

        {/* ── Compare ──────────────────────────────────────────────────── */}
        {tab === 'compare' && (
          <div className="st-compare">
            <div className="st-compare__selectors">
              {[0, 1].map(i => (
                <div key={i} className="st-compare__col-pick">
                  <label className="st-compare__col-label"
                    style={{ color: i === 0 ? 'var(--purple)' : 'var(--star)' }}>
                    Collection {i + 1}
                  </label>
                  <select
                    className="st-compare__select"
                    value={cmpIds[i]}
                    onChange={e => {
                      const next = [...cmpIds]; next[i] = e.target.value
                      setCmpIds(next); setCmpResults([null, null])
                    }}
                  >
                    <option value="">-- select --</option>
                    {timer.collections.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <CompareView
              collections={cmpCollections}
              results={cmpResults}
              computing={cmpComputing}
              onCompute={handleCmpCompute}
              failureRates={cmpFailureRates}
            />
          </div>
        )}

        {/* ── Segment Swap ─────────────────────────────────────────────── */}
        {tab === 'swap' && (
          <SegmentSwap
            collections={timer.collections}
            runData={runData}
            distribution={distribution}
            onCompute={handleSwapCompute}
            swapResult={swapResult}
            computing={swapComputing}
          />
        )}

      </div>
    </div>
  )
}

```

### `src/components/SplitsAnalyser/index.jsx`
```jsx
import { useState, useCallback, useEffect, useMemo } from 'react'
import { usePyodide } from '../../pyodide/usePyodide'
import { FileUpload } from './FileUpload'
import { SegmentTable } from './SegmentTable'
import { DistributionChart } from './DistributionChart'
import { Recommendations } from './Recommendations'
import { MidRunCalculator } from './MidRunCalculator'
import './SplitsAnalyser.css'

function fmt(seconds) {
  if (seconds == null) return '--'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = (seconds % 60).toFixed(2).padStart(5, '0')
  if (h > 0) return h + ':' + String(m).padStart(2,'0') + ':' + s
  return m > 0 ? m + ':' + s : s + 's'
}

function fmtDuration(seconds) {
  if (seconds == null) return '--'
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60)
    const s = Math.round(seconds % 60)
    return m > 0 ? `${m}m ${s}s` : `${s}s`
  }
  const h = Math.floor(seconds / 3600)
  const m = Math.round((seconds % 3600) / 60)
  return `${h}h ${m}m`
}

const DEFAULT_FILTERS = {
  minDuration: '',   // exclude runs whose total wall-clock duration < this many seconds
  recentN:     '',   // only use the most recent N runs (empty = all)
}

/**
 * Apply run-level filters to segment times and attempt durations.
 *
 * minDuration: gates on the TOTAL run duration (ended - started) for that
 *   attempt ID, using attemptDurationById. This correctly excludes short
 *   menu resets across all segments, not just short segment splits.
 *
 * recentN: keeps the N most-recent entries (by position in the arrays,
 *   which are ordered by attempt ID ascending).
 */
function applyFilters(segments, attemptDurations, attemptDurationById, filters) {
  const minSec  = filters.minDuration !== '' ? parseFloat(filters.minDuration) : null
  const nRecent = filters.recentN     !== '' ? parseInt(filters.recentN, 10)   : null

  // Build allowed attempt ID set from AttemptHistory IDs (not segment array indices).
  // Sorting by ID ascending gives chronological order; recentN takes the tail.
  let allowedIds = null  // null = allow all

  if ((minSec != null && minSec > 0) || (nRecent != null && nRecent > 0)) {
    let candidateIds = attemptDurationById
      ? [...attemptDurationById.keys()].sort((a, b) => a - b)
      : []

    if (minSec != null && minSec > 0) {
      candidateIds = candidateIds.filter(id => (attemptDurationById.get(id) ?? 0) >= minSec)
    }
    if (nRecent != null && nRecent > 0 && candidateIds.length > nRecent) {
      candidateIds = candidateIds.slice(-nRecent)
    }
    allowedIds = new Set(candidateIds)
  }

  // Filter per-segment times by allowed ID set
  const filteredSegments = segments.map(seg => {
    let times = seg.times
    let ids   = seg.attemptIds ?? []
    if (allowedIds !== null && ids.length === times.length) {
      const ft = [], fi = []
      for (let j = 0; j < times.length; j++) {
        if (allowedIds.has(ids[j])) { ft.push(times[j]); fi.push(ids[j]) }
      }
      times = ft; ids = fi
    }
    return { ...seg, times, attemptIds: ids }
  })

  // Filter attempt durations by the same allowed ID set for PB box stats
  let filteredDurations
  if (allowedIds !== null && attemptDurationById) {
    const sortedIds = [...allowedIds].sort((a, b) => a - b)
    filteredDurations = sortedIds.map(id => attemptDurationById.get(id)).filter(d => d != null)
  } else {
    filteredDurations = [...attemptDurations]
    if (minSec != null && minSec > 0) filteredDurations = filteredDurations.filter(d => d >= minSec)
    if (nRecent != null && nRecent > 0) filteredDurations = filteredDurations.slice(-nRecent)
  }

  return { filteredSegments, filteredDurations }
}

export function SplitsAnalyser({ onRunDataChange, onDistributionChange }) {
  const { ready, runPython } = usePyodide()

  const [runData, setRunData]           = useState(null)
  const [fileName, setFileName]         = useState('')
  const [excluded, setExcluded]         = useState(new Set())
  const [distribution, setDistribution] = useState(null)
  const [rankings, setRankings]         = useState(null)
  const [resetStats, setResetStats]     = useState(null)
  const [segmentStats, setSegmentStats] = useState(null)
  const [showCDF, setShowCDF]           = useState(false)
  const [computing, setComputing]       = useState(false)
  const [rankingComputing, setRankingComputing] = useState(false)
  const [error, setError]               = useState(null)
  const [filters, setFilters]           = useState(DEFAULT_FILTERS)
  const [showFilters, setShowFilters]   = useState(false)

  const [midRunResult, setMidRunResult]       = useState(null)
  const [midRunComputing, setMidRunComputing] = useState(false)

  const handleParsed = useCallback((parsed, name) => {
    setRunData(parsed); setFileName(name); setExcluded(new Set())
    setDistribution(null); setRankings(null); setResetStats(null)
    setSegmentStats(null); setError(null); setMidRunResult(null)
    setFilters(DEFAULT_FILTERS)
    onRunDataChange?.(parsed); onDistributionChange?.(null)
  }, [])

  const handleToggleExclude = useCallback((i) => {
    setExcluded(prev => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
    setDistribution(null); setRankings(null); setMidRunResult(null)
  }, [])

  const { filteredSegments, filteredDurations } = useMemo(() => {
    if (!runData) return { filteredSegments: [], filteredDurations: [] }
    return applyFilters(
      runData.segments,
      runData.attemptDurations ?? [],
      runData.attemptDurationById ?? new Map(),
      filters
    )
  }, [runData, filters])

  const compute = useCallback(async () => {
    if (!runData || !ready) return
    setComputing(true); setRankingComputing(true)
    setError(null); setDistribution(null); setRankings(null); setMidRunResult(null)

    try {
      const segs       = filteredSegments.filter((_, i) => !excluded.has(i))
      const segTimes   = segs.map(s => s.times)
      const pbTimes    = segs.map(s => s.pbTime ?? (s.times.length > 0 ? Math.min(...s.times) : 0))
      const resetRates = segs.map(s => s.resetRate)

      const distJson = await runPython(
        'import json; json.dumps(compute_distribution(seg_times.to_py(), pb_times.to_py(), resolution=0.1))',
        { seg_times: segTimes, pb_times: pbTimes }
      )
      const dist = JSON.parse(distJson)
      setDistribution(dist); setSegmentStats(dist.segment_stats); setComputing(false)
      onDistributionChange?.(dist)

      const resetJson = await runPython(
        'import json; json.dumps(compute_reset_stats(reset_rates.to_py()))',
        { reset_rates: resetRates }
      )
      setResetStats(JSON.parse(resetJson))

      const rankJson = await runPython(
        'import json; json.dumps(rank_segments_by_impact(seg_times.to_py(), pb_times.to_py(), resolution=0.1))',
        { seg_times: segTimes, pb_times: pbTimes }
      )
      setRankings(JSON.parse(rankJson))

    } catch (e) {
      setError(e.message)
    } finally {
      setComputing(false); setRankingComputing(false)
    }
  }, [runData, filteredSegments, excluded, ready, runPython])

  const handleMidRunCompute = useCallback(async ({ includedSegIdx, entrySeconds, remainingPB }) => {
    if (!runData || !ready) return
    setMidRunComputing(true)
    setMidRunResult(null)

    try {
      const includedSegs = filteredSegments.filter((_, i) => !excluded.has(i))
      const tailSegs     = includedSegs.slice(includedSegIdx + 1)
      const tailTimes    = tailSegs.map(s => s.times)
      const tailPBTimes  = tailSegs.map(s => s.pbTime ?? (s.times.length > 0 ? Math.min(...s.times) : 0))

      const distJson = await runPython(`
import json, numpy as np
result = compute_distribution(seg_times.to_py(), pb_times.to_py(), resolution=0.1)
x = np.array(result['x'])
cdf = np.array(result['cdf'])
dx = float(x[1] - x[0]) if len(x) > 1 else 0.1
pb_idx = int(np.searchsorted(x, remaining_pb))
pb_prob = float(cdf[min(pb_idx, len(cdf) - 1)])
result['pb_time'] = float(remaining_pb)
result['pb_probability'] = pb_prob
result['remaining_pb'] = float(remaining_pb)
result['entry_seconds'] = float(entry_secs)
json.dumps(result)
`, {
        seg_times:    tailTimes,
        pb_times:     tailPBTimes,
        remaining_pb: remainingPB,
        entry_secs:   entrySeconds,
      })

      const res = JSON.parse(distJson)
      res.from_segment  = tailSegs[0]?.name ?? '?'
      res.entry_seconds = entrySeconds
      res.remaining_pb  = remainingPB
      setMidRunResult(res)

    } catch (e) {
      setError('Mid-run calculation error: ' + e.message)
    } finally {
      setMidRunComputing(false)
    }
  }, [runData, filteredSegments, excluded, ready, runPython])

  useEffect(() => { if (runData && ready) compute() }, [runData]) // eslint-disable-line

  // ── PB probability & expected time ──────────────────────────────────────
  const pbBox = useMemo(() => {
    if (!distribution || !resetStats) return null

    const pbProb         = distribution.pb_probability
    const completionRate = resetStats.completion_probability ?? 1
    const anyRunPbProb   = pbProb * completionRate

    const avgRunTime = filteredDurations.length > 0
      ? filteredDurations.reduce((a, b) => a + b, 0) / filteredDurations.length
      : null

    const expectedRuns = anyRunPbProb > 0 ? 1 / anyRunPbProb : null
    const expectedTime = anyRunPbProb > 0 && avgRunTime != null
      ? avgRunTime / anyRunPbProb : null

    return {
      pbProb, completionRate, anyRunPbProb,
      avgRunTime, expectedRuns, expectedTime,
      durationCount: filteredDurations.length,
    }
  }, [distribution, resetStats, filteredDurations])

  const activeFilterCount = [
    filters.minDuration !== '',
    filters.recentN !== '',
  ].filter(Boolean).length

  if (!runData) {
    return (
      <div className="sa-empty">
        <div className="sa-empty__intro">
          <h2 className="sa-empty__title">Splits Analyser</h2>
          <p className="sa-empty__desc text-2">
            Upload a LiveSplit <code>.lss</code> file to see your run time distribution,
            PB probability, and which segments to focus on.
          </p>
        </div>
        <FileUpload onParsed={handleParsed} />
      </div>
    )
  }

  const includedCount = runData.segments.length - excluded.size
  const includedSegs  = filteredSegments.filter((_, i) => !excluded.has(i))
  const totalPB = includedSegs.reduce((sum, s) => sum + (s.pbTime ?? 0), 0)

  return (
    <div className="sa-wrap">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="sa-header">
        <div className="sa-header__left">
          <div className="sa-title-row">
            <h2 className="sa-game">{runData.gameName}</h2>
            <span className="badge badge-star">{runData.categoryName}</span>
          </div>
          <div className="sa-meta">
            <span className="text-3">{fileName}</span>
            <span className="sa-meta__dot" />
            <span className="text-3">{runData.attemptCount} attempts</span>
            <span className="sa-meta__dot" />
            <span className="text-3">{runData.segments.length} segments</span>
            {totalPB > 0 && <>
              <span className="sa-meta__dot" />
              <span className="text-3">PB <span className="text-star">{fmt(totalPB)}</span></span>
            </>}
          </div>
        </div>
        <div className="sa-header__right">
          <button
            className={`sa-filter-btn ${activeFilterCount > 0 ? 'sa-filter-btn--active' : ''}`}
            onClick={() => setShowFilters(v => !v)}
          >
            {showFilters ? 'Hide filters' : 'Filters'}
            {activeFilterCount > 0 && <span className="sa-filter-badge">{activeFilterCount}</span>}
          </button>
          <button className="sa-change-btn" onClick={() => { setRunData(null); setFileName('') }}>
            Change file
          </button>
          <button className="sa-compute-btn" onClick={compute}
            disabled={computing || !ready || includedCount === 0}>
            {computing ? 'Computing...' : '> Recompute'}
          </button>
        </div>
      </div>

      {/* ── Filter panel ────────────────────────────────────────────────── */}
      {showFilters && (
        <div className="sa-filters">
          <div className="sa-filters__title">Run Filters
            <span className="sa-filters__hint text-3">
              Filters are applied before computing — hit Recompute after changing.
            </span>
          </div>
          <div className="sa-filters__row">
            <div className="sa-filter-field">
              <label className="sa-filter-label">Min run duration (seconds)</label>
              <div className="sa-filter-input-row">
                <input
                  className="sa-filter-input"
                  type="number" min="0" step="1" placeholder="e.g. 50"
                  value={filters.minDuration}
                  onChange={e => setFilters(f => ({ ...f, minDuration: e.target.value }))}
                />
                <span className="sa-filter-hint text-3">
                  Excludes attempts whose total wall-clock time is below this threshold
                  (e.g. 50 removes sub-50s menu resets)
                </span>
              </div>
            </div>
            <div className="sa-filter-field">
              <label className="sa-filter-label">Most recent runs</label>
              <div className="sa-filter-input-row">
                <input
                  className="sa-filter-input"
                  type="number" min="1" step="1" placeholder="all"
                  value={filters.recentN}
                  onChange={e => setFilters(f => ({ ...f, recentN: e.target.value }))}
                />
                <span className="sa-filter-hint text-3">Only use the last N runs</span>
              </div>
            </div>
          </div>
          {activeFilterCount > 0 && (
            <button
              className="sa-filter-clear"
              onClick={() => { setFilters(DEFAULT_FILTERS); setDistribution(null); setRankings(null) }}
            >
              Clear all filters
            </button>
          )}
        </div>
      )}

      {error && <div className="sa-error"><strong>Error:</strong> {error}</div>}

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <div className="sa-body">
        {/* Left column: segments table + PB box */}
        <div className="sa-col sa-col--table">
          <SegmentTable
            segments={filteredSegments}
            excluded={excluded}
            onToggleExclude={handleToggleExclude}
            segmentStats={segmentStats}
          />
          {excluded.size > 0 && (
            <button className="sa-recompute-hint" onClick={compute} disabled={computing}>
              {computing ? 'Computing...' : '> Recompute with ' + includedCount + ' segments'}
            </button>
          )}

          {/* ── True PB probability box — below segment table ─────────── */}
          {pbBox && (
            <div className="sa-pbbox">
              <div className="sa-pbbox__title">True PB Probability</div>
              <div className="sa-pbbox__stats">
                <div className="sa-pbbox__main">
                  <span className="sa-pbbox__value" style={{
                    color: pbBox.anyRunPbProb > 0.05 ? 'var(--green)'
                      : pbBox.anyRunPbProb > 0.01 ? 'var(--star)' : 'var(--red)'
                  }}>
                    {(pbBox.anyRunPbProb * 100).toFixed(2)}%
                  </span>
                  <span className="sa-pbbox__label">per run (incl. resets)</span>
                </div>
                <div className="sa-pbbox__breakdown">
                  <div className="sa-pbbox__row">
                    <span className="text-3">PDF PB chance</span>
                    <span className="text-green">{(pbBox.pbProb * 100).toFixed(1)}%</span>
                  </div>
                  <div className="sa-pbbox__row">
                    <span className="text-3">x completion rate</span>
                    <span className="text-2">{(pbBox.completionRate * 100).toFixed(1)}%</span>
                  </div>
                  <div className="sa-pbbox__divider" />
                  {pbBox.avgRunTime != null ? (
                    <>
                      <div className="sa-pbbox__row">
                        <span className="text-3">Avg run time (incl. resets)</span>
                        <span className="text-2">
                          {fmt(pbBox.avgRunTime)}
                          <span className="sa-pbbox__small"> ({pbBox.durationCount} runs)</span>
                        </span>
                      </div>
                      {pbBox.expectedRuns != null && (
                        <div className="sa-pbbox__row">
                          <span className="text-3">Expected runs until PB</span>
                          <span className="text-star">{pbBox.expectedRuns.toFixed(0)}</span>
                        </div>
                      )}
                      {pbBox.expectedTime != null && (
                        <div className="sa-pbbox__row sa-pbbox__row--highlight">
                          <span className="text-3">Expected time until PB</span>
                          <span className="sa-pbbox__etpb">{fmtDuration(pbBox.expectedTime)}</span>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="sa-pbbox__row">
                      <span className="sa-pbbox__small text-3">
                        No attempt history in .lss — expected time unavailable
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right column: chart + recommendations */}
        <div className="sa-col sa-col--results">
          {computing && !distribution && (
            <div className="sa-computing">
              <span className="sa-computing__spinner">*</span>
              Computing distribution...
            </div>
          )}

          {distribution && (
            <>
              <DistributionChart
                result={distribution}
                showCDF={showCDF}
                onToggleCDF={() => setShowCDF(v => !v)}
                midRunResult={midRunResult}
              />
              <MidRunCalculator
                segments={runData.segments}
                excluded={excluded}
                totalPB={totalPB}
                onCompute={handleMidRunCompute}
                onClear={() => setMidRunResult(null)}
                result={midRunResult}
                computing={midRunComputing}
              />
            </>
          )}

          {(distribution || rankingComputing) && (
            <Recommendations
              rankings={rankings}
              segments={includedSegs}
              resetStats={resetStats}
              loading={rankingComputing && !rankings}
            />
          )}
        </div>
      </div>
    </div>
  )
}

```

### `src/components/SplitsAnalyser/SplitsAnalyser.css`
```css
/* ── Layout ─────────────────────────────────────────────────────────────── */
.sa-wrap { display: flex; flex-direction: column; gap: 1rem; }

.sa-empty {
  display: flex; flex-direction: column; align-items: center;
  gap: 2rem; padding: 3rem 1rem;
}
.sa-empty__intro { text-align: center; display: flex; flex-direction: column; gap: 0.5rem; }
.sa-empty__title { font-family: var(--font-display); font-size: 1.4rem; color: var(--text-1); }
.sa-empty__desc { font-size: 0.85rem; max-width: 480px; }

/* ── Header ─────────────────────────────────────────────────────────────── */
.sa-header {
  display: flex; align-items: flex-start; justify-content: space-between;
  gap: 1rem; flex-wrap: wrap;
}
.sa-header__left { display: flex; flex-direction: column; gap: 0.35rem; }
.sa-header__right { display: flex; align-items: center; gap: 0.6rem; flex-shrink: 0; flex-wrap: wrap; }

.sa-title-row { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
.sa-game { font-family: var(--font-display); font-size: 1.1rem; color: var(--text-1); }

.sa-meta { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; font-size: 0.75rem; }
.sa-meta__dot { width: 3px; height: 3px; border-radius: 50%; background: var(--border-hi); }

.sa-compute-btn {
  background: transparent; border: 1px solid var(--star); border-radius: var(--radius);
  color: var(--star); font-family: var(--font-mono); font-size: 0.75rem;
  padding: 0.45rem 1rem; cursor: pointer; transition: all var(--transition);
}
.sa-compute-btn:hover:not(:disabled) { background: var(--star); color: var(--bg); }
.sa-compute-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.sa-change-btn {
  background: transparent; border: 1px solid var(--border-hi); border-radius: var(--radius);
  color: var(--text-3); font-family: var(--font-mono); font-size: 0.72rem;
  padding: 0.4rem 0.8rem; cursor: pointer; transition: all var(--transition);
}
.sa-change-btn:hover { border-color: var(--text-2); color: var(--text-1); }

/* ── Filter toggle button ────────────────────────────────────────────────── */
.sa-filter-btn {
  position: relative;
  background: transparent; border: 1px solid var(--border-hi); border-radius: var(--radius);
  color: var(--text-3); font-family: var(--font-mono); font-size: 0.72rem;
  padding: 0.4rem 0.8rem; cursor: pointer; transition: all var(--transition);
}
.sa-filter-btn:hover { border-color: var(--purple); color: var(--purple); }
.sa-filter-btn--active { border-color: var(--purple); color: var(--purple); }

.sa-filter-badge {
  position: absolute; top: -6px; right: -6px;
  background: var(--purple); color: var(--bg);
  font-size: 0.6rem; font-weight: 700; border-radius: 99px;
  padding: 1px 5px; line-height: 1.4;
}

/* ── Filters panel ───────────────────────────────────────────────────────── */
.sa-filters {
  display: flex; flex-direction: column; gap: 0.75rem;
  background: var(--bg-card); border: 1px solid var(--border);
  border-radius: var(--radius-lg); padding: 1rem 1.25rem;
}
.sa-filters__title {
  font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.09em;
  color: var(--text-3); font-family: var(--font-mono); font-weight: 600;
  display: flex; align-items: center; gap: 0.75rem;
}
.sa-filters__hint { text-transform: none; letter-spacing: 0; font-weight: 400; font-size: 0.68rem; }

.sa-filters__row {
  display: flex; gap: 1.5rem; flex-wrap: wrap;
}

.sa-filter-field { display: flex; flex-direction: column; gap: 0.3rem; }

.sa-filter-label {
  font-size: 0.63rem; text-transform: uppercase; letter-spacing: 0.09em;
  color: var(--text-3); font-family: var(--font-mono);
}

.sa-filter-input-row { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; }

.sa-filter-input {
  background: var(--bg-raised); border: 1px solid var(--border-hi);
  border-radius: var(--radius); color: var(--text-1);
  font-family: var(--font-mono); font-size: 0.76rem;
  padding: 0.4rem 0.65rem; outline: none; width: 100px;
  transition: border-color var(--transition);
}
.sa-filter-input:focus { border-color: var(--star); }
.sa-filter-hint { font-size: 0.65rem; }

.sa-filter-clear {
  align-self: flex-start;
  background: transparent; border: 1px solid var(--red); border-radius: var(--radius);
  color: var(--red); font-family: var(--font-mono); font-size: 0.68rem;
  padding: 0.3rem 0.7rem; cursor: pointer; transition: all var(--transition);
}
.sa-filter-clear:hover { background: var(--red); color: var(--bg); }

/* ── Body ────────────────────────────────────────────────────────────────── */
.sa-body {
  display: grid;
  grid-template-columns: minmax(320px, 400px) 1fr;
  gap: 1rem; align-items: start;
}
@media (max-width: 900px) {
  .sa-body { grid-template-columns: 1fr; }
}

.sa-col { display: flex; flex-direction: column; gap: 1rem; }

/* ── State messages ──────────────────────────────────────────────────────── */
.sa-computing {
  display: flex; align-items: center; gap: 0.5rem;
  font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-3);
}
.sa-computing__spinner {
  color: var(--star); animation: spin 1s linear infinite; display: inline-block;
}
@keyframes spin { to { transform: rotate(360deg); } }

.sa-error {
  background: rgba(232,64,64,0.08); border: 1px solid var(--red);
  border-radius: var(--radius); padding: 0.6rem 1rem;
  font-size: 0.75rem; color: var(--red);
}

.sa-recompute-hint {
  align-self: flex-start;
  background: transparent; border: 1px dashed var(--border-hi); border-radius: var(--radius);
  color: var(--text-3); font-family: var(--font-mono); font-size: 0.7rem;
  padding: 0.35rem 0.75rem; cursor: pointer; transition: all var(--transition);
}
.sa-recompute-hint:hover:not(:disabled) { border-color: var(--star); color: var(--star); }
.sa-recompute-hint:disabled { opacity: 0.4; cursor: not-allowed; }

/* ── PB probability box ──────────────────────────────────────────────────── */
.sa-pbbox {
  background: rgba(61,214,140,0.04);
  border: 1px solid rgba(61,214,140,0.2);
  border-radius: var(--radius-lg);
  padding: 1rem 1.25rem;
  display: flex; flex-direction: column; gap: 0.75rem;
}

.sa-pbbox__title {
  font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.1em;
  color: var(--text-3); font-family: var(--font-mono); font-weight: 600;
}

.sa-pbbox__stats {
  display: flex; align-items: center; gap: 1.5rem; flex-wrap: wrap;
}

.sa-pbbox__main {
  display: flex; flex-direction: column; align-items: center;
  gap: 0.15rem; flex-shrink: 0;
}

.sa-pbbox__value {
  font-family: var(--font-display); font-size: 2rem;
  font-weight: 800; line-height: 1; letter-spacing: -0.03em;
}

.sa-pbbox__label {
  font-size: 0.58rem; text-transform: uppercase; letter-spacing: 0.07em;
  color: var(--text-3); white-space: nowrap; text-align: center;
}

.sa-pbbox__breakdown {
  display: flex; flex-direction: column; gap: 0.35rem; flex: 1;
}

.sa-pbbox__row {
  display: flex; justify-content: space-between; align-items: baseline;
  gap: 1rem; font-family: var(--font-mono); font-size: 0.75rem;
}
.sa-pbbox__row span:first-child { white-space: nowrap; }
.sa-pbbox__row span:last-child  { white-space: nowrap; text-align: right; }

.sa-pbbox__row--highlight {
  background: rgba(245,200,66,0.07); border-radius: var(--radius);
  padding: 0.25rem 0.5rem; margin: 0 -0.5rem;
}

.sa-pbbox__divider {
  height: 1px; background: rgba(61,214,140,0.15); margin: 0.1rem 0;
}

.sa-pbbox__etpb {
  font-family: var(--font-display); font-size: 1rem;
  font-weight: 700; color: var(--star);
}

.sa-pbbox__small {
  font-size: 0.65rem; color: var(--text-3);
}

/* ── Shared badges ───────────────────────────────────────────────────────── */
.badge {
  display: inline-flex; align-items: center;
  padding: 0.15rem 0.55rem; border-radius: 99px;
  font-size: 0.65rem; font-family: var(--font-mono); letter-spacing: 0.05em;
}
.badge-star { background: rgba(245,200,66,0.12); color: var(--star); border: 1px solid rgba(245,200,66,0.25); }

```

### `src/data/presets.js`
```js
/**
 * presets.js
 *
 * Preset collection templates, grouped by speedrun category.
 *
 * STRUCTURE:
 *   PRESET_CATEGORIES is an array of category groups, each with:
 *     - id:      unique slug
 *     - label:   display name (e.g. "120 Star")
 *     - presets: array of preset collections for that category
 *
 *   Each preset has:
 *     - id:     unique slug
 *     - label:  collection name that will be created
 *     - stars:  array of { stage, star, strategy }
 *
 * HOW TO EDIT:
 *   - Add/remove presets within a category freely.
 *   - Add a new category by appending to PRESET_CATEGORIES.
 *   - stage/star strings must match exactly what's in stars_catalogue.json.
 *   - strategy defaults to 'Standard' — change to any strategy in the catalogue.
 *
 * The presets here are starting points. Users can modify collections after creation.
 */

export const PRESET_CATEGORIES = [
  // ── 120 Star ──────────────────────────────────────────────────────────────
  {
    id: '120',
    label: '120 Star',
    presets: [
      {
        id: 'bob',
        label: 'Bob-omb Battlefield',
        stars: [
          { stage: '1. Bob-omb Battlefield', star: 'Big Bob-omb on the Summit',     strategy: 'Standard' },
          { stage: '1. Bob-omb Battlefield', star: 'Footrace with Koopa the Quick',  strategy: 'Standard' },
          { stage: '1. Bob-omb Battlefield', star: 'Shoot to the Island in the Sky', strategy: 'Standard' },
          { stage: '1. Bob-omb Battlefield', star: 'Find the 8 Red Coins + 100c',    strategy: 'Standard' },
          { stage: '1. Bob-omb Battlefield', star: 'Mario Wings to the Sky',          strategy: 'Standard' },
          { stage: '1. Bob-omb Battlefield', star: "Behind Chain Chomp's Gate",       strategy: 'Standard' },
        ],
      },
      {
        id: 'wf',
        label: "Whomp's Fortress",
        stars: [
          { stage: "2. Whomp's Fortress", star: "Chip off Whomp's Block",          strategy: 'Standard' },
          { stage: "2. Whomp's Fortress", star: 'To the Top of the Fortress',      strategy: 'Standard' },
          { stage: "2. Whomp's Fortress", star: 'Shoot into the Wild Blue',        strategy: 'Standard' },
          { stage: "2. Whomp's Fortress", star: 'Red Coins on the Floating Isle + 100c', strategy: 'Standard' },
          { stage: "2. Whomp's Fortress", star: 'Fall onto the Caged Island',      strategy: 'Standard' },
          { stage: "2. Whomp's Fortress", star: 'Blast Away the Wall',             strategy: 'Standard' },
        ],
      },
      {
        id: 'jrb',
        label: 'Jolly Roger Bay',
        stars: [
          { stage: '3. Jolly Roger Bay', star: 'Plunder in the Sunken Ship',        strategy: 'Standard' },
          { stage: '3. Jolly Roger Bay', star: 'Can the Eel Come Out to Play?',     strategy: 'Standard' },
          { stage: '3. Jolly Roger Bay', star: 'Treasure of the Ocean Cave',        strategy: 'Standard' },
          { stage: '3. Jolly Roger Bay', star: 'Red Coins on the Ship Afloat + 100c', strategy: 'Standard' },
          { stage: '3. Jolly Roger Bay', star: 'Blast to the Stone Pillar',         strategy: 'Standard' },
          { stage: '3. Jolly Roger Bay', star: 'Through the Jet Stream',            strategy: 'Standard' },
        ],
      },
      {
        id: 'ccm',
        label: 'Cool, Cool Mountain',
        stars: [
          { stage: "4. Cool, Cool Mountain", star: "Slip Slidin' Away",              strategy: 'Standard' },
          { stage: "4. Cool, Cool Mountain", star: "Li'l Penguin Lost",              strategy: 'Standard' },
          { stage: "4. Cool, Cool Mountain", star: 'Big Penguin Race + 100c',        strategy: 'Standard' },
          { stage: "4. Cool, Cool Mountain", star: 'Frosty Slide for 8 Red Coins',   strategy: 'Standard' },
          { stage: "4. Cool, Cool Mountain", star: "Snowman's Lost His Head",        strategy: 'Standard' },
          { stage: "4. Cool, Cool Mountain", star: 'Wall Kicks Will Work',           strategy: 'Standard' },
        ],
      },
      {
        id: 'bbh',
        label: "Big Boo's Haunt",
        stars: [
          { stage: "5. Big Boo's Haunt", star: 'Go on a Ghost Hunt',                strategy: 'Standard' },
          { stage: "5. Big Boo's Haunt", star: "Ride Big Boo's Merry-Go-Round",     strategy: 'Standard' },
          { stage: "5. Big Boo's Haunt", star: 'Secret of the Haunted Books',       strategy: 'Standard' },
          { stage: "5. Big Boo's Haunt", star: 'Seek the 8 Red Coins + 100c',       strategy: 'Standard' },
          { stage: "5. Big Boo's Haunt", star: "Big Boo's Balcony",                  strategy: 'Standard' },
          { stage: "5. Big Boo's Haunt", star: 'Eye to Eye in the Secret Room',     strategy: 'Standard' },
        ],
      },
      {
        id: 'hmc',
        label: 'Hazy Maze Cave',
        stars: [
          { stage: '6. Hazy Maze Cave', star: 'Swimming Beast in the Cavern',       strategy: 'Standard' },
          { stage: '6. Hazy Maze Cave', star: 'Elevate for 8 Red Coins + 100c',     strategy: 'Standard' },
          { stage: '6. Hazy Maze Cave', star: 'Metal-Head Mario Can Move!',          strategy: 'Standard' },
          { stage: '6. Hazy Maze Cave', star: 'Navigating the Toxic Maze',          strategy: 'Standard' },
          { stage: '6. Hazy Maze Cave', star: 'A-Maze-ing Emergency Exit',          strategy: 'Standard' },
          { stage: '6. Hazy Maze Cave', star: 'Watch for Rolling Rocks',            strategy: 'Standard' },
        ],
      },
      {
        id: 'lll',
        label: 'Lethal Lava Land',
        stars: [
          { stage: '7. Lethal Lava Land', star: 'Boil the Big Bully',               strategy: 'Standard' },
          { stage: '7. Lethal Lava Land', star: 'Bully the Bullies',                strategy: 'Standard' },
          { stage: '7. Lethal Lava Land', star: '8-Coin Puzzle with 15 Pieces',     strategy: 'Standard' },
          { stage: '7. Lethal Lava Land', star: 'Red-Hot Log Rolling',              strategy: 'Standard' },
          { stage: '7. Lethal Lava Land', star: 'Hot-Foot-It into the Volcano',     strategy: 'Standard' },
          { stage: '7. Lethal Lava Land', star: 'Elevator Tour in the Volcano',     strategy: 'Standard' },
        ],
      },
      {
        id: 'ssl',
        label: 'Shifting Sand Land',
        stars: [
          { stage: '8. Shifting Sand Land', star: 'In the Talons of the Big Bird',  strategy: 'Standard' },
          { stage: '8. Shifting Sand Land', star: 'Shining atop the Pyramid',       strategy: 'Standard' },
          { stage: '8. Shifting Sand Land', star: 'Inside the Ancient Pyramid',     strategy: 'Standard' },
          { stage: '8. Shifting Sand Land', star: 'Stand Tall on the Four Pillars', strategy: 'Standard' },
          { stage: '8. Shifting Sand Land', star: 'Free Flying for 8 Red Coins',    strategy: 'Standard' },
          { stage: '8. Shifting Sand Land', star: 'Pyramid Puzzle',                 strategy: 'Standard' },
        ],
      },
      {
        id: 'ddd',
        label: 'Dire, Dire Docks',
        stars: [
          { stage: '9. Dire, Dire Docks', star: "Board Bowser's Sub",               strategy: 'Standard' },
          { stage: '9. Dire, Dire Docks', star: 'Chests in the Current',            strategy: 'Standard' },
          { stage: '9. Dire, Dire Docks', star: 'Pole-Jumping for Red Coins + 100c', strategy: 'Standard' },
          { stage: '9. Dire, Dire Docks', star: 'Through the Jet Stream',           strategy: 'Standard' },
          { stage: '9. Dire, Dire Docks', star: "The Manta Ray's Reward",           strategy: 'Standard' },
          { stage: '9. Dire, Dire Docks', star: 'Collect the Caps...',              strategy: 'Standard' },
        ],
      },
      {
        id: 'sl',
        label: "Snowman's Land",
        stars: [
          { stage: "10. Snowman's Land", star: "Snowman's Big Head",                strategy: 'Standard' },
          { stage: "10. Snowman's Land", star: 'Chill with the Bully',              strategy: 'Standard' },
          { stage: "10. Snowman's Land", star: 'In the Deep Freeze',                strategy: 'Standard' },
          { stage: "10. Snowman's Land", star: 'Whirl from the Freezing Pond',      strategy: 'Standard' },
          { stage: "10. Snowman's Land", star: "Shell Shreddin' for Red Coins",     strategy: 'Standard' },
          { stage: "10. Snowman's Land", star: 'Into the Igloo',                    strategy: 'Standard' },
        ],
      },
      {
        id: 'wdw',
        label: 'Wet-Dry World',
        stars: [
          { stage: '11. Wet-Dry World', star: 'Shocking Arrow Lifts!',              strategy: 'Standard' },
          { stage: '11. Wet-Dry World', star: "Top o' the Town",                    strategy: 'Standard' },
          { stage: '11. Wet-Dry World', star: 'Secrets in the Shallows & Sky',      strategy: 'Standard' },
          { stage: '11. Wet-Dry World', star: 'Express Elevator--Hurry Up!',        strategy: 'Standard' },
          { stage: '11. Wet-Dry World', star: 'Go to Town for Red Coins + 100c',    strategy: 'Standard' },
          { stage: '11. Wet-Dry World', star: 'Quick Race Through Downtown!',       strategy: 'Standard' },
        ],
      },
      {
        id: 'ttm',
        label: 'Tall, Tall Mountain',
        stars: [
          { stage: '12. Tall, Tall Mountain', star: 'Scale the Mountain',           strategy: 'Standard' },
          { stage: '12. Tall, Tall Mountain', star: 'Mystery of the Monkey Cage',   strategy: 'Standard' },
          { stage: '12. Tall, Tall Mountain', star: "Scary 'Shrooms, Red Coins",    strategy: 'Standard' },
          { stage: '12. Tall, Tall Mountain', star: 'Mysterious Mountainside',      strategy: 'Standard' },
          { stage: '12. Tall, Tall Mountain', star: 'Breathtaking View from Bridge', strategy: 'Standard' },
          { stage: '12. Tall, Tall Mountain', star: 'Blast to the Lonely Mushroom', strategy: 'Standard' },
        ],
      },
      {
        id: 'thi',
        label: 'Tiny-Huge Island',
        stars: [
          { stage: '13. Tiny-Huge Island', star: 'Pluck the Piranha Flower',        strategy: 'Standard' },
          { stage: '13. Tiny-Huge Island', star: 'The Tip Top of the Huge Island',  strategy: 'Standard' },
          { stage: '13. Tiny-Huge Island', star: 'Rematch with Koopa the Quick',    strategy: 'Standard' },
          { stage: '13. Tiny-Huge Island', star: 'Five Itty Bitty Secrets',         strategy: 'Standard' },
          { stage: '13. Tiny-Huge Island', star: "Wiggler's Red Coins",             strategy: 'Standard' },
          { stage: '13. Tiny-Huge Island', star: 'Make Wiggler Squirm',             strategy: 'Standard' },
        ],
      },
      {
        id: 'ttc',
        label: 'Tick Tock Clock',
        stars: [
          { stage: '14. Tick Tock Clock', star: 'Roll into the Cage',               strategy: 'Standard' },
          { stage: '14. Tick Tock Clock', star: 'The Pit and the Pendulums',        strategy: 'Standard' },
          { stage: '14. Tick Tock Clock', star: 'Get a Hand',                       strategy: 'Standard' },
          { stage: '14. Tick Tock Clock', star: 'Stomp on the Thwomp',              strategy: 'Standard' },
          { stage: '14. Tick Tock Clock', star: 'Timed Jumps on Moving Bars',       strategy: 'Standard' },
          { stage: '14. Tick Tock Clock', star: 'Stop Time for Red Coins',          strategy: 'Standard' },
        ],
      },
      {
        id: 'rr',
        label: 'Rainbow Ride',
        stars: [
          { stage: '15. Rainbow Ride', star: 'Cruiser Crossing the Rainbow',        strategy: 'Standard' },
          { stage: '15. Rainbow Ride', star: 'The Big House in the Sky (PAUSE TIME INCLUDED)', strategy: 'Standard' },
          { stage: '15. Rainbow Ride', star: 'Coins Amassed in a Maze',             strategy: 'Standard' },
          { stage: '15. Rainbow Ride', star: "Swingin' in the Breeze",              strategy: 'Standard' },
          { stage: '15. Rainbow Ride', star: 'Tricky Triangles!',                   strategy: 'Standard' },
          { stage: '15. Rainbow Ride', star: 'Somewhere over the Rainbow',          strategy: 'Standard' },
        ],
      },
      {
        id: 'castle',
        label: 'Castle Secret Stars',
        stars: [
          { stage: 'Castle Secret Stars', star: 'Tower of the Wing Cap',            strategy: 'Standard' },
          { stage: 'Castle Secret Stars', star: 'Vanish Cap under the Moat',        strategy: 'Standard' },
          { stage: 'Castle Secret Stars', star: 'Cavern of the Metal Cap',          strategy: 'Standard' },
          { stage: 'Castle Secret Stars', star: 'The Secret Aquarium',              strategy: 'Standard' },
          { stage: 'Castle Secret Stars', star: 'Wing Mario over the Rainbow',      strategy: 'Standard' },
          { stage: 'Castle Secret Stars', star: "The Princess's Secret Slide",      strategy: 'Standard' },
        ],
      },
      {
        id: 'bowser_120',
        label: 'Bowser Courses',
        stars: [
          { stage: 'Bowser Courses', star: 'Bowser in the Dark World Course',       strategy: 'Standard' },
          { stage: 'Bowser Courses', star: 'Bowser in the Dark World Red Coins',    strategy: 'Standard' },
          { stage: 'Bowser Courses', star: 'Bowser in the Dark World Battle',       strategy: 'Standard' },
          { stage: 'Bowser Courses', star: 'Bowser in the Fire Sea Course',         strategy: 'Standard' },
          { stage: 'Bowser Courses', star: 'Bowser in the Fire Sea Red Coins',      strategy: 'Standard' },
          { stage: 'Bowser Courses', star: 'Bowser in the Fire Sea Battle',         strategy: 'Standard' },
          { stage: 'Bowser Courses', star: 'Bowser in the Sky Course',              strategy: 'Standard' },
        ],
      },
    ],
  },

  // ── 70 Star ───────────────────────────────────────────────────────────────
  // Edit these to match the segments/stars used in your 70-star route.
  {
    id: '70',
    label: '70 Star',
    presets: [
      {
        id: '70_bob',
        label: '70s BoB',
        stars: [
          { stage: '1. Bob-omb Battlefield', star: 'Big Bob-omb on the Summit',     strategy: 'Standard' },
          { stage: '1. Bob-omb Battlefield', star: 'Footrace with Koopa the Quick',  strategy: 'Standard' },
          { stage: '1. Bob-omb Battlefield', star: 'Shoot to the Island in the Sky', strategy: 'Standard' },
          { stage: '1. Bob-omb Battlefield', star: 'Find the 8 Red Coins + 100c',    strategy: 'Standard' },
          { stage: '1. Bob-omb Battlefield', star: 'Mario Wings to the Sky',          strategy: 'Standard' },
          { stage: '1. Bob-omb Battlefield', star: "Behind Chain Chomp's Gate",       strategy: 'Standard' },
        ],
      },
      {
        id: '70_bowser',
        label: '70s Bowser fights',
        stars: [
          { stage: 'Bowser Courses', star: 'Bowser in the Dark World Battle',       strategy: 'Standard' },
          { stage: 'Bowser Courses', star: 'Bowser in the Fire Sea Battle',         strategy: 'Standard' },
          { stage: 'Bowser Courses', star: 'Bowser in the Sky Course',              strategy: 'Standard' },
        ],
      },
    ],
  },

  // ── 16 Star ───────────────────────────────────────────────────────────────
  // Covers the stars typically obtained in a 16-star run.
  // Adjust to your preferred route order.
  {
    id: '16',
    label: '16 Star',
    presets: [
      {
        id: '16_bitdw',
        label: '16s BitDW',
        stars: [
          { stage: 'Bowser Courses', star: 'Bowser in the Dark World Course',       strategy: 'Standard' },
          { stage: 'Bowser Courses', star: 'Bowser in the Dark World Battle',       strategy: 'Standard' },
        ],
      },
      {
        id: '16_bitfs',
        label: '16s BitFS',
        stars: [
          { stage: 'Bowser Courses', star: 'Bowser in the Fire Sea Course',         strategy: 'Standard' },
          { stage: 'Bowser Courses', star: 'Bowser in the Fire Sea Battle',         strategy: 'Standard' },
        ],
      },
      {
        id: '16_bits',
        label: '16s BitS',
        stars: [
          { stage: 'Bowser Courses', star: 'Bowser in the Sky Course',              strategy: 'Standard' },
        ],
      },
    ],
  },

  // ── 1 Star ────────────────────────────────────────────────────────────────
  {
    id: '1',
    label: '1 Star',
    presets: [
      {
        id: '1_bits',
        label: '1s BitS',
        stars: [
          { stage: 'Bowser Courses', star: 'Bowser in the Sky Course',              strategy: 'Standard' },
        ],
      },
    ],
  },

  // ── 0 Star ────────────────────────────────────────────────────────────────
  {
    id: '0',
    label: '0 Star',
    presets: [
      // 0 star does not collect any stars — add timing segments here if useful,
      // e.g. individual movement sections you want to track.
      // { id: '0_example', label: 'Example segment', stars: [] },
    ],
  },
]

```

### `src/data/segmentOffsets.js`
```js
/**
 * segmentOffsets.js
 *
 * Maps named star collections to segments in a loaded .lss file,
 * with a fixed time offset (seconds) to add to the collection's
 * convolved time to make it directly comparable to the real split.
 *
 * The offset accounts for time that appears in the .lss segment but
 * is NOT captured by the star timer — e.g. castle transitions,
 * loading zones, menu time, movement between stars.
 *
 * HOW TO USE:
 *   1. Note the exact segment name as it appears in your .lss file.
 *   2. Time the fixed overhead not covered by individual star attempts.
 *   3. Add an entry below.
 *
 * The "collectionId" key must exactly match the collection name the
 * user creates in the Star Timer tool.
 *
 * FORMAT:
 * {
 *   [collectionId]: {
 *     lssSegment:    string   — segment name in the .lss file (exact match)
 *     offsetSeconds: number   — seconds to add to collection convolved time
 *     notes:         string   — human-readable description of what the offset covers
 *   }
 * }
 */

export const SEGMENT_OFFSETS = {
  // ── Example entries (replace / add your own) ──────────────────────────────

  // "Bob-omb Battlefield": {
  //   lssSegment:    "BoB",
  //   offsetSeconds: 14.2,
  //   notes:         "Castle transition + star select screen + course entry",
  // },

  // "Bowser 1": {
  //   lssSegment:    "BitDW",
  //   offsetSeconds: 8.5,
  //   notes:         "Basement door + staircase + course entry",
  // },
}

```
