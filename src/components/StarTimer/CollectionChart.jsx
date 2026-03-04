import { useEffect, useRef } from 'react'
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

// failureRate: 0-1 float or null, computed in index.jsx
// starRows: each row may have a resetRate field (0-1) also computed in index.jsx
export function CollectionChart({ collection, starRows, result, computing, onCompute, failureRate }) {
  const containerRef = useRef(null)
  const plotRef = useRef(null)

  useEffect(() => {
    if (window.Plotly) return
    const s = document.createElement('script')
    s.src = 'https://cdn.jsdelivr.net/npm/plotly.js-dist-min@2.35.2/plotly.min.js'
    document.head.appendChild(s)
  }, [])

  useEffect(() => {
    if (!result || !containerRef.current || !window.Plotly) return

    const { x, pdf, percentiles } = result
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
      text: 'median<br>' + fmtTime(percentiles.p50),
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
      toImageButtonOptions: { format: 'png', filename: 'collection_dist' },
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
              <span className="cc__warn"> -- {missing.length} with &lt;5 times (low confidence)</span>
            )}
          </p>
          {collection.offsetSeconds != null && (
            <p className="cc__offset-pill">
              offset +{collection.offsetSeconds}s
              {collection.lssSegmentName ? ' [' + collection.lssSegmentName + ']' : ''}
            </p>
          )}
        </div>
        <button className="cc__compute-btn" onClick={onCompute} disabled={computing || !canCompute}>
          {computing ? 'Computing...' : '> Compute distribution'}
        </button>
      </div>

      {result && (
        <>
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
            {failureRate != null && (
              <div className="cc__stat">
                <span className="cc__stat-label">reset rate</span>
                <span className="cc__stat-value" style={{ color: failureRate > 0.5 ? 'var(--red)' : failureRate > 0.2 ? 'var(--star)' : 'var(--text-1)' }}>
                  {(failureRate * 100).toFixed(1)}%
                </span>
              </div>
            )}
          </div>

          <div className="cc__chart" ref={containerRef} />

          <div className="cc__breakdown">
            <h4 className="cc__breakdown-title">Per-star breakdown</h4>
            <div className="cc__breakdown-table">
              <div className="cc__breakdown-hdr">
                <span>Star</span><span>Strategy</span><span>n</span><span>Best</span><span>Mean</span><span>Std</span><span>Var%</span><span>Reset%</span>
              </div>
              {result.segment_stats.map((stat, i) => {
                const row = starRows[i]
                if (!row) return null
                const resetPct = row.resetRate != null ? (row.resetRate * 100).toFixed(0) : null
                return (
                  <div key={i} className={'cc__breakdown-row' + (stat.n < 5 ? ' cc__breakdown-row--warn' : '')}>
                    <span className="cc__bd-name">{row.star}</span>
                    <span className="cc__bd-strat text-3">{row.strategy}</span>
                    <span className={'cc__bd-n' + (stat.n < 5 ? ' text-red' : ' text-3')}>{stat.n}</span>
                    <span className="cc__bd-val text-star">{fmtTime(stat.best)}</span>
                    <span className="cc__bd-val text-2">{fmtTime(stat.mean)}</span>
                    <span className="cc__bd-val text-3">{fmtTime(stat.std)}</span>
                    <span className="cc__bd-val text-3">{(stat.variance_share * 100).toFixed(1)}%</span>
                    <span className="cc__bd-val" style={{ color: resetPct > 50 ? 'var(--red)' : resetPct > 20 ? 'var(--star)' : 'var(--text-3)' }}>
                      {resetPct != null ? resetPct + '%' : '--'}
                    </span>
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
