import React from 'react';
import {
  BoltIcon,
  ExclamationTriangleIcon,
  ShieldExclamationIcon
} from '@heroicons/react/24/outline';

interface BatteryStatusProps {
  level: number;
  voltage?: number;
  inFlight?: boolean;
  status?: string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  showVoltage?: boolean;
}

const BatteryStatus: React.FC<BatteryStatusProps> = ({
  level,
  voltage,
  inFlight = false,
  size = 'md',
  showLabel = true,
  showVoltage = false
}) => {
  const getBatteryColor = (level: number, inFlight: boolean) => {
    if (level <= 10) return 'text-red-400 bg-red-500';
    if (level <= 15) return inFlight ? 'text-red-400 bg-red-500' : 'text-orange-400 bg-orange-500';
    if (level <= 25) return 'text-orange-400 bg-orange-500';
    if (level <= 35) return 'text-yellow-400 bg-yellow-500';
    return 'text-green-400 bg-green-500';
  };

  const getBatteryWarning = (level: number) => {
    if (level <= 10) return { icon: ExclamationTriangleIcon, text: 'EMERGENCY', severe: true };
    if (level <= 15) return { icon: ExclamationTriangleIcon, text: 'CRITICAL', severe: true };
    if (level <= 25) return { icon: ShieldExclamationIcon, text: 'LOW', severe: false };
    if (level <= 35) return { icon: BoltIcon, text: 'MONITOR', severe: false };
    return null;
  };

  const getSizeClasses = (size: string) => {
    switch (size) {
      case 'sm':
        return {
          battery: 'w-6 h-3',
          tip: 'w-0.5 h-1.5',
          text: 'text-xs',
          icon: 'w-3 h-3'
        };
      case 'lg':
        return {
          battery: 'w-12 h-6',
          tip: 'w-1 h-3',
          text: 'text-base',
          icon: 'w-5 h-5'
        };
      default:
        return {
          battery: 'w-8 h-4',
          tip: 'w-0.5 h-2',
          text: 'text-sm',
          icon: 'w-4 h-4'
        };
    }
  };

  const colorClasses = getBatteryColor(level, inFlight);
  const warning = getBatteryWarning(level);
  const sizeClasses = getSizeClasses(size);
  
  const fillWidth = Math.max(0, Math.min(100, level));

  return (
    <div className="flex items-center gap-2">
      {/* Battery Icon */}
      <div className="relative flex items-center">
        {/* Battery Body */}
        <div className={`${sizeClasses.battery} border border-dark-border rounded-sm bg-dark-tertiary relative overflow-hidden`}>
          {/* Fill */}
          <div 
            className={`h-full ${colorClasses} transition-all duration-300 ease-in-out`}
            style={{ width: `${fillWidth}%` }}
          />
          
          {/* Low battery animation */}
          {level <= 15 && (
            <div className="absolute inset-0 bg-red-400 opacity-20 animate-pulse" />
          )}
        </div>
        
        {/* Battery Tip */}
        <div className={`${sizeClasses.tip} bg-dark-border rounded-r-sm ml-0.5`} />
      </div>

      {/* Status Text and Warning */}
      <div className="flex items-center gap-1">
        {showLabel && (
          <span className={`${sizeClasses.text} font-medium ${colorClasses.split(' ')[0]}`}>
            {level}%
          </span>
        )}
        
        {showVoltage && voltage && (
          <span className={`${sizeClasses.text} text-text-secondary`}>
            ({voltage.toFixed(1)}V)
          </span>
        )}
        
        {warning && (
          <div className="flex items-center gap-1">
            <warning.icon 
              className={`${sizeClasses.icon} ${warning.severe ? 'text-red-400' : 'text-orange-400'}`} 
            />
            <span 
              className={`text-xs font-medium ${warning.severe ? 'text-red-400' : 'text-orange-400'}`}
            >
              {warning.text}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default BatteryStatus;