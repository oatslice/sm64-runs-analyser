import { useEffect, useRef } from 'react'
import './DistributionChart.css'

function fmt(seconds) {
  if (seconds == null) return 'â€”'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = (seconds % 60).toFixed(2).padStart(5, '0')
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${s}`
  return m > 0 ? `${m}:${s}` : `${s}s`
}

export function DistributionChart({ result, showCDF, onToggleCDF, midRunResult }) {
  const containerRef = useRef(null)
  const plotRef = useRef(null)

  useEffect(() => {
    if (!result || !containerRef.current) return

    const { x, pdf, cdf, pb_time, pb_probability, percentiles } = result

    // Convert x from seconds to minutes for readability
    const xMin = x.map(v => v / 60)
    const pbMin = pb_time / 60

    // â”€â”€ Auto-zoom: find x-range covering 99% of PDF density +-5% padding â”€â”€
    // Walk CDF to find the 0.5th and 99.5th percentile x values
    const dx = x[1] - x[0]
    let cumSum = 0
    let xLow = xMin[0], xHigh = xMin[xMin.length - 1]
    const totalPdf = pdf.reduce((a, b) => a + b, 0) * dx
    let cum = 0
    for (let j = 0; j < pdf.length; j++) {
      cum += pdf[j] * dx
      if (cum / totalPdf >= 0.005 && xLow === xMin[0]) xLow = xMin[j]
      if (cum / totalPdf >= 0.995) { xHigh = xMin[j]; break }
    }
    const xSpan = xHigh - xLow
    const xRangeMin = Math.max(0, xLow - xSpan * 0.05)
    const xRangeMax = xHigh + xSpan * 0.05

    // â”€â”€ Mid-run overlay data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const mrx = midRunResult ? midRunResult.x.map(v => v / 60) : null
    const mrPdf = midRunResult ? midRunResult.pdf : null
    const mrPbRemaining = midRunResult ? midRunResult.remaining_pb : null
    const mrPbMin = mrPbRemaining != null ? mrPbRemaining / 60 : null
    const mrPbProb = midRunResult ? midRunResult.pb_probability : null

    // Zoom: if mid-run result shown, zoom to that; otherwise zoom full-run
    let xRangeMinFinal = xRangeMin
    let xRangeMaxFinal = xRangeMax
    if (mrx && mrPdf) {
      const mrdx = midRunResult.x[1] - midRunResult.x[0]
      const mrTotal = mrPdf.reduce((a, b) => a + b, 0) * mrdx
      let mrLow = mrx[0], mrHigh = mrx[mrx.length - 1]
      let mrCum = 0
      for (let j = 0; j < mrPdf.length; j++) {
        mrCum += mrPdf[j] * mrdx
        if (mrCum / mrTotal >= 0.005 && mrLow === mrx[0]) mrLow = mrx[j]
        if (mrCum / mrTotal >= 0.995) { mrHigh = mrx[j]; break }
      }
      const mrSpan = mrHigh - mrLow
      xRangeMinFinal = Math.max(0, mrLow - mrSpan * 0.05)
      xRangeMaxFinal = mrHigh + mrSpan * 0.05
    }

        // â”€â”€ Traces â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const pdfTrace = {
      x: xMin,
      y: pdf,
      type: 'scatter',
      mode: 'lines',
      name: 'PDF',
      line: { color: '#f5c842', width: 2, shape: 'spline' },
      fill: 'tozeroy',
      fillcolor: 'rgba(245,200,66,0.08)',
      hovertemplate: '%{x:.2f} min<br>density: %{y:.4f}<extra></extra>',
    }

    const cdfTrace = {
      x: xMin,
      y: cdf,
      type: 'scatter',
      mode: 'lines',
      name: 'CDF',
      line: { color: '#4a9eff', width: 2, shape: 'spline' },
      visible: showCDF ? true : 'legendonly',
      hovertemplate: '%{x:.2f} min<br>cumulative: %{y:.3f}<extra></extra>',
      yaxis: 'y2',
    }

    // PB probability shaded region
    const pbIdx = x.findIndex(v => v >= pb_time)
    const pbShadeTrace = {
      x: [...xMin.slice(0, pbIdx + 1), pbMin, pbMin],
      y: [...pdf.slice(0, pbIdx + 1), pdf[pbIdx] ?? 0, 0],
      type: 'scatter',
      mode: 'none',
      fill: 'tozeroy',
      fillcolor: 'rgba(61,214,140,0.12)',
      name: `PB zone (${(pb_probability * 100).toFixed(1)}%)`,
      hoverinfo: 'skip',
    }

    // â”€â”€ Mid-run overlay traces â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const mrTraces = []
    if (mrx && mrPdf && mrPbMin != null) {
      const mrPbIdx = midRunResult.x.findIndex(v => v >= mrPbRemaining)
      mrTraces.push({
        x: [...mrx.slice(0, mrPbIdx + 1), mrPbMin, mrPbMin],
        y: [...mrPdf.slice(0, mrPbIdx + 1), mrPdf[mrPbIdx] ?? 0, 0],
        type: 'scatter', mode: 'none', fill: 'tozeroy',
        fillcolor: 'rgba(168,85,247,0.15)',
        name: `PB zone from here (${(mrPbProb * 100).toFixed(1)}%)`,
        hoverinfo: 'skip',
      })
      mrTraces.push({
        x: mrx, y: mrPdf,
        type: 'scatter', mode: 'lines',
        name: 'Remaining PDF',
        line: { color: '#a855f7', width: 2, shape: 'spline' },
        hovertemplate: '%{x:.2f} min remaining<br>density: %{y:.4f}<extra></extra>',
      })
    }

        // â”€â”€ Percentile annotations â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const percentileLines = [
      { p: 'p50', label: 'p50', color: 'rgba(144,144,168,0.6)' },
      { p: 'p90', label: 'p90', color: 'rgba(232,64,64,0.5)' },
    ]

    const shapes = [
      // PB vertical line
      {
        type: 'line',
        x0: pbMin, x1: pbMin,
        y0: 0, y1: 1,
        xref: 'x', yref: 'paper',
        line: { color: '#3dd68c', width: 1.5, dash: 'dot' },
      },
      // Percentile lines
      ...percentileLines.map(({ p, color }) => ({
        type: 'line',
        x0: percentiles[p] / 60, x1: percentiles[p] / 60,
        y0: 0, y1: 1,
        xref: 'x', yref: 'paper',
        line: { color, width: 1, dash: 'dash' },
      })),
    ]

    const annotations = [
      {
        x: pbMin,
        y: 1,
        xref: 'x', yref: 'paper',
        text: `PB ${fmt(pb_time)}<br><b>${(pb_probability * 100).toFixed(1)}% chance</b>`,
        showarrow: true,
        arrowhead: 0,
        arrowcolor: '#3dd68c',
        ax: 30, ay: -36,
        font: { color: '#3dd68c', size: 11, family: 'Space Mono' },
        bgcolor: 'rgba(10,10,15,0.85)',
        bordercolor: '#3dd68c',
        borderwidth: 1,
        borderpad: 4,
      },
      ...percentileLines.map(({ p, label, color }) => ({
        x: percentiles[p] / 60,
        y: 0.85,
        xref: 'x', yref: 'paper',
        text: `${label}<br>${fmt(percentiles[p])}`,
        showarrow: false,
        font: { color, size: 10, family: 'Space Mono' },
        bgcolor: 'rgba(10,10,15,0.7)',
        borderpad: 3,
      })),
    ]

    // â”€â”€ Layout â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const layout = {
      paper_bgcolor: 'transparent',
      plot_bgcolor: 'transparent',
      margin: { t: 20, r: 40, b: 50, l: 50 },
      font: { family: 'Space Mono, monospace', color: '#9090a8', size: 11 },
      showlegend: true,
      legend: {
        bgcolor: 'rgba(17,17,24,0.9)',
        bordercolor: '#2a2a38',
        borderwidth: 1,
        font: { size: 10 },
        x: 1, xanchor: 'right', y: 1,
      },
      xaxis: {
        title: { text: 'Run time (minutes)', standoff: 10 },
        gridcolor: '#1e1e28',
        zerolinecolor: '#2a2a38',
        tickformat: '.1f',
        color: '#55556a',
        range: [xRangeMinFinal, xRangeMaxFinal],
      },
      yaxis: {
        title: { text: 'Probability density' },
        gridcolor: '#1e1e28',
        zerolinecolor: '#2a2a38',
        color: '#55556a',
        rangemode: 'tozero',
      },
      yaxis2: {
        title: { text: 'Cumulative probability' },
        overlaying: 'y',
        side: 'right',
        range: [0, 1],
        gridcolor: 'transparent',
        color: '#4a9eff',
        showgrid: false,
      },
      shapes: [
        ...shapes,
        ...(mrPbMin != null ? [{
          type: 'line', x0: mrPbMin, x1: mrPbMin, y0: 0, y1: 1,
          xref: 'x', yref: 'paper',
          line: { color: '#a855f7', width: 1.5, dash: 'dot' },
        }] : []),
      ],
      annotations: [
        ...annotations,
        ...(mrPbMin != null ? [{
          x: mrPbMin, y: 0.6, xref: 'x', yref: 'paper',
          text: `need ${fmt(mrPbRemaining)}<br><b>${(mrPbProb * 100).toFixed(1)}% chance</b>`,
          showarrow: true, arrowhead: 0, arrowcolor: '#a855f7',
          ax: -40, ay: -30,
          font: { color: '#a855f7', size: 11, family: 'Space Mono' },
          bgcolor: 'rgba(10,10,15,0.85)', bordercolor: '#a855f7',
          borderwidth: 1, borderpad: 4,
        }] : []),
      ],
    }

    const config = {
      displayModeBar: true,
      displaylogo: false,
      modeBarButtonsToRemove: ['select2d', 'lasso2d', 'autoScale2d'],
      toImageButtonOptions: { format: 'png', filename: 'sm64_run_distribution' },
    }

    if (!plotRef.current) {
      window.Plotly.newPlot(
        containerRef.current,
[pbShadeTrace, pdfTrace, cdfTrace, ...mrTraces],
        layout,
        config
      )
      plotRef.current = true
    } else {
      window.Plotly.react(
        containerRef.current,
[pbShadeTrace, pdfTrace, cdfTrace, ...mrTraces],
        layout,
        config
      )
    }
  }, [result, showCDF, midRunResult])

  // Load Plotly from CDN if not already present
  useEffect(() => {
    if (window.Plotly) return
    const script = document.createElement('script')
    script.src = 'https://cdn.jsdelivr.net/npm/plotly.js-dist-min@2.35.2/plotly.min.js'
    script.onload = () => {
      // Re-trigger chart render once Plotly is available
      containerRef.current?.dispatchEvent(new Event('plotly-ready'))
    }
    document.head.appendChild(script)
  }, [])

  if (!result) return null

  const { percentiles, pb_time, pb_probability } = result

  return (
    <div className="dist-chart-wrap">
      <div className="dist-chart-header">
        <h3 className="dist-chart-title">Run Time Distribution</h3>
        <button
          className={`dist-cdf-toggle ${showCDF ? 'is-active' : ''}`}
          onClick={onToggleCDF}
        >
          {showCDF ? 'Hide CDF' : 'Show CDF'}
        </button>
      </div>

      {/* Headline stats */}
      <div className="dist-stats-row">
        {[
          { label: 'PB chance', value: `${(pb_probability * 100).toFixed(1)}%`, color: 'var(--green)', bold: true },
          ...(midRunResult ? [{ label: 'PB chance from here', value: `${(midRunResult.pb_probability * 100).toFixed(1)}%`, color: 'var(--purple)', bold: true }] : []),
          { label: 'p10 (great run)', value: fmt(percentiles.p10) },
          { label: 'p25',             value: fmt(percentiles.p25) },
          { label: 'p50 (median)',    value: fmt(percentiles.p50) },
          { label: 'p75',             value: fmt(percentiles.p75) },
          { label: 'p90 (bad run)',   value: fmt(percentiles.p90), color: 'var(--red)' },
        ].map(({ label, value, color, bold }) => (
          <div key={label} className="dist-stat">
            <span className="dist-stat__label">{label}</span>
            <span className="dist-stat__value" style={{ color: color || 'var(--star)', fontWeight: bold ? 700 : 400 }}>
              {value}
            </span>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="dist-chart-container" ref={containerRef} />
    </div>
  )
}
