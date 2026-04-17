import { AZIMUTH_MAP, ELEVATION_MAP, DISTANCE_MAP } from '../constants/camera360';

export function snapToNearest(value: number, options: number[]): number {
  return options.reduce((prev, curr) => Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev);
}

export function buildCameraPrompt(azimuth: number, elevation: number, distance: number): string {
  const azSnapped = snapToNearest(azimuth, Object.keys(AZIMUTH_MAP).map(Number));
  const elSnapped = snapToNearest(elevation, Object.keys(ELEVATION_MAP).map(Number));
  const distSnapped = snapToNearest(distance, Object.keys(DISTANCE_MAP).map(Number));

  const azName = AZIMUTH_MAP[azSnapped];
  const elName = ELEVATION_MAP[elSnapped];
  const distName = DISTANCE_MAP[distSnapped];

  return `<sks> ${azName} ${elName} ${distName}`;
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
}
