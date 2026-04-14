import React from 'react';
import { motion } from 'framer-motion';

export default function KpiCard({ icon: Icon, label, value, sub, color, trend }) {
  const colorMap = {
    indigo: 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400',
    emerald: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
    amber:   'bg-amber-50  dark:bg-amber-900/30  text-amber-600  dark:text-amber-400',
    rose:    'bg-rose-50   dark:bg-rose-900/30   text-rose-600   dark:text-rose-400',
    sky:     'bg-sky-50    dark:bg-sky-900/30    text-sky-600    dark:text-sky-400',
    violet:  'bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400',
  };

  const ringMap = {
    indigo: 'ring-indigo-100 dark:ring-indigo-800/40',
    emerald: 'ring-emerald-100 dark:ring-emerald-800/40',
    amber:   'ring-amber-100 dark:ring-amber-800/40',
    rose:    'ring-rose-100 dark:ring-rose-800/40',
    sky:     'ring-sky-100 dark:ring-sky-800/40',
    violet:  'ring-violet-100 dark:ring-violet-800/40',
  };

  const cls = colorMap[color] || colorMap.indigo;
  const ring = ringMap[color] || ringMap.indigo;

  return (
    <motion.div
      whileHover={{ scale: 1.025, y: -2 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className={`relative bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm hover:shadow-lg ring-1 ${ring} transition-shadow duration-300 overflow-hidden cursor-default`}
    >
      {/* Decorative orb */}
      <div className={`absolute -top-4 -right-4 w-20 h-20 rounded-full opacity-10 ${cls.split(' ')[0]}`} />

      <div className="relative flex items-start justify-between">
        <div className={`p-2.5 rounded-xl ${cls}`}>
          <Icon size={20} strokeWidth={2} />
        </div>
        {trend !== undefined && (
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
            trend >= 0
              ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
              : 'bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400'
          }`}>
            {trend >= 0 ? '+' : ''}{trend}%
          </span>
        )}
      </div>

      <div className="mt-4">
        <p className="text-2xl font-extrabold text-slate-800 dark:text-white tracking-tight">
          {value}
        </p>
        <p className="text-sm font-semibold text-slate-600 dark:text-slate-300 mt-0.5">{label}</p>
        {sub && (
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{sub}</p>
        )}
      </div>
    </motion.div>
  );
}
