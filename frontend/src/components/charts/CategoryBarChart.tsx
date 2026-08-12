import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { CategoryStat } from '../../types';

interface Props {
  data: CategoryStat[];
}

function barColor(value: number): string {
  if (value >= 70) return '#22c55e';
  if (value >= 50) return '#f59e0b';
  return '#ef4444';
}

export default function CategoryBarChart({ data }: Props) {
  const chartData = [...data]
    .sort((a, b) => a.correctRate - b.correctRate)
    .map((s) => ({
      category: s.categoryName,
      value: Math.round(s.correctRate * 100),
    }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 24 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 12 }} />
        <YAxis type="category" dataKey="category" width={90} tick={{ fontSize: 12 }} />
        <Tooltip formatter={(v) => [`${v}%`, '正答率']} />
        <Bar dataKey="value" name="正答率" radius={[0, 4, 4, 0]}>
          {chartData.map((entry, i) => (
            <Cell key={i} fill={barColor(entry.value)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
