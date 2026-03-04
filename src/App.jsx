import { useState } from 'react'
import { PyodideLoader } from './components/PyodideLoader'
import { PyodideSmokeTest } from './components/PyodideSmokeTest'
import { SplitsAnalyser } from './components/SplitsAnalyser/index'
import { StarTimer } from './components/StarTimer/index'
import './App.css'

const NAV_ITEMS = [
  { id: 'smoke',      label: 'Phase 0',        icon: '#', dev: true  },
  { id: 'splits',     label: 'Splits',          icon: '>', dev: false },
  { id: 'stars',      label: 'Star Timer',      icon: '*', dev: false },
]


export default function App() {
  const [tab, setTab] = useState('smoke')
  const [runData, setRunData] = useState(null)
  const [distribution, setDistribution] = useState(null)

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar__logo">
          <span className="topbar__star">*</span>
          <span className="topbar__name">SM64 Splits</span>
          <span className="topbar__tag badge badge-star">DEV</span>
        </div>
        <nav className="topbar__nav">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              className={'topbar__nav-btn' + (tab === item.id ? ' is-active' : '')}
              onClick={() => setTab(item.id)}
            >
              <span className="topbar__nav-label">{item.label}</span>
              {item.dev && <span className="topbar__nav-dev">dev</span>}
            </button>
          ))}
        </nav>
      </header>

      <main className="app__main">
        <PyodideLoader>
          {tab === 'smoke'      && <PyodideSmokeTest />}

          {/* SplitsAnalyser stays mounted when switching to stars so the
              loaded .lss file and computed distribution persist.
              Hidden with display:none rather than unmounted. */}
          <div style={{ display: tab === 'splits' ? 'contents' : 'none' }}>
            <SplitsAnalyser onRunDataChange={setRunData} onDistributionChange={setDistribution} />
          </div>

          {tab === 'stars'      && <StarTimer runData={runData} distribution={distribution} />}
        </PyodideLoader>
      </main>
    </div>
  )
}
