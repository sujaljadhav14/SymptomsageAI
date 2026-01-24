
export interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
}

export interface ClinicalReport {
  summary: string;
  precautions: string[];
  severity: 'low' | 'medium' | 'high' | 'emergency';
  recommendedTests: string[];
  differentiation: string;
}

export enum ConnectionStatus {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  ERROR = 'ERROR'
}
