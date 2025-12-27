/**
 * Peak Hours Heatmap Component
 * Shows detection frequency across hours of the day and days of the week
 */

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

// Sample data generator for demo
const generateSampleData = () => {
  const data = [];
  DAYS.forEach((day, dayIndex) => {
    HOURS.forEach((hour) => {
      // Generate realistic patterns: higher during school hours, lower nights/weekends
      let baseValue = 0;
      
      if (dayIndex >= 1 && dayIndex <= 5) { // Weekdays
        if (hour >= 8 && hour <= 16) {
          baseValue = Math.floor(Math.random() * 50) + 30; // High activity
        } else if (hour >= 7 || hour <= 18) {
          baseValue = Math.floor(Math.random() * 20) + 10; // Medium activity
        } else {
          baseValue = Math.floor(Math.random() * 5); // Low activity
        }
      } else { // Weekends
        baseValue = Math.floor(Math.random() * 10);
      }
      
      data.push({
        day: dayIndex,
        hour,
        value: baseValue,
      });
    });
  });
  return data;
};

const PeakHoursHeatmap = ({ 
  data = null, // Array of { day: 0-6, hour: 0-23, value: number }
  title = 'Peak Activity Hours',
  colorScheme = 'cyan' // cyan, purple, green
}) => {
  // Use sample data if none provided
  const heatmapData = useMemo(() => data || generateSampleData(), [data]);

  // Get max value for normalization
  const maxValue = useMemo(() => 
    Math.max(...heatmapData.map(d => d.value), 1), 
    [heatmapData]
  );

  // Color schemes
  const colorSchemes = {
    cyan: {
      low: 'rgba(0, 255, 255, 0.1)',
      mid: 'rgba(0, 255, 255, 0.5)',
      high: 'rgba(0, 255, 255, 1)',
      glow: 'rgba(0, 255, 255, 0.3)',
    },
    purple: {
      low: 'rgba(168, 85, 247, 0.1)',
      mid: 'rgba(168, 85, 247, 0.5)',
      high: 'rgba(168, 85, 247, 1)',
      glow: 'rgba(168, 85, 247, 0.3)',
    },
    green: {
      low: 'rgba(16, 185, 129, 0.1)',
      mid: 'rgba(16, 185, 129, 0.5)',
      high: 'rgba(16, 185, 129, 1)',
      glow: 'rgba(16, 185, 129, 0.3)',
    },
  };

  const colors = colorSchemes[colorScheme] || colorSchemes.cyan;

  // Get color based on normalized value
  const getColor = (value) => {
    const normalized = value / maxValue;
    if (normalized < 0.2) return colors.low;
    if (normalized < 0.5) return colors.mid;
    return colors.high;
  };

  // Get cell data
  const getCell = (day, hour) => {
    const cell = heatmapData.find(d => d.day === day && d.hour === hour);
    return cell ? cell.value : 0;
  };

  // Format hour for display
  const formatHour = (hour) => {
    if (hour === 0) return '12am';
    if (hour === 12) return '12pm';
    if (hour < 12) return `${hour}am`;
    return `${hour - 12}pm`;
  };

  return (
    <div className="w-full">
      <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-main)' }}>
        {title}
      </h3>
      
      <div className="overflow-x-auto">
        <div className="inline-block min-w-full">
          {/* Hours header */}
          <div className="flex mb-1">
            <div className="w-10 flex-shrink-0" /> {/* Empty corner */}
            {HOURS.filter((_, i) => i % 3 === 0).map((hour) => (
              <div 
                key={hour} 
                className="flex-1 text-center text-xs"
                style={{ color: 'var(--text-soft)', minWidth: '40px' }}
              >
                {formatHour(hour)}
              </div>
            ))}
          </div>

          {/* Grid */}
          {DAYS.map((day, dayIndex) => (
            <div key={day} className="flex items-center mb-1">
              {/* Day label */}
              <div 
                className="w-10 flex-shrink-0 text-xs font-medium pr-2 text-right"
                style={{ color: 'var(--text-soft)' }}
              >
                {day}
              </div>
              
              {/* Hour cells */}
              <div className="flex flex-1 gap-0.5">
                {HOURS.map((hour) => {
                  const value = getCell(dayIndex, hour);
                  const cellColor = getColor(value);
                  const isHighActivity = value / maxValue > 0.7;
                  
                  return (
                    <motion.div
                      key={`${day}-${hour}`}
                      className="relative group"
                      style={{ minWidth: '13px', flex: 1 }}
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ 
                        delay: (dayIndex * 24 + hour) * 0.002,
                        duration: 0.3 
                      }}
                    >
                      <div
                        className="h-6 rounded-sm cursor-pointer transition-all duration-200 hover:scale-110 hover:z-10"
                        style={{
                          backgroundColor: cellColor,
                          boxShadow: isHighActivity ? `0 0 8px ${colors.glow}` : 'none',
                        }}
                      />
                      
                      {/* Tooltip */}
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 
                        opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                        <div className="px-2 py-1 rounded text-xs whitespace-nowrap"
                          style={{
                            backgroundColor: 'var(--bg-card)',
                            border: '1px solid var(--border-light)',
                            color: 'var(--text-main)',
                          }}
                        >
                          <p className="font-semibold">{day} {formatHour(hour)}</p>
                          <p style={{ color: colors.high }}>{value} detections</p>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Legend */}
          <div className="flex items-center justify-end mt-4 gap-2">
            <span className="text-xs" style={{ color: 'var(--text-soft)' }}>Less</span>
            <div className="flex gap-1">
              {[0.1, 0.3, 0.5, 0.7, 1].map((opacity, idx) => (
                <div
                  key={idx}
                  className="w-4 h-4 rounded-sm"
                  style={{
                    backgroundColor: `rgba(0, 255, 255, ${opacity})`,
                    boxShadow: opacity > 0.5 ? `0 0 6px ${colors.glow}` : 'none',
                  }}
                />
              ))}
            </div>
            <span className="text-xs" style={{ color: 'var(--text-soft)' }}>More</span>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Compact version for smaller spaces
 */
export const CompactHeatmap = ({ data = null, colorScheme = 'cyan' }) => {
  const heatmapData = useMemo(() => data || generateSampleData(), [data]);
  const maxValue = useMemo(() => Math.max(...heatmapData.map(d => d.value), 1), [heatmapData]);

  const getCell = (day, hour) => {
    const cell = heatmapData.find(d => d.day === day && d.hour === hour);
    return cell ? cell.value : 0;
  };

  const getColor = (value) => {
    const normalized = value / maxValue;
    const alpha = Math.max(0.1, normalized);
    return `rgba(0, 255, 255, ${alpha})`;
  };

  // Show only work hours (7am - 7pm)
  const workHours = Array.from({ length: 12 }, (_, i) => i + 7);

  return (
    <div className="flex gap-0.5">
      {DAYS.slice(1, 6).map((day, dayIndex) => ( // Mon-Fri only
        <div key={day} className="flex flex-col gap-0.5">
          {workHours.map((hour) => (
            <div
              key={`${day}-${hour}`}
              className="w-3 h-3 rounded-sm"
              style={{
                backgroundColor: getColor(getCell(dayIndex + 1, hour)),
              }}
              title={`${day} ${hour}:00 - ${getCell(dayIndex + 1, hour)} detections`}
            />
          ))}
        </div>
      ))}
    </div>
  );
};

export default PeakHoursHeatmap;
