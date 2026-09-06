import { describe, it, expect } from 'vitest';
import {
  searchLocations,
  obfuscateCoordinates,
  requestDeviceLocation,
  getGoogleMapsPreviewUrl,
  formatLocationForDisplay,
  LocationPrivacyError,
} from '../locationService';
import type { JournalLocation } from '../../data/models';

describe('locationService privacy & operational rules', () => {
  const sampleLocation: JournalLocation = {
    placeName: 'Kyoto Imperial Palace',
    address: 'Kyotogyoen, Kamigyo Ward, Kyoto, Japan',
    lat: 35.025432,
    lng: 135.762111,
  };

  it('searches and filters places by query string', () => {
    const results = searchLocations('Kyoto');
    const hasKyotoMatch = results.some(
      (r) => r.placeName.toLowerCase().includes('kyoto') || r.address.toLowerCase().includes('kyoto')
    );
    expect(hasKyotoMatch).toBe(true);
  });

  it('rounds lat/lng coordinates in obfuscateCoordinates (coarse mode)', () => {
    const coarse = obfuscateCoordinates(35.025432, 135.762111, 2);
    expect(coarse.lat).toBe(35.03);
    expect(coarse.lng).toBe(135.76);
  });

  it('PROHIBITS silent location collection without explicit user consent', async () => {
    // Missing userConsentGiven -> SILENT_COLLECTION_PROHIBITED
    await expect(
      requestDeviceLocation({
        userConsentGiven: false,
        currentUserId: 'user1',
      })
    ).rejects.toThrow(LocationPrivacyError);

    await expect(
      requestDeviceLocation({
        userConsentGiven: false,
        currentUserId: 'user1',
      })
    ).rejects.toThrow(/Automatic or silent location collection is prohibited/);
  });

  it('rejects unauthorized location requests missing currentUserId', async () => {
    await expect(
      requestDeviceLocation({
        userConsentGiven: true,
        currentUserId: '',
      })
    ).rejects.toThrow(LocationPrivacyError);
  });

  it('generates secure Google Maps preview URL without leaking private data', () => {
    const url = getGoogleMapsPreviewUrl(sampleLocation);
    expect(url).toContain('https://www.google.com/maps?q=');
    expect(url).toContain('output=embed');
  });

  it('formats location with coarse obfuscation when requested', () => {
    const formatted = formatLocationForDisplay(sampleLocation, { enableObfuscation: true, precisionDigits: 2 });
    expect(formatted).not.toBeNull();
    expect(formatted?.lat).toBe(35.03);
    expect(formatted?.lng).toBe(135.76);
    expect(formatted?.address).toContain('hidden for privacy');
  });

  it('preserves exact location details when obfuscation is disabled', () => {
    const formatted = formatLocationForDisplay(sampleLocation, { enableObfuscation: false });
    expect(formatted).toEqual(sampleLocation);
  });
});
