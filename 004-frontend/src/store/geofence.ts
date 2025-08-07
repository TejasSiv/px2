import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { GeofenceData, GeofenceViolation } from '@/types/fleet';

interface GeofenceState {
  // Geofence data
  geofences: GeofenceData[];
  selectedGeofenceId: string | null;
  violations: GeofenceViolation[];
  
  // UI state
  showGeofences: boolean;
  editingGeofence: GeofenceData | null;
  isCreatingGeofence: boolean;
  
  // Loading states
  loading: boolean;
  loadingViolations: boolean;
  error: string | null;
  
  // Actions
  setGeofences: (geofences: GeofenceData[]) => void;
  addGeofence: (geofence: GeofenceData) => void;
  updateGeofence: (id: string, updates: Partial<GeofenceData>) => void;
  removeGeofence: (id: string) => void;
  selectGeofence: (id: string | null) => void;
  
  setViolations: (violations: GeofenceViolation[]) => void;
  addViolation: (violation: GeofenceViolation) => void;
  
  setShowGeofences: (show: boolean) => void;
  setEditingGeofence: (geofence: GeofenceData | null) => void;
  setIsCreatingGeofence: (creating: boolean) => void;
  
  setLoading: (loading: boolean) => void;
  setLoadingViolations: (loading: boolean) => void;
  setError: (error: string | null) => void;
  
  // API actions
  fetchGeofences: () => Promise<void>;
  fetchViolations: (droneId?: string) => Promise<void>;
  createGeofence: (geofenceData: Omit<GeofenceData, 'id' | 'createdAt' | 'updatedAt'>) => Promise<GeofenceData | null>;
  updateGeofenceData: (id: string, updates: Partial<GeofenceData>) => Promise<GeofenceData | null>;
  deleteGeofence: (id: string) => Promise<boolean>;
  
  // Utility functions
  getActiveGeofences: () => GeofenceData[];
  getGeofenceById: (id: string) => GeofenceData | undefined;
  getViolationsByDrone: (droneId: string) => GeofenceViolation[];
  getRecentViolations: (hours?: number) => GeofenceViolation[];
}

const useGeofenceStore = create<GeofenceState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    geofences: [],
    selectedGeofenceId: null,
    violations: [],
    
    showGeofences: true,
    editingGeofence: null,
    isCreatingGeofence: false,
    
    loading: false,
    loadingViolations: false,
    error: null,
    
    // Basic setters
    setGeofences: (geofences) => set({ geofences }),
    addGeofence: (geofence) => set(state => ({ 
      geofences: [...state.geofences, geofence] 
    })),
    updateGeofence: (id, updates) => set(state => ({
      geofences: state.geofences.map(g => 
        g.id === id ? { ...g, ...updates } : g
      )
    })),
    removeGeofence: (id) => set(state => ({
      geofences: state.geofences.filter(g => g.id !== id),
      selectedGeofenceId: state.selectedGeofenceId === id ? null : state.selectedGeofenceId
    })),
    selectGeofence: (id) => set({ selectedGeofenceId: id }),
    
    setViolations: (violations) => set({ violations }),
    addViolation: (violation) => set(state => ({
      violations: [violation, ...state.violations]
    })),
    
    setShowGeofences: (show) => set({ showGeofences: show }),
    setEditingGeofence: (geofence) => set({ editingGeofence: geofence }),
    setIsCreatingGeofence: (creating) => set({ isCreatingGeofence: creating }),
    
    setLoading: (loading) => set({ loading }),
    setLoadingViolations: (loading) => set({ loadingViolations: loading }),
    setError: (error) => set({ error }),
    
    // API actions
    fetchGeofences: async () => {
      set({ loading: true, error: null });
      try {
        const response = await fetch('/api/v1/safety/geofence');
        if (!response.ok) throw new Error('Failed to fetch geofences');
        
        const data = await response.json();
        if (data.status === 'success') {
          set({ geofences: data.data.geofences });
        } else {
          throw new Error(data.message || 'Unknown error');
        }
      } catch (error) {
        console.error('Error fetching geofences:', error);
        set({ error: error instanceof Error ? error.message : 'Failed to fetch geofences' });
      } finally {
        set({ loading: false });
      }
    },
    
    fetchViolations: async (droneId) => {
      set({ loadingViolations: true, error: null });
      try {
        const url = droneId 
          ? `/api/v1/safety/geofence/violations/all?drone_id=${droneId}`
          : '/api/v1/safety/geofence/violations/all';
          
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch violations');
        
        const data = await response.json();
        if (data.status === 'success') {
          set({ violations: data.data.violations });
        } else {
          throw new Error(data.message || 'Unknown error');
        }
      } catch (error) {
        console.error('Error fetching violations:', error);
        set({ error: error instanceof Error ? error.message : 'Failed to fetch violations' });
      } finally {
        set({ loadingViolations: false });
      }
    },
    
    createGeofence: async (geofenceData) => {
      set({ loading: true, error: null });
      try {
        const response = await fetch('/api/v1/safety/geofence', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(geofenceData),
        });
        
        if (!response.ok) throw new Error('Failed to create geofence');
        
        const data = await response.json();
        if (data.status === 'success') {
          const newGeofence = data.data.geofence;
          set(state => ({ 
            geofences: [...state.geofences, newGeofence],
            isCreatingGeofence: false
          }));
          return newGeofence;
        } else {
          throw new Error(data.message || 'Unknown error');
        }
      } catch (error) {
        console.error('Error creating geofence:', error);
        set({ error: error instanceof Error ? error.message : 'Failed to create geofence' });
        return null;
      } finally {
        set({ loading: false });
      }
    },
    
    updateGeofenceData: async (id, updates) => {
      set({ loading: true, error: null });
      try {
        const response = await fetch(`/api/v1/safety/geofence/${id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updates),
        });
        
        if (!response.ok) throw new Error('Failed to update geofence');
        
        const data = await response.json();
        if (data.status === 'success') {
          const updatedGeofence = data.data.geofence;
          set(state => ({
            geofences: state.geofences.map(g => 
              g.id === id ? updatedGeofence : g
            ),
            editingGeofence: null
          }));
          return updatedGeofence;
        } else {
          throw new Error(data.message || 'Unknown error');
        }
      } catch (error) {
        console.error('Error updating geofence:', error);
        set({ error: error instanceof Error ? error.message : 'Failed to update geofence' });
        return null;
      } finally {
        set({ loading: false });
      }
    },
    
    deleteGeofence: async (id) => {
      set({ loading: true, error: null });
      try {
        const response = await fetch(`/api/v1/safety/geofence/${id}`, {
          method: 'DELETE',
        });
        
        if (!response.ok) throw new Error('Failed to delete geofence');
        
        const data = await response.json();
        if (data.status === 'success') {
          set(state => ({
            geofences: state.geofences.filter(g => g.id !== id),
            selectedGeofenceId: state.selectedGeofenceId === id ? null : state.selectedGeofenceId,
            editingGeofence: state.editingGeofence?.id === id ? null : state.editingGeofence
          }));
          return true;
        } else {
          throw new Error(data.message || 'Unknown error');
        }
      } catch (error) {
        console.error('Error deleting geofence:', error);
        set({ error: error instanceof Error ? error.message : 'Failed to delete geofence' });
        return false;
      } finally {
        set({ loading: false });
      }
    },
    
    // Utility functions
    getActiveGeofences: () => {
      const { geofences } = get();
      return geofences.filter(g => g.active);
    },
    
    getGeofenceById: (id) => {
      const { geofences } = get();
      return geofences.find(g => g.id === id);
    },
    
    getViolationsByDrone: (droneId) => {
      const { violations } = get();
      return violations.filter(v => v.droneId === droneId);
    },
    
    getRecentViolations: (hours = 24) => {
      const { violations } = get();
      const cutoff = Date.now() - (hours * 60 * 60 * 1000);
      return violations.filter(v => new Date(v.timestamp).getTime() > cutoff);
    },
  }))
);

// Subscribe to geofence changes for logging/debugging
useGeofenceStore.subscribe(
  (state) => state.geofences,
  (geofences) => {
    console.debug(`Geofence store updated: ${geofences.length} geofences`);
  }
);

// Subscribe to violations for real-time alerts
useGeofenceStore.subscribe(
  (state) => state.violations,
  (violations, previousViolations) => {
    // Check for new violations
    const newViolations = violations.filter(v => 
      !previousViolations?.some(pv => pv.id === v.id)
    );
    
    if (newViolations.length > 0) {
      console.warn(`New geofence violations detected:`, newViolations);
      // Could trigger notifications here
    }
  }
);

export default useGeofenceStore;

// Convenience hooks for specific data
export const useSelectedGeofence = () => {
  return useGeofenceStore(state => {
    const selected = state.selectedGeofenceId;
    return selected ? state.getGeofenceById(selected) : null;
  });
};

export const useActiveGeofences = () => {
  return useGeofenceStore(state => state.getActiveGeofences());
};

export const useRecentViolations = (hours = 24) => {
  return useGeofenceStore(state => state.getRecentViolations(hours));
};