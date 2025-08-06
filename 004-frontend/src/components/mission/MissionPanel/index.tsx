import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RocketLaunchIcon,
  MapPinIcon,
  ClockIcon,
  ChartBarIcon,
  PlusIcon,
  EyeIcon
} from '@heroicons/react/24/outline';
import useMissionStore, { useSelectedMission } from '@/store/mission';
import { useFleetStore } from '@/store/fleet';
import MissionCreator from '../MissionCreator';
import WaypointManager from '../WaypointManager';

interface MissionPanelProps {
  className?: string;
  compact?: boolean;
}

const MissionPanel: React.FC<MissionPanelProps> = ({
  className = '',
  compact = false
}) => {
  const {
    missions,
    activeMissions,
    missionStats,
    selectedMissionId,
    selectMission,
    assignMissionToDrone
  } = useMissionStore();
  
  const selectedDrone = useFleetStore((state) => {
    const droneId = state.selectedDroneId;
    return droneId ? state.drones[droneId] : null;
  });
  
  const selectedMission = useSelectedMission();
  const [showCreator, setShowCreator] = useState(false);
  const [showWaypoints, setShowWaypoints] = useState(false);

  // Get missions for selected drone
  const droneMissions = selectedDrone 
    ? Object.values(missions).filter(m => m.assignedDrone === selectedDrone.id)
    : [];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-status-operational';
      case 'completed': return 'text-status-active';
      case 'pending': return 'text-status-warning';
      case 'failed': return 'text-status-critical';
      case 'cancelled': return 'text-text-secondary';
      case 'paused': return 'text-status-warning';
      default: return 'text-text-secondary';
    }
  };

  const handleAssignToSelectedDrone = async (missionId: string) => {
    if (!selectedDrone) return;
    
    try {
      await assignMissionToDrone(missionId, selectedDrone.id);
    } catch (error) {
      console.error('Failed to assign mission:', error);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (compact) {
    return (
      <div className={`bg-dark-secondary rounded-lg border border-dark-border p-4 ${className}`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-text-primary flex items-center gap-2">
            <RocketLaunchIcon className="w-5 h-5" />
            Missions
          </h3>
          <button
            onClick={() => setShowCreator(true)}
            className="p-1 text-text-secondary hover:text-status-active transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Stats */}
        {missionStats && (
          <div className="grid grid-cols-3 gap-2 mb-4 text-sm">
            <div className="text-center p-2 bg-dark-tertiary rounded">
              <div className="text-status-operational font-medium">{missionStats.active}</div>
              <div className="text-text-secondary text-xs">Active</div>
            </div>
            <div className="text-center p-2 bg-dark-tertiary rounded">
              <div className="text-status-warning font-medium">{missionStats.pending}</div>
              <div className="text-text-secondary text-xs">Pending</div>
            </div>
            <div className="text-center p-2 bg-dark-tertiary rounded">
              <div className="text-status-active font-medium">{missionStats.today}</div>
              <div className="text-text-secondary text-xs">Today</div>
            </div>
          </div>
        )}

        {/* Active Missions */}
        <div className="space-y-2">
          {activeMissions.slice(0, 3).map(mission => (
            <div
              key={mission.id}
              className="p-2 bg-dark-tertiary rounded cursor-pointer hover:bg-dark-hover transition-colors"
              onClick={() => selectMission(mission.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="font-medium text-text-primary text-sm truncate">
                    {mission.name}
                  </div>
                  <div className="text-xs text-text-secondary">
                    {mission.assignedDrone || 'Unassigned'} • {mission.progress}%
                  </div>
                </div>
                <div className="w-8 h-1 bg-dark-border rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-status-active transition-all"
                    style={{ width: `${mission.progress}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {activeMissions.length === 0 && (
          <div className="text-center text-text-secondary text-sm py-4">
            No active missions
          </div>
        )}

        <MissionCreator
          isOpen={showCreator}
          onClose={() => setShowCreator(false)}
        />
      </div>
    );
  }

  return (
    <div className={`bg-dark-secondary rounded-lg border border-dark-border ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-dark-border">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <RocketLaunchIcon className="w-6 h-6" />
            Mission Control
          </h2>
          <button
            onClick={() => setShowCreator(true)}
            className="px-3 py-1 bg-status-active hover:bg-status-active/80 text-white 
                     rounded text-sm font-medium transition-colors flex items-center gap-1"
          >
            <PlusIcon className="w-4 h-4" />
            New
          </button>
        </div>

        {/* Stats */}
        {missionStats && (
          <div className="grid grid-cols-4 gap-3 text-sm">
            <div className="text-center">
              <div className="text-status-operational font-medium">{missionStats.active}</div>
              <div className="text-text-secondary text-xs">Active</div>
            </div>
            <div className="text-center">
              <div className="text-status-warning font-medium">{missionStats.pending}</div>
              <div className="text-text-secondary text-xs">Pending</div>
            </div>
            <div className="text-center">
              <div className="text-status-active font-medium">{missionStats.completed}</div>
              <div className="text-text-secondary text-xs">Completed</div>
            </div>
            <div className="text-center">
              <div className="text-text-primary font-medium">{missionStats.today}</div>
              <div className="text-text-secondary text-xs">Today</div>
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Selected Mission Details */}
        {selectedMission ? (
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-text-primary">{selectedMission.name}</h3>
                <p className="text-sm text-text-secondary">{selectedMission.description}</p>
              </div>
              <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(selectedMission.status)}`}>
                {selectedMission.status.toUpperCase()}
              </span>
            </div>

            {/* Mission Progress */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Progress</span>
                <span className="text-text-primary font-medium">{selectedMission.progress}%</span>
              </div>
              <div className="w-full bg-dark-border rounded-full h-2">
                <div 
                  className="bg-status-active h-2 rounded-full transition-all duration-300"
                  style={{ width: `${selectedMission.progress}%` }}
                />
              </div>
            </div>

            {/* Mission Info */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-text-secondary">Priority:</span>
                <div className="text-text-primary font-medium">Level {selectedMission.priority}</div>
              </div>
              <div>
                <span className="text-text-secondary">Waypoints:</span>
                <div className="text-text-primary font-medium">{selectedMission.waypoints?.length || 0}</div>
              </div>
              <div>
                <span className="text-text-secondary">Assigned:</span>
                <div className="text-text-primary font-medium">
                  {selectedMission.assignedDrone || 'Unassigned'}
                </div>
              </div>
              <div>
                <span className="text-text-secondary">Created:</span>
                <div className="text-text-primary font-medium">
                  {formatDate(selectedMission.createdAt)}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              {selectedMission.waypoints && selectedMission.waypoints.length > 0 && (
                <button
                  onClick={() => setShowWaypoints(!showWaypoints)}
                  className="flex items-center gap-1 px-3 py-2 bg-dark-tertiary hover:bg-dark-hover 
                           text-text-primary rounded text-sm transition-colors"
                >
                  <MapPinIcon className="w-4 h-4" />
                  {showWaypoints ? 'Hide' : 'Show'} Waypoints
                </button>
              )}

              {selectedDrone && selectedMission.status === 'pending' && !selectedMission.assignedDrone && (
                <button
                  onClick={() => handleAssignToSelectedDrone(selectedMission.id)}
                  className="flex items-center gap-1 px-3 py-2 bg-status-active hover:bg-status-active/80 
                           text-white rounded text-sm transition-colors"
                >
                  Assign to {selectedDrone.name}
                </button>
              )}
            </div>

            {/* Waypoints */}
            <AnimatePresence>
              {showWaypoints && selectedMission.waypoints && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="border-t border-dark-border pt-4"
                >
                  <WaypointManager
                    waypoints={selectedMission.waypoints}
                    onWaypointsChange={() => {}} // Read-only in this view
                    disabled={true}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : selectedDrone && droneMissions.length > 0 ? (
          // Show drone missions
          <div className="space-y-3">
            <h3 className="font-medium text-text-primary">
              {selectedDrone.name} Missions ({droneMissions.length})
            </h3>
            {droneMissions.map(mission => (
              <div
                key={mission.id}
                className="p-3 bg-dark-tertiary rounded-lg cursor-pointer hover:bg-dark-hover transition-colors"
                onClick={() => selectMission(mission.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-medium text-text-primary">{mission.name}</h4>
                    <p className="text-sm text-text-secondary truncate">{mission.description}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-text-secondary">
                      <span>Priority {mission.priority}</span>
                      <span>{mission.waypoints?.length || 0} waypoints</span>
                      <span>{mission.progress}% complete</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`px-2 py-1 rounded text-xs ${getStatusColor(mission.status)}`}>
                      {mission.status}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        selectMission(mission.id);
                      }}
                      className="p-1 text-text-secondary hover:text-text-primary transition-colors"
                    >
                      <EyeIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          // Empty state
          <div className="text-center py-8">
            {selectedDrone ? (
              <div>
                <RocketLaunchIcon className="w-12 h-12 mx-auto text-text-secondary opacity-50 mb-4" />
                <h3 className="text-lg font-medium text-text-primary mb-2">No missions assigned</h3>
                <p className="text-text-secondary mb-4">
                  {selectedDrone.name} has no missions assigned
                </p>
                <button
                  onClick={() => setShowCreator(true)}
                  className="px-4 py-2 bg-status-active hover:bg-status-active/80 text-white 
                           rounded-lg font-medium transition-colors"
                >
                  Create Mission
                </button>
              </div>
            ) : (
              <div>
                <ChartBarIcon className="w-12 h-12 mx-auto text-text-secondary opacity-50 mb-4" />
                <h3 className="text-lg font-medium text-text-primary mb-2">Mission Overview</h3>
                <p className="text-text-secondary mb-4">
                  Select a drone to view its missions or create a new mission
                </p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="p-3 bg-dark-tertiary rounded">
                    <div className="text-status-operational font-medium text-lg">
                      {activeMissions.length}
                    </div>
                    <div className="text-text-secondary">Active Missions</div>
                  </div>
                  <div className="p-3 bg-dark-tertiary rounded">
                    <div className="text-text-primary font-medium text-lg">
                      {Object.keys(missions).length}
                    </div>
                    <div className="text-text-secondary">Total Missions</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mission Creator Modal */}
      <MissionCreator
        isOpen={showCreator}
        onClose={() => setShowCreator(false)}
      />
    </div>
  );
};

export default MissionPanel;