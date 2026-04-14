import React, { useMemo } from 'react';
import TimetableCell from './TimetableCell';

const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI'];

function parseTime(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return h + m / 60; // Returns fractional hours (e.g. 8.5 for 8:30)
}

function fmtHour12(hour) {
  const d = new Date();
  d.setHours(Math.floor(hour), 0, 0, 0);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

export default function TimetableGrid({ grid, mode }) {
  // 1. Determine min and max hours across all slots to build columns
  const { minHour, maxHour } = useMemo(() => {
    let min = 8;
    let max = 16; // default 8am to 4pm
    
    let hasData = false;
    DAYS.forEach(day => {
      const dayData = grid?.[day];
      const cells = dayData?.cells || dayData?.slots || [];
      cells.forEach(c => {
        const start = parseTime(c.slot.StartTime);
        const end = parseTime(c.slot.EndTime);
        if (!hasData) {
          min = Math.floor(start);
          max = Math.ceil(end);
          hasData = true;
        } else {
          min = Math.min(min, Math.floor(start));
          max = Math.max(max, Math.ceil(end));
        }
      });
    });
    
    // Safety boundaries
    if (min < 0) min = 0;
    if (max > 24) max = 24;
    if (max <= min) max = min + 8;
    
    return { minHour: min, maxHour: max };
  }, [grid]);

  // Array of hours for table headers
  const hours = [];
  for (let h = minHour; h < maxHour; h++) {
    hours.push(h);
  }

  // 2. Build row data, calculating colSpan and finding 'Free' slots
  const rows = useMemo(() => {
    return DAYS.map(day => {
      const dayData = grid?.[day];
      const date = dayData?.date;
      const rawCells = dayData?.cells || dayData?.slots || [];
      
      // Sort slots by start time
      const sortedCells = [...rawCells].sort((a, b) => parseTime(a.slot.StartTime) - parseTime(b.slot.StartTime));
      
      const rowSlots = [];
      let currentHour = minHour;
      
      sortedCells.forEach(cell => {
        const startHour = parseTime(cell.slot.StartTime);
        const endHour = parseTime(cell.slot.EndTime);
        
        // If there's a gap before this slot, fill it with a 'Free' slot
        if (startHour > currentHour) {
          const gap = Math.round(startHour - currentHour);
          if (gap > 0) {
            rowSlots.push({ type: 'free', colSpan: gap, start: currentHour, end: currentHour + gap });
            currentHour += gap;
          }
        }
        
        // Add the actual slot. Duration in hours determines colspan
        let duration = Math.round(endHour - startHour);
        if (duration < 1) duration = 1; 

        rowSlots.push({ 
          type: 'class', 
          colSpan: duration, 
          data: cell 
        });
        
        currentHour += duration;
      });
      
      // Fill the end of the day with 'Free' slots if needed
      if (currentHour < maxHour) {
        const gap = maxHour - currentHour;
        rowSlots.push({ type: 'free', colSpan: gap, start: currentHour, end: maxHour });
      }
      
      return { day, date, slots: rowSlots };
    });
  }, [grid, minHour, maxHour]);

  if (!grid) {
    return (
      <div className="flex items-center justify-center h-32 text-slate-400 dark:text-slate-500 text-sm">
        No timetable data available for this selection.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto w-full pb-4 scrollbar-thin">
      <table className="min-w-full border-collapse">
        <thead>
          <tr>
            <th className="w-24 pb-2 text-left sticky left-0 bg-white dark:bg-slate-800 z-10">
              <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider pl-4">
                Day
              </span>
            </th>
            {hours.map(hour => (
              <th key={hour} className="pb-2 px-1 text-center min-w-[200px]" style={{ width: '220px' }}>
                <p className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                  {fmtHour12(hour)}
                </p>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.day}>
              {/* Day label */}
              <td className="pr-4 align-middle border-r border-slate-200 dark:border-slate-700/50 sticky left-0 bg-white dark:bg-slate-800 z-10 w-24">
                <div className="text-left font-semibold pl-4 pt-2 pb-2">
                  <div className="text-sm text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                    {row.day} 
                  </div>
                  {row.date && (
                    <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                      {new Date(row.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                  )}
                </div>
              </td>
              {/* Slots */}
              {row.slots.map((slot, idx) => {
                if (slot.type === 'free') {
                  return (
                    <td key={`free-${i}-${idx}`} colSpan={slot.colSpan} className="align-middle p-0 border border-slate-200 dark:border-slate-700/50">
                      <div className="h-28 w-full bg-slate-50/50 dark:bg-slate-800/20 flex flex-col items-center justify-center">
                        <span className="text-xs italic text-slate-400 dark:text-slate-500">Free</span>
                      </div>
                    </td>
                  );
                } else {
                  return (
                    <td key={`class-${slot.data.slot.Slot_ID}-${idx}`} colSpan={slot.colSpan} className="align-middle p-0 border border-slate-200 dark:border-slate-700/50">
                       <div className="h-28 w-full flex">
                         <TimetableCell
                            slot={slot.data.slot}
                            attendance={slot.data.attendance}
                            teacherAttendance={slot.data.teacherAttendance}
                            mode={mode}
                         />
                       </div>
                    </td>
                  );
                }
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
