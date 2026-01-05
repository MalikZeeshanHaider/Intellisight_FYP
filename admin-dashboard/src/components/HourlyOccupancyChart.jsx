/**
 * Hourly Occupancy Area Chart Component
 * Shows occupancy trend throughout the day for a specific zone
 */

import React, { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { motion } from 'framer-motion';

// Generate sample data for demo
const generateSampleData = () => {
  return Array.from({ length: 24 }, (_, hour) => {
    let baseValue = 0;
    
    // Simulate realistic patterns
    if (hour >= 8 && hour <= 16) {
      baseValue = Math.floor(Math.random() * 30) + 40; // Peak hours
    } else if (hour >= 7 && hour <= 18) {
      baseValue = Math.floor(Math.random() * 20) + 15; // Medium
    } else {
      baseValue = Math.floor(Math.random() * 5); // Low
    }

    return {
      hour: `${hour.toString().padStart(2, '0')}:00`,
      hourNum: hour,
      occupancy: baseValue,
      capacity: 50,
    };
  });
};

const HourlyOccupancyChart = ({
  data = null,
  zoneName = 'Zone',
  capacity = 50,
  height = 300,
  showCapacityLine = true,
  color = '#00ffff',
}) => {
  const chartData = useMemo(() => data || generateSampleData(), [data]);

  const currentHour = new Date().getHours();
  const peakHour = useMemo(() => {
    const peak = chartData.reduce((max, item) => 
      item.occupancy > max.occupancy ? item : max, chartData[0]
    );
    return peak;
  }, [chartData]);

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.[0]) return null;

    const data = payload[0].payload;
    const percentage = capacity > 0 ? Math.round((data.occupancy / capacity) * 100) : 0;

    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="px-4 py-3 rounded-xl shadow-xl"
        style={{
          backgroundColor: 'var(--bg-card)',
          border: `2px solid ${color}`,
          boxShadow: `0 0 20px ${color}40`,
        }}
      >
        <p className="font-bold" style={{ color }}>
          {label}
        </p>
        <div className="mt-2 space-y-1">
          <p className="text-sm" style={{ color: 'var(--text-main)' }}>
            <span style={{ color: 'var(--text-soft)' }}>Occupancy:</span>{' '}
            <span className="font-bold">{data.occupancy}</span>
          </p>
          <p className="text-sm" style={{ color: 'var(--text-main)' }}>
            <span style={{ color: 'var(--text-soft)' }}>Capacity:</span>{' '}
            <span className="font-bold">{percentage}%</span>
          </p>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold" style={{ color: 'var(--text-main)' }}>
            Hourly Occupancy - {zoneName}
          </h3>
          <p className="text-xs" style={{ color: 'var(--text-soft)' }}>
            Peak at {peakHour.hour} with {peakHour.occupancy} people
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}` }} />
            <span className="text-xs" style={{ color: 'var(--text-soft)' }}>Occupancy</span>
          </div>
          {showCapacityLine && (
            <div className="flex items-center gap-2">
              <div className="w-3 h-0.5 bg-red-500" style={{ boxShadow: '0 0 8px #ef4444' }} />
              <span className="text-xs" style={{ color: 'var(--text-soft)' }}>Capacity</span>
            </div>
          )}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="occupancyGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.4} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
            <filter id="areaGlow">
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
          />

          <XAxis
            dataKey="hour"
            stroke="var(--text-soft)"
            tick={{ fill: 'var(--text-soft)', fontSize: 10 }}
            tickLine={false}
            interval={2}
          />

          <YAxis
            stroke="var(--text-soft)"
            tick={{ fill: 'var(--text-soft)', fontSize: 10 }}
            tickLine={false}
            domain={[0, Math.max(capacity * 1.2, Math.max(...chartData.map(d => d.occupancy)) * 1.2)]}
          />

          <Tooltip content={<CustomTooltip />} />

          {showCapacityLine && (
            <ReferenceLine
              y={capacity}
              stroke="#ef4444"
              strokeDasharray="5 5"
              strokeWidth={2}
              label={{
                value: `Capacity: ${capacity}`,
                fill: '#ef4444',
                fontSize: 10,
                position: 'right',
              }}
            />
          )}

          {/* Current hour marker */}
          <ReferenceLine
            x={`${currentHour.toString().padStart(2, '0')}:00`}
            stroke={color}
            strokeWidth={2}
            strokeDasharray="3 3"
          />

          <Area
            type="monotone"
            dataKey="occupancy"
            stroke={color}
            strokeWidth={3}
            fill="url(#occupancyGradient)"
            filter="url(#areaGlow)"
            dot={false}
            activeDot={{
              r: 6,
              stroke: color,
              strokeWidth: 2,
              fill: 'var(--bg-card)',
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

/**
 * Comparison version showing today vs yesterday
 */
export const OccupancyComparisonChart = ({
  todayData = null,
  yesterdayData = null,
  zoneName = 'Zone',
  height = 280,
}) => {
  const generateData = () => Array.from({ length: 24 }, (_, hour) => {
    let base = hour >= 8 && hour <= 16 ? 40 : hour >= 7 && hour <= 18 ? 15 : 2;
    return {
      hour: `${hour.toString().padStart(2, '0')}:00`,
      today: base + Math.floor(Math.random() * 20),
      yesterday: base + Math.floor(Math.random() * 20) - 5,
    };
  });

  const chartData = useMemo(() => {
    if (todayData && yesterdayData) {
      return todayData.map((item, idx) => ({
        hour: item.hour,
        today: item.occupancy,
        yesterday: yesterdayData[idx]?.occupancy || 0,
      }));
    }
    return generateData();
  }, [todayData, yesterdayData]);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold" style={{ color: 'var(--text-main)' }}>
          Today vs Yesterday - {zoneName}
        </h3>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-cyan-400" style={{ boxShadow: '0 0 8px #00ffff' }} />
            <span className="text-xs" style={{ color: 'var(--text-soft)' }}>Today</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-purple-400" style={{ boxShadow: '0 0 8px #a855f7' }} />
            <span className="text-xs" style={{ color: 'var(--text-soft)' }}>Yesterday</span>
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="todayGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#00ffff" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#00ffff" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="yesterdayGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#a855f7" stopOpacity={0.2} />
              <stop offset="100%" stopColor="#a855f7" stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" opacity={0.3} />
          <XAxis dataKey="hour" stroke="var(--text-soft)" tick={{ fontSize: 10 }} interval={3} />
          <YAxis stroke="var(--text-soft)" tick={{ fontSize: 10 }} />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-light)',
              borderRadius: '8px',
            }}
          />

          <Area
            type="monotone"
            dataKey="yesterday"
            stroke="#a855f7"
            strokeWidth={2}
            fill="url(#yesterdayGradient)"
            strokeDasharray="5 5"
          />
          <Area
            type="monotone"
            dataKey="today"
            stroke="#00ffff"
            strokeWidth={3}
            fill="url(#todayGradient)"
            style={{ filter: 'drop-shadow(0 0 4px #00ffff)' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export { HourlyOccupancyChart };
