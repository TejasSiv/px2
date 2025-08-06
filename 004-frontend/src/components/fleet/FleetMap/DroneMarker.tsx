import React from 'react';
import { Marker, Popup } from 'react-leaflet';
import { divIcon } from 'leaflet';
import { 
  Battery0Icon as BatteryIcon, 
  SignalIcon, 
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { DroneData } from '@/types/fleet';

interface DroneMarkerProps {
  drone: DroneData;
  isSelected: boolean;
  onSelect: () => void;
  getBatteryColor: (percentage: number) => string;
  getStatusColor: (status: string) => string;
}

const DroneMarker: React.FC<DroneMarkerProps> = ({
  drone,
  isSelected,
  onSelect,
  getBatteryColor,
  getStatusColor
}) => {
  const createDroneIcon = () => {
    const statusColor = getStatusColor(drone.status);
    const batteryColor = getBatteryColor(drone.batteryLevel);
    const isLowBattery = drone.batteryLevel < 30;
    
    return divIcon({
      html: `
        <div class="relative">
          <!-- Pulse animation for selected drone -->
          ${isSelected ? `
            <div class="absolute inset-0 animate-ping">
              <div class="w-6 h-6 bg-blue-400 rounded-full opacity-30"></div>
            </div>
          ` : ''}
          
          <!-- Low battery warning pulse -->
          ${isLowBattery ? `
            <div class="absolute inset-0 animate-pulse">
              <div class="w-6 h-6 bg-red-400 rounded-full opacity-40"></div>
            </div>
          ` : ''}
          
          <!-- Main drone icon -->
          <div class="relative w-6 h-6 rounded-full border-2 flex items-center justify-center transform transition-transform hover:scale-110"
               style="background-color: #161b22; border-color: ${statusColor}">
            <!-- Drone symbol -->
            <svg class="w-3 h-3" style="color: ${statusColor}" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2l3.5 3.5h-7L12 2zM5.5 8.5L2 12l3.5 3.5V8.5zM18.5 8.5v7L22 12l-3.5-3.5zM8.5 18.5L12 22l3.5-3.5h-7z"/>
              <circle cx="12" cy="12" r="2"/>
            </svg>
          </div>
          
          <!-- Battery indicator -->
          <div class="absolute -bottom-1 -right-1 w-3 h-1.5 rounded-sm border"
               style="background-color: ${batteryColor}; border-color: #30363d">
          </div>
          
          <!-- Status indicator dot -->
          <div class="absolute -top-1 -right-1 w-2 h-2 rounded-full"
               style="background-color: ${statusColor}">
          </div>
        </div>
      `,
      className: 'drone-marker',
      iconSize: [32, 32],
      iconAnchor: [16, 16],
      popupAnchor: [0, -16],
    });
  };

  const formatLastUpdate = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    
    if (diffSeconds < 60) return `${diffSeconds}s ago`;
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
    return `${Math.floor(diffSeconds / 3600)}h ago`;
  };

  const getConnectionQuality = (signalStrength: number) => {
    if (signalStrength > -50) return { level: 'Excellent', color: '#238636' };
    if (signalStrength > -70) return { level: 'Good', color: '#d29922' };
    if (signalStrength > -90) return { level: 'Poor', color: '#da3633' };
    return { level: 'Very Poor', color: '#f85149' };
  };

  const connection = getConnectionQuality(drone.signalStrength);

  if (!drone.position.lat || !drone.position.lng) return null;

  return (
    <Marker
      position={[drone.position.lat, drone.position.lng]}
      icon={createDroneIcon()}
      eventHandlers={{
        click: onSelect,
      }}
    >
      <Popup className="drone-popup" maxWidth={320} minWidth={280}>
        <div className="bg-dark-secondary text-text-primary p-4 rounded-lg border border-dark-border">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-semibold text-lg">{drone.name}</h3>
              <p className="text-text-secondary text-sm">{drone.id}</p>
            </div>
            <div className="text-right">
              <div className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium`}
                   style={{ backgroundColor: getStatusColor(drone.status) + '20', color: getStatusColor(drone.status) }}>
                {drone.status.toUpperCase()}
              </div>
            </div>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            {/* Battery */}
            <div className="bg-dark-tertiary rounded p-2">
              <div className="flex items-center gap-2 mb-1">
                <BatteryIcon className="w-4 h-4 text-text-secondary" />
                <span className="text-xs text-text-secondary">Battery</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-dark-border rounded-full h-1.5">
                  <div 
                    className="h-full rounded-full transition-all duration-300"
                    style={{ 
                      width: `${drone.batteryLevel}%`, 
                      backgroundColor: getBatteryColor(drone.batteryLevel) 
                    }}
                  />
                </div>
                <span className="text-sm font-mono">{drone.batteryLevel}%</span>
              </div>
            </div>

            {/* Signal */}
            <div className="bg-dark-tertiary rounded p-2">
              <div className="flex items-center gap-2 mb-1">
                <SignalIcon className="w-4 h-4 text-text-secondary" />
                <span className="text-xs text-text-secondary">Signal</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: connection.color }}>
                  {connection.level}
                </span>
                <span className="text-sm font-mono text-text-secondary">
                  {drone.signalStrength}dBm
                </span>
              </div>
            </div>
          </div>

          {/* Position & Telemetry */}
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-text-secondary">Altitude</span>
              <span className="font-mono">{drone.position.alt.toFixed(1)}m</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">Speed</span>
              <span className="font-mono">{drone.speed.toFixed(1)} m/s</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">Heading</span>
              <span className="font-mono">{drone.heading.toFixed(0)}°</span>
            </div>
          </div>

          {/* Mission Info */}
          {drone.currentMission && (
            <div className="mt-3 pt-3 border-t border-dark-border">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-status-active"></div>
                <span className="text-sm font-medium">Active Mission</span>
              </div>
              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-text-secondary">Mission</span>
                  <span>{drone.currentMission.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Progress</span>
                  <span>{drone.currentMission.progress}%</span>
                </div>
                {drone.currentMission.eta && (
                  <div className="flex justify-between">
                    <span className="text-text-secondary">ETA</span>
                    <span>{drone.currentMission.eta}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Alerts */}
          {drone.alerts && drone.alerts.length > 0 && (
            <div className="mt-3 pt-3 border-t border-dark-border">
              <div className="flex items-center gap-2 mb-2">
                <ExclamationTriangleIcon className="w-4 h-4 text-status-warning" />
                <span className="text-sm font-medium text-status-warning">
                  {drone.alerts.length} Alert{drone.alerts.length > 1 ? 's' : ''}
                </span>
              </div>
              <div className="space-y-1">
                {drone.alerts.slice(0, 2).map((alert, index) => (
                  <div key={index} className="text-xs p-2 bg-dark-primary rounded border-l-2"
                       style={{ borderLeftColor: alert.severity === 'critical' ? '#da3633' : '#d29922' }}>
                    {alert.message}
                  </div>
                ))}
                {drone.alerts.length > 2 && (
                  <p className="text-xs text-text-secondary">
                    +{drone.alerts.length - 2} more alerts
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="mt-3 pt-3 border-t border-dark-border text-xs text-text-muted">
            Last updated: {formatLastUpdate(drone.lastUpdate)}
          </div>
        </div>
      </Popup>
    </Marker>
  );
};

export default DroneMarker;