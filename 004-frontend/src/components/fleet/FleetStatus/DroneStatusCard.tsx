import React from 'react';
import { motion } from 'framer-motion';
import { 
  Battery0Icon as BoltIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  EyeIcon,
  CheckCircleIcon,
  ShieldExclamationIcon,
  FireIcon,
  ArrowPathIcon,
  QueueListIcon
} from '@heroicons/react/24/outline';
import { DroneData } from '@/types/fleet';
import BatteryIndicator from '@/components/telemetry/BatteryIndicator';

interface DroneStatusCardProps {
  drone: DroneData;
  isSelected: boolean;
  onSelect: () => void;
  onAction?: (droneId: string, action: string) => void;
  index: number;
}

const DroneStatusCard: React.FC<DroneStatusCardProps> = ({
  drone,
  isSelected,
  onSelect,
  onAction,
  index
}) => {
  const getStatusConfig = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
      case 'in_flight':
        return {
          color: '#238636',
          bgColor: '#238636',
          label: 'Active',
          icon: CheckCircleIcon,
        };
      case 'charging':
        return {
          color: '#d29922',
          bgColor: '#d29922',
          label: 'Charging',
          icon: BoltIcon,
        };
      case 'maintenance':
        return {
          color: '#da3633',
          bgColor: '#da3633',
          label: 'Maintenance',
          icon: ExclamationTriangleIcon,
        };
      case 'emergency':
        return {
          color: '#f85149',
          bgColor: '#f85149',
          label: 'Emergency',
          icon: ShieldExclamationIcon,
        };
      case 'idle':
      default:
        return {
          color: '#8b949e',
          bgColor: '#8b949e',
          label: 'Idle',
          icon: ClockIcon,
        };
    }
  };

  const formatTimeAgo = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    
    if (diffSeconds < 60) return `${diffSeconds}s ago`;
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
    return `${Math.floor(diffSeconds / 3600)}h ago`;
  };

  const statusConfig = getStatusConfig(drone.status);
  const StatusIcon = statusConfig.icon;

  const handleAction = (actionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (actionId === 'view') {
      onSelect();
    } else if (onAction) {
      onAction(drone.id, actionId);
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      onClick={onSelect}
      className={`
        relative bg-dark-tertiary rounded-lg p-3 border cursor-pointer transition-all duration-200 hover:bg-dark-hover w-full
        ${isSelected 
          ? 'border-status-active shadow-glow' 
          : 'border-dark-border hover:border-dark-hover'
        }
      `}
    >
      {/* Compact Header Row */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3 flex-1">
          {/* Status Icon - Smaller */}
          <div className="flex-shrink-0 relative">
            <div 
              className="w-8 h-8 rounded-full flex items-center justify-center border"
              style={{ 
                backgroundColor: statusConfig.bgColor + '20',
                borderColor: statusConfig.color 
              }}
            >
              <StatusIcon className="w-4 h-4" style={{ color: statusConfig.color }} />
            </div>
            
            {/* Compact Alert Badge */}
            {drone.alerts && drone.alerts.length > 0 && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-status-warning rounded-full flex items-center justify-center">
                <span className="text-xs font-bold text-white text-[10px]">{drone.alerts.length}</span>
              </div>
            )}
          </div>

          {/* Drone Name & Status */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-text-primary text-sm truncate">{drone.name}</h3>
              <span className="text-text-secondary text-xs font-mono">{drone.id}</span>
            </div>
            <div className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium mt-1`}
                 style={{ 
                   backgroundColor: statusConfig.color + '20', 
                   color: statusConfig.color 
                 }}>
              {statusConfig.label}
            </div>
          </div>
        </div>

        {/* Quick Action - Only View */}
        <button
          onClick={(e) => handleAction('view', e)}
          className="p-1.5 rounded hover:bg-dark-secondary transition-colors flex-shrink-0"
          title="View Details"
          style={{ color: '#1f6feb' }}
        >
          <EyeIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Compact Metrics - Vertical Stack for better spacing */}
      <div className="space-y-2">
        {/* Battery Row */}
        <div className="flex items-center justify-between">
          <span className="text-text-secondary text-xs">Battery</span>
          <div className="flex items-center gap-1">
            <div className="w-16">
              <BatteryIndicator
                level={drone.batteryLevel}
                voltage={drone.batteryVoltage}
                inFlight={['active', 'in_flight'].includes(drone.status)}
                status={drone.status}
                size="sm"
                showVoltage={false}
              />
            </div>
            <span className="text-xs text-text-primary font-mono">{Math.round(drone.batteryLevel)}%</span>
          </div>
        </div>

        {/* Signal Row */}
        <div className="flex items-center justify-between">
          <span className="text-text-secondary text-xs">Signal</span>
          <div className="flex items-center gap-2">
            <div className="flex items-end gap-0.5">
              {[0, 1, 2, 3].map((bar) => (
                <div
                  key={bar}
                  className={`w-0.5 rounded-sm ${
                    bar === 0 ? 'h-2' : bar === 1 ? 'h-3' : bar === 2 ? 'h-4' : 'h-4'
                  }`}
                  style={{ 
                    backgroundColor: drone.signalStrength > -50 - (bar * 20) ? '#238636' : '#30363d'
                  }}
                />
              ))}
            </div>
            <span className="text-xs font-mono text-text-secondary truncate">{Math.round(drone.signalStrength)}dBm</span>
          </div>
        </div>

        {/* Emergency State Row */}
        {drone.emergencyState && !drone.emergencyState.resolved && (
          <div className="flex items-center justify-between bg-red-900/20 border border-red-500/30 rounded p-1.5">
            <div className="flex items-center gap-2">
              <FireIcon className="w-3 h-3 text-red-400 flex-shrink-0" />
              <span className="text-xs font-medium text-red-400">EMERGENCY</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-red-300 truncate max-w-20" title={drone.emergencyState.description}>
                {drone.emergencyState.type.replace('_', ' ').toUpperCase()}
              </span>
            </div>
          </div>
        )}

        {/* Coordination Status Row */}
        {drone.alerts?.some(alert => alert.category === 'coordination') && (
          <div className="flex items-center justify-between bg-blue-900/20 border border-blue-500/30 rounded p-1.5">
            <div className="flex items-center gap-2">
              <ArrowPathIcon className="w-3 h-3 text-blue-400 flex-shrink-0" />
              <span className="text-xs font-medium text-blue-400">COORDINATION</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-blue-300 truncate max-w-24">
                {drone.alerts.find(a => a.category === 'coordination')?.message.includes('avoidance') ? 'MANEUVER' : 'WARNING'}
              </span>
            </div>
          </div>
        )}

        {/* Charging Status Row */}
        {drone.alerts?.some(alert => alert.category === 'charging') && (
          <div className="flex items-center justify-between bg-yellow-900/20 border border-yellow-500/30 rounded p-1.5">
            <div className="flex items-center gap-2">
              {drone.status === 'charging' ? (
                <BoltIcon className="w-3 h-3 text-yellow-400 flex-shrink-0" />
              ) : (
                <QueueListIcon className="w-3 h-3 text-yellow-400 flex-shrink-0" />
              )}
              <span className="text-xs font-medium text-yellow-400">
                {drone.status === 'charging' ? 'CHARGING' : 'QUEUED'}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-yellow-300 truncate max-w-24">
                {drone.status === 'charging' ? 
                  drone.alerts.find(a => a.category === 'charging')?.message.match(/\d+min/)?.[0] || 'ACTIVE' :
                  `POS ${drone.alerts.find(a => a.category === 'charging')?.message.match(/position (\d+)/)?.[1] || '?'}`
                }
              </span>
            </div>
          </div>
        )}

        {/* Mission/Altitude Row */}
        <div className="flex items-center justify-between">
          <span className="text-text-secondary text-xs">
            {drone.currentMission ? 'Mission' : 'Altitude'}
          </span>
          {drone.currentMission ? (
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 bg-status-active rounded-full"></div>
              <span className="text-xs text-text-primary font-medium">{Math.round(drone.currentMission.progress)}%</span>
            </div>
          ) : (
            <span className="text-xs text-text-primary font-mono">{Math.round(drone.position.alt)}m</span>
          )}
        </div>
      </div>

      {/* Bottom Info Row */}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-dark-border text-xs">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-text-secondary whitespace-nowrap">{Math.round(drone.speed * 10) / 10}m/s</span>
          {drone.alerts && drone.alerts.length > 0 && (
            <span className="text-status-warning whitespace-nowrap">{drone.alerts.length} alerts</span>
          )}
        </div>
        <span className="text-text-muted text-right whitespace-nowrap flex-shrink-0">{formatTimeAgo(drone.lastUpdate)}</span>
      </div>
    </motion.div>
  );
};

export default DroneStatusCard;