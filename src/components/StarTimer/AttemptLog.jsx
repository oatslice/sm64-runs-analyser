import { useState } from 'react'
import './AttemptLog.css'

function parseTime(str) {
  str = str.trim()
  if (!str) return null
  const m = str.match(/^(\d+):([0-5]\d)(\.\d+)?$/)
  if (m) return parseInt(m[1], 10) * 60 + parseFloat(m[2] + (m[3] || ''))
  const n = parseFloat(str)
  return isNaN(n) ? null : n
}

export function fmtTime(s) {
  if (s == null) return '--'
  const m = Math.floor(s / 60)
  const sec = (s % 60).toFixed(2).padStart(5, '0')
  return m > 0 ? `${m}:${sec}` : `${sec}s`
}

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function AttemptLog({
  stage, star, strategy,
  attempts,
  onAdd, onDelete, onEdit,
  // selection support
  checked, onCheckedChange,
  // close button
  onClose,
}) {
  const [timeStr,  setTimeStr]  = useState('')
  const [success,  setSuccess]  = useState(true)
  const [inputErr, setInputErr] = useState(null)
  const [editId,   setEditId]   = useState(null)
  const [editStr,  setEditStr]  = useState('')
  const [histOpen, setHistOpen] = useState(true)

  const successTimes = attempts.filter(a => a.success && a.timeSeconds != null).map(a => a.timeSeconds)
  const mean = successTimes.length ? successTimes.reduce((a, b) => a + b, 0) / successTimes.length : null
  const best = successTimes.length ? Math.min(...successTimes) : null
  const successRate = attempts.length
    ? ((attempts.filter(a => a.success).length / attempts.length) * 100).toFixed(0)
    : null

  function handleAdd() {
    setInputErr(null)
    if (success) {
      const t = parseTime(timeStr)
      if (!t || t <= 0) { setInputErr('Enter a valid time (e.g. 1:23.45 or 83.45)'); return }
      onAdd(stage, star, strategy, t, true)
    } else {
      onAdd(stage, star, strategy, null, false)
    }
    setTimeStr('')
  }

  function startEdit(a) { setEditId(a.id); setEditStr(a.timeSeconds != null ? fmtTime(a.timeSeconds) : '') }

  function saveEdit(a) {
    if (a.success) {
      const t = parseTime(editStr)
      if (!t || t <= 0) return
      onEdit(stage, star, strategy, a.id, { timeSeconds: t })
    }
    setEditId(null)
  }

  return (
    <div className={'alog' + (checked ? ' alog--checked' : '')}>
      {/* Header row */}
      <div className="alog__header">
        {onCheckedChange != null && (
          <input
            type="checkbox"
            className="alog__checkbox"
            checked={!!checked}
            onChange={e => onCheckedChange(e.target.checked)}
            title="Select for collection"
          />
        )}
        <div className="alog__title">
          <span className="alog__star">{star}</span>
          <span className="alog__strategy text-3">{strategy}</span>
        </div>
        {attempts.length > 0 && (
          <div className="alog__stats">
            <span className="alog__stat"><span className="text-3">att</span> <b>{attempts.length}</b></span>
            <span className="alog__stat"><span className="text-3">ok</span> <b className="text-green">{successRate}%</b></span>
            {best != null && <span className="alog__stat"><span className="text-3">best</span> <b className="text-star">{fmtTime(best)}</b></span>}
            {mean != null && <span className="alog__stat"><span className="text-3">avg</span>  <b className="text-2">{fmtTime(mean)}</b></span>}
          </div>
        )}
        <div className="alog__hdr-actions">
          {attempts.length > 0 && (
            <button
              className="alog__collapse-btn"
              onClick={() => setHistOpen(v => !v)}
              title={histOpen ? 'Collapse history' : 'Expand history'}
            >
              {histOpen ? '[^]' : '[v]'} {attempts.length}
            </button>
          )}
          {onClose && (
            <button className="alog__close-btn" onClick={onClose} title="Close">[x]</button>
          )}
        </div>
      </div>

      {/* Entry row */}
      <div className="alog__entry">
        <button
          className={'alog__toggle' + (success ? ' alog__toggle--success' : ' alog__toggle--fail')}
          onClick={() => setSuccess(v => !v)}
        >
          {success ? 'Success' : 'Fail'}
        </button>
        {success && (
          <input
            className={'alog__input' + (inputErr ? ' alog__input--err' : '')}
            type="text" placeholder="e.g. 1:23.45"
            value={timeStr}
            onChange={e => setTimeStr(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
          />
        )}
        <button className="alog__add-btn" onClick={handleAdd}>+ Log</button>
        {inputErr && <span className="alog__err">{inputErr}</span>}
      </div>

      {/* History â€” collapsible */}
      {histOpen && attempts.length > 0 && (
        <div className="alog__history">
          {[...attempts].reverse().map(a => (
            <div key={a.id} className={'alog__row' + (a.success ? '' : ' alog__row--fail')}>
              <span className="alog__row-date text-3">{fmtDate(a.timestamp)}</span>

              {editId === a.id ? (
                <input
                  className="alog__input alog__input--inline"
                  value={editStr}
                  onChange={e => setEditStr(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveEdit(a); if (e.key === 'Escape') setEditId(null) }}
                  autoFocus
                />
              ) : (
                <span className={'alog__row-time' + (a.success ? ' text-star' : ' text-3')}>
                  {a.success ? fmtTime(a.timeSeconds) : 'fail'}
                </span>
              )}

              <div className="alog__row-actions">
                {editId === a.id ? (
                  <>
                    <button className="alog__action alog__action--save" onClick={() => saveEdit(a)}>save</button>
                    <button className="alog__action" onClick={() => setEditId(null)}>cancel</button>
                  </>
                ) : (
                  <>
                    {a.success && <button className="alog__action" onClick={() => startEdit(a)}>edit</button>}
                    <button className="alog__action alog__action--del" onClick={() => onDelete(stage, star, strategy, a.id)}>del</button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
