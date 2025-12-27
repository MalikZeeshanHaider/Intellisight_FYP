/**
 * Department Distribution Chart Component
 * Shows students or teachers distribution by department
 */

import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { motion } from 'framer-motion';

// Color schemes for different pages
const COLOR_SCHEMES = {
  cyan: ['#06b6d4', '#0ea5e9', '#3b82f6', '#8b5cf6', '#a855f7', '#ec4899', '#22d3ee', '#38bdf8'],
  green: ['#06b6d4', '#10b981', '#8b5cf6', '#34d399', '#a855f7', '#6ee7b7', '#c084fc', '#22c55e'],
  purple: ['#8b5cf6', '#a855f7', '#c084fc', '#d946ef', '#6366f1', '#818cf8', '#e879f9', '#f0abfc'],
};

// Department colors - themed
const DEPARTMENT_COLORS = {
  'CS': '#06b6d4',
  'IT': '#8b5cf6',
  'SE': '#10b981',
  'EE': '#f59e0b',
  'ME': '#ef4444',
  'CE': '#6366f1',
  'BBA': '#ec4899',
  'MBA': '#14b8a6',
  'BSIT': '#8b5cf6',
  'BSCS': '#06b6d4',
  'BSSE': '#22c55e',
  'Default': '#64748b',
};

const getColor = (department, colorScheme = 'cyan', index = 0) => {
  if (colorScheme && COLOR_SCHEMES[colorScheme]) {
    return COLOR_SCHEMES[colorScheme][index % COLOR_SCHEMES[colorScheme].length];
  }
  return DEPARTMENT_COLORS[department] || DEPARTMENT_COLORS['Default'];
};

const DepartmentDistributionChart = ({
  data = [],
  title = 'Department Distribution',
  type = 'students',
  height = 420,
  showLegend = true,
  colorScheme = 'cyan',
}) => {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) {
      return [
        { name: 'CS', value: 45, color: getColor('CS', colorScheme, 0) },
        { name: 'IT', value: 38, color: getColor('IT', colorScheme, 1) },
        { name: 'SE', value: 32, color: getColor('SE', colorScheme, 2) },
        { name: 'EE', value: 28, color: getColor('EE', colorScheme, 3) },
        { name: 'BBA', value: 22, color: getColor('BBA', colorScheme, 4) },
      ];
    }
    return data.map((item, index) => ({
      name: item.department || item.name,
      value: item.count || item.value,
      color: getColor(item.department || item.name, colorScheme, index),
    }));
  }, [data, colorScheme]);

  const total = useMemo(() => chartData.reduce((sum, item) => sum + item.value, 0), [chartData]);

  const accentColor = colorScheme === 'green' ? '#10b981' : colorScheme === 'purple' ? '#8b5cf6' : '#06b6d4';

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload || !payload[0]) return null;
    const { name, value, color } = payload[0].payload;
    const percentage = total > 0 ? Math.round((value / total) * 100) : 0;

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="px-4 py-3 rounded-xl shadow-xl"
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '2px solid ' + color,
          boxShadow: '0 0 20px ' + color + '40',
        }}
      >
        <p className="font-bold text-lg" style={{ color: color }}>{name}</p>
        <p className="text-sm" style={{ color: 'var(--text-main)' }}>{value} {type}</p>
        <p className="text-xs" style={{ color: 'var(--text-soft)' }}>{percentage}% of total</p>
      </motion.div>
    );
  };

  const CustomLegend = ({ payload }) => {
    if (!payload) return null;
    return (
      <div className="flex flex-wrap justify-center gap-2 mt-2 px-2">
        {payload.map((entry, index) => {
          const itemColor = chartData[index]?.color || entry.color;
          return (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="flex items-center gap-1.5 px-2 py-1 rounded-full"
              style={{
                backgroundColor: itemColor + '20',
                border: '1px solid ' + itemColor + '50',
              }}
            >
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{
                  backgroundColor: itemColor,
                  boxShadow: '0 0 6px ' + itemColor,
                }}
              />
              <span className="text-[10px] font-semibold" style={{ color: itemColor }}>
                {entry.value}
              </span>
            </motion.div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold" style={{ color: 'var(--text-main)' }}>
          {title}
        </h3>
        <span
          className="text-sm font-medium px-3 py-1 rounded-full"
          style={{
            backgroundColor: accentColor + '15',
            color: accentColor,
            border: '1px solid ' + accentColor + '40',
          }}
        >
          Total: {total}
        </span>
      </div>

      <div style={{ height: height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <defs>
              {chartData.map((entry, index) => (
                <linearGradient key={'gradient-' + index} id={'deptGradient-' + index} x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor={entry.color} stopOpacity={1} />
                  <stop offset="100%" stopColor={entry.color} stopOpacity={0.7} />
                </linearGradient>
              ))}
              <filter id="deptGlow">
                <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={45}
              outerRadius={75}
              paddingAngle={4}
              dataKey="value"
              filter="url(#deptGlow)"
              animationBegin={0}
              animationDuration={1000}
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={'cell-' + index}
                  fill={entry.color}
                  stroke={entry.color}
                  strokeWidth={2}
                  style={{ filter: 'drop-shadow(0 0 6px ' + entry.color + '80)' }}
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            {showLegend && <Legend content={<CustomLegend />} verticalAlign="bottom" />}
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

/**
 * Horizontal Bar version for department comparison
 */
const DepartmentBarChart = ({
  data = [],
  title = 'Students by Department',
  height = 250,
  colorScheme = 'cyan',
}) => {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) {
      return [
        { name: 'CS', value: 45 },
        { name: 'IT', value: 38 },
        { name: 'SE', value: 32 },
        { name: 'EE', value: 28 },
        { name: 'BBA', value: 22 },
      ];
    }
    return data.map(function(item) {
      return {
        name: item.department || item.name,
        value: item.count || item.value,
      };
    }).sort(function(a, b) {
      return b.value - a.value;
    });
  }, [data]);

  const maxValue = Math.max.apply(null, chartData.map(function(d) { return d.value; }));

  return (
    <div className="w-full">
      <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-main)' }}>
        {title}
      </h3>
      <div className="space-y-3">
        {chartData.map(function(item, index) {
          var percentage = maxValue > 0 ? (item.value / maxValue) * 100 : 0;
          var color = getColor(item.name, colorScheme, index);

          return (
            <motion.div
              key={item.name}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="flex items-center gap-3"
            >
              <span className="w-32 sm:w-40 text-xs sm:text-sm font-bold" style={{ color: color }}>
                {item.name}
              </span>
              <div
                className="flex-1 h-6 sm:h-7 rounded-full overflow-hidden"
                style={{ backgroundColor: 'rgba(255, 255, 255, 0.08)' }}
              >
                <motion.div
                  className="h-full rounded-full"
                  style={{
                    background: 'linear-gradient(90deg, ' + color + ', ' + color + 'aa)',
                    boxShadow: '0 0 12px ' + color + '50',
                  }}
                  initial={{ width: 0 }}
                  animate={{ width: percentage + '%' }}
                  transition={{ duration: 0.8, delay: index * 0.1, ease: 'easeOut' }}
                />
              </div>
              <span className="w-8 text-sm font-bold text-right" style={{ color: 'var(--text-main)' }}>
                {item.value}
              </span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export { DepartmentDistributionChart, DepartmentBarChart };
