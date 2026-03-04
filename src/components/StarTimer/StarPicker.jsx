import { useState, useMemo } from 'react'
import catalogue from '../../data/stars_catalogue.json'
import './StarPicker.css'

const STAGES = catalogue.stars_catalogue
const CUSTOM_STRATEGY = '__custom__'

export function StarPicker({ onSelect, label = 'Add star', compact = false }) {
  const [stageIdx,      setStageIdx]      = useState('')
  const [starIdx,       setStarIdx]       = useState('')
  const [stratIdx,      setStratIdx]      = useState('')
  const [customStrategy, setCustomStrategy] = useState('')

  const stage    = stageIdx !== '' ? STAGES[+stageIdx] : null
  const star     = stage && starIdx !== '' ? stage.stars[+starIdx] : null
  const isCustom = stratIdx === CUSTOM_STRATEGY
  const strategy = isCustom
    ? (customStrategy.trim() || null)
    : (star && stratIdx !== '' ? star.strategies[+stratIdx] : null)

  function handleSelect() {
    if (!stage || !star || !strategy) return
    onSelect({ stage: stage.stage, star: star.name, strategy })
    setStageIdx(''); setStarIdx(''); setStratIdx(''); setCustomStrategy('')
  }

  const ready = stage && star && strategy

  return (
    <div className={'star-picker' + (compact ? ' star-picker--compact' : '')}>
      <select className="star-picker__select"
        value={stageIdx} onChange={e => { setStageIdx(e.target.value); setStarIdx(''); setStratIdx(''); setCustomStrategy('') }}>
        <option value="">Stage...</option>
        {STAGES.map((s, i) => <option key={i} value={i}>{s.stage}</option>)}
      </select>

      <select className="star-picker__select"
        value={starIdx} onChange={e => { setStarIdx(e.target.value); setStratIdx(''); setCustomStrategy('') }}
        disabled={!stage}>
        <option value="">Star...</option>
        {stage?.stars.map((s, i) => <option key={i} value={i}>{s.name}</option>)}
      </select>

      <select className="star-picker__select"
        value={stratIdx} onChange={e => setStratIdx(e.target.value)}
        disabled={!star}>
        <option value="">Strategy...</option>
        {star?.strategies.map((s, i) => <option key={i} value={i}>{s}</option>)}
        <option value={CUSTOM_STRATEGY}>Custom...</option>
      </select>

      {isCustom && (
        <input
          className="star-picker__custom-input"
          placeholder="Strategy name..."
          value={customStrategy}
          onChange={e => setCustomStrategy(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && ready && handleSelect()}
          autoFocus
        />
      )}

      <button className="star-picker__btn" onClick={handleSelect} disabled={!ready}>
        {label}
      </button>
    </div>
  )
}
