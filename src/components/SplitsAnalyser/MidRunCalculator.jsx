import { useState, useCallback } from 'react'
import './MidRunCalculator.css'

function parseTimeInput(str) {
  // Accept M:SS, M:SS.xx, or raw seconds
  str = str.trim()
  if (!str) return null
  const colonMatch = str.match(/^(\d+):([0-5]\d)(\.\d+)?$/)
  if (colonMatch) {
    const m = parseInt(colonMatch[1], 10)
    const s = parseFloat(colonMatch[2] + (colonMatch[3] || ''))
    return m * 60 + s
  }
  const num = parseFloat(str)
  return isNaN(num) ? null : num
}

function fmtTime(seconds) {
  if (seconds == null) return '--'
  const m = Math.floor(seconds / 60)
  const s = (seconds % 60).toFixed(2).padStart(5, '0')
  return m > 0 ? m + ':' + s : s + 's'
}

export function MidRunCalculator({ segments, excluded, totalPB, onCompute, onClear, result, computing }) {
  const [segIdx, setSegIdx]     = useState('')
  const [timeStr, setTimeStr]   = useState('')
  const [inputErr, setInputErr] = useState(null)

  // Exclude the last segment â€” completing it means the run is over
  const allIncluded = segments
    .map((s, i) => ({ ...s, origIdx: i }))
    .filter(s => !excluded.has(s.origIdx))
  const includedSegs = allIncluded.slice(0, -1)

  // Cumulative PB times for placeholder hint (time AT END of each segment)
  let cumPB = 0
  const cumPBs = includedSegs.map(s => {
    cumPB += s.pbTime ?? 0
    return cumPB  // cumulative time AT END of this segment
  })

  function handleCompute() {
    setInputErr(null)
    const idx = parseInt(segIdx, 10)
    if (isNaN(idx) || idx < 0 || idx >= includedSegs.length) {
      setInputErr('Select a segment first.')
      return
    }
    const secs = parseTimeInput(timeStr)
    if (secs === null || secs < 0) {
      setInputErr('Enter a valid time (e.g. 3:00 or 180).')
      return
    }
    const remaining_pb = totalPB - secs
    if (remaining_pb <= 0) {
      setInputErr('Entry time exceeds or equals the total PB â€” no PB possible from here.')
      return
    }
    onCompute({ includedSegIdx: idx, entrySeconds: secs, remainingPB: remaining_pb })
  }

  function handleClear() {
    setSegIdx(''); setTimeStr(''); setInputErr(null)
    onClear()
  }

  const selectedSeg = includedSegs[parseInt(segIdx, 10)]
  const pbHint = selectedSeg
    ? 'PB pace: ' + fmtTime(cumPBs[parseInt(segIdx, 10)])
    : null

  return (
    <div className="mrc-wrap">
      <div className="mrc-header">
        <h3 className="mrc-title">Mid-Run Calculator</h3>
        <p className="mrc-desc text-3">
          Enter where you are in a run to see your PB chance from that point.
        </p>
      </div>

      <div className="mrc-controls">
        <div className="mrc-field">
          <label className="mrc-label">Split completed</label>
          <select
            className="mrc-select"
            value={segIdx}
            onChange={e => setSegIdx(e.target.value)}
          >
            <option value="">-- select --</option>
            {includedSegs.map((seg, i) => (
              <option key={seg.origIdx} value={i}>{seg.name}</option>
            ))}
          </select>
        </div>

        <div className="mrc-field">
          <label className="mrc-label">
            Cumulative time at split
            {pbHint && <span className="mrc-hint"> ({pbHint})</span>}
          </label>
          <input
            className={'mrc-input' + (inputErr ? ' mrc-input--error' : '')}
            type="text"
            placeholder="e.g. 3:00"
            value={timeStr}
            onChange={e => setTimeStr(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCompute()}
          />
        </div>

        <div className="mrc-actions">
          <button className="mrc-btn mrc-btn--compute" onClick={handleCompute}
            disabled={computing || !segIdx}>
            {computing ? 'Computing...' : '> Calculate'}
          </button>
          {result && (
            <button className="mrc-btn mrc-btn--clear" onClick={handleClear}>
              Clear
            </button>
          )}
        </div>
      </div>

      {inputErr && <p className="mrc-error">{inputErr}</p>}

      {result && !computing && (
        <div className="mrc-result">
          <div className="mrc-result__stat mrc-result__stat--main">
            <span className="mrc-result__value"
              style={{ color: result.pb_probability > 0.5 ? 'var(--green)' : result.pb_probability > 0.1 ? 'var(--star)' : 'var(--red)' }}>
              {(result.pb_probability * 100).toFixed(1)}%
            </span>
            <span className="mrc-result__label">PB chance from here</span>
          </div>
          <div className="mrc-result__stats">
            <div className="mrc-result__stat">
              <span className="mrc-result__sublabel">Entry time</span>
              <span className="mrc-result__subval text-2">{fmtTime(result.entry_seconds)}</span>
            </div>
            <div className="mrc-result__stat">
              <span className="mrc-result__sublabel">Remaining PB needed</span>
              <span className="mrc-result__subval text-star">{fmtTime(result.remaining_pb)}</span>
            </div>
            <div className="mrc-result__stat">
              <span className="mrc-result__sublabel">Median finish</span>
              <span className="mrc-result__subval text-2">{fmtTime(result.entry_seconds + result.percentiles.p50)}</span>
            </div>
            <div className="mrc-result__stat">
              <span className="mrc-result__sublabel">From segment</span>
              <span className="mrc-result__subval text-2">{result.from_segment}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
