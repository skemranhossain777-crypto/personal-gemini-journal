import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LocationPickerView } from '../LocationPickerView';
import type { JournalLocation } from '../../../data/models';

describe('LocationPickerView component', () => {
  const sampleLocation: JournalLocation = {
    placeName: 'Central Park',
    address: 'New York, NY, USA',
    lat: 40.7851,
    lng: -73.9683,
  };

  it('renders search input and device location button when no location is attached', () => {
    render(
      <LocationPickerView
        location={null}
        onLocationChange={vi.fn()}
        currentUserId="user1"
      />
    );

    expect(screen.getByText(/Journal Location \(Optional\)/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Search places or landmarks/i)).toBeInTheDocument();
    expect(screen.getByText(/Use My Current Location/i)).toBeInTheDocument();
    expect(screen.getByText(/Never silently queried/i)).toBeInTheDocument();
  });

  it('allows selecting a place from location search suggestions', async () => {
    const user = userEvent.setup();
    const handleLocationChange = vi.fn();

    render(
      <LocationPickerView
        location={null}
        onLocationChange={handleLocationChange}
        currentUserId="user1"
      />
    );

    const searchInput = screen.getByPlaceholderText(/Search places or landmarks/i);
    await user.type(searchInput, 'Kyoto');

    expect(screen.getByText('Arashiyama Bamboo Grove')).toBeInTheDocument();
    await user.click(screen.getByText('Arashiyama Bamboo Grove'));

    expect(handleLocationChange).toHaveBeenCalledWith(
      expect.objectContaining({
        placeName: 'Arashiyama Bamboo Grove',
      })
    );
  });

  it('renders attached location details and Google Maps preview iframe', () => {
    render(
      <LocationPickerView
        location={sampleLocation}
        onLocationChange={vi.fn()}
        currentUserId="user1"
      />
    );

    expect(screen.getByText('Central Park')).toBeInTheDocument();
    expect(screen.getByText('New York, NY, USA')).toBeInTheDocument();
    expect(screen.getByTitle('Google Maps Location Preview')).toBeInTheDocument();
    expect(screen.getByText('Open in Google Maps')).toBeInTheDocument();
  });

  it('allows editing location place name and saving changes', async () => {
    const user = userEvent.setup();
    const handleLocationChange = vi.fn();

    render(
      <LocationPickerView
        location={sampleLocation}
        onLocationChange={handleLocationChange}
        currentUserId="user1"
      />
    );

    const editBtn = screen.getByTitle('Edit Location');
    await user.click(editBtn);

    const placeNameInput = screen.getByPlaceholderText(/Place Name/i);
    await user.clear(placeNameInput);
    await user.type(placeNameInput, 'Central Park South');

    const saveBtn = screen.getByText('Save Changes');
    await user.click(saveBtn);

    expect(handleLocationChange).toHaveBeenCalledWith(
      expect.objectContaining({
        placeName: 'Central Park South',
      })
    );
  });

  it('allows removing an attached location', async () => {
    const user = userEvent.setup();
    const handleLocationChange = vi.fn();

    render(
      <LocationPickerView
        location={sampleLocation}
        onLocationChange={handleLocationChange}
        currentUserId="user1"
      />
    );

    const removeBtn = screen.getByTitle('Remove Location');
    await user.click(removeBtn);

    expect(handleLocationChange).toHaveBeenCalledWith(null);
  });

  it('toggles coarse privacy mode obfuscation', async () => {
    const user = userEvent.setup();
    const handleLocationChange = vi.fn();

    render(
      <LocationPickerView
        location={sampleLocation}
        onLocationChange={handleLocationChange}
        currentUserId="user1"
      />
    );

    const checkbox = screen.getByRole('checkbox', { name: /Obfuscate Exact Home\/Street Coordinates/i });
    await user.click(checkbox);

    expect(handleLocationChange).toHaveBeenCalledWith(
      expect.objectContaining({
        address: expect.stringMatching(/hidden for privacy/),
      })
    );
  });
});
