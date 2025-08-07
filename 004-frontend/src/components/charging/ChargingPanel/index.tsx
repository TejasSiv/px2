import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BoltIcon,
  ClockIcon,
  QueueListIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  WrenchScrewdriverIcon,
  PlayIcon,
  PauseIcon,
  XMarkIcon,
  ArrowUpIcon,
  ArrowDownIcon
} from '@heroicons/react/24/outline';
import { mockTelemetryService } from '@/services/mockData';
import { ChargingStation, ChargingQueueItem, ChargingSchedule, ChargingStats } from '@/services/chargingService';

interface ChargingPanelProps {
  className?: string;
  compact?: boolean;
}

const ChargingPanel: React.FC<ChargingPanelProps> = ({
  className = '',
  compact = false
}) => {
  const isTransparent = className.includes('bg-transparent');
  const [chargingStats, setChargingStats] = useState<ChargingStats | null>(null);
  const [chargingStations, setChargingStations] = useState<ChargingStation[]>([]);
  const [chargingSchedules, setChargingSchedules] = useState<ChargingSchedule[]>([]);
  const [activeView, setActiveView] = useState<'overview' | 'queue' | 'stations'>('overview');

  useEffect(() => {
    const updateChargingData = () => {
      try {
        const stats = mockTelemetryService.getChargingStats();
        const stations = mockTelemetryService.getChargingStations();
        const schedules = mockTelemetryService.getChargingSchedules();
        
        setChargingStats(stats);
        setChargingStations(stations);
        setChargingSchedules(schedules);
      } catch (error) {
        console.error('Error fetching charging data:', error);
      }
    };

    // Initial load
    updateChargingData();

    // Update every 5 seconds
    const interval = setInterval(updateChargingData, 5000);

    return () => clearInterval(interval);
  }, []);

  const globalQueue = useMemo(() => {
    // Combine all queue items from all schedules
    const allQueueItems: ChargingQueueItem[] = [];
    chargingSchedules.forEach(schedule => {
      allQueueItems.push(...schedule.queue);
    });
    
    // Remove duplicates and sort by queue position
    const uniqueItems = allQueueItems.filter((item, index, arr) => 
      arr.findIndex(i => i.droneId === item.droneId) === index
    );
    
    return uniqueItems.sort((a, b) => a.queuePosition - b.queuePosition);
  }, [chargingSchedules]);

  const getStationStatusColor = (status: string) => {
    switch (status) {
      case 'available':
        return { color: '#10b981', bg: '#10b981', icon: CheckCircleIcon };
      case 'occupied':
        return { color: '#d29922', bg: '#d29922', icon: BoltIcon };
      case 'maintenance':
        return { color: '#da3633', bg: '#da3633', icon: WrenchScrewdriverIcon };
      case 'reserved':
        return { color: '#1f6feb', bg: '#1f6feb', icon: ClockIcon };
      default:
        return { color: '#8b949e', bg: '#8b949e', icon: PauseIcon };
    }
  };

  const getPriorityColor = (priority: number) => {
    if (priority >= 5) return 'text-red-400 bg-red-900/20';
    if (priority >= 4) return 'text-orange-400 bg-orange-900/20';
    if (priority >= 3) return 'text-yellow-400 bg-yellow-900/20';
    if (priority >= 2) return 'text-blue-400 bg-blue-900/20';
    return 'text-gray-400 bg-gray-900/20';
  };

  const getReasonIcon = (reason: string) => {
    switch (reason) {
      case 'emergency': return ExclamationTriangleIcon;
      case 'low_battery': return BoltIcon;
      case 'pre_mission': return PlayIcon;
      case 'maintenance': return WrenchScrewdriverIcon;
      case 'scheduled': return ClockIcon;
      default: return QueueListIcon;
    }
  };

  const formatTime = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const QueueItemCard: React.FC<{ item: ChargingQueueItem; index: number }> = ({ item, index }) => {
    const ReasonIcon = getReasonIcon(item.reason);
    
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: index * 0.05 }}
        className={`${isTransparent ? 'bg-dark-tertiary border border-dark-border' : 'bg-slate-800 border border-slate-600'} rounded-lg p-4`}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            <div className="flex-shrink-0">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-lg font-bold ${getPriorityColor(item.priority)}`}>
                {item.queuePosition}
              </div>
            </div>
            
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className={`font-medium ${isTransparent ? 'text-text-primary' : 'text-slate-200'}`}>{item.droneName}</span>
                <span className={`text-xs font-mono ${isTransparent ? 'text-text-secondary' : 'text-slate-400'}`}>({item.droneId})</span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(item.priority)}`}>
                  Priority {item.priority}
                </span>
              </div>
              
              <div className={`flex items-center gap-4 text-sm mb-2 ${isTransparent ? 'text-text-secondary' : 'text-slate-400'}`}>
                <div className="flex items-center gap-1">
                  <BoltIcon className="w-4 h-4" />
                  <span>{item.batteryLevel.toFixed(1)}%</span>
                </div>
                <div className="flex items-center gap-1">
                  <ClockIcon className="w-4 h-4" />
                  <span>ETA: {formatTime(item.estimatedArrival)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <ReasonIcon className="w-4 h-4" />
                  <span className="capitalize">{item.reason.replace('_', ' ')}</span>
                </div>
              </div>
              
              <div className={`text-xs ${isTransparent ? 'text-text-muted' : 'text-slate-500'}`}>
                Expected charging time: {formatTime(item.expectedChargingTime)} • 
                Requested: {new Date(item.requestedAt).toLocaleTimeString()}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2 ml-3">
            <button
              onClick={() => {
                // Move up in queue (decrease priority slightly)
                console.log(`Moving ${item.droneName} up in queue`);
              }}
              className={`p-1 transition-colors ${isTransparent ? 'text-text-muted hover:text-green-400' : 'text-slate-500 hover:text-green-400'}`}
              title="Move up in queue"
            >
              <ArrowUpIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                // Move down in queue (increase priority slightly)
                console.log(`Moving ${item.droneName} down in queue`);
              }}
              className={`p-1 transition-colors ${isTransparent ? 'text-text-muted hover:text-yellow-400' : 'text-slate-500 hover:text-yellow-400'}`}
              title="Move down in queue"
            >
              <ArrowDownIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                mockTelemetryService.removeDroneFromChargingQueue(item.droneId);
              }}
              className={`p-1 transition-colors ${isTransparent ? 'text-text-muted hover:text-red-400' : 'text-slate-500 hover:text-red-400'}`}
              title="Remove from queue"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </motion.div>
    );
  };

  const StationCard: React.FC<{ station: ChargingStation; index: number }> = ({ station, index }) => {
    const statusConfig = getStationStatusColor(station.status);
    const StatusIcon = statusConfig.icon;
    
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: index * 0.1 }}
        className={`${isTransparent ? 'bg-dark-tertiary border border-dark-border' : 'bg-slate-800 border border-slate-600'} rounded-lg p-4`}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ backgroundColor: statusConfig.bg + '20' }}
            >
              <StatusIcon className="w-5 h-5" style={{ color: statusConfig.color }} />
            </div>
            <div>
              <h3 className={`font-medium ${isTransparent ? 'text-text-primary' : 'text-slate-200'}`}>{station.name}</h3>
              <p className={`text-xs ${isTransparent ? 'text-text-secondary' : 'text-slate-400'}`}>ID: {station.id}</p>
            </div>
          </div>
          
          <span 
            className="px-2 py-1 rounded-full text-xs font-medium capitalize"
            style={{ 
              backgroundColor: statusConfig.color + '20',
              color: statusConfig.color 
            }}
          >
            {station.status}
          </span>
        </div>
        
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className={`${isTransparent ? 'text-text-secondary' : 'text-slate-400'}`}>Charging Rate</span>
            <div className={`font-mono ${isTransparent ? 'text-text-primary' : 'text-slate-200'}`}>{station.chargingRate}%/min</div>
          </div>
          
          <div>
            <span className={`${isTransparent ? 'text-text-secondary' : 'text-slate-400'}`}>Sessions</span>
            <div className={`font-mono ${isTransparent ? 'text-text-primary' : 'text-slate-200'}`}>{station.totalChargingSessions}</div>
          </div>
          
          <div>
            <span className={`${isTransparent ? 'text-text-secondary' : 'text-slate-400'}`}>Avg Time</span>
            <div className={`font-mono ${isTransparent ? 'text-text-primary' : 'text-slate-200'}`}>{formatTime(station.averageChargingTime)}</div>
          </div>
          
          <div>
            <span className={`${isTransparent ? 'text-text-secondary' : 'text-slate-400'}`}>Time Left</span>
            <div className={`font-mono ${isTransparent ? 'text-text-primary' : 'text-slate-200'}`}>
              {station.estimatedTimeRemaining ? formatTime(station.estimatedTimeRemaining) : 'N/A'}
            </div>
          </div>
        </div>
        
        {station.currentDrone && (
          <div className="mt-3 pt-3 border-t border-slate-600">
            <div className="flex items-center gap-2 text-sm">
              <BoltIcon className="w-4 h-4 text-yellow-400" />
              <span className={`${isTransparent ? 'text-text-secondary' : 'text-slate-300'}`}>Currently charging:</span>
              <span className={`font-mono ${isTransparent ? 'text-text-primary' : 'text-slate-200'}`}>{station.currentDrone}</span>
            </div>
          </div>
        )}
        
        <div className={`mt-3 text-xs ${isTransparent ? 'text-text-muted' : 'text-slate-500'}`}>
          Last maintenance: {new Date(station.lastMaintenance).toLocaleDateString()}
        </div>
      </motion.div>
    );
  };

  if (compact) {
    return (
      <div className={`${isTransparent ? className : `bg-slate-900 border border-slate-700 rounded-lg p-4 ${className}`}`}>
        <div className="flex items-center justify-between mb-3">
          <h3 className={`text-lg font-medium flex items-center gap-2 ${isTransparent ? 'text-text-primary' : 'text-slate-200'}`}>
            <BoltIcon className="w-5 h-5" />
            Charging
          </h3>
          <div className="flex items-center gap-2 text-sm">
            {chargingStats && (
              <span className={`${isTransparent ? 'text-text-secondary' : 'text-slate-400'}`}>
                {chargingStats.occupiedStations}/{chargingStats.totalStations} • Queue: {chargingStats.totalInQueue}
              </span>
            )}
          </div>
        </div>
        
        <div className="space-y-2">
          {chargingStats && (
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className={`${isTransparent ? 'text-text-secondary' : 'text-slate-400'}`}>Available</span>
                <div className="text-green-400 font-mono">{chargingStats.availableStations}</div>
              </div>
              <div>
                <span className={`${isTransparent ? 'text-text-secondary' : 'text-slate-400'}`}>In Queue</span>
                <div className="text-orange-400 font-mono">{chargingStats.totalInQueue}</div>
              </div>
            </div>
          )}
          
          {globalQueue.length > 0 && (
            <div className="space-y-1">
              <div className="text-xs font-medium text-slate-300">Next in queue:</div>
              {globalQueue.slice(0, 2).map((item) => (
                <div key={item.id} className="text-xs text-slate-400 flex items-center justify-between">
                  <span>{item.queuePosition}. {item.droneName}</span>
                  <span>{item.batteryLevel.toFixed(0)}%</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={isTransparent ? className : `bg-slate-900 border border-slate-700 rounded-lg ${className}`}>
      {/* Header */}
      <div className={`flex items-center justify-between ${isTransparent ? 'p-4 border-b border-dark-border' : 'p-6 border-b border-slate-700'}`}>
        <h2 className={`${isTransparent ? 'text-lg font-semibold text-text-primary' : 'text-xl font-semibold text-slate-200'} flex items-center gap-3`}>
          <BoltIcon className={`${isTransparent ? 'w-5 h-5' : 'w-6 h-6'}`} />
          Charging Management
        </h2>
        
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-4 text-sm ${isTransparent ? 'text-text-secondary' : 'text-slate-400'}`}>
            {chargingStats && (
              <>
                <span>{chargingStats.occupiedStations}/{chargingStats.totalStations} stations busy</span>
                <span>{chargingStats.totalInQueue} in queue</span>
                <span>Avg wait: {formatTime(chargingStats.averageWaitTime)}</span>
              </>
            )}
          </div>
          
          <div className="flex space-x-1">
            <button
              onClick={() => setActiveView('overview')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                activeView === 'overview'
                  ? (isTransparent ? 'bg-dark-tertiary text-text-primary border border-dark-border' : 'bg-slate-700 text-slate-200')
                  : (isTransparent ? 'text-text-secondary hover:text-text-primary hover:bg-dark-hover' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800')
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveView('queue')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors flex items-center gap-1 ${
                activeView === 'queue'
                  ? (isTransparent ? 'bg-dark-tertiary text-text-primary border border-dark-border' : 'bg-slate-700 text-slate-200')
                  : (isTransparent ? 'text-text-secondary hover:text-text-primary hover:bg-dark-hover' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800')
              }`}
            >
              <QueueListIcon className="w-4 h-4" />
              Queue
              {globalQueue.length > 0 && (
                <span className="bg-orange-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                  {globalQueue.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveView('stations')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                activeView === 'stations'
                  ? (isTransparent ? 'bg-dark-tertiary text-text-primary border border-dark-border' : 'bg-slate-700 text-slate-200')
                  : (isTransparent ? 'text-text-secondary hover:text-text-primary hover:bg-dark-hover' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800')
              }`}
            >
              Stations
            </button>
          </div>
        </div>
      </div>
      
      {/* Content */}
      <div className={`${isTransparent ? 'p-4 flex-1 overflow-auto' : 'p-6'}`}>
        <AnimatePresence mode="wait">
          {activeView === 'overview' && chargingStats && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {/* Stats Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className={`${isTransparent ? 'bg-dark-tertiary border border-dark-border' : 'bg-slate-800 border border-slate-600'} rounded-lg p-4`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-sm ${isTransparent ? 'text-text-secondary' : 'text-slate-400'}`}>Available Stations</span>
                    <CheckCircleIcon className="w-5 h-5 text-green-400" />
                  </div>
                  <div className="text-2xl font-bold text-green-400">{chargingStats.availableStations}</div>
                  <div className={`text-xs ${isTransparent ? 'text-text-muted' : 'text-slate-500'}`}>of {chargingStats.totalStations} total</div>
                </div>
                
                <div className={`${isTransparent ? 'bg-dark-tertiary border border-dark-border' : 'bg-slate-800 border border-slate-600'} rounded-lg p-4`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-sm ${isTransparent ? 'text-text-secondary' : 'text-slate-400'}`}>Queue Length</span>
                    <QueueListIcon className="w-5 h-5 text-orange-400" />
                  </div>
                  <div className="text-2xl font-bold text-orange-400">{chargingStats.totalInQueue}</div>
                  <div className={`text-xs ${isTransparent ? 'text-text-muted' : 'text-slate-500'}`}>drones waiting</div>
                </div>
                
                <div className={`${isTransparent ? 'bg-dark-tertiary border border-dark-border' : 'bg-slate-800 border border-slate-600'} rounded-lg p-4`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-sm ${isTransparent ? 'text-text-secondary' : 'text-slate-400'}`}>Avg Wait Time</span>
                    <ClockIcon className="w-5 h-5 text-blue-400" />
                  </div>
                  <div className="text-2xl font-bold text-blue-400">{formatTime(chargingStats.averageWaitTime)}</div>
                  <div className={`text-xs ${isTransparent ? 'text-text-muted' : 'text-slate-500'}`}>current estimate</div>
                </div>
                
                <div className={`${isTransparent ? 'bg-dark-tertiary border border-dark-border' : 'bg-slate-800 border border-slate-600'} rounded-lg p-4`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-sm ${isTransparent ? 'text-text-secondary' : 'text-slate-400'}`}>Daily Sessions</span>
                    <BoltIcon className="w-5 h-5 text-yellow-400" />
                  </div>
                  <div className="text-2xl font-bold text-yellow-400">{chargingStats.dailyChargingSessions}</div>
                  <div className={`text-xs ${isTransparent ? 'text-text-muted' : 'text-slate-500'}`}>completed today</div>
                </div>
              </div>
              
              {/* Quick Queue Preview */}
              {globalQueue.length > 0 && (
                <div>
                  <h3 className="text-lg font-medium text-slate-200 mb-4">Next in Queue</h3>
                  <div className="grid gap-3">
                    {globalQueue.slice(0, 3).map((item, index) => (
                      <QueueItemCard key={item.id} item={item} index={index} />
                    ))}
                  </div>
                  {globalQueue.length > 3 && (
                    <div className="text-center mt-3">
                      <button
                        onClick={() => setActiveView('queue')}
                        className={`text-sm hover:text-blue-300 ${isTransparent ? 'text-status-active' : 'text-blue-400'}`}
                      >
                        View all {globalQueue.length} items in queue →
                      </button>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}
          
          {activeView === 'queue' && (
            <motion.div
              key="queue"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              <h3 className={`text-lg font-medium ${isTransparent ? 'text-text-primary' : 'text-slate-200'}`}>
                Charging Queue ({globalQueue.length})
              </h3>
              
              {globalQueue.length === 0 ? (
                <div className="text-center py-8">
                  <QueueListIcon className={`w-12 h-12 mx-auto mb-3 ${isTransparent ? 'text-text-muted' : 'text-slate-500'}`} />
                  <h4 className={`text-lg font-semibold mb-2 ${isTransparent ? 'text-text-secondary' : 'text-slate-300'}`}>No Drones in Queue</h4>
                  <p className={`${isTransparent ? 'text-text-muted' : 'text-slate-500'}`}>All drones are either charged or currently charging</p>
                </div>
              ) : (
                <div className={`space-y-3 ${isTransparent ? 'max-h-64' : 'max-h-96'} overflow-y-auto`}>
                  {globalQueue.map((item, index) => (
                    <QueueItemCard key={item.id} item={item} index={index} />
                  ))}
                </div>
              )}
            </motion.div>
          )}
          
          {activeView === 'stations' && (
            <motion.div
              key="stations"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              <h3 className={`text-lg font-medium ${isTransparent ? 'text-text-primary' : 'text-slate-200'}`}>
                Charging Stations ({chargingStations.length})
              </h3>
              
              <div className="grid gap-4 lg:grid-cols-2">
                {chargingStations.map((station, index) => (
                  <StationCard key={station.id} station={station} index={index} />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default ChargingPanel;