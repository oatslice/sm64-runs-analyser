/**
 * PyodideSmokeTest.jsx
 *
 * Phase 0 validation component.
 * Runs a known computation through Pyodide and verifies the output is sensible.
 * This will be removed once Feature 1 is built.
 */

import { useState } from 'react'
import { usePyodide } from '../pyodide/usePyodide'
import { parseLSS } from '../utils/lssParser'
import './PyodideSmokeTest.css'

// â”€â”€ Synthetic test data (mimics what parseLSS would produce) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Two segments: "BoB" ~180s, "WF" ~260s. PBs: 170s, 250s.
const MOCK_SEGMENT_TIMES = [
  // BoB: 20 samples around 180s
  Array.from({ length: 20 }, (_, i) => 170 + Math.sin(i) * 8 + i * 0.3),
  // WF: 15 samples around 260s
  Array.from({ length: 15 }, (_, i) => 250 + Math.cos(i * 1.3) * 12 + i * 0.4),
]
const MOCK_PB_TIMES  = [170, 250]
const MOCK_RESETS    = [3, 5]

// Simple deterministic fake without Math.random so the test is reproducible
const MOCK_LSS = `<?xml version="1.0" encoding="UTF-8"?>
<Run version="1.7.0">
  <GameName>Super Mario 64</GameName>
  <CategoryName>120 Star</CategoryName>
  <AttemptCount>25</AttemptCount>
  <Segments>
    <Segment>
      <n>BoB (8)</n>
      <SplitTimes>
        <SplitTime name="Personal Best">
          <RealTime>00:02:50.0000000</RealTime>
        </SplitTime>
      </SplitTimes>
      <BestSegmentTime><RealTime>00:02:44.0000000</RealTime></BestSegmentTime>
      <SegmentHistory>
        <Time id="-1"><RealTime>00:03:10.0000000</RealTime></Time>
        <Time id="1"><RealTime>00:02:58.0000000</RealTime></Time>
        <Time id="2"><RealTime>00:02:52.0000000</RealTime></Time>
        <Time id="3" />
        <Time id="4"><RealTime>00:02:55.0000000</RealTime></Time>
        <Time id="5"><RealTime>00:02:50.0000000</RealTime></Time>
      </SegmentHistory>
    </Segment>
    <Segment>
      <n>WF (15)</n>
      <SplitTimes>
        <SplitTime name="Personal Best">
          <RealTime>00:07:00.0000000</RealTime>
        </SplitTime>
      </SplitTimes>
      <BestSegmentTime><RealTime>00:04:05.0000000</RealTime></BestSegmentTime>
      <SegmentHistory>
        <Time id="1"><RealTime>00:04:20.0000000</RealTime></Time>
        <Time id="2"><RealTime>00:04:15.0000000</RealTime></Time>
        <Time id="3"><RealTime>00:04:30.0000000</RealTime></Time>
        <Time id="4" />
        <Time id="5"><RealTime>00:04:10.0000000</RealTime></Time>
      </SegmentHistory>
    </Segment>
  </Segments>
</Run>`

function fmt(seconds) {
  if (seconds == null) return '--'
  const m = Math.floor(seconds / 60)
  const s = (seconds % 60).toFixed(2).padStart(5, '0')
  return m > 0 ? `${m}:${s}` : `${s}s`
}

function CheckRow({ label, value, pass, detail }) {
  return (
    <div className={`smoke-row ${pass ? 'smoke-row--pass' : 'smoke-row--fail'}`}>
      <span className="smoke-row__icon">{pass ? 'OK' : '!!'}</span>
      <span className="smoke-row__label">{label}</span>
      <span className="smoke-row__value mono">{value}</span>
      {detail && <span className="smoke-row__detail">{detail}</span>}
    </div>
  )
}

export function PyodideSmokeTest() {
  const { ready, runPython } = usePyodide()
  const [result, setResult] = useState(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState(null)
  const [lssResult, setLssResult] = useState(null)

  async function runTest() {
    setRunning(true)
    setError(null)
    setResult(null)
    setLssResult(null)

    try {
      // 1. Test LSS parser (pure JS)
      const parsed = parseLSS(MOCK_LSS)
      setLssResult(parsed)

      // 2. Test Pyodide distribution computation
      const pyResult = await runPython(`
import json
result = compute_distribution(
    segment_times_js.to_py(),
    pb_times_js.to_py(),
    resolution=0.5
)
json.dumps(result)
`, {
        segment_times_js: MOCK_SEGMENT_TIMES,
        pb_times_js:      MOCK_PB_TIMES,
      })

      // runPython returns JSON string here; parse it
      const parsed_result = JSON.parse(pyResult)
      setResult(parsed_result)
    } catch (e) {
      setError(e.message)
    } finally {
      setRunning(false)
    }
  }

  const checks = result ? [
    {
      label: 'PDF array length',
      value: `${result.x.length} points`,
      pass:  result.x.length > 100,
      detail: 'Should have many points for a smooth curve',
    },
    {
      label: 'PDF sums to â‰ˆ1',
      value: result.pdf.reduce((a, b) => a + b, 0).toFixed(4),
      pass:  Math.abs(result.pdf.reduce((a, b) => a + b, 0) - 1) < 0.5,
      detail: 'Area under PDF should integrate to 1',
    },
    {
      label: 'PB time',
      value: fmt(result.pb_time),
      pass:  result.pb_time > 0,
      detail: `Sum of per-segment PBs = ${MOCK_PB_TIMES.join(' + ')}s`,
    },
    {
      label: 'PB probability',
      value: `${(result.pb_probability * 100).toFixed(1)}%`,
      pass:  result.pb_probability >= 0 && result.pb_probability <= 1,
      detail: 'P(total run < PB time)',
    },
    {
      label: 'Median (p50)',
      value: fmt(result.percentiles.p50),
      pass:  result.percentiles.p50 > result.pb_time * 0.9,
      detail: 'Should be near or above PB time',
    },
    {
      label: 'p10 < p50 < p90',
      value: `${fmt(result.percentiles.p10)} < ${fmt(result.percentiles.p50)} < ${fmt(result.percentiles.p90)}`,
      pass:  result.percentiles.p10 < result.percentiles.p50 &&
             result.percentiles.p50 < result.percentiles.p90,
      detail: 'Percentiles must be ordered',
    },
  ] : []

  const lssChecks = lssResult ? [
    {
      label: 'Game name',
      value: lssResult.gameName,
      pass:  lssResult.gameName === 'Super Mario 64',
    },
    {
      label: 'Segment count',
      value: `${lssResult.segments.length}`,
      pass:  lssResult.segments.length === 2,
    },
    {
      label: 'Negative IDs excluded',
      value: `${lssResult.segments[0].times.length} times in seg 0`,
      pass:  lssResult.segments[0].times.length === 5, // 6 entries minus 1 negative
      detail: 'id=-1 entry should be excluded',
    },
    {
      label: 'Reset counted',
      value: `${lssResult.segments[0].resets} resets in seg 0`,
      pass:  lssResult.segments[0].resets === 1, // id=3 has no RealTime
      detail: 'id=3 with no <RealTime> = reset',
    },
    {
      label: 'Per-segment PB (seg 0)',
      value: fmt(lssResult.segments[0].pbTime),
      pass:  Math.abs(lssResult.segments[0].pbTime - 170) < 1,
      detail: 'Cumulative 2:50 -> per-segment = 2:50',
    },
    {
      label: 'Per-segment PB (seg 1)',
      value: fmt(lssResult.segments[1].pbTime),
      pass:  Math.abs(lssResult.segments[1].pbTime - 250) < 1,
      detail: 'Cumulative 7:00 -> per-segment = 4:10',
    },
  ] : []

  const allPass = checks.length > 0 && checks.every(c => c.pass) &&
                  lssChecks.length > 0 && lssChecks.every(c => c.pass)

  return (
    <div className="smoke">
      <div className="smoke__header">
        <h2 className="smoke__title">Phase 0 - Smoke Test</h2>
        <p className="smoke__desc text-2">
          Validates the Pyodide runtime, NumPy/SciPy installation, the convolution
          module, and the LSS parser. Run this once after setup to confirm everything works.
        </p>
      </div>

      <button
        className="smoke__run-btn"
        onClick={runTest}
        disabled={!ready || running}
      >
        {running ? 'Running...' : ready ? '> Run Smoke Test' : 'Waiting for Pyodide...'}
      </button>

      {error && (
        <div className="smoke__error">
          <strong>Error:</strong> {error}
        </div>
      )}

      {lssChecks.length > 0 && (
        <section className="smoke__section">
          <h3 className="smoke__section-title">LSS Parser</h3>
          {lssChecks.map((c, i) => <CheckRow key={i} {...c} />)}
        </section>
      )}

      {checks.length > 0 && (
        <section className="smoke__section">
          <h3 className="smoke__section-title">Pyodide + Convolution</h3>
          {checks.map((c, i) => <CheckRow key={i} {...c} />)}
        </section>
      )}

      {allPass && (
        <div className="smoke__success">
          <span className="smoke__success-star">â˜…</span>
          All checks passed - Phase 0 complete. Ready for Phase 1.
        </div>
      )}
    </div>
  )
}
