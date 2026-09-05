import React, { useState, useRef, useCallback, useEffect } from 'react';
import { MapPin, X, Search, Loader2 } from 'lucide-react';
import type { JournalLocation } from '../types';

declare global {
  interface Window {
    google?: {
      maps?: {
        Map: any;
        Marker: any;
        Animation: { DROP: number };
      };
    };
  }
}

interface LocationPickerProps {
  location: JournalLocation | null;
  onLocationChange: (location: JournalLocation | null) => void;
}

interface PlaceSuggestion {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
}

export const LocationPicker: React.FC<LocationPickerProps> = ({ location, onLocationChange }) => {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const mapsClientId = import.meta.env.VITE_GOOGLE_MAPS_CLIENT_ID || '';

  // Load Google Maps JS API
  useEffect(() => {
    if (!mapsClientId || mapLoaded || mapError) return;
    if (typeof window.google?.maps !== 'undefined') {
      setMapLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${mapsClientId}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => setMapLoaded(true);
    script.onerror = () => setMapError(true);
    document.head.appendChild(script);
  }, [mapsClientId, mapLoaded, mapError]);

  // Initialize or update map when location changes
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || !window.google?.maps) return;

    const pos = location ? { lat: location.lat, lng: location.lng } : { lat: 20, lng: 0 };
    const zoom = location ? 14 : 2;

    if (!mapInstanceRef.current) {
      mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
        center: pos,
        zoom,
        disableDefaultUI: true,
        zoomControl: true,
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: false,
        styles: [
          { elementType: 'geometry', stylers: [{ color: '#17254F' }] },
          { elementType: 'labels.text.stroke', stylers: [{ color: '#17254F' }] },
          { elementType: 'labels.text.fill', stylers: [{ color: '#8FA2C9' }] },
          { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#223056' }] },
          { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#070B16' }] },
        ],
      });
    } else {
      mapInstanceRef.current.setCenter(pos);
      mapInstanceRef.current.setZoom(zoom);
    }

    if (markerRef.current) {
      markerRef.current.setMap(null);
    }

    if (location) {
      markerRef.current = new window.google.maps.Marker({
        position: pos,
        map: mapInstanceRef.current,
        title: location.placeName,
        animation: window.google.maps.Animation.DROP,
      });
    }
  }, [mapLoaded, location]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fetchSuggestions = useCallback(async (input: string) => {
    if (input.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    setIsSearching(true);
    try {
      const resp = await fetch('/api/google/places/autocomplete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input }),
      });
      const data = await resp.json();
      setSuggestions(data.suggestions || []);
      setShowDropdown(true);
    } catch {
      setSuggestions([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleQueryChange = (value: string) => {
    setQuery(value);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => fetchSuggestions(value), 250);
  };

  const selectPlace = async (suggestion: PlaceSuggestion) => {
    setQuery(suggestion.description);
    setShowDropdown(false);
    setIsSearching(true);
    try {
      const resp = await fetch('/api/google/places/details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ placeId: suggestion.placeId }),
      });
      const data = await resp.json();
      if (data.lat && data.lng) {
        onLocationChange({
          lat: data.lat,
          lng: data.lng,
          placeName: data.placeName || suggestion.mainText,
          address: data.address || suggestion.description,
        });
      }
    } catch {
      // silently fail
    } finally {
      setIsSearching(false);
      setSuggestions([]);
    }
  };

  const removeLocation = () => {
    onLocationChange(null);
    setQuery('');
    setSuggestions([]);
  };

  return (
    <div className="relative">
      {/* Location Display / Search */}
      {location ? (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-800/40 bg-emerald-950/30 px-3 py-1.5">
          <MapPin className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
          <span className="text-xs text-emerald-300 font-medium truncate max-w-[200px]">
            {location.placeName}
          </span>
          <button
            onClick={removeLocation}
            className="ml-1 p-0.5 text-emerald-400/60 hover:text-red-400 transition-colors"
            title="Remove location"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <div ref={dropdownRef} className="relative">
          <div className="flex items-center gap-1.5 rounded-lg border border-[#223056] bg-[#121E40] px-2.5 py-1.5 focus-within:border-[#444] transition-colors">
            {isSearching ? (
              <Loader2 className="h-3.5 w-3.5 text-[#666] animate-spin shrink-0" />
            ) : (
              <Search className="h-3.5 w-3.5 text-[#666] shrink-0" />
            )}
            <input
              type="text"
              placeholder="Pin a location..."
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
              className="bg-transparent text-xs text-[#EEF4FF] placeholder:text-[#666] focus:outline-none w-[140px]"
            />
          </div>

          {/* Suggestions Dropdown */}
          {showDropdown && suggestions.length > 0 && (
            <div className="absolute top-full left-0 mt-1 w-72 rounded-xl border border-[#223056] bg-[#0E1730] shadow-xl z-50 overflow-hidden">
              {suggestions.map((s) => (
                <button
                  key={s.placeId}
                  onClick={() => selectPlace(s)}
                  className="w-full flex items-start gap-2 px-3 py-2.5 hover:bg-[#17254F] text-left transition-colors border-b border-[#17254F] last:border-0"
                >
                  <MapPin className="h-3.5 w-3.5 text-[#666] shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-xs text-[#EEF4FF] font-medium truncate">{s.mainText}</p>
                    <p className="text-[10px] text-[#888] truncate">{s.secondaryText}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Map Preview */}
      {location && mapLoaded && (
        <div className="mt-2 rounded-lg overflow-hidden border border-[#223056]">
          <div ref={mapRef} className="w-full h-[140px]" />
        </div>
      )}

      {/* Map unavailable notice */}
      {location && !mapLoaded && !mapError && (
        <div className="mt-2 flex items-center gap-2 text-[10px] text-[#666]">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>Loading map...</span>
        </div>
      )}
      {mapError && !mapsClientId && location && (
        <div className="mt-2 text-[10px] text-[#666]">
          Maps preview requires VITE_GOOGLE_MAPS_CLIENT_ID
        </div>
      )}
    </div>
  );
};
