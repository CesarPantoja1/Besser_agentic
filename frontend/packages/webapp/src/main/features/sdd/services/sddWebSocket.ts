import { SDD_WS_URL } from '../constants/sdd-constants';
import type { SDDClientMessage, SDDServerMessage } from '../types/sdd-types';

export class SddWebSocketService {
  private socket: WebSocket | null = null;
  private listeners: Set<(message: SDDServerMessage) => void> = new Set();
  private statusListeners: Set<(connected: boolean) => void> = new Set();
  private reconnectTimeout: any = null;
  private sessionId: string | null = null;
  private isConnecting = false;

  connect(sessionId: string) {
    this.sessionId = sessionId;
    
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      if (this.isConnecting) return;
      this.disconnect();
    }

    this.isConnecting = true;
    const wsUrl = `${SDD_WS_URL}/ws/sdd/${sessionId}`;
    
    try {
      this.socket = new WebSocket(wsUrl);
      
      this.socket.onopen = () => {
        this.isConnecting = false;
        this.notifyStatus(true);
        if (this.reconnectTimeout) {
          clearTimeout(this.reconnectTimeout);
          this.reconnectTimeout = null;
        }
      };

      this.socket.onmessage = (event) => {
        try {
          const msg: SDDServerMessage = JSON.parse(event.data);
          this.notifyMessage(msg);
        } catch (e) {
          console.error('Error parsing SDD WebSocket message:', e);
        }
      };

      this.socket.onclose = () => {
        this.isConnecting = false;
        this.notifyStatus(false);
        this.scheduleReconnect();
      };

      this.socket.onerror = (err) => {
        console.error('SDD WebSocket error:', err);
        this.isConnecting = false;
        this.notifyStatus(false);
      };
    } catch (error) {
      console.error('Failed to initialize SDD WebSocket:', error);
      this.isConnecting = false;
      this.notifyStatus(false);
      this.scheduleReconnect();
    }
  }

  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    if (this.socket) {
      this.socket.onopen = null;
      this.socket.onmessage = null;
      this.socket.onclose = null;
      this.socket.onerror = null;
      this.socket.close();
      this.socket = null;
    }
    
    this.notifyStatus(false);
  }

  send(message: SDDClientMessage) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    } else {
      console.warn('Cannot send message. SDD WebSocket is not open.');
    }
  }

  onMessage(callback: (message: SDDServerMessage) => void): () => void {
    this.listeners.add(callback);
    return () => { this.listeners.delete(callback); };
  }

  onStatusChange(callback: (connected: boolean) => void): () => void {
    this.statusListeners.add(callback);
    // Fire immediately with current state
    callback(this.isConnected());
    return () => { this.statusListeners.delete(callback); };
  }

  isConnected(): boolean {
    return this.socket !== null && this.socket.readyState === WebSocket.OPEN;
  }

  private scheduleReconnect() {
    if (this.reconnectTimeout || !this.sessionId) return;
    
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      if (this.sessionId) {
        console.log('Attempting to reconnect SDD WebSocket...');
        this.connect(this.sessionId);
      }
    }, 5000); // Reconnect in 5 seconds
  }

  private notifyMessage(message: SDDServerMessage) {
    this.listeners.forEach((listener) => {
      try {
        listener(message);
      } catch (err) {
        console.error('Error in SDD message listener:', err);
      }
    });
  }

  private notifyStatus(connected: boolean) {
    this.statusListeners.forEach((listener) => {
      try {
        listener(connected);
      } catch (err) {
        console.error('Error in SDD status listener:', err);
      }
    });
  }
}

export const sddWebSocket = new SddWebSocketService();
export default sddWebSocket;
