import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldExclamationIcon,
  ExclamationTriangleIcon,
  FireIcon,
  SignalSlashIcon,
  BoltSlashIcon,
  ClockIcon,
  CheckCircleIcon,
  XMarkIcon,
  PlayIcon,
  StopIcon
} from '@heroicons/react/24/outline';
import { DroneData, EmergencyState } from '@/types/fleet';

interface EmergencyPanelProps {
  drones: DroneData[];
  className?: string;
  compact?: boolean;
}

const EmergencyPanel: React.FC<EmergencyPanelProps> = ({
  drones,
  className = '',
  compact = false
}) => {
  const [showResolved, setShowResolved] = useState(false);
  
  const emergencies = useMemo(() => {
    const active: Array<{ drone: DroneData; emergency: EmergencyState }> = [];
    const resolved: Array<{ drone: DroneData; emergency: EmergencyState }> = [];
    
    drones.forEach(drone => {
      if (drone.emergencyState) {
        if (drone.emergencyState.resolved) {
          resolved.push({ drone, emergency: drone.emergencyState });
        } else {
          active.push({ drone, emergency: drone.emergencyState });
        }
      }
    });
    
    return {
      active: active.sort((a, b) => new Date(b.emergency.triggeredAt).getTime() - new Date(a.emergency.triggeredAt).getTime()),
      resolved: resolved.sort((a, b) => new Date(b.emergency.resolvedAt || b.emergency.triggeredAt).getTime() - new Date(a.emergency.resolvedAt || a.emergency.triggeredAt).getTime())
    };
  }, [drones]);

  const getEmergencyTypeIcon = (type: string) => {
    switch (type) {
      case 'critical_battery': return BoltSlashIcon;
      case 'communication_loss': return SignalSlashIcon;
      case 'system_failure': return FireIcon;
      case 'collision_risk': return ExclamationTriangleIcon;
      case 'geofence_violation': return ShieldExclamationIcon;
      default: return ExclamationTriangleIcon;
    }
  };

  const getEmergencyTypeColor = (type: string, severity: string) => {
    if (severity === 'emergency') return '#f85149';
    switch (type) {
      case 'critical_battery': return '#da3633';
      case 'communication_loss': return '#d29922';
      case 'system_failure': return '#f85149';
      case 'collision_risk': return '#f85149';
      case 'geofence_violation': return '#da3633';
      default: return '#da3633';
    }
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = Date.now();
    const time = new Date(timestamp).getTime();
    const diff = now - time;
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    return `${minutes}m ago`;
  };

  const EmergencyCard: React.FC<{ 
    drone: DroneData; 
    emergency: EmergencyState; 
    index: number;
    resolved?: boolean;
  }> = ({ drone, emergency, index, resolved = false }) => {
    const IconComponent = getEmergencyTypeIcon(emergency.type);
    const color = getEmergencyTypeColor(emergency.type, emergency.severity);

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: index * 0.1 }}
        className={`
          border-l-4 rounded-lg p-4 transition-all
          ${resolved 
            ? 'bg-slate-800/30 border-green-500/50 opacity-75' 
            : emergency.severity === 'emergency'
              ? 'bg-red-900/20 border-red-500 animate-pulse'
              : 'bg-amber-900/20 border-amber-500'
          }
        `}
        style={{ borderLeftColor: resolved ? '#10b981' : color }}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            <div className="flex-shrink-0 mt-0.5">
              {resolved ? (
                <CheckCircleIcon className="w-5 h-5 text-green-400" />
              ) : (
                <IconComponent className="w-5 h-5" style={{ color }} />
              )}
            </div>
            
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-slate-200">
                  {drone.name}
                </span>
                <span 
                  className="px-2 py-1 rounded-full text-xs font-medium"
                  style={{ 
                    backgroundColor: (resolved ? '#10b981' : color) + '20',
                    color: resolved ? '#10b981' : color
                  }}
                >
                  {resolved ? 'Resolved' : emergency.severity.toUpperCase()}
                </span>
                <span className="px-2 py-1 bg-slate-700 text-slate-300 rounded text-xs">
                  {emergency.type.replace('_', ' ')}
                </span>
              </div>
              
              <p className="text-slate-300 text-sm mb-2">{emergency.description}</p>
              
              <div className="flex items-center gap-4 text-xs text-slate-400">
                <div className="flex items-center gap-1">
                  <ClockIcon className="w-3 h-3" />
                  <span>
                    {resolved && emergency.resolvedAt ? 
                      `Resolved ${formatTimeAgo(emergency.resolvedAt)}` :
                      `Triggered ${formatTimeAgo(emergency.triggeredAt)}`
                    }
                  </span>
                </div>
                
                {emergency.autoResponse && (
                  <div className="flex items-center gap-1">
                    {emergency.autoResponse.triggered ? (
                      <PlayIcon className="w-3 h-3 text-blue-400" />
                    ) : (
                      <StopIcon className="w-3 h-3 text-slate-500" />
                    )}
                    <span className="text-blue-400">
                      Auto: {emergency.autoResponse.action.replace('_', ' ')}
                    </span>
                  </div>
                )}
                
                {emergency.operatorOverride && (
                  <div className="flex items-center gap-1">
                    <span className="text-green-400">
                      Override: {emergency.operatorOverride.action}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {!resolved && (
            <div className="flex items-center gap-2 ml-3">
              <button
                className="px-2 py-1 bg-blue-900/30 text-blue-400 hover:bg-blue-900/50 rounded text-xs transition-colors"
                title="Acknowledge emergency"
              >
                Ack
              </button>
              <button
                className="p-1 text-slate-400 hover:text-slate-200 transition-colors"
                title="Dismiss"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </motion.div>
    );
  };

  if (compact) {
    return (
      <div className={`bg-slate-900 border border-slate-700 rounded-lg p-4 ${className}`}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-medium text-slate-200 flex items-center gap-2">
            <ShieldExclamationIcon className="w-5 h-5" />
            Emergencies
          </h3>
          <div className="flex items-center gap-2 text-sm">
            {emergencies.active.length > 0 ? (
              <span className="bg-red-500 text-white px-2 py-1 rounded-full text-xs">
                {emergencies.active.length} Active
              </span>
            ) : (
              <span className="text-green-400">All Clear</span>
            )}
          </div>
        </div>
        
        <div className="space-y-2">
          {emergencies.active.length === 0 ? (
            <div className="text-center py-4">
              <CheckCircleIcon className="w-8 h-8 mx-auto text-green-400 mb-2" />
              <p className="text-sm text-slate-400">No active emergencies</p>
            </div>
          ) : (
            emergencies.active.slice(0, 3).map(({ drone, emergency }, index) => (
              <EmergencyCard
                key={emergency.id}
                drone={drone}
                emergency={emergency}
                index={index}
              />
            ))
          )}
          
          {emergencies.active.length > 3 && (
            <p className="text-xs text-slate-500 text-center py-1">
              +{emergencies.active.length - 3} more emergencies
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-slate-900 border border-slate-700 rounded-lg ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-slate-700">
        <h2 className="text-xl font-semibold text-slate-200 flex items-center gap-3">
          <ShieldExclamationIcon className="w-6 h-6" />
          Emergency Management
        </h2>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-4 text-sm text-slate-400">
            {emergencies.active.length > 0 ? (
              <span className="bg-red-500 text-white px-2 py-1 rounded-full">
                {emergencies.active.length} Active
              </span>
            ) : (
              <span className="text-green-400">All Clear</span>
            )}
            <span>{emergencies.resolved.length} Resolved</span>
          </div>
          
          <button
            onClick={() => setShowResolved(!showResolved)}
            className={`p-2 rounded-lg transition-colors ${
              showResolved
                ? 'bg-green-500/10 text-green-400'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
            title="Toggle resolved emergencies"
          >
            <CheckCircleIcon className="w-5 h-5" />
          </button>
        </div>
      </div>
      
      {/* Content */}
      <div className="p-6">
        <AnimatePresence mode="wait">
          {showResolved ? (
            <motion.div
              key="resolved"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              <h3 className="text-lg font-medium text-slate-200 mb-4">
                Resolved Emergencies ({emergencies.resolved.length})
              </h3>
              
              {emergencies.resolved.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  No resolved emergencies
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {emergencies.resolved.map(({ drone, emergency }, index) => (
                    <EmergencyCard
                      key={emergency.id}
                      drone={drone}
                      emergency={emergency}
                      index={index}
                      resolved={true}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="active"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              <h3 className="text-lg font-medium text-slate-200 mb-4">
                Active Emergencies ({emergencies.active.length})
              </h3>
              
              {emergencies.active.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircleIcon className="w-12 h-12 mx-auto text-green-400 mb-3" />
                  <h4 className="text-lg font-semibold text-slate-200 mb-2">No Active Emergencies</h4>
                  <p className="text-slate-400">All drones are operating within normal parameters</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {emergencies.active.map(({ drone, emergency }, index) => (
                    <EmergencyCard
                      key={emergency.id}
                      drone={drone}
                      emergency={emergency}
                      index={index}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default EmergencyPanel;