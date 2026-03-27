import { useEffect, useMemo, useState } from 'react'
import type { Results } from '../types'
import ExperimentGraph from '../components/ExperimentGraph'

type WindowSize = 10 | 25 | -1

const WINDOW_OPTIONS: { label: string; value: WindowSize }[] = [
  { label: 'Last 10', value: 10 },
  { label: 'Last 25', value: 25 },
  { label: 'All', value: -1 },
]

const emptyResults: Results = {
  experiments: [],
}

const StatsPage = () => {
  const [results, setResults] = useState<Results>(emptyResults)
  const [selectedExperiment, setSelectedExperiment] = useState('')
  const [windowSize, setWindowSize] = useState<WindowSize>(10)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadStats = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const response = await fetch('/api/stats')

        if (!response.ok) {
          const payload = (await response.json()) as { error?: string }
          throw new Error(payload.error || 'Failed to load stats')
        }

        const payload = (await response.json()) as Results
        setResults(payload)
        setSelectedExperiment((current) => current || payload.experiments[0]?.name || '')
      } catch (loadError) {
        setError(
          loadError instanceof Error ? loadError.message : 'Failed to load stats'
        )
      } finally {
        setIsLoading(false)
      }
    }

    void loadStats()
  }, [])

  const experiments = results.experiments

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
    <section className="stats-layout">
      <header className="hero panel">
        <p className="eyebrow">Experiment telemetry</p>
        <h2>Performance timeline</h2>
        <p className="section-copy">
          Evaluation history is isolated on its own route so the live chat stays
          focused while metrics remain easy to inspect.
        </p>
      </header>

      {isLoading ? <div className="panel empty-state">Loading stats...</div> : null}
      {error ? <div className="panel empty-state">{error}</div> : null}

      {!isLoading && !error && currentExperiment ? (
        <>
          <section className="control-panel" aria-label="Dashboard controls">
            <div className="field-group">
              <label htmlFor="experiment-select">Experiment</label>
              <select
                id="experiment-select"
                value={selectedExperiment}
                onChange={(event) => setSelectedExperiment(event.target.value)}
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

          <section className="chart-panel panel" aria-label="Experiment chart">
            <ExperimentGraph
              experiment={currentExperiment}
              visibleSetCount={windowSize}
            />
          </section>
        </>
      ) : null}
    </section>
  )
}

export default StatsPage