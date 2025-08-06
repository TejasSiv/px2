import React from 'react';
import { motion } from 'framer-motion';
import { BoltIcon } from '@heroicons/react/24/outline';

interface BatteryIndicatorProps {
  level: number;
  voltage?: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  showVoltage?: boolean;
  className?: string;
}

const BatteryIndicator: React.FC<BatteryIndicatorProps> = ({
  level,
  voltage,
  size = 'md',
  showLabel = false,
  showVoltage = false,
  className = ''
}) => {
  const getBatteryColor = (percentage: number) => {
    if (percentage > 70) return '#238636'; // Green
    if (percentage > 30) return '#d29922'; // Amber
    if (percentage > 15) return '#da3633'; // Red
    return '#f85149'; // Critical red
  };

  const getBatteryWidth = () => {
    switch (size) {
      case 'sm': return 'w-12';
      case 'lg': return 'w-20';
      default: return 'w-16';
    }
  };

  const getBatteryHeight = () => {
    switch (size) {
      case 'sm': return 'h-6';
      case 'lg': return 'h-10';
      default: return 'h-8';
    }
  };

  const getTextSize = () => {
    switch (size) {
      case 'sm': return 'text-xs';
      case 'lg': return 'text-base';
      default: return 'text-sm';
    }
  };

  const color = getBatteryColor(level);
  const isLow = level < 30;
  const isCritical = level < 15;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex items-center gap-1">
        {/* Battery Icon */}
        <div className="relative">
          <div 
            className={`${getBatteryWidth()} ${getBatteryHeight()} border-2 rounded-sm relative overflow-hidden`}
            style={{ borderColor: color }}
          >
            {/* Battery Fill */}
            <motion.div
              className="h-full rounded-sm"
              style={{ backgroundColor: color }}
              initial={{ width: 0 }}
              animate={{ width: `${Math.max(level, 0)}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
            
            {/* Low battery pulse effect */}
            {isCritical && (
              <motion.div
                className="absolute inset-0 bg-red-500"
                animate={{ opacity: [0.3, 0.7, 0.3] }}
                transition={{ duration: 1, repeat: Infinity }}
              />
            )}
          </div>
          
          {/* Battery Terminal */}
          <div 
            className={`absolute -right-1 top-1/2 transform -translate-y-1/2 w-1 bg-current rounded-r-sm ${
              size === 'sm' ? 'h-2' : size === 'lg' ? 'h-4' : 'h-3'
            }`}
            style={{ color: color }}
          />
          
          {/* Low battery warning icon */}
          {isLow && (
            <div className="absolute -top-1 -right-1">
              <BoltIcon 
                className={`${size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} text-red-500`}
              />
            </div>
          )}
        </div>

        {/* Percentage Label */}
        {showLabel && (
          <span 
            className={`font-mono font-semibold ${getTextSize()}`}
            style={{ color }}
          >
            {level.toFixed(0)}%
          </span>
        )}
      </div>

      {/* Voltage Display */}
      {showVoltage && voltage && (
        <div className={`text-text-secondary ${getTextSize()}`}>
          <span className="font-mono">{voltage.toFixed(1)}V</span>
        </div>
      )}

      {/* Status Text */}
      {showLabel && size !== 'sm' && (
        <div className={`${getTextSize()} text-text-secondary`}>
          {isCritical ? 'Critical' : isLow ? 'Low' : level > 80 ? 'Excellent' : 'Good'}
        </div>
      )}
    </div>
  );
};

export default BatteryIndicator;