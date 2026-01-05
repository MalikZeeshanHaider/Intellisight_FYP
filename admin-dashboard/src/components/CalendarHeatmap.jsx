/**
 * Calendar Heatmap Component
 * GitHub-style calendar heatmap showing daily activity
 */

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Generate sample data for the past year
const generateSampleData = () => {
  const data = {};
  const today = new Date();
  
  for (let i = 365; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    
    // Generate realistic patterns (weekdays higher than weekends)
    const dayOfWeek = date.getDay();
    let baseValue = 0;
    
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      baseValue = Math.floor(Math.random() * 80) + 20; // Weekday: 20-100
    } else {
      baseValue = Math.floor(Math.random() * 30); // Weekend: 0-30
    }
    
    data[dateStr] = baseValue;
  }
  
  return data;
};

const CalendarHeatmap = ({
  data = null, // Object with date keys (YYYY-MM-DD) and count values
  title = 'Activity Calendar',
  colorScheme = 'cyan', // cyan, purple, green
  showMonthLabels = true,
  showDayLabels = true,
  showTooltip = true,
}) => {
  const heatmapData = useMemo(() => data || generateSampleData(), [data]);

  // Color schemes
  const colorSchemes = {
    cyan: {
      empty: 'rgba(255, 255, 255, 0.05)',
      levels: [
        'rgba(0, 255, 255, 0.1)',
        'rgba(0, 255, 255, 0.3)',
        'rgba(0, 255, 255, 0.5)',
        'rgba(0, 255, 255, 0.7)',
        'rgba(0, 255, 255, 1)',
      ],
      glow: 'rgba(0, 255, 255, 0.4)',
    },
    purple: {
      empty: 'rgba(255, 255, 255, 0.05)',
      levels: [
        'rgba(168, 85, 247, 0.1)',
        'rgba(168, 85, 247, 0.3)',
        'rgba(168, 85, 247, 0.5)',
        'rgba(168, 85, 247, 0.7)',
        'rgba(168, 85, 247, 1)',
      ],
      glow: 'rgba(168, 85, 247, 0.4)',
    },
    green: {
      empty: 'rgba(255, 255, 255, 0.05)',
      levels: [
        'rgba(16, 185, 129, 0.1)',
        'rgba(16, 185, 129, 0.3)',
        'rgba(16, 185, 129, 0.5)',
        'rgba(16, 185, 129, 0.7)',
        'rgba(16, 185, 129, 1)',
      ],
      glow: 'rgba(16, 185, 129, 0.4)',
    },
  };

  const colors = colorSchemes[colorScheme] || colorSchemes.cyan;

  // Calculate max value for normalization
  const maxValue = useMemo(() => {
    const values = Object.values(heatmapData);
    return Math.max(...values, 1);
  }, [heatmapData]);

  // Get color level based on value
  const getColor = (value) => {
    if (!value || value === 0) return colors.empty;
    const normalized = value / maxValue;
    if (normalized < 0.2) return colors.levels[0];
    if (normalized < 0.4) return colors.levels[1];
    if (normalized < 0.6) return colors.levels[2];
    if (normalized < 0.8) return colors.levels[3];
    return colors.levels[4];
  };

  // Generate calendar weeks
  const weeks = useMemo(() => {
    const result = [];
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 364); // Go back ~1 year
    
    // Adjust to start on Sunday
    const dayOfWeek = startDate.getDay();
    startDate.setDate(startDate.getDate() - dayOfWeek);
    
    let currentDate = new Date(startDate);
    let currentWeek = [];
    
    while (currentDate <= today) {
      const dateStr = currentDate.toISOString().split('T')[0];
      currentWeek.push({
        date: dateStr,
        value: heatmapData[dateStr] || 0,
        dayOfWeek: currentDate.getDay(),
        month: currentDate.getMonth(),
        day: currentDate.getDate(),
      });
      
      if (currentWeek.length === 7) {
        result.push(currentWeek);
        currentWeek = [];
      }
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    if (currentWeek.length > 0) {
      result.push(currentWeek);
    }
    
    return result;
  }, [heatmapData]);

  // Get month labels positions
  const monthLabels = useMemo(() => {
    const labels = [];
    let lastMonth = -1;
    
    weeks.forEach((week, weekIndex) => {
      const firstDay = week[0];
      if (firstDay && firstDay.month !== lastMonth) {
        labels.push({
          month: firstDay.month,
          weekIndex,
        });
        lastMonth = firstDay.month;
      }
    });
    
    return labels;
  }, [weeks]);

  // Calculate totals
  const stats = useMemo(() => {
    const values = Object.values(heatmapData);
    const total = values.reduce((a, b) => a + b, 0);
    const activeDays = values.filter(v => v > 0).length;
    const avgPerDay = Math.round(total / Math.max(activeDays, 1));
    
    return { total, activeDays, avgPerDay };
  }, [heatmapData]);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold" style={{ color: 'var(--text-main)' }}>
          {title}
        </h3>
        <div className="flex items-center gap-4 text-xs">
          <span style={{ color: 'var(--text-soft)' }}>
            Total: <span className="font-bold" style={{ color: colors.levels[4] }}>{stats.total.toLocaleString()}</span>
          </span>
          <span style={{ color: 'var(--text-soft)' }}>
            Active Days: <span className="font-bold" style={{ color: colors.levels[4] }}>{stats.activeDays}</span>
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="inline-block">
          {/* Month labels */}
          {showMonthLabels && (
            <div className="flex mb-1 ml-8">
              {monthLabels.map((label, idx) => (
                <div
                  key={idx}
                  className="text-xs"
                  style={{
                    color: 'var(--text-soft)',
                    marginLeft: `${label.weekIndex * 14 - (idx > 0 ? monthLabels[idx - 1].weekIndex * 14 + 30 : 0)}px`,
                  }}
                >
                  {MONTHS[label.month]}
                </div>
              ))}
            </div>
          )}

          <div className="flex">
            {/* Day labels */}
            {showDayLabels && (
              <div className="flex flex-col gap-0.5 mr-2">
                {DAYS.map((day, idx) => (
                  <div
                    key={day}
                    className="h-3 flex items-center justify-end text-xs pr-1"
                    style={{
                      color: 'var(--text-soft)',
                      opacity: idx % 2 === 1 ? 1 : 0,
                    }}
                  >
                    {day.charAt(0)}
                  </div>
                ))}
              </div>
            )}

            {/* Calendar grid */}
            <div className="flex gap-0.5">
              {weeks.map((week, weekIndex) => (
                <div key={weekIndex} className="flex flex-col gap-0.5">
                  {week.map((day, dayIndex) => {
                    const color = getColor(day.value);
                    const isHighActivity = day.value / maxValue > 0.7;

                    return (
                      <motion.div
                        key={`${weekIndex}-${dayIndex}`}
                        className="w-3 h-3 rounded-sm cursor-pointer relative group"
                        style={{
                          backgroundColor: color,
                          boxShadow: isHighActivity ? `0 0 6px ${colors.glow}` : 'none',
                        }}
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{
                          delay: (weekIndex * 7 + dayIndex) * 0.001,
                          duration: 0.2,
                        }}
                        whileHover={{ scale: 1.3, zIndex: 10 }}
                      >
                        {/* Tooltip */}
                        {showTooltip && (
                          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 
                            opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                            <div
                              className="px-2 py-1 rounded text-xs whitespace-nowrap"
                              style={{
                                backgroundColor: 'var(--bg-card)',
                                border: '1px solid var(--border-light)',
                                color: 'var(--text-main)',
                              }}
                            >
                              <p className="font-semibold">{day.date}</p>
                              <p style={{ color: colors.levels[4] }}>
                                {day.value} {day.value === 1 ? 'detection' : 'detections'}
                              </p>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center justify-end gap-2 mt-4">
            <span className="text-xs" style={{ color: 'var(--text-soft)' }}>Less</span>
            <div className="flex gap-1">
              {[colors.empty, ...colors.levels].map((color, idx) => (
                <div
                  key={idx}
                  className="w-3 h-3 rounded-sm"
                  style={{
                    backgroundColor: color,
                    boxShadow: idx >= 4 ? `0 0 6px ${colors.glow}` : 'none',
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
 * Compact version showing last 3 months
 */
export const CompactCalendarHeatmap = ({ data = null, colorScheme = 'cyan' }) => {
  const heatmapData = useMemo(() => data || generateSampleData(), [data]);
  
  // Get last 90 days
  const days = useMemo(() => {
    const result = [];
    const today = new Date();
    
    for (let i = 89; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      result.push({
        date: dateStr,
        value: heatmapData[dateStr] || 0,
      });
    }
    
    return result;
  }, [heatmapData]);

  const maxValue = Math.max(...days.map(d => d.value), 1);

  const getOpacity = (value) => {
    if (!value) return 0.1;
    return Math.max(0.2, value / maxValue);
  };

  const colorMap = {
    cyan: '#00ffff',
    purple: '#a855f7',
    green: '#10b981',
  };

  const baseColor = colorMap[colorScheme] || colorMap.cyan;

  return (
    <div className="flex flex-wrap gap-0.5" style={{ maxWidth: '360px' }}>
      {days.map((day, idx) => (
        <div
          key={idx}
          className="w-3 h-3 rounded-sm"
          style={{
            backgroundColor: baseColor,
            opacity: getOpacity(day.value),
          }}
          title={`${day.date}: ${day.value} detections`}
        />
      ))}
    </div>
  );
};

export default CalendarHeatmap;
