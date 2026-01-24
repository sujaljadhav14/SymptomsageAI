
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

// ============================================
// OFFLINE HEALTH ASSESSMENT TYPES
// ============================================

// Data structure types (matching JSON files)
export interface SymptomData {
  conditions: string[];
  isKeySymptom: string[];
}

export interface ConditionData {
  name: string;
  riskLevel: 'low' | 'moderate' | 'high';
  description: string;
  commonSymptoms: string[];
  tests: string[];
  specialties: string[];
  prevalence: 'very_common' | 'common' | 'moderate' | 'rare' | 'regional';
}

export interface TestData {
  name: string;
  cost: 'low' | 'medium' | 'high';
  priority: 'screening' | 'diagnostic' | 'specialized';
  reason: string;
  turnaround: string;
}

export interface RedFlagData {
  symptoms: string[];
  emergencyMessage: string;
  keywords: Record<string, string[]>;
  instructions: string[];
}

// User input types
export interface AssessmentInput {
  symptoms: string[];
  duration: string;
  severity?: 'mild' | 'moderate' | 'severe';
  additionalNotes?: string;
}

// Scoring and matching types
export interface ConditionMatch {
  conditionId: string;
  name: string;
  score: number;
  matchedSymptoms: string[];
  riskLevel: 'low' | 'moderate' | 'high';
  description: string;
  confidence: 'possible' | 'likely' | 'very_likely';
}

export interface TestSuggestion {
  testId: string;
  name: string;
  cost: 'low' | 'medium' | 'high';
  priority: 'screening' | 'diagnostic' | 'specialized';
  reason: string;
  relevantConditions: string[];
}

// Final output type
export interface AssessmentResult {
  riskLevel: 'low' | 'moderate' | 'high' | 'emergency';
  isEmergency: boolean;
  possibleConditions: ConditionMatch[];
  reasoning: string[];
  testSuggestions: TestSuggestion[];
  nextSteps: string[];
  matchedSymptoms: string[];
  unmatchedSymptoms: string[];
  disclaimer: string;
  timestamp: Date;
}

// ============================================
// LOCATION & HEALTHCARE FACILITY TYPES
// ============================================

export interface UserLocation {
  latitude: number;
  longitude: number;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  timestamp: Date;
}

export type FacilityType = 'hospital' | 'clinic' | 'doctor' | 'lab' | 'pharmacy';
export type FacilityCategory = 'government' | 'private' | 'unknown';

export interface HealthcareFacility {
  id: string;
  name: string;
  type: FacilityType;
  category: FacilityCategory;
  address: string;
  distance: string;
  distanceMeters: number;
  rating?: number;
  totalRatings?: number;
  isOpen?: boolean;
  openingHours?: string[];
  phone?: string;
  priceLevel?: 1 | 2 | 3 | 4; // $ to $$$$
  photoUrl?: string;
  googleMapsUrl: string;
  relevantTests?: string[];   // For labs
  specialties?: string[];     // For doctors/clinics
  placeId: string;
}

export interface FacilitySearchResult {
  facilities: HealthcareFacility[];
  searchType: FacilityType;
  totalFound: number;
  searchRadius: number;
  userLocation: UserLocation;
}
