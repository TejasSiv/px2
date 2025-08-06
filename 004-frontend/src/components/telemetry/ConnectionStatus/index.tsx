import React from 'react';
import { motion } from 'framer-motion';
import { WifiIcon } from '@heroicons/react/24/outline';

interface ConnectionStatusProps {
  strength: number; // Signal strength in dBm
  quality?: 'excellent' | 'good' | 'poor' | 'very_poor';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  showStrength?: boolean;
  className?: string;
}

const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  strength,
  quality,
  size = 'md',
  showLabel = false,
  showStrength = false,
  className = ''
}) => {
  const getConnectionQuality = (signalStrength: number) => {
    if (signalStrength > -50) return { level: 'Excellent', color: '#238636', bars: 4 };
    if (signalStrength > -70) return { level: 'Good', color: '#d29922', bars: 3 };
    if (signalStrength > -85) return { level: 'Fair', color: '#d29922', bars: 2 };
    if (signalStrength > -95) return { level: 'Poor', color: '#da3633', bars: 1 };
    return { level: 'Very Poor', color: '#f85149', bars: 0 };
  };

  const getBarHeight = (barIndex: number) => {
    switch (size) {
      case 'sm':
        return barIndex === 0 ? 'h-2' : barIndex === 1 ? 'h-3' : barIndex === 2 ? 'h-4' : 'h-5';
      case 'lg':
        return barIndex === 0 ? 'h-4' : barIndex === 1 ? 'h-6' : barIndex === 2 ? 'h-8' : 'h-10';
      default:
        return barIndex === 0 ? 'h-3' : barIndex === 1 ? 'h-4' : barIndex === 2 ? 'h-5' : 'h-6';
    }
  };

  const getBarWidth = () => {
    switch (size) {
      case 'sm': return 'w-0.5';
      case 'lg': return 'w-1';
      default: return 'w-0.5';
    }
  };

  const getTextSize = () => {
    switch (size) {
      case 'sm': return 'text-xs';
      case 'lg': return 'text-base';
      default: return 'text-sm';
    }
  };

  const connection = getConnectionQuality(strength);
  const qualityOverride = quality ? {
    excellent: { level: 'Excellent', color: '#238636', bars: 4 },
    good: { level: 'Good', color: '#238636', bars: 3 },
    poor: { level: 'Poor', color: '#da3633', bars: 2 },
    very_poor: { level: 'Very Poor', color: '#f85149', bars: 1 }
  }[quality] : null;

  const displayConfig = qualityOverride || connection;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Signal Bars */}
      <div className="flex items-end gap-0.5">
        {[0, 1, 2, 3].map((barIndex) => (
          <motion.div
            key={barIndex}
            className={`${getBarWidth()} ${getBarHeight(barIndex)} rounded-sm`}
            style={{ 
              backgroundColor: barIndex < displayConfig.bars ? displayConfig.color : '#30363d' 
            }}
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ duration: 0.3, delay: barIndex * 0.1 }}
          />
        ))}
      </div>

      {/* Signal Quality Label */}
      {showLabel && (
        <span 
          className={`font-medium ${getTextSize()}`}
          style={{ color: displayConfig.color }}
        >
          {displayConfig.level}
        </span>
      )}

      {/* Signal Strength Value */}
      {showStrength && (
        <div className={`text-text-secondary ${getTextSize()}`}>
          <span className="font-mono">{strength}dBm</span>
        </div>
      )}

      {/* Connection Icon for very poor signal */}
      {displayConfig.bars === 0 && (
        <div className="relative">
          <WifiIcon className={`${size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} text-red-500`} />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-0.5 h-full bg-red-500 rotate-45"></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConnectionStatus;