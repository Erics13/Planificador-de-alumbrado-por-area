import React, { useEffect, useRef, memo, forwardRef, useImperativeHandle } from 'react';
import { Luminaria, Street, Tablero, LuminariaLabelType, ConnectionPath, PoleType } from '../types';
import { PHASE_COLORS, DEFAULT_LUMINARIA_COLOR, SELECTED_LUMINARIA_COLOR, TABLERO_COLOR, POLYGON_FILL_COLOR, POLYGON_STROKE_COLOR, STREET_COLOR_DEFAULT, STREET_COLOR_MIXED_PHASE, POLE_TYPE_COLORS, BULK_SELECTION_COLOR } from '../constants';

interface MapContainerProps {
  polygon: google.maps.LatLngLiteral[] | null;
  streets: Street[];
  luminarias: Luminaria[];
  tableros: Tablero[];
  onPolygonComplete: (polygon: google.maps.Polygon) => void;
  onRectangleComplete: (bounds: google.maps.LatLngBounds) => void;
  onLuminariaClick: (luminaria: Luminaria) => void;
  onTableroMove: (position: google.maps.LatLngLiteral, tableroId: number) => void;
  onMapClick: (position: google.maps.LatLngLiteral) => void;
  selectedLuminariaId?: string;
  selectedLuminariaIds: Set<string>;
  luminariaLabelType: LuminariaLabelType;
  colorMode: 'default' | 'poleType';
  connectionPaths: ConnectionPath[];
  onZoomChange: (zoom: number) => void;
  highlightedPath: {tableroId: number; phase: number} | null;
  isProcessing: boolean;
  isConnectingMode: boolean;
  isAddingLuminariaMode: boolean;
  isSelectionMode: boolean;
  connectionStartPointId?: string;
}

export interface MapContainerHandles {
  fitBounds: (bounds: google.maps.LatLngBounds) => void;
  setZoom: (zoom: number) => void;
  setCenter: (center: google.maps.LatLng | google.maps.LatLngLiteral) => void;
  getZoom: () => number | undefined;
  getCenter: () => google.maps.LatLng | undefined;
  waitForIdle: () => Promise<void>;
  clearDrawnPolygon: () => void;
}

const MapContainer = forwardRef<MapContainerHandles, MapContainerProps>(({
  polygon,
  streets,
  luminarias,
  tableros,
  onPolygonComplete,
  onRectangleComplete,
  onLuminariaClick,
  onTableroMove,
  onMapClick,
  selectedLuminariaId,
  selectedLuminariaIds,
  luminariaLabelType,
  colorMode,
  connectionPaths,
  onZoomChange,
  highlightedPath,
  isProcessing,
  isConnectingMode,
  isAddingLuminariaMode,
  isSelectionMode,
  connectionStartPointId,
}, ref) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<google.maps.Map | null>(null);
  const drawingManagerInstance = useRef<google.maps.drawing.DrawingManager | null>(null);
  const drawnPolygonRef = useRef<google.maps.Polygon | null>(null);
  const streetPolylines = useRef<Map<string, google.maps.Polyline>>(new Map());
  const luminariaMarkers = useRef<Map<string, google.maps.Marker>>(new Map());
  const luminariaListeners = useRef<Map<string, google.maps.MapsEventListener>>(new Map());
  const luminariaLabels = useRef<Map<string, any>>(new Map());
  const tableroMarkers = useRef<Map<number, google.maps.Marker>>(new Map());
  const connectionLines = useRef<google.maps.Polyline[]>([]);
  const highlightedPathPolyline = useRef<google.maps.Polyline | null>(null);
  const LuminariaLabelClass = useRef<any>(null);

  // Refs for callbacks to prevent re-initialization of the map for some listeners
  const onPolygonCompleteRef = useRef(onPolygonComplete);
  const onRectangleCompleteRef = useRef(onRectangleComplete);
  const onZoomChangeRef = useRef(onZoomChange);
  const onMapClickRef = useRef(onMapClick);
  const isAddingLuminariaModeRef = useRef(isAddingLuminariaMode);

  useEffect(() => {
    onPolygonCompleteRef.current = onPolygonComplete;
  }, [onPolygonComplete]);
  
  useEffect(() => {
    onRectangleCompleteRef.current = onRectangleComplete;
  }, [onRectangleComplete]);

  useEffect(() => {
    onZoomChangeRef.current = onZoomChange;
  }, [onZoomChange]);

  useEffect(() => {
    onMapClickRef.current = onMapClick;
    isAddingLuminariaModeRef.current = isAddingLuminariaMode;
  }, [onMapClick, isAddingLuminariaMode]);
  
  useImperativeHandle(ref, () => ({
    fitBounds: (bounds: google.maps.LatLngBounds) => {
      if (mapInstance.current && !bounds.isEmpty()) {
        mapInstance.current.fitBounds(bounds, 50);
      }
    },
    setZoom: (zoom: number) => {
      if (mapInstance.current) mapInstance.current.setZoom(zoom);
    },
    setCenter: (center: google.maps.LatLng | google.maps.LatLngLiteral) => {
        if (mapInstance.current) {
            mapInstance.current.setCenter(center);
        }
    },
    getZoom: (): number | undefined => mapInstance.current?.getZoom(),
    getCenter: (): google.maps.LatLng | undefined => mapInstance.current?.getCenter(),
    waitForIdle: (): Promise<void> => {
      return new Promise((resolve) => {
        if (mapInstance.current) {
          google.maps.event.addListenerOnce(mapInstance.current, 'idle', () => resolve());
        } else {
          resolve();
        }
      });
    },
    clearDrawnPolygon: () => {
      if (drawnPolygonRef.current) {
        drawnPolygonRef.current.setMap(null);
        drawnPolygonRef.current = null;
      }
      if (drawingManagerInstance.current && !drawingManagerInstance.current.getDrawingMode()) {
        drawingManagerInstance.current.setDrawingMode(google.maps.drawing.OverlayType.POLYGON);
      }
    },
  }));

  // Initialize map and drawing manager
  useEffect(() => {
    if (!mapRef.current || mapInstance.current || !window.google) return;

    if (!LuminariaLabelClass.current) {
      const VISIBLE_ZOOM_LEVEL = 16;
      LuminariaLabelClass.current = class extends google.maps.OverlayView {
        private position: google.maps.LatLng;
        private text: string;
        private div: HTMLDivElement | null = null;
        private map: google.maps.Map;
        private zoomListener: google.maps.MapsEventListener | null = null;

        constructor(position: google.maps.LatLng, text: string, map: google.maps.Map) {
          super();
          this.position = position;
          this.text = text;
          this.map = map;
          this.setMap(map);
        }
      
        onAdd() {
          const div = document.createElement('div');
          div.style.position = 'absolute';
          div.style.color = 'black';
          div.style.textShadow = '0 0 3px white, 0 0 3px white';
          div.style.fontSize = '12px';
          div.style.fontWeight = 'bold';
          div.style.whiteSpace = 'nowrap';
          div.style.transform = 'translate(8px, -18px)';
          div.style.zIndex = '102'; 
          div.style.pointerEvents = 'none';
          div.innerText = this.text;
          
          this.div = div;
          this.getPanes()?.overlayLayer.appendChild(div);
      
          this.zoomListener = this.map.addListener('zoom_changed', () => this.toggleVisibility());
          this.toggleVisibility();
        }
      
        draw() {
          const overlayProjection = this.getProjection();
          if (!overlayProjection || !this.div) return;
          
          const point = overlayProjection.fromLatLngToDivPixel(this.position);
          if (point) {
            this.div.style.left = `${point.x}px`;
            this.div.style.top = `${point.y}px`;
          }
        }
      
        onRemove() {
          if (this.div && this.div.parentNode) {
            this.div.parentNode.removeChild(this.div);
            this.div = null;
          }
          if (this.zoomListener) {
            this.zoomListener.remove();
            this.zoomListener = null;
          }
        }
        
        private toggleVisibility() {
          if (this.div) {
              const currentZoom = this.map.getZoom();
              if (currentZoom && currentZoom >= VISIBLE_ZOOM_LEVEL) {
                  this.div.style.display = 'block';
              } else {
                  this.div.style.display = 'none';
              }
          }
        }
      }
    }
    
    const map = new google.maps.Map(mapRef.current, {
      center: { lat: -34.8, lng: -56 },
      zoom: 14,
      mapTypeId: 'roadmap',
      streetViewControl: false,
      mapTypeControl: true,
      mapTypeControlOptions: {
        style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
        position: google.maps.ControlPosition.TOP_RIGHT,
      },
      zoomControl: false,
    });
    mapInstance.current = map;

    onZoomChangeRef.current(map.getZoom() || 14);
    const zoomListener = map.addListener('zoom_changed', () => {
        const newZoom = map.getZoom();
        if (newZoom) {
            onZoomChangeRef.current(newZoom);
        }
    });

    const dm = new google.maps.drawing.DrawingManager({
      drawingMode: google.maps.drawing.OverlayType.POLYGON,
      drawingControl: true,
      drawingControlOptions: {
        position: google.maps.ControlPosition.TOP_CENTER,
        drawingModes: [google.maps.drawing.OverlayType.POLYGON, google.maps.drawing.OverlayType.RECTANGLE],
      },
      polygonOptions: {
        fillColor: POLYGON_FILL_COLOR,
        fillOpacity: 0.3,
        strokeWeight: 3,
        strokeColor: POLYGON_STROKE_COLOR,
        clickable: false,
        editable: true,
        zIndex: 1,
      },
      rectangleOptions: {
          fillColor: BULK_SELECTION_COLOR,
          fillOpacity: 0.2,
          strokeWeight: 2,
          strokeColor: BULK_SELECTION_COLOR,
          clickable: false,
          editable: false,
          zIndex: 1,
      }
    });
    dm.setMap(map);
    drawingManagerInstance.current = dm;

    const polyListener = google.maps.event.addListener(dm, 'polygoncomplete', (poly: google.maps.Polygon) => {
      if (dm.getDrawingMode() === google.maps.drawing.OverlayType.POLYGON) {
        dm.setDrawingMode(null);
        poly.setMap(null); 
        onPolygonCompleteRef.current(poly);
      }
    });

    const rectListener = google.maps.event.addListener(dm, 'rectanglecomplete', (rect: google.maps.Rectangle) => {
      const bounds = rect.getBounds();
      if (bounds) {
          onRectangleCompleteRef.current(bounds);
      }
      rect.setMap(null);
      if (dm.getMap()) {
        dm.setDrawingMode(google.maps.drawing.OverlayType.RECTANGLE);
      }
    });

    const mapClickListener = map.addListener('click', (e: google.maps.MapMouseEvent) => {
        if (isAddingLuminariaModeRef.current && e.latLng) {
            onMapClickRef.current(e.latLng.toJSON());
        }
    });

    return () => {
        zoomListener.remove();
        polyListener.remove();
        rectListener.remove();
        mapClickListener.remove();
    };
  }, []);

  // Effect to manage map cursor based on active mode
  useEffect(() => {
    if (mapInstance.current) {
        let cursor = 'grab';
        if (isConnectingMode) cursor = 'crosshair';
        else if (isAddingLuminariaMode) cursor = 'copy';
        else if (isSelectionMode) cursor = 'crosshair';
        
        mapInstance.current.setOptions({
            draggableCursor: cursor,
            draggingCursor: cursor === 'grab' ? 'grabbing' : cursor,
        });
    }
  }, [isConnectingMode, isAddingLuminariaMode, isSelectionMode]);

  // Effect to manage the drawing manager's active mode
  useEffect(() => {
    if (drawingManagerInstance.current) {
        if (isSelectionMode) {
            drawingManagerInstance.current.setDrawingMode(google.maps.drawing.OverlayType.RECTANGLE);
        } else if (drawingManagerInstance.current.getDrawingMode() === google.maps.drawing.OverlayType.RECTANGLE) {
            drawingManagerInstance.current.setDrawingMode(null);
        }
    }
  }, [isSelectionMode]);


  // Effect to manage the polygon's visual state from props
  useEffect(() => {
    if (!mapInstance.current) return;

    if (polygon && polygon.length > 0) {
        if (drawnPolygonRef.current) {
            drawnPolygonRef.current.setMap(null);
        }
        
        drawnPolygonRef.current = new google.maps.Polygon({
            paths: polygon,
            fillColor: POLYGON_FILL_COLOR,
            fillOpacity: 0.2,
            strokeWeight: 2,
            strokeColor: POLYGON_STROKE_COLOR,
            clickable: false,
            editable: false,
            zIndex: 1,
            map: mapInstance.current,
        });

        const bounds = new google.maps.LatLngBounds();
        polygon.forEach(latLng => bounds.extend(latLng));
        mapInstance.current.fitBounds(bounds);

    }
  }, [polygon]);


  // Draw Streets (no interactivity needed anymore)
  useEffect(() => {
     if (!mapInstance.current) return;

    const existingIds = new Set(streets.map(s => s.id));

    streetPolylines.current.forEach((polyline, id) => {
      if (!existingIds.has(id)) {
        polyline.setMap(null);
        streetPolylines.current.delete(id);
      }
    });

    streets.forEach(street => {
      const options = {
        path: street.path,
        strokeColor: STREET_COLOR_DEFAULT,
        strokeOpacity: 0.7,
        strokeWeight: 4,
        clickable: false,
        zIndex: 2,
      };
      
      const existingPolyline = streetPolylines.current.get(street.id);

      if (existingPolyline) {
        existingPolyline.setOptions(options);
      } else {
        const newPolyline = new google.maps.Polyline({ ...options, map: mapInstance.current, geodesic: true });
        streetPolylines.current.set(street.id, newPolyline);
      }
    });
  }, [streets]);


  // Update Luminaria markers
  useEffect(() => {
    if (!mapInstance.current) return;
    const existingLumIds = new Set(luminarias.map(l => l.id));

    luminariaMarkers.current.forEach((marker, id) => {
        if(!existingLumIds.has(id)) {
            luminariaListeners.current.get(id)?.remove();
            luminariaListeners.current.delete(id);
            marker.setMap(null);
            luminariaMarkers.current.delete(id);
        }
    });

    luminarias.forEach(lum => {
      const isSingleSelected = lum.id === selectedLuminariaId;
      const isBulkSelected = selectedLuminariaIds.has(lum.id);
      const isConnectionStart = lum.id === connectionStartPointId;
      const isSelected = isSingleSelected || isBulkSelected || isConnectionStart;
      
      let color = DEFAULT_LUMINARIA_COLOR;
      if (colorMode === 'poleType') {
          color = POLE_TYPE_COLORS[lum.tipoColumna] || DEFAULT_LUMINARIA_COLOR;
      } else if (lum.fase) {
          color = PHASE_COLORS[lum.fase];
      }
      
      let fillColor = color;
      if (isSingleSelected) fillColor = SELECTED_LUMINARIA_COLOR;
      else if (isBulkSelected) fillColor = BULK_SELECTION_COLOR;
      else if (isConnectionStart) fillColor = '#60a5fa';

      const options = {
        position: lum.position,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: isSelected ? 8 : 6,
          fillColor: fillColor,
          fillOpacity: 1,
          strokeColor: 'white',
          strokeWeight: isSelected ? 2.5 : 1.5,
        },
        zIndex: isSelected ? 101 : 100,
      };

      const existingMarker = luminariaMarkers.current.get(lum.id);
      if(existingMarker) {
        existingMarker.setOptions(options);
        luminariaListeners.current.get(lum.id)?.remove();
        const listener = existingMarker.addListener('click', () => onLuminariaClick(lum));
        luminariaListeners.current.set(lum.id, listener);
      } else {
         const newMarker = new google.maps.Marker({
            ...options,
            map: mapInstance.current,
            title: `Luminaria ${lum.id.split('-').pop()}`,
         });
         const listener = newMarker.addListener('click', () => onLuminariaClick(lum));
         luminariaMarkers.current.set(lum.id, newMarker);
         luminariaListeners.current.set(lum.id, listener);
      }
    });
  }, [luminarias, onLuminariaClick, selectedLuminariaId, selectedLuminariaIds, connectionStartPointId, colorMode]);
  
  // Update Tableros
  useEffect(() => {
    if (!mapInstance.current) return;
    const existingIds = new Set(tableros.map(t => t.id));

    tableroMarkers.current.forEach((marker, id) => {
      if (!existingIds.has(id)) {
        marker.setMap(null);
        tableroMarkers.current.delete(id);
      }
    });
    
    tableros.forEach(tablero => {
        const options = {
            position: tablero.position,
            icon: {
                path: 'M -10 -10 L 10 -10 L 10 10 L -10 10 Z', // Square
                scale: 1,
                fillColor: TABLERO_COLOR,
                fillOpacity: 1,
                strokeWeight: 2,
                strokeColor: 'white'
            },
            title: `Tablero ${tablero.id} (Arrastrable)`,
            zIndex: 101,
            draggable: !isProcessing,
        };

        const existingMarker = tableroMarkers.current.get(tablero.id);
        if (existingMarker) {
            existingMarker.setOptions(options);
        } else {
            const newMarker = new google.maps.Marker({
                ...options,
                map: mapInstance.current,
            });
            newMarker.addListener('dragend', (event: google.maps.MapMouseEvent) => {
              if (event.latLng) onTableroMove(event.latLng.toJSON(), tablero.id);
            });
            tableroMarkers.current.set(tablero.id, newMarker);
        }
    });

  }, [tableros, onTableroMove, isProcessing]);

  // Effect to draw connection lines from tablero to circuits
  useEffect(() => {
    connectionLines.current.forEach(p => p.setMap(null));
    connectionLines.current = [];
    if (!mapInstance.current || connectionPaths.length === 0) return;

    connectionPaths.forEach((connection, index) => {
        if (connection.path.length < 2 || connection.phase === null) return;
        
        const color = typeof connection.phase === 'number'
            ? PHASE_COLORS[connection.phase]
            : STREET_COLOR_MIXED_PHASE;

        const line = new google.maps.Polyline({
            path: connection.path,
            geodesic: true,
            strokeColor: color,
            strokeOpacity: 0.8,
            strokeWeight: 5,
            map: mapInstance.current,
            zIndex: 4,
        });
        connectionLines.current.push(line);
    });
  }, [connectionPaths]);
  
  // Effect to draw the highlighted longest path
  useEffect(() => {
    if (highlightedPathPolyline.current) {
        highlightedPathPolyline.current.setMap(null);
        highlightedPathPolyline.current = null;
    }

    if (!mapInstance.current || !highlightedPath) {
        return;
    }

    const { tableroId, phase } = highlightedPath;
    const tablero = tableros.find(t => t.id === tableroId);
    const pathInfo = tablero?.maxPhaseInfo?.[phase];

    if (pathInfo && pathInfo.path.length > 0) {
        const polyline = new google.maps.Polyline({
            path: pathInfo.path,
            geodesic: true,
            strokeColor: '#fde047',
            strokeOpacity: 1.0,
            strokeWeight: 8,
            zIndex: 50,
            map: mapInstance.current,
        });
        highlightedPathPolyline.current = polyline;
    }
  }, [highlightedPath, tableros]);

  // Effect to draw luminaria labels
  useEffect(() => {
    if (!mapInstance.current || !LuminariaLabelClass.current) return;
    
    luminariaLabels.current.forEach(label => label.setMap(null));
    luminariaLabels.current.clear();
    
    if (luminariaLabelType !== 'none') {
        luminarias.forEach(lum => {
            let labelText = '';
            if (luminariaLabelType === 'potencia') {
                labelText = `${lum.potenciaW}`;
            } else if (luminariaLabelType === 'fase' && lum.fase) {
                labelText = `${lum.fase}`;
            } else if (luminariaLabelType === 'tipoColumna') {
                const poleAbbr: { [key in PoleType]?: string } = {
                    [PoleType.Concrete7m]: 'H7',
                    [PoleType.Concrete7mReinforced]: 'H7R',
                    [PoleType.Concrete9m]: 'H9',
                    [PoleType.Concrete12m]: 'H12',
                    [PoleType.Metal4m]: 'M4.2',
                    [PoleType.Metal6m]: 'M6',
                    [PoleType.Metal9m]: 'M9',
                };
                labelText = poleAbbr[lum.tipoColumna] || '';
            }
            
            if (labelText) {
                const label = new LuminariaLabelClass.current(new google.maps.LatLng(lum.position), labelText, mapInstance.current!);
                luminariaLabels.current.set(lum.id, label);
            }
        });
    }
  }, [luminarias, luminariaLabelType]);

  return <div ref={mapRef} className="w-full h-full" />;
});

export default memo(MapContainer);