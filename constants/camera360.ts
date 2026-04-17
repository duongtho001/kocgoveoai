import { Mapping } from '../types';

export const AZIMUTH_MAP: Mapping = {
  "0": "front view",
  "45": "front-right quarter view",
  "90": "right side view",
  "135": "back-right quarter view",
  "180": "back view",
  "225": "back-left quarter view",
  "270": "left side view",
  "315": "front-left quarter view"
};

export const ELEVATION_MAP: Mapping = {
  "0": "worm's eye view",
  "45": "low-angle shot",
  "90": "eye-level shot",
  "135": "high-angle shot",
  "180": "overhead shot"
};

export const DISTANCE_MAP: Mapping = {
  "0.6": "close-up",
  "1.0": "medium shot",
  "1.8": "wide shot",
  "2.5": "extreme wide shot"
};

export const AZIMUTH_STEPS = [0, 45, 90, 135, 180, 225, 270, 315];
export const ELEVATION_STEPS = [0, 45, 90, 135, 180];
export const DISTANCE_STEPS = [0.6, 1.0, 1.8, 2.5];
export const MAX_SEED = 2147483647;
