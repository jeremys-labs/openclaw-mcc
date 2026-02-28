import { create } from 'zustand';

type View = 'office' | 'channels' | 'files';

interface UIState {
  activeView: View;
  activeAgent: string | null;
  panelOpen: boolean;
  setView: (view: View) => void;
  openAgentPanel: (agentKey: string) => void;
  closePanel: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  activeView: 'office',
  activeAgent: null,
  panelOpen: false,
  setView: (view) => set({ activeView: view }),
  openAgentPanel: (agentKey) => set({ activeAgent: agentKey, panelOpen: true }),
  closePanel: () => set({ panelOpen: false }),
}));
