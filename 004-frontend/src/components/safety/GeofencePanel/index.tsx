import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldExclamationIcon,
  MapPinIcon,
  ExclamationTriangleIcon,
  EyeIcon,
  EyeSlashIcon,
  PlusIcon,
  Cog6ToothIcon,
  ChartBarIcon,
  TrashIcon
} from '@heroicons/react/24/outline';
import useGeofenceStore, { useActiveGeofences, useRecentViolations } from '@/store/geofence';
import { GeofenceData, GeofenceViolation } from '@/types/fleet';

interface GeofencePanelProps {
  className?: string;
  compact?: boolean;
}

const GeofencePanel: React.FC<GeofencePanelProps> = ({
  className = '',
  compact = false
}) => {
  const {
    geofences,
    selectedGeofenceId,
    showGeofences,
    loading,
    loadingViolations,
    error,
    
    selectGeofence,
    setShowGeofences,
    fetchGeofences,
    fetchViolations,
    deleteGeofence
  } = useGeofenceStore();
  
  const activeGeofences = useActiveGeofences();
  const recentViolations = useRecentViolations(24);
  
  const [showViolations, setShowViolations] = useState(false);
  
  useEffect(() => {
    fetchGeofences();
    fetchViolations();
    
    // Refresh violations every 2 minutes for less flashing
    const interval = setInterval(() => {
      fetchViolations();
    }, 120000);
    
    return () => clearInterval(interval);
  }, [fetchGeofences, fetchViolations]);
  
  const handleGeofenceToggle = (geofence: GeofenceData) => {
    const isSelected = selectedGeofenceId === geofence.id;
    selectGeofence(isSelected ? null : geofence.id);
  };
  
  const handleEditGeofence = (geofence: any) => {
    console.log('Edit geofence:', geofence);
  };

  const handleDeleteGeofence = async (geofence: GeofenceData) => {
    if (confirm(`Are you sure you want to delete "${geofence.name}"?`)) {
      await deleteGeofence(geofence.id);
    }
  };
  
  const getGeofenceStatusColor = (geofence: GeofenceData) => {
    if (!geofence.active) return 'text-gray-500';
    
    switch (geofence.severity) {
      case 'critical': return 'text-red-500';
      case 'warning': return 'text-amber-500';
      case 'info': return 'text-blue-500';
      default: return 'text-gray-400';
    }
  };
  
  const getGeofenceTypeIcon = (type: string) => {
    switch (type) {
      case 'exclusion':
        return <ShieldExclamationIcon className="w-4 h-4" />;
      case 'inclusion':
        return <MapPinIcon className="w-4 h-4" />;
      case 'emergency':
        return <ExclamationTriangleIcon className="w-4 h-4" />;
      default:
        return <MapPinIcon className="w-4 h-4" />;
    }
  };
  
  
  if (compact) {
    return (
      <div className={`bg-slate-900 border border-slate-700 rounded-lg p-4 ${className}`}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-medium text-slate-200 flex items-center gap-2">
            <ShieldExclamationIcon className="w-5 h-5" />
            Geofences
          </h3>
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <span>{activeGeofences.length} active</span>
            {recentViolations.length > 0 && (
              <span className="bg-red-500 text-white px-2 py-1 rounded-full text-xs">
                {recentViolations.length}
              </span>
            )}
          </div>
        </div>
        
        <div className="space-y-2">
          {activeGeofences.slice(0, 3).map(geofence => (
            <div key={geofence.id} className="flex items-center gap-2 text-sm">
              <div className={getGeofenceStatusColor(geofence)}>
                {getGeofenceTypeIcon(geofence.type)}
              </div>
              <span className="text-slate-300 truncate flex-1">{geofence.name}</span>
              <button
                onClick={() => handleGeofenceToggle(geofence)}
                className={`p-1 rounded transition-colors ${
                  selectedGeofenceId === geofence.id
                    ? 'text-blue-400 bg-blue-500/10'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {selectedGeofenceId === geofence.id ? (
                  <EyeSlashIcon className="w-4 h-4" />
                ) : (
                  <EyeIcon className="w-4 h-4" />
                )}
              </button>
            </div>
          ))}
          
          {activeGeofences.length > 3 && (
            <div className="text-xs text-slate-500 text-center py-1">
              +{activeGeofences.length - 3} more
            </div>
          )}
        </div>
      </div>
    );
  }
  
  return (
    <div className={`bg-slate-900 border border-slate-700 rounded-lg ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-slate-700">
        <h2 className="text-xl font-semibold text-slate-200 flex items-center gap-3">
          <ShieldExclamationIcon className="w-6 h-6" />
          Geofence Management
        </h2>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-4 text-sm text-slate-400">
            <span>{activeGeofences.length} active</span>
            <span>{geofences.length} total</span>
            {recentViolations.length > 0 && (
              <span className="bg-red-500 text-white px-2 py-1 rounded-full">
                {recentViolations.length} violations (24h)
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowViolations(!showViolations)}
              className={`p-2 rounded-lg transition-colors ${
                showViolations
                  ? 'bg-amber-500/10 text-amber-400'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
              title="Toggle violations view"
            >
              <ChartBarIcon className="w-5 h-5" />
            </button>
            
            <button
              onClick={() => setShowGeofences(!showGeofences)}
              className={`p-2 rounded-lg transition-colors ${
                showGeofences
                  ? 'bg-blue-500/10 text-blue-400'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
              title="Toggle geofences visibility"
            >
              {showGeofences ? (
                <EyeSlashIcon className="w-5 h-5" />
              ) : (
                <EyeIcon className="w-5 h-5" />
              )}
            </button>
            
            <button
              onClick={() => console.log('Create geofence')}
              className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-lg transition-colors"
              title="Create new geofence"
            >
              <PlusIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
      
      {/* Error Display */}
      {error && (
        <div className="p-4 bg-red-500/10 border-b border-red-500/20">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}
      
      {/* Content */}
      <div className="p-6">
        <AnimatePresence mode="wait">
          {showViolations ? (
            <motion.div
              key="violations"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              <h3 className="text-lg font-medium text-slate-200 mb-4">
                Recent Violations ({recentViolations.length})
              </h3>
              
              {loadingViolations ? (
                <div className="text-center py-8 text-slate-400">
                  Loading violations...
                </div>
              ) : recentViolations.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  No violations in the last 24 hours
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {recentViolations.map(violation => (
                    <ViolationCard key={violation.id} violation={violation} />
                  ))}
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="geofences"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              <h3 className="text-lg font-medium text-slate-200 mb-4">
                Active Geofences ({activeGeofences.length})
              </h3>
              
              {loading ? (
                <div className="text-center py-8 text-slate-400">
                  Loading geofences...
                </div>
              ) : activeGeofences.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  No active geofences
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {activeGeofences.map(geofence => (
                    <GeofenceCard
                      key={geofence.id}
                      geofence={geofence}
                      isSelected={selectedGeofenceId === geofence.id}
                      onToggle={() => handleGeofenceToggle(geofence)}
                      onEdit={() => handleEditGeofence(geofence)}
                      onDelete={() => handleDeleteGeofence(geofence)}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

interface GeofenceCardProps {
  geofence: GeofenceData;
  isSelected: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

const GeofenceCard: React.FC<GeofenceCardProps> = ({
  geofence,
  isSelected,
  onToggle,
  onEdit,
  onDelete
}) => {
  const getTypeColor = (type: string) => {
    switch (type) {
      case 'exclusion': return 'text-red-400';
      case 'inclusion': return 'text-green-400';
      case 'emergency': return 'text-orange-400';
      default: return 'text-gray-400';
    }
  };
  
  const getRestrictionLabel = (restriction: string) => {
    switch (restriction) {
      case 'no_fly': return 'No Fly Zone';
      case 'restricted': return 'Restricted';
      case 'emergency_only': return 'Emergency Only';
      case 'warning_only': return 'Warning Only';
      default: return restriction;
    }
  };
  
  return (
    <motion.div
      layout
      className={`border rounded-lg p-4 transition-all ${
        isSelected
          ? 'bg-blue-500/10 border-blue-500/30'
          : 'bg-slate-800/50 border-slate-600 hover:border-slate-500'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3 flex-1">
          <div className={`${getTypeColor(geofence.type)} mt-1`}>
            {geofence.type === 'exclusion' ? (
              <ShieldExclamationIcon className="w-5 h-5" />
            ) : geofence.type === 'inclusion' ? (
              <MapPinIcon className="w-5 h-5" />
            ) : (
              <ExclamationTriangleIcon className="w-5 h-5" />
            )}
          </div>
          
          <div className="flex-1">
            <h4 className="font-medium text-slate-200">{geofence.name}</h4>
            
            <div className="flex items-center gap-4 mt-1 text-sm text-slate-400">
              <span className="capitalize">{geofence.type}</span>
              <span>{getRestrictionLabel(geofence.restrictionType)}</span>
              <span className={`px-2 py-1 rounded-full text-xs ${
                geofence.severity === 'critical' ? 'bg-red-500/20 text-red-400' :
                geofence.severity === 'warning' ? 'bg-amber-500/20 text-amber-400' :
                'bg-blue-500/20 text-blue-400'
              }`}>
                {geofence.severity}
              </span>
            </div>
            
            {geofence.description && (
              <p className="text-sm text-slate-500 mt-2">{geofence.description}</p>
            )}
            
            <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
              <span>{geofence.coordinates.length} points</span>
              {geofence.altitudeMin && (
                <span>Min: {geofence.altitudeMin}m</span>
              )}
              {geofence.altitudeMax && (
                <span>Max: {geofence.altitudeMax}m</span>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={onEdit}
            className="p-1 text-slate-500 hover:text-slate-300 transition-colors"
            title="Edit geofence"
          >
            <Cog6ToothIcon className="w-4 h-4" />
          </button>
          
          <button
            onClick={onDelete}
            className="p-1 text-slate-500 hover:text-red-400 transition-colors"
            title="Delete geofence"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
          
          <button
            onClick={onToggle}
            className={`p-1 transition-colors ${
              isSelected
                ? 'text-blue-400 hover:text-blue-300'
                : 'text-slate-500 hover:text-slate-300'
            }`}
            title={isSelected ? "Hide geofence" : "Show geofence"}
          >
            {isSelected ? (
              <EyeSlashIcon className="w-4 h-4" />
            ) : (
              <EyeIcon className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </motion.div>
  );
};

interface ViolationCardProps {
  violation: GeofenceViolation;
}

const ViolationCard: React.FC<ViolationCardProps> = ({ violation }) => {
  const timeAgo = (timestamp: string) => {
    const now = Date.now();
    const time = new Date(timestamp).getTime();
    const diff = now - time;
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    return `${minutes}m ago`;
  };
  
  return (
    <motion.div
      layout
      className="border border-slate-600 rounded-lg p-3 bg-slate-800/30"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3 flex-1">
          <ExclamationTriangleIcon className="w-5 h-5 text-red-400 mt-0.5" />
          
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <span className="font-medium text-slate-200">{violation.droneId}</span>
              <span className={`px-2 py-1 rounded-full text-xs border ${
                violation.severity === 'critical' ? 'bg-red-100 text-red-800 border-red-200' :
                violation.severity === 'warning' ? 'bg-amber-100 text-amber-800 border-amber-200' :
                'bg-blue-100 text-blue-800 border-blue-200'
              }`}>
                {violation.severity}
              </span>
            </div>
            
            <p className="text-sm text-slate-300 mb-2">{violation.message}</p>
            
            <div className="flex items-center gap-4 text-xs text-slate-500">
              <span>{violation.geofenceName}</span>
              <span>{violation.violationType.replace('_', ' ')}</span>
              <span>{timeAgo(violation.timestamp)}</span>
              {violation.resolved && (
                <span className="text-green-400">Resolved</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default GeofencePanel;