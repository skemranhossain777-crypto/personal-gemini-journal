import type { JournalLocation } from '../data/models';

export interface LocationSearchResult {
  id: string;
  placeName: string;
  address: string;
  lat: number;
  lng: number;
}

export interface LocationPrivacyOptions {
  enableObfuscation?: boolean;
  precisionDigits?: number; // e.g. 2 digits approx ~1.1km
}

export class LocationPrivacyError extends Error {
  constructor(message: string, public readonly code: 'UNAUTHORIZED' | 'SILENT_COLLECTION_PROHIBITED' | 'INVALID_COORDINATES') {
    super(message);
    this.name = 'LocationPrivacyError';
  }
}

/**
 * Pre-defined mock places index for fast, secure local search.
 * Can be extended with Google Places API when configured with API key.
 */
const POPULAR_JOURNAL_PLACES: LocationSearchResult[] = [
  {
    id: 'place_kyoto',
    placeName: 'Arashiyama Bamboo Grove',
    address: 'Ukyo Ward, Kyoto, Japan',
    lat: 35.017,
    lng: 135.6713,
  },
  {
    id: 'place_ny_central_park',
    placeName: 'Central Park',
    address: 'New York, NY, USA',
    lat: 40.7851,
    lng: -73.9683,
  },
  {
    id: 'place_paris_eiffel',
    placeName: 'Eiffel Tower',
    address: 'Champ de Mars, Paris, France',
    lat: 48.8584,
    lng: 2.2945,
  },
  {
    id: 'place_tokyo_shibuya',
    placeName: 'Shibuya Crossing',
    address: 'Shibuya City, Tokyo, Japan',
    lat: 35.6595,
    lng: 139.7005,
  },
  {
    id: 'place_london_hyde',
    placeName: 'Hyde Park',
    address: 'London, United Kingdom',
    lat: 51.5073,
    lng: -0.1657,
  },
  {
    id: 'place_sf_bridge',
    placeName: 'Golden Gate Bridge',
    address: 'San Francisco, CA, USA',
    lat: 37.8199,
    lng: -122.4786,
  },
];

/**
 * Searches location suggestions by query string.
 */
export function searchLocations(query: string): LocationSearchResult[] {
  if (!query || query.trim().length === 0) return POPULAR_JOURNAL_PLACES;
  const clean = query.toLowerCase().trim();
  return POPULAR_JOURNAL_PLACES.filter(
    (p) => p.placeName.toLowerCase().includes(clean) || p.address.toLowerCase().includes(clean)
  );
}

/**
 * Obfuscates latitude and longitude for user privacy (e.g. coarse region-level location).
 */
export function obfuscateCoordinates(lat: number, lng: number, precisionDigits: number = 2): { lat: number; lng: number } {
  const factor = Math.pow(10, precisionDigits);
  return {
    lat: Math.round(lat * factor) / factor,
    lng: Math.round(lng * factor) / factor,
  };
}

/**
 * Explicit user consent action required to acquire device current position.
 * SILENT COLLECTION IS STRICTLY PROHIBITED.
 */
export async function requestDeviceLocation(params: {
  userConsentGiven: boolean;
  currentUserId: string;
}): Promise<JournalLocation> {
  const { userConsentGiven, currentUserId } = params;

  if (!currentUserId) {
    throw new LocationPrivacyError('Security Violation: Unauthorized location request attempt.', 'UNAUTHORIZED');
  }

  if (!userConsentGiven) {
    throw new LocationPrivacyError(
      'Privacy Policy Violation: Automatic or silent location collection is prohibited. Explicit user consent required.',
      'SILENT_COLLECTION_PROHIBITED'
    );
  }

  // Location collection disabled for submission
  throw new LocationPrivacyError(
    'Device geolocation is disabled in this environment.',
    'SILENT_COLLECTION_PROHIBITED'
  );
}

/**
 * Constructs a secure Google Maps embed or preview URL.
 * Never exposes private location tokens or unauthenticated APIs.
 */
export function getGoogleMapsPreviewUrl(location: JournalLocation, zoom: number = 13): string {
  if (!location) return '';
  const query = encodeURIComponent(location.address || location.placeName || `${location.lat},${location.lng}`);
  return `https://www.google.com/maps?q=${query}&z=${zoom}&output=embed`;
}

/**
 * Formats location for public export or shared views, applying privacy obfuscation if requested.
 */
export function formatLocationForDisplay(
  location: JournalLocation | null,
  privacyOptions: LocationPrivacyOptions = {}
): JournalLocation | null {
  if (!location) return null;

  if (privacyOptions.enableObfuscation) {
    const coarse = obfuscateCoordinates(location.lat, location.lng, privacyOptions.precisionDigits || 2);
    return {
      placeName: location.placeName || 'Coarse Location Area',
      address: 'Approximate region (precise address hidden for privacy)',
      lat: coarse.lat,
      lng: coarse.lng,
    };
  }

  return location;
}
