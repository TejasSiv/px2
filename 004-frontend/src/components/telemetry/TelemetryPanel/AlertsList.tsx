import React from 'react';
import { motion } from 'framer-motion';
import { 
  ExclamationTriangleIcon, 
  XCircleIcon, 
  InformationCircleIcon,
  ClockIcon,
  CheckCircleIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';

interface Alert {
  id: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  timestamp: string;
  category?: string;
  acknowledged?: boolean;
  resolved?: boolean;
}

interface AlertsListProps {
  alerts: Alert[];
  droneId: string;
  onAcknowledge?: (alertId: string) => void;
  onResolve?: (alertId: string) => void;
  onDismiss?: (alertId: string) => void;
}

const AlertsList: React.FC<AlertsListProps> = ({ 
  alerts, 
  droneId, 
  onAcknowledge, 
  onResolve, 
  onDismiss 
}) => {
  const getSeverityConfig = (severity: string) => {
    switch (severity) {
      case 'critical':
        return {
          color: '#f85149',
          bgColor: '#da3633',
          icon: XCircleIcon,
          label: 'Critical',
        };
      case 'error':
        return {
          color: '#da3633',
          bgColor: '#da3633',
          icon: XCircleIcon,
          label: 'Error',
        };
      case 'warning':
        return {
          color: '#d29922',
          bgColor: '#d29922',
          icon: ExclamationTriangleIcon,
          label: 'Warning',
        };
      case 'info':
        return {
          color: '#1f6feb',
          bgColor: '#1f6feb',
          icon: InformationCircleIcon,
          label: 'Info',
        };
      default:
        return {
          color: '#8b949e',
          bgColor: '#8b949e',
          icon: InformationCircleIcon,
          label: 'Unknown',
        };
    }
  };

  const formatTimeAgo = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    
    if (diffSeconds < 60) return `${diffSeconds}s ago`;
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  // Sort alerts by severity and timestamp
  const sortedAlerts = [...alerts].sort((a, b) => {
    const severityOrder = { critical: 4, error: 3, warning: 2, info: 1 };
    const severityDiff = (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0);
    if (severityDiff !== 0) return severityDiff;
    
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  const activeAlerts = sortedAlerts.filter(alert => !alert.resolved);
  const resolvedAlerts = sortedAlerts.filter(alert => alert.resolved);

  if (alerts.length === 0) {
    return (
      <div className="text-center py-8">
        <CheckCircleIcon className="w-12 h-12 mx-auto text-status-operational mb-3" />
        <h3 className="text-lg font-semibold text-text-primary mb-2">No Active Alerts</h3>
        <p className="text-text-secondary">All systems are operating normally</p>
      </div>
    );
  }

  const AlertItem: React.FC<{ alert: Alert; index: number }> = ({ alert, index }) => {
    const config = getSeverityConfig(alert.severity);
    const IconComponent = config.icon;

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: index * 0.1 }}
        className={`bg-dark-tertiary rounded-lg border-l-4 p-4 ${
          alert.acknowledged ? 'opacity-75' : ''
        } ${alert.resolved ? 'opacity-50' : ''}`}
        style={{ borderLeftColor: config.color }}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            <div className="flex-shrink-0 mt-0.5">
              <IconComponent className="w-5 h-5" style={{ color: config.color }} />
            </div>
            
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span 
                  className="px-2 py-1 rounded text-xs font-medium"
                  style={{ 
                    backgroundColor: config.bgColor + '20', 
                    color: config.color 
                  }}
                >
                  {config.label}
                </span>
                
                {alert.category && (
                  <span className="px-2 py-1 bg-dark-border text-text-secondary rounded text-xs">
                    {alert.category}
                  </span>
                )}
                
                {alert.acknowledged && (
                  <span className="px-2 py-1 bg-blue-900/30 text-blue-400 rounded text-xs">
                    Acknowledged
                  </span>
                )}
                
                {alert.resolved && (
                  <span className="px-2 py-1 bg-green-900/30 text-green-400 rounded text-xs">
                    Resolved
                  </span>
                )}
              </div>
              
              <p className="text-text-primary text-sm mb-2">{alert.message}</p>
              
              <div className="flex items-center gap-4 text-xs text-text-secondary">
                <div className="flex items-center gap-1">
                  <ClockIcon className="w-3 h-3" />
                  {formatTimeAgo(alert.timestamp)}
                </div>
                
                <div className="flex items-center gap-1">
                  <span>Drone:</span>
                  <span className="font-mono">{droneId}</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex items-center gap-2 ml-3">
            {!alert.resolved && !alert.acknowledged && onAcknowledge && (
              <button
                onClick={() => onAcknowledge(alert.id)}
                className="px-2 py-1 bg-blue-900/30 text-blue-400 hover:bg-blue-900/50 rounded text-xs transition-colors"
                title="Acknowledge alert"
              >
                Ack
              </button>
            )}
            
            {alert.acknowledged && !alert.resolved && onResolve && (
              <button
                onClick={() => onResolve(alert.id)}
                className="px-2 py-1 bg-green-900/30 text-green-400 hover:bg-green-900/50 rounded text-xs transition-colors"
                title="Mark as resolved"
              >
                Resolve
              </button>
            )}
            
            {onDismiss && (
              <button
                onClick={() => onDismiss(alert.id)}
                className="p-1 text-text-secondary hover:text-text-primary transition-colors"
                title="Dismiss alert"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Active Alerts */}
      {activeAlerts.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-text-primary">
              Active Alerts ({activeAlerts.length})
            </h3>
            
            {activeAlerts.filter(a => a.severity === 'critical' || a.severity === 'error').length > 0 && (
              <div className="flex items-center gap-1 text-status-critical text-sm">
                <ExclamationTriangleIcon className="w-4 h-4" />
                Attention Required
              </div>
            )}
          </div>
          
          <div className="space-y-3">
            {activeAlerts.map((alert, index) => (
              <AlertItem key={alert.id} alert={alert} index={index} />
            ))}
          </div>
        </div>
      )}
      
      {/* Resolved Alerts */}
      {resolvedAlerts.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-text-primary mb-4">
            Recent Resolved ({resolvedAlerts.length})
          </h3>
          
          <div className="space-y-3">
            {resolvedAlerts.slice(0, 5).map((alert, index) => (
              <AlertItem key={alert.id} alert={alert} index={index} />
            ))}
          </div>
          
          {resolvedAlerts.length > 5 && (
            <p className="text-text-secondary text-sm mt-3 text-center">
              +{resolvedAlerts.length - 5} more resolved alerts
            </p>
          )}
        </div>
      )}
      
      {/* Alert Statistics */}
      <div className="bg-dark-tertiary rounded-lg p-4">
        <h4 className="font-semibold text-text-primary mb-3">Alert Summary</h4>
        
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-text-secondary">Total Alerts</span>
            <div className="text-xl font-bold text-text-primary">{alerts.length}</div>
          </div>
          
          <div>
            <span className="text-text-secondary">Active</span>
            <div className="text-xl font-bold text-status-warning">{activeAlerts.length}</div>
          </div>
          
          <div>
            <span className="text-text-secondary">Critical</span>
            <div className="text-xl font-bold text-status-critical">
              {alerts.filter(a => a.severity === 'critical' && !a.resolved).length}
            </div>
          </div>
          
          <div>
            <span className="text-text-secondary">Resolved</span>
            <div className="text-xl font-bold text-status-operational">{resolvedAlerts.length}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AlertsList;