import { DroneData, MissionData, FleetAlert } from '@/types/fleet';

// WebSocket connection states
export enum ConnectionState {
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  RECONNECTING = 'reconnecting',
  ERROR = 'error'
}

// Message types from telemetry service
export interface TelemetryMessage {
  type: 'drone_update' | 'mission_update' | 'fleet_alert' | 'heartbeat';
  timestamp: string;
  data: any;
}

export interface DroneUpdateMessage extends TelemetryMessage {
  type: 'drone_update';
  data: DroneData;
}

export interface MissionUpdateMessage extends TelemetryMessage {
  type: 'mission_update';
  data: MissionData;
}

export interface FleetAlertMessage extends TelemetryMessage {
  type: 'fleet_alert';
  data: FleetAlert;
}

export interface HeartbeatMessage extends TelemetryMessage {
  type: 'heartbeat';
  data: { server_time: string; connected_clients: number };
}

// Connection configuration
interface WebSocketConfig {
  url: string;
  reconnectInterval: number;
  maxReconnectAttempts: number;
  heartbeatInterval: number;
  connectionTimeout: number;
}

// Default configuration
const DEFAULT_CONFIG: WebSocketConfig = {
  url: 'ws://localhost:3001/telemetry',
  reconnectInterval: 3000, // 3 seconds
  maxReconnectAttempts: 10,
  heartbeatInterval: 30000, // 30 seconds
  connectionTimeout: 10000, // 10 seconds
};

// Event callback types
type ConnectionStateCallback = (state: ConnectionState, error?: Error) => void;
type MessageCallback = (message: TelemetryMessage) => void;
type DroneUpdateCallback = (drone: DroneData) => void;
type MissionUpdateCallback = (mission: MissionData) => void;
type FleetAlertCallback = (alert: FleetAlert) => void;

export class TelemetryWebSocketService {
  private ws: WebSocket | null = null;
  private config: WebSocketConfig;
  private connectionState: ConnectionState = ConnectionState.DISCONNECTED;
  private reconnectAttempts = 0;
  private reconnectTimer: number | null = null;
  private heartbeatTimer: number | null = null;
  private connectionTimer: number | null = null;

  // Event callbacks
  private onConnectionStateChange: ConnectionStateCallback | null = null;
  private onMessage: MessageCallback | null = null;
  private onDroneUpdate: DroneUpdateCallback | null = null;
  private onMissionUpdate: MissionUpdateCallback | null = null;
  private onFleetAlert: FleetAlertCallback | null = null;

  // Statistics
  private stats = {
    messagesReceived: 0,
    messagesProcessed: 0,
    lastMessageTime: null as Date | null,
    connectionUptime: null as Date | null,
    reconnectCount: 0
  };

  constructor(config?: Partial<WebSocketConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // Public API
  connect(): void {
    if (this.connectionState === ConnectionState.CONNECTED || 
        this.connectionState === ConnectionState.CONNECTING) {
      console.warn('WebSocket already connected or connecting');
      return;
    }

    this.setConnectionState(ConnectionState.CONNECTING);
    this.clearTimers();

    try {
      this.ws = new WebSocket(this.config.url);
      this.setupEventHandlers();
      this.startConnectionTimeout();
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      this.setConnectionState(ConnectionState.ERROR, error as Error);
      this.scheduleReconnect();
    }
  }

  disconnect(): void {
    console.log('Disconnecting from telemetry service...');
    this.clearTimers();
    
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    
    this.setConnectionState(ConnectionState.DISCONNECTED);
    this.reconnectAttempts = 0;
  }

  // Event listeners
  setConnectionStateCallback(callback: ConnectionStateCallback): void {
    this.onConnectionStateChange = callback;
  }

  onTelemetryMessage(callback: MessageCallback): void {
    this.onMessage = callback;
  }

  onDroneDataUpdate(callback: DroneUpdateCallback): void {
    this.onDroneUpdate = callback;
  }

  onMissionDataUpdate(callback: MissionUpdateCallback): void {
    this.onMissionUpdate = callback;
  }

  onFleetAlertReceived(callback: FleetAlertCallback): void {
    this.onFleetAlert = callback;
  }

  // Getters
  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  getStatistics() {
    return {
      ...this.stats,
      connectionState: this.connectionState,
      reconnectAttempts: this.reconnectAttempts,
      uptime: this.stats.connectionUptime 
        ? Date.now() - this.stats.connectionUptime.getTime()
        : 0
    };
  }

  isConnected(): boolean {
    return this.connectionState === ConnectionState.CONNECTED;
  }

  // Private methods
  private setupEventHandlers(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      console.log('Connected to telemetry service');
      this.clearConnectionTimeout();
      this.setConnectionState(ConnectionState.CONNECTED);
      this.reconnectAttempts = 0;
      this.stats.connectionUptime = new Date();
      this.stats.reconnectCount++;
      this.startHeartbeat();
    };

    this.ws.onmessage = (event) => {
      try {
        const message: TelemetryMessage = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (error) {
        console.error('Failed to parse telemetry message:', error, event.data);
      }
    };

    this.ws.onclose = (event) => {
      console.log('WebSocket connection closed:', event.code, event.reason);
      this.clearTimers();
      
      if (event.code !== 1000) { // Not a normal closure
        this.setConnectionState(ConnectionState.DISCONNECTED);
        this.scheduleReconnect();
      } else {
        this.setConnectionState(ConnectionState.DISCONNECTED);
      }
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.setConnectionState(ConnectionState.ERROR, new Error('WebSocket connection error'));
    };
  }

  private handleMessage(message: TelemetryMessage): void {
    this.stats.messagesReceived++;
    this.stats.lastMessageTime = new Date();

    // Call general message callback
    if (this.onMessage) {
      this.onMessage(message);
    }

    // Handle specific message types
    try {
      switch (message.type) {
        case 'drone_update':
          const droneMessage = message as DroneUpdateMessage;
          if (this.onDroneUpdate) {
            this.onDroneUpdate(droneMessage.data);
          }
          break;

        case 'mission_update':
          const missionMessage = message as MissionUpdateMessage;
          if (this.onMissionUpdate) {
            this.onMissionUpdate(missionMessage.data);
          }
          break;

        case 'fleet_alert':
          const alertMessage = message as FleetAlertMessage;
          if (this.onFleetAlert) {
            this.onFleetAlert(alertMessage.data);
          }
          break;

        case 'heartbeat':
          // Just log heartbeat for debugging
          console.debug('Heartbeat received from server');
          break;

        default:
          console.warn('Unknown message type:', message.type);
      }

      this.stats.messagesProcessed++;
    } catch (error) {
      console.error('Failed to process telemetry message:', error, message);
    }
  }

  private setConnectionState(state: ConnectionState, error?: Error): void {
    if (this.connectionState !== state) {
      this.connectionState = state;
      console.log(`WebSocket state changed to: ${state}`);
      
      if (this.onConnectionStateChange) {
        this.onConnectionStateChange(state, error);
      }
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      console.error('Max reconnect attempts reached');
      this.setConnectionState(ConnectionState.ERROR, new Error('Max reconnect attempts exceeded'));
      return;
    }

    this.reconnectAttempts++;
    this.setConnectionState(ConnectionState.RECONNECTING);
    
    console.log(`Attempting to reconnect in ${this.config.reconnectInterval}ms (attempt ${this.reconnectAttempts}/${this.config.maxReconnectAttempts})`);
    
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, this.config.reconnectInterval);
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        // Send ping to server
        try {
          this.ws.send(JSON.stringify({ type: 'ping', timestamp: new Date().toISOString() }));
        } catch (error) {
          console.error('Failed to send heartbeat:', error);
        }
      }
    }, this.config.heartbeatInterval);
  }

  private startConnectionTimeout(): void {
    this.connectionTimer = setTimeout(() => {
      if (this.connectionState === ConnectionState.CONNECTING) {
        console.error('Connection timeout');
        this.setConnectionState(ConnectionState.ERROR, new Error('Connection timeout'));
        this.ws?.close();
        this.scheduleReconnect();
      }
    }, this.config.connectionTimeout);
  }

  private clearConnectionTimeout(): void {
    if (this.connectionTimer) {
      clearTimeout(this.connectionTimer);
      this.connectionTimer = null;
    }
  }

  private clearTimers(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    
    this.clearConnectionTimeout();
  }
}

// Singleton instance
export const telemetryService = new TelemetryWebSocketService();