import './SegmentTable.css'

function fmt(seconds, fallback = '--') {
  if (seconds == null || isNaN(seconds)) return fallback
  const m = Math.floor(seconds / 60)
  const s = (seconds % 60).toFixed(2).padStart(5, '0')
  return m > 0 ? `${m}:${s}` : `${s}s`
}

function MiniBar({ value, max, color = 'var(--star)' }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div className="mini-bar">
      <div className="mini-bar__fill" style={{ width: `${pct}%`, background: color }} />
    </div>
  )
}

export function SegmentTable({ segments, excluded, onToggleExclude, segmentStats }) {
  const maxStd = Math.max(...(segmentStats || []).map(s => s?.std ?? 0), 0.001)

  return (
    <div className="seg-table-wrap">
      <div className="seg-table-header">
        <h3 className="seg-table-title">Segments</h3>
        <span className="seg-table-count text-3">
          {segments.length - excluded.size} / {segments.length} included
        </span>
      </div>

      <div className="seg-table-scroll"><div className="seg-table">
        <div className="seg-table__head">
          <div className="seg-col seg-col--include" />
          <div className="seg-col seg-col--name">Segment</div>
          <div className="seg-col seg-col--num">Attempts</div>
          <div className="seg-col seg-col--num">Golds</div>
          <div className="seg-col seg-col--num">PB</div>
          <div className="seg-col seg-col--num">Mean</div>
          <div className="seg-col seg-col--bar">Std dev</div>
        </div>

        {segments.map((seg, i) => {
          const isExcluded = excluded.has(i)
          const stats = segmentStats?.[i]
          const meanTime = stats?.mean ?? null
          const stdTime = stats?.std ?? null

          return (
            <div
              key={i}
              className={`seg-row ${isExcluded ? 'seg-row--excluded' : ''} ${seg.lowConfidence ? 'seg-row--low-conf' : ''}`}
            >
              <div className="seg-col seg-col--include">
                <button
                  className={`seg-toggle ${isExcluded ? 'seg-toggle--off' : 'seg-toggle--on'}`}
                  onClick={() => onToggleExclude(i)}
                  title={isExcluded ? 'Click to include' : 'Click to exclude'}
                >
                  {isExcluded ? 'o' : '*'}
                </button>
              </div>

              <div className="seg-col seg-col--name">
                <span className="seg-name">{seg.name}</span>
                {seg.lowConfidence && (
                  <span className="seg-warn" title="Fewer than 10 attempts">!</span>
                )}
              </div>

              <div className="seg-col seg-col--num">
                <span className={seg.times.length < 10 ? 'text-red' : 'text-2'}>
                  {seg.times.length}
                </span>
              </div>

              <div className="seg-col seg-col--num">
                <span className="text-green">{fmt(seg.bestSegment)}</span>
              </div>

              <div className="seg-col seg-col--num">
                <span className="text-star">{fmt(seg.pbTime)}</span>
              </div>

              <div className="seg-col seg-col--num">
                <span className="text-2">{fmt(meanTime)}</span>
              </div>

              <div className="seg-col seg-col--bar">
                {stdTime != null && stdTime > 0 ? (
                  <div className="seg-bar-wrap">
                    <MiniBar value={stdTime} max={maxStd} color="var(--blue)" />
                    <span className="seg-bar-label text-3">+/-{fmt(stdTime)}</span>
                  </div>
                ) : (
                  <span className="text-3">--</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div></div>
  )
}
