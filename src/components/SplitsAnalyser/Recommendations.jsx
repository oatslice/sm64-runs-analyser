import './Recommendations.css'

function fmt(seconds) {
  if (seconds == null || isNaN(seconds)) return '--'
  const m = Math.floor(Math.abs(seconds) / 60)
  const s = (Math.abs(seconds) % 60).toFixed(2).padStart(5, '0')
  const base = m > 0 ? `${m}:${s}` : `${s}s`
  return seconds < 0 ? `-${base}` : base
}

export function Recommendations({ rankings, segments, resetStats, loading }) {
  if (loading) {
    return (
      <div className="rec-wrap">
        <h3 className="rec-title">Segment Focus Ranking</h3>
        <p className="text-3 rec-loading">Ranking segments...</p>
      </div>
    )
  }
  if (!rankings || rankings.length === 0) return null

  const resetRate = resetStats?.completion_probability != null
    ? (1 - resetStats.completion_probability) * 100
    : null

  return (
    <div className="rec-wrap">
      <div className="rec-header">
        <h3 className="rec-title">Segment Focus Ranking</h3>
        {resetRate != null && (
          <span className="rec-reset-badge" title="Probability of resetting before finishing">
            {resetRate.toFixed(1)}% reset rate
          </span>
        )}
      </div>

      <p className="rec-desc text-3">
        Segments ranked by how much they would improve your PB probability if perfected.
        "PB gain" shows the probability increase; "time saved" is the mean time saved per run.
      </p>

      <div className="rec-list">
        {rankings.slice(0, 8).map((r, i) => {
          const seg = segments[r.index]
          if (!seg) return null

          // Mean time saved = mean - pbTime (how much the avg drops if this seg is perfected)
          const timeSaved = (r.mean != null && seg.pbTime != null)
            ? r.mean - seg.pbTime
            : null

          const barWidth = Math.min((r.variance_share * 100) * 2, 100)
          const isTop = i === 0

          return (
            <div key={r.index} className={`rec-row ${isTop ? 'rec-row--top' : ''}`}>
              <div className="rec-row__rank">{i + 1}</div>
              <div className="rec-row__main">
                <div className="rec-row__name">{seg.name}</div>
                <div className="rec-row__bar-wrap">
                  <div className="rec-row__bar" style={{ width: `${barWidth}%` }} />
                </div>
              </div>
              <div className="rec-row__stats">
                <div className="rec-stat">
                  <span className="rec-stat__label">PB gain</span>
                  <span className="rec-stat__value text-green">
                    +{(r.delta_pb * 100).toFixed(2)}%
                  </span>
                </div>
                <div className="rec-stat">
                  <span className="rec-stat__label">time saved</span>
                  <span className="rec-stat__value text-star">
                    {timeSaved != null ? fmt(timeSaved) : '--'}
                  </span>
                </div>
                <div className="rec-stat">
                  <span className="rec-stat__label">std dev</span>
                  <span className="rec-stat__value text-2">
                    {r.std != null ? fmt(r.std) : '--'}
                  </span>
                </div>
                <div className="rec-stat">
                  <span className="rec-stat__label">attempts</span>
                  <span className={`rec-stat__value ${r.n < 10 ? 'text-red' : 'text-2'}`}>
                    {r.n}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
