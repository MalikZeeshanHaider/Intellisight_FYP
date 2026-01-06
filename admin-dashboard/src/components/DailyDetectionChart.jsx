/**
 * Daily Detection Chart Component
 * Displays daily population detection statistics with improved visualization
 */

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { format, parseISO } from 'date-fns';
import {
  ComposedChart,
  Area,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

const DailyDetectionChart = ({ data, loading }) => {
  // Format data for display - show all days
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    
    return data.map(d => ({
      ...d,
      label: d.date ? format(parseISO(d.date), 'MMM d') : `Day ${d.day}`,
      fullDate: d.date,
      dayOfWeek: d.dayOfWeek || '',
      isToday: d.isToday || false,
    }));
  }, [data]);

  console.log('Chart data:', chartData);

  // Custom tooltip for better visualization
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0]?.payload;
      
      return (
        <div
          className="rounded-xl p-3 shadow-xl border"
          style={{
            background: document.documentElement.classList.contains('dark')
              ? 'rgba(15, 23, 42, 0.95)'
              : 'rgba(255, 255, 255, 0.95)',
            border: '1px solid rgba(48, 87, 150, 0.3)',
            backdropFilter: 'blur(10px)',
          }}
        >
          <div className="flex items-center gap-2 mb-1">
            <p className="font-bold text-xs" style={{ color: 'var(--text-main)' }}>
              {label}
            </p>
            {dataPoint?.isToday && (
              <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ backgroundColor: '#305796', color: 'white' }}>
                Today
              </span>
            )}
          </div>
          {dataPoint?.fullDate && (
            <p className="text-xs mb-2" style={{ color: 'var(--text-soft)' }}>
              {format(parseISO(dataPoint.fullDate), 'EEEE, MMMM d, yyyy')}
            </p>
          )}
          <div className="space-y-1 mt-2">
            {payload.map((entry, index) => (
              <p key={index} className="text-xs font-semibold flex items-center justify-between gap-3" style={{ color: entry.color }}>
                <span>{entry.name}:</span>
                <span className="font-black">{entry.value}</span>
              </p>
            ))}
          </div>
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
          className="w-12 h-12 border-4 border-t-transparent rounded-full"
          style={{ borderColor: '#305796', borderTopColor: 'transparent' }}
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
          className="w-16 h-16 rounded-full flex items-center justify-center mb-3"
          style={{ backgroundColor: 'rgba(48, 87, 150, 0.1)' }}
        >
          <span className="text-3xl">📊</span>
        </motion.div>
        <p className="text-sm font-semibold" style={{ color: 'var(--text-soft)' }}>
          No detection data available yet
        </p>
        <p className="text-xs mt-1" style={{ color: 'var(--text-soft)' }}>
          Data will appear as people are detected
        </p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart
        data={chartData}
        margin={{ top: 10, right: 20, left: 0, bottom: 5 }}
      >
        <defs>
          <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#305796" stopOpacity={0.8} />
            <stop offset="95%" stopColor="#305796" stopOpacity={0.3} />
          </linearGradient>
          <linearGradient id="colorStudents" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#6365baff" stopOpacity={0.8} />
            <stop offset="95%" stopColor="#6365baff" stopOpacity={0.3} />
          </linearGradient>
          <linearGradient id="colorTeachers" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#247e5bff" stopOpacity={0.8} />
            <stop offset="95%" stopColor="#247e5bff" stopOpacity={0.3} />
          </linearGradient>
          <linearGradient id="areaTotal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#305796" stopOpacity={0.4} />
            <stop offset="95%" stopColor="#305796" stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke={
            document.documentElement.classList.contains('dark')
              ? 'rgba(48, 87, 150, 0.1)'
              : 'rgba(48, 87, 150, 0.2)'
          }
          vertical={false}
        />
        <XAxis
          dataKey="label"
          stroke={
            document.documentElement.classList.contains('dark')
              ? 'rgba(148, 163, 184, 0.8)'
              : 'rgba(100, 116, 139, 0.8)'
          }
          style={{
            fontSize: '11px',
            fontWeight: '600',
          }}
          tick={{ fontSize: 11 }}
          angle={0}
          height={40}
        />
        <YAxis
          stroke={
            document.documentElement.classList.contains('dark')
              ? 'rgba(148, 163, 184, 0.8)'
              : 'rgba(100, 116, 139, 0.8)'
          }
          style={{
            fontSize: '11px',
            fontWeight: '600',
          }}
          tick={{ fontSize: 11 }}
          allowDecimals={false}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(48, 87, 150, 0.05)' }} />
        <Legend
          wrapperStyle={{
            paddingTop: '10px',
            fontSize: '11px',
            fontWeight: '600',
          }}
          iconType="circle"
          iconSize={8}
        />
        
        {/* Area chart for total trend */}
        <Area
          type="monotone"
          dataKey="totalDetections"
          name="Total Detections"
          fill="url(#areaTotal)"
          stroke="#305796"
          strokeWidth={2}
          animationDuration={1000}
        />
        
        {/* Bars for students and faculty */}
        <Bar
          dataKey="studentDetections"
          name="Students"
          fill="url(#colorStudents)"
          radius={[6, 6, 0, 0]}
          animationDuration={1000}
          maxBarSize={50}
        />
        <Bar
          dataKey="teacherDetections"
          name="Faculty"
          fill="url(#colorTeachers)"
          radius={[6, 6, 0, 0]}
          animationDuration={1200}
          maxBarSize={50}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
};

export default DailyDetectionChart;
