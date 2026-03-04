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

  // â”€â”€ PB probability & expected time â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
      {/* â”€â”€ Header â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
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

      {/* â”€â”€ Filter panel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {showFilters && (
        <div className="sa-filters">
          <div className="sa-filters__title">Run Filters
            <span className="sa-filters__hint text-3">
              Filters are applied before computing â€” hit Recompute after changing.
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

      {/* â”€â”€ Body â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
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

          {/* â”€â”€ True PB probability box â€” below segment table â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
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
                        No attempt history in .lss â€” expected time unavailable
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
