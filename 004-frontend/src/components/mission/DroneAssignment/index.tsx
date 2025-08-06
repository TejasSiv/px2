import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  UserIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  MapPinIcon,
  Battery0Icon,
  SignalIcon,
  ExclamationTriangleIcon,
  ArrowRightIcon
} from '@heroicons/react/24/outline';
import { MissionData, DroneData } from '@/types/fleet';
import { useFleetStore } from '@/store/fleet';
import useMissionStore from '@/store/mission';

interface DroneAssignmentProps {
  mission: MissionData;
  isOpen: boolean;
  onClose: () => void;
  onAssigned?: (missionId: string, droneId: string) => void;
}

interface DroneCompatibility {
  drone: DroneData;
  compatible: boolean;
  score: number;
  issues: string[];
  warnings: string[];
}

const DroneAssignment: React.FC<DroneAssignmentProps> = ({
  mission,
  isOpen,
  onClose,
  onAssigned
}) => {
  const drones = useFleetStore((state) => Object.values(state.drones));
  const { assignMissionToDrone, missions } = useMissionStore();
  const [selectedDroneId, setSelectedDroneId] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [droneCompatibility, setDroneCompatibility] = useState<DroneCompatibility[]>([]);

  useEffect(() => {
    if (isOpen) {
      analyzeDroneCompatibility();
    }
  }, [isOpen, mission, drones]);

  const analyzeDroneCompatibility = () => {
    const compatibility: DroneCompatibility[] = drones.map(drone => {
      const issues: string[] = [];
      const warnings: string[] = [];
      let score = 100;

      // Check drone status
      if (drone.status === 'maintenance' || drone.status === 'emergency') {
        issues.push(`Drone is in ${drone.status} mode`);
        score -= 100;
      }

      if (drone.status === 'charging') {
        warnings.push('Drone is currently charging');
        score -= 20;
      }

      // Check battery level
      if (drone.batteryLevel < 30) {
        issues.push(`Low battery: ${drone.batteryLevel}%`);
        score -= 50;
      } else if (drone.batteryLevel < 50) {
        warnings.push(`Medium battery: ${drone.batteryLevel}%`);
        score -= 20;
      }

      // Check signal strength
      if (drone.signalStrength < 50) {
        warnings.push(`Weak signal: ${drone.signalStrength}%`);
        score -= 10;
      }

      // Check existing mission assignment
      const existingMission = Object.values(missions).find(m => 
        m.assignedDrone === drone.id && ['pending', 'active', 'paused'].includes(m.status)
      );
      if (existingMission) {
        issues.push(`Already assigned to: ${existingMission.name}`);
        score -= 80;
      }

      // Check distance to first waypoint
      if (mission.waypoints && mission.waypoints.length > 0) {
        const firstWaypoint = mission.waypoints[0];
        const distance = calculateDistance(drone.position, firstWaypoint.position);
        if (distance > 50000) { // 50km
          warnings.push(`Far from start: ${(distance / 1000).toFixed(1)}km`);
          score -= 15;
        }
      }

      // Priority bonus/penalty
      if (mission.priority >= 8) {
        score += 10; // High priority missions get slight preference
      }

      // Flight time consideration
      if (drone.totalFlightTime && drone.totalFlightTime > 3600) { // 1 hour
        warnings.push('Drone has been flying for extended time');
        score -= 5;
      }

      const compatible = score > 0 && issues.length === 0;

      return {
        drone,
        compatible,
        score: Math.max(0, score),
        issues,
        warnings
      };
    });

    // Sort by compatibility score (best first)
    compatibility.sort((a, b) => b.score - a.score);
    setDroneCompatibility(compatibility);
  };

  const calculateDistance = (pos1: { lat: number; lng: number }, pos2: { lat: number; lng: number }) => {
    const R = 6371000; // Earth's radius in meters
    const lat1Rad = pos1.lat * Math.PI / 180;
    const lat2Rad = pos2.lat * Math.PI / 180;
    const deltaLat = (pos2.lat - pos1.lat) * Math.PI / 180;
    const deltaLng = (pos2.lng - pos1.lng) * Math.PI / 180;

    const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
              Math.cos(lat1Rad) * Math.cos(lat2Rad) *
              Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
      case 'in_flight':
        return 'text-status-operational bg-status-operational/10';
      case 'idle':
        return 'text-status-active bg-status-active/10';
      case 'charging':
        return 'text-status-warning bg-status-warning/10';
      case 'maintenance':
      case 'emergency':
        return 'text-status-critical bg-status-critical/10';
      default:
        return 'text-text-secondary bg-text-secondary/10';
    }
  };

  const getBatteryColor = (level: number) => {
    if (level > 70) return 'text-status-operational';
    if (level > 30) return 'text-status-warning';
    return 'text-status-critical';
  };

  const getCompatibilityIndicator = (compatibility: DroneCompatibility) => {
    if (!compatibility.compatible) {
      return <XCircleIcon className="w-5 h-5 text-status-critical" />;
    }
    if (compatibility.score >= 80) {
      return <CheckCircleIcon className="w-5 h-5 text-status-operational" />;
    }
    if (compatibility.score >= 60) {
      return <ClockIcon className="w-5 h-5 text-status-warning" />;
    }
    return <ExclamationTriangleIcon className="w-5 h-5 text-status-warning" />;
  };

  const handleAssign = async () => {
    if (!selectedDroneId) return;

    setAssigning(true);
    try {
      await assignMissionToDrone(mission.id, selectedDroneId);
      onAssigned?.(mission.id, selectedDroneId);
      onClose();
    } catch (error) {
      console.error('Failed to assign mission:', error);
    } finally {
      setAssigning(false);
    }
  };

  const estimateFlightTime = (compatibility: DroneCompatibility) => {
    if (!mission.waypoints || mission.waypoints.length === 0) return null;
    
    const speed = 10; // m/s average speed
    let totalTime = 0;
    let currentPos = compatibility.drone.position;
    
    // Time to reach first waypoint
    const distanceToStart = calculateDistance(currentPos, mission.waypoints[0].position);
    totalTime += distanceToStart / speed;
    
    // Time for mission waypoints
    for (let i = 1; i < mission.waypoints.length; i++) {
      const distance = calculateDistance(mission.waypoints[i - 1].position, mission.waypoints[i].position);
      totalTime += distance / speed;
      
      if (mission.waypoints[i].hoverTime) {
        totalTime += mission.waypoints[i].hoverTime!;
      }
    }
    
    return totalTime;
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  if (!isOpen) return null;

  const selectedCompatibility = droneCompatibility.find(d => d.drone.id === selectedDroneId);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10001] p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-dark-secondary rounded-lg border border-dark-border shadow-xl
                   w-full max-w-4xl max-h-[90vh] overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-dark-border">
          <div>
            <h2 className="text-xl font-semibold text-text-primary">Assign Mission to Drone</h2>
            <p className="text-text-secondary mt-1">
              Mission: <span className="font-medium">{mission.name}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-dark-hover rounded-lg transition-colors"
          >
            <XCircleIcon className="w-5 h-5 text-text-secondary" />
          </button>
        </div>

        <div className="flex h-full">
          {/* Drone List */}
          <div className="w-1/2 border-r border-dark-border">
            <div className="p-4 border-b border-dark-border">
              <h3 className="font-medium text-text-primary">Available Drones ({droneCompatibility.length})</h3>
              <p className="text-sm text-text-secondary mt-1">
                Select a drone to assign this mission
              </p>
            </div>

            <div className="overflow-y-auto max-h-[60vh] p-4 space-y-3">
              {droneCompatibility.map((compatibility) => (
                <motion.div
                  key={compatibility.drone.id}
                  className={`p-4 rounded-lg border cursor-pointer transition-all
                    ${selectedDroneId === compatibility.drone.id
                      ? 'border-status-active bg-status-active/5'
                      : 'border-dark-border hover:border-dark-hover bg-dark-tertiary hover:bg-dark-hover'
                    }
                    ${!compatibility.compatible ? 'opacity-50' : ''}
                  `}
                  onClick={() => compatibility.compatible && setSelectedDroneId(compatibility.drone.id)}
                  whileHover={compatibility.compatible ? { scale: 1.02 } : {}}
                  whileTap={compatibility.compatible ? { scale: 0.98 } : {}}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      {getCompatibilityIndicator(compatibility)}
                      <div>
                        <h4 className="font-medium text-text-primary">{compatibility.drone.name}</h4>
                        <p className="text-sm text-text-secondary">{compatibility.drone.id}</p>
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-end gap-1">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(compatibility.drone.status)}`}>
                        {compatibility.drone.status.toUpperCase()}
                      </span>
                      <div className="text-sm font-medium text-text-primary">
                        Score: {compatibility.score}/100
                      </div>
                    </div>
                  </div>

                  {/* Drone Stats */}
                  <div className="grid grid-cols-3 gap-3 mb-3 text-sm">
                    <div className="flex items-center gap-1">
                      <Battery0Icon className={`w-4 h-4 ${getBatteryColor(compatibility.drone.batteryLevel)}`} />
                      <span className={getBatteryColor(compatibility.drone.batteryLevel)}>
                        {compatibility.drone.batteryLevel}%
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <SignalIcon className="w-4 h-4 text-text-secondary" />
                      <span className="text-text-primary">{compatibility.drone.signalStrength}%</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <MapPinIcon className="w-4 h-4 text-text-secondary" />
                      <span className="text-text-primary text-xs">
                        {compatibility.drone.position.lat.toFixed(3)}, {compatibility.drone.position.lng.toFixed(3)}
                      </span>
                    </div>
                  </div>

                  {/* Issues and Warnings */}
                  {compatibility.issues.length > 0 && (
                    <div className="mb-2">
                      {compatibility.issues.map((issue, index) => (
                        <div key={index} className="flex items-center gap-2 text-xs text-status-critical">
                          <XCircleIcon className="w-3 h-3" />
                          {issue}
                        </div>
                      ))}
                    </div>
                  )}

                  {compatibility.warnings.length > 0 && (
                    <div className="mb-2">
                      {compatibility.warnings.map((warning, index) => (
                        <div key={index} className="flex items-center gap-2 text-xs text-status-warning">
                          <ExclamationTriangleIcon className="w-3 h-3" />
                          {warning}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Flight Time Estimate */}
                  {compatibility.compatible && (
                    <div className="text-xs text-text-secondary">
                      Estimated flight time: {formatTime(estimateFlightTime(compatibility) || 0)}
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>

          {/* Assignment Details */}
          <div className="w-1/2 flex flex-col">
            {selectedCompatibility ? (
              <>
                <div className="p-4 border-b border-dark-border">
                  <h3 className="font-medium text-text-primary mb-2">Assignment Preview</h3>
                  <div className="flex items-center gap-3 p-3 bg-dark-tertiary rounded-lg">
                    <div className="text-center">
                      <div className="font-medium text-text-primary">{mission.name}</div>
                      <div className="text-xs text-text-secondary">Mission</div>
                    </div>
                    <ArrowRightIcon className="w-5 h-5 text-status-active" />
                    <div className="text-center">
                      <div className="font-medium text-text-primary">{selectedCompatibility.drone.name}</div>
                      <div className="text-xs text-text-secondary">Drone</div>
                    </div>
                  </div>
                </div>

                <div className="flex-1 p-4 overflow-y-auto">
                  {/* Mission Details */}
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium text-text-primary mb-2">Mission Details</h4>
                      <div className="bg-dark-tertiary rounded-lg p-3 space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-text-secondary">Priority:</span>
                          <span className="text-text-primary font-medium">Level {mission.priority}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-text-secondary">Waypoints:</span>
                          <span className="text-text-primary font-medium">{mission.waypoints?.length || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-text-secondary">Status:</span>
                          <span className="text-status-warning font-medium">{mission.status.toUpperCase()}</span>
                        </div>
                      </div>
                    </div>

                    {/* Drone Readiness */}
                    <div>
                      <h4 className="font-medium text-text-primary mb-2">Drone Readiness</h4>
                      <div className="bg-dark-tertiary rounded-lg p-3 space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-text-secondary">Compatibility Score:</span>
                          <span className="text-text-primary font-medium">{selectedCompatibility.score}/100</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-text-secondary">Battery Level:</span>
                          <span className={`font-medium ${getBatteryColor(selectedCompatibility.drone.batteryLevel)}`}>
                            {selectedCompatibility.drone.batteryLevel}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-text-secondary">Signal Strength:</span>
                          <span className="text-text-primary font-medium">{selectedCompatibility.drone.signalStrength}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-text-secondary">Current Status:</span>
                          <span className="text-text-primary font-medium">{selectedCompatibility.drone.status.toUpperCase()}</span>
                        </div>
                      </div>
                    </div>

                    {/* Flight Estimate */}
                    <div>
                      <h4 className="font-medium text-text-primary mb-2">Flight Estimate</h4>
                      <div className="bg-dark-tertiary rounded-lg p-3 space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-text-secondary">Estimated Duration:</span>
                          <span className="text-text-primary font-medium">
                            {formatTime(estimateFlightTime(selectedCompatibility) || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-text-secondary">Distance to Start:</span>
                          <span className="text-text-primary font-medium">
                            {mission.waypoints && mission.waypoints.length > 0 
                              ? `${(calculateDistance(selectedCompatibility.drone.position, mission.waypoints[0].position) / 1000).toFixed(1)}km`
                              : 'N/A'
                            }
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Warnings/Issues */}
                    {(selectedCompatibility.issues.length > 0 || selectedCompatibility.warnings.length > 0) && (
                      <div>
                        <h4 className="font-medium text-text-primary mb-2">Considerations</h4>
                        <div className="space-y-2">
                          {selectedCompatibility.issues.map((issue, index) => (
                            <div key={index} className="flex items-start gap-2 p-2 bg-status-critical/10 rounded text-sm">
                              <XCircleIcon className="w-4 h-4 text-status-critical mt-0.5" />
                              <span className="text-status-critical">{issue}</span>
                            </div>
                          ))}
                          {selectedCompatibility.warnings.map((warning, index) => (
                            <div key={index} className="flex items-start gap-2 p-2 bg-status-warning/10 rounded text-sm">
                              <ExclamationTriangleIcon className="w-4 h-4 text-status-warning mt-0.5" />
                              <span className="text-status-warning">{warning}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Assignment Actions */}
                <div className="p-4 border-t border-dark-border">
                  <div className="flex justify-between items-center">
                    <div className="text-sm text-text-secondary">
                      {selectedCompatibility.compatible 
                        ? 'Ready to assign mission' 
                        : 'Cannot assign due to compatibility issues'
                      }
                    </div>
                    
                    <div className="flex gap-3">
                      <button
                        onClick={onClose}
                        disabled={assigning}
                        className="px-4 py-2 text-text-secondary hover:text-text-primary transition-colors
                                 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleAssign}
                        disabled={!selectedCompatibility.compatible || assigning}
                        className="flex items-center gap-2 px-6 py-2 bg-status-active hover:bg-status-active/80 
                                 text-white rounded-lg font-medium transition-colors
                                 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {assigning ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Assigning...
                          </>
                        ) : (
                          <>
                            <UserIcon className="w-4 h-4" />
                            Assign Mission
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center p-8">
                <div className="text-center">
                  <UserIcon className="w-12 h-12 mx-auto text-text-secondary opacity-50 mb-4" />
                  <h3 className="text-lg font-medium text-text-primary mb-2">Select a Drone</h3>
                  <p className="text-text-secondary">
                    Choose a drone from the list to see assignment details
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default DroneAssignment;