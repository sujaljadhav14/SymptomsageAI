/**
 * Google Places Service
 * 
 * Handles searching for nearby healthcare facilities using Google Places API.
 */

import { HealthcareFacility, FacilityType, FacilityCategory, UserLocation, FacilitySearchResult } from '../types';

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

// Place types to search for each facility type
const PLACE_TYPE_MAP: Record<FacilityType, string[]> = {
    hospital: ['hospital'],
    clinic: ['health', 'physiotherapist', 'doctor'],
    doctor: ['doctor'],
    lab: ['health'],
    pharmacy: ['pharmacy'],
};

// Keywords for more specific searches
const SEARCH_KEYWORDS: Record<FacilityType, string[]> = {
    hospital: ['hospital', 'medical center'],
    clinic: ['clinic', 'health center', 'medical clinic'],
    doctor: ['doctor', 'physician', 'specialist'],
    lab: ['diagnostic', 'pathology', 'lab', 'laboratory', 'test center'],
    pharmacy: ['pharmacy', 'medical store', 'chemist'],
};

// Keywords to identify government facilities
const GOVERNMENT_KEYWORDS = [
    'government', 'govt', 'gov', 'phc', 'primary health', 'district',
    'civil', 'esi', 'municipal', 'public', 'community health',
    'taluk', 'mandal', 'panchayat', 'state', 'central'
];

/**
 * Search for nearby healthcare facilities
 */
export async function searchNearbyFacilities(
    location: UserLocation,
    type: FacilityType,
    radiusMeters: number = 5000,
    specialty?: string
): Promise<FacilitySearchResult> {
    if (!API_KEY) {
        throw new Error('Google Maps API key not configured');
    }

    const placeTypes = PLACE_TYPE_MAP[type];
    const keywords = SEARCH_KEYWORDS[type];

    // Build search keyword
    let searchKeyword = keywords[0];
    if (specialty) {
        searchKeyword = `${specialty} ${searchKeyword}`;
    }

    // Use Text Search for better results
    const url = new URL('https://places.googleapis.com/v1/places:searchText');

    const requestBody = {
        textQuery: searchKeyword,
        locationBias: {
            circle: {
                center: {
                    latitude: location.latitude,
                    longitude: location.longitude,
                },
                radius: radiusMeters,
            },
        },
        maxResultCount: 20,
        languageCode: 'en',
    };

    const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': API_KEY,
            'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.currentOpeningHours,places.nationalPhoneNumber,places.priceLevel,places.photos,places.googleMapsUri,places.location',
        },
        body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
        const error = await response.json();
        console.error('Places API error:', error);
        throw new Error(`Places search failed: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const places = data.places || [];

    // Format and categorize results
    const facilities: HealthcareFacility[] = places.map((place: any) =>
        formatPlaceToFacility(place, type, location)
    );

    // Sort by distance
    facilities.sort((a, b) => a.distanceMeters - b.distanceMeters);

    return {
        facilities,
        searchType: type,
        totalFound: facilities.length,
        searchRadius: radiusMeters,
        userLocation: location,
    };
}

/**
 * Search for doctors by specialty
 */
export async function searchDoctors(
    location: UserLocation,
    specialties: string[],
    radiusMeters: number = 5000
): Promise<HealthcareFacility[]> {
    const allResults: HealthcareFacility[] = [];

    // Search for each specialty
    for (const specialty of specialties.slice(0, 3)) { // Limit to 3 specialties
        try {
            const result = await searchNearbyFacilities(location, 'doctor', radiusMeters, specialty);
            allResults.push(...result.facilities);
        } catch (e) {
            console.warn(`Failed to search for ${specialty}:`, e);
        }
    }

    // Also search for general doctors/clinics
    try {
        const generalResult = await searchNearbyFacilities(location, 'clinic', radiusMeters);
        allResults.push(...generalResult.facilities);
    } catch (e) {
        console.warn('Failed to search for clinics:', e);
    }

    // Deduplicate by place ID
    const uniqueFacilities = Array.from(
        new Map(allResults.map(f => [f.placeId, f])).values()
    );

    // Sort by distance
    uniqueFacilities.sort((a, b) => a.distanceMeters - b.distanceMeters);

    return uniqueFacilities.slice(0, 15); // Return top 15
}

/**
 * Search for labs that can perform specific tests
 */
export async function searchLabs(
    location: UserLocation,
    testTypes: string[],
    radiusMeters: number = 5000
): Promise<HealthcareFacility[]> {
    // Map test types to search terms
    const searchTerms: string[] = [];

    for (const test of testTypes) {
        if (test.toLowerCase().includes('xray') || test.toLowerCase().includes('mri') || test.toLowerCase().includes('ct')) {
            searchTerms.push('imaging center', 'radiology');
        } else if (test.toLowerCase().includes('blood') || test.toLowerCase().includes('cbc')) {
            searchTerms.push('pathology lab', 'blood test');
        } else {
            searchTerms.push('diagnostic center');
        }
    }

    // Deduplicate search terms
    const uniqueTerms = [...new Set(searchTerms)];

    const allResults: HealthcareFacility[] = [];

    for (const term of uniqueTerms.slice(0, 3)) {
        try {
            const result = await searchNearbyFacilities(location, 'lab', radiusMeters, term);
            allResults.push(...result.facilities);
        } catch (e) {
            console.warn(`Failed to search for ${term}:`, e);
        }
    }

    // Deduplicate by place ID
    const uniqueFacilities = Array.from(
        new Map(allResults.map(f => [f.placeId, f])).values()
    );

    // Sort by distance
    uniqueFacilities.sort((a, b) => a.distanceMeters - b.distanceMeters);

    return uniqueFacilities.slice(0, 15);
}

/**
 * Format Google Places result to our facility format
 */
function formatPlaceToFacility(
    place: any,
    type: FacilityType,
    userLocation: UserLocation
): HealthcareFacility {
    const name = place.displayName?.text || 'Unknown';
    const category = categorizeAsGovernmentOrPrivate(name, place.formattedAddress);

    // Calculate distance
    const distanceMeters = calculateDistance(
        userLocation.latitude,
        userLocation.longitude,
        place.location?.latitude || 0,
        place.location?.longitude || 0
    );

    // Format distance
    let distance = '';
    if (distanceMeters < 1000) {
        distance = `${Math.round(distanceMeters)} m`;
    } else {
        distance = `${(distanceMeters / 1000).toFixed(1)} km`;
    }

    // Get photo URL
    let photoUrl: string | undefined;
    if (place.photos?.[0]?.name) {
        photoUrl = `https://places.googleapis.com/v1/${place.photos[0].name}/media?key=${API_KEY}&maxHeightPx=200&maxWidthPx=300`;
    }

    // Parse price level
    let priceLevel: 1 | 2 | 3 | 4 | undefined;
    if (place.priceLevel) {
        const priceLevelMap: Record<string, 1 | 2 | 3 | 4> = {
            'PRICE_LEVEL_INEXPENSIVE': 1,
            'PRICE_LEVEL_MODERATE': 2,
            'PRICE_LEVEL_EXPENSIVE': 3,
            'PRICE_LEVEL_VERY_EXPENSIVE': 4,
        };
        priceLevel = priceLevelMap[place.priceLevel];
    }

    return {
        id: place.id,
        placeId: place.id,
        name,
        type,
        category,
        address: place.formattedAddress || '',
        distance,
        distanceMeters,
        rating: place.rating,
        totalRatings: place.userRatingCount,
        isOpen: place.currentOpeningHours?.openNow,
        openingHours: place.currentOpeningHours?.weekdayDescriptions,
        phone: place.nationalPhoneNumber,
        priceLevel,
        photoUrl,
        googleMapsUrl: place.googleMapsUri || `https://www.google.com/maps/place/?q=place_id:${place.id}`,
    };
}

/**
 * Categorize facility as government or private based on name
 */
function categorizeAsGovernmentOrPrivate(name: string, address?: string): FacilityCategory {
    const searchText = `${name} ${address || ''}`.toLowerCase();

    for (const keyword of GOVERNMENT_KEYWORDS) {
        if (searchText.includes(keyword.toLowerCase())) {
            return 'government';
        }
    }

    return 'private';
}

/**
 * Calculate distance between two points using Haversine formula
 */
function calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
): number {
    const R = 6371000; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
        Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

/**
 * Get price level display string
 */
export function getPriceLevelDisplay(priceLevel?: 1 | 2 | 3 | 4): string {
    switch (priceLevel) {
        case 1: return '₹';
        case 2: return '₹₹';
        case 3: return '₹₹₹';
        case 4: return '₹₹₹₹';
        default: return '';
    }
}
