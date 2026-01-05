/**
 * Chart Components Index
 * Export all chart components for easy imports
 */

// Daily Detection Chart (Existing)
export { default as DailyDetectionChart } from './DailyDetectionChart';

// Zone Distribution Pie Chart
export { default as ZoneDistributionPieChart } from './ZoneDistributionPieChart';

// Top Active Students Bar Chart
export { default as TopActiveStudentsChart } from './TopActiveStudentsChart';

// Zone Capacity Gauge Charts
export { default as ZoneCapacityGauge, MiniZoneGauge } from './ZoneCapacityGauge';

// Peak Hours Heatmap
export { default as PeakHoursHeatmap, CompactHeatmap } from './PeakHoursHeatmap';

// Weekly Trends Line Chart
export { 
  default as WeeklyTrendsChart, 
  TrendSparkline, 
  ComparisonTrendsChart 
} from './WeeklyTrendsChart';

/**
 * Chart Types Available:
 * 
 * 1. DailyDetectionChart - ComposedChart (Area + Bar + Line)
 *    Usage: <DailyDetectionChart data={[]} loading={false} />
 * 
 * 2. ZoneDistributionPieChart - Pie Chart
 *    Usage: <ZoneDistributionPieChart data={[{name, value, capacity}]} />
 * 
 * 3. TopActiveStudentsChart - Horizontal Bar Chart
 *    Usage: <TopActiveStudentsChart data={[{name, detections, department}]} topN={5} />
 * 
 * 4. ZoneCapacityGauge - Semi-circle Gauge
 *    Usage: <ZoneCapacityGauge current={25} capacity={50} zoneName="Zone 1" />
 * 
 * 5. MiniZoneGauge - Circular Mini Gauge
 *    Usage: <MiniZoneGauge current={25} capacity={50} />
 * 
 * 6. PeakHoursHeatmap - Activity Heatmap
 *    Usage: <PeakHoursHeatmap data={[{day, hour, value}]} colorScheme="cyan" />
 * 
 * 7. CompactHeatmap - Mini Heatmap
 *    Usage: <CompactHeatmap data={[{day, hour, value}]} />
 * 
 * 8. WeeklyTrendsChart - Multi-line Chart
 *    Usage: <WeeklyTrendsChart data={[{day, detected, recognized, unknown}]} />
 * 
 * 9. TrendSparkline - Mini Sparkline
 *    Usage: <TrendSparkline data={[{value}]} color="#00ffff" />
 * 
 * 10. ComparisonTrendsChart - Comparison Line Chart
 *     Usage: <ComparisonTrendsChart currentData={[]} previousData={[]} />
 */
