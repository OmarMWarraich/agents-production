import { useMemo, useState } from 'react'
import ExperimentGraph from './components/ExperimentGraph'
import resultsData from '../../results.json'
import type { Results } from '../../types'
import './App.css'

type WindowSize = 10 | 25 | -1

const WINDOW_OPTIONS: { label: string; value: WindowSize }[] = [
  { label: 'Last 10', value: 10 },
  { label: 'Last 25', value: 25 },
  { label: 'All', value: -1 },
]

const App = () => {
  const results = resultsData as Results
  const experiments = results.experiments

  const [selectedExperiment, setSelectedExperiment] = useState(
    experiments[0]?.name ?? ''
  )
  const [windowSize, setWindowSize] = useState<WindowSize>(10)

  const currentExperiment = useMemo(
    () => experiments.find((exp) => exp.name === selectedExperiment) ?? null,
    [experiments, selectedExperiment]
  )

  const visibleSets = useMemo(() => {
    if (!currentExperiment) {
      return []
    }

    if (windowSize === -1) {
      return currentExperiment.sets
    }

    return currentExperiment.sets.slice(-windowSize)
  }, [currentExperiment, windowSize])

  const latestScore = visibleSets[visibleSets.length - 1]?.score ?? 0
  const previousScore = visibleSets[visibleSets.length - 2]?.score ?? latestScore
  const trend = latestScore - previousScore
  const averageScore =
    visibleSets.length > 0
      ? visibleSets.reduce((sum, set) => sum + set.score, 0) / visibleSets.length
      : 0
  const bestScore =
    visibleSets.length > 0
      ? visibleSets.reduce((best, set) => Math.max(best, set.score), 0)
      : 0

  return (
    <div className="app-shell">
      <header className="hero">
        <p className="eyebrow">Agent Performance</p>
        <h1>Experiment Command Center</h1>
        <p className="subtitle">
          Track evaluation performance over time, compare trends, and quickly
          inspect run quality for each experiment.
        </p>
      </header>

      <section className="control-panel" aria-label="Dashboard controls">
        <div className="field-group">
          <label htmlFor="experiment-select">Experiment</label>
          <select
            id="experiment-select"
            value={selectedExperiment}
            onChange={(e) => setSelectedExperiment(e.target.value)}
          >
            {experiments.map((exp) => (
              <option key={exp.name} value={exp.name}>
                {exp.name}
              </option>
            ))}
          </select>
        </div>

        <div className="field-group">
          <span>Range</span>
          <div className="segmented" role="tablist" aria-label="Set range">
            {WINDOW_OPTIONS.map((option) => (
              <button
                key={option.label}
                type="button"
                role="tab"
                aria-selected={windowSize === option.value}
                className={windowSize === option.value ? 'active' : ''}
                onClick={() => setWindowSize(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="stats-grid" aria-label="Experiment summary">
        <article className="stat-card">
          <p>Latest Score</p>
          <h2>{latestScore.toFixed(2)}</h2>
        </article>
        <article className="stat-card">
          <p>Average Score</p>
          <h2>{averageScore.toFixed(2)}</h2>
        </article>
        <article className="stat-card">
          <p>Best Score</p>
          <h2>{bestScore.toFixed(2)}</h2>
        </article>
        <article className="stat-card">
          <p>Trend</p>
          <h2 className={trend >= 0 ? 'positive' : 'negative'}>
            {trend >= 0 ? '+' : ''}
            {trend.toFixed(2)}
          </h2>
        </article>
      </section>

      <section className="chart-panel" aria-label="Experiment chart">
        {currentExperiment ? (
          <ExperimentGraph
            experiment={currentExperiment}
            visibleSetCount={windowSize}
          />
        ) : (
          <p>No experiment data available.</p>
        )}
      </section>
    </div>
  )
}

export default App
