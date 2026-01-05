/**
 * Zone Distribution Pie Chart Component
 * Shows the distribution of people across different zones
 */

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';

const COLORS = [
  '#00ffff', // Cyan
  '#6366f1', // Indigo
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#14b8a6', // Teal
];

const ZoneDistributionPieChart = ({ data, loading }) => {
  // Format data for the pie chart
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    
    return data
      .filter(zone => zone.count > 0)
      .map((zone, index) => ({
        name: zone.zoneName || zone.Zone_Name || `Zone ${zone.zoneId || zone.Zone_id}`,
        value: zone.count || zone.personCount || 0,
        color: COLORS[index % COLORS.length],
      }));
  }, [data]);

  // Calculate total
  const total = useMemo(() => {
    return chartData.reduce((sum, item) => sum + item.value, 0);
  }, [chartData]);

  // Custom tooltip
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const percentage = ((data.value / total) * 100).toFixed(1);
      
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
          <p className="font-bold text-sm" style={{ color: data.color }}>
            {data.name}
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-main)' }}>
            <span className="font-black text-lg">{data.value}</span> people
          </p>
          <p className="text-xs" style={{ color: 'var(--text-soft)' }}>
            {percentage}% of total
          </p>
        </div>
      );
    }
    return null;
  };

  // Custom label
  const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }) => {
    if (percent < 0.05) return null; // Don't show label for small slices
    
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor="middle"
        dominantBaseline="central"
        className="font-bold text-xs"
        style={{ textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!data || data.length === 0 || total === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <motion.div
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center mb-3"
        >
          <span className="text-3xl">🥧</span>
        </motion.div>
        <p className="text-sm font-semibold" style={{ color: 'var(--text-soft)' }}>
          No zone data available
        </p>
        <p className="text-xs mt-1" style={{ color: 'var(--text-soft)' }}>
          Data will appear when zones have active people
        </p>
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <defs>
            {chartData.map((entry, index) => (
              <linearGradient key={`gradient-${index}`} id={`pieGradient-${index}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={entry.color} stopOpacity={1} />
                <stop offset="100%" stopColor={entry.color} stopOpacity={0.7} />
              </linearGradient>
            ))}
          </defs>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={renderCustomLabel}
            outerRadius="80%"
            innerRadius="40%"
            paddingAngle={3}
            dataKey="value"
            animationBegin={0}
            animationDuration={1000}
          >
            {chartData.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={`url(#pieGradient-${index})`}
                stroke={entry.color}
                strokeWidth={2}
                style={{
                  filter: 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.3))',
                }}
              />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            layout="horizontal"
            verticalAlign="bottom"
            align="center"
            wrapperStyle={{
              paddingTop: '10px',
              fontSize: '11px',
              fontWeight: 'bold',
            }}
            iconType="circle"
            iconSize={8}
            formatter={(value) => (
              <span style={{ color: 'var(--text-main)' }}>{value}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
      
      {/* Center Total */}
      <div 
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        style={{ marginTop: '-20px' }}
      >
        <div className="text-center">
          <p className="text-3xl font-black" style={{ color: 'var(--text-main)' }}>
            {total}
          </p>
          <p className="text-xs font-medium" style={{ color: 'var(--text-soft)' }}>
            Total
          </p>
        </div>
      </div>
    </div>
  );
};

export default ZoneDistributionPieChart;
