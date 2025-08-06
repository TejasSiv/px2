import React from 'react';
import { motion } from 'framer-motion';
import { 
  Battery0Icon as BoltIcon, 
  ExclamationTriangleIcon, 
  CheckCircleIcon
} from '@heroicons/react/24/outline';

interface FleetSummaryProps {
  stats: {
    total: number;
    active: number;
    charging: number;
    maintenance: number;
    idle: number;
    lowBattery: number;
    alerts: number;
    avgBattery: number;
  };
}

const FleetSummary: React.FC<FleetSummaryProps> = ({ stats }) => {
  const getBatteryColor = (percentage: number) => {
    if (percentage > 70) return '#238636';
    if (percentage > 30) return '#d29922';
    return '#da3633';
  };

  const summaryItems = [
    {
      label: 'Total Drones',
      value: stats.total,
      color: '#8b949e',
      icon: null,
    },
    {
      label: 'Active',
      value: stats.active,
      color: '#238636',
      icon: CheckCircleIcon,
    },
    {
      label: 'Avg Battery',
      value: `${stats.avgBattery.toFixed(0)}%`,
      color: getBatteryColor(stats.avgBattery),
      icon: BoltIcon,
    },
    {
      label: 'Alerts',
      value: stats.alerts,
      color: stats.alerts > 0 ? '#d29922' : '#8b949e',
      icon: ExclamationTriangleIcon,
      highlight: stats.alerts > 0,
    },
  ];

  return (
    <div className="grid grid-cols-4 gap-4">
      {summaryItems.map((item, index) => (
        <motion.div
          key={item.label}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: index * 0.1 }}
          className={`text-center p-3 rounded-lg ${
            item.highlight ? 'bg-dark-tertiary border border-status-warning/30' : 'bg-dark-tertiary'
          }`}
        >
          {item.icon && (
            <div className="flex justify-center mb-1">
              <item.icon className="w-4 h-4" style={{ color: item.color }} />
            </div>
          )}
          <div 
            className="text-xl font-bold"
            style={{ color: item.color }}
          >
            {item.value}
          </div>
          <div className="text-xs text-text-secondary">{item.label}</div>
        </motion.div>
      ))}
    </div>
  );
};

export default FleetSummary;