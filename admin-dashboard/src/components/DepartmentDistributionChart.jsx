/**
 * Department Distribution Chart Component
 * Shows students or teachers distribution by department
 */

import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { motion } from 'framer-motion';

// Helper function to generate gradient shades based on values
const generateGradientColors = (data, baseColor) => {
  // Sort data by value to assign darkest to highest, lightest to lowest
  const sorted = [...data].sort((a, b) => b.value - a.value);
  const maxValue = sorted[0]?.value || 1;
  const minValue = sorted[sorted.length - 1]?.value || 0;
  
  return data.map(item => {
    const ratio = (item.value - minValue) / (maxValue - minValue || 1);
    // Generate opacity based on ratio (0.5 to 1.0)
    const opacity = 0.5 + (ratio * 0.5);
    return {
      ...item,
      color: baseColor + Math.round(opacity * 255).toString(16).padStart(2, '0')
    };
  });
};

// Department colors - will be used as base with gradient
const DEPARTMENT_BASE_COLORS = {
  student: '#6365baff',
  teacher: '#247e5bff',
};

const getColor = (department, colorScheme = 'cyan', index = 0, value = 0, maxValue = 1, minValue = 0) => {
  const baseColor = colorScheme === 'green' ? '#247e5b' : '#6365ba';
  const ratio = maxValue !== minValue ? (value - minValue) / (maxValue - minValue) : 1;
  const opacity = 0.5 + (ratio * 0.5);
  return baseColor + Math.round(opacity * 255).toString(16).padStart(2, '0');
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
        { name: 'CS', value: 45 },
        { name: 'IT', value: 38 },
        { name: 'SE', value: 32 },
        { name: 'EE', value: 28 },
        { name: 'BBA', value: 22 },
      ];
    }
    return data.map((item) => ({
      name: item.department || item.name,
      value: item.count || item.value,
    }));
  }, [data]);

  // Calculate gradient colors based on values
  const maxValue = Math.max(...chartData.map(d => d.value));
  const minValue = Math.min(...chartData.map(d => d.value));
  const baseColor = colorScheme === 'green' ? '#247e5b' : '#6365ba';
  
  const chartDataWithColors = chartData.map(item => {
    const ratio = maxValue !== minValue ? (item.value - minValue) / (maxValue - minValue) : 1;
    const opacity = 0.5 + (ratio * 0.5);
    return {
      ...item,
      color: baseColor + Math.round(opacity * 255).toString(16).padStart(2, '0')
    };
  });

  const total = useMemo(() => chartDataWithColors.reduce((sum, item) => sum + item.value, 0), [chartDataWithColors]);

  const accentColor = colorScheme === 'green' ? '#247e5bff' : '#6365baff';

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
          const itemColor = chartDataWithColors[index]?.color || entry.color;
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
        <h3 className="text-lg font-semibold" style={{ color: '#6b7280' }}>
          {title}
        </h3>
        <span
          className="text-sm font-semibold px-3 py-1 rounded-full"
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
              {chartDataWithColors.map((entry, index) => (
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
              data={chartDataWithColors}
              cx="50%"
              cy="50%"
              innerRadius={45}
              outerRadius={75}
              paddingAngle={4}
              dataKey="value"
              animationBegin={0}
              animationDuration={1000}
            >
              {chartDataWithColors.map((entry, index) => (
                <Cell
                  key={'cell-' + index}
                  fill={entry.color}
                  stroke={entry.color}
                  strokeWidth={0.5}
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
  const minValue = Math.min.apply(null, chartData.map(function(d) { return d.value; }));
  const baseColor = colorScheme === 'green' ? '#247e5b' : '#6365ba';

  return (
    <div className="w-full">
      <h3 className="text-lg font-semibold mb-4" style={{ color: '#6b7280' }}>
        {title}
      </h3>
      <div className="space-y-3">
        {chartData.map(function(item, index) {
          var percentage = maxValue > 0 ? (item.value / maxValue) * 100 : 0;
          var ratio = maxValue !== minValue ? (item.value - minValue) / (maxValue - minValue) : 1;
          var opacity = 0.5 + (ratio * 0.5);
          var color = baseColor + Math.round(opacity * 255).toString(16).padStart(2, '0');

          return (
            <motion.div
              key={item.name}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="flex items-center gap-3"
            >
              <span className="w-32 sm:w-40 text-xs sm:text-sm font-semibold" style={{ color: color }}>
                {item.name}
              </span>
              <div
                className="flex-1 h-6 sm:h-7 rounded-full overflow-hidden"
                style={{ backgroundColor: 'rgba(148, 163, 184, 0.15)' }}
              >
                <motion.div
                  className="h-full rounded-full"
                  style={{
                    background: color,
                  }}
                  initial={{ width: 0 }}
                  animate={{ width: percentage + '%' }}
                  transition={{ duration: 0.8, delay: index * 0.1, ease: 'easeOut' }}
                />
              </div>
              <span className="w-8 text-sm font-semibold text-right" style={{ color: '#6b7280' }}>
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
