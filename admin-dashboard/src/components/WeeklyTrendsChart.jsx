/**
 * Weekly Trends Line Chart Component
 * Shows attendance/detection trends over the week with multiple metrics
 */

import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  ComposedChart,
} from 'recharts';
import { motion } from 'framer-motion';

// Sample data generator
const generateSampleData = () => {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return days.map((day, idx) => ({
    day,
    detected: Math.floor(Math.random() * 100) + 150 + (idx < 5 ? 50 : 0),
    recognized: Math.floor(Math.random() * 80) + 120 + (idx < 5 ? 40 : 0),
    unknown: Math.floor(Math.random() * 30) + 10,
    attendance: Math.floor(Math.random() * 20) + 70 + (idx < 5 ? 10 : -20),
  }));
};

const WeeklyTrendsChart = ({
  data = null,
  title = 'Weekly Trends',
  showAttendanceRate = true,
  height = 300,
}) => {
  const chartData = data || generateSampleData();

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload) return null;

    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-lg p-3 shadow-xl"
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-light)',
        }}
      >
        <p className="font-semibold mb-2" style={{ color: 'var(--text-main)' }}>
          {label}
        </p>
        {payload.map((entry, idx) => (
          <div key={idx} className="flex items-center gap-2 text-sm">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span style={{ color: 'var(--text-soft)' }}>{entry.name}:</span>
            <span className="font-semibold" style={{ color: entry.color }}>
              {entry.name === 'Attendance Rate' ? `${entry.value}%` : entry.value}
            </span>
          </div>
        ))}
      </motion.div>
    );
  };

  // Custom legend
  const CustomLegend = ({ payload }) => {
    return (
      <div className="flex flex-wrap justify-center gap-4 mt-2">
        {payload.map((entry, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ 
                backgroundColor: entry.color,
              }}
            />
            <span className="text-xs" style={{ color: 'var(--text-soft)' }}>
              {entry.value}
            </span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="w-full">
      <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-main)' }}>
        {title}
      </h3>
      
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
          <CartesianGrid 
            strokeDasharray="3 3" 
            stroke="var(--border-light)"
            opacity={0.3}
          />
          
          <XAxis 
            dataKey="day" 
            stroke="var(--text-soft)"
            tick={{ fill: 'var(--text-soft)', fontSize: 12 }}
            axisLine={{ stroke: 'var(--border-light)' }}
          />
          
          <YAxis 
            yAxisId="left"
            stroke="var(--text-soft)"
            tick={{ fill: 'var(--text-soft)', fontSize: 12 }}
            axisLine={{ stroke: 'var(--border-light)' }}
          />
          
          {showAttendanceRate && (
            <YAxis 
              yAxisId="right"
              orientation="right"
              domain={[0, 100]}
              stroke="var(--text-soft)"
              tick={{ fill: 'var(--text-soft)', fontSize: 12 }}
              axisLine={{ stroke: 'var(--border-light)' }}
              tickFormatter={(value) => `${value}%`}
            />
          )}
          
          <Tooltip content={<CustomTooltip />} />
          <Legend content={<CustomLegend />} />

          {/* Detected line */}
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="detected"
            name="Total Detected"
            stroke="#003d82"
            strokeWidth={3}
            dot={{ fill: '#003d82', strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6, stroke: '#003d82', strokeWidth: 2, fill: 'var(--bg-card)' }}
          />

          {/* Recognized line */}
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="recognized"
            name="Recognized"
            stroke="#6b9bd1"
            strokeWidth={3}
            dot={{ fill: '#6b9bd1', strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6, stroke: '#6b9bd1', strokeWidth: 2, fill: 'var(--bg-card)' }}
          />

          {/* Unknown line */}
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="unknown"
            name="Unknown"
            stroke="#f59e0b"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={{ fill: '#f59e0b', strokeWidth: 2, r: 3 }}
          />

          {/* Attendance rate line */}
          {showAttendanceRate && (
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="attendance"
              name="Attendance Rate"
              stroke="#10b981"
              strokeWidth={2}
              dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, stroke: '#10b981', strokeWidth: 2, fill: 'var(--bg-card)' }}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

/**
 * Mini sparkline version for cards
 */
export const TrendSparkline = ({ data = [], color = '#00ffff', height = 40 }) => {
  // Generate sample if no data
  const sparkData = data.length > 0 
    ? data 
    : Array.from({ length: 7 }, (_, i) => ({ 
        value: Math.floor(Math.random() * 50) + 20 
      }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={sparkData}>
        <defs>
          <linearGradient id={`sparkGradient-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="value"
          fill={`url(#sparkGradient-${color.replace('#', '')})`}
          stroke="transparent"
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          dot={false}
          style={{ filter: `drop-shadow(0 0 4px ${color})` }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
};

/**
 * Comparison chart showing two periods
 */
export const ComparisonTrendsChart = ({
  currentData = null,
  previousData = null,
  title = 'This Week vs Last Week',
  height = 250,
}) => {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  
  const chartData = days.map((day, idx) => ({
    day,
    current: currentData?.[idx] ?? Math.floor(Math.random() * 50) + 100,
    previous: previousData?.[idx] ?? Math.floor(Math.random() * 50) + 80,
  }));

  return (
    <div className="w-full">
      <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-main)' }}>
        {title}
      </h3>
      
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
          <CartesianGrid 
            strokeDasharray="3 3" 
            stroke="var(--border-light)"
            opacity={0.3}
          />
          <XAxis 
            dataKey="day" 
            stroke="var(--text-soft)"
            tick={{ fill: 'var(--text-soft)', fontSize: 12 }}
          />
          <YAxis 
            stroke="var(--text-soft)"
            tick={{ fill: 'var(--text-soft)', fontSize: 12 }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-light)',
              borderRadius: '8px',
            }}
          />
          <Legend />
          
          <Line
            type="monotone"
            dataKey="current"
            name="This Week"
            stroke="#00ffff"
            strokeWidth={3}
            dot={{ fill: '#00ffff', r: 4 }}
            style={{ filter: 'drop-shadow(0 0 4px #00ffff)' }}
          />
          <Line
            type="monotone"
            dataKey="previous"
            name="Last Week"
            stroke="#64748b"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={{ fill: '#64748b', r: 3 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default WeeklyTrendsChart;
