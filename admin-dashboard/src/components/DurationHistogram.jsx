/**
 * Duration Histogram Component
 * Shows distribution of visit durations
 */

import React, { useMemo } from 'react';
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
import { motion } from 'framer-motion';

// Generate sample duration data
const generateSampleData = () => {
  const buckets = [
    { range: '0-15', label: '< 15 min', min: 0, max: 15 },
    { range: '15-30', label: '15-30 min', min: 15, max: 30 },
    { range: '30-60', label: '30-60 min', min: 30, max: 60 },
    { range: '1-2h', label: '1-2 hours', min: 60, max: 120 },
    { range: '2-4h', label: '2-4 hours', min: 120, max: 240 },
    { range: '4-6h', label: '4-6 hours', min: 240, max: 360 },
    { range: '6h+', label: '6+ hours', min: 360, max: Infinity },
  ];

  return buckets.map(bucket => ({
    ...bucket,
    count: Math.floor(Math.random() * 50) + 5,
  }));
};

const DurationHistogram = ({
  data = null, // Array of durations in minutes, or pre-bucketed data
  title = 'Visit Duration Distribution',
  height = 280,
  color = '#00ffff',
  showStats = true,
}) => {
  // Process data into histogram buckets
  const histogramData = useMemo(() => {
    if (!data || data.length === 0) {
      return generateSampleData();
    }

    // If data is already bucketed
    if (data[0]?.range || data[0]?.label) {
      return data;
    }

    // Process raw duration data
    const buckets = [
      { range: '0-15', label: '< 15 min', count: 0, min: 0, max: 15 },
      { range: '15-30', label: '15-30 min', count: 0, min: 15, max: 30 },
      { range: '30-60', label: '30-60 min', count: 0, min: 30, max: 60 },
      { range: '1-2h', label: '1-2 hours', count: 0, min: 60, max: 120 },
      { range: '2-4h', label: '2-4 hours', count: 0, min: 120, max: 240 },
      { range: '4-6h', label: '4-6 hours', count: 0, min: 240, max: 360 },
      { range: '6h+', label: '6+ hours', count: 0, min: 360, max: Infinity },
    ];

    data.forEach(duration => {
      for (const bucket of buckets) {
        if (duration >= bucket.min && duration < bucket.max) {
          bucket.count++;
          break;
        }
      }
    });

    return buckets;
  }, [data]);

  // Calculate stats
  const stats = useMemo(() => {
    const total = histogramData.reduce((sum, b) => sum + b.count, 0);
    const peakBucket = histogramData.reduce((max, b) => b.count > max.count ? b : max, histogramData[0]);
    
    return {
      total,
      peak: peakBucket.label,
      peakCount: peakBucket.count,
    };
  }, [histogramData]);

  const maxCount = Math.max(...histogramData.map(d => d.count));

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.[0]) return null;

    const data = payload[0].payload;
    const percentage = stats.total > 0 ? Math.round((data.count / stats.total) * 100) : 0;

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="px-4 py-3 rounded-xl shadow-xl"
        style={{
          backgroundColor: 'var(--bg-card)',
          border: `2px solid ${color}`,
          boxShadow: `0 0 20px ${color}40`,
        }}
      >
        <p className="font-bold" style={{ color }}>
          {data.label}
        </p>
        <p className="text-sm mt-1" style={{ color: 'var(--text-main)' }}>
          {data.count} visits ({percentage}%)
        </p>
      </motion.div>
    );
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold" style={{ color: 'var(--text-main)' }}>
          {title}
        </h3>
        {showStats && (
          <div className="flex items-center gap-4 text-xs">
            <span style={{ color: 'var(--text-soft)' }}>
              Total Visits: <span className="font-bold" style={{ color }}>{stats.total}</span>
            </span>
            <span style={{ color: 'var(--text-soft)' }}>
              Peak: <span className="font-bold" style={{ color }}>{stats.peak}</span>
            </span>
          </div>
        )}
      </div>

      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={histogramData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
          <defs>
            <linearGradient id="histogramGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={1} />
              <stop offset="100%" stopColor={color} stopOpacity={0.5} />
            </linearGradient>
            <filter id="histogramGlow">
              <feGaussianBlur stdDeviation="2" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--border-light)"
            opacity={0.3}
            vertical={false}
          />

          <XAxis
            dataKey="label"
            stroke="var(--text-soft)"
            tick={{ fill: 'var(--text-soft)', fontSize: 10 }}
            tickLine={false}
            angle={-45}
            textAnchor="end"
            height={60}
          />

          <YAxis
            stroke="var(--text-soft)"
            tick={{ fill: 'var(--text-soft)', fontSize: 10 }}
            tickLine={false}
          />

          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }} />

          <Bar
            dataKey="count"
            fill="url(#histogramGradient)"
            radius={[4, 4, 0, 0]}
            filter="url(#histogramGlow)"
          >
            {histogramData.map((entry, index) => {
              const intensity = entry.count / maxCount;
              return (
                <Cell
                  key={`cell-${index}`}
                  style={{
                    filter: intensity > 0.7 ? `drop-shadow(0 0 8px ${color})` : 'none',
                  }}
                />
              );
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

/**
 * Compact horizontal version
 */
export const DurationDistributionBar = ({ data = null, color = '#00ffff' }) => {
  const histogramData = useMemo(() => {
    if (!data) return generateSampleData();
    return data;
  }, [data]);

  const total = histogramData.reduce((sum, b) => sum + b.count, 0);

  return (
    <div className="w-full space-y-2">
      {histogramData.slice(0, 5).map((bucket, idx) => {
        const percentage = total > 0 ? (bucket.count / total) * 100 : 0;

        return (
          <motion.div
            key={bucket.range}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="flex items-center gap-2"
          >
            <span className="w-20 text-xs font-medium" style={{ color: 'var(--text-soft)' }}>
              {bucket.label}
            </span>
            <div className="flex-1 h-4 rounded-full overflow-hidden"
              style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
            >
              <motion.div
                className="h-full rounded-full"
                style={{
                  background: `linear-gradient(90deg, ${color}, ${color}80)`,
                  boxShadow: percentage > 50 ? `0 0 8px ${color}60` : 'none',
                }}
                initial={{ width: 0 }}
                animate={{ width: `${percentage}%` }}
                transition={{ duration: 0.6, delay: idx * 0.1 }}
              />
            </div>
            <span className="w-12 text-xs font-bold text-right" style={{ color }}>
              {bucket.count}
            </span>
          </motion.div>
        );
      })}
    </div>
  );
};

/**
 * Mini bar for quick view
 */
export const MiniDurationChart = ({ data = null }) => {
  const histogramData = useMemo(() => {
    if (!data) return generateSampleData();
    return data;
  }, [data]);

  const maxCount = Math.max(...histogramData.map(d => d.count));

  return (
    <div className="flex items-end gap-1 h-12">
      {histogramData.map((bucket, idx) => {
        const heightPercent = maxCount > 0 ? (bucket.count / maxCount) * 100 : 0;

        return (
          <motion.div
            key={bucket.range}
            className="flex-1 rounded-t"
            style={{
              height: `${heightPercent}%`,
              minHeight: '4px',
              background: 'linear-gradient(180deg, #00ffff, #00ffff80)',
              boxShadow: heightPercent > 70 ? '0 0 6px #00ffff60' : 'none',
            }}
            initial={{ height: 0 }}
            animate={{ height: `${heightPercent}%` }}
            transition={{ delay: idx * 0.05, duration: 0.4 }}
            title={`${bucket.label}: ${bucket.count}`}
          />
        );
      })}
    </div>
  );
};

export { DurationHistogram };
