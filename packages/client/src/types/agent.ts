export interface AgentColor {
  from: string;
  to: string;
}

export interface AgentTab {
  id: string;
  label: string;
  icon: string;
  source: string;
  renderer?: 'default' | 'chart' | 'markdown' | 'table';
}

export interface AgentPosition {
  zone: string;
  x: number;
  y: number;
}

export interface AgentConfig {
  name: string;
  fullName?: string;
  role: string;
  emoji: string;
  sprite?: string;
  color: AgentColor;
  channel: string;
  greeting: string;
  quote?: string;
  voice?: string;
  model?: string;
  position: AgentPosition;
  tabs: AgentTab[];
}
