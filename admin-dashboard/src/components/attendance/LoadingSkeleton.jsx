import React from 'react';

export default function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
            <div className="flex items-center justify-between mb-4">
              <div className="h-10 w-10 rounded-xl bg-slate-200 dark:bg-slate-700" />
              <div className="h-4 w-12 rounded bg-slate-200 dark:bg-slate-700" />
            </div>
            <div className="h-8 w-20 rounded bg-slate-200 dark:bg-slate-700 mb-2" />
            <div className="h-3 w-28 rounded bg-slate-200 dark:bg-slate-700" />
          </div>
        ))}
      </div>

      {/* Timetable Grid */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
        <div className="p-5 border-b border-slate-100 dark:border-slate-700">
          <div className="h-5 w-40 rounded bg-slate-200 dark:bg-slate-700" />
        </div>
        <div className="p-4">
          {/* Day headers */}
          <div className="grid grid-cols-6 gap-2 mb-3">
            <div className="h-8 rounded bg-slate-100 dark:bg-slate-700" />
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-8 rounded bg-slate-200 dark:bg-slate-600" />
            ))}
          </div>
          {/* Rows */}
          {[...Array(5)].map((_, row) => (
            <div key={row} className="grid grid-cols-6 gap-2 mb-2">
              <div className="h-20 rounded bg-slate-100 dark:bg-slate-700" />
              {[...Array(5)].map((_, col) => (
                <div
                  key={col}
                  className="h-20 rounded-xl bg-slate-200 dark:bg-slate-600"
                  style={{ opacity: Math.random() > 0.4 ? 1 : 0.3 }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-5">
        <div className="h-5 w-48 rounded bg-slate-200 dark:bg-slate-700 mb-4" />
        <div className="h-56 rounded-xl bg-slate-100 dark:bg-slate-700" />
      </div>
    </div>
  );
}
