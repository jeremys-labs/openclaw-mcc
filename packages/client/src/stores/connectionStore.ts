import { create } from 'zustand';

interface ConnectionState {
  gatewayStatus: 'connected' | 'disconnected' | 'reconnecting';
  setGatewayStatus: (status: ConnectionState['gatewayStatus']) => void;
}

export const useConnectionStore = create<ConnectionState>((set) => ({
  gatewayStatus: 'connected',
  setGatewayStatus: (status) => set({ gatewayStatus: status }),
}));
