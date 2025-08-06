import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { DroneData, MissionData, FleetAlert } from '@/types/fleet';
import { telemetryService, ConnectionState } from '@/services/websocket';
import { mockDrones, mockMissions, mockAlerts, mockTelemetryService } from '@/services/mockData';

interface FleetStore {
  // Connection state
  connectionState: ConnectionState;
  connectionError: string | null;
  lastUpdate: Date | null;

  // Fleet data
  drones: Record<string, DroneData>;
  missions: Record<string, MissionData>;
  alerts: FleetAlert[];
  selectedDroneId: string | null;

  // Statistics
  stats: {
    messagesReceived: number;
    messagesProcessed: number;
    connectionUptime: number;
    reconnectCount: number;
  };

  // Actions
  setConnectionState: (state: ConnectionState, error?: string) => void;
  updateDrone: (drone: DroneData) => void;
  updateMission: (mission: MissionData) => void;
  addAlert: (alert: FleetAlert) => void;
  dismissAlert: (alertId: string) => void;
  selectDrone: (droneId: string | null) => void;
  updateStats: (stats: any) => void;

  // Fleet operations
  getDroneById: (id: string) => DroneData | undefined;
  getActiveDrones: () => DroneData[];
  getDronesWithIssues: () => DroneData[];
  getIdleDrones: () => DroneData[];
  getCriticalAlerts: () => FleetAlert[];
  getFleetSummary: () => {
    total: number;
    active: number;
    idle: number;
    issues: number;
    charging: number;
    maintenance: number;
    avgBattery: number;
    avgSignal: number;
  };

  // WebSocket integration
  connect: () => void;
  disconnect: () => void;
  isConnected: () => boolean;
}

export const useFleetStore = create<FleetStore>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    connectionState: ConnectionState.DISCONNECTED,
    connectionError: null,
    lastUpdate: null,
    drones: {},
    missions: {},
    alerts: [],
    selectedDroneId: null,
    stats: {
      messagesReceived: 0,
      messagesProcessed: 0,
      connectionUptime: 0,
      reconnectCount: 0,
    },

    // Actions
    setConnectionState: (state: ConnectionState, error?: string) => {
      set({
        connectionState: state,
        connectionError: error || null,
      });
    },

    updateDrone: (drone: DroneData) => {
      set((state) => ({
        drones: {
          ...state.drones,
          [drone.id]: {
            ...drone,
            lastUpdate: new Date().toISOString(),
          },
        },
        lastUpdate: new Date(),
      }));
    },

    updateMission: (mission: MissionData) => {
      set((state) => ({
        missions: {
          ...state.missions,
          [mission.id]: mission,
        },
        lastUpdate: new Date(),
      }));
    },

    addAlert: (alert: FleetAlert) => {
      set((state) => ({
        alerts: [alert, ...state.alerts.slice(0, 99)], // Keep last 100 alerts
        lastUpdate: new Date(),
      }));
    },

    dismissAlert: (alertId: string) => {
      set((state) => ({
        alerts: state.alerts.filter((alert) => alert.id !== alertId),
      }));
    },

    selectDrone: (droneId: string | null) => {
      set({ selectedDroneId: droneId });
    },

    updateStats: (stats: any) => {
      set({ stats });
    },

    // Fleet operations
    getDroneById: (id: string) => {
      return get().drones[id];
    },

    getActiveDrones: () => {
      const { drones } = get();
      return Object.values(drones).filter(
        (drone) => drone.status === 'active' || drone.status === 'in_flight'
      );
    },

    getDronesWithIssues: () => {
      const { drones } = get();
      return Object.values(drones).filter(
        (drone) =>
          drone.status === 'maintenance' ||
          drone.status === 'emergency' ||
          drone.batteryLevel < 20 ||
          drone.signalStrength < -90 ||
          (drone.alerts && drone.alerts.length > 0)
      );
    },

    getIdleDrones: () => {
      const { drones } = get();
      return Object.values(drones).filter((drone) => drone.status === 'idle');
    },

    getCriticalAlerts: () => {
      const { alerts } = get();
      return alerts.filter((alert) => alert.severity === 'critical');
    },

    getFleetSummary: () => {
      const { drones } = get();
      const droneList = Object.values(drones);

      if (droneList.length === 0) {
        return {
          total: 0,
          active: 0,
          idle: 0,
          issues: 0,
          charging: 0,
          maintenance: 0,
          avgBattery: 0,
          avgSignal: 0,
        };
      }

      const summary = droneList.reduce(
        (acc, drone) => {
          acc.total++;
          
          switch (drone.status) {
            case 'active':
            case 'in_flight':
              acc.active++;
              break;
            case 'idle':
              acc.idle++;
              break;
            case 'charging':
              acc.charging++;
              break;
            case 'maintenance':
            case 'emergency':
              acc.maintenance++;
              break;
          }

          if (
            drone.batteryLevel < 20 ||
            drone.signalStrength < -90 ||
            (drone.alerts && drone.alerts.length > 0)
          ) {
            acc.issues++;
          }

          acc.totalBattery += drone.batteryLevel;
          acc.totalSignal += drone.signalStrength;

          return acc;
        },
        {
          total: 0,
          active: 0,
          idle: 0,
          issues: 0,
          charging: 0,
          maintenance: 0,
          totalBattery: 0,
          totalSignal: 0,
        }
      );

      return {
        total: summary.total,
        active: summary.active,
        idle: summary.idle,
        issues: summary.issues,
        charging: summary.charging,
        maintenance: summary.maintenance,
        avgBattery: Math.round(summary.totalBattery / summary.total),
        avgSignal: Math.round(summary.totalSignal / summary.total),
      };
    },

    // WebSocket integration
    connect: () => {
      const store = get();
      
      // Set up event handlers
      telemetryService.setConnectionStateCallback((state, error) => {
        store.setConnectionState(state, error?.message);
        
        // If connection fails, fall back to mock data for development
        if (state === ConnectionState.ERROR || state === ConnectionState.DISCONNECTED) {
          setTimeout(() => {
            console.log('🔧 WebSocket connection failed, using mock data for development');
            
            // Load initial mock data
            mockDrones.forEach(drone => store.updateDrone(drone));
            mockMissions.forEach(mission => store.updateMission(mission));
            mockAlerts.forEach(alert => store.addAlert(alert));
            
            // Set up mock telemetry updates
            mockTelemetryService.onDroneDataUpdate((drone) => {
              store.updateDrone(drone);
            });
            
            mockTelemetryService.start();
          }, 1000);
        }
      });

      telemetryService.onDroneDataUpdate((drone) => {
        store.updateDrone(drone);
      });

      telemetryService.onMissionDataUpdate((mission) => {
        store.updateMission(mission);
      });

      telemetryService.onFleetAlertReceived((alert) => {
        store.addAlert(alert);
      });

      // Update stats periodically
      const updateStats = () => {
        const stats = telemetryService.getStatistics();
        store.updateStats(stats);
      };

      setInterval(updateStats, 5000); // Update every 5 seconds

      // Connect to telemetry service
      telemetryService.connect();
    },

    disconnect: () => {
      telemetryService.disconnect();
      set({
        connectionState: ConnectionState.DISCONNECTED,
        connectionError: null,
      });
    },

    isConnected: () => {
      return get().connectionState === ConnectionState.CONNECTED;
    },
  }))
);

// Auto-connect when store is created
let isAutoConnectInitialized = false;

export const initializeFleetStore = () => {
  if (!isAutoConnectInitialized) {
    isAutoConnectInitialized = true;
    
    // Connect to telemetry service on store initialization
    const { connect } = useFleetStore.getState();
    connect();

    // Subscribe to connection state changes for logging
    useFleetStore.subscribe(
      (state) => state.connectionState,
      (connectionState, prevConnectionState) => {
        if (prevConnectionState && connectionState !== prevConnectionState) {
          console.log(`Fleet store connection state: ${prevConnectionState} → ${connectionState}`);
        }
      }
    );

    // Subscribe to drone updates for logging
    useFleetStore.subscribe(
      (state) => Object.keys(state.drones).length,
      (droneCount, prevDroneCount) => {
        if (prevDroneCount !== undefined && droneCount !== prevDroneCount) {
          console.log(`Fleet store drone count: ${prevDroneCount} → ${droneCount}`);
        }
      }
    );
  }
};

// Selectors for common data patterns
export const useFleetSummary = () => useFleetStore((state) => state.getFleetSummary());
export const useActiveDrones = () => useFleetStore((state) => state.getActiveDrones());
export const useDronesWithIssues = () => useFleetStore((state) => state.getDronesWithIssues());
export const useSelectedDrone = (): DroneData | null => {
  const selectedDroneId = useFleetStore((state) => state.selectedDroneId);
  const getDroneById = useFleetStore((state) => state.getDroneById);
  return selectedDroneId ? getDroneById(selectedDroneId) || null : null;
};
export const useCriticalAlerts = () => useFleetStore((state) => state.getCriticalAlerts());
export const useConnectionStatus = () => useFleetStore((state) => ({
  state: state.connectionState,
  error: state.connectionError,
  isConnected: state.isConnected(),
  lastUpdate: state.lastUpdate,
}));