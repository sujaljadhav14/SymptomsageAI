"""Places tool — find nearby hospitals / clinics / labs via Google Maps Places API.

Mirrors ``utils/placesService.ts`` so the agent can locate care facilities as a
tool call (especially important on emergency paths).
"""
from __future__ import annotations

from langchain_core.tools import tool

from ..config import settings

FACILITY_TYPE_MAP = {
    "hospital": "hospital",
    "clinic": "doctor",
    "doctor": "doctor",
    "lab": "hospital",  # labs often ride under the hospital place type
    "pharmacy": "pharmacy",
}


@tool
def find_nearby_facilities(
    latitude: float,
    longitude: float,
    facility_type: str = "hospital",
    radius_meters: int = 5000,
) -> dict:
    """Find nearby hospitals, clinics, labs, or pharmacies around a location.

    Use this when the user needs physical care options — especially after a
    high-risk or emergency triage. Requires the user's current coordinates.

    Args:
        latitude: User's current latitude.
        longitude: User's current longitude.
        facility_type: One of hospital, clinic, doctor, lab, pharmacy.
        radius_meters: Search radius in metres (default 5km).
    """
    if not settings.google_maps_api_key:
        return {"error": "GOOGLE_MAPS_API_KEY not configured."}

    place_type = FACILITY_TYPE_MAP.get(facility_type.lower(), "hospital")
    url = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
    params = {
        "location": f"{latitude},{longitude}",
        "radius": radius_meters,
        "type": place_type,
        "key": settings.google_maps_api_key,
    }

    try:
        import httpx

        data = httpx.get(url, params=params, timeout=10.0).json()
        results = []
        for place in (data.get("results") or [])[:8]:
            results.append(
                {
                    "name": place.get("name"),
                    "rating": place.get("rating"),
                    "vicinity": place.get("vicinity"),
                    "open_now": place.get("opening_hours", {}).get("open_now"),
                    "place_id": place.get("place_id"),
                    "maps_url": f"https://www.google.com/maps/place/?q=place_id={place.get('place_id')}",
                }
            )
        return {"facilities": results, "count": len(results)}
    except Exception as exc:
        return {"error": f"Places search failed: {exc}"}
