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

// failureRates: [number|null, number|null] â€” precomputed in index.jsx
export function CompareView({ collections, results, computing, onCompute, failureRates }) {
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
  const fr0 = failureRates?.[0] ?? null
  const fr1 = failureRates?.[1] ?? null

  function failureColor(fr) {
    if (fr == null) return 'var(--text-2)'
    return fr > 0.5 ? 'var(--red)' : fr > 0.2 ? 'var(--star)' : 'var(--text-2)'
  }

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
        <p className="text-3 cmp__hint">Select two collections above to compare them here.</p>
      )}

      {bothSelected && (
        <>
          <button className="cmp__compute-btn" onClick={onCompute} disabled={computing}>
            {computing ? 'Computing...' : '> Compare distributions'}
          </button>

          {r0 && r1 && (
            <>
              <div className="cmp__chart" ref={containerRef} />

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
                {/* Failure rate row */}
                {(fr0 != null || fr1 != null) && (
                  <div className="cmp__table-row">
                    <span className="text-3">reset%</span>
                    <span style={{ color: failureColor(fr0) }}>
                      {fr0 != null ? (fr0 * 100).toFixed(1) + '%' : '--'}
                    </span>
                    <span style={{ color: failureColor(fr1) }}>
                      {fr1 != null ? (fr1 * 100).toFixed(1) + '%' : '--'}
                    </span>
                    <span style={{ color: fr0 != null && fr1 != null
                      ? (fr0 - fr1 < -0.005 ? 'var(--green)' : fr0 - fr1 > 0.005 ? 'var(--red)' : 'var(--text-3)')
                      : 'var(--text-3)' }}>
                      {fr0 != null && fr1 != null
                        ? (() => {
                            const d = fr0 - fr1
                            if (Math.abs(d) < 0.001) return '--'
                            return (d > 0 ? '+' : '') + (d * 100).toFixed(1) + '%'
                          })()
                        : '--'}
                    </span>
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
