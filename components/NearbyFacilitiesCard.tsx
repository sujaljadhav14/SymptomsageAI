import React, { useState, useEffect } from 'react';
import {
    MapPin, Building2, Stethoscope, FlaskConical, Pill,
    Star, Clock, Phone, ExternalLink, Navigation, Filter,
    ChevronDown, AlertCircle, RefreshCw, Building
} from 'lucide-react';
import { HealthcareFacility, UserLocation, FacilityType, FacilityCategory, TestSuggestion, ConditionMatch } from '../types';
import { requestUserLocation, getSavedLocation } from '../utils/locationService';
import { searchDoctors, searchLabs, searchNearbyFacilities, getPriceLevelDisplay } from '../utils/placesService';

interface NearbyFacilitiesCardProps {
    testSuggestions: TestSuggestion[];
    possibleConditions: ConditionMatch[];
    riskLevel: 'low' | 'moderate' | 'high' | 'emergency';
}

type TabType = 'doctors' | 'labs' | 'hospitals';

const TAB_CONFIG: Record<TabType, { label: string; icon: React.ReactNode; type: FacilityType }> = {
    doctors: { label: 'Doctors', icon: <Stethoscope className="w-4 h-4" />, type: 'doctor' },
    labs: { label: 'Test Labs', icon: <FlaskConical className="w-4 h-4" />, type: 'lab' },
    hospitals: { label: 'Hospitals', icon: <Building2 className="w-4 h-4" />, type: 'hospital' },
};

const NearbyFacilitiesCard: React.FC<NearbyFacilitiesCardProps> = ({
    testSuggestions,
    possibleConditions,
    riskLevel,
}) => {
    const [activeTab, setActiveTab] = useState<TabType>('doctors');
    const [categoryFilter, setCategoryFilter] = useState<'all' | FacilityCategory>('all');
    const [facilities, setFacilities] = useState<HealthcareFacility[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
    const [showFilters, setShowFilters] = useState(false);

    // Get specialties from conditions
    const specialties = possibleConditions
        .flatMap(c => {
            // Map conditions to specialties
            const specialtyMap: Record<string, string[]> = {
                migraine: ['Neurologist'],
                diabetes: ['Endocrinologist', 'Diabetologist'],
                hypertension: ['Cardiologist'],
                anemia: ['Hematologist'],
                thyroid_disorder: ['Endocrinologist'],
                asthma: ['Pulmonologist'],
                pneumonia: ['Pulmonologist'],
                gastritis: ['Gastroenterologist'],
                urinary_tract_infection: ['Urologist'],
                anxiety: ['Psychiatrist'],
                depression: ['Psychiatrist'],
                arthritis: ['Rheumatologist', 'Orthopedist'],
            };
            return specialtyMap[c.conditionId] || ['General Physician'];
        })
        .filter((v, i, a) => a.indexOf(v) === i); // Unique

    // Get test names for lab search
    const testNames = testSuggestions.map(t => t.name);

    useEffect(() => {
        // Check for saved location first
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

            switch (activeTab) {
                case 'doctors':
                    results = await searchDoctors(userLocation, specialties);
                    break;
                case 'labs':
                    results = await searchLabs(userLocation, testNames);
                    break;
                case 'hospitals':
                    const hospitalResult = await searchNearbyFacilities(userLocation, 'hospital');
                    results = hospitalResult.facilities;
                    break;
                default:
                    results = [];
            }

            setFacilities(results);
        } catch (e: any) {
            console.error('Failed to fetch facilities:', e);
            setError(e.message || 'Failed to find nearby facilities');
        } finally {
            setIsLoading(false);
        }
    };

    const filteredFacilities = categoryFilter === 'all'
        ? facilities
        : facilities.filter(f => f.category === categoryFilter);

    const govtCount = facilities.filter(f => f.category === 'government').length;
    const privateCount = facilities.filter(f => f.category === 'private').length;

    // Don't show if location not available
    if (!userLocation && !isLoading && !error) {
        return (
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-100 p-6">
                <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center shrink-0">
                        <MapPin className="w-6 h-6 text-blue-600" />
                    </div>
                    <div className="flex-1">
                        <h3 className="font-bold text-slate-800 mb-1">Find Nearby Healthcare</h3>
                        <p className="text-sm text-slate-600 mb-4">
                            Enable location to find doctors, clinics, and test labs near you based on your assessment.
                        </p>
                        <button
                            onClick={handleRequestLocation}
                            disabled={isLoading}
                            className="px-4 py-2 bg-blue-600 text-white font-bold rounded-xl text-sm hover:bg-blue-700 transition-all flex items-center gap-2"
                        >
                            <Navigation className="w-4 h-4" />
                            Enable Location
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 text-white">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <MapPin className="w-5 h-5" />
                        <div>
                            <h3 className="font-bold">Nearby Healthcare</h3>
                            {userLocation?.city && (
                                <p className="text-xs text-white/70">{userLocation.city}, {userLocation.state}</p>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={fetchFacilities}
                        disabled={isLoading}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    >
                        <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-200">
                {Object.entries(TAB_CONFIG).map(([key, config]) => (
                    <button
                        key={key}
                        onClick={() => setActiveTab(key as TabType)}
                        className={`flex-1 py-3 px-4 flex items-center justify-center gap-2 text-sm font-medium transition-all ${activeTab === key
                            ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                            : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                            }`}
                    >
                        {config.icon}
                        {config.label}
                    </button>
                ))}
            </div>

            {/* Filters */}
            <div className="p-3 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center justify-between">
                    <div className="flex gap-2">
                        <button
                            onClick={() => setCategoryFilter('all')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${categoryFilter === 'all'
                                ? 'bg-slate-800 text-white'
                                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                                }`}
                        >
                            All ({facilities.length})
                        </button>
                        <button
                            onClick={() => setCategoryFilter('government')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${categoryFilter === 'government'
                                ? 'bg-emerald-600 text-white'
                                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                                }`}
                        >
                            <Building className="w-3 h-3" />
                            Govt ({govtCount})
                        </button>
                        <button
                            onClick={() => setCategoryFilter('private')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${categoryFilter === 'private'
                                ? 'bg-purple-600 text-white'
                                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                                }`}
                        >
                            <Building2 className="w-3 h-3" />
                            Private ({privateCount})
                        </button>
                    </div>
                </div>
            </div>

            {/* Results */}
            <div className="max-h-[400px] overflow-y-auto">
                {isLoading ? (
                    <div className="p-8 text-center">
                        <div className="w-10 h-10 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
                        <p className="text-sm text-slate-500">Finding nearby facilities...</p>
                    </div>
                ) : error ? (
                    <div className="p-6 text-center">
                        <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
                        <p className="text-sm text-red-600 mb-3">{error}</p>
                        <button
                            onClick={fetchFacilities}
                            className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-200"
                        >
                            Try Again
                        </button>
                    </div>
                ) : filteredFacilities.length === 0 ? (
                    <div className="p-8 text-center">
                        <MapPin className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                        <p className="text-sm text-slate-500">No facilities found in this category</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {filteredFacilities.map((facility) => (
                            <FacilityCard key={facility.id} facility={facility} />
                        ))}
                    </div>
                )}
            </div>

            {/* Footer */}
            {!isLoading && filteredFacilities.length > 0 && (
                <div className="p-3 border-t border-slate-100 bg-slate-50/50 text-center">
                    <p className="text-[10px] text-slate-400">
                        Results from Google Maps • Distances are approximate
                    </p>
                </div>
            )}
        </div>
    );
};

const FacilityCard: React.FC<{ facility: HealthcareFacility }> = ({ facility }) => {
    return (
        <div className="p-4 hover:bg-slate-50/50 transition-colors">
            <div className="flex gap-3">
                {/* Photo or Icon */}
                <div className="w-16 h-16 bg-slate-100 rounded-xl overflow-hidden shrink-0">
                    {facility.photoUrl ? (
                        <img
                            src={facility.photoUrl}
                            alt={facility.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                            }}
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center">
                            <Building2 className="w-6 h-6 text-slate-400" />
                        </div>
                    )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                        <div>
                            <h4 className="font-semibold text-slate-800 text-sm line-clamp-1">{facility.name}</h4>
                            <p className="text-xs text-slate-500 line-clamp-1">{facility.address}</p>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 ${facility.category === 'government'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-purple-100 text-purple-700'
                            }`}>
                            {facility.category === 'government' ? 'Govt' : 'Private'}
                        </span>
                    </div>

                    {/* Meta */}
                    <div className="flex flex-wrap items-center gap-3 mt-2 text-xs">
                        <span className="flex items-center gap-1 text-slate-600">
                            <Navigation className="w-3 h-3" />
                            {facility.distance}
                        </span>

                        {facility.rating && (
                            <span className="flex items-center gap-1 text-amber-600">
                                <Star className="w-3 h-3 fill-current" />
                                {facility.rating.toFixed(1)}
                                {facility.totalRatings && (
                                    <span className="text-slate-400">({facility.totalRatings})</span>
                                )}
                            </span>
                        )}

                        {facility.isOpen !== undefined && (
                            <span className={`flex items-center gap-1 ${facility.isOpen ? 'text-emerald-600' : 'text-red-500'
                                }`}>
                                <Clock className="w-3 h-3" />
                                {facility.isOpen ? 'Open' : 'Closed'}
                            </span>
                        )}

                        {facility.priceLevel && (
                            <span className="text-slate-500">
                                {getPriceLevelDisplay(facility.priceLevel)}
                            </span>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 mt-3">
                        <a
                            href={facility.googleMapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-all flex items-center gap-1.5"
                        >
                            <Navigation className="w-3 h-3" />
                            Directions
                        </a>
                        {facility.phone && (
                            <a
                                href={`tel:${facility.phone}`}
                                className="px-3 py-1.5 bg-slate-100 text-slate-700 text-xs font-bold rounded-lg hover:bg-slate-200 transition-all flex items-center gap-1.5"
                            >
                                <Phone className="w-3 h-3" />
                                Call
                            </a>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default NearbyFacilitiesCard;
