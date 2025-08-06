import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import { motion } from 'framer-motion';
import { DroneData, MissionData } from '@/types/fleet';
import DroneMarker from './DroneMarker';
import MissionPath from './MissionPath';
import 'leaflet/dist/leaflet.css';
import './FleetMap.css';

interface FleetMapProps {
  drones: DroneData[];
  missions?: MissionData[];
  selectedDroneId?: string;
  onDroneSelect: (droneId: string) => void;
  className?: string;
}

// Component to handle map resizing
const MapResizer: React.FC = () => {
  const map = useMap();
  
  useEffect(() => {
    // Force map to resize when component mounts
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 100);
    
    return () => clearTimeout(timer);
  }, [map]);

  return null;
};

const FleetMap: React.FC<FleetMapProps> = ({
  drones,
  missions = [],
  selectedDroneId,
  onDroneSelect,
  className = ''
}) => {
  const [mapCenter, setMapCenter] = useState<[number, number]>([37.7749, -122.4194]); // San Francisco
  const [zoom, setZoom] = useState(12);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  // Calculate map center based on drone positions
  useEffect(() => {
    if (drones.length > 0) {
      const validDrones = drones.filter(drone => drone.position.lat && drone.position.lng);
      if (validDrones.length > 0) {
        const avgLat = validDrones.reduce((sum, drone) => sum + drone.position.lat, 0) / validDrones.length;
        const avgLng = validDrones.reduce((sum, drone) => sum + drone.position.lng, 0) / validDrones.length;
        setMapCenter([avgLat, avgLng]);
      }
    }
  }, [drones]);

  // Force map resize on container size changes
  useEffect(() => {
    const resizeObserver = new ResizeObserver(() => {
      // Trigger a small delay to allow CSS to settle
      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
      }, 100);
    });

    if (mapContainerRef.current) {
      resizeObserver.observe(mapContainerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  const getBatteryColor = (percentage: number): string => {
    if (percentage > 70) return '#238636'; // Green
    if (percentage > 30) return '#d29922'; // Amber
    if (percentage > 15) return '#da3633'; // Red
    return '#f85149'; // Critical red
  };

  const getStatusColor = (status: string): string => {
    switch (status.toLowerCase()) {
      case 'active':
      case 'in_flight':
        return '#238636'; // Green
      case 'charging':
      case 'returning':
        return '#d29922'; // Amber
      case 'maintenance':
      case 'emergency':
        return '#da3633'; // Red
      case 'idle':
      default:
        return '#8b949e'; // Secondary text
    }
  };

  return (
    <div 
      ref={mapContainerRef}
      className={`fleet-map-container relative h-full w-full bg-dark-primary rounded-lg overflow-hidden border border-dark-border ${className}`}
    >
      {/* Map Header */}
      <motion.div 
        className="absolute top-4 left-4 z-[1000] bg-dark-secondary/90 backdrop-blur-sm rounded-lg p-3 shadow-lg border border-dark-border"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h3 className="text-text-primary font-semibold mb-2">Fleet Overview</h3>
        <div className="flex gap-4 text-sm">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-status-operational"></div>
            <span className="text-text-secondary">
              {drones.filter(d => d.status === 'active' || d.status === 'in_flight').length} Active
            </span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-status-warning"></div>
            <span className="text-text-secondary">
              {drones.filter(d => d.status === 'charging' || d.status === 'idle').length} Standby
            </span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-status-critical"></div>
            <span className="text-text-secondary">
              {drones.filter(d => d.status === 'maintenance' || d.status === 'emergency').length} Issues
            </span>
          </div>
        </div>
      </motion.div>

      {/* Map Controls */}
      <motion.div 
        className="absolute top-4 right-4 z-[1000] bg-dark-secondary/90 backdrop-blur-sm rounded-lg p-2 shadow-lg border border-dark-border"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <div className="flex flex-col gap-2">
          <button
            className="px-3 py-1 text-xs bg-dark-tertiary hover:bg-dark-hover text-text-primary rounded border border-dark-border transition-colors"
            onClick={() => setZoom(Math.min(zoom + 1, 18))}
          >
            Zoom In
          </button>
          <button
            className="px-3 py-1 text-xs bg-dark-tertiary hover:bg-dark-hover text-text-primary rounded border border-dark-border transition-colors"
            onClick={() => setZoom(Math.max(zoom - 1, 1))}
          >
            Zoom Out
          </button>
          <button
            className="px-3 py-1 text-xs bg-dark-tertiary hover:bg-dark-hover text-text-primary rounded border border-dark-border transition-colors"
            onClick={() => {
              if (drones.length > 0) {
                const validDrones = drones.filter(drone => drone.position.lat && drone.position.lng);
                if (validDrones.length > 0) {
                  const avgLat = validDrones.reduce((sum, drone) => sum + drone.position.lat, 0) / validDrones.length;
                  const avgLng = validDrones.reduce((sum, drone) => sum + drone.position.lng, 0) / validDrones.length;
                  setMapCenter([avgLat, avgLng]);
                  setZoom(12);
                }
              }
            }}
          >
            Center Fleet
          </button>
        </div>
      </motion.div>

      {/* Leaflet Map - Full Height */}
      <div className="absolute inset-0 w-full h-full">
        <MapContainer
          center={mapCenter}
          zoom={zoom}
          style={{ height: '100%', width: '100%', minHeight: '400px' }}
          zoomControl={false}
          attributionControl={false}
          className="leaflet-container bg-dark-primary"
        >
          {/* Map Resizer Component */}
          <MapResizer />
          
          {/* Dark mode tile layer */}
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          />

          {/* Mission paths */}
          {missions.map((mission) => (
            <MissionPath key={mission.id} mission={mission} />
          ))}

          {/* Drone markers */}
          {drones.map((drone) => (
            <DroneMarker
              key={drone.id}
              drone={drone}
              isSelected={drone.id === selectedDroneId}
              onSelect={() => onDroneSelect(drone.id)}
              getBatteryColor={getBatteryColor}
              getStatusColor={getStatusColor}
            />
          ))}
        </MapContainer>
      </div>

      {/* Legend */}
      <motion.div 
        className="absolute bottom-4 left-4 z-[1000] bg-dark-secondary/90 backdrop-blur-sm rounded-lg p-3 shadow-lg border border-dark-border"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
      >
        <h4 className="text-text-primary font-medium text-sm mb-2">Legend</h4>
        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-status-operational border border-dark-border"></div>
            <span className="text-text-secondary">Active Drone</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-status-warning border border-dark-border"></div>
            <span className="text-text-secondary">Standby/Charging</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-status-critical border border-dark-border"></div>
            <span className="text-text-secondary">Issue/Maintenance</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-0.5 bg-status-active"></div>
            <span className="text-text-secondary">Mission Path</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default FleetMap;