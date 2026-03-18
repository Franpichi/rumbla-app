import { latLngToCell, cellToBoundary, gridDisk } from 'h3-js';

import { H3_RESOLUTION } from '@/utils/constants';

// ---------------------------------------------------------------------------
// GPS → H3 index
// ---------------------------------------------------------------------------

export function gpsToHexId(lat: number, lng: number): string {
  return latLngToCell(lat, lng, H3_RESOLUTION);
}

// ---------------------------------------------------------------------------
// H3 index array → GeoJSON FeatureCollection for Mapbox ShapeSource
// ---------------------------------------------------------------------------

export interface HexGeoJSON {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    geometry: {
      type: 'Polygon';
      coordinates: [number[][]];
    };
    properties: { id: string };
  }>;
}

export function hexToGeoJSON(hexIds: string[]): HexGeoJSON {
  return {
    type: 'FeatureCollection',
    features: hexIds.map((id) => ({
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        // cellToBoundary with formatAsGeoJson=true returns [lng, lat] pairs
        coordinates: [cellToBoundary(id, true)],
      },
      properties: { id },
    })),
  };
}

// ---------------------------------------------------------------------------
// Neighbors — k=1 disk returns the hex itself + 6 surrounding hexes (7 total)
// ---------------------------------------------------------------------------

export function getNeighbors(hexId: string): string[] {
  // gridDisk(hexId, 1) returns the hex + its 6 immediate neighbors
  // Filter out the center hex to return only the surrounding ring
  return gridDisk(hexId, 1).filter((id) => id !== hexId);
}
