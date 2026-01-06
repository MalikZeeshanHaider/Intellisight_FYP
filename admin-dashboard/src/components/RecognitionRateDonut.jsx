/**
 * Recognition Rate Donut Chart Component
 * Shows the ratio of known faces vs unknown faces
 */

import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { motion } from 'framer-motion';

const RecognitionRateDonut = ({
  known = 0,
  unknown = 0,
  size = 'medium', // small, medium, large
  showLabel = true,
  title = 'Recognition Rate'
}) => {
  const total = known + unknown;
  const rate = total > 0 ? Math.round((known / total) * 100) : 0;

  const data = useMemo(() => [
    { name: 'Recognized', value: known, color: '#10b981' },
    { name: 'Unknown', value: unknown, color: '#f59e0b' },
  ], [known, unknown]);

  const sizeConfig = {
    small: { width: 100, height: 100, innerRadius: 30, outerRadius: 45, fontSize: 'text-lg' },
    medium: { width: 150, height: 150, innerRadius: 45, outerRadius: 65, fontSize: 'text-2xl' },
    large: { width: 200, height: 200, innerRadius: 60, outerRadius: 85, fontSize: 'text-3xl' },
  };

  const config = sizeConfig[size] || sizeConfig.medium;

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.[0]) return null;
    const { name, value } = payload[0].payload;
    const percentage = total > 0 ? Math.round((value / total) * 100) : 0;

    return (
      <div
        className="px-3 py-2 rounded-lg shadow-lg"
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-light)',
        }}
      >
        <p className="font-semibold" style={{ color: payload[0].payload.color }}>
          {name}
        </p>
        <p className="text-sm" style={{ color: 'var(--text-soft)' }}>
          {value} ({percentage}%)
        </p>
      </div>
    );
  };

  return (
    <div className="flex flex-col items-center">
      {showLabel && (
        <h4 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-soft)' }}>
          {title}
        </h4>
      )}
      <div className="relative" style={{ width: config.width, height: config.height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <defs>
              <filter id="donutGlow">
                <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={config.innerRadius}
              outerRadius={config.outerRadius}
              paddingAngle={2}
              dataKey="value"
              startAngle={90}
              endAngle={-270}
              filter="url(#donutGlow)"
            >
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.color}
                  stroke="transparent"
                  style={{
                    filter: `drop-shadow(0 0 6px ${entry.color})`,
                  }}
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>

        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            className={`${config.fontSize} font-black`}
            style={{
              color: rate >= 80 ? '#10b981' : rate >= 60 ? '#f59e0b' : '#ef4444',
              textShadow: `0 0 10px ${rate >= 80 ? 'rgba(16, 185, 129, 0.5)' : rate >= 60 ? 'rgba(245, 158, 11, 0.5)' : 'rgba(239, 68, 68, 0.5)'}`,
            }}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3, type: 'spring' }}
          >
            {rate}%
          </motion.span>
          <span className="text-xs" style={{ color: 'var(--text-soft)' }}>
            accuracy
          </span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 mt-3">
        {data.map((entry) => (
          <div key={entry.name} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{
                backgroundColor: entry.color,
                boxShadow: `0 0 6px ${entry.color}`,
              }}
            />
            <span className="text-xs font-medium" style={{ color: 'var(--text-soft)' }}>
              {entry.name}: {entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Mini version for stat cards
 */
export const MiniRecognitionRate = ({ known = 0, unknown = 0 }) => {
  const total = known + unknown;
  const rate = total > 0 ? Math.round((known / total) * 100) : 0;
  const circumference = 2 * Math.PI * 18;
  const offset = circumference - (rate / 100) * circumference;

  return (
    <div className="flex items-center gap-2">
      <div className="relative w-12 h-12">
        <svg viewBox="0 0 44 44" className="w-full h-full transform -rotate-90">
          <circle
            cx="22"
            cy="22"
            r="18"
            fill="none"
            stroke="rgba(255, 255, 255, 0.1)"
            strokeWidth="4"
          />
          <motion.circle
            cx="22"
            cy="22"
            r="18"
            fill="none"
            stroke={rate >= 80 ? '#10b981' : rate >= 60 ? '#f59e0b' : '#ef4444'}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1, ease: 'easeOut' }}
            style={{
              filter: `drop-shadow(0 0 4px ${rate >= 80 ? '#10b981' : rate >= 60 ? '#f59e0b' : '#ef4444'})`,
            }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-bold" style={{ color: rate >= 80 ? '#10b981' : rate >= 60 ? '#f59e0b' : '#ef4444' }}>
            {rate}%
          </span>
        </div>
      </div>
      <div className="text-xs">
        <p style={{ color: '#10b981' }}>{known} known</p>
        <p style={{ color: '#f59e0b' }}>{unknown} unknown</p>
      </div>
    </div>
  );
};

export { RecognitionRateDonut };
