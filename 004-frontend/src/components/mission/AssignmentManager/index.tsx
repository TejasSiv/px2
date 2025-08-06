import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UserIcon,
  ArrowPathIcon,
  XMarkIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { MissionData, DroneData } from '@/types/fleet';
import { useFleetStore } from '@/store/fleet';
import useMissionStore from '@/store/mission';
import DroneAssignment from '../DroneAssignment';

interface AssignmentManagerProps {
  className?: string;
}

interface Assignment {
  mission: MissionData;
  drone: DroneData | null;
  status: 'assigned' | 'unassigned' | 'conflict';
  issues: string[];
}

const AssignmentManager: React.FC<AssignmentManagerProps> = ({ className = '' }) => {
  const drones = useFleetStore((state) => Object.values(state.drones));
  const dronesMap = useFleetStore((state) => state.drones);
  const { missions, updateMission } = useMissionStore();
  
  const [selectedMissionForAssignment, setSelectedMissionForAssignment] = useState<MissionData | null>(null);
  const [filter, setFilter] = useState<'all' | 'assigned' | 'unassigned' | 'issues'>('all');

  // Create assignment data
  const assignments = useMemo<Assignment[]>(() => {
    return Object.values(missions)
      .filter(mission => ['pending', 'active', 'paused'].includes(mission.status))
      .map(mission => {
        const drone = mission.assignedDrone ? dronesMap[mission.assignedDrone] : null;
        const issues: string[] = [];
        let status: Assignment['status'] = 'unassigned';

        if (mission.assignedDrone) {
          if (!drone) {
            issues.push('Assigned drone not found');
            status = 'conflict';
          } else {
            status = 'assigned';
            
            // Check drone health
            if (drone.status === 'maintenance' || drone.status === 'emergency') {
              issues.push(`Drone is in ${drone.status} mode`);
              status = 'conflict';
            }
            
            if (drone.batteryLevel < 20) {
              issues.push(`Critical battery: ${drone.batteryLevel}%`);
              status = 'conflict';
            } else if (drone.batteryLevel < 30) {
              issues.push(`Low battery: ${drone.batteryLevel}%`);
            }
            
            if (drone.signalStrength < 30) {
              issues.push(`Poor signal: ${drone.signalStrength}%`);
            }
          }
        }

        return {
          mission,
          drone,
          status,
          issues
        };
      })
      .sort((a, b) => {
        // Sort by priority first, then by status issues
        if (a.mission.priority !== b.mission.priority) {
          return b.mission.priority - a.mission.priority;
        }
        
        if (a.status !== b.status) {
          const statusOrder = { conflict: 0, unassigned: 1, assigned: 2 };
          return statusOrder[a.status] - statusOrder[b.status];
        }
        
        return new Date(b.mission.createdAt).getTime() - new Date(a.mission.createdAt).getTime();
      });
  }, [missions, dronesMap]);

  // Filter assignments
  const filteredAssignments = assignments.filter(assignment => {
    switch (filter) {
      case 'assigned':
        return assignment.status === 'assigned' && assignment.issues.length === 0;
      case 'unassigned':
        return assignment.status === 'unassigned';
      case 'issues':
        return assignment.status === 'conflict' || assignment.issues.length > 0;
      default:
        return true;
    }
  });

  const getStatusIcon = (assignment: Assignment) => {
    switch (assignment.status) {
      case 'assigned':
        return assignment.issues.length > 0 
          ? <ExclamationTriangleIcon className="w-5 h-5 text-status-warning" />
          : <CheckCircleIcon className="w-5 h-5 text-status-operational" />;
      case 'conflict':
        return <XMarkIcon className="w-5 h-5 text-status-critical" />;
      case 'unassigned':
      default:
        return <ClockIcon className="w-5 h-5 text-text-secondary" />;
    }
  };

  const getStatusColor = (assignment: Assignment) => {
    switch (assignment.status) {
      case 'assigned':
        return assignment.issues.length > 0 
          ? 'border-status-warning bg-status-warning/5'
          : 'border-status-operational bg-status-operational/5';
      case 'conflict':
        return 'border-status-critical bg-status-critical/5';
      case 'unassigned':
      default:
        return 'border-text-secondary bg-text-secondary/5';
    }
  };

  const handleUnassign = async (missionId: string) => {
    try {
      await updateMission(missionId, { assignedDrone: undefined });
    } catch (error) {
      console.error('Failed to unassign mission:', error);
    }
  };

  const getAvailableDronesCount = () => {
    return drones.filter(drone => {
      // Must be operational
      if (['maintenance', 'emergency'].includes(drone.status)) return false;
      
      // Must have sufficient battery
      if (drone.batteryLevel < 30) return false;
      
      // Must not have active mission
      const hasActiveMission = Object.values(missions).some(m => 
        m.assignedDrone === drone.id && ['pending', 'active', 'paused'].includes(m.status)
      );
      
      return !hasActiveMission;
    }).length;
  };

  const stats = {
    total: assignments.length,
    assigned: assignments.filter(a => a.status === 'assigned' && a.issues.length === 0).length,
    unassigned: assignments.filter(a => a.status === 'unassigned').length,
    issues: assignments.filter(a => a.status === 'conflict' || a.issues.length > 0).length,
    availableDrones: getAvailableDronesCount()
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-text-primary">Assignment Manager</h2>
          <p className="text-text-secondary mt-1">
            Manage mission-to-drone assignments • {stats.availableDrones} drones available
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-dark-secondary rounded-lg border border-dark-border p-4 text-center">
          <div className="text-2xl font-bold text-text-primary">{stats.total}</div>
          <div className="text-sm text-text-secondary">Total Missions</div>
        </div>
        <div className="bg-dark-secondary rounded-lg border border-dark-border p-4 text-center">
          <div className="text-2xl font-bold text-status-operational">{stats.assigned}</div>
          <div className="text-sm text-text-secondary">Assigned</div>
        </div>
        <div className="bg-dark-secondary rounded-lg border border-dark-border p-4 text-center">
          <div className="text-2xl font-bold text-text-secondary">{stats.unassigned}</div>
          <div className="text-sm text-text-secondary">Unassigned</div>
        </div>
        <div className="bg-dark-secondary rounded-lg border border-dark-border p-4 text-center">
          <div className="text-2xl font-bold text-status-warning">{stats.issues}</div>
          <div className="text-sm text-text-secondary">Issues</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 p-4 bg-dark-secondary rounded-lg border border-dark-border">
        <span className="text-text-secondary font-medium">Filter:</span>
        <div className="flex gap-2">
          {[
            { value: 'all', label: `All (${stats.total})` },
            { value: 'assigned', label: `Assigned (${stats.assigned})` },
            { value: 'unassigned', label: `Unassigned (${stats.unassigned})` },
            { value: 'issues', label: `Issues (${stats.issues})` }
          ].map(option => (
            <button
              key={option.value}
              onClick={() => setFilter(option.value as any)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === option.value
                  ? 'bg-status-active text-white'
                  : 'text-text-secondary hover:text-text-primary hover:bg-dark-hover'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Assignment List */}
      <div className="space-y-3">
        <AnimatePresence>
          {filteredAssignments.map(assignment => (
            <motion.div
              key={assignment.mission.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={`p-6 rounded-lg border-2 transition-all ${getStatusColor(assignment)}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  {/* Header */}
                  <div className="flex items-center gap-3 mb-3">
                    {getStatusIcon(assignment)}
                    <div>
                      <h3 className="text-lg font-semibold text-text-primary">
                        {assignment.mission.name}
                      </h3>
                      <p className="text-sm text-text-secondary">
                        Priority {assignment.mission.priority} • {assignment.mission.waypoints?.length || 0} waypoints
                      </p>
                    </div>
                  </div>

                  {/* Assignment Status */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-4">
                    <div>
                      <h4 className="font-medium text-text-primary mb-2">Mission Status</h4>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-text-secondary">Status:</span>
                          <span className="text-text-primary capitalize">{assignment.mission.status}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-text-secondary">Progress:</span>
                          <span className="text-text-primary">{assignment.mission.progress}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-text-secondary">Created:</span>
                          <span className="text-text-primary">
                            {new Date(assignment.mission.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium text-text-primary mb-2">Assignment</h4>
                      <div className="space-y-1 text-sm">
                        {assignment.drone ? (
                          <>
                            <div className="flex justify-between">
                              <span className="text-text-secondary">Assigned to:</span>
                              <span className="text-text-primary font-medium">{assignment.drone.name}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-text-secondary">Drone Status:</span>
                              <span className="text-text-primary capitalize">{assignment.drone.status}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-text-secondary">Battery:</span>
                              <span className={`font-medium ${
                                assignment.drone.batteryLevel > 70 ? 'text-status-operational' :
                                assignment.drone.batteryLevel > 30 ? 'text-status-warning' : 'text-status-critical'
                              }`}>
                                {assignment.drone.batteryLevel}%
                              </span>
                            </div>
                          </>
                        ) : (
                          <div className="text-text-secondary">No drone assigned</div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Issues */}
                  {assignment.issues.length > 0 && (
                    <div className="mb-4">
                      <h4 className="font-medium text-status-warning mb-2 flex items-center gap-2">
                        <ExclamationTriangleIcon className="w-4 h-4" />
                        Issues
                      </h4>
                      <div className="space-y-1">
                        {assignment.issues.map((issue, index) => (
                          <div key={index} className="flex items-start gap-2 text-sm">
                            <div className="w-1 h-1 bg-status-warning rounded-full mt-2 flex-shrink-0" />
                            <span className="text-status-warning">{issue}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Mission Description */}
                  {assignment.mission.description && (
                    <p className="text-sm text-text-secondary line-clamp-2">
                      {assignment.mission.description}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2 ml-6">
                  {assignment.status === 'unassigned' ? (
                    <button
                      onClick={() => setSelectedMissionForAssignment(assignment.mission)}
                      className="flex items-center gap-2 px-4 py-2 bg-status-active hover:bg-status-active/80 
                               text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      <UserIcon className="w-4 h-4" />
                      Assign Drone
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => setSelectedMissionForAssignment(assignment.mission)}
                        className="flex items-center gap-2 px-4 py-2 bg-dark-tertiary hover:bg-dark-hover 
                                 text-text-primary rounded-lg text-sm font-medium transition-colors border border-dark-border"
                      >
                        <ArrowPathIcon className="w-4 h-4" />
                        Reassign
                      </button>
                      
                      <button
                        onClick={() => handleUnassign(assignment.mission.id)}
                        className="flex items-center gap-2 px-4 py-2 text-text-secondary hover:text-status-critical 
                                 hover:bg-status-critical/10 rounded-lg text-sm transition-colors"
                      >
                        <XMarkIcon className="w-4 h-4" />
                        Unassign
                      </button>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Empty State */}
      {filteredAssignments.length === 0 && (
        <div className="text-center py-12">
          <UserIcon className="w-12 h-12 mx-auto text-text-secondary opacity-50 mb-4" />
          <h3 className="text-lg font-medium text-text-primary mb-2">
            {filter === 'all' ? 'No missions to assign' : `No ${filter} missions`}
          </h3>
          <p className="text-text-secondary mb-4">
            {filter === 'all' 
              ? 'Create missions to start managing assignments'
              : `Change the filter to see other missions`
            }
          </p>
          {filter !== 'all' && (
            <button
              onClick={() => setFilter('all')}
              className="px-4 py-2 bg-dark-tertiary hover:bg-dark-hover text-text-primary 
                       rounded-lg transition-colors"
            >
              Show All Missions
            </button>
          )}
        </div>
      )}

      {/* Assignment Modal */}
      {selectedMissionForAssignment && (
        <DroneAssignment
          mission={selectedMissionForAssignment}
          isOpen={true}
          onClose={() => setSelectedMissionForAssignment(null)}
          onAssigned={() => {
            setSelectedMissionForAssignment(null);
          }}
        />
      )}
    </div>
  );
};

export default AssignmentManager;