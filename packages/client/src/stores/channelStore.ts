import { create } from 'zustand';

interface ChannelMessage {
  from: string;
  to: string;
  content: string;
  timestamp: number;
}

interface ChannelState {
  interactions: ChannelMessage[];
  loading: boolean;
  fetch: () => Promise<void>;
}

export const useChannelStore = create<ChannelState>((set) => ({
  interactions: [],
  loading: true,
  fetch: async () => {
    try {
      const res = await fetch('/api/channels');
      const data = await res.json();
      set({ interactions: data.interactions || [], loading: false });
    } catch {
      set({ loading: false });
    }
  },
}));
