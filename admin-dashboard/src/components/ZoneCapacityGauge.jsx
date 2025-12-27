/**
 * Zone Capacity Gauge Chart Component
 * Shows the current occupancy percentage of a zone
 */

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

const ZoneCapacityGauge = ({ 
  current = 0, 
  capacity = 50, 
  zoneName = 'Zone',
  size = 'medium', // small, medium, large
  showLabel = true 
}) => {
  // Calculate percentage
  const percentage = useMemo(() => {
    if (capacity <= 0) return 0;
    return Math.min(Math.round((current / capacity) * 100), 100);
  }, [current, capacity]);

  // Determine color based on percentage
  const getColor = (pct) => {
    if (pct >= 90) return { main: '#ef4444', glow: 'rgba(239, 68, 68, 0.4)' }; // Red
    if (pct >= 70) return { main: '#f59e0b', glow: 'rgba(245, 158, 11, 0.4)' }; // Amber
    if (pct >= 50) return { main: '#00ffff', glow: 'rgba(0, 255, 255, 0.4)' }; // Cyan
    return { main: '#10b981', glow: 'rgba(16, 185, 129, 0.4)' }; // Green
  };

  const color = getColor(percentage);

  // Size configurations
  const sizeConfig = {
    small: { width: 80, height: 50, strokeWidth: 6, fontSize: 'text-sm', labelSize: 'text-xs' },
    medium: { width: 120, height: 70, strokeWidth: 8, fontSize: 'text-xl', labelSize: 'text-xs' },
    large: { width: 160, height: 90, strokeWidth: 10, fontSize: 'text-2xl', labelSize: 'text-sm' },
  };

  const config = sizeConfig[size] || sizeConfig.medium;

  // SVG arc path calculation
  const createArc = (percentage) => {
    const radius = (config.width - config.strokeWidth) / 2;
    const centerX = config.width / 2;
    const centerY = config.height - 10;
    
    // Arc from 180 degrees to 0 degrees (semi-circle)
    const startAngle = Math.PI;
    const endAngle = Math.PI - (Math.PI * (percentage / 100));
    
    const startX = centerX + radius * Math.cos(startAngle);
    const startY = centerY + radius * Math.sin(startAngle);
    const endX = centerX + radius * Math.cos(endAngle);
    const endY = centerY + radius * Math.sin(endAngle);
    
    const largeArcFlag = percentage > 50 ? 1 : 0;
    
    return `M ${startX} ${startY} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${endX} ${endY}`;
  };

  const backgroundArc = createArc(100);
  const valueArc = createArc(percentage);

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: config.width, height: config.height }}>
        <svg width={config.width} height={config.height} className="overflow-visible">
          <defs>
            <linearGradient id={`gaugeGradient-${zoneName}`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={color.main} stopOpacity={0.6} />
              <stop offset="100%" stopColor={color.main} stopOpacity={1} />
            </linearGradient>
            <filter id={`glow-${zoneName}`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          
          {/* Background arc */}
          <path
            d={backgroundArc}
            fill="none"
            stroke={document.documentElement.classList.contains('dark') 
              ? 'rgba(255, 255, 255, 0.1)' 
              : 'rgba(0, 0, 0, 0.1)'}
            strokeWidth={config.strokeWidth}
            strokeLinecap="round"
          />
          
          {/* Value arc with animation */}
          <motion.path
            d={valueArc}
            fill="none"
            stroke={`url(#gaugeGradient-${zoneName})`}
            strokeWidth={config.strokeWidth}
            strokeLinecap="round"
            filter={`url(#glow-${zoneName})`}
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />
        </svg>
        
        {/* Center text */}
        <div 
          className="absolute inset-0 flex flex-col items-center justify-end pb-1"
        >
          <motion.span 
            className={`${config.fontSize} font-black`}
            style={{ color: color.main, textShadow: `0 0 10px ${color.glow}` }}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.5, type: 'spring' }}
          >
            {percentage}%
          </motion.span>
        </div>
      </div>
      
      {showLabel && (
        <div className="text-center mt-1">
          <p className={`${config.labelSize} font-semibold`} style={{ color: 'var(--text-main)' }}>
            {current} / {capacity}
          </p>
          <p className={`${config.labelSize}`} style={{ color: 'var(--text-soft)' }}>
            {zoneName}
          </p>
        </div>
      )}
    </div>
  );
};

/**
 * Mini Gauge for Zone Cards
 */
export const MiniZoneGauge = ({ current = 0, capacity = 50 }) => {
  const percentage = capacity > 0 ? Math.min(Math.round((current / capacity) * 100), 100) : 0;
  
  const getColor = (pct) => {
    if (pct >= 90) return '#ef4444';
    if (pct >= 70) return '#f59e0b';
    if (pct >= 50) return '#00ffff';
    return '#10b981';
  };

  const color = getColor(percentage);

  return (
    <div className="flex items-center gap-2">
      <div className="relative w-10 h-10">
        <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
          {/* Background circle */}
          <circle
            cx="18"
            cy="18"
            r="15"
            fill="none"
            stroke={document.documentElement.classList.contains('dark') 
              ? 'rgba(255, 255, 255, 0.1)' 
              : 'rgba(0, 0, 0, 0.1)'}
            strokeWidth="4"
          />
          {/* Value circle */}
          <motion.circle
            cx="18"
            cy="18"
            r="15"
            fill="none"
            stroke={color}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={`${percentage} 100`}
            initial={{ strokeDasharray: '0 100' }}
            animate={{ strokeDasharray: `${percentage} 100` }}
            transition={{ duration: 1, ease: 'easeOut' }}
            style={{
              filter: `drop-shadow(0 0 4px ${color})`,
            }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-bold" style={{ color }}>
            {percentage}%
          </span>
        </div>
      </div>
      <div className="text-xs">
        <p className="font-semibold" style={{ color: 'var(--text-main)' }}>{current}</p>
        <p style={{ color: 'var(--text-soft)' }}>/ {capacity}</p>
      </div>
    </div>
  );
};

export default ZoneCapacityGauge;
