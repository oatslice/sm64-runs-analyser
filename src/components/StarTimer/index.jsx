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

  // â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

  // â”€â”€ Log tab helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

  // â”€â”€ Export / Import â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

  // â”€â”€ Derived data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

        {/* â”€â”€ Log â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
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

        {/* â”€â”€ Collections â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
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

        {/* â”€â”€ Distribution â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
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

        {/* â”€â”€ Compare â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
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

        {/* â”€â”€ Segment Swap â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        {tab === 'swap' && (
          <SegmentSwap
            collections={timer.collections}
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
