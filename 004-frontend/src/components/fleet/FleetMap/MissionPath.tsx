import React from 'react';
import { Polyline, Marker, Popup } from 'react-leaflet';
import { divIcon } from 'leaflet';
import { MissionData } from '@/types/fleet';

interface MissionPathProps {
  mission: MissionData;
}

const MissionPath: React.FC<MissionPathProps> = ({ mission }) => {
  const getPathColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
      case 'in_progress':
        return '#1f6feb'; // Blue
      case 'completed':
        return '#238636'; // Green
      case 'failed':
      case 'cancelled':
        return '#da3633'; // Red
      case 'pending':
      default:
        return '#8b949e'; // Gray
    }
  };

  const createWaypointIcon = (waypoint: any, index: number) => {
    const isCompleted = waypoint.completed || index < (mission.currentWaypoint || 0);
    const isCurrent = index === (mission.currentWaypoint || 0);
    
    return divIcon({
      html: `
        <div class="relative">
          <div class="w-4 h-4 rounded-full border-2 flex items-center justify-center text-xs font-bold"
               style="background-color: ${isCompleted ? '#238636' : isCurrent ? '#1f6feb' : '#161b22'}; 
                      border-color: ${isCompleted ? '#238636' : isCurrent ? '#1f6feb' : '#8b949e'};
                      color: #f0f6fc">
            ${index + 1}
          </div>
          ${isCurrent ? `
            <div class="absolute inset-0 animate-ping">
              <div class="w-4 h-4 bg-blue-400 rounded-full opacity-30"></div>
            </div>
          ` : ''}
        </div>
      `,
      className: 'waypoint-marker',
      iconSize: [16, 16],
      iconAnchor: [8, 8],
      popupAnchor: [0, -8],
    });
  };

  const getActionIcon = (action: string) => {
    switch (action.toLowerCase()) {
      case 'pickup':
        return '📦';
      case 'delivery':
        return '🚚';
      case 'hover':
        return '⏸️';
      case 'survey':
        return '📷';
      default:
        return '📍';
    }
  };

  if (!mission.waypoints || mission.waypoints.length === 0) return null;

  const pathPositions: [number, number][] = mission.waypoints
    .filter(wp => wp.position.lat && wp.position.lng)
    .map(wp => [wp.position.lat, wp.position.lng]);

  if (pathPositions.length === 0) return null;

  const pathColor = getPathColor(mission.status);

  return (
    <>
      {/* Mission path */}
      <Polyline
        positions={pathPositions}
        pathOptions={{
          color: pathColor,
          weight: 3,
          opacity: 0.8,
          dashArray: mission.status === 'pending' ? '10, 5' : undefined,
        }}
      />

      {/* Waypoint markers */}
      {mission.waypoints.map((waypoint, index) => {
        if (!waypoint.position.lat || !waypoint.position.lng) return null;

        return (
          <Marker
            key={`${mission.id}-wp-${index}`}
            position={[waypoint.position.lat, waypoint.position.lng]}
            icon={createWaypointIcon(waypoint, index)}
          >
            <Popup className="waypoint-popup" maxWidth={250}>
              <div className="bg-dark-secondary text-text-primary p-3 rounded-lg border border-dark-border">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold">
                    Waypoint {index + 1}
                  </h4>
                  <span className="text-lg">
                    {getActionIcon(waypoint.action)}
                  </span>
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Action</span>
                    <span className="capitalize">{waypoint.action}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Altitude</span>
                    <span className="font-mono">{waypoint.position.alt}m</span>
                  </div>
                  
                  {waypoint.hoverTime && (
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Hover Time</span>
                      <span className="font-mono">{waypoint.hoverTime}s</span>
                    </div>
                  )}
                  
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Status</span>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      waypoint.completed || index < (mission.currentWaypoint || 0)
                        ? 'bg-green-900/30 text-green-400' 
                        : index === (mission.currentWaypoint || 0)
                        ? 'bg-blue-900/30 text-blue-400'
                        : 'bg-gray-900/30 text-gray-400'
                    }`}>
                      {waypoint.completed || index < (mission.currentWaypoint || 0) 
                        ? 'Completed' 
                        : index === (mission.currentWaypoint || 0)
                        ? 'Current'
                        : 'Pending'}
                    </span>
                  </div>
                </div>

                {waypoint.notes && (
                  <div className="mt-2 pt-2 border-t border-dark-border">
                    <p className="text-xs text-text-secondary">{waypoint.notes}</p>
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        );
      })}
    </>
  );
};

export default MissionPath;