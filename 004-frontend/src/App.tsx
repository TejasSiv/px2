import { useEffect, useState } from 'react';
import './App.css';
import FleetMap from '@/components/fleet/FleetMap';
import FleetStatus from '@/components/fleet/FleetStatus';
import TelemetryPanel from '@/components/telemetry/TelemetryPanel';
import ConnectionStatusIndicator from '@/components/common/ConnectionStatusIndicator';
import SafetyPanel from '@/components/safety/SafetyPanel';
import { MissionControls } from '@/components/mission';
import { useFleetStore, useConnectionStatus, useSelectedDrone, initializeFleetStore } from '@/store/fleet';
import { initializeMissionWebSocket } from '@/store/mission';
import { ChevronLeftIcon, ChevronRightIcon, RocketLaunchIcon } from '@heroicons/react/24/outline';

function App() {
  const { state: connectionState, isConnected, error: connectionError } = useConnectionStatus();
  const drones = useFleetStore((state) => Object.values(state.drones));
  const selectedDroneId = useFleetStore((state) => state.selectedDroneId);
  const selectedDrone = useSelectedDrone();
  const selectDrone = useFleetStore((state) => state.selectDrone);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showMissionCenter, setShowMissionCenter] = useState(false);

  // Initialize the fleet store and WebSocket connections
  useEffect(() => {
    initializeFleetStore();
    initializeMissionWebSocket();
  }, []);

  const handleDroneSelect = (droneId: string) => {
    selectDrone(droneId);
  };

  const handleDroneAction = (droneId: string, action: string) => {
    console.log(`Action "${action}" requested for drone ${droneId}`);
    // TODO: Implement drone actions (start mission, return home, etc.)
  };

  return (
    <div className="min-h-screen bg-dark-primary text-text-primary flex">
      {/* Left Sidebar - FleetStatus */}
      <div className={`
        transition-all duration-300 ease-in-out bg-dark-secondary border-r border-dark-border
        ${sidebarCollapsed ? 'w-16' : 'w-80'}
        flex flex-col h-screen
      `}>
        {/* Sidebar Header */}
        <div className="p-4 border-b border-dark-border flex items-center justify-between">
          {!sidebarCollapsed && (
            <div>
              <h2 className="text-lg font-semibold text-text-primary">Fleet Control</h2>
              <p className="text-text-secondary text-xs">5 drones active</p>
            </div>
          )}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-2 hover:bg-dark-hover rounded-lg transition-colors"
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? (
              <ChevronRightIcon className="w-5 h-5 text-text-secondary" />
            ) : (
              <ChevronLeftIcon className="w-5 h-5 text-text-secondary" />
            )}
          </button>
        </div>

        {/* FleetStatus Content */}
        <div className="flex-1 overflow-hidden">
          {!sidebarCollapsed && (
            <FleetStatus
              drones={drones}
              selectedDroneId={selectedDroneId || undefined}
              onDroneSelect={handleDroneSelect}
              onDroneAction={handleDroneAction}
              className="h-full"
            />
          )}
          
          {sidebarCollapsed && (
            <div className="p-2 space-y-2">
              {drones.slice(0, 8).map((drone) => (
                <button
                  key={drone.id}
                  onClick={() => handleDroneSelect(drone.id)}
                  className={`
                    w-full p-2 rounded-lg border transition-all duration-200
                    ${drone.id === selectedDroneId 
                      ? 'border-status-active bg-status-active/10' 
                      : 'border-dark-border hover:border-dark-hover hover:bg-dark-hover'
                    }
                  `}
                  title={`${drone.name} - ${drone.status}`}
                >
                  <div 
                    className="w-8 h-8 mx-auto rounded-full border flex items-center justify-center"
                    style={{ 
                      backgroundColor: drone.status === 'active' || drone.status === 'in_flight' ? '#238636' : 
                                       drone.status === 'charging' ? '#d29922' : 
                                       drone.status === 'maintenance' ? '#da3633' : '#8b949e',
                      borderColor: drone.status === 'active' || drone.status === 'in_flight' ? '#238636' : 
                                   drone.status === 'charging' ? '#d29922' : 
                                   drone.status === 'maintenance' ? '#da3633' : '#8b949e'
                    }}
                  >
                    <span className="text-xs font-bold text-white">
                      {drone.name.split('-')[1] || drone.name.charAt(0)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen">
        {/* Header */}
        <header className="bg-dark-secondary border-b border-dark-border px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">Multi-Drone Fleet Management System</h1>
              <p className="text-text-secondary text-sm">
                Real-time fleet monitoring and control dashboard
              </p>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowMissionCenter(true)}
                className="flex items-center gap-2 px-4 py-2 bg-status-active hover:bg-status-active/80 
                         text-white rounded-lg font-medium transition-colors"
              >
                <RocketLaunchIcon className="w-5 h-5" />
                Mission Center
              </button>
              
              <ConnectionStatusIndicator 
                connectionState={connectionState}
                isConnected={isConnected}
                error={connectionError || undefined}
              />
            </div>
          </div>
        </header>

        {/* Main Dashboard */}
        <main className="flex-1 p-4 overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full">
            {/* Fleet Map Container */}
            <div className="lg:col-span-2 h-full overflow-hidden">
              <FleetMap
                drones={drones}
                selectedDroneId={selectedDroneId || undefined}
                onDroneSelect={handleDroneSelect}
                className="h-full w-full"
              />
            </div>
            
            {/* Right Panel - Split between Telemetry, Safety, and Missions */}
            <div className="lg:col-span-1 h-full overflow-hidden flex flex-col gap-4">
              {/* Telemetry Panel - Top Third */}
              <div className="flex-1 border border-dark-border rounded-lg bg-dark-secondary overflow-hidden">
                <TelemetryPanel
                  drone={selectedDrone}
                  isLive={isConnected}
                  className="h-full w-full"
                />
              </div>
              
              {/* Safety Panel - Middle Third */}
              <div className="flex-1">
                <SafetyPanel className="h-full" />
              </div>
              
              {/* Mission Controls - Bottom Third */}
              <div className="flex-1">
                <MissionControls />
              </div>
            </div>
          </div>
        </main>
      </div>
      
      {/* Mission Center Modal */}
      {showMissionCenter && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4"
             onClick={(e) => {
               // Close modal when clicking backdrop
               if (e.target === e.currentTarget) {
                 setShowMissionCenter(false);
               }
             }}>
          <div className="bg-dark-secondary rounded-lg border border-dark-border shadow-2xl
                         w-full max-w-7xl max-h-[95vh] overflow-hidden relative z-[10000]"
               onClick={(e) => e.stopPropagation()}>
            <MissionControls 
              className="h-full" 
              onClose={() => setShowMissionCenter(false)} 
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;