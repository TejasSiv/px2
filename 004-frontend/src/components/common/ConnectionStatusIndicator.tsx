import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  WifiIcon, 
  ExclamationTriangleIcon, 
  ArrowPathIcon,
  XCircleIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import { ConnectionState } from '@/services/websocket';

interface ConnectionStatusIndicatorProps {
  connectionState: ConnectionState;
  isConnected: boolean;
  error?: string;
  className?: string;
}

const ConnectionStatusIndicator: React.FC<ConnectionStatusIndicatorProps> = ({
  connectionState,
  error,
  className = ''
}) => {
  const getStatusConfig = () => {
    switch (connectionState) {
      case ConnectionState.CONNECTED:
        return {
          icon: CheckCircleIcon,
          color: '#238636',
          bgColor: '#238636',
          text: 'Connected',
          description: 'Real-time telemetry active',
          pulse: false,
        };
      case ConnectionState.CONNECTING:
        return {
          icon: ArrowPathIcon,
          color: '#d29922',
          bgColor: '#d29922',
          text: 'Connecting',
          description: 'Establishing connection...',
          pulse: true,
        };
      case ConnectionState.RECONNECTING:
        return {
          icon: ArrowPathIcon,
          color: '#d29922',
          bgColor: '#d29922',
          text: 'Reconnecting',
          description: 'Attempting to reconnect...',
          pulse: true,
        };
      case ConnectionState.ERROR:
        return {
          icon: ExclamationTriangleIcon,
          color: '#da3633',
          bgColor: '#da3633',
          text: 'Error',
          description: error || 'Connection failed',
          pulse: false,
        };
      case ConnectionState.DISCONNECTED:
      default:
        return {
          icon: XCircleIcon,
          color: '#8b949e',
          bgColor: '#8b949e',
          text: 'Disconnected',
          description: 'No telemetry connection',
          pulse: false,
        };
    }
  };

  const config = getStatusConfig();
  const StatusIcon = config.icon;

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Status Indicator */}
      <div className="flex items-center gap-2">
        <div className="relative">
          {/* Pulse animation for connecting states */}
          <AnimatePresence>
            {config.pulse && (
              <motion.div
                className="absolute inset-0 rounded-full"
                style={{ backgroundColor: config.color }}
                initial={{ scale: 1, opacity: 0.3 }}
                animate={{ scale: 1.5, opacity: 0 }}
                exit={{ scale: 1, opacity: 0.3 }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  repeatType: 'loop',
                }}
              />
            )}
          </AnimatePresence>

          {/* Main status icon */}
          <motion.div
            className="w-8 h-8 rounded-full border-2 flex items-center justify-center"
            style={{
              backgroundColor: config.bgColor + '20',
              borderColor: config.color,
            }}
            animate={config.pulse ? { rotate: 360 } : {}}
            transition={config.pulse ? { duration: 2, repeat: Infinity, ease: 'linear' } : {}}
          >
            <StatusIcon className="w-4 h-4" style={{ color: config.color }} />
          </motion.div>
        </div>

        {/* Status Text */}
        <div className="text-sm">
          <div className="font-medium" style={{ color: config.color }}>
            {config.text}
          </div>
          <div className="text-text-muted text-xs">
            {config.description}
          </div>
        </div>
      </div>

      {/* Telemetry Service Info */}
      <div className="hidden md:flex items-center gap-1 text-xs text-text-secondary">
        <WifiIcon className="w-3 h-3" />
        <span>ws://localhost:3001/telemetry</span>
      </div>

      {/* Connection Details (on hover/click) */}
      {(connectionState === ConnectionState.ERROR || error) && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="hidden lg:block"
        >
          <div className="bg-dark-tertiary border border-red-800 rounded-lg p-2 max-w-xs">
            <div className="text-xs text-red-300 font-medium mb-1">Connection Error</div>
            <div className="text-xs text-text-secondary">
              {error || 'Unable to connect to telemetry service'}
            </div>
            <div className="text-xs text-text-muted mt-1">
              Check if the telemetry service is running on port 3001
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default ConnectionStatusIndicator;