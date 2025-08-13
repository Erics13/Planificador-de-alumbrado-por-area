

declare global {
  interface Window {
    googleMapsApiLoaded?: boolean;
    jspdf?: any;
    XLSX?: any;
    html2canvas?: (element: HTMLElement, options?: any) => Promise<HTMLCanvasElement>;
  }

  namespace google.maps {
    export class LatLng {
      constructor(lat: number, lng: number);
      constructor(literal: LatLngLiteral);
      lat(): number;
      lng(): number;
      toJSON(): LatLngLiteral;
    }

    export class LatLngBounds {
      constructor(sw?: LatLng | LatLngLiteral, ne?: LatLng | LatLngLiteral);
      extend(point: LatLng | LatLngLiteral): void;
      getCenter(): LatLng;
      getNorthEast(): LatLng;
      getSouthWest(): LatLng;
      isEmpty(): boolean;
      contains(point: LatLng | LatLngLiteral): boolean;
    }

    export interface LatLngLiteral {
      lat: number;
      lng: number;
    }

    export class Map {
      constructor(mapDiv: Element | null, opts?: MapOptions);
      fitBounds(bounds: LatLngBounds, padding?: number | google.maps.Padding): void;
      getZoom(): number;
      setZoom(zoom: number): void;
      getCenter(): LatLng;
      setCenter(latlng: LatLng | LatLngLiteral): void;
      addListener(eventName: string, handler: (...args: any[]) => void): MapsEventListener;
      setOptions(options: MapOptions): void;
    }
    
    export interface MapOptions {
        center?: LatLng | LatLngLiteral;
        zoom?: number;
        mapTypeId?: string;
        streetViewControl?: boolean;
        mapTypeControl?: boolean;
        mapTypeControlOptions?: MapTypeControlOptions;
        zoomControl?: boolean;
        draggableCursor?: string;
        draggingCursor?: string;
    }

    export interface MapTypeControlOptions {
      style?: MapTypeControlStyle;
      position?: ControlPosition;
    }

    export enum MapTypeControlStyle {
        DEFAULT = 0,
        HORIZONTAL_BAR = 1,
        DROPDOWN_MENU = 2,
    }

    export interface Padding {
      bottom: number;
      left: number;
      right: number;
      top: number;
    }

    export class Polygon {
      constructor(opts?: PolygonOptions);
      getPath(): MVCArray<LatLng>;
      setMap(map: Map | null): void;
      setOptions(options: PolygonOptions): void;
    }
    
    export interface PolygonOptions {
        paths?: any; 
        fillColor?: string;
        fillOpacity?: number;
        strokeWeight?: number;
        strokeColor?: string;
        clickable?: boolean;
        editable?: boolean;
        zIndex?: number;
        map?: Map | null;
    }

    export interface RectangleOptions {
        bounds?: LatLngBounds;
        fillColor?: string;
        fillOpacity?: number;
        strokeWeight?: number;
        strokeColor?: string;
        clickable?: boolean;
        editable?: boolean;
        zIndex?: number;
        map?: Map | null;
    }

    export class Rectangle {
      constructor(opts?: RectangleOptions);
      getBounds(): LatLngBounds;
      setMap(map: Map | null): void;
      setOptions(options: RectangleOptions): void;
    }

    export class Polyline {
        constructor(opts?: PolylineOptions);
        setMap(map: Map | null): void;
        setOptions(options: PolylineOptions): void;
        addListener(eventName: string, handler: (...args: any[]) => void): MapsEventListener;
    }

    export interface PolylineOptions {
        path?: any;
        geodesic?: boolean;
        strokeColor?: string;
        strokeOpacity?: number;
        strokeWeight?: number;
        map?: Map | null;
        zIndex?: number;
        clickable?: boolean;
        icons?: any[];
    }
    
    export class Marker {
        constructor(opts?: MarkerOptions);
        setMap(map: Map | null): void;
        setOptions(options: MarkerOptions): void;
        addListener(eventName: string, handler: (...args: any[]) => void): MapsEventListener;
    }
    
    export interface MarkerOptions {
        position: LatLng | LatLngLiteral;
        map?: Map | null;
        icon?: string | Symbol;
        title?: string;
        zIndex?: number;
        draggable?: boolean;
    }

    export interface MapMouseEvent {
      latLng: LatLng;
    }
    
    export interface Symbol {
        path: string | SymbolPath;
        scale?: number;
        fillColor?: string;
        fillOpacity?: number;
        strokeColor?: string;
        strokeWeight?: number;
    }
    
    export enum SymbolPath {
        CIRCLE = 0,
    }
    
    export interface MapsEventListener {
        remove(): void;
    }
    
    export class MVCArray<T> {
        getArray(): T[];
    }
    
    export namespace drawing {
        export class DrawingManager {
            constructor(opts?: DrawingManagerOptions);
            setMap(map: Map | null): void;
            setDrawingMode(drawingMode: OverlayType | null): void;
            getDrawingMode(): OverlayType | null;
            getMap(): Map | null;
        }

        export interface DrawingManagerOptions {
            drawingMode?: OverlayType | null;
            drawingControl?: boolean;
            drawingControlOptions?: DrawingControlOptions;
            polygonOptions?: PolygonOptions;
            rectangleOptions?: RectangleOptions;
        }
        
        export interface DrawingControlOptions {
            position?: ControlPosition;
            drawingModes?: OverlayType[];
        }
        
        export enum OverlayType {
            POLYGON = 'polygon',
            RECTANGLE = 'rectangle',
        }
    }
    
    export enum ControlPosition {
        TOP_CENTER = 3,
        TOP_RIGHT = 5,
    }

    export const event: {
        addListener: (instance: any, eventName: string, handler: (...args: any[]) => void) => MapsEventListener;
        addListenerOnce(instance: any, eventName: string, handler: (...args: any[]) => void): MapsEventListener;
    };
    
    export namespace geometry {
        export const spherical: {
            computeDistanceBetween: (from: LatLng | LatLngLiteral, to: LatLng | LatLngLiteral) => number;
            computeLength: (path: Array<LatLng | LatLngLiteral>) => number;
            interpolate: (from: LatLng | LatLngLiteral, to: LatLng | LatLngLiteral, fraction: number) => LatLng;
            computeHeading: (from: LatLng | LatLngLiteral, to: LatLng | LatLngLiteral) => number;
        };
        export const poly: {
            containsLocation: (point: LatLng | LatLngLiteral, polygon: Polygon) => boolean;
            isLocationOnEdge: (point: LatLng | LatLngLiteral, poly: Polygon | Polyline, tolerance?: number) => boolean;
        };
    }

    export interface Point {
      x: number;
      y: number;
    }

    export interface MapPanes {
      overlayLayer: HTMLElement;
    }

    export interface MapCanvasProjection {
      fromLatLngToDivPixel(latLng: LatLng | LatLngLiteral): Point;
    }
    
    export class OverlayView {
      constructor();
      setMap(map: Map | null): void;
      getPanes(): MapPanes | null;
      getProjection(): MapCanvasProjection;
      onAdd(): void;
      draw(): void;
      onRemove(): void;
    }

    // Geocoding API Types
    export class Geocoder {
      constructor();
      geocode(request: GeocoderRequest, callback: (results: GeocoderResult[], status: GeocoderStatus) => void): void;
      geocode(request: GeocoderRequest): Promise<{results: GeocoderResult[]}>;
    }

    export interface GeocoderRequest {
      location?: LatLng | LatLngLiteral;
      // Other request properties can be added here if needed
    }

    export enum GeocoderStatus {
      OK = 'OK',
      ZERO_RESULTS = 'ZERO_RESULTS',
      // Other statuses
    }

    export interface GeocoderResult {
      address_components: GeocoderAddressComponent[];
      formatted_address: string;
      // Other result properties
    }
    
    export interface GeocoderAddressComponent {
      long_name: string;
      short_name: string;
      types: string[];
    }
  }
}

export enum PoleType {
  Concrete7m = 'Hormigón 7m común (90 kg)',
  Concrete7mReinforced = 'Hormigón 7m reforzada (300 kg)',
  Concrete9m = 'Hormigón 9m',
  Concrete12m = 'Hormigón 12m',
  Metal4m = 'Metálica 4.2m',
  Metal6m = 'Metálica 6m',
  Metal9m = 'Metálica 9m',
}

export type LuminariaLabelType = 'none' | 'potencia' | 'fase' | 'tipoColumna';

export interface Luminaria {
  id: string;
  streetId: string;
  position: google.maps.LatLngLiteral;
  potenciaW: number;
  tipoColumna: PoleType;
  fase: number | null;
  tableroId?: number;
}

export interface Street {
  id: string;
  name: string;
  path: google.maps.LatLngLiteral[];
}

export interface Tablero {
  id: number;
  position: google.maps.LatLngLiteral;
  maxPhaseInfo?: { [phase: number]: { distance: number; path: google.maps.LatLngLiteral[] } };
}

export type ConnectionPathPhase = number | 'mixed' | 'poleType' | null;

export interface ConnectionPath {
  path: google.maps.LatLngLiteral[];
  phase: ConnectionPathPhase;
  tableroId: number;
}

export interface ManualConnection {
  id: string;
  startLumId: string;
  endLumId: string;
}

export interface BoardExportData {
  tablero: Tablero;
  phaseMapCanvas: HTMLCanvasElement;
  powerMapCanvas: HTMLCanvasElement;
  poleTypeMapCanvas: HTMLCanvasElement;
}