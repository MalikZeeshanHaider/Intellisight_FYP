import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Area,
  AreaChart,
  Legend,
} from 'recharts';

const DAY_LABELS = { MON: 'Mon', TUE: 'Tue', WED: 'Wed', THU: 'Thu', FRI: 'Fri' };

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl px-4 py-2.5">
      <p className="text-xs font-bold text-slate-700 dark:text-white mb-1">{DAY_LABELS[label] || label}</p>
      {payload.map(p => (
        <div key={p.dataKey} className="flex items-center gap-2 text-xs">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-slate-500 dark:text-slate-400 capitalize">{p.name}:</span>
          <span className="font-semibold text-slate-800 dark:text-slate-100">
            {typeof p.value === 'number' ? `${Math.round(p.value)}%` : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function AttendanceChart({ data, mode }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-400 dark:text-slate-500 text-sm">
        No chart data available.
      </div>
    );
  }

  const hasPresent = data.some(d => d.present !== undefined);
  const hasRate    = data.some(d => d.rate !== undefined);

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id="gradRate" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gradPresent" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#10b981" stopOpacity={0.22} />
            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gradLate" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.18} />
            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
          </linearGradient>
        </defs>

        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.5} />

        <XAxis
          dataKey="day"
          tickFormatter={d => DAY_LABELS[d] || d}
          tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          domain={[0, 100]}
          tickFormatter={v => `${v}%`}
          tick={{ fontSize: 11, fill: '#94a3b8' }}
          axisLine={false}
          tickLine={false}
          ticks={[0, 25, 50, 75, 100]}
        />
        <ReferenceLine y={75} stroke="#6366f1" strokeDasharray="5 3" strokeOpacity={0.4} />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
          formatter={v => <span className="capitalize text-slate-500 dark:text-slate-400 text-xs">{v}</span>}
        />

        {hasRate && (
          <Area
            type="monotone"
            dataKey="rate"
            name="Attendance Rate"
            stroke="#6366f1"
            strokeWidth={2.5}
            fill="url(#gradRate)"
            dot={{ r: 3, fill: '#6366f1', strokeWidth: 0 }}
            activeDot={{ r: 5, fill: '#6366f1' }}
          />
        )}
        {hasPresent && (
          <>
            <Area
              type="monotone"
              dataKey="present"
              name="Present %"
              stroke="#10b981"
              strokeWidth={2.2}
              fill="url(#gradPresent)"
              dot={{ r: 3, fill: '#10b981', strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
            <Area
              type="monotone"
              dataKey="late"
              name="Late %"
              stroke="#f59e0b"
              strokeWidth={2}
              fill="url(#gradLate)"
              dot={{ r: 2.5, fill: '#f59e0b', strokeWidth: 0 }}
              activeDot={{ r: 4 }}
            />
          </>
        )}
      </AreaChart>
    </ResponsiveContainer>
  );
}
