import { DroneData } from '@/types/fleet';

export interface ChargingStation {
  id: string;
  name: string;
  status: 'available' | 'occupied' | 'maintenance' | 'reserved';
  currentDrone?: string;
  chargingRate: number; // Percentage per minute
  estimatedTimeRemaining?: number; // Minutes
  position: {
    lat: number;
    lng: number;
    alt: number;
  };
  lastMaintenance: string;
  totalChargingSessions: number;
  averageChargingTime: number; // Minutes
}

export interface ChargingQueueItem {
  id: string;
  droneId: string;
  droneName: string;
  priority: number; // 1-5, 5 being highest
  batteryLevel: number;
  estimatedArrival: number; // Minutes
  queuePosition: number;
  requestedAt: string;
  expectedChargingTime: number; // Minutes
  missionPriority: 'low' | 'normal' | 'high' | 'critical';
  reason: 'low_battery' | 'scheduled' | 'pre_mission' | 'maintenance' | 'emergency';
}

export interface ChargingSchedule {
  stationId: string;
  stationName: string;
  queue: ChargingQueueItem[];
  currentlyCharging?: ChargingQueueItem;
  estimatedWaitTime: number; // Minutes
  totalQueueTime: number; // Minutes
}

export interface ChargingStats {
  totalStations: number;
  availableStations: number;
  occupiedStations: number;
  maintenanceStations: number;
  totalInQueue: number;
  averageWaitTime: number;
  averageChargingTime: number;
  dailyChargingSessions: number;
  peakUsageHour: number;
}

export class ChargingService {
  private stations: Map<string, ChargingStation> = new Map();
  private globalQueue: ChargingQueueItem[] = [];
  private chargingHistory: Array<{
    droneId: string;
    stationId: string;
    startTime: string;
    endTime: string;
    chargingTime: number;
    batteryStart: number;
    batteryEnd: number;
  }> = [];

  constructor() {
    this.initializeChargingStations();
    console.log('🔋 Charging Service initialized with queue management');
  }

  private initializeChargingStations() {
    // Initialize 3 charging stations around the operational area
    this.stations.set('station-001', {
      id: 'station-001',
      name: 'Base Station Alpha',
      status: 'occupied',
      currentDrone: 'drone-002', // Beta-2 is charging
      chargingRate: 3.5, // 3.5% per minute
      estimatedTimeRemaining: 12,
      position: { lat: 37.7849, lng: -122.4094, alt: 2.1 },
      lastMaintenance: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      totalChargingSessions: 47,
      averageChargingTime: 28
    });

    this.stations.set('station-002', {
      id: 'station-002',
      name: 'Base Station Beta',
      status: 'available',
      chargingRate: 4.2, // Faster charging
      position: { lat: 37.7650, lng: -122.4150, alt: 2.5 },
      lastMaintenance: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      totalChargingSessions: 31,
      averageChargingTime: 24
    });

    this.stations.set('station-003', {
      id: 'station-003',
      name: 'Base Station Gamma',
      status: 'available',
      chargingRate: 3.0,
      position: { lat: 37.7550, lng: -122.4250, alt: 1.8 },
      lastMaintenance: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
      totalChargingSessions: 23,
      averageChargingTime: 32
    });

    console.log(`🔋 Initialized ${this.stations.size} charging stations`);
  }

  /**
   * Calculate charging priority based on multiple factors
   */
  private calculatePriority(drone: DroneData, reason: ChargingQueueItem['reason']): number {
    let priority = 1;

    // Battery level urgency (1-3 points)
    if (drone.batteryLevel < 10) priority += 3;
    else if (drone.batteryLevel < 20) priority += 2;
    else if (drone.batteryLevel < 30) priority += 1;

    // Mission priority (0-2 points)
    if (drone.currentMission) {
      const missionUrgency = this.getMissionPriority(drone);
      if (missionUrgency === 'critical') priority += 2;
      else if (missionUrgency === 'high') priority += 1;
    }

    // Reason urgency (0-2 points)
    switch (reason) {
      case 'emergency':
        priority += 2;
        break;
      case 'low_battery':
        priority += 1;
        break;
      case 'pre_mission':
        priority += 1;
        break;
    }

    // Flight time priority (longer flight time = higher priority)
    const flightTime = drone.totalFlightTime || 0;
    if (flightTime > 2000) priority += 1;

    return Math.min(priority, 5); // Cap at 5
  }

  private getMissionPriority(drone: DroneData): 'low' | 'normal' | 'high' | 'critical' {
    if (!drone.currentMission) return 'low';
    
    // Simple priority based on mission name keywords
    const missionName = drone.currentMission.name.toLowerCase();
    if (missionName.includes('emergency') || missionName.includes('medical')) return 'critical';
    if (missionName.includes('security') || missionName.includes('patrol')) return 'high';
    if (missionName.includes('delivery')) return 'normal';
    return 'low';
  }

  /**
   * Add a drone to the charging queue
   */
  addToQueue(
    drone: DroneData, 
    reason: ChargingQueueItem['reason'] = 'low_battery',
    estimatedArrival: number = 5
  ): ChargingQueueItem {
    // Check if drone is already in queue
    const existingIndex = this.globalQueue.findIndex(item => item.droneId === drone.id);
    if (existingIndex !== -1) {
      console.warn(`Drone ${drone.id} already in charging queue`);
      return this.globalQueue[existingIndex];
    }

    const priority = this.calculatePriority(drone, reason);
    const expectedChargingTime = this.calculateExpectedChargingTime(drone.batteryLevel);
    const missionPriority = this.getMissionPriority(drone);

    const queueItem: ChargingQueueItem = {
      id: `queue-${drone.id}-${Date.now()}`,
      droneId: drone.id,
      droneName: drone.name,
      priority,
      batteryLevel: drone.batteryLevel,
      estimatedArrival,
      queuePosition: 0, // Will be calculated when sorting
      requestedAt: new Date().toISOString(),
      expectedChargingTime,
      missionPriority,
      reason
    };

    this.globalQueue.push(queueItem);
    this.sortQueue();
    
    console.log(`🔋 Added ${drone.name} to charging queue (Priority: ${priority}, Battery: ${drone.batteryLevel}%)`);
    return queueItem;
  }

  /**
   * Sort queue by priority and update positions
   */
  private sortQueue() {
    this.globalQueue.sort((a, b) => {
      // Sort by priority first (higher priority first)
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      
      // Then by battery level (lower battery first)
      if (a.batteryLevel !== b.batteryLevel) {
        return a.batteryLevel - b.batteryLevel;
      }
      
      // Finally by request time (first come, first served)
      return new Date(a.requestedAt).getTime() - new Date(b.requestedAt).getTime();
    });

    // Update queue positions
    this.globalQueue.forEach((item, index) => {
      item.queuePosition = index + 1;
    });
  }

  /**
   * Calculate expected charging time based on current battery level
   */
  private calculateExpectedChargingTime(currentBattery: number, targetBattery: number = 90): number {
    const batteryNeeded = Math.max(0, targetBattery - currentBattery);
    const averageChargingRate = 3.5; // Average % per minute across all stations
    return Math.ceil(batteryNeeded / averageChargingRate);
  }

  /**
   * Find the best available charging station
   */
  private findBestAvailableStation(): ChargingStation | null {
    const availableStations = Array.from(this.stations.values())
      .filter(station => station.status === 'available')
      .sort((a, b) => b.chargingRate - a.chargingRate); // Prefer faster charging

    return availableStations[0] || null;
  }

  /**
   * Assign next drone in queue to an available station
   */
  assignNextDrone(): { assigned: boolean; stationId?: string; droneId?: string } {
    if (this.globalQueue.length === 0) {
      return { assigned: false };
    }

    const station = this.findBestAvailableStation();
    if (!station) {
      return { assigned: false };
    }

    const nextDrone = this.globalQueue.shift()!;
    
    // Assign drone to station
    station.status = 'occupied';
    station.currentDrone = nextDrone.droneId;
    station.estimatedTimeRemaining = this.calculateExpectedChargingTime(nextDrone.batteryLevel);

    // Start charging session tracking
    this.startChargingSession(nextDrone.droneId, station.id, nextDrone.batteryLevel);

    // Update queue positions
    this.sortQueue();

    console.log(`🔋 Assigned ${nextDrone.droneName} to ${station.name} (Est: ${station.estimatedTimeRemaining}min)`);
    
    return { 
      assigned: true, 
      stationId: station.id, 
      droneId: nextDrone.droneId 
    };
  }

  /**
   * Start tracking a charging session
   */
  private startChargingSession(droneId: string, stationId: string, _startBattery: number) {
    // This would integrate with the actual charging hardware
    console.log(`🔋 Started charging session: ${droneId} at ${stationId}`);
  }

  /**
   * Complete charging session and free up station
   */
  completeChargingSession(stationId: string, endBattery: number): boolean {
    const station = this.stations.get(stationId);
    if (!station || station.status !== 'occupied') {
      return false;
    }

    const droneId = station.currentDrone!;
    const chargingTime = station.averageChargingTime; // Simplified

    // Record charging history
    this.chargingHistory.push({
      droneId,
      stationId,
      startTime: new Date(Date.now() - chargingTime * 60 * 1000).toISOString(),
      endTime: new Date().toISOString(),
      chargingTime,
      batteryStart: endBattery - (endBattery * 0.7), // Estimate start battery
      batteryEnd: endBattery
    });

    // Free up station
    station.status = 'available';
    station.currentDrone = undefined;
    station.estimatedTimeRemaining = undefined;
    station.totalChargingSessions++;

    console.log(`🔋 Completed charging: ${droneId} at ${station.name} (${endBattery}%)`);
    
    // Try to assign next drone
    this.assignNextDrone();
    
    return true;
  }

  /**
   * Remove drone from queue (e.g., if mission cancelled or emergency)
   */
  removeFromQueue(droneId: string): boolean {
    const index = this.globalQueue.findIndex(item => item.droneId === droneId);
    if (index === -1) return false;

    this.globalQueue.splice(index, 1);
    this.sortQueue();
    
    console.log(`🔋 Removed ${droneId} from charging queue`);
    return true;
  }

  /**
   * Get queue status for a specific drone
   */
  getQueueStatus(droneId: string): ChargingQueueItem | null {
    return this.globalQueue.find(item => item.droneId === droneId) || null;
  }

  /**
   * Get charging schedules for all stations
   */
  getChargingSchedules(): ChargingSchedule[] {
    const schedules: ChargingSchedule[] = [];
    
    Array.from(this.stations.values()).forEach(station => {
      const queueForStation = this.globalQueue.slice(); // All drones can use any station
      const currentlyCharging = station.currentDrone ? 
        this.globalQueue.find(item => item.droneId === station.currentDrone) : undefined;
      
      const totalQueueTime = queueForStation.reduce((sum, item) => sum + item.expectedChargingTime, 0);
      const estimatedWaitTime = station.status === 'available' ? 0 : 
        (station.estimatedTimeRemaining || 0) + totalQueueTime;

      schedules.push({
        stationId: station.id,
        stationName: station.name,
        queue: queueForStation,
        currentlyCharging,
        estimatedWaitTime,
        totalQueueTime
      });
    });

    return schedules;
  }

  /**
   * Get all charging stations
   */
  getChargingStations(): ChargingStation[] {
    return Array.from(this.stations.values());
  }

  /**
   * Get charging statistics
   */
  getChargingStats(): ChargingStats {
    const stations = Array.from(this.stations.values());
    const availableCount = stations.filter(s => s.status === 'available').length;
    const occupiedCount = stations.filter(s => s.status === 'occupied').length;
    const maintenanceCount = stations.filter(s => s.status === 'maintenance').length;
    
    const totalSessions = stations.reduce((sum, s) => sum + s.totalChargingSessions, 0);
    const avgChargingTime = stations.reduce((sum, s) => sum + s.averageChargingTime, 0) / stations.length;
    
    return {
      totalStations: stations.length,
      availableStations: availableCount,
      occupiedStations: occupiedCount,
      maintenanceStations: maintenanceCount,
      totalInQueue: this.globalQueue.length,
      averageWaitTime: this.calculateAverageWaitTime(),
      averageChargingTime: Math.round(avgChargingTime),
      dailyChargingSessions: totalSessions,
      peakUsageHour: 14 // 2 PM - simplified
    };
  }

  private calculateAverageWaitTime(): number {
    if (this.globalQueue.length === 0) return 0;
    
    const occupiedStations = Array.from(this.stations.values())
      .filter(s => s.status === 'occupied');
    
    const totalWaitTime = occupiedStations.reduce((sum, station) => 
      sum + (station.estimatedTimeRemaining || 0), 0
    );
    
    return Math.round(totalWaitTime / Math.max(this.globalQueue.length, 1));
  }

  /**
   * Update charging progress for occupied stations
   */
  updateChargingProgress() {
    Array.from(this.stations.values()).forEach(station => {
      if (station.status === 'occupied' && station.estimatedTimeRemaining) {
        station.estimatedTimeRemaining = Math.max(0, station.estimatedTimeRemaining - 1);
        
        // If charging complete, free up station
        if (station.estimatedTimeRemaining <= 0) {
          this.completeChargingSession(station.id, 90); // Assume 90% target
        }
      }
    });
  }

  /**
   * Check if a drone should be added to charging queue automatically
   */
  shouldAddToQueue(drone: DroneData): boolean {
    // Already in queue
    if (this.getQueueStatus(drone.id)) return false;
    
    // Already charging
    if (drone.status === 'charging') return false;
    
    // Critical battery
    if (drone.batteryLevel < 15) return true;
    
    // Low battery and returning/idle
    if (drone.batteryLevel < 25 && (drone.status === 'idle' || !drone.currentMission)) return true;
    
    // Pre-mission charging (if battery < 80% and has upcoming mission)
    if (drone.batteryLevel < 80 && drone.currentMission && drone.currentMission.status === 'pending') return true;
    
    return false;
  }

  /**
   * Process automatic queue management
   */
  processAutoQueue(drones: DroneData[]) {
    drones.forEach(drone => {
      if (this.shouldAddToQueue(drone)) {
        let reason: ChargingQueueItem['reason'] = 'scheduled';
        
        if (drone.batteryLevel < 15) reason = 'emergency';
        else if (drone.batteryLevel < 25) reason = 'low_battery';
        else if (drone.currentMission?.status === 'pending') reason = 'pre_mission';
        
        this.addToQueue(drone, reason);
      }
    });
    
    // Try to assign waiting drones to available stations
    let assigned = true;
    while (assigned) {
      const result = this.assignNextDrone();
      assigned = result.assigned;
    }
  }
}

export const chargingService = new ChargingService();