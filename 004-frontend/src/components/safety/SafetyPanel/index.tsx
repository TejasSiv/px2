import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheckIcon,
  ShieldExclamationIcon,
  ExclamationTriangleIcon,
  BoltIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  BellIcon
} from '@heroicons/react/24/outline';

interface SafetyAlert {
  id: string;
  droneId?: string;
  severity: 'info' | 'warning' | 'critical';
  type: string;
  message: string;
  category: string;
  timestamp: string;
  data?: any;
  resolved: boolean;
  acknowledged: boolean;
}

interface SafetyStatus {
  overall: 'safe' | 'caution' | 'warning' | 'critical';
  lastCheck: number;
  criticalAlerts: number;
  warningAlerts: number;
  activeDrones: number;
  dronesAtRisk: number;
  totalAlerts: number;
}

interface SafetyPanelProps {
  className?: string;
}

const SafetyPanel: React.FC<SafetyPanelProps> = ({ className = '' }) => {
  const [safetyStatus, setSafetyStatus] = useState<SafetyStatus>({
    overall: 'safe',
    lastCheck: Date.now(),
    criticalAlerts: 0,
    warningAlerts: 0,
    activeDrones: 0,
    dronesAtRisk: 0,
    totalAlerts: 0
  });

  const [alerts, setAlerts] = useState<SafetyAlert[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [showAllAlerts, setShowAllAlerts] = useState(false);

  useEffect(() => {
    // Initialize safety WebSocket connection
    const initSafetyConnection = () => {
      try {
        const ws = new WebSocket('ws://localhost:3005/safety-ws');
        
        ws.onopen = () => {
          console.log('Safety WebSocket connected');
          setIsConnected(true);
          
          // Subscribe to safety alerts
          ws.send(JSON.stringify({
            type: 'subscribe',
            channels: ['battery_alerts', 'safety_alerts', 'emergency_alerts', 'all_alerts']
          }));
          
          // Request current alerts
          ws.send(JSON.stringify({
            type: 'get_alerts'
          }));
        };
        
        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            handleSafetyMessage(message);
          } catch (error) {
            console.error('Failed to parse safety message:', error);
          }
        };
        
        ws.onclose = () => {
          console.log('Safety WebSocket disconnected');
          setIsConnected(false);
          // Attempt to reconnect after 5 seconds
          setTimeout(initSafetyConnection, 5000);
        };
        
        ws.onerror = (error) => {
          console.error('Safety WebSocket error:', error);
          setIsConnected(false);
        };
        
        return ws;
      } catch (error) {
        console.error('Failed to initialize safety connection:', error);
        setIsConnected(false);
        return null;
      }
    };

    const ws = initSafetyConnection();
    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, []);

  const handleSafetyMessage = (message: any) => {
    switch (message.type) {
      case 'battery_alert':
      case 'safety_alert':
      case 'emergency_alert':
        // Add new alert to the list
        setAlerts(prev => [message.data, ...prev.slice(0, 19)]); // Keep last 20 alerts
        break;
        
      case 'system_safety_status':
        setSafetyStatus(message.data.status);
        break;
        
      case 'alerts_data':
        setAlerts(message.data.alerts || []);
        break;
        
      case 'alert_resolved':
        // Remove resolved alert
        setAlerts(prev => prev.filter(alert => alert.id !== message.data.alertId));
        break;
    }
  };

  const getSafetyStatusColor = (status: string) => {
    switch (status) {
      case 'safe':
        return 'text-green-400 bg-green-900/20';
      case 'caution':
        return 'text-yellow-400 bg-yellow-900/20';
      case 'warning':
        return 'text-orange-400 bg-orange-900/20';
      case 'critical':
        return 'text-red-400 bg-red-900/20';
      default:
        return 'text-gray-400 bg-gray-900/20';
    }
  };

  const getSafetyIcon = (status: string) => {
    switch (status) {
      case 'safe':
        return <ShieldCheckIcon className="w-5 h-5" />;
      case 'caution':
      case 'warning':
        return <ShieldExclamationIcon className="w-5 h-5" />;
      case 'critical':
        return <ExclamationTriangleIcon className="w-5 h-5" />;
      default:
        return <ShieldCheckIcon className="w-5 h-5" />;
    }
  };

  const getAlertIcon = (alert: SafetyAlert) => {
    if (alert.type === 'battery') {
      return <BoltIcon className="w-4 h-4" />;
    }
    
    switch (alert.severity) {
      case 'critical':
        return <ExclamationTriangleIcon className="w-4 h-4" />;
      case 'warning':
        return <ShieldExclamationIcon className="w-4 h-4" />;
      default:
        return <BellIcon className="w-4 h-4" />;
    }
  };

  const getAlertSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'text-red-400 bg-red-900/20 border-red-500/30';
      case 'warning':
        return 'text-orange-400 bg-orange-900/20 border-orange-500/30';
      case 'info':
        return 'text-blue-400 bg-blue-900/20 border-blue-500/30';
      default:
        return 'text-gray-400 bg-gray-900/20 border-gray-500/30';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) {
      return 'Just now';
    } else if (diff < 3600000) {
      return `${Math.floor(diff / 60000)}m ago`;
    } else if (diff < 86400000) {
      return `${Math.floor(diff / 3600000)}h ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const acknowledgeAlert = async (alertId: string) => {
    try {
      // In a real implementation, this would call the API
      console.log(`Acknowledging alert: ${alertId}`);
      
      // Update local state
      setAlerts(prev => 
        prev.map(alert => 
          alert.id === alertId 
            ? { ...alert, acknowledged: true }
            : alert
        )
      );
    } catch (error) {
      console.error('Failed to acknowledge alert:', error);
    }
  };

  const resolveAlert = async (alertId: string) => {
    try {
      // In a real implementation, this would call the API
      console.log(`Resolving alert: ${alertId}`);
      
      // Remove from local state
      setAlerts(prev => prev.filter(alert => alert.id !== alertId));
    } catch (error) {
      console.error('Failed to resolve alert:', error);
    }
  };

  const visibleAlerts = showAllAlerts ? alerts : alerts.slice(0, 5);

  return (
    <div className={`bg-dark-secondary rounded-lg border border-dark-border ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-dark-border">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-text-primary">Safety Monitor</h3>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`} />
            <span className="text-xs text-text-secondary">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>

        {/* Overall Safety Status */}
        <div className={`flex items-center gap-3 p-3 rounded-lg border ${getSafetyStatusColor(safetyStatus.overall)}`}>
          {getSafetyIcon(safetyStatus.overall)}
          <div className="flex-1">
            <div className="font-medium capitalize">
              System Status: {safetyStatus.overall}
            </div>
            <div className="text-sm opacity-80">
              {safetyStatus.dronesAtRisk > 0 
                ? `${safetyStatus.dronesAtRisk} drone${safetyStatus.dronesAtRisk > 1 ? 's' : ''} at risk`
                : 'All drones operating safely'
              }
            </div>
          </div>
          <div className="text-right text-sm">
            <div>{safetyStatus.totalAlerts} alerts</div>
            <div className="opacity-70">
              {safetyStatus.criticalAlerts} critical
            </div>
          </div>
        </div>
      </div>

      {/* Safety Metrics */}
      <div className="p-4 border-b border-dark-border">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-dark-tertiary rounded-lg p-3">
            <div className="text-2xl font-bold text-text-primary">
              {safetyStatus.activeDrones}
            </div>
            <div className="text-sm text-text-secondary">Active Drones</div>
          </div>
          <div className="bg-dark-tertiary rounded-lg p-3">
            <div className="text-2xl font-bold text-red-400">
              {safetyStatus.criticalAlerts}
            </div>
            <div className="text-sm text-text-secondary">Critical Alerts</div>
          </div>
        </div>
      </div>

      {/* Recent Alerts */}
      <div className="flex-1 flex flex-col">
        <div className="flex items-center justify-between p-4 pb-2">
          <h4 className="font-medium text-text-primary">Recent Alerts</h4>
          {alerts.length > 5 && (
            <button
              onClick={() => setShowAllAlerts(!showAllAlerts)}
              className="text-xs text-status-active hover:text-status-active/80 transition-colors"
            >
              {showAllAlerts ? 'Show Less' : `Show All (${alerts.length})`}
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
          <AnimatePresence>
            {visibleAlerts.length > 0 ? (
              visibleAlerts.map((alert) => (
                <motion.div
                  key={alert.id}
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -100 }}
                  className={`p-3 rounded-lg border ${getAlertSeverityColor(alert.severity)}`}
                >
                  <div className="flex items-start gap-2">
                    {getAlertIcon(alert)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium uppercase tracking-wide">
                          {alert.type.replace('_', ' ')}
                        </span>
                        {alert.droneId && (
                          <span className="text-xs text-text-secondary">
                            {alert.droneId}
                          </span>
                        )}
                        <span className="text-xs text-text-secondary ml-auto">
                          {formatTimestamp(alert.timestamp)}
                        </span>
                      </div>
                      <div className="text-sm text-text-primary mb-2">
                        {alert.message}
                      </div>
                      
                      {/* Battery-specific data */}
                      {alert.type === 'battery' && alert.data && (
                        <div className="text-xs text-text-secondary mb-2">
                          Battery: {alert.data.batteryLevel}% 
                          {alert.data.batteryVoltage && ` (${alert.data.batteryVoltage}V)`}
                        </div>
                      )}
                      
                      {/* Action buttons */}
                      <div className="flex items-center gap-2">
                        {!alert.acknowledged && (
                          <button
                            onClick={() => acknowledgeAlert(alert.id)}
                            className="flex items-center gap-1 text-xs text-status-active hover:text-status-active/80 transition-colors"
                          >
                            <CheckCircleIcon className="w-3 h-3" />
                            Acknowledge
                          </button>
                        )}
                        {alert.acknowledged && !alert.resolved && (
                          <button
                            onClick={() => resolveAlert(alert.id)}
                            className="flex items-center gap-1 text-xs text-green-400 hover:text-green-300 transition-colors"
                          >
                            <XCircleIcon className="w-3 h-3" />
                            Resolve
                          </button>
                        )}
                        {alert.acknowledged && (
                          <span className="flex items-center gap-1 text-xs text-green-400">
                            <CheckCircleIcon className="w-3 h-3" />
                            Acknowledged
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="text-center py-8 text-text-secondary">
                <ShieldCheckIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <div className="text-sm">No active safety alerts</div>
                <div className="text-xs opacity-70 mt-1">All systems operating normally</div>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Last Update */}
      <div className="px-4 py-2 border-t border-dark-border">
        <div className="flex items-center gap-1 text-xs text-text-secondary">
          <ClockIcon className="w-3 h-3" />
          Last update: {formatTimestamp(new Date(safetyStatus.lastCheck).toISOString())}
        </div>
      </div>
    </div>
  );
};

export default SafetyPanel;