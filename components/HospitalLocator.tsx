import React, { useState, useCallback, useRef } from 'react';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from '@react-google-maps/api';
import { MapPin, Navigation, Star, Loader2, AlertCircle, Hospital, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

// Types
interface HospitalData {
    id: string;
    name: string;
    address: string;
    location: {
        lat: number;
        lng: number;
    };
    rating: number | string;
    totalRatings: number;
    isOpen: boolean | null;
}

interface Location {
    lat: number;
    lng: number;
}

// Map configuration - same as ai-doctor
const mapContainerStyle = {
    width: '100%',
    height: '100%',
    borderRadius: '16px',
};

const defaultCenter: Location = {
    lat: 28.6139,
    lng: 77.209,
};

const libraries: ("places")[] = ['places'];

const HospitalLocator: React.FC = () => {
    const navigate = useNavigate();
    const [userLocation, setUserLocation] = useState<Location | null>(null);
    const [hospitals, setHospitals] = useState<HospitalData[]>([]);
    const [selectedHospital, setSelectedHospital] = useState<HospitalData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [mapCenter, setMapCenter] = useState<Location>(defaultCenter);
    const mapRef = useRef<google.maps.Map | null>(null);

    const { isLoaded, loadError } = useJsApiLoader({
        googleMapsApiKey: (import.meta as any).env.VITE_GOOGLE_MAPS_API_KEY || '',
        libraries,
    });

    const onMapLoad = useCallback((map: google.maps.Map) => {
        mapRef.current = map;
    }, []);

    // Exact same implementation as ai-doctor
    const searchNearbyHospitals = useCallback((location: Location) => {
        if (!mapRef.current) return;

        setLoading(true);
        setError(null);

        const service = new window.google.maps.places.PlacesService(mapRef.current);

        const request: google.maps.places.PlaceSearchRequest = {
            location: new window.google.maps.LatLng(location.lat, location.lng),
            radius: 5000,
            type: 'hospital',
        };

        service.nearbySearch(request, (results, status) => {
            setLoading(false);
            if (status === window.google.maps.places.PlacesServiceStatus.OK && results) {
                const hospitalData: HospitalData[] = results.map((place) => ({
                    id: place.place_id || Math.random().toString(),
                    name: place.name || 'Unknown Hospital',
                    address: place.vicinity || 'Address not available',
                    location: {
                        lat: place.geometry?.location?.lat() || 0,
                        lng: place.geometry?.location?.lng() || 0,
                    },
                    rating: place.rating || 'N/A',
                    totalRatings: place.user_ratings_total || 0,
                    isOpen: place.opening_hours?.isOpen?.() ?? null,
                }));
                setHospitals(hospitalData);
            } else {
                setError('Could not find hospitals in this area. Try adjusting your location.');
            }
        });
    }, []);

    // Exact same implementation as ai-doctor
    const getUserLocation = useCallback(() => {
        setLoading(true);
        setError(null);

        if (!navigator.geolocation) {
            setError('Geolocation is not supported by your browser');
            setLoading(false);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const location: Location = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                };
                setUserLocation(location);
                setMapCenter(location);
                if (mapRef.current) {
                    mapRef.current.panTo(location);
                    mapRef.current.setZoom(14);
                }
                searchNearbyHospitals(location);
            },
            (err) => {
                setLoading(false);
                switch (err.code) {
                    case err.PERMISSION_DENIED:
                        setError('Location access was denied. Please enable location permissions.');
                        break;
                    case err.POSITION_UNAVAILABLE:
                        setError('Location information is unavailable.');
                        break;
                    case err.TIMEOUT:
                        setError('Location timed out. Use "Search Here" to search at map center.');
                        break;
                    default:
                        setError('An error occurred while getting your location.');
                }
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0,
            }
        );
    }, [searchNearbyHospitals]);

    // Fallback: Search at current map center (for college WiFi that blocks geolocation)
    const searchAtMapCenter = useCallback(() => {
        if (!mapRef.current) return;
        const center = mapRef.current.getCenter();
        if (center) {
            const location: Location = {
                lat: center.lat(),
                lng: center.lng(),
            };
            setUserLocation(location);
            setError(null);
            searchNearbyHospitals(location);
        }
    }, [searchNearbyHospitals]);

    const getDirections = (hospital: HospitalData) => {
        if (!userLocation) return;
        const url = `https://www.google.com/maps/dir/?api=1&origin=${userLocation.lat},${userLocation.lng}&destination=${hospital.location.lat},${hospital.location.lng}&travelmode=driving`;
        window.open(url, '_blank');
    };

    const calculateDistance = (hospital: HospitalData): string | null => {
        if (!userLocation) return null;
        const R = 6371;
        const dLat = ((hospital.location.lat - userLocation.lat) * Math.PI) / 180;
        const dLon = ((hospital.location.lng - userLocation.lng) * Math.PI) / 180;
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos((userLocation.lat * Math.PI) / 180) *
            Math.cos((hospital.location.lat * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c;
        return distance.toFixed(1);
    };

    // Loading error state
    if (loadError) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
                <div className="bg-white rounded-2xl border border-red-200 p-8 text-center max-w-md shadow-lg">
                    <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <AlertCircle className="w-8 h-8 text-red-500" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 mb-2">Map Loading Error</h3>
                    <p className="text-slate-500">Failed to load Google Maps. Please check your API key.</p>
                    <button
                        onClick={() => navigate('/app')}
                        className="mt-6 px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all"
                    >
                        Back to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    // Loading state
    if (!isLoaded) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
                    <p className="text-slate-500 font-medium">Loading maps...</p>
                </div>
            </div>
        );
    }

    // Main component
    return (
        <div className="min-h-screen bg-slate-50 text-slate-900">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm sticky top-0 z-40">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/app')}
                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 text-slate-600" />
                    </button>
                    <div className="flex items-center gap-2">
                        <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
                            <Hospital className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-slate-800">Hospital Locator</h1>
                            <p className="text-xs text-slate-500">Find nearest hospitals & emergency care</p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={getUserLocation}
                        disabled={loading}
                        className="px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold shadow-md hover:bg-blue-700 disabled:bg-blue-400 transition-all active:scale-95 flex items-center gap-2"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Locating...
                            </>
                        ) : (
                            <>
                                <MapPin className="w-4 h-4" />
                                Find Nearby
                            </>
                        )}
                    </button>
                    <button
                        onClick={searchAtMapCenter}
                        disabled={loading}
                        className="px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-200 disabled:bg-slate-50 transition-all flex items-center gap-2"
                        title="Search hospitals at current map center"
                    >
                        Search Here
                    </button>
                </div>
            </header>

            {/* Error Banner */}
            {error && (
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mx-6 mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-3"
                >
                    <div className="flex items-center gap-3">
                        <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
                        <p className="text-amber-700 text-sm font-medium">{error}</p>
                    </div>
                    <button
                        onClick={searchAtMapCenter}
                        className="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-sm font-bold hover:bg-amber-700 transition-all whitespace-nowrap"
                    >
                        Search Here
                    </button>
                </motion.div>
            )}

            {/* Success Banner */}
            {userLocation && (
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mx-6 mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3"
                >
                    <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
                        <MapPin className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div>
                        <p className="text-emerald-800 text-sm font-medium">Location found!</p>
                        <p className="text-emerald-600 text-xs">
                            {userLocation.lat.toFixed(4)}, {userLocation.lng.toFixed(4)}
                        </p>
                    </div>
                </motion.div>
            )}

            {/* Main Content */}
            <main className="p-6">
                <div className="flex flex-col lg:flex-row gap-6 max-w-7xl mx-auto">
                    {/* Map Section */}
                    <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-h-[500px]">
                        <GoogleMap
                            mapContainerStyle={mapContainerStyle}
                            center={mapCenter}
                            zoom={12}
                            onLoad={onMapLoad}
                            options={{
                                styles: [
                                    {
                                        featureType: 'poi.medical',
                                        stylers: [{ visibility: 'on' }],
                                    },
                                ],
                                disableDefaultUI: false,
                                zoomControl: true,
                                streetViewControl: false,
                                mapTypeControl: false,
                                fullscreenControl: true,
                            }}
                        >
                            {/* User Location Marker */}
                            {userLocation && (
                                <Marker
                                    position={userLocation}
                                    icon={{
                                        url: 'data:image/svg+xml,' + encodeURIComponent(`
                                            <svg width="56" height="56" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                <circle cx="28" cy="28" r="24" fill="#3b82f6" fill-opacity="0.25"/>
                                                <circle cx="28" cy="28" r="16" fill="#3b82f6" fill-opacity="0.4"/>
                                                <circle cx="28" cy="28" r="10" fill="#3b82f6" stroke="white" stroke-width="4"/>
                                                <circle cx="28" cy="28" r="4" fill="white"/>
                                            </svg>
                                        `),
                                        scaledSize: new window.google.maps.Size(56, 56),
                                        anchor: new window.google.maps.Point(28, 28),
                                    }}
                                    title="Your Location"
                                    zIndex={1000}
                                />
                            )}

                            {/* Hospital Markers */}
                            {hospitals.map((hospital) => (
                                <Marker
                                    key={hospital.id}
                                    position={hospital.location}
                                    onClick={() => setSelectedHospital(hospital)}
                                    icon={{
                                        url: 'data:image/svg+xml,' + encodeURIComponent(`
                                            <svg width="48" height="56" viewBox="0 0 48 56" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                <ellipse cx="24" cy="52" rx="10" ry="3" fill="rgba(0,0,0,0.2)"/>
                                                <path d="M24 2C12.954 2 4 10.954 4 22c0 16 20 32 20 32s20-16 20-32C44 10.954 35.046 2 24 2z" fill="#dc2626"/>
                                                <path d="M24 4C13.507 4 6 11.954 6 22c0 14 18 28 18 28s18-14 18-28C42 11.954 34.493 4 24 4z" fill="#ef4444"/>
                                                <circle cx="24" cy="22" r="14" fill="white"/>
                                                <rect x="21" y="12" width="6" height="20" rx="2" fill="#dc2626"/>
                                                <rect x="14" y="19" width="20" height="6" rx="2" fill="#dc2626"/>
                                            </svg>
                                        `),
                                        scaledSize: new window.google.maps.Size(48, 56),
                                        anchor: new window.google.maps.Point(24, 56),
                                    }}
                                    zIndex={100}
                                />
                            ))}

                            {/* Info Window */}
                            {selectedHospital && (
                                <InfoWindow
                                    position={selectedHospital.location}
                                    onCloseClick={() => setSelectedHospital(null)}
                                >
                                    <div className="p-2 max-w-[250px]">
                                        <h3 className="font-bold text-slate-800 mb-1">{selectedHospital.name}</h3>
                                        <p className="text-slate-500 text-sm mb-2">{selectedHospital.address}</p>
                                        <div className="flex items-center gap-2 mb-3">
                                            <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                                            <span className="text-sm text-slate-700">
                                                {selectedHospital.rating} ({selectedHospital.totalRatings} reviews)
                                            </span>
                                        </div>
                                        <button
                                            onClick={() => getDirections(selectedHospital)}
                                            className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors"
                                        >
                                            🚗 Get Directions
                                        </button>
                                    </div>
                                </InfoWindow>
                            )}
                        </GoogleMap>
                    </div>

                    {/* Hospital List */}
                    <div className="w-full lg:w-96 space-y-4 max-h-[600px] overflow-y-auto">
                        {hospitals.length === 0 && !loading && (
                            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
                                <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Hospital className="w-8 h-8 text-blue-500" />
                                </div>
                                <h3 className="font-bold text-slate-800 mb-2">Find Nearby Hospitals</h3>
                                <p className="text-slate-500 text-sm">
                                    Click "Find Nearby Hospitals" to search for hospitals near you
                                </p>
                            </div>
                        )}

                        {hospitals.map((hospital, index) => (
                            <motion.div
                                key={hospital.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                                onClick={() => {
                                    setSelectedHospital(hospital);
                                    mapRef.current?.panTo(hospital.location);
                                }}
                                className={`bg-white rounded-xl border p-4 cursor-pointer transition-all hover:shadow-md ${selectedHospital?.id === hospital.id
                                    ? 'border-blue-500 shadow-md ring-2 ring-blue-100'
                                    : 'border-slate-200'
                                    }`}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <h4 className="font-bold text-slate-800 text-sm flex-1 pr-2">
                                        {hospital.name}
                                    </h4>
                                    {calculateDistance(hospital) && (
                                        <span className="px-2 py-1 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold whitespace-nowrap">
                                            {calculateDistance(hospital)} km
                                        </span>
                                    )}
                                </div>

                                <p className="text-slate-500 text-xs mb-3">{hospital.address}</p>

                                <div className="flex items-center gap-4 mb-3">
                                    <div className="flex items-center gap-1">
                                        <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                                        <span className="text-sm text-slate-700">{hospital.rating}</span>
                                    </div>
                                    {hospital.isOpen !== null && (
                                        <span className={`text-xs font-medium ${hospital.isOpen ? 'text-emerald-600' : 'text-red-500'
                                            }`}>
                                            {hospital.isOpen ? '🟢 Open' : '🔴 Closed'}
                                        </span>
                                    )}
                                </div>

                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        getDirections(hospital);
                                    }}
                                    className="w-full py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-all active:scale-95 flex items-center justify-center gap-2"
                                >
                                    <Navigation className="w-4 h-4" />
                                    Get Directions
                                </button>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default HospitalLocator;
