import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PlusIcon,
  MapPinIcon,
  TrashIcon,
  PencilIcon,
  CheckIcon,
  XMarkIcon,
  ChevronUpIcon,
  ChevronDownIcon
} from '@heroicons/react/24/outline';
import { Waypoint, Position } from '@/types/fleet';

interface WaypointManagerProps {
  waypoints: Waypoint[];
  onWaypointsChange: (waypoints: Waypoint[]) => void;
  disabled?: boolean;
  className?: string;
}

interface WaypointFormData {
  position: Position;
  action: Waypoint['action'];
  hoverTime?: number;
  notes?: string;
}

const WaypointManager: React.FC<WaypointManagerProps> = ({
  waypoints,
  onWaypointsChange,
  disabled = false,
  className = ''
}) => {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState<WaypointFormData>({
    position: { lat: 37.7749, lng: -122.4194, alt: 50 },
    action: 'navigation',
    hoverTime: 0,
    notes: ''
  });

  // Action options with icons and descriptions
  const actionOptions = [
    { value: 'navigation', label: 'Navigate', icon: '🧭', description: 'Fly to location' },
    { value: 'pickup', label: 'Pickup', icon: '📦', description: 'Pickup item' },
    { value: 'delivery', label: 'Delivery', icon: '🚚', description: 'Deliver item' },
    { value: 'hover', label: 'Hover', icon: '🚁', description: 'Hover in place' },
    { value: 'survey', label: 'Survey', icon: '🔍', description: 'Survey area' },
    { value: 'landing', label: 'Land', icon: '🛬', description: 'Land drone' },
    { value: 'takeoff', label: 'Takeoff', icon: '🛫', description: 'Takeoff drone' }
  ];

  const resetForm = () => {
    setFormData({
      position: { lat: 37.7749, lng: -122.4194, alt: 50 },
      action: 'navigation',
      hoverTime: 0,
      notes: ''
    });
  };

  const handleAddWaypoint = () => {
    if (!formData.position.lat || !formData.position.lng) return;

    const newWaypoint: Waypoint = {
      id: `waypoint-${Date.now()}`,
      position: formData.position,
      action: formData.action,
      hoverTime: formData.hoverTime || 0,
      notes: formData.notes || '',
      completed: false
    };

    onWaypointsChange([...waypoints, newWaypoint]);
    resetForm();
    setShowAddForm(false);
  };

  const handleEditWaypoint = (index: number) => {
    const waypoint = waypoints[index];
    setFormData({
      position: waypoint.position,
      action: waypoint.action,
      hoverTime: waypoint.hoverTime,
      notes: waypoint.notes
    });
    setEditingIndex(index);
  };

  const handleSaveEdit = () => {
    if (editingIndex === null) return;

    const updatedWaypoints = [...waypoints];
    updatedWaypoints[editingIndex] = {
      ...updatedWaypoints[editingIndex],
      position: formData.position,
      action: formData.action,
      hoverTime: formData.hoverTime || 0,
      notes: formData.notes || ''
    };

    onWaypointsChange(updatedWaypoints);
    setEditingIndex(null);
    resetForm();
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setShowAddForm(false);
    resetForm();
  };

  const handleDeleteWaypoint = (index: number) => {
    const updatedWaypoints = waypoints.filter((_, i) => i !== index);
    onWaypointsChange(updatedWaypoints);
  };

  const handleMoveWaypoint = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === waypoints.length - 1) return;

    const updatedWaypoints = [...waypoints];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    
    [updatedWaypoints[index], updatedWaypoints[newIndex]] = 
    [updatedWaypoints[newIndex], updatedWaypoints[index]];

    onWaypointsChange(updatedWaypoints);
  };

  const getActionOption = (action: string) => {
    return actionOptions.find(opt => opt.value === action) || actionOptions[0];
  };

  const calculateDistance = (pos1: Position, pos2: Position) => {
    const R = 6371000; // Earth's radius in meters
    const lat1Rad = pos1.lat * Math.PI / 180;
    const lat2Rad = pos2.lat * Math.PI / 180;
    const deltaLat = (pos2.lat - pos1.lat) * Math.PI / 180;
    const deltaLng = (pos2.lng - pos1.lng) * Math.PI / 180;

    const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
              Math.cos(lat1Rad) * Math.cos(lat2Rad) *
              Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return Math.round(R * c);
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-text-primary">Waypoints</h3>
          <p className="text-sm text-text-secondary">
            {waypoints.length} waypoint{waypoints.length !== 1 ? 's' : ''}
            {waypoints.length > 1 && (
              <span className="ml-2">
                Total distance: ~{waypoints.reduce((total, waypoint, index) => {
                  if (index === 0) return total;
                  return total + calculateDistance(waypoints[index - 1].position, waypoint.position);
                }, 0)}m
              </span>
            )}
          </p>
        </div>
        
        {!disabled && (
          <button
            onClick={() => setShowAddForm(true)}
            disabled={showAddForm || editingIndex !== null}
            className="flex items-center gap-2 px-3 py-2 bg-status-active hover:bg-status-active/80 
                     text-white rounded-lg text-sm font-medium transition-colors
                     disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <PlusIcon className="w-4 h-4" />
            Add Waypoint
          </button>
        )}
      </div>

      {/* Waypoint List */}
      <div className="space-y-3">
        <AnimatePresence>
          {waypoints.map((waypoint, index) => (
            <motion.div
              key={waypoint.id || index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-dark-tertiary rounded-lg border border-dark-border"
            >
              {editingIndex === index ? (
                // Edit Form
                <div className="p-4 space-y-4">
                  <WaypointForm
                    data={formData}
                    onChange={setFormData}
                    actionOptions={actionOptions}
                  />
                  
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={handleCancelEdit}
                      className="flex items-center gap-1 px-3 py-2 text-text-secondary hover:text-text-primary 
                               transition-colors text-sm"
                    >
                      <XMarkIcon className="w-4 h-4" />
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveEdit}
                      className="flex items-center gap-1 px-3 py-2 bg-status-active hover:bg-status-active/80 
                               text-white rounded transition-colors text-sm"
                    >
                      <CheckIcon className="w-4 h-4" />
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                // Display View
                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-lg">{getActionOption(waypoint.action).icon}</span>
                        <div>
                          <h4 className="font-medium text-text-primary">
                            {index + 1}. {getActionOption(waypoint.action).label}
                          </h4>
                          <p className="text-sm text-text-secondary">
                            {getActionOption(waypoint.action).description}
                          </p>
                        </div>
                        {waypoint.completed && (
                          <span className="px-2 py-1 bg-status-operational/20 text-status-operational 
                                         text-xs font-medium rounded-full">
                            ✓ Completed
                          </span>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-text-secondary">Position:</span>
                          <div className="font-mono text-text-primary">
                            {waypoint.position.lat.toFixed(6)}, {waypoint.position.lng.toFixed(6)}
                          </div>
                          <div className="font-mono text-text-secondary">
                            Alt: {waypoint.position.alt}m
                          </div>
                        </div>
                        
                        <div>
                          {waypoint.action === 'hover' && waypoint.hoverTime && (
                            <div>
                              <span className="text-text-secondary">Hover Time:</span>
                              <div className="text-text-primary">{waypoint.hoverTime}s</div>
                            </div>
                          )}
                          {index > 0 && (
                            <div>
                              <span className="text-text-secondary">Distance:</span>
                              <div className="text-text-primary">
                                ~{calculateDistance(waypoints[index - 1].position, waypoint.position)}m
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {waypoint.notes && (
                        <div className="mt-2 p-2 bg-dark-hover rounded text-sm">
                          <span className="text-text-secondary">Notes:</span>
                          <div className="text-text-primary mt-1">{waypoint.notes}</div>
                        </div>
                      )}
                    </div>

                    {!disabled && !waypoint.completed && (
                      <div className="flex items-center gap-1 ml-4">
                        {/* Move buttons */}
                        <button
                          onClick={() => handleMoveWaypoint(index, 'up')}
                          disabled={index === 0}
                          className="p-1 text-text-secondary hover:text-text-primary transition-colors
                                   disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Move up"
                        >
                          <ChevronUpIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleMoveWaypoint(index, 'down')}
                          disabled={index === waypoints.length - 1}
                          className="p-1 text-text-secondary hover:text-text-primary transition-colors
                                   disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Move down"
                        >
                          <ChevronDownIcon className="w-4 h-4" />
                        </button>
                        
                        {/* Edit button */}
                        <button
                          onClick={() => handleEditWaypoint(index)}
                          disabled={editingIndex !== null || showAddForm}
                          className="p-1 text-text-secondary hover:text-status-warning transition-colors
                                   disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Edit waypoint"
                        >
                          <PencilIcon className="w-4 h-4" />
                        </button>
                        
                        {/* Delete button */}
                        <button
                          onClick={() => handleDeleteWaypoint(index)}
                          disabled={editingIndex !== null || showAddForm}
                          className="p-1 text-text-secondary hover:text-status-critical transition-colors
                                   disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Delete waypoint"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Add Waypoint Form */}
        <AnimatePresence>
          {showAddForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-dark-tertiary rounded-lg border border-dark-border p-4"
            >
              <h4 className="text-text-primary font-medium mb-4 flex items-center gap-2">
                <MapPinIcon className="w-5 h-5" />
                Add New Waypoint
              </h4>
              
              <div className="space-y-4">
                <WaypointForm
                  data={formData}
                  onChange={setFormData}
                  actionOptions={actionOptions}
                />
                
                <div className="flex justify-end gap-2">
                  <button
                    onClick={handleCancelEdit}
                    className="flex items-center gap-1 px-3 py-2 text-text-secondary hover:text-text-primary 
                             transition-colors text-sm"
                  >
                    <XMarkIcon className="w-4 h-4" />
                    Cancel
                  </button>
                  <button
                    onClick={handleAddWaypoint}
                    disabled={!formData.position.lat || !formData.position.lng}
                    className="flex items-center gap-1 px-3 py-2 bg-status-active hover:bg-status-active/80 
                             text-white rounded transition-colors text-sm
                             disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <PlusIcon className="w-4 h-4" />
                    Add Waypoint
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Empty State */}
      {waypoints.length === 0 && (
        <div className="text-center py-8 text-text-secondary">
          <MapPinIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <h4 className="text-lg font-medium mb-2">No waypoints added</h4>
          <p className="text-sm mb-4">Add waypoints to define the mission route</p>
          {!disabled && (
            <button
              onClick={() => setShowAddForm(true)}
              className="px-4 py-2 bg-status-active hover:bg-status-active/80 text-white rounded-lg
                       transition-colors text-sm font-medium"
            >
              Add First Waypoint
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// Waypoint Form Component
interface WaypointFormProps {
  data: WaypointFormData;
  onChange: (data: WaypointFormData) => void;
  actionOptions: Array<{
    value: string;
    label: string;
    icon: string;
    description: string;
  }>;
}

const WaypointForm: React.FC<WaypointFormProps> = ({ data, onChange, actionOptions }) => {
  return (
    <div className="space-y-4">
      {/* Position */}
      <div>
        <label className="block text-sm font-medium text-text-primary mb-2">
          Position
        </label>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <input
              type="number"
              step="0.000001"
              placeholder="Latitude"
              value={data.position.lat}
              onChange={(e) => onChange({
                ...data,
                position: { ...data.position, lat: parseFloat(e.target.value) || 0 }
              })}
              className="w-full px-3 py-2 bg-dark-hover border border-dark-border rounded text-sm
                       text-text-primary focus:outline-none focus:ring-1 focus:ring-status-active"
            />
            <span className="text-xs text-text-secondary">Latitude</span>
          </div>
          <div>
            <input
              type="number"
              step="0.000001"
              placeholder="Longitude"
              value={data.position.lng}
              onChange={(e) => onChange({
                ...data,
                position: { ...data.position, lng: parseFloat(e.target.value) || 0 }
              })}
              className="w-full px-3 py-2 bg-dark-hover border border-dark-border rounded text-sm
                       text-text-primary focus:outline-none focus:ring-1 focus:ring-status-active"
            />
            <span className="text-xs text-text-secondary">Longitude</span>
          </div>
          <div>
            <input
              type="number"
              min="0"
              max="1000"
              placeholder="Altitude"
              value={data.position.alt}
              onChange={(e) => onChange({
                ...data,
                position: { ...data.position, alt: parseInt(e.target.value) || 0 }
              })}
              className="w-full px-3 py-2 bg-dark-hover border border-dark-border rounded text-sm
                       text-text-primary focus:outline-none focus:ring-1 focus:ring-status-active"
            />
            <span className="text-xs text-text-secondary">Altitude (m)</span>
          </div>
        </div>
      </div>

      {/* Action */}
      <div>
        <label className="block text-sm font-medium text-text-primary mb-2">
          Action
        </label>
        <select
          value={data.action}
          onChange={(e) => onChange({
            ...data,
            action: e.target.value as Waypoint['action']
          })}
          className="w-full px-3 py-2 bg-dark-hover border border-dark-border rounded text-sm
                   text-text-primary focus:outline-none focus:ring-1 focus:ring-status-active"
        >
          {actionOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.icon} {option.label} - {option.description}
            </option>
          ))}
        </select>
      </div>

      {/* Hover Time (conditional) */}
      {data.action === 'hover' && (
        <div>
          <label className="block text-sm font-medium text-text-primary mb-2">
            Hover Time (seconds)
          </label>
          <input
            type="number"
            min="1"
            max="3600"
            value={data.hoverTime || 0}
            onChange={(e) => onChange({
              ...data,
              hoverTime: parseInt(e.target.value) || 0
            })}
            className="w-full px-3 py-2 bg-dark-hover border border-dark-border rounded text-sm
                     text-text-primary focus:outline-none focus:ring-1 focus:ring-status-active"
          />
        </div>
      )}

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-text-primary mb-2">
          Notes (optional)
        </label>
        <textarea
          rows={2}
          placeholder="Additional notes about this waypoint..."
          value={data.notes || ''}
          onChange={(e) => onChange({
            ...data,
            notes: e.target.value
          })}
          className="w-full px-3 py-2 bg-dark-hover border border-dark-border rounded text-sm
                   text-text-primary focus:outline-none focus:ring-1 focus:ring-status-active
                   resize-none"
        />
      </div>
    </div>
  );
};

export default WaypointManager;