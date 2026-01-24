
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

export enum NotificationType {
  HEALTH_TIP = 'health_tip',
  FOLLOW_UP = 'follow_up',
  REMINDER = 'reminder',
  INSIGHT = 'insight'
}

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: Date;
  isRead: boolean;
}
