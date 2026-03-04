import { useState, useMemo } from 'react'
import { StarPicker } from './StarPicker'
import { PRESET_CATEGORIES } from '../../data/presets'
import offsetDb from '../../data/offsetDatabase.json'
import './CollectionBuilder.css'

// â”€â”€ Offset database browser â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const DB_CATEGORIES = Object.keys(offsetDb).filter(k => !k.startsWith('_'))

function fmtOffset(s) {
  if (s == null) return 'TBD'
  const m = Math.floor(s / 60)
  const sec = (s % 60).toFixed(2).padStart(5, '0')
  return m > 0 ? `${m}:${sec}` : `${s}s`
}

function OffsetBrowser({ onUse }) {
  const [cat,   setCat]   = useState(DB_CATEGORIES[0] ?? '')
  const [stage, setStage] = useState('')

  const stages = cat ? Object.keys(offsetDb[cat] ?? {}).filter(k => !k.startsWith('_')) : []
  const entries = (cat && stage) ? (offsetDb[cat]?.[stage] ?? []) : []

  function handleCatChange(c) {
    setCat(c)
    setStage('')
  }

  return (
    <div className="cb__db-browser">
      <div className="cb__db-filters">
        <select
          className="cb__input cb__input--db-sel"
          value={cat}
          onChange={e => handleCatChange(e.target.value)}
        >
          <option value="">Category...</option>
          {DB_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          className="cb__input cb__input--db-sel"
          value={stage}
          onChange={e => setStage(e.target.value)}
          disabled={!cat || stages.length === 0}
        >
          <option value="">Stage...</option>
          {stages.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {entries.length > 0 ? (
        <div className="cb__db-entries">
          {entries.map((entry, i) => (
            <div key={i} className="cb__db-entry">
              <div className="cb__db-entry-main">
                <span className="cb__db-entry-label">{entry.label}</span>
                <span className="cb__db-entry-seg text-3">{entry.lssName}</span>
                <span className={`cb__db-entry-offset ${entry.offsetSeconds == null ? 'cb__db-entry-offset--tbd' : ''}`}>
                  {fmtOffset(entry.offsetSeconds)}
                </span>
              </div>
              {entry.notes && (
                <span className="cb__db-entry-notes text-3">{entry.notes}</span>
              )}
              <button
                className="cb__db-use-btn"
                onClick={() => onUse(entry)}
                disabled={entry.offsetSeconds == null}
                title={entry.offsetSeconds == null ? 'Offset not yet measured' : `Use: ${entry.lssName} +${entry.offsetSeconds}s`}
              >
                {entry.offsetSeconds == null ? 'TBD' : 'use'}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-3 cb__db-empty">
          {!cat ? 'Select a category to browse offsets.' :
           !stage ? 'Select a stage to see available offsets.' :
           'No entries for this stage in the database yet.'}
        </p>
      )}
    </div>
  )
}

// â”€â”€ Per-collection offset editor â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function OffsetFields({ col, onSetOffset }) {
  const [editing,    setEditing]    = useState(false)
  const [seg,        setSeg]        = useState(col.lssSegmentName ?? '')
  const [off,        setOff]        = useState(col.offsetSeconds != null ? String(col.offsetSeconds) : '')
  const [showBrowser, setShowBrowser] = useState(false)

  function save() {
    const parsed = off.trim() ? parseFloat(off) : null
    onSetOffset(col.id, isNaN(parsed) ? null : parsed, seg.trim() || null)
    setEditing(false)
    setShowBrowser(false)
  }

  function handleUseEntry(entry) {
    setSeg(entry.lssName)
    setOff(String(entry.offsetSeconds))
    setShowBrowser(false)
  }

  if (!editing) {
    const hasOffset = col.offsetSeconds != null
    return (
      <div className="cb__offset-row">
        {hasOffset ? (
          <span className="cb__offset-pill">
            +{col.offsetSeconds}s{col.lssSegmentName ? ` [${col.lssSegmentName}]` : ''}
          </span>
        ) : (
          <span className="text-3 cb__offset-none">no offset</span>
        )}
        <button className="cb__action" onClick={() => setEditing(true)}>
          {hasOffset ? 'edit offset' : 'add offset'}
        </button>
      </div>
    )
  }

  return (
    <div className="cb__offset-edit-wrap">
      <div className="cb__offset-edit">
        <input
          className="cb__input cb__input--seg"
          type="text"
          placeholder=".lss segment name"
          value={seg}
          onChange={e => setSeg(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && save()}
        />
        <input
          className="cb__input cb__input--sm"
          type="number" min="0" step="0.1"
          placeholder="offset (s)"
          value={off}
          onChange={e => setOff(e.target.value)}
        />
        <button
          className={`cb__action cb__action--browse ${showBrowser ? 'is-active' : ''}`}
          onClick={() => setShowBrowser(v => !v)}
          title="Browse offset database"
        >
          {showBrowser ? 'hide db' : 'browse db'}
        </button>
        <button className="cb__action cb__action--save" onClick={save}>save</button>
        <button className="cb__action" onClick={() => { setEditing(false); setShowBrowser(false) }}>cancel</button>
      </div>

      {showBrowser && <OffsetBrowser onUse={handleUseEntry} />}
    </div>
  )
}

// â”€â”€ Main CollectionBuilder â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function CollectionBuilder({
  collections,
  attempts,
  onCreateCollection,
  onDeleteCollection,
  onRenameCollection,
  onSetOffset,
  onAddStar,
  onRemoveStar,
  getSuccessTimes,
}) {
  const [newName,        setNewName]        = useState('')
  const [renamingId,     setRenamingId]     = useState(null)
  const [renameVal,      setRenameVal]      = useState('')
  const [expandedId,     setExpandedId]     = useState(null)
  const [activeCategory, setActiveCategory] = useState(PRESET_CATEGORIES[0]?.id ?? '')

  function handleCreate() {
    const name = newName.trim()
    if (!name) return
    onCreateCollection(name)
    setNewName('')
  }

  function handlePreset(preset) {
    onCreateCollection(preset.label, preset.stars)
  }

  function commitRename(id) {
    const v = renameVal.trim()
    if (v) onRenameCollection(id, v)
    setRenamingId(null)
  }

  const activePresets = PRESET_CATEGORIES.find(c => c.id === activeCategory)?.presets ?? []

  return (
    <div className="cb">
      {/* â”€â”€ New collection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <section className="cb__section">
        <h3 className="cb__section-title">New collection</h3>
        <div className="cb__new-row">
          <input
            className="cb__input"
            placeholder="Collection name..."
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
          />
          <button className="cb__btn cb__btn--create" onClick={handleCreate} disabled={!newName.trim()}>
            + Create
          </button>
        </div>
      </section>

      {/* â”€â”€ Presets by category â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <section className="cb__section">
        <h3 className="cb__section-title">Create from preset</h3>
        <div className="cb__cat-tabs">
          {PRESET_CATEGORIES.map(cat => (
            <button
              key={cat.id}
              className={'cb__cat-tab' + (activeCategory === cat.id ? ' is-active' : '')}
              onClick={() => setActiveCategory(cat.id)}
            >
              {cat.label}
            </button>
          ))}
        </div>
        {activePresets.length > 0 ? (
          <div className="cb__presets">
            {activePresets.map(p => (
              <button key={p.id} className="cb__preset-btn" onClick={() => handlePreset(p)}>
                {p.label}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-3 cb__empty" style={{ paddingTop: '0.4rem' }}>
            No presets defined for this category.
          </p>
        )}
      </section>

      {/* â”€â”€ Existing collections â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {collections.length > 0 && (
        <section className="cb__section">
          <h3 className="cb__section-title">Your collections</h3>
          <div className="cb__list">
            {collections.map(col => {
              const starCount  = col.stars.length
              const timedStars = col.stars.filter(s => getSuccessTimes(s.stage, s.star, s.strategy).length > 0).length
              const expanded   = expandedId === col.id

              return (
                <div key={col.id} className="cb__col">
                  <div className="cb__col-header">
                    {renamingId === col.id ? (
                      <input
                        className="cb__input cb__input--inline"
                        value={renameVal}
                        onChange={e => setRenameVal(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') commitRename(col.id); if (e.key === 'Escape') setRenamingId(null) }}
                        onBlur={() => commitRename(col.id)}
                        autoFocus
                      />
                    ) : (
                      <span className="cb__col-name">{col.name}</span>
                    )}
                    <span className="cb__col-meta text-3">{timedStars}/{starCount} timed</span>
                    <div className="cb__col-actions">
                      <button className="cb__action" onClick={() => setExpandedId(expanded ? null : col.id)}>
                        {expanded ? 'collapse' : 'edit'}
                      </button>
                      <button className="cb__action" onClick={() => { setRenamingId(col.id); setRenameVal(col.name) }}>rename</button>
                      <button className="cb__action cb__action--del" onClick={() => onDeleteCollection(col.id)}>delete</button>
                    </div>
                  </div>

                  <div className="cb__col-offset">
                    <OffsetFields col={col} onSetOffset={onSetOffset} />
                  </div>

                  {expanded && (
                    <div className="cb__col-body">
                      <div className="cb__star-list">
                        {col.stars.length === 0 && (
                          <p className="text-3 cb__empty">No stars yet â€” add some below.</p>
                        )}
                        {col.stars.map((s, i) => {
                          const n = getSuccessTimes(s.stage, s.star, s.strategy).length
                          return (
                            <div key={i} className="cb__star-row">
                              <span className="cb__star-name">{s.star}</span>
                              <span className="cb__star-strat text-3">{s.strategy}</span>
                              <span className={'cb__star-count text-3' + (n === 0 ? ' cb__star-count--zero' : '')}>
                                {n}x
                              </span>
                              <button className="cb__action cb__action--del"
                                onClick={() => onRemoveStar(col.id, s.stage, s.star, s.strategy)}>
                                remove
                              </button>
                            </div>
                          )
                        })}
                      </div>
                      <div className="cb__add-star">
                        <span className="text-3">Add star:</span>
                        <StarPicker compact label="Add"
                          onSelect={({ stage, star, strategy }) => onAddStar(col.id, stage, star, strategy)} />
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {collections.length === 0 && (
        <p className="text-3 cb__empty-state">No collections yet. Create one above or start from a preset.</p>
      )}
    </div>
  )
}
