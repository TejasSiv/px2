import React, { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { XCircleIcon } from '@heroicons/react/24/outline';
import { DroneData } from '@/types/fleet';
import DroneStatusCard from './DroneStatusCard';
import FleetSummary from './FleetSummary';

interface FleetStatusProps {
  drones: DroneData[];
  selectedDroneId?: string;
  onDroneSelect: (droneId: string) => void;
  onDroneAction?: (droneId: string, action: string) => void;
  className?: string;
}

const FleetStatus: React.FC<FleetStatusProps> = ({
  drones,
  selectedDroneId,
  onDroneSelect,
  onDroneAction,
  className = ''
}) => {
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'issues' | 'idle'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'battery' | 'status' | 'lastUpdate'>('status');

  // Calculate fleet statistics
  const stats = {
    total: drones.length,
    active: drones.filter(d => d.status === 'active' || d.status === 'in_flight').length,
    charging: drones.filter(d => d.status === 'charging').length,
    maintenance: drones.filter(d => d.status === 'maintenance' || d.status === 'emergency').length,
    idle: drones.filter(d => d.status === 'idle').length,
    lowBattery: drones.filter(d => d.batteryLevel < 30).length,
    alerts: drones.reduce((sum, d) => sum + (d.alerts?.length || 0), 0),
    avgBattery: drones.length > 0 ? drones.reduce((sum, d) => sum + d.batteryLevel, 0) / drones.length : 0,
  };

  // Filter and sort drones
  const filteredDrones = drones
    .filter(drone => {
      switch (filterStatus) {
        case 'active':
          return drone.status === 'active' || drone.status === 'in_flight';
        case 'issues':
          return drone.status === 'maintenance' || drone.status === 'emergency' || (drone.alerts && drone.alerts.length > 0);
        case 'idle':
          return drone.status === 'idle' || drone.status === 'charging';
        default:
          return true;
      }
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'battery':
          return b.batteryLevel - a.batteryLevel;
        case 'status':
          const statusOrder = { emergency: 0, maintenance: 1, active: 2, in_flight: 2, charging: 3, idle: 4 };
          return (statusOrder[a.status] || 5) - (statusOrder[b.status] || 5);
        case 'lastUpdate':
          return new Date(b.lastUpdate).getTime() - new Date(a.lastUpdate).getTime();
        default:
          return 0;
      }
    });

  const filterOptions = [
    { value: 'all', label: `All (${stats.total})`, count: stats.total },
    { value: 'active', label: `Active (${stats.active})`, count: stats.active },
    { value: 'issues', label: `Issues (${stats.maintenance})`, count: stats.maintenance },
    { value: 'idle', label: `Idle (${stats.idle + stats.charging})`, count: stats.idle + stats.charging },
  ];

  const recentActivity = [
    { id: '1', type: 'mission_complete', drone: 'DRN001', message: 'Delivery mission completed successfully', timestamp: new Date(Date.now() - 300000) },
    { id: '2', type: 'battery_low', drone: 'DRN003', message: 'Battery level below 25%', timestamp: new Date(Date.now() - 600000) },
    { id: '3', type: 'charging_start', drone: 'DRN002', message: 'Started charging at Station Alpha', timestamp: new Date(Date.now() - 900000) },
    { id: '4', type: 'mission_start', drone: 'DRN004', message: 'Started emergency medical delivery', timestamp: new Date(Date.now() - 1200000) },
    { id: '5', type: 'maintenance', drone: 'DRN005', message: 'Scheduled maintenance completed', timestamp: new Date(Date.now() - 1800000) },
  ];

  return (
    <div className={`h-full flex flex-col ${className}`}>
      {/* Fleet Summary */}
      <div className="p-4 border-b border-dark-border">
        <FleetSummary stats={stats} />
      </div>

      {/* Controls */}
      <div className="p-4 border-b border-dark-border">
        <div className="flex flex-col gap-3">
          {/* Filter Buttons */}
          <div className="grid grid-cols-2 gap-1">
            {filterOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setFilterStatus(option.value as any)}
                className={`px-2 py-1 rounded text-xs font-medium transition-all duration-200 ${
                  filterStatus === option.value
                    ? 'bg-dark-tertiary text-text-primary border border-dark-border'
                    : 'text-text-secondary hover:text-text-primary hover:bg-dark-hover'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          {/* Sort Dropdown */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="w-full px-2 py-1 bg-dark-tertiary text-text-primary rounded border border-dark-border text-xs focus:outline-none focus:ring-1 focus:ring-status-active"
          >
            <option value="status">Sort by Status</option>
            <option value="name">Sort by Name</option>
            <option value="battery">Sort by Battery</option>
            <option value="lastUpdate">Sort by Update</option>
          </select>
        </div>
      </div>

      {/* Drone Cards */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-2 space-y-2">
          <AnimatePresence mode="popLayout">
            {filteredDrones.map((drone, index) => (
              <DroneStatusCard
                key={drone.id}
                drone={drone}
                isSelected={drone.id === selectedDroneId}
                onSelect={() => onDroneSelect(drone.id)}
                onAction={onDroneAction}
                index={index}
              />
            ))}
          </AnimatePresence>

          {filteredDrones.length === 0 && (
            <div className="text-center py-8 text-text-secondary">
              <XCircleIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No drones match filter</p>
              <button 
                onClick={() => setFilterStatus('all')}
                className="mt-2 px-2 py-1 bg-dark-tertiary text-text-primary rounded text-xs hover:bg-dark-hover transition-colors"
              >
                Show All
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Activity Feed - Collapsed at bottom */}
      <div className="border-t border-dark-border">
        <div className="p-3">
          <h4 className="text-sm font-medium text-text-primary mb-2">Recent Activity</h4>
          <div className="space-y-1">
            {recentActivity.slice(0, 3).map((activity) => (
              <div key={activity.id} className="text-xs text-text-secondary">
                <span className="font-medium">{activity.drone}:</span> {activity.message}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FleetStatus;