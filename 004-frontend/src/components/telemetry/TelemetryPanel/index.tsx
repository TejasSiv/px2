import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Battery0Icon as BatteryIcon, 
  SignalIcon, 
  GlobeAltIcon as CompassIcon,
  RocketLaunchIcon as SpeedIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  MapPinIcon,
  WifiIcon,
  CpuChipIcon,
  FireIcon as TemperatureIcon
} from '@heroicons/react/24/outline';
import { DroneData } from '@/types/fleet';
import BatteryIndicator from '../BatteryIndicator';
import ConnectionStatus from '../ConnectionStatus';
import TelemetryChart from './TelemetryChart';
import AlertsList from './AlertsList';

interface TelemetryPanelProps {
  drone: DroneData | null;
  isLive?: boolean;
  className?: string;
}

const TelemetryPanel: React.FC<TelemetryPanelProps> = ({ 
  drone, 
  isLive = true,
  className = '' 
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'charts' | 'alerts' | 'system'>('overview');
  const [telemetryHistory, setTelemetryHistory] = useState<any[]>([]);

  // Simulate telemetry history for charts
  useEffect(() => {
    if (drone && isLive) {
      const newDataPoint = {
        timestamp: Date.now(),
        battery: drone.batteryLevel,
        altitude: drone.position.alt,
        speed: drone.speed,
        signalStrength: drone.signalStrength,
      };
      
      setTelemetryHistory(prev => {
        const updated = [...prev, newDataPoint];
        // Keep last 50 data points
        return updated.slice(-50);
      });
    }
  }, [drone, isLive]);

  if (!drone) {
    return (
      <div className={`h-full w-full flex items-center justify-center ${className}`}>
        <div className="text-center text-text-secondary">
          <CpuChipIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <h3 className="text-lg font-semibold mb-2">No Drone Selected</h3>
          <p className="text-sm">Select a drone from the map or fleet list to view telemetry data.</p>
        </div>
      </div>
    );
  }

  const formatLastUpdate = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    
    if (diffSeconds < 60) return `${diffSeconds}s ago`;
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
    return `${Math.floor(diffSeconds / 3600)}h ago`;
  };

  const getStatusColor = (status: string): string => {
    switch (status.toLowerCase()) {
      case 'active':
      case 'in_flight':
        return '#238636';
      case 'charging':
      case 'returning':
        return '#d29922';
      case 'maintenance':
      case 'emergency':
        return '#da3633';
      case 'idle':
      default:
        return '#8b949e';
    }
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: CpuChipIcon },
    { id: 'charts', label: 'Charts', icon: SpeedIcon },
    { id: 'alerts', label: 'Alerts', icon: ExclamationTriangleIcon, count: drone.alerts?.length || 0 },
    { id: 'system', label: 'System', icon: WifiIcon },
  ];

  return (
    <div className={`h-full w-full flex flex-col overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex-shrink-0 p-3 border-b border-dark-border">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">{drone.name}</h2>
            <p className="text-text-secondary text-xs">{drone.id}</p>
          </div>
          <div className="flex items-center gap-2">
            {isLive && (
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-status-operational rounded-full animate-pulse"></div>
                <span className="text-xs text-text-secondary">Live</span>
              </div>
            )}
            <div className={`px-2 py-0.5 rounded text-xs font-medium border`}
                 style={{ 
                   backgroundColor: getStatusColor(drone.status) + '20',
                   color: getStatusColor(drone.status),
                   borderColor: getStatusColor(drone.status) + '40'
                 }}>
              {drone.status.toUpperCase()}
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-0.5">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-2 py-1 rounded text-xs font-medium transition-all duration-200 flex items-center gap-1 ${
                activeTab === tab.id
                  ? 'bg-dark-tertiary text-text-primary border border-dark-border'
                  : 'text-text-secondary hover:text-text-primary hover:bg-dark-hover'
              }`}
            >
              <tab.icon className="w-3 h-3" />
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="bg-status-critical text-white text-xs rounded-full px-1 py-0.5 min-w-[14px] text-center">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto p-3">
        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              {/* Key Metrics Grid */}
              <div className="grid grid-cols-2 gap-3">
                {/* Battery */}
                <div className="bg-dark-tertiary rounded p-2">
                  <div className="flex items-center gap-1 mb-1">
                    <BatteryIcon className="w-4 h-4 text-text-secondary" />
                    <span className="text-xs text-text-secondary">Battery</span>
                  </div>
                  <BatteryIndicator 
                    level={drone.batteryLevel} 
                    voltage={drone.batteryVoltage}
                    showLabel={true}
                    size="sm"
                  />
                </div>

                {/* Connection */}
                <div className="bg-dark-tertiary rounded p-2">
                  <div className="flex items-center gap-1 mb-1">
                    <SignalIcon className="w-4 h-4 text-text-secondary" />
                    <span className="text-xs text-text-secondary">Signal</span>
                  </div>
                  <ConnectionStatus 
                    strength={drone.signalStrength}
                    quality={drone.connectionQuality}
                    showLabel={true}
                    size="sm"
                  />
                </div>

                {/* Altitude */}
                <div className="bg-dark-tertiary rounded p-2">
                  <div className="flex items-center gap-1 mb-1">
                    <MapPinIcon className="w-4 h-4 text-text-secondary" />
                    <span className="text-xs text-text-secondary">Altitude</span>
                  </div>
                  <div className="text-lg font-bold text-text-primary">
                    {drone.position.alt.toFixed(1)}
                  </div>
                  <div className="text-xs text-text-secondary">meters</div>
                </div>

                {/* Speed */}
                <div className="bg-dark-tertiary rounded p-2">
                  <div className="flex items-center gap-1 mb-1">
                    <SpeedIcon className="w-4 h-4 text-text-secondary" />
                    <span className="text-xs text-text-secondary">Speed</span>
                  </div>
                  <div className="text-lg font-bold text-text-primary">
                    {drone.speed.toFixed(1)}
                  </div>
                  <div className="text-xs text-text-secondary">m/s</div>
                </div>
              </div>

              {/* Position & Orientation */}
              <div className="bg-dark-tertiary rounded p-3">
                <h3 className="font-medium text-text-primary mb-2 flex items-center gap-1">
                  <CompassIcon className="w-4 h-4" />
                  Position & Orientation
                </h3>
                <div className="grid grid-cols-1 gap-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Latitude</span>
                    <span className="font-mono text-text-primary">
                      {drone.position.lat.toFixed(6)}°
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Longitude</span>
                    <span className="font-mono text-text-primary">
                      {drone.position.lng.toFixed(6)}°
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Heading</span>
                    <span className="font-mono text-text-primary">
                      {drone.heading.toFixed(1)}°
                    </span>
                  </div>
                </div>
              </div>

              {/* Mission Status */}
              {drone.currentMission && (
                <div className="bg-dark-tertiary rounded p-3">
                  <h3 className="font-medium text-text-primary mb-2 flex items-center gap-1">
                    <CheckCircleIcon className="w-4 h-4" />
                    Current Mission
                  </h3>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Mission</span>
                      <span className="text-text-primary truncate ml-2">{drone.currentMission.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Progress</span>
                      <span className="text-text-primary">{drone.currentMission.progress}%</span>
                    </div>
                    {drone.currentMission.eta && (
                      <div className="flex justify-between">
                        <span className="text-text-secondary">ETA</span>
                        <span className="text-text-primary">{drone.currentMission.eta}</span>
                      </div>
                    )}
                    <div className="w-full bg-dark-border rounded-full h-1.5 mt-2">
                      <div 
                        className="bg-status-active h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${drone.currentMission.progress}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'charts' && (
            <motion.div
              key="charts"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <TelemetryChart data={telemetryHistory} drone={drone} />
            </motion.div>
          )}

          {activeTab === 'alerts' && (
            <motion.div
              key="alerts"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <AlertsList alerts={drone.alerts || []} droneId={drone.id} />
            </motion.div>
          )}

          {activeTab === 'system' && (
            <motion.div
              key="system"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              {/* System Information */}
              <div className="bg-dark-tertiary rounded-lg p-4">
                <h3 className="font-semibold text-text-primary mb-3">System Information</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Firmware</span>
                    <span className="text-text-primary font-mono">{drone.firmware || 'v1.12.3'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Hardware</span>
                    <span className="text-text-primary">{drone.hardware || 'Pixhawk 4'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Uptime</span>
                    <span className="text-text-primary">{drone.uptime || '2h 34m'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Last Update</span>
                    <span className="text-text-primary">{formatLastUpdate(drone.lastUpdate)}</span>
                  </div>
                </div>
              </div>

              {/* Environmental */}
              <div className="bg-dark-tertiary rounded-lg p-4">
                <h3 className="font-semibold text-text-primary mb-3 flex items-center gap-2">
                  <TemperatureIcon className="w-5 h-5" />
                  Environmental
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-text-secondary">Temperature</span>
                    <div className="font-mono text-text-primary">
                      {drone.temperature || 28.5}°C
                    </div>
                  </div>
                  <div>
                    <span className="text-text-secondary">Humidity</span>
                    <div className="font-mono text-text-primary">
                      {drone.humidity || 65}%
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default TelemetryPanel;