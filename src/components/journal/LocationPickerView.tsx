import React, { useState } from 'react';
import {
  MapPin,
  Search,
  X,
  Edit3,
  Trash2,
  Navigation,
  EyeOff,
  ShieldCheck,
  ExternalLink,
  Map as MapIcon,
  Check,
} from 'lucide-react';
import type { JournalLocation } from '../../data/models';
import {
  searchLocations,
  getGoogleMapsPreviewUrl,
  requestDeviceLocation,
  formatLocationForDisplay,
  type LocationSearchResult,
} from '../../services/locationService';

export interface LocationPickerViewProps {
  location: JournalLocation | null;
  onLocationChange: (location: JournalLocation | null) => void;
  currentUserId: string;
}

export const LocationPickerView: React.FC<LocationPickerViewProps> = ({
  location,
  onLocationChange,
  currentUserId,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<LocationSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [useObfuscation, setUseObfuscation] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [locationConsentGranted, setLocationConsentGranted] = useState(false);

  // Custom edit fields
  const [editPlaceName, setEditPlaceName] = useState(location?.placeName || '');
  const [editAddress, setEditAddress] = useState(location?.address || '');

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setSearchQuery(q);
    if (q.trim().length > 0) {
      setIsSearching(true);
      setSearchResults(searchLocations(q));
    } else {
      setIsSearching(false);
      setSearchResults([]);
    }
  };

  const handleSelectPlace = (place: LocationSearchResult) => {
    const selected: JournalLocation = {
      placeName: place.placeName,
      address: place.address,
      lat: place.lat,
      lng: place.lng,
    };
    onLocationChange(formatLocationForDisplay(selected, { enableObfuscation: useObfuscation }));
    setIsSearching(false);
    setSearchQuery('');
  };

  const handleRequestDeviceLocation = async () => {
    try {
      setErrorMsg(null);
      // Require explicit user button click (Consent)
      setLocationConsentGranted(true);
      const loc = await requestDeviceLocation({
        userConsentGiven: true,
        currentUserId,
      });
      onLocationChange(formatLocationForDisplay(loc, { enableObfuscation: useObfuscation }));
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to acquire location.');
    }
  };

  const handleSaveEdit = () => {
    if (!location) return;
    const updated: JournalLocation = {
      ...location,
      placeName: editPlaceName.trim() || location.placeName,
      address: editAddress.trim() || undefined,
    };
    onLocationChange(formatLocationForDisplay(updated, { enableObfuscation: useObfuscation }));
    setIsEditing(false);
  };

  const handleRemoveLocation = () => {
    onLocationChange(null);
    setIsEditing(false);
    setErrorMsg(null);
  };

  const handleToggleObfuscation = (checked: boolean) => {
    setUseObfuscation(checked);
    if (location) {
      onLocationChange(formatLocationForDisplay(location, { enableObfuscation: checked }));
    }
  };

  const mapPreviewUrl = location ? getGoogleMapsPreviewUrl(location) : '';

  return (
    <div className="space-y-4 p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl backdrop-blur-md">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-200">
          <MapPin className="w-5 h-5 text-emerald-400" />
          <h3 className="text-sm font-semibold tracking-wide">Journal Location (Optional)</h3>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-emerald-400/90 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Strictly Private & Optional</span>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 text-xs text-rose-300 bg-rose-950/50 border border-rose-800/60 rounded-xl flex items-center justify-between">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="text-rose-400 hover:text-rose-200">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Selected Location Card */}
      {location ? (
        <div className="space-y-3">
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-100">{location.placeName}</span>
                  {useObfuscation && (
                    <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/30 flex items-center gap-1">
                      <EyeOff className="w-3 h-3" /> Coarse Precision
                    </span>
                  )}
                </div>
                {location.address && <div className="text-xs text-slate-400">{location.address}</div>}
                <div className="text-[11px] text-slate-500 font-mono">
                  Coordinates: {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    setEditPlaceName(location.placeName);
                    setEditAddress(location.address || '');
                    setIsEditing(!isEditing);
                  }}
                  className="p-1.5 rounded-lg bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700 transition"
                  title="Edit Location"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                <button
                  onClick={handleRemoveLocation}
                  className="p-1.5 rounded-lg bg-slate-800/80 text-rose-400 hover:text-rose-200 hover:bg-rose-950/50 transition"
                  title="Remove Location"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Editing Box */}
            {isEditing && (
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2 mt-2">
                <div className="text-xs font-semibold text-slate-300">Edit Location Label & Address</div>
                <input
                  type="text"
                  value={editPlaceName}
                  onChange={(e) => setEditPlaceName(e.target.value)}
                  placeholder="Place Name (e.g. Kyoto Temple)"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                />
                <input
                  type="text"
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  placeholder="Address or City, Country"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                />
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    onClick={() => setIsEditing(false)}
                    className="px-3 py-1 text-xs text-slate-400 hover:text-slate-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    className="px-3 py-1 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            )}

            {/* Privacy Obfuscation Toggle */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={useObfuscation}
                  onChange={(e) => handleToggleObfuscation(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500"
                />
                <span>Obfuscate Exact Home/Street Coordinates (Coarse Privacy Mode)</span>
              </label>
            </div>
          </div>

          {/* Google Maps Preview */}
          <div className="rounded-xl overflow-hidden border border-slate-800 bg-slate-950 relative h-48">
            <iframe
              title="Google Maps Location Preview"
              width="100%"
              height="100%"
              frameBorder="0"
              style={{ border: 0 }}
              src={mapPreviewUrl}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                location.placeName || `${location.lat},${location.lng}`
              )}`}
              target="_blank"
              rel="noreferrer"
              className="absolute bottom-2 right-2 px-2.5 py-1 rounded-lg bg-slate-900/90 text-[11px] text-slate-300 border border-slate-700 hover:text-white flex items-center gap-1 backdrop-blur-xs"
            >
              <span>Open in Google Maps</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      ) : (
        /* No Location Selected State */
        <div className="space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="Search places or landmarks (e.g. Kyoto, Central Park)..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/60"
            />
          </div>

          {/* Device Location Consent Action */}
          <div className="flex items-center justify-between bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
            <div className="text-xs text-slate-400">
              <span className="text-slate-300 font-medium">Device GPS:</span> Never silently queried. Requires explicit click.
            </div>
            <button
              onClick={handleRequestDeviceLocation}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-medium transition"
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>Use My Current Location</span>
            </button>
          </div>

          {/* Search Suggestions */}
          {isSearching && (
            <div className="space-y-1 bg-slate-950 rounded-xl border border-slate-800 p-2 max-h-48 overflow-y-auto">
              <div className="text-[11px] text-slate-500 px-2 py-1 uppercase font-semibold">Location Suggestions</div>
              {searchResults.length > 0 ? (
                searchResults.map((place) => (
                  <button
                    key={place.id}
                    onClick={() => handleSelectPlace(place)}
                    className="w-full text-left p-2 rounded-lg hover:bg-slate-900 transition flex items-center justify-between text-xs group"
                  >
                    <div>
                      <div className="font-semibold text-slate-200 group-hover:text-emerald-400">{place.placeName}</div>
                      <div className="text-[11px] text-slate-400">{place.address}</div>
                    </div>
                    <MapIcon className="w-4 h-4 text-slate-500 group-hover:text-emerald-400" />
                  </button>
                ))
              ) : (
                <div className="text-xs text-slate-400 p-2">No matching location suggestions found.</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
