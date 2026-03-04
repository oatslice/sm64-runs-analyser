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
            : <span className="text-3 sswap__warn">No segment set â€” select below or set in Collections tab.</span>}
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
            Offset (s){selectedCol?.offsetSeconds != null ? ` (override â€” has ${selectedCol.offsetSeconds}s)` : ' (optional)'}
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
          <p className="sswap__err">Two swaps target the same segment â€” each segment can only be swapped once.</p>
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
