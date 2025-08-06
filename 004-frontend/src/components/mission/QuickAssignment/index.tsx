import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  UserIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { MissionData } from '@/types/fleet';
import { useFleetStore } from '@/store/fleet';
import useMissionStore from '@/store/mission';

interface QuickAssignmentProps {
  mission: MissionData;
  onAssigned?: (missionId: string, droneId: string) => void;
  className?: string;
}

const QuickAssignment: React.FC<QuickAssignmentProps> = ({
  mission,
  onAssigned,
  className = ''
}) => {
  const drones = useFleetStore((state) => Object.values(state.drones));
  const { assignMissionToDrone, missions } = useMissionStore();
  const [assigning, setAssigning] = useState(false);
  const [showOptions, setShowOptions] = useState(false);

  // Find best available drone
  const getAvailableDrones = () => {
    return drones.filter(drone => {
      // Must not be in maintenance or emergency
      if (drone.status === 'maintenance' || drone.status === 'emergency') {
        return false;
      }

      // Must have sufficient battery
      if (drone.batteryLevel < 30) {
        return false;
      }

      // Must not have active mission
      const hasActiveMission = Object.values(missions).some(m => 
        m.assignedDrone === drone.id && ['pending', 'active', 'paused'].includes(m.status)
      );
      if (hasActiveMission) {
        return false;
      }

      return true;
    });
  };

  const getBestDrone = () => {
    const availableDrones = getAvailableDrones();
    if (availableDrones.length === 0) return null;

    // Score drones based on multiple factors
    const scoredDrones = availableDrones.map(drone => {
      let score = 0;
      
      // Battery score (0-30 points)
      score += Math.floor(drone.batteryLevel * 0.3);
      
      // Signal strength score (0-20 points)
      score += Math.floor(drone.signalStrength * 0.2);
      
      // Status preference (idle > charging > in_flight/active)
      if (drone.status === 'idle') score += 30;
      else if (drone.status === 'charging') score += 20;
      else if (drone.status === 'active' || drone.status === 'in_flight') score += 10;
      
      // Distance to mission start (if waypoints available)
      if (mission.waypoints && mission.waypoints.length > 0) {
        const distance = calculateDistance(drone.position, mission.waypoints[0].position);
        // Closer is better (max 20 points, decreases with distance)
        const distanceScore = Math.max(0, 20 - (distance / 5000)); // 5km = 0 points
        score += distanceScore;
      }

      return { drone, score };
    });

    // Return the highest scored drone
    scoredDrones.sort((a, b) => b.score - a.score);
    return scoredDrones[0]?.drone || null;
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

  const handleQuickAssign = async (droneId: string) => {
    setAssigning(true);
    try {
      await assignMissionToDrone(mission.id, droneId);
      onAssigned?.(mission.id, droneId);
      setShowOptions(false);
    } catch (error) {
      console.error('Failed to assign mission:', error);
    } finally {
      setAssigning(false);
    }
  };

  const availableDrones = getAvailableDrones();
  const bestDrone = getBestDrone();

  if (mission.assignedDrone) {
    const assignedDrone = drones.find(d => d.id === mission.assignedDrone);
    return (
      <div className={`flex items-center gap-2 text-sm ${className}`}>
        <CheckCircleIcon className="w-4 h-4 text-status-operational" />
        <span className="text-text-secondary">Assigned to:</span>
        <span className="text-text-primary font-medium">
          {assignedDrone?.name || mission.assignedDrone}
        </span>
      </div>
    );
  }

  if (availableDrones.length === 0) {
    return (
      <div className={`flex items-center gap-2 text-sm text-status-critical ${className}`}>
        <XCircleIcon className="w-4 h-4" />
        <span>No available drones</span>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {!showOptions ? (
        <div className="flex items-center gap-2">
          {bestDrone && (
            <>
              <button
                onClick={() => handleQuickAssign(bestDrone.id)}
                disabled={assigning}
                className="flex items-center gap-2 px-3 py-2 bg-status-active hover:bg-status-active/80 
                         text-white rounded-lg text-sm font-medium transition-colors
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
                    Auto-assign to {bestDrone.name}
                  </>
                )}
              </button>
              
              <button
                onClick={() => setShowOptions(true)}
                className="px-3 py-2 border border-dark-border hover:border-dark-hover 
                         text-text-secondary hover:text-text-primary rounded-lg text-sm transition-colors"
              >
                Choose Drone ({availableDrones.length} available)
              </button>
            </>
          )}
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-0 left-0 z-10 bg-dark-secondary border border-dark-border 
                     rounded-lg shadow-lg p-3 min-w-80"
        >
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-text-primary">Choose Drone</h4>
            <button
              onClick={() => setShowOptions(false)}
              className="text-text-secondary hover:text-text-primary"
            >
              <XCircleIcon className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto">
            {availableDrones.map(drone => {
              const isBest = drone.id === bestDrone?.id;
              const hasWarning = drone.batteryLevel < 50 || drone.signalStrength < 70;
              
              return (
                <button
                  key={drone.id}
                  onClick={() => handleQuickAssign(drone.id)}
                  disabled={assigning}
                  className="w-full p-3 text-left border border-dark-border hover:border-dark-hover 
                           rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                           hover:bg-dark-hover"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-text-primary">{drone.name}</span>
                      {isBest && (
                        <span className="px-2 py-0.5 bg-status-active text-white text-xs rounded-full">
                          Best Match
                        </span>
                      )}
                    </div>
                    {hasWarning && (
                      <ExclamationTriangleIcon className="w-4 h-4 text-status-warning" />
                    )}
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2 text-xs text-text-secondary">
                    <div>
                      <span className="text-text-secondary">Battery:</span>
                      <div className={`font-medium ${
                        drone.batteryLevel > 70 ? 'text-status-operational' : 
                        drone.batteryLevel > 30 ? 'text-status-warning' : 'text-status-critical'
                      }`}>
                        {drone.batteryLevel}%
                      </div>
                    </div>
                    <div>
                      <span className="text-text-secondary">Signal:</span>
                      <div className="text-text-primary font-medium">{drone.signalStrength}%</div>
                    </div>
                    <div>
                      <span className="text-text-secondary">Status:</span>
                      <div className="text-text-primary font-medium capitalize">{drone.status}</div>
                    </div>
                  </div>
                  
                  {mission.waypoints && mission.waypoints.length > 0 && (
                    <div className="mt-2 text-xs text-text-secondary">
                      Distance to start: {(calculateDistance(drone.position, mission.waypoints[0].position) / 1000).toFixed(1)}km
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default QuickAssignment;