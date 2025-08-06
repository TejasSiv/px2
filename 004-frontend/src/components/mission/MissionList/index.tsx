import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  EyeIcon,
  PencilIcon,
  TrashIcon,
  PlayIcon,
  PauseIcon,
  StopIcon,
  UserIcon
} from '@heroicons/react/24/outline';
import { MissionData } from '@/types/fleet';
import useMissionStore from '@/store/mission';
import MissionCreator from '../MissionCreator';
import DroneAssignment from '../DroneAssignment';
import QuickAssignment from '../QuickAssignment';

interface MissionListProps {
  className?: string;
}

const MissionList: React.FC<MissionListProps> = ({ className = '' }) => {
  const {
    missions,
    missionStats,
    selectedMissionId,
    loading,
    selectMission,
    deleteMission,
    updateMission
  } = useMissionStore();

  const [showCreator, setShowCreator] = useState(false);
  const [selectedMissionForAssignment, setSelectedMissionForAssignment] = useState<MissionData | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | MissionData['status']>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');

  // Convert missions object to array
  const missionList = Object.values(missions);

  // Filter missions
  const filteredMissions = missionList.filter(mission => {
    // Search filter
    if (searchQuery && !mission.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !mission.description?.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }

    // Status filter
    if (statusFilter !== 'all' && mission.status !== statusFilter) {
      return false;
    }

    // Priority filter
    if (priorityFilter !== 'all') {
      if (priorityFilter === 'high' && mission.priority < 7) return false;
      if (priorityFilter === 'medium' && (mission.priority < 4 || mission.priority > 6)) return false;
      if (priorityFilter === 'low' && mission.priority > 3) return false;
    }

    return true;
  });

  // Sort missions (active first, then by priority, then by creation date)
  const sortedMissions = [...filteredMissions].sort((a, b) => {
    // Active missions first
    if (a.status === 'active' && b.status !== 'active') return -1;
    if (b.status === 'active' && a.status !== 'active') return 1;
    
    // Then by priority (high to low)
    if (a.priority !== b.priority) return b.priority - a.priority;
    
    // Then by creation date (newest first)
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const getStatusColor = (status: MissionData['status']) => {
    switch (status) {
      case 'active': return 'text-status-operational bg-status-operational/10 border-status-operational/20';
      case 'completed': return 'text-status-active bg-status-active/10 border-status-active/20';
      case 'pending': return 'text-status-warning bg-status-warning/10 border-status-warning/20';
      case 'failed': return 'text-status-critical bg-status-critical/10 border-status-critical/20';
      case 'cancelled': return 'text-text-secondary bg-text-secondary/10 border-text-secondary/20';
      case 'paused': return 'text-status-warning bg-status-warning/10 border-status-warning/20';
      default: return 'text-text-secondary bg-text-secondary/10 border-text-secondary/20';
    }
  };

  const getPriorityColor = (priority: number) => {
    if (priority >= 8) return 'text-red-400';
    if (priority >= 6) return 'text-orange-400';
    if (priority >= 4) return 'text-yellow-400';
    return 'text-blue-400';
  };

  const handleStatusChange = async (mission: MissionData, newStatus: MissionData['status']) => {
    try {
      await updateMission(mission.id, { status: newStatus });
    } catch (error) {
      console.error('Failed to update mission status:', error);
    }
  };

  const handleDelete = async (missionId: string) => {
    if (window.confirm('Are you sure you want to delete this mission?')) {
      try {
        await deleteMission(missionId);
      } catch (error) {
        console.error('Failed to delete mission:', error);
      }
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

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return 'N/A';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-text-primary">Missions</h2>
          <p className="text-text-secondary mt-1">
            {missionList.length} total missions
            {missionStats && (
              <span className="ml-4">
                {missionStats.active} active • {missionStats.completed} completed • {missionStats.pending} pending
              </span>
            )}
          </p>
        </div>
        
        <button
          onClick={() => setShowCreator(true)}
          className="flex items-center gap-2 px-4 py-2 bg-status-active hover:bg-status-active/80 
                   text-white rounded-lg font-medium transition-colors"
        >
          <PlusIcon className="w-5 h-5" />
          New Mission
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 p-4 bg-dark-secondary rounded-lg border border-dark-border">
        {/* Search */}
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-text-secondary" />
          <input
            type="text"
            placeholder="Search missions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-dark-tertiary border border-dark-border rounded-lg
                     text-text-primary placeholder-text-secondary focus:outline-none 
                     focus:ring-2 focus:ring-status-active"
          />
        </div>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="px-3 py-2 bg-dark-tertiary border border-dark-border rounded-lg
                   text-text-primary focus:outline-none focus:ring-2 focus:ring-status-active"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="pending">Pending</option>
          <option value="completed">Completed</option>
          <option value="paused">Paused</option>
          <option value="failed">Failed</option>
          <option value="cancelled">Cancelled</option>
        </select>

        {/* Priority Filter */}
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value as any)}
          className="px-3 py-2 bg-dark-tertiary border border-dark-border rounded-lg
                   text-text-primary focus:outline-none focus:ring-2 focus:ring-status-active"
        >
          <option value="all">All Priority</option>
          <option value="high">High (7-10)</option>
          <option value="medium">Medium (4-6)</option>
          <option value="low">Low (1-3)</option>
        </select>

        <div className="flex items-center text-text-secondary">
          <FunnelIcon className="w-4 h-4 mr-2" />
          {filteredMissions.length} of {missionList.length}
        </div>
      </div>

      {/* Mission List */}
      <div className="space-y-3">
        <AnimatePresence>
          {sortedMissions.map(mission => (
            <motion.div
              key={mission.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={`p-4 bg-dark-secondary rounded-lg border border-dark-border
                        hover:border-dark-hover transition-colors cursor-pointer
                        ${selectedMissionId === mission.id ? 'ring-2 ring-status-active' : ''}`}
              onClick={() => selectMission(selectedMissionId === mission.id ? null : mission.id)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  {/* Mission Header */}
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-text-primary">{mission.name}</h3>
                    
                    <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(mission.status)}`}>
                      {mission.status.toUpperCase()}
                    </span>
                    
                    <span className={`text-sm font-medium ${getPriorityColor(mission.priority)}`}>
                      Priority {mission.priority}
                    </span>
                  </div>

                  {/* Description */}
                  {mission.description && (
                    <p className="text-text-secondary text-sm mb-3 line-clamp-2">
                      {mission.description}
                    </p>
                  )}

                  {/* Mission Details */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-text-secondary">Waypoints:</span>
                      <div className="text-text-primary font-medium">{mission.waypoints?.length || 0}</div>
                    </div>
                    
                    <div>
                      <span className="text-text-secondary">Progress:</span>
                      <div className="text-text-primary font-medium">
                        {mission.progress}%
                        {mission.status === 'active' && (
                          <div className="w-full bg-dark-border rounded-full h-1.5 mt-1">
                            <div 
                              className="bg-status-active h-1.5 rounded-full transition-all duration-300"
                              style={{ width: `${mission.progress}%` }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div>
                      <span className="text-text-secondary">
                        {mission.assignedDrone ? 'Assigned:' : 'Created:'}
                      </span>
                      <div className="text-text-primary font-medium">
                        {mission.assignedDrone || formatDate(mission.createdAt)}
                      </div>
                    </div>
                    
                    <div>
                      <span className="text-text-secondary">Duration:</span>
                      <div className="text-text-primary font-medium">
                        {mission.actualDuration 
                          ? formatDuration(mission.actualDuration)
                          : mission.estimatedDuration 
                            ? `~${formatDuration(mission.estimatedDuration)}`
                            : 'N/A'
                        }
                      </div>
                    </div>
                  </div>

                  {/* Assignment Section */}
                  {mission.status === 'pending' && (
                    <div className="mt-4 pt-3 border-t border-dark-border">
                      <QuickAssignment
                        mission={mission}
                        onAssigned={() => {
                          console.log('Mission assigned successfully');
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 ml-4">
                  {/* Status Controls */}
                  {mission.status === 'pending' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStatusChange(mission, 'active');
                      }}
                      className="p-2 text-status-operational hover:bg-status-operational/10 rounded-lg transition-colors"
                      title="Start mission"
                    >
                      <PlayIcon className="w-4 h-4" />
                    </button>
                  )}
                  
                  {mission.status === 'active' && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStatusChange(mission, 'paused');
                        }}
                        className="p-2 text-status-warning hover:bg-status-warning/10 rounded-lg transition-colors"
                        title="Pause mission"
                      >
                        <PauseIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStatusChange(mission, 'cancelled');
                        }}
                        className="p-2 text-status-critical hover:bg-status-critical/10 rounded-lg transition-colors"
                        title="Stop mission"
                      >
                        <StopIcon className="w-4 h-4" />
                      </button>
                    </>
                  )}
                  
                  {mission.status === 'paused' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStatusChange(mission, 'active');
                      }}
                      className="p-2 text-status-operational hover:bg-status-operational/10 rounded-lg transition-colors"
                      title="Resume mission"
                    >
                      <PlayIcon className="w-4 h-4" />
                    </button>
                  )}

                  {/* Assignment Action */}
                  {mission.status === 'pending' && !mission.assignedDrone && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedMissionForAssignment(mission);
                      }}
                      className="p-2 text-text-secondary hover:text-status-active hover:bg-status-active/10 
                               rounded-lg transition-colors"
                      title="Assign to drone"
                    >
                      <UserIcon className="w-4 h-4" />
                    </button>
                  )}

                  {/* View/Edit Actions */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      selectMission(mission.id);
                    }}
                    className="p-2 text-text-secondary hover:text-text-primary hover:bg-dark-hover 
                             rounded-lg transition-colors"
                    title="View details"
                  >
                    <EyeIcon className="w-4 h-4" />
                  </button>

                  {['pending', 'paused'].includes(mission.status) && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        // TODO: Implement edit mission
                        console.log('Edit mission:', mission.id);
                      }}
                      className="p-2 text-text-secondary hover:text-status-warning hover:bg-status-warning/10 
                               rounded-lg transition-colors"
                      title="Edit mission"
                    >
                      <PencilIcon className="w-4 h-4" />
                    </button>
                  )}

                  {!['active'].includes(mission.status) && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(mission.id);
                      }}
                      className="p-2 text-text-secondary hover:text-status-critical hover:bg-status-critical/10 
                               rounded-lg transition-colors"
                      title="Delete mission"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Empty State */}
      {sortedMissions.length === 0 && (
        <div className="text-center py-12">
          {searchQuery || statusFilter !== 'all' || priorityFilter !== 'all' ? (
            <div>
              <MagnifyingGlassIcon className="w-12 h-12 mx-auto text-text-secondary opacity-50 mb-4" />
              <h3 className="text-lg font-medium text-text-primary mb-2">No missions found</h3>
              <p className="text-text-secondary mb-4">No missions match your current filters</p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
                  setPriorityFilter('all');
                }}
                className="px-4 py-2 bg-dark-tertiary hover:bg-dark-hover text-text-primary 
                         rounded-lg transition-colors"
              >
                Clear Filters
              </button>
            </div>
          ) : (
            <div>
              <PlusIcon className="w-12 h-12 mx-auto text-text-secondary opacity-50 mb-4" />
              <h3 className="text-lg font-medium text-text-primary mb-2">No missions created</h3>
              <p className="text-text-secondary mb-4">Create your first mission to get started</p>
              <button
                onClick={() => setShowCreator(true)}
                className="px-6 py-2 bg-status-active hover:bg-status-active/80 text-white 
                         rounded-lg font-medium transition-colors"
              >
                Create Mission
              </button>
            </div>
          )}
        </div>
      )}

      {/* Mission Creator Modal */}
      <MissionCreator
        isOpen={showCreator}
        onClose={() => setShowCreator(false)}
        onMissionCreated={() => {
          // Mission will be automatically added to store via WebSocket/API
          console.log('Mission created successfully');
        }}
      />

      {/* Assignment Modal */}
      {selectedMissionForAssignment && (
        <DroneAssignment
          mission={selectedMissionForAssignment}
          isOpen={true}
          onClose={() => setSelectedMissionForAssignment(null)}
          onAssigned={() => {
            setSelectedMissionForAssignment(null);
            console.log('Mission assigned successfully');
          }}
        />
      )}
    </div>
  );
};

export default MissionList;