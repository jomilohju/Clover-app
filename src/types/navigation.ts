export interface GeoLocation {
  lat: number;
  lng: number;
  heading?: number | null;
  speed?: number | null; // in meters per second
  accuracy?: number;
}

export interface StepManeuver {
  type: string;
  modifier?: string;
  location: [number, number]; // [lon, lat]
  instruction?: string;
  exit?: number;
}

export interface RouteStep {
  distance: number; // in meters
  duration: number; // in seconds
  name: string;
  ref?: string;
  maneuver: StepManeuver;
  geometry?: [number, number][]; // [lat, lng] array
}

export interface RouteData {
  distance: number; // total meters
  duration: number; // total seconds
  coordinates: [number, number][]; // [lat, lng]
  steps: RouteStep[];
  destinationName: string;
  destinationCoords: [number, number]; // [lat, lng]
}

export interface NavigationStatus {
  isActive: boolean;
  currentStepIndex: number;
  distanceToNextTurn: number; // in meters
  nextStep: RouteStep | null;
  upcomingStep: RouteStep | null;
  remainingDistance: number; // in meters
  remainingDuration: number; // in seconds
  eta: Date | null;
  isOffRoute: boolean;
  isRerouting: boolean;
  hasArrived: boolean;
  currentSpeedKmh: number;
}

export interface SearchResultItem {
  id: string;
  name: string;
  subtitle: string;
  lat: number;
  lng: number;
  distanceKm?: number;
}
