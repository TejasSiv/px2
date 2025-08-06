import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { MissionData, Waypoint } from '@/types/fleet';

interface MissionStats {
  total: number;
  pending: number;
  active: number;
  completed: number;
  failed: number;
  cancelled: number;
  avg_progress: number;
  today: number;
}

interface MissionStore {
  // State
  missions: Record<string, MissionData>;
  activeMissions: MissionData[];
  selectedMissionId: string | null;
  missionStats: MissionStats | null;
  
  // WebSocket connection state
  wsConnected: boolean;
  wsError: string | null;
  lastUpdate: string | null;

  // Loading states
  loading: boolean;
  creating: boolean;
  updating: boolean;
  deleting: boolean;

  // Actions
  setMissions: (missions: MissionData[]) => void;
  setActiveMissions: (missions: MissionData[]) => void;
  setMissionStats: (stats: MissionStats) => void;
  selectMission: (missionId: string | null) => void;
  
  // CRUD operations
  createMission: (missionData: Partial<MissionData>) => Promise<MissionData>;
  updateMission: (missionId: string, updates: Partial<MissionData>) => Promise<MissionData>;
  deleteMission: (missionId: string) => Promise<void>;
  assignMissionToDrone: (missionId: string, droneId: string) => Promise<void>;
  updateMissionProgress: (missionId: string, progress: number, currentWaypoint?: number) => Promise<void>;
  
  // WebSocket actions
  setWsConnected: (connected: boolean) => void;
  setWsError: (error: string | null) => void;
  handleMissionEvent: (event: string, data: any) => void;
  
  // Utility functions
  getMissionById: (missionId: string) => MissionData | undefined;
  getMissionsByDrone: (droneId: string) => MissionData[];
  getMissionsByStatus: (status: MissionData['status']) => MissionData[];
  clearMissions: () => void;
}

const API_BASE_URL = 'http://localhost:3001/api';
const WS_URL = 'ws://localhost:3001/ws';

let wsConnection: WebSocket | null = null;
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;

const useMissionStore = create<MissionStore>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    missions: {},
    activeMissions: [],
    selectedMissionId: null,
    missionStats: null,
    
    wsConnected: false,
    wsError: null,
    lastUpdate: null,
    
    loading: false,
    creating: false,
    updating: false,
    deleting: false,

    // State setters
    setMissions: (missions) => {
      const missionMap: Record<string, MissionData> = {};
      missions.forEach(mission => {
        missionMap[mission.id] = mission;
      });
      
      set({
        missions: missionMap,
        lastUpdate: new Date().toISOString()
      });
    },

    setActiveMissions: (missions) => set({ activeMissions: missions }),
    setMissionStats: (stats) => set({ missionStats: stats }),
    selectMission: (missionId) => set({ selectedMissionId: missionId }),

    // CRUD operations
    createMission: async (missionData) => {
      set({ creating: true });
      
      try {
        const response = await fetch(`${API_BASE_URL}/missions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(missionData),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Failed to create mission');
        }

        const result = await response.json();
        const mission = result.data;

        // Update local state
        set((state) => ({
          missions: {
            ...state.missions,
            [mission.id]: mission
          },
          creating: false,
          lastUpdate: new Date().toISOString()
        }));

        return mission;
      } catch (error) {
        set({ creating: false });
        throw error;
      }
    },

    updateMission: async (missionId, updates) => {
      set({ updating: true });
      
      try {
        const response = await fetch(`${API_BASE_URL}/missions/${missionId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updates),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Failed to update mission');
        }

        const result = await response.json();
        const mission = result.data;

        // Update local state
        set((state) => ({
          missions: {
            ...state.missions,
            [missionId]: mission
          },
          updating: false,
          lastUpdate: new Date().toISOString()
        }));

        return mission;
      } catch (error) {
        set({ updating: false });
        throw error;
      }
    },

    deleteMission: async (missionId) => {
      set({ deleting: true });
      
      try {
        const response = await fetch(`${API_BASE_URL}/missions/${missionId}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Failed to delete mission');
        }

        // Update local state
        set((state) => {
          const { [missionId]: deleted, ...remainingMissions } = state.missions;
          return {
            missions: remainingMissions,
            selectedMissionId: state.selectedMissionId === missionId ? null : state.selectedMissionId,
            activeMissions: state.activeMissions.filter(m => m.id !== missionId),
            deleting: false,
            lastUpdate: new Date().toISOString()
          };
        });
      } catch (error) {
        set({ deleting: false });
        throw error;
      }
    },

    assignMissionToDrone: async (missionId, droneId) => {
      try {
        const response = await fetch(`${API_BASE_URL}/missions/${missionId}/assign`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ droneId }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Failed to assign mission');
        }

        const result = await response.json();
        const mission = result.data;

        // Update local state
        set((state) => ({
          missions: {
            ...state.missions,
            [missionId]: mission
          },
          lastUpdate: new Date().toISOString()
        }));
      } catch (error) {
        throw error;
      }
    },

    updateMissionProgress: async (missionId, progress, currentWaypoint) => {
      try {
        const response = await fetch(`${API_BASE_URL}/missions/${missionId}/progress`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ progress, currentWaypoint }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Failed to update progress');
        }

        // Update local state
        set((state) => {
          const mission = state.missions[missionId];
          if (mission) {
            return {
              missions: {
                ...state.missions,
                [missionId]: {
                  ...mission,
                  progress,
                  currentWaypoint: currentWaypoint ?? mission.currentWaypoint
                }
              },
              lastUpdate: new Date().toISOString()
            };
          }
          return state;
        });
      } catch (error) {
        throw error;
      }
    },

    // WebSocket actions
    setWsConnected: (connected) => set({ wsConnected: connected }),
    setWsError: (error) => set({ wsError: error }),

    handleMissionEvent: (event, data) => {
      const state = get();
      
      switch (event) {
        case 'mission_created':
          set({
            missions: {
              ...state.missions,
              [data.id]: data
            },
            lastUpdate: new Date().toISOString()
          });
          break;

        case 'mission_updated':
          set({
            missions: {
              ...state.missions,
              [data.id]: data
            },
            lastUpdate: new Date().toISOString()
          });
          break;

        case 'mission_deleted':
          const { [data.id]: deleted, ...remainingMissions } = state.missions;
          set({
            missions: remainingMissions,
            selectedMissionId: state.selectedMissionId === data.id ? null : state.selectedMissionId,
            activeMissions: state.activeMissions.filter(m => m.id !== data.id),
            lastUpdate: new Date().toISOString()
          });
          break;

        case 'mission_assigned':
          if (state.missions[data.missionId]) {
            set({
              missions: {
                ...state.missions,
                [data.missionId]: data.mission
              },
              lastUpdate: new Date().toISOString()
            });
          }
          break;

        case 'mission_progress':
          const mission = state.missions[data.missionId];
          if (mission) {
            set({
              missions: {
                ...state.missions,
                [data.missionId]: {
                  ...mission,
                  progress: data.progress,
                  currentWaypoint: data.currentWaypoint,
                  status: data.status || mission.status
                }
              },
              lastUpdate: new Date().toISOString()
            });
          }
          break;

        default:
          console.log('Unknown mission event:', event, data);
      }
    },

    // Utility functions
    getMissionById: (missionId) => get().missions[missionId],
    
    getMissionsByDrone: (droneId) => {
      const missions = Object.values(get().missions);
      return missions.filter(mission => mission.assignedDrone === droneId);
    },
    
    getMissionsByStatus: (status) => {
      const missions = Object.values(get().missions);
      return missions.filter(mission => mission.status === status);
    },
    
    clearMissions: () => set({
      missions: {},
      activeMissions: [],
      selectedMissionId: null,
      missionStats: null,
      lastUpdate: null
    })
  }))
);

// WebSocket connection management
const connectWebSocket = () => {
  if (wsConnection?.readyState === WebSocket.OPEN) {
    return;
  }

  try {
    wsConnection = new WebSocket(WS_URL);
    
    wsConnection.onopen = () => {
      console.log('Mission WebSocket connected');
      useMissionStore.getState().setWsConnected(true);
      useMissionStore.getState().setWsError(null);
      reconnectAttempts = 0;

      // Subscribe to mission updates
      wsConnection?.send(JSON.stringify({
        type: 'subscribe_missions',
        requestId: `sub-${Date.now()}`
      }));
    };

    wsConnection.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        const { type, data } = message;

        // Handle specific mission events
        if (type.startsWith('mission_') || type.startsWith('waypoint_')) {
          useMissionStore.getState().handleMissionEvent(type, data);
        }

        // Handle other message types
        switch (type) {
          case 'mission_stats':
            useMissionStore.getState().setMissionStats(data);
            break;
          
          case 'active_missions':
            useMissionStore.getState().setActiveMissions(data);
            break;
            
          default:
            // Log other message types for debugging
            console.log('Mission WebSocket message:', type, data);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    wsConnection.onclose = (event) => {
      console.log('Mission WebSocket disconnected:', event.code, event.reason);
      useMissionStore.getState().setWsConnected(false);
      
      // Attempt to reconnect
      if (reconnectAttempts < maxReconnectAttempts) {
        reconnectAttempts++;
        setTimeout(connectWebSocket, 2000 * reconnectAttempts);
      }
    };

    wsConnection.onerror = (error) => {
      console.error('Mission WebSocket error:', error);
      useMissionStore.getState().setWsError('WebSocket connection error');
    };

  } catch (error) {
    console.error('Failed to create WebSocket connection:', error);
    useMissionStore.getState().setWsError('Failed to connect to mission service');
  }
};

// Initialize WebSocket connection
export const initializeMissionWebSocket = () => {
  connectWebSocket();
};

// Hook to get selected mission
export const useSelectedMission = () => {
  const { selectedMissionId, missions } = useMissionStore();
  return selectedMissionId ? missions[selectedMissionId] : null;
};

// Hook to get missions for a specific drone
export const useDroneMissions = (droneId: string) => {
  return useMissionStore((state) => state.getMissionsByDrone(droneId));
};

// Hook to get missions by status
export const useMissionsByStatus = (status: MissionData['status']) => {
  return useMissionStore((state) => state.getMissionsByStatus(status));
};

// Hook for WebSocket connection status
export const useMissionWebSocketStatus = () => {
  return useMissionStore((state) => ({
    connected: state.wsConnected,
    error: state.wsError,
    lastUpdate: state.lastUpdate
  }));
};

export default useMissionStore;