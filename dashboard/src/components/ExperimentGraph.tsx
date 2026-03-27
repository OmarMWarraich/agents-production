import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import type { Experiment } from '../types'

interface ExperimentGraphProps {
  experiment: Experiment
  visibleSetCount: number
}

const ExperimentGraph = ({
  experiment,
  visibleSetCount,
}: ExperimentGraphProps) => {
  const visibleSets =
    visibleSetCount === -1
      ? experiment.sets
      : experiment.sets.slice(-visibleSetCount)

  const firstSetNumber = experiment.sets.length - visibleSets.length + 1

  const data = visibleSets.map((set, index) => ({
    name: `Set ${firstSetNumber + index}`,
    score: set.score,
  }))

  const average =
    data.length > 0
      ? data.reduce((sum, item) => sum + item.score, 0) / data.length
      : 0

  return (
    <div className="graph-wrap">
      <div className="graph-header">
        <h2>{experiment.name} Score Timeline</h2>
        <p>{data.length} evaluation sets shown</p>
      </div>

      <div className="graph-canvas">
        <ResponsiveContainer width="100%" height={360}>
          <LineChart
            data={data}
            margin={{ top: 12, right: 16, left: 6, bottom: 6 }}
          >
            <CartesianGrid strokeDasharray="4 4" stroke="#d8e5e0" />
            <XAxis
              dataKey="name"
              tick={{ fill: '#2f4a42', fontSize: 12 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              domain={[0, 1]}
              tick={{ fill: '#2f4a42', fontSize: 12 }}
              tickFormatter={(value: number) => value.toFixed(1)}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              cursor={{ stroke: '#0f7868', strokeWidth: 1 }}
              contentStyle={{
                borderRadius: '12px',
                border: '1px solid #bbd2ca',
                background: '#f6fbf9',
              }}
              formatter={(value: number) => value.toFixed(3)}
            />
            <ReferenceLine
              y={average}
              stroke="#f08a24"
              strokeDasharray="5 5"
              ifOverflow="extendDomain"
              label={{
                value: `avg ${average.toFixed(2)}`,
                position: 'right',
                fill: '#8a4a16',
                fontSize: 12,
              }}
            />
            <Line
              type="monotone"
              dataKey="score"
              stroke="#0f7868"
              strokeWidth={3}
              dot={{ r: 4, fill: '#0f7868', strokeWidth: 0 }}
              activeDot={{ r: 6, fill: '#f08a24' }}
              animationDuration={550}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export default ExperimentGraph
