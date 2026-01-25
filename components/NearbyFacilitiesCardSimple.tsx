import React, { useState, useEffect } from 'react';
import {
    MapPin, Building2, Stethoscope, FlaskConical,
    Star, Clock, Phone, Navigation, RefreshCw, Building, AlertCircle, Maximize2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { HealthcareFacility, UserLocation, FacilityType, FacilityCategory } from '../types';
import { requestUserLocation, getSavedLocation } from '../utils/locationService';
import { searchLabs, searchNearbyFacilities, getPriceLevelDisplay } from '../utils/placesService';

interface NearbyFacilitiesCardSimpleProps {
    recommendedTests: string[];
    severity: 'low' | 'medium' | 'high' | 'emergency';
}

type TabType = 'labs' | 'hospitals';

const NearbyFacilitiesCardSimple: React.FC<NearbyFacilitiesCardSimpleProps> = ({
    recommendedTests,
    severity,
}) => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<TabType>('labs');
    const [categoryFilter, setCategoryFilter] = useState<'all' | FacilityCategory>('all');
    const [facilities, setFacilities] = useState<HealthcareFacility[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [userLocation, setUserLocation] = useState<UserLocation | null>(null);

    useEffect(() => {
        const saved = getSavedLocation();
        if (saved) {
            setUserLocation(saved);
        }
    }, []);

    useEffect(() => {
        if (userLocation) {
            fetchFacilities();
        }
    }, [userLocation, activeTab]);

    const handleRequestLocation = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const location = await requestUserLocation();
            setUserLocation(location);
        } catch (e: any) {
            setError(e.message || 'Failed to get location');
        } finally {
            setIsLoading(false);
        }
    };

    const fetchFacilities = async () => {
        if (!userLocation) return;

        setIsLoading(true);
        setError(null);

        try {
            let results: HealthcareFacility[];

            if (activeTab === 'labs') {
                results = await searchLabs(userLocation, recommendedTests);
            } else {
                const hospitalResult = await searchNearbyFacilities(userLocation, 'hospital');
                results = hospitalResult.facilities;
            }

            setFacilities(results);
        } catch (e: any) {
            console.error('Failed to fetch facilities:', e);
            setError(e.message || 'Failed to find nearby facilities');
        } finally {
            setIsLoading(false);
        }
    };

    // Only show for medium+ severity
    if (severity === 'low') {
        return null;
    }

    const filteredFacilities = categoryFilter === 'all'
        ? facilities
        : facilities.filter(f => f.category === categoryFilter);

    const govtCount = facilities.filter(f => f.category === 'government').length;
    const privateCount = facilities.filter(f => f.category === 'private').length;

    if (!userLocation && !isLoading && !error) {
        return (
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100 p-4 mt-4">
                <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
                        <MapPin className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1">
                        <h4 className="font-bold text-slate-800 text-sm mb-1">Find Nearby Test Labs</h4>
                        <p className="text-xs text-slate-600 mb-3">
                            Enable location to find facilities that can perform the recommended tests.
                        </p>
                        <button
                            onClick={handleRequestLocation}
                            disabled={isLoading}
                            className="px-3 py-1.5 bg-blue-600 text-white font-bold rounded-lg text-xs hover:bg-blue-700 transition-all flex items-center gap-1.5"
                        >
                            <Navigation className="w-3.5 h-3.5" />
                            Enable Location
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden mt-4">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-700 to-indigo-700 p-3 text-white">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        <span className="font-bold text-sm">Nearby Facilities</span>
                        {userLocation?.city && (
                            <span className="text-xs text-white/70">• {userLocation.city}</span>
                        )}
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => navigate('/app/hospital-locator')}
                            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors flex items-center gap-1 text-[10px] font-bold"
                            title="View on full map"
                        >
                            <Maximize2 className="w-3.5 h-3.5" />
                            <span>Map</span>
                        </button>
                        <button
                            onClick={fetchFacilities}
                            disabled={isLoading}
                            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-200">
                <button
                    onClick={() => setActiveTab('labs')}
                    className={`flex-1 py-2 px-3 flex items-center justify-center gap-1.5 text-xs font-medium transition-all ${activeTab === 'labs'
                        ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                        : 'text-slate-500 hover:text-slate-700'
                        }`}
                >
                    <FlaskConical className="w-3.5 h-3.5" />
                    Test Labs
                </button>
                <button
                    onClick={() => setActiveTab('hospitals')}
                    className={`flex-1 py-2 px-3 flex items-center justify-center gap-1.5 text-xs font-medium transition-all ${activeTab === 'hospitals'
                        ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                        : 'text-slate-500 hover:text-slate-700'
                        }`}
                >
                    <Building2 className="w-3.5 h-3.5" />
                    Hospitals
                </button>
            </div>

            {/* Filters */}
            <div className="p-2 border-b border-slate-100 bg-slate-50/50 flex gap-1.5">
                <button
                    onClick={() => setCategoryFilter('all')}
                    className={`px-2 py-1 rounded text-[10px] font-bold transition-all ${categoryFilter === 'all'
                        ? 'bg-slate-800 text-white'
                        : 'bg-white border border-slate-200 text-slate-600'
                        }`}
                >
                    All ({facilities.length})
                </button>
                <button
                    onClick={() => setCategoryFilter('government')}
                    className={`px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1 transition-all ${categoryFilter === 'government'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white border border-slate-200 text-slate-600'
                        }`}
                >
                    Govt ({govtCount})
                </button>
                <button
                    onClick={() => setCategoryFilter('private')}
                    className={`px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1 transition-all ${categoryFilter === 'private'
                        ? 'bg-purple-600 text-white'
                        : 'bg-white border border-slate-200 text-slate-600'
                        }`}
                >
                    Private ({privateCount})
                </button>
            </div>

            {/* Results */}
            <div className="max-h-[250px] overflow-y-auto">
                {isLoading ? (
                    <div className="p-6 text-center">
                        <div className="w-8 h-8 border-3 border-blue-100 border-t-blue-600 rounded-full animate-spin mx-auto mb-2" />
                        <p className="text-xs text-slate-500">Finding nearby...</p>
                    </div>
                ) : error ? (
                    <div className="p-4 text-center">
                        <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
                        <p className="text-xs text-red-600 mb-2">{error}</p>
                        <button
                            onClick={fetchFacilities}
                            className="px-3 py-1 bg-slate-100 text-slate-600 rounded text-xs"
                        >
                            Retry
                        </button>
                    </div>
                ) : filteredFacilities.length === 0 ? (
                    <div className="p-6 text-center">
                        <MapPin className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <p className="text-xs text-slate-500">No facilities found</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {filteredFacilities.slice(0, 5).map((facility) => (
                            <div key={facility.id} className="p-3 hover:bg-slate-50/50 transition-colors">
                                <div className="flex justify-between items-start mb-1">
                                    <h4 className="font-semibold text-slate-800 text-xs line-clamp-1 flex-1">{facility.name}</h4>
                                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ml-2 ${facility.category === 'government'
                                        ? 'bg-blue-100 text-blue-700'
                                        : 'bg-indigo-100 text-indigo-700'
                                        }`}>
                                        {facility.category === 'government' ? 'Govt' : 'Private'}
                                    </span>
                                </div>
                                <p className="text-[10px] text-slate-500 line-clamp-1 mb-1.5">{facility.address}</p>
                                <div className="flex items-center gap-3 text-[10px]">
                                    <span className="text-slate-600">{facility.distance}</span>
                                    {facility.rating && (
                                        <span className="flex items-center gap-0.5 text-amber-600">
                                            <Star className="w-2.5 h-2.5 fill-current" />
                                            {facility.rating.toFixed(1)}
                                        </span>
                                    )}
                                    {facility.isOpen !== undefined && (
                                        <span className={facility.isOpen ? 'text-blue-600' : 'text-red-500'}>
                                            {facility.isOpen ? 'Open' : 'Closed'}
                                        </span>
                                    )}
                                </div>
                                <div className="flex gap-1.5 mt-2">
                                    <a
                                        href={facility.googleMapsUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-2 py-1 bg-blue-600 text-white text-[10px] font-bold rounded flex items-center gap-1 hover:bg-blue-700 transition-colors"
                                    >
                                        <Navigation className="w-2.5 h-2.5" />
                                        Directions
                                    </a>
                                    {facility.phone && (
                                        <a
                                            href={`tel:${facility.phone}`}
                                            className="px-2 py-1 bg-slate-100 text-slate-700 text-[10px] font-bold rounded flex items-center gap-1"
                                        >
                                            <Phone className="w-2.5 h-2.5" />
                                            Call
                                        </a>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default NearbyFacilitiesCardSimple;
