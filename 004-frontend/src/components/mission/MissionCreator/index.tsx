import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  RocketLaunchIcon,
  XMarkIcon,
  CheckIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { MissionData, Waypoint } from '@/types/fleet';
import WaypointManager from '../WaypointManager';
import useMissionStore from '@/store/mission';

interface MissionCreatorProps {
  isOpen: boolean;
  onClose: () => void;
  onMissionCreated?: (mission: MissionData) => void;
}

interface MissionFormData {
  name: string;
  description: string;
  priority: number;
  waypoints: Waypoint[];
}

const MissionCreator: React.FC<MissionCreatorProps> = ({
  isOpen,
  onClose,
  onMissionCreated
}) => {
  const { createMission, creating } = useMissionStore();
  const [formData, setFormData] = useState<MissionFormData>({
    name: '',
    description: '',
    priority: 5,
    waypoints: []
  });
  const [error, setError] = useState<string | null>(null);

  const priorityOptions = [
    { value: 1, label: 'Very Low', color: 'text-gray-400' },
    { value: 2, label: 'Low', color: 'text-blue-400' },
    { value: 3, label: 'Low-Medium', color: 'text-blue-300' },
    { value: 4, label: 'Medium-Low', color: 'text-yellow-400' },
    { value: 5, label: 'Medium', color: 'text-yellow-300' },
    { value: 6, label: 'Medium-High', color: 'text-orange-400' },
    { value: 7, label: 'High', color: 'text-orange-300' },
    { value: 8, label: 'High-Critical', color: 'text-red-400' },
    { value: 9, label: 'Critical', color: 'text-red-300' },
    { value: 10, label: 'Emergency', color: 'text-red-200' }
  ];

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      priority: 5,
      waypoints: []
    });
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const validateForm = () => {
    if (!formData.name.trim()) {
      setError('Mission name is required');
      return false;
    }

    if (formData.name.length > 100) {
      setError('Mission name must be less than 100 characters');
      return false;
    }

    if (formData.waypoints.length === 0) {
      setError('At least one waypoint is required');
      return false;
    }

    if (formData.waypoints.length > 50) {
      setError('Maximum 50 waypoints allowed');
      return false;
    }

    // Validate waypoints
    for (let i = 0; i < formData.waypoints.length; i++) {
      const waypoint = formData.waypoints[i];
      
      if (!waypoint.position.lat || !waypoint.position.lng) {
        setError(`Waypoint ${i + 1}: Invalid coordinates`);
        return false;
      }

      if (Math.abs(waypoint.position.lat) > 90) {
        setError(`Waypoint ${i + 1}: Invalid latitude (must be -90 to 90)`);
        return false;
      }

      if (Math.abs(waypoint.position.lng) > 180) {
        setError(`Waypoint ${i + 1}: Invalid longitude (must be -180 to 180)`);
        return false;
      }

      if (waypoint.position.alt < 0 || waypoint.position.alt > 1000) {
        setError(`Waypoint ${i + 1}: Invalid altitude (must be 0-1000m)`);
        return false;
      }

      if (waypoint.action === 'hover' && (!waypoint.hoverTime || waypoint.hoverTime <= 0)) {
        setError(`Waypoint ${i + 1}: Hover time required for hover action`);
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateForm()) {
      return;
    }

    try {
      const mission = await createMission({
        name: formData.name.trim(),
        description: formData.description.trim(),
        priority: formData.priority,
        waypoints: formData.waypoints.map((waypoint, index) => ({
          ...waypoint,
          sequence: index
        })),
        status: 'pending'
      });

      onMissionCreated?.(mission);
      handleClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create mission');
    }
  };

  const getPriorityOption = (priority: number) => {
    return priorityOptions.find(opt => opt.value === priority) || priorityOptions[4];
  };

  const calculateEstimatedDuration = () => {
    if (formData.waypoints.length < 2) return 0;
    
    let totalTime = 0;
    const speed = 10; // m/s average speed
    
    for (let i = 1; i < formData.waypoints.length; i++) {
      const prev = formData.waypoints[i - 1];
      const curr = formData.waypoints[i];
      
      // Calculate distance
      const R = 6371000;
      const lat1Rad = prev.position.lat * Math.PI / 180;
      const lat2Rad = curr.position.lat * Math.PI / 180;
      const deltaLat = (curr.position.lat - prev.position.lat) * Math.PI / 180;
      const deltaLng = (curr.position.lng - prev.position.lng) * Math.PI / 180;

      const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
                Math.cos(lat1Rad) * Math.cos(lat2Rad) *
                Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = R * c;
      
      totalTime += distance / speed;
      
      // Add hover time
      if (curr.hoverTime) {
        totalTime += curr.hoverTime;
      }
    }
    
    return Math.round(totalTime);
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10001] p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-dark-secondary rounded-lg border border-dark-border shadow-xl
                   w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-dark-border">
          <div className="flex items-center gap-3">
            <RocketLaunchIcon className="w-6 h-6 text-status-active" />
            <h2 className="text-xl font-semibold text-text-primary">Create New Mission</h2>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-dark-hover rounded-lg transition-colors"
          >
            <XMarkIcon className="w-5 h-5 text-text-secondary" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-dark-border scrollbar-track-transparent">
            {/* Error Message */}
            {error && (
              <div className="flex items-center gap-2 p-3 bg-status-critical/10 border border-status-critical/20 
                            rounded-lg text-status-critical">
                <ExclamationTriangleIcon className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            {/* Basic Information */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-text-primary">Mission Details</h3>
                
                {/* Mission Name */}
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Mission Name *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={100}
                    placeholder="e.g., Emergency Medical Delivery"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 bg-dark-tertiary border border-dark-border rounded-lg
                             text-text-primary placeholder-text-secondary focus:outline-none 
                             focus:ring-2 focus:ring-status-active"
                  />
                  <div className="text-xs text-text-secondary mt-1">
                    {formData.name.length}/100 characters
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Description
                  </label>
                  <textarea
                    rows={3}
                    maxLength={1000}
                    placeholder="Describe the mission objectives and requirements..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 bg-dark-tertiary border border-dark-border rounded-lg
                             text-text-primary placeholder-text-secondary focus:outline-none 
                             focus:ring-2 focus:ring-status-active resize-none"
                  />
                </div>

                {/* Priority */}
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Priority
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 bg-dark-tertiary border border-dark-border rounded-lg
                             text-text-primary focus:outline-none focus:ring-2 focus:ring-status-active"
                  >
                    {priorityOptions.map(option => (
                      <option key={option.value} value={option.value} className="bg-dark-tertiary">
                        {option.value} - {option.label}
                      </option>
                    ))}
                  </select>
                  <div className={`text-xs mt-1 ${getPriorityOption(formData.priority).color}`}>
                    {getPriorityOption(formData.priority).label}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-medium text-text-primary">Mission Summary</h3>
                
                <div className="bg-dark-tertiary rounded-lg p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-text-secondary">Waypoints:</span>
                      <div className="text-text-primary font-medium">{formData.waypoints.length}</div>
                    </div>
                    <div>
                      <span className="text-text-secondary">Priority:</span>
                      <div className={`font-medium ${getPriorityOption(formData.priority).color}`}>
                        {getPriorityOption(formData.priority).label}
                      </div>
                    </div>
                  </div>
                  
                  {formData.waypoints.length > 1 && (
                    <div className="text-sm">
                      <span className="text-text-secondary">Estimated Duration:</span>
                      <div className="text-text-primary font-medium">
                        {formatDuration(calculateEstimatedDuration())}
                      </div>
                    </div>
                  )}
                  
                  <div className="text-xs text-text-secondary">
                    Status: <span className="text-status-warning">Pending Assignment</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Waypoint Manager */}
            <div>
              <WaypointManager
                waypoints={formData.waypoints}
                onWaypointsChange={(waypoints) => {
                  setFormData({ ...formData, waypoints });
                  setError(null); // Clear error when waypoints change
                }}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex-shrink-0 flex items-center justify-between p-6 border-t border-dark-border bg-dark-tertiary">
            <div className="text-sm text-text-secondary">
              {formData.waypoints.length > 0 ? (
                <span>Mission ready to create with {formData.waypoints.length} waypoints</span>
              ) : (
                <span>Add waypoints to define the mission route</span>
              )}
            </div>
            
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleClose}
                disabled={creating}
                className="px-4 py-2 text-text-secondary hover:text-text-primary transition-colors
                         disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating || !formData.name.trim() || formData.waypoints.length === 0}
                className="flex items-center gap-2 px-6 py-2 bg-status-active hover:bg-status-active/80 
                         text-white rounded-lg font-medium transition-colors
                         disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <CheckIcon className="w-4 h-4" />
                    Create Mission
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default MissionCreator;