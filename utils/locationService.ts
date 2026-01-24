/**
 * Location Service
 * 
 * Handles browser geolocation and location persistence.
 */

import { UserLocation } from '../types';

const LOCATION_STORAGE_KEY = 'symptomsage_user_location';

/**
 * Request user's current location via browser Geolocation API
 */
export async function requestUserLocation(): Promise<UserLocation> {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Geolocation is not supported by this browser'));
            return;
        }

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const location: UserLocation = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    timestamp: new Date(),
                };

                // Try to get address via reverse geocoding
                try {
                    const addressData = await reverseGeocode(location.latitude, location.longitude);
                    location.address = addressData.address;
                    location.city = addressData.city;
                    location.state = addressData.state;
                    location.country = addressData.country;
                } catch (e) {
                    console.warn('Reverse geocoding failed:', e);
                }

                // Save to localStorage
                saveUserLocation(location);
                resolve(location);
            },
            (error) => {
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        reject(new Error('Location permission denied'));
                        break;
                    case error.POSITION_UNAVAILABLE:
                        reject(new Error('Location information unavailable'));
                        break;
                    case error.TIMEOUT:
                        reject(new Error('Location request timed out'));
                        break;
                    default:
                        reject(new Error('Unknown location error'));
                }
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 300000, // 5 minutes cache
            }
        );
    });
}

/**
 * Reverse geocode coordinates to get address
 */
async function reverseGeocode(latitude: number, longitude: number): Promise<{
    address: string;
    city?: string;
    state?: string;
    country?: string;
}> {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
        throw new Error('Google Maps API key not configured');
    }

    const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${apiKey}`
    );

    const data = await response.json();

    if (data.status !== 'OK' || !data.results?.[0]) {
        throw new Error('Geocoding failed');
    }

    const result = data.results[0];
    const components = result.address_components || [];

    let city = '';
    let state = '';
    let country = '';

    for (const component of components) {
        if (component.types.includes('locality')) {
            city = component.long_name;
        }
        if (component.types.includes('administrative_area_level_1')) {
            state = component.long_name;
        }
        if (component.types.includes('country')) {
            country = component.long_name;
        }
    }

    return {
        address: result.formatted_address,
        city,
        state,
        country,
    };
}

/**
 * Save user location to localStorage
 */
export function saveUserLocation(location: UserLocation): void {
    try {
        localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(location));
    } catch (e) {
        console.error('Failed to save location:', e);
    }
}

/**
 * Get saved user location from localStorage
 */
export function getSavedLocation(): UserLocation | null {
    try {
        const stored = localStorage.getItem(LOCATION_STORAGE_KEY);
        if (!stored) return null;

        const location = JSON.parse(stored) as UserLocation;
        location.timestamp = new Date(location.timestamp);

        // Check if location is older than 24 hours
        const ageMs = Date.now() - location.timestamp.getTime();
        const maxAgeMs = 24 * 60 * 60 * 1000; // 24 hours

        if (ageMs > maxAgeMs) {
            clearSavedLocation();
            return null;
        }

        return location;
    } catch (e) {
        console.error('Failed to get saved location:', e);
        return null;
    }
}

/**
 * Clear saved location
 */
export function clearSavedLocation(): void {
    localStorage.removeItem(LOCATION_STORAGE_KEY);
}

/**
 * Check if location permission has been granted
 */
export async function checkLocationPermission(): Promise<'granted' | 'denied' | 'prompt'> {
    if (!navigator.permissions) {
        return 'prompt'; // Can't check, assume we need to ask
    }

    try {
        const result = await navigator.permissions.query({ name: 'geolocation' });
        return result.state;
    } catch (e) {
        return 'prompt';
    }
}
