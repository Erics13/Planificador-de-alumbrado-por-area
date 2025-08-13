import { PoleType } from "./types";

export const PHASE_COLORS: { [key: number]: string } = {
  1: '#16a34a', // green-600
  2: '#f97316', // orange-500
  3: '#2563eb', // blue-600
};

export const POLE_TYPE_COLORS: { [key: string]: string } = {
  [PoleType.Concrete7m]: '#9ca3af', // gray-400
  [PoleType.Concrete7mReinforced]: '#4b5563', // gray-600
  [PoleType.Concrete9m]: '#6b7280', // gray-500
  [PoleType.Concrete12m]: '#374151', // gray-700
  [PoleType.Metal4m]: '#fb923c', // orange-400
  [PoleType.Metal6m]: '#f59e0b', // amber-500
  [PoleType.Metal9m]: '#84cc16', // lime-500
};

export const DEFAULT_LUMINARIA_COLOR = '#ca8a04'; // yellow-600
export const SELECTED_LUMINARIA_COLOR = '#fde047'; // yellow-300
export const BULK_SELECTION_COLOR = '#facc15'; // yellow-400
export const TABLERO_COLOR = '#dc2626'; // red-600
export const POLYGON_FILL_COLOR = '#facc15'; // yellow-400
export const POLYGON_STROKE_COLOR = '#eab308'; // yellow-500

// Street Colors
export const STREET_COLOR_DEFAULT = '#6b7280'; // gray-500
export const STREET_COLOR_MIXED_PHASE = '#000000'; // black