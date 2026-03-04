# Functional Specification Document
## Super Mario 64 Speedrun Analysis Website

**Version:** 1.0
**Status:** Phase 1 complete — Phase 2 in progress

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [System Architecture](#2-system-architecture)
3. [Feature 1: Splits Analyser](#3-feature-1-splits-analyser) ✓ Complete
4. [Feature 2: Star Timer & Selection Tool](#4-feature-2-star-timer--selection-tool) ← Current
5. [Feature 3: Player Similarity](#5-feature-3-player-similarity)
6. [Implementation Plan](#6-implementation-plan)
7. [Decisions Log](#7-decisions-log)

---

## 1. Project Overview

### 1.1 Purpose

A web application for Super Mario 64 speedrunners to analyse their historical performance data, estimate future run time distributions, track individual star attempts, and discover similar players in the community. The architecture is designed to eventually generalise to other games and categories.

### 1.2 Target Users

- SM64 speedrunners across all categories (120-star, 70-star, 16-star, 1-star, etc.)
- Players who use LiveSplit and have accumulated split history
- Community members who appear in community spreadsheets such as the "Ultimate Star Spreadsheet"

### 1.3 Goals

- Give runners a data-driven picture of their realistic run time distribution, including PB probability
- Identify which segments most limit a runner's chances of improving
- Allow runners to track individual star times and estimate stage or multi-star segment distributions
- Surface similar players in the community to help runners benchmark themselves
- Keep hosting costs at or near zero

---

## 2. System Architecture

### 2.1 Stack

| Layer | Technology | Rationale |
|---|---|---|
| Frontend | React (SPA via Vite) | Component model; good charting support |
| Computation | Python (Pyodide) running in the browser | Runs NumPy/SciPy in-browser via WebAssembly; eliminates backend entirely for Features 1 & 2 |
| Backend (Feature 3 only) | Python (FastAPI) on a free tier (Render or Fly.io) | Only needed to serve the pre-processed similarity matrix; minimal load |
| Storage | Browser `localStorage` (Features 1 & 2) + Supabase free tier (Feature 2 cross-device sync) | Supabase free tier: 500 MB PostgreSQL + auth at zero cost |
| Charting | Plotly.js | Best scientific chart quality; interactive zoom/hover; good distribution plot support |
| Hosting | Vercel (frontend) + Render free tier (backend) | Both have generous free tiers |

### 2.2 Why Pyodide Instead of a Backend for Features 1 & 2?

Keeping computation entirely in-browser via Pyodide eliminates backend hosting costs and API latency for the two most compute-heavy features. Pyodide loads NumPy + SciPy via WebAssembly (~10 MB, cached after first load). FFT convolution over 22 segments at 0.1 s resolution completes in well under one second in NumPy even under Pyodide. No .lss file data ever leaves the user's browser.

If Pyodide load time proves unacceptable UX-wise, the same Python computation code can be moved to a FastAPI endpoint with minimal refactoring.

### 2.3 High-Level Data Flow

**Features 1 & 2 (fully client-side):**
```
User uploads .lss file  OR  logs star attempts manually
  → JS parses input in-browser
  → Numeric arrays passed to Pyodide (NumPy/SciPy)
  → Per-segment KDE → FFT convolution → total-time PDF
  → Plotly renders interactive chart + stats
```

**Feature 3 (server-assisted):**
```
Admin uploads XLSX spreadsheet export
  → FastAPI: parse times, compute percentile ranks, cosine similarity matrix
  → Stores processed JSON on server
  → User selects player → GET /api/similarity/{player}
  → Frontend: Plotly radar chart + similarity table
```

### 2.4 Repository Structure

```
mario-app/                              (working dev directory)
├── index.html
├── vite.config.js
├── package.json
└── src/
    ├── App.jsx / App.css
    ├── components/
    │   ├── PyodideLoader.jsx / .css
    │   ├── PyodideSmokeTest.jsx        (Phase 0 validation suite)
    │   ├── SplitsAnalyser/             (Phase 1 — complete)
    │   │   ├── index.jsx
    │   │   ├── SplitsAnalyser.css
    │   │   ├── FileUpload.jsx / .css
    │   │   ├── SegmentTable.jsx / .css
    │   │   ├── DistributionChart.jsx / .css
    │   │   ├── Recommendations.jsx / .css
    │   │   └── MidRunCalculator.jsx / .css
    │   └── StarTimer/                  (Phase 2 — in progress)
    │       ├── TimeEntry.jsx / .css
    │       ├── StarSelector.jsx / .css
    │       ├── SelectionBuilder.jsx / .css
    │       └── CombinedChart.jsx / .css
    ├── pyodide/
    │   ├── usePyodide.js               (Pyodide lifecycle hook)
    │   └── convolution.py              (KDE + FFT engine — shared by Features 1 & 2)
    ├── utils/
    │   ├── lssParser.js
    │   └── timeParser.js
    └── data/
        └── stars_catalogue.json        (Phase 2)
```

---

## 3. Feature 1: Splits Analyser ✓

**Status: Complete.**

### 3.1 Overview

Users upload a LiveSplit `.lss` file. The application extracts their historical segment times, computes a KDE-smoothed probability distribution over possible total run times, displays PB probability, and ranks segments by their impact on PB chance.

### 3.2 LSS Parsing (`lssParser.js`)

LiveSplit saves data as UTF-8 XML with a BOM (`\ufeff`). Key parsing rules:

| Condition | Action |
|---|---|
| BOM at file start | Strip before XML parsing |
| `id` attribute is negative | Exclude — LiveSplit-estimated baseline, not a real attempt |
| `<Time>` element with no `<RealTime>` child | Self-closing tag = reset on this segment; excluded from times |
| Segment name | Read from `<n>` tag (lowercase); fallback to `<Name>` |
| `SplitTime name="Personal Best" / RealTime` | Cumulative PB time; differenced to get per-segment PB |
| `BestSegmentTime / RealTime` | Per-segment gold (best ever time for that segment) |
| Segment history `<RealTime>` values | Already per-segment — **not** cumulative |

**Anomalous carry-over exclusion:** If attempt ID *x* self-closes (resets) on segment *i*, any time recorded for ID *x* on any later segment is excluded. This prevents LiveSplit timing artefacts from inflating later-segment means.

**Reset rate — survival formula:**
```
reset_rate[i] = (prev_reached − reached[i]) / prev_reached
```
where `reached[i]` = count of positive-id entries in segment *i*'s history (both completed times and on-segment self-closes), and `prev_reached` starts as `AttemptCount` and carries forward. This correctly captures the fraction of all attempts that never progressed past each segment.

### 3.3 Distribution Computation (`convolution.py`)

All computation runs inside Pyodide (NumPy + SciPy in the browser via WebAssembly).

**Public API:**

| Function | Inputs | Returns |
|---|---|---|
| `compute_distribution(seg_times, pb_times, resolution=0.1)` | List of time arrays; list of per-segment PB times (seconds) | `{x, pdf, cdf, pb_time, pb_probability, percentiles, segment_stats}` |
| `rank_segments_by_impact(seg_times, pb_times, resolution=0.1)` | Same as above | Ranked list of `{index, delta_pb, variance_share, std, mean, n}` |
| `compute_reset_stats(segment_reset_rates)` | List of pre-computed survival reset rates | `{completion_probability, per_segment: [{reset_rate}]}` |

**Algorithm:**
1. Fit a Gaussian KDE (Scott's rule bandwidth) to each segment's times on a shared 0.1 s grid spanning `[0, max_time × 1.3]`.
2. FFT-convolve all per-segment PDFs to produce the joint total-run PDF.
3. Normalise; compute CDF; evaluate PB probability as `CDF(pb_time)`.
4. Compute percentiles (p10, p25, p50, p75, p90).
5. For rankings: replace each segment's KDE with a point mass at its PB time, recompute total distribution, `ΔPB_i = new_prob − baseline_prob`.

**PDF interpretation:** The distribution is conditional on finishing — it shows the distribution of finish times given that the run completes. Reset rates are shown separately in the Recommendations panel and do not reshape the PDF. This is the correct frame of reference for a runner making a mid-run decision.

### 3.4 UI Components

**FileUpload** — Drag-and-drop zone with file picker fallback; validates `.lss` extension; visual loading and error states.

**SegmentTable** — Columns: toggle (include/exclude), name, attempts, golds (best segment time, green), PB, mean, std dev mini-bar. Low-confidence warning for < 10 attempts. Horizontally scrollable with minimum column widths to prevent clipping.

**DistributionChart (Plotly)** — KDE-smoothed PDF in gold; optional CDF in blue (toggle); green PB zone and vertical PB line with annotation; p50 and p90 percentile lines. Auto-zooms on load to cover 99% of PDF density (0.5th–99.5th percentile) with 5% padding each side. When a mid-run result is active, overlays the remaining-run PDF in purple with its own PB threshold.

**MidRunCalculator** — Segment dropdown (all included segments except the last) and cumulative time input (accepts `M:SS` or raw seconds). Label shows PB-pace reference (cumulative PB time at the *end* of the selected split). Computes the remaining distribution from the segment *after* the completed split, using `remaining_pb = total_pb − entry_time`. Result panel shows PB chance, entry time, remaining PB needed, and median projected finish.

**Recommendations** — Completion probability headline (survival-based); reset rate bar chart for segments with > 1% reset rate; ranked segment impact table with ΔPB%, variance share, std dev, and attempt count.

### 3.5 Deferred Items

- Sparkline histograms per row in the segment table
- Toggle between "improvement impact" and "variance contribution" ranking views

---

## 4. Feature 2: Star Timer & Selection Tool

**Status: Not started — current phase.**

### 4.1 Overview

A standalone tool for logging times and success/failure on individual stars. Users can combine any set of stars and get a distribution over the combined time, with preset groupings for common selections (full stages, Bowser fights, etc.). The same `convolution.py` engine from Feature 1 is reused without modification.

### 4.2 Data Model

Stored in browser `localStorage` (and optionally synced to Supabase):

```json
{
  "stars": {
    "bob_star1_jp": {
      "name": "Big Bob-omb on the Summit (JP)",
      "stage": "Bob-omb Battlefield",
      "star_number": 1,
      "attempts": [
        { "timestamp": "2025-01-01T12:00:00Z", "success": true,  "time_seconds": 45.3  },
        { "timestamp": "2025-01-02T10:00:00Z", "success": false, "time_seconds": null  }
      ]
    }
  },
  "saved_selections": [
    { "name": "My BoB setup", "star_ids": ["bob_star1_jp", "bob_star2"] }
  ]
}
```

### 4.3 Star Catalogue (`stars_catalogue.json`)

A hardcoded JSON file shipped with the app, covering all 120 stars at strategy-level granularity matching the Ultimate Star Spreadsheet. Each entry:

| Field | Description |
|---|---|
| `star_id` | Unique slug (e.g. `bob_star1_jp`) |
| `name` | Display name including strategy variant |
| `stage` / `stage_id` | Stage grouping |
| `preset_groups` | Array of preset group memberships |

The granularity must match the spreadsheet (e.g. "BoB RTA" and "Big Bob-omb on the Summit (JP)" are separate entries) so that Feature 3 data can eventually pre-populate Feature 2 attempt times.

### 4.4 Time Entry UI (`TimeEntry.jsx`)

- Star picker: searchable dropdown grouped by stage, then by star/strategy
- Time input: accepts `M:SS.ss` or bare seconds; Enter to submit
- Success/failure toggle (failures recorded but excluded from time distribution)
- Per-star attempt history: timestamp, time, success/fail; inline edit and delete
- Attempt count and success rate shown per star

### 4.5 Star Selection & Combination (`StarSelector.jsx`, `SelectionBuilder.jsx`)

**Preset groupings:**

| Preset | Contents |
|---|---|
| Bob-omb Battlefield | All BoB stars/strategies |
| Whomp's Fortress | All WF stars |
| Jolly Roger Bay | All JRB stars |
| Cool Cool Mountain | All CCM stars |
| Big Boo's Haunt | All BBH stars |
| Hazy Maze Cave | All HMC stars |
| Lethal Lava Land | All LLL stars |
| Shifting Sand Land | All SSL stars |
| Dire Dire Docks | All DDD stars |
| Snowman's Land | All SL stars |
| Wet-Dry World | All WDW stars |
| Tall Tall Mountain | All TTM stars |
| Tiny-Huge Island | All THI stars |
| Tick Tock Clock | All TTC stars |
| Rainbow Ride | All RR stars |
| Bowser stages | All three Bowser fights |
| 100-coin stars | All 15 100-coin stars |
| Cap stages | Wing Cap, Metal Cap, Vanish Cap + secret stars |
| Full 120 | All 120 stars |

Users can also build and save custom selections. Saved selections persist in `localStorage`.

### 4.6 Distribution Computation & Output (`CombinedChart.jsx`)

Calls `compute_distribution(seg_times, pb_times)` from `convolution.py` with the selected stars' successful-attempt time arrays. Failures are excluded from the distribution but shown as a success rate per star.

Minimum data requirement: fewer than 5 successful attempts triggers a low-confidence warning. Distribution is still computed.

Output:
- PDF/CDF chart of combined time (same Plotly patterns as Feature 1)
- Key percentile table (p10–p90)
- Per-star breakdown: mean, std, success rate, variance share
- "Weak link" callout: the star with the highest variance contribution

### 4.7 Cross-Device Sync (Supabase) — Optional

Optional Supabase Auth (email or OAuth). Without login, data lives only in `localStorage`. With login, each write is mirrored to Supabase. On login from a new device, server data is merged with local data using timestamp-based last-write-wins per attempt entry. Supabase free tier (500 MB, 50k MAU) is sufficient for community-scale use.

---

## 5. Feature 3: Player Similarity

**Status: Not started — Phase 3.**

### 5.1 Overview

Using data from the Ultimate Star Spreadsheet (periodic XLSX export), compute cosine similarity between players' percentile-ranked star time vectors. Users select their name and see their closest peers.

### 5.2 Spreadsheet Structure

The spreadsheet has ~781 rows and ~459 columns on the main sheet. Player names are in row 0, starting at column index 6. Star/strategy names live in the `Best Time(Raw)` sheet, column 0, at the same row indices.

Time cell formats:

| Format | Example | Action |
|---|---|---|
| Plain string, seconds | `"45.30"` | Parse directly |
| Plain string, M:SS.ss | `"1:22.70"` | Convert to seconds |
| HYPERLINK formula | `=HYPERLINK("https://...", "45.30")` | Extract display text (second argument) |
| Trailing asterisk | `"44.73*"` | Strip `*`, parse normally (unverified time) |
| Contains `x` or `X` | `"6:17.xx"` | Treat as null |
| `None` | — | No data |

### 5.3 Preprocessing Pipeline (FastAPI)

1. Read `Best Time(Raw)` sheet column 0 for star/strategy names.
2. Read main sheet row 0 (columns 6+) for player names.
3. Parse all time cells to seconds using rules above.
4. For each star row: compute percentile rank among players with non-null values (0 = fastest, 100 = slowest).
5. Impute missing values as 50.
6. Compute pairwise cosine similarity matrix (~453 × 453) via `sklearn.metrics.pairwise.cosine_similarity`.
7. Compute each player's overall score = mean percentile across all stars they have data for.
8. Persist as compressed JSON for the API to serve.

### 5.4 UI

- **Player selector:** Searchable dropdown with overall rank tier shown (e.g. "cheese — top 3%")
- **Similarity results:** Top 10 similar players sorted by score; columns: name, similarity %, overall rank
- **Radar chart:** Per-stage mean percentile for selected player vs top match, across 15 main stages + Bowser + secret stars
- **Star breakdown table:** Per-star times and percentile ranks for both players, sortable by percentile gap

### 5.5 Backend API

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/similarity/upload` | Admin token | Upload XLSX; triggers preprocessing |
| `GET` | `/api/similarity/players` | None | List of `{name, overall_rank}` |
| `GET` | `/api/similarity/{player_name}` | None | Top-10 similar players + star breakdown |

---

## 6. Implementation Plan

### 6.1 Phases

**Phase 0 — Infra** ✓ Complete
- React + Vite project; Windows PowerShell setup script
- Pyodide loading hook with progress display (`usePyodide.js`, `PyodideLoader.jsx`)
- Smoke test suite (12 checks) validating the full pipeline end-to-end

**Phase 1 — Feature 1: Splits Analyser** ✓ Complete
- `lssParser.js`: BOM handling, `<n>` tag, negative ID exclusion, self-closing reset detection, anomalous carry-over exclusion, survival-based reset rates, per-segment PB differencing, gold times
- `convolution.py`: KDE smoothing, FFT convolution, PB probability, percentiles, ΔPB segment rankings, survival reset stats
- `FileUpload`: drag-and-drop with visual feedback
- `SegmentTable`: attempts, golds, PB, mean, std dev bars; exclude toggles; scroll-safe layout
- `DistributionChart`: PDF + optional CDF; PB zone; auto-zoom to 99% density ±5%; percentile lines; mid-run overlay
- `Recommendations`: survival-based completion rate; reset rate bars; ranked impact table
- `MidRunCalculator`: mid-run PB probability from any completed split

**Phase 2 — Feature 2: Star Timer** ← Current
- `stars_catalogue.json`: 120-star catalogue at strategy-level granularity
- `TimeEntry.jsx`: star picker, time/success input, per-star history with edit/delete
- `StarSelector.jsx`: preset groupings + custom selection builder; saved selections in `localStorage`
- `CombinedChart.jsx`: calls existing `compute_distribution`; PDF chart + percentile table + per-star breakdown
- Supabase auth + sync (after core functionality is working)

**Phase 3 — Feature 3: Player Similarity**
- FastAPI XLSX ingest + preprocessing pipeline
- Cosine similarity matrix computation + JSON output
- Player selector + similarity table + radar chart UI

**Phase 4 — Polish**
- Mobile-responsive layout
- Loading skeletons and error states throughout
- PNG/SVG chart export
- Community announcement post

### 6.2 Key Dependencies

**Frontend:** `react`, `vite`, `pyodide`, `plotly.js`, `@supabase/supabase-js`

**Backend (Feature 3 only):** `fastapi`, `uvicorn`, `openpyxl`, `numpy`, `scikit-learn`

---

## 7. Decisions Log

| # | Question | Decision |
|---|---|---|
| 1 | Hosting model | Pyodide in-browser for Features 1 & 2 (zero cost, zero latency). Thin FastAPI on Render free tier for Feature 3 only. Frontend on Vercel. |
| 2 | Cross-device sync | Supabase free tier for star attempt history. Auth optional — `localStorage` works without an account. |
| 3 | Spreadsheet access | Periodic manual XLSX upload by admin. Google Sheets live API deferred. |
| 4 | Category scope | Category-agnostic from the start (reads any `.lss` segments). Star catalogue initially covers 120-star but is extensible. SM64-only for v1. |
| 5 | Reset modelling | Survival formula: `reset_rate[i] = (prev_reached − reached[i]) / prev_reached`, starting from `AttemptCount`. More accurate than naive `resets / (times + resets)`. Full session-time modelling (expected retries) deferred to v2. |
| 6 | Distribution smoothing | KDE (Gaussian, Scott's rule) applied per segment before FFT convolution. |
| 7 | File privacy | `.lss` parsed entirely in-browser. Only numeric arrays passed to Pyodide. No user data transmitted for Features 1 & 2. |
| 8 | PDF interpretation | Conditional on finishing (correct frame for mid-run decisions). Reset rates shown separately. Unconditional model (scaled by completion probability) deferred to a future toggle. |
| 9 | Anomalous carry-over exclusion | Times for attempt ID *x* on segment *i+1* excluded if ID *x* self-closed on segment *i*. Prevents LiveSplit artefacts from inflating later-segment means. |
| 10 | Mid-run entry semantics | Entry time = cumulative time at the *end* of the completed split. Remaining distribution convolves all segments *after* the selected one. `remaining_pb = total_pb − entry_time`. |

---

*End of document.*
