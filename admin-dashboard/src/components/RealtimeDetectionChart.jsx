/**
 * Real-time Detection Line Chart Component
 * Shows live detection count with real-time updates
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';

const RealtimeDetectionChart = ({
  dataStream = null, // If null, will generate demo data
  maxPoints = 30, // Number of points to show
  updateInterval = 2000, // Update interval in ms
  height = 200,
  color = '#00ffff',
  title = 'Real-time Detections',
  showStats = true,
}) => {
  const [data, setData] = useState([]);
  const [isLive, setIsLive] = useState(true);
  const intervalRef = useRef(null);

  // Generate initial demo data
  useEffect(() => {
    if (dataStream) return;

    const initialData = Array.from({ length: maxPoints }, (_, i) => ({
      time: new Date(Date.now() - (maxPoints - i) * updateInterval).toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
      value: Math.floor(Math.random() * 10) + 5,
      timestamp: Date.now() - (maxPoints - i) * updateInterval,
    }));
    setData(initialData);
  }, [maxPoints, updateInterval, dataStream]);

  // Real-time updates (demo mode)
  useEffect(() => {
    if (dataStream || !isLive) return;

    intervalRef.current = setInterval(() => {
      setData(prev => {
        const newPoint = {
          time: new Date().toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          }),
          value: Math.floor(Math.random() * 15) + 3,
          timestamp: Date.now(),
        };

        const newData = [...prev.slice(1), newPoint];
        return newData;
      });
    }, updateInterval);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isLive, updateInterval, dataStream]);

  // Handle external data stream
  useEffect(() => {
    if (!dataStream) return;
    
    const newPoint = {
      time: new Date().toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
      value: dataStream,
      timestamp: Date.now(),
    };

    setData(prev => {
      if (prev.length >= maxPoints) {
        return [...prev.slice(1), newPoint];
      }
      return [...prev, newPoint];
    });
  }, [dataStream, maxPoints]);

  // Calculate stats
  const stats = useMemo(() => {
    if (data.length === 0) return { current: 0, avg: 0, max: 0, min: 0 };
    const values = data.map(d => d.value);
    return {
      current: values[values.length - 1] || 0,
      avg: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
      max: Math.max(...values),
      min: Math.min(...values),
    };
  }, [data]);

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.[0]) return null;

    return (
      <div
        className="px-3 py-2 rounded-lg shadow-lg"
        style={{
          backgroundColor: 'var(--bg-card)',
          border: `1px solid ${color}`,
          boxShadow: `0 0 15px ${color}40`,
        }}
      >
        <p className="text-xs" style={{ color: 'var(--text-soft)' }}>{label}</p>
        <p className="font-bold" style={{ color }}>
          {payload[0].value} detections
        </p>
      </div>
    );
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold" style={{ color: 'var(--text-main)' }}>
            {title}
          </h3>
          <AnimatePresence>
            {isLive && (
              <motion.div
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0 }}
                className="flex items-center gap-1 px-2 py-1 rounded-full"
                style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.2)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                }}
              >
                <motion.div
                  animate={{ scale: [1, 1.2, 1], opacity: [1, 0.5, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                  className="w-2 h-2 rounded-full bg-red-500"
                  style={{ boxShadow: '0 0 8px #ef4444' }}
                />
                <span className="text-xs font-bold text-red-500">LIVE</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        
        <button
          onClick={() => setIsLive(!isLive)}
          className="px-3 py-1 rounded-lg text-xs font-semibold transition-all"
          style={{
            backgroundColor: isLive ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)',
            color: isLive ? '#ef4444' : '#10b981',
            border: `1px solid ${isLive ? 'rgba(239, 68, 68, 0.4)' : 'rgba(16, 185, 129, 0.4)'}`,
          }}
        >
          {isLive ? 'Pause' : 'Resume'}
        </button>
      </div>

      {/* Stats Row */}
      {showStats && (
        <div className="grid grid-cols-4 gap-2 mb-4">
          {[
            { label: 'Current', value: stats.current, color },
            { label: 'Average', value: stats.avg, color: '#a855f7' },
            { label: 'Max', value: stats.max, color: '#10b981' },
            { label: 'Min', value: stats.min, color: '#f59e0b' },
          ].map((stat) => (
            <motion.div
              key={stat.label}
              className="p-2 rounded-lg text-center"
              style={{
                backgroundColor: `${stat.color}10`,
                border: `1px solid ${stat.color}30`,
              }}
            >
              <p className="text-xs" style={{ color: 'var(--text-soft)' }}>{stat.label}</p>
              <motion.p
                key={stat.value}
                initial={{ scale: 1.2 }}
                animate={{ scale: 1 }}
                className="text-lg font-bold"
                style={{ color: stat.color }}
              >
                {stat.value}
              </motion.p>
            </motion.div>
          ))}
        </div>
      )}

      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
          <defs>
            <linearGradient id="realtimeGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
            <filter id="realtimeGlow">
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
            dataKey="time"
            stroke="var(--text-soft)"
            tick={{ fill: 'var(--text-soft)', fontSize: 9 }}
            tickLine={false}
            interval="preserveStartEnd"
          />

          <YAxis
            stroke="var(--text-soft)"
            tick={{ fill: 'var(--text-soft)', fontSize: 10 }}
            tickLine={false}
            domain={[0, 'auto']}
          />

          <Tooltip content={<CustomTooltip />} />

          {/* Average reference line */}
          <ReferenceLine
            y={stats.avg}
            stroke="#a855f7"
            strokeDasharray="5 5"
            strokeWidth={1}
          />

          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={3}
            dot={false}
            filter="url(#realtimeGlow)"
            activeDot={{
              r: 6,
              stroke: color,
              strokeWidth: 2,
              fill: 'var(--bg-card)',
            }}
            isAnimationActive={false} // Disable animation for real-time updates
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

/**
 * Mini version for sidebar/cards
 */
export const MiniRealtimeChart = ({ value = 0, history = [], color = '#00ffff' }) => {
  const data = useMemo(() => {
    if (history.length > 0) return history.map((v, i) => ({ value: v }));
    return Array.from({ length: 20 }, () => ({ value: Math.floor(Math.random() * 10) + 5 }));
  }, [history]);

  return (
    <div className="w-full h-16">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <defs>
            <linearGradient id="miniGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
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
    </div>
  );
};

/**
 * Animated counter with chart
 */
export const LiveDetectionCounter = ({ count = 0, trend = [], label = 'Detections' }) => {
  return (
    <div className="flex items-center gap-4">
      <div className="text-center">
        <motion.p
          key={count}
          initial={{ scale: 1.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-4xl font-black"
          style={{
            color: '#00ffff',
            textShadow: '0 0 20px rgba(0, 255, 255, 0.5)',
          }}
        >
          {count}
        </motion.p>
        <p className="text-xs" style={{ color: 'var(--text-soft)' }}>{label}</p>
      </div>
      <div className="flex-1 h-12">
        <MiniRealtimeChart history={trend} />
      </div>
    </div>
  );
};

export { RealtimeDetectionChart };
