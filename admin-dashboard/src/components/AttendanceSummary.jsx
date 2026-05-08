import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FiDownload, FiCalendar, FiClock, FiMapPin, FiActivity } from 'react-icons/fi';
import { studentAPI, teacherAPI } from '../api/api';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const fmt = (mins) => {
  if (!mins) return '0m';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

const fmtTime = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const fmtDate = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const MONTHS = [
  'All Time', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export default function AttendanceSummary({ personId, personType, personName, isDarkMode }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [logPage, setLogPage] = useState(0);
  const PAGE_SIZE = 10;

  const card = isDarkMode
    ? { background: 'rgba(15,23,42,0.85)', border: '1px solid rgba(129,140,248,0.2)', color: '#c0f0f0' }
    : { background: '#ffffff', border: '1px solid #e5e7eb', color: '#111827' };

  const accent = isDarkMode ? '#818cf8' : '#6365ba';

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const monthParam = selectedMonth ? `${selectedYear}-${String(selectedMonth).padStart(2, '0')}` : undefined;
      const res = personType === 'STUDENT'
        ? await studentAPI.getAttendanceSummary(personId, monthParam)
        : await teacherAPI.getAttendanceSummary(personId, monthParam);
      setData(res.data);
    } catch (e) {
      console.error('Failed to load attendance summary', e);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSummary(); }, [personId, selectedMonth, selectedYear]);

  const downloadPDF = () => {
    if (!data) return;
    const doc = new jsPDF();
    const { person, summary, monthlySummary, zoneBreakdown, logs } = data;

    // Header
    doc.setFillColor(99, 101, 186);
    doc.rect(0, 0, 210, 28, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('IntelliSight — Attendance Report', 14, 12);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`${person.type}: ${person.Name}  |  Generated: ${new Date().toLocaleDateString()}`, 14, 22);

    doc.setTextColor(30, 30, 30);
    let y = 36;

    // Stats row
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Summary', 14, y); y += 6;
    autoTable(doc, {
      startY: y,
      head: [['Total Visits', 'Total Time', 'Zones Visited', 'First Seen', 'Last Seen']],
      body: [[
        summary.totalVisits,
        fmt(summary.totalMinutes),
        summary.uniqueZones,
        fmtDate(summary.firstSeen),
        fmtDate(summary.lastSeen),
      ]],
      headStyles: { fillColor: [99, 101, 186] },
      styles: { fontSize: 9 },
    });
    y = doc.lastAutoTable.finalY + 8;

    // Monthly summary
    if (monthlySummary.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.text('Monthly Breakdown', 14, y); y += 4;
      autoTable(doc, {
        startY: y,
        head: [['Month', 'Visits', 'Total Time', 'Avg per Visit']],
        body: monthlySummary.map((m) => [
          m.month,
          m.visits,
          fmt(m.totalMinutes),
          fmt(m.visits ? Math.round(m.totalMinutes / m.visits) : 0),
        ]),
        headStyles: { fillColor: [99, 101, 186] },
        styles: { fontSize: 9 },
      });
      y = doc.lastAutoTable.finalY + 8;
    }

    // Zone breakdown
    if (zoneBreakdown.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.text('Zone Breakdown', 14, y); y += 4;
      autoTable(doc, {
        startY: y,
        head: [['Zone', 'Visits', 'Total Time']],
        body: zoneBreakdown.map((z) => [z.zoneName, z.visits, fmt(z.totalMinutes)]),
        headStyles: { fillColor: [99, 101, 186] },
        styles: { fontSize: 9 },
      });
      y = doc.lastAutoTable.finalY + 8;
    }

    // Detailed log
    if (logs.length > 0) {
      if (y > 230) { doc.addPage(); y = 20; }
      doc.setFont('helvetica', 'bold');
      doc.text('Detailed Log', 14, y); y += 4;
      autoTable(doc, {
        startY: y,
        head: [['Date', 'Zone', 'Entry', 'Exit', 'Duration']],
        body: logs.map((l) => [
          l.date,
          l.zoneName,
          fmtTime(l.entryTime),
          fmtTime(l.exitTime),
          fmt(l.duration),
        ]),
        headStyles: { fillColor: [99, 101, 186] },
        styles: { fontSize: 8 },
        alternateRowStyles: { fillColor: [245, 245, 255] },
      });
    }

    const label = selectedMonth
      ? `${MONTHS[selectedMonth]}_${selectedYear}`
      : 'AllTime';
    doc.save(`${personName.replace(/\s+/g, '_')}_Attendance_${label}.pdf`);
  };

  const pagedLogs = data ? data.logs.slice(logPage * PAGE_SIZE, (logPage + 1) * PAGE_SIZE) : [];
  const totalPages = data ? Math.ceil(data.logs.length / PAGE_SIZE) : 0;

  const years = [];
  const curYear = new Date().getFullYear();
  for (let y = curYear; y >= curYear - 4; y--) years.push(y);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="rounded-2xl p-6 mt-6"
      style={{ ...card, boxShadow: isDarkMode ? '0 10px 40px rgba(0,0,0,0.5)' : '0 4px 12px rgba(0,0,0,0.08)' }}
    >
      {/* Section header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h2 className="text-2xl font-bold flex items-center gap-2" style={{ color: accent }}>
          <FiActivity /> Attendance Summary
        </h2>

        <div className="flex flex-wrap items-center gap-3">
          {/* Year selector */}
          <select
            value={selectedYear}
            onChange={(e) => { setSelectedYear(Number(e.target.value)); setLogPage(0); }}
            className="px-3 py-2 rounded-lg text-sm font-medium outline-none"
            style={{ background: isDarkMode ? 'rgba(255,255,255,0.07)' : '#f3f4f6', color: card.color, border: card.border }}
          >
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>

          {/* Month selector */}
          <select
            value={selectedMonth}
            onChange={(e) => { setSelectedMonth(e.target.value); setLogPage(0); }}
            className="px-3 py-2 rounded-lg text-sm font-medium outline-none"
            style={{ background: isDarkMode ? 'rgba(255,255,255,0.07)' : '#f3f4f6', color: card.color, border: card.border }}
          >
            <option value="">All Months</option>
            {MONTHS.slice(1).map((m, i) => (
              <option key={i + 1} value={i + 1}>{m}</option>
            ))}
          </select>

          {/* Download PDF */}
          <button
            onClick={downloadPDF}
            disabled={!data || data.logs.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: accent, color: '#fff' }}
          >
            <FiDownload size={15} /> Download PDF
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2" style={{ borderColor: accent }} />
        </div>
      ) : !data || data.logs.length === 0 ? (
        <p className="text-center py-10 text-sm" style={{ color: isDarkMode ? '#94a3b8' : '#6b7280' }}>
          No attendance records found{selectedMonth ? ` for ${MONTHS[selectedMonth]} ${selectedYear}` : ''}.
        </p>
      ) : (
        <>
          {/* Stats cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            {[
              { icon: FiActivity, label: 'Total Visits', value: data.summary.totalVisits },
              { icon: FiClock, label: 'Total Time', value: fmt(data.summary.totalMinutes) },
              { icon: FiMapPin, label: 'Zones', value: data.summary.uniqueZones },
              { icon: FiCalendar, label: 'Last Seen', value: fmtDate(data.summary.lastSeen) },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="rounded-xl p-4 text-center"
                style={{ background: isDarkMode ? 'rgba(129,140,248,0.08)' : '#f5f7ff', border: `1px solid ${isDarkMode ? 'rgba(129,140,248,0.2)' : '#e0e7ff'}` }}>
                <Icon className="mx-auto mb-2" size={20} style={{ color: accent }} />
                <p className="text-xs font-medium mb-1" style={{ color: isDarkMode ? '#94a3b8' : '#6b7280' }}>{label}</p>
                <p className="text-lg font-bold" style={{ color: card.color }}>{value}</p>
              </div>
            ))}
          </div>

          {/* Monthly breakdown */}
          {data.monthlySummary.length > 0 && (
            <div className="mb-6">
              <h3 className="text-base font-semibold mb-3" style={{ color: accent }}>Monthly Breakdown</h3>
              <div className="overflow-x-auto rounded-xl" style={{ border: card.border }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: isDarkMode ? 'rgba(129,140,248,0.12)' : '#eef2ff' }}>
                      {['Month', 'Visits', 'Total Time', 'Avg per Visit'].map((h) => (
                        <th key={h} className="text-left px-4 py-3 font-semibold" style={{ color: accent }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.monthlySummary.map((m) => (
                      <tr key={m.month} style={{ borderTop: card.border }}>
                        <td className="px-4 py-3 font-medium" style={{ color: card.color }}>{m.month}</td>
                        <td className="px-4 py-3" style={{ color: card.color }}>{m.visits}</td>
                        <td className="px-4 py-3" style={{ color: card.color }}>{fmt(m.totalMinutes)}</td>
                        <td className="px-4 py-3" style={{ color: card.color }}>
                          {fmt(m.visits ? Math.round(m.totalMinutes / m.visits) : 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Zone breakdown */}
          {data.zoneBreakdown.length > 0 && (
            <div className="mb-6">
              <h3 className="text-base font-semibold mb-3" style={{ color: accent }}>Zone Breakdown</h3>
              <div className="flex flex-wrap gap-3">
                {data.zoneBreakdown.map((z) => (
                  <div key={z.zoneName} className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium"
                    style={{ background: isDarkMode ? 'rgba(129,140,248,0.1)' : '#eef2ff', border: `1px solid ${isDarkMode ? 'rgba(129,140,248,0.3)' : '#c7d2fe'}`, color: card.color }}>
                    <FiMapPin size={13} style={{ color: accent }} />
                    <span style={{ color: accent }}>{z.zoneName}</span>
                    <span className="text-xs" style={{ color: isDarkMode ? '#94a3b8' : '#6b7280' }}>
                      {z.visits} visits · {fmt(z.totalMinutes)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Detailed log */}
          <div>
            <h3 className="text-base font-semibold mb-3" style={{ color: accent }}>
              Detailed Log <span className="text-xs font-normal" style={{ color: isDarkMode ? '#94a3b8' : '#6b7280' }}>({data.logs.length} records)</span>
            </h3>
            <div className="overflow-x-auto rounded-xl" style={{ border: card.border }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: isDarkMode ? 'rgba(129,140,248,0.12)' : '#eef2ff' }}>
                    {['Date', 'Zone', 'Entry', 'Exit', 'Duration'].map((h) => (
                      <th key={h} className="text-left px-4 py-3 font-semibold" style={{ color: accent }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pagedLogs.map((l) => (
                    <tr key={l.log_id} style={{ borderTop: card.border }}>
                      <td className="px-4 py-3 font-medium" style={{ color: card.color }}>{l.date}</td>
                      <td className="px-4 py-3" style={{ color: card.color }}>{l.zoneName}</td>
                      <td className="px-4 py-3" style={{ color: card.color }}>{fmtTime(l.entryTime)}</td>
                      <td className="px-4 py-3" style={{ color: l.exitTime ? card.color : (isDarkMode ? '#fbbf24' : '#d97706') }}>
                        {fmtTime(l.exitTime)}
                      </td>
                      <td className="px-4 py-3" style={{ color: card.color }}>{fmt(l.duration)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-3 text-sm">
                <span style={{ color: isDarkMode ? '#94a3b8' : '#6b7280' }}>
                  Page {logPage + 1} of {totalPages}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setLogPage((p) => Math.max(0, p - 1))}
                    disabled={logPage === 0}
                    className="px-3 py-1 rounded-lg font-medium disabled:opacity-40"
                    style={{ background: isDarkMode ? 'rgba(129,140,248,0.1)' : '#eef2ff', color: accent, border: `1px solid ${isDarkMode ? 'rgba(129,140,248,0.3)' : '#c7d2fe'}` }}
                  >
                    Prev
                  </button>
                  <button
                    onClick={() => setLogPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={logPage >= totalPages - 1}
                    className="px-3 py-1 rounded-lg font-medium disabled:opacity-40"
                    style={{ background: isDarkMode ? 'rgba(129,140,248,0.1)' : '#eef2ff', color: accent, border: `1px solid ${isDarkMode ? 'rgba(129,140,248,0.3)' : '#c7d2fe'}` }}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </motion.div>
  );
}
