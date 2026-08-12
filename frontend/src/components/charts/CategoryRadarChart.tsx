import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import type { CategoryStat } from '../../types';

interface Props {
  data: CategoryStat[];
}

export default function CategoryRadarChart({ data }: Props) {
  const chartData = data.map((s) => ({
    category: s.categoryName,
    value: Math.round(s.correctRate * 100),
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <RadarChart data={chartData}>
        <PolarGrid />
        <PolarAngleAxis dataKey="category" tick={{ fontSize: 12 }} />
        <Radar
          name="正答率"
          dataKey="value"
          stroke="#3b82f6"
          fill="#3b82f6"
          fillOpacity={0.4}
        />
        <Tooltip formatter={(v) => [`${v}%`, '正答率']} />
      </RadarChart>
    </ResponsiveContainer>
  );
}
