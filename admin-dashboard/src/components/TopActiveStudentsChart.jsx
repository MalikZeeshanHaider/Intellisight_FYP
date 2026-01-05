/**
 * Top Active Students Bar Chart Component
 * Shows the most active students based on attendance entries
 */

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
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

const COLORS = [
  '#00ffff', // 1st - Cyan
  '#6366f1', // 2nd - Indigo
  '#8b5cf6', // 3rd - Purple
  '#10b981', // 4th - Emerald
  '#f59e0b', // 5th - Amber
];

const TopActiveStudentsChart = ({ data, loading, limit = 5 }) => {
  // Format and sort data
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    
    return data
      .slice(0, limit)
      .map((student, index) => ({
        name: student.name || student.Name || `Student ${index + 1}`,
        shortName: (student.name || student.Name || '').split(' ')[0] || `S${index + 1}`,
        entries: student.entries || student.entryCount || student.count || 0,
        department: student.department || student.Department || 'N/A',
        color: COLORS[index % COLORS.length],
        rank: index + 1,
      }));
  }, [data, limit]);

  // Custom tooltip
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      
      return (
        <div
          className="rounded-xl p-3 shadow-xl border"
          style={{
            background: document.documentElement.classList.contains('dark')
              ? 'rgba(15, 23, 42, 0.95)'
              : 'rgba(255, 255, 255, 0.95)',
            border: `2px solid ${data.color}`,
            backdropFilter: 'blur(10px)',
          }}
        >
          <div className="flex items-center gap-2 mb-1">
            <span 
              className="w-6 h-6 rounded-full flex items-center justify-center text-white font-bold text-xs"
              style={{ background: data.color }}
            >
              #{data.rank}
            </span>
            <p className="font-bold text-sm" style={{ color: 'var(--text-main)' }}>
              {data.name}
            </p>
          </div>
          <p className="text-xs" style={{ color: 'var(--text-soft)' }}>
            Department: {data.department}
          </p>
          <p className="text-xs mt-2" style={{ color: data.color }}>
            <span className="font-black text-lg">{data.entries}</span> entries
          </p>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <motion.div
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center mb-3"
        >
          <span className="text-3xl">📊</span>
        </motion.div>
        <p className="text-sm font-semibold" style={{ color: 'var(--text-soft)' }}>
          No student activity data
        </p>
        <p className="text-xs mt-1" style={{ color: 'var(--text-soft)' }}>
          Data will appear as students are detected
        </p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
      >
        <defs>
          {chartData.map((entry, index) => (
            <linearGradient key={`gradient-${index}`} id={`barGradient-${index}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={entry.color} stopOpacity={0.8} />
              <stop offset="100%" stopColor={entry.color} stopOpacity={1} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke={
            document.documentElement.classList.contains('dark')
              ? 'rgba(99, 102, 241, 0.1)'
              : 'rgba(99, 102, 241, 0.2)'
          }
          horizontal={true}
          vertical={false}
        />
        <XAxis
          type="number"
          stroke={
            document.documentElement.classList.contains('dark')
              ? 'rgba(148, 163, 184, 0.8)'
              : 'rgba(100, 116, 139, 0.8)'
          }
          style={{ fontSize: '10px', fontWeight: 'bold' }}
          tick={{ fontSize: 10 }}
          allowDecimals={false}
        />
        <YAxis
          type="category"
          dataKey="shortName"
          stroke={
            document.documentElement.classList.contains('dark')
              ? 'rgba(148, 163, 184, 0.8)'
              : 'rgba(100, 116, 139, 0.8)'
          }
          style={{ fontSize: '10px', fontWeight: 'bold' }}
          tick={{ fontSize: 10 }}
          width={60}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(99, 102, 241, 0.1)' }} />
        <Bar
          dataKey="entries"
          radius={[0, 8, 8, 0]}
          animationDuration={1000}
          maxBarSize={30}
        >
          {chartData.map((entry, index) => (
            <Cell 
              key={`cell-${index}`} 
              fill={`url(#barGradient-${index})`}
              style={{
                filter: 'drop-shadow(2px 2px 4px rgba(0, 0, 0, 0.2))',
              }}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

export default TopActiveStudentsChart;
