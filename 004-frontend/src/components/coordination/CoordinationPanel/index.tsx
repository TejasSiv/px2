import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowPathIcon,
  ExclamationTriangleIcon,
  ShieldCheckIcon,
  ClockIcon,
  MapPinIcon,
  CogIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  PlayIcon,
  PauseIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import { mockTelemetryService } from '@/services/mockData';
import { CoordinationAlert, CoordinationStatus } from '@/services/coordinationService';

interface CoordinationPanelProps {
  className?: string;
  compact?: boolean;
}

const CoordinationPanel: React.FC<CoordinationPanelProps> = ({
  className = '',
  compact = false
}) => {
  const isTransparent = className.includes('bg-transparent');
  const [coordinationStatus, setCoordinationStatus] = useState<CoordinationStatus | null>(null);
  const [coordinationAlerts, setCoordinationAlerts] = useState<CoordinationAlert[]>([]);
  const [showResolved, setShowResolved] = useState(false);

  useEffect(() => {
    const updateCoordinationData = () => {
      try {
        const status = mockTelemetryService.getCoordinationStatus();
        const alerts = mockTelemetryService.getCoordinationAlerts();
        
        setCoordinationStatus(status);
        setCoordinationAlerts(alerts);
      } catch (error) {
        console.error('Error fetching coordination data:', error);
      }
    };

    // Initial load
    updateCoordinationData();

    // Update every 5 seconds
    const interval = setInterval(updateCoordinationData, 5000);

    return () => clearInterval(interval);
  }, []);

  const { activeAlerts, resolvedAlerts } = useMemo(() => {
    const active = coordinationAlerts.filter(alert => !alert.resolved);
    const resolved = coordinationAlerts.filter(alert => alert.resolved);
    
    return {
      activeAlerts: active.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
      resolvedAlerts: resolved.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    };
  }, [coordinationAlerts]);

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'separation_violation':
        return ExclamationTriangleIcon;
      case 'collision_warning':
        return ExclamationTriangleIcon;
      default:
        return MapPinIcon;
    }
  };

  const getAlertColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return { color: '#f85149', bg: '#f85149' };
      case 'warning':
        return { color: '#d29922', bg: '#d29922' };
      default:
        return { color: '#8b949e', bg: '#8b949e' };
    }
  };

  const getAvoidanceActionIcon = (action: string) => {
    switch (action) {
      case 'climb': return ArrowUpIcon;
      case 'descend': return ArrowDownIcon;
      case 'turn_left': return ArrowLeftIcon;
      case 'turn_right': return ArrowRightIcon;
      case 'hover': return PauseIcon;
      case 'slow_down': return PlayIcon;
      default: return ArrowPathIcon;
    }
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = Date.now();
    const time = new Date(timestamp).getTime();
    const diff = now - time;
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours}h ago`;
    return `${minutes}m ago`;
  };

  const CoordinationAlertCard: React.FC<{ 
    alert: CoordinationAlert; 
    index: number;
    resolved?: boolean;
  }> = ({ alert, index, resolved = false }) => {
    const IconComponent = getAlertIcon(alert.type);
    const colors = getAlertColor(alert.severity);
    const AvoidanceIcon = alert.avoidanceAction ? getAvoidanceActionIcon(alert.avoidanceAction.action) : null;

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: index * 0.1 }}
        className={`
          border-l-4 rounded-lg p-4 transition-all
          ${resolved 
            ? 'bg-slate-800/30 border-green-500/50 opacity-75' 
            : alert.severity === 'critical'
              ? 'bg-red-900/20 border-red-500'
              : 'bg-amber-900/20 border-amber-500'
          }
        `}
        style={{ borderLeftColor: resolved ? '#10b981' : colors.color }}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            <div className="flex-shrink-0 mt-0.5">
              {resolved ? (
                <CheckCircleIcon className="w-5 h-5 text-green-400" />
              ) : (
                <IconComponent className="w-5 h-5" style={{ color: colors.color }} />
              )}
            </div>
            
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-medium text-slate-200">
                  {alert.type.replace('_', ' ').toUpperCase()}
                </span>
                <span 
                  className="px-2 py-1 rounded-full text-xs font-medium"
                  style={{ 
                    backgroundColor: (resolved ? '#10b981' : colors.color) + '20',
                    color: resolved ? '#10b981' : colors.color
                  }}
                >
                  {resolved ? 'Resolved' : alert.severity.toUpperCase()}
                </span>
                <span className="px-2 py-1 bg-slate-700 text-slate-300 rounded text-xs">
                  {alert.distance.toFixed(1)}m
                </span>
              </div>
              
              <p className="text-slate-300 text-sm mb-3">{alert.message}</p>
              
              {/* Drone IDs */}
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-slate-400">Drones:</span>
                {alert.droneIds.map(droneId => (
                  <span key={droneId} className="px-2 py-1 bg-slate-700 text-slate-300 rounded text-xs font-mono">
                    {droneId}
                  </span>
                ))}
              </div>
              
              {/* Avoidance Action */}
              {alert.avoidanceAction && AvoidanceIcon && (
                <div className="flex items-center gap-2 mb-2">
                  <AvoidanceIcon className="w-4 h-4 text-blue-400" />
                  <span className="text-sm text-blue-400">
                    Action: {alert.avoidanceAction.action.replace('_', ' ')} 
                    ({alert.avoidanceAction.magnitude}° | m)
                  </span>
                  <span className="text-xs text-slate-400">
                    → {alert.avoidanceAction.droneId}
                  </span>
                </div>
              )}
              
              <div className="flex items-center gap-4 text-xs text-slate-400">
                <div className="flex items-center gap-1">
                  <ClockIcon className="w-3 h-3" />
                  <span>{formatTimeAgo(alert.timestamp)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  if (compact) {
    return (
      <div className={`bg-slate-900 border border-slate-700 rounded-lg p-4 ${className}`}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-medium text-slate-200 flex items-center gap-2">
            <ArrowPathIcon className="w-5 h-5" />
            Coordination
          </h3>
          <div className="flex items-center gap-2 text-sm">
            {coordinationStatus && coordinationStatus.isActive ? (
              <span className="flex items-center gap-1 text-green-400">
                <ShieldCheckIcon className="w-4 h-4" />
                Active
              </span>
            ) : (
              <span className="text-slate-500">Inactive</span>
            )}
          </div>
        </div>
        
        <div className="space-y-2">
          {coordinationStatus && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Separation</span>
              <span className="text-slate-200">{coordinationStatus.separationDistance}m</span>
            </div>
          )}
          
          {activeAlerts.length === 0 ? (
            <div className="text-center py-4">
              <ShieldCheckIcon className="w-8 h-8 mx-auto text-green-400 mb-2" />
              <p className="text-sm text-slate-400">No conflicts</p>
            </div>
          ) : (
            <div className="space-y-2">
              {activeAlerts.slice(0, 2).map((alert, index) => (
                <CoordinationAlertCard
                  key={alert.id}
                  alert={alert}
                  index={index}
                />
              ))}
              {activeAlerts.length > 2 && (
                <p className="text-xs text-slate-500 text-center py-1">
                  +{activeAlerts.length - 2} more conflicts
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={isTransparent ? `${className} flex flex-col h-full` : `bg-slate-900 border border-slate-700 rounded-lg ${className}`}>
      {/* Header */}
      <div className={`flex items-center justify-between ${isTransparent ? 'p-4 border-b border-dark-border flex-shrink-0' : 'p-6 border-b border-slate-700'}`}>
        <h2 className={`${isTransparent ? 'text-lg font-semibold text-text-primary' : 'text-xl font-semibold text-slate-200'} flex items-center gap-3`}>
          <ArrowPathIcon className={`${isTransparent ? 'w-5 h-5' : 'w-6 h-6'}`} />
          Fleet Coordination
        </h2>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-4 text-sm text-slate-400">
            {coordinationStatus ? (
              <>
                <div className="flex items-center gap-1">
                  <div className={`w-2 h-2 rounded-full ${coordinationStatus.isActive ? 'bg-green-400' : 'bg-red-400'}`} />
                  <span>{coordinationStatus.isActive ? 'Active' : 'Inactive'}</span>
                </div>
                <span>{coordinationStatus.separationDistance}m separation</span>
                <span>{activeAlerts.length} active conflicts</span>
                <span>{coordinationStatus.resolvedConflicts} resolved</span>
              </>
            ) : (
              <span>Loading...</span>
            )}
          </div>
          
          <button
            onClick={() => setShowResolved(!showResolved)}
            className={`p-2 rounded-lg transition-colors ${
              showResolved
                ? 'bg-green-500/10 text-green-400'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
            title="Toggle resolved conflicts"
          >
            <CheckCircleIcon className="w-5 h-5" />
          </button>

          <button
            className="p-2 bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg transition-colors"
            title="Configuration"
          >
            <CogIcon className="w-5 h-5" />
          </button>
        </div>
      </div>
      
      {/* Content */}
      <div className={`${isTransparent ? 'p-4 flex-1 overflow-auto' : 'p-6'}`}>
        <AnimatePresence mode="wait">
          {showResolved ? (
            <motion.div
              key="resolved"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              <h3 className={`text-lg font-medium mb-4 ${isTransparent ? 'text-text-primary' : 'text-slate-200'}`}>
                Resolved Conflicts ({resolvedAlerts.length})
              </h3>
              
              {resolvedAlerts.length === 0 ? (
                <div className={`text-center py-8 ${isTransparent ? 'text-text-muted' : 'text-slate-500'}`}>
                  No resolved conflicts yet
                </div>
              ) : (
                <div className={`space-y-3 overflow-y-auto ${isTransparent ? 'max-h-64' : 'max-h-96'}`}>
                  {resolvedAlerts.map((alert, index) => (
                    <CoordinationAlertCard
                      key={alert.id}
                      alert={alert}
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
                Active Coordination ({activeAlerts.length})
              </h3>
              
              {activeAlerts.length === 0 ? (
                <div className="text-center py-8">
                  <ShieldCheckIcon className="w-12 h-12 mx-auto text-green-400 mb-3" />
                  <h4 className="text-lg font-semibold text-slate-200 mb-2">No Active Conflicts</h4>
                  <p className="text-slate-400">All drones maintaining safe separation (≥{coordinationStatus?.separationDistance}m)</p>
                </div>
              ) : (
                <div className={`space-y-3 overflow-y-auto ${isTransparent ? 'max-h-64' : 'max-h-96'}`}>
                  {activeAlerts.map((alert, index) => (
                    <CoordinationAlertCard
                      key={alert.id}
                      alert={alert}
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

export default CoordinationPanel;