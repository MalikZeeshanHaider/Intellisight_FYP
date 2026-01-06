/**
 * Zones Comparison Bar Chart Component
 * Shows all zones side-by-side with their occupancy vs capacity
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
  ReferenceLine,
  Legend,
} from 'recharts';
import { motion } from 'framer-motion';

// Sample data generator
const generateSampleData = () => [
  { name: 'Main Hall', occupancy: 45, capacity: 100, Zone_id: 1 },
  { name: 'Library', occupancy: 28, capacity: 50, Zone_id: 2 },
  { name: 'Lab A', occupancy: 35, capacity: 40, Zone_id: 3 },
  { name: 'Cafeteria', occupancy: 62, capacity: 80, Zone_id: 4 },
  { name: 'Sports Hall', occupancy: 15, capacity: 60, Zone_id: 5 },
];

const ZonesComparisonChart = ({
  data = null, // Array of { name, occupancy, capacity }
  height = 300,
  showCapacity = true,
  title = 'Zones Comparison',
}) => {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return generateSampleData();
    return data.map(zone => ({
      name: zone.Zone_Name || zone.name,
      occupancy: zone.personCount || zone.occupancy || 0,
      capacity: zone.Capacity || zone.capacity || 50,
      Zone_id: zone.Zone_id,
    }));
  }, [data]);

  // Color based on occupancy percentage
  const getBarColor = (occupancy, capacity) => {
    const percentage = capacity > 0 ? (occupancy / capacity) * 100 : 0;
    if (percentage >= 90) return '#ef4444'; // Red - critical
    if (percentage >= 70) return '#f59e0b'; // Amber - warning
    if (percentage >= 50) return '#00ffff'; // Cyan - moderate
    return '#10b981'; // Green - low
  };

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.[0]) return null;

    const data = payload[0].payload;
    const percentage = data.capacity > 0 ? Math.round((data.occupancy / data.capacity) * 100) : 0;
    const color = getBarColor(data.occupancy, data.capacity);

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
        <p className="font-bold text-lg" style={{ color }}>
          {data.name}
        </p>
        <div className="mt-2 space-y-1">
          <p className="text-sm" style={{ color: 'var(--text-main)' }}>
            <span style={{ color: 'var(--text-soft)' }}>Occupancy:</span>{' '}
            <span className="font-bold">{data.occupancy}</span>
          </p>
          <p className="text-sm" style={{ color: 'var(--text-main)' }}>
            <span style={{ color: 'var(--text-soft)' }}>Capacity:</span>{' '}
            <span className="font-bold">{data.capacity}</span>
          </p>
          <p className="text-sm" style={{ color }}>
            <span className="font-bold">{percentage}%</span> full
          </p>
        </div>
      </motion.div>
    );
  };

  const CustomLegend = () => (
    <div className="flex justify-center gap-6 mt-4">
      {[
        { color: '#10b981', label: '< 50%' },
        { color: '#00ffff', label: '50-70%' },
        { color: '#f59e0b', label: '70-90%' },
        { color: '#ef4444', label: '> 90%' },
      ].map((item) => (
        <div key={item.label} className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded"
            style={{
              backgroundColor: item.color,
              boxShadow: `0 0 6px ${item.color}`,
            }}
          />
          <span className="text-xs" style={{ color: 'var(--text-soft)' }}>
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );

  return (
    <div className="w-full">
      <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-main)' }}>
        {title}
      </h3>

      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
          <defs>
            <filter id="zoneBarGlow">
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
            dataKey="name"
            stroke="var(--text-soft)"
            tick={{ fill: 'var(--text-soft)', fontSize: 11 }}
            tickLine={false}
            angle={-20}
            textAnchor="end"
            height={60}
          />

          <YAxis
            stroke="var(--text-soft)"
            tick={{ fill: 'var(--text-soft)', fontSize: 10 }}
            tickLine={false}
          />

          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }} />

          {showCapacity && (
            <Bar
              dataKey="capacity"
              fill="rgba(255, 255, 255, 0.1)"
              radius={[4, 4, 0, 0]}
              name="Capacity"
            />
          )}

          <Bar
            dataKey="occupancy"
            radius={[4, 4, 0, 0]}
            filter="url(#zoneBarGlow)"
            name="Occupancy"
          >
            {chartData.map((entry, index) => {
              const color = getBarColor(entry.occupancy, entry.capacity);
              return (
                <Cell
                  key={`cell-${index}`}
                  fill={color}
                  style={{
                    filter: `drop-shadow(0 0 8px ${color}60)`,
                  }}
                />
              );
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <CustomLegend />
    </div>
  );
};

/**
 * Horizontal version for sidebar or narrow spaces
 */
export const ZonesHorizontalComparison = ({ data = null, showCapacity = true }) => {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return generateSampleData();
    return data.map(zone => ({
      name: zone.Zone_Name || zone.name,
      occupancy: zone.personCount || zone.occupancy || 0,
      capacity: zone.Capacity || zone.capacity || 50,
    }));
  }, [data]);

  const getBarColor = (occupancy, capacity) => {
    const percentage = capacity > 0 ? (occupancy / capacity) * 100 : 0;
    if (percentage >= 90) return '#ef4444';
    if (percentage >= 70) return '#f59e0b';
    if (percentage >= 50) return '#00ffff';
    return '#10b981';
  };

  return (
    <div className="w-full space-y-3">
      {chartData.map((zone, idx) => {
        const percentage = zone.capacity > 0 ? (zone.occupancy / zone.capacity) * 100 : 0;
        const color = getBarColor(zone.occupancy, zone.capacity);

        return (
          <motion.div
            key={zone.name}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="space-y-1"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium" style={{ color: 'var(--text-main)' }}>
                {zone.name}
              </span>
              <span className="text-xs font-bold" style={{ color }}>
                {zone.occupancy}/{zone.capacity}
              </span>
            </div>

            <div className="relative h-4 rounded-full overflow-hidden"
              style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
            >
              {showCapacity && (
                <div
                  className="absolute inset-0 rounded-full"
                  style={{
                    width: '100%',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  }}
                />
              )}
              <motion.div
                className="h-full rounded-full"
                style={{
                  backgroundColor: color,
                  boxShadow: `0 0 8px ${color}60`,
                }}
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(percentage, 100)}%` }}
                transition={{ duration: 0.6, delay: idx * 0.1 }}
              />
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};

/**
 * Stacked comparison showing multiple metrics
 */
export const ZonesStackedComparison = ({ data = null, height = 250 }) => {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return generateSampleData();
    return data.map(zone => ({
      name: zone.Zone_Name || zone.name,
      students: zone.students || Math.floor(Math.random() * 30) + 10,
      teachers: zone.teachers || Math.floor(Math.random() * 10) + 2,
      unknown: zone.unknown || Math.floor(Math.random() * 5),
    }));
  }, [data]);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="var(--border-light)"
          opacity={0.3}
          vertical={false}
        />

        <XAxis
          dataKey="name"
          stroke="var(--text-soft)"
          tick={{ fill: 'var(--text-soft)', fontSize: 10 }}
        />

        <YAxis
          stroke="var(--text-soft)"
          tick={{ fill: 'var(--text-soft)', fontSize: 10 }}
        />

        <Tooltip
          contentStyle={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-light)',
            borderRadius: '8px',
          }}
        />

        <Legend />

        <Bar dataKey="students" stackId="a" fill="#00ffff" name="Students" radius={[0, 0, 0, 0]} />
        <Bar dataKey="teachers" stackId="a" fill="#10b981" name="Teachers" radius={[0, 0, 0, 0]} />
        <Bar dataKey="unknown" stackId="a" fill="#f59e0b" name="Unknown" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
};

export { ZonesComparisonChart };
