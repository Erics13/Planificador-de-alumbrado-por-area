

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Luminaria, PoleType, Street, Tablero, LuminariaLabelType, ConnectionPath, ManualConnection } from './types';
import { exportToExcel, exportToPdf, BoardExportData } from './utils/exportUtils';
import ControlsPanel from './components/ControlsPanel';
import MapContainer, { MapContainerHandles } from './components/MapContainer';
import EditPanel from './components/EditPanel';
import BulkEditPanel from './components/BulkEditPanel';
import { PlusIcon, MinusIcon } from './components/Icons';
import { CABLE_TYPES, CABLE_SPECS } from './data/cableData';
import ConfirmLoadModal from './components/ConfirmLoadModal';
import ConfigurePlanModal from './components/ConfigurePlanModal';
import AddLuminariaModal from './components/AddLuminariaModal';


// --- CONSTANTS ---
const MAX_LUMINARIAS_PER_TABLERO = 100;
const MAX_POWER_PER_TABLERO_W = 15000;
const GRAPH_STITCHING_THRESHOLD = 5; // meters. To connect close-by street endpoints.

// Helper class for Dijkstra's algorithm
class PriorityQueue<T> {
  private elements: { item: T; priority: number }[] = [];

  enqueue(item: T, priority: number) {
    this.elements.push({ item, priority });
    this.elements.sort((a, b) => a.priority - b.priority);
  }

  dequeue(): T | undefined {
    return this.elements.shift()?.item;
  }

  isEmpty(): boolean {
    return this.elements.length === 0;
  }
}

// K-Means clustering implementation
function kmeans(points: google.maps.LatLngLiteral[], k: number): number[] {
    if (points.length === 0 || k === 0) return [];

    let centroids = points.slice(0, k).map(p => ({ lat: p.lat, lng: p.lng }));
    
    let assignments = new Array(points.length).fill(0);
    let changed = true;
    let iterations = 0;

    while (changed && iterations < 50) {
        changed = false;
        // Assign points to the nearest centroid
        for (let i = 0; i < points.length; i++) {
            let minDistance = Infinity;
            let closestCentroid = 0;
            for (let j = 0; j < centroids.length; j++) {
                const dist = google.maps.geometry.spherical.computeDistanceBetween(
                    new google.maps.LatLng(points[i]),
                    new google.maps.LatLng(centroids[j])
                );
                if (dist < minDistance) {
                    minDistance = dist;
                    closestCentroid = j;
                }
            }
            if (assignments[i] !== closestCentroid) {
                assignments[i] = closestCentroid;
                changed = true;
            }
        }

        // Update centroids
        const newCentroids = Array.from({ length: k }, () => ({ lat: 0, lng: 0, count: 0 }));
        for (let i = 0; i < points.length; i++) {
            const assignment = assignments[i];
            newCentroids[assignment].lat += points[i].lat;
            newCentroids[assignment].lng += points[i].lng;
            newCentroids[assignment].count++;
        }
        
        for (let j = 0; j < k; j++) {
            if (newCentroids[j].count > 0) {
                centroids[j] = {
                    lat: newCentroids[j].lat / newCentroids[j].count,
                    lng: newCentroids[j].lng / newCentroids[j].count,
                };
            }
        }
        iterations++;
    }
    return assignments;
}

export default function App() {
  const [isApiLoaded, setIsApiLoaded] = useState(window.googleMapsApiLoaded || false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [infoMessage, setInfoMessage] = useState('Dibuja un polígono en el mapa para empezar.');

  const [polygon, setPolygon] = useState<google.maps.LatLngLiteral[] | null>(null);
  const [streets, setStreets] = useState<Street[]>([]);
  const [luminarias, setLuminarias] = useState<Luminaria[]>([]);
  const [tableros, setTableros] = useState<Tablero[]>([]);
  const [distance, setDistance] = useState(30);
  const [luminariaPower, setLuminariaPower] = useState(42);
  const [selectedLuminaria, setSelectedLuminaria] = useState<Luminaria | null>(null);
  const [tableroAddresses, setTableroAddresses] = useState<Map<number, string>>(new Map());
  const [luminariaLabelType, setLuminariaLabelType] = useState<LuminariaLabelType>('none');
  const [connectionPaths, setConnectionPaths] = useState<ConnectionPath[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [currentZoom, setCurrentZoom] = useState<number | undefined>();
  const [hiddenTableros, setHiddenTableros] = useState<Set<number>>(new Set());
  const [hiddenPhases, setHiddenPhases] = useState<Set<number>>(new Set());
  const [highlightedPath, setHighlightedPath] = useState<{tableroId: number; phase: number} | null>(null);
  
  // State for manual connections
  const [isConnectingMode, setIsConnectingMode] = useState(false);
  const [isAddingLuminariaMode, setIsAddingLuminariaMode] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [connectionStartPoint, setConnectionStartPoint] = useState<Luminaria | null>(null);
  const [manualConnections, setManualConnections] = useState<ManualConnection[]>([]);
  const [selectedLuminariaIds, setSelectedLuminariaIds] = useState<Set<string>>(new Set());
  const isCtrlPressedRef = useRef(false);

  // State for flexible plan configuration
  const [showConfigurePlanModal, setShowConfigurePlanModal] = useState(false);
  const [planDataForConfig, setPlanDataForConfig] = useState<{
    luminarias: Luminaria[];
    streets: Street[];
    totalPower: number;
    recommendedTableros: number;
  } | null>(null);
  
  // State for load confirmation modal
  const [fileToLoad, setFileToLoad] = useState<File | null>(null);
  const [exportRenderConfig, setExportRenderConfig] = useState<{
    colorMode: 'default' | 'poleType';
    labelType: LuminariaLabelType;
  } | null>(null);
  
  // State for Add Luminaria Modal
  const [showAddLuminariaModal, setShowAddLuminariaModal] = useState(false);
  const [newLuminariaPosition, setNewLuminariaPosition] = useState<google.maps.LatLngLiteral | null>(null);


  // State for voltage drop calculation
  const [calculationParams, setCalculationParams] = useState({
      cableType: CABLE_TYPES.AL_PRE_2x25,
      voltage: 230,
      powerFactor: 0.95,
  });
  const [voltageDropResults, setVoltageDropResults] = useState<Map<number, { [phase: number]: number }>>(new Map());


  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapComponentRef = useRef<MapContainerHandles>(null);
  const prevManualConnectionsLength = useRef(manualConnections.length);

  const generarCoordenadasLuminariasGeometricamente = useCallback((
    streets: Street[],
    distanceBetweenLuminarias: number,
    potenciaW: number,
  ): Luminaria[] => {
    if (!window.google) {
      console.error("Google Maps API not loaded. Cannot generate luminarias.");
      return [];
    }

    const newLuminarias: Luminaria[] = [];
    let luminariaIdCounter = 0;

    const isTooCloseToExisting = (position: google.maps.LatLngLiteral, existingLums: Luminaria[]): boolean => {
      // Use slightly less than half the desired distance as the minimum threshold
      // to avoid placing luminarias on top of each other at intersections.
      const minThreshold = distanceBetweenLuminarias / 2.1;
      for (const lum of existingLums) {
        const distance = google.maps.geometry.spherical.computeDistanceBetween(
            new google.maps.LatLng(position),
            new google.maps.LatLng(lum.position)
        );
        if (distance < minThreshold) {
            return true;
        }
      }
      return false;
    };
    
    const addLuminaria = (position: google.maps.LatLngLiteral, streetId: string): boolean => {
      // Check proximity before adding
      if (isTooCloseToExisting(position, newLuminarias)) {
        return false;
      }

      newLuminarias.push({
        id: `lum-${streetId}-${luminariaIdCounter++}`,
        streetId: streetId,
        position,
        potenciaW,
        tipoColumna: PoleType.Concrete7m,
        fase: null,
      });
      return true;
    };

    for (const street of streets) {
      if (street.path.length < 2) continue;

      const streetPath = street.path.map(p => new google.maps.LatLng(p.lat, p.lng));
      const totalStreetLength = google.maps.geometry.spherical.computeLength(streetPath);

      if (totalStreetLength < 5) continue;

      let lastLumPositionOnStreet: google.maps.LatLng | null = null;
      
      for (let dist = 0; dist < totalStreetLength; dist += distanceBetweenLuminarias) {
        let traveled = 0;
        for (let i = 0; i < streetPath.length - 1; i++) {
          const p1 = streetPath[i];
          const p2 = streetPath[i + 1];
          const segmentLength = google.maps.geometry.spherical.computeDistanceBetween(p1, p2);

          if (traveled + segmentLength >= dist) {
            const distanceIntoSegment = dist - traveled;
            const fraction = segmentLength > 0 ? distanceIntoSegment / segmentLength : 0;
            const newPosition = google.maps.geometry.spherical.interpolate(p1, p2, fraction);
            
            if (addLuminaria(newPosition.toJSON(), street.id)) {
              lastLumPositionOnStreet = newPosition;
            }
            break;
          }
          traveled += segmentLength;
        }
      }
      
      if (lastLumPositionOnStreet) {
          const endPoint = streetPath[streetPath.length - 1];
          const distFromLastToStreetEnd = google.maps.geometry.spherical.computeDistanceBetween(lastLumPositionOnStreet, endPoint);

          if (distFromLastToStreetEnd > distanceBetweenLuminarias / 2) {
               addLuminaria(endPoint.toJSON(), street.id);
          }
      } else { 
          addLuminaria(streetPath[0].toJSON(), street.id);
      }
    }

    return newLuminarias;
  }, []);

  useEffect(() => {
    if (isApiLoaded) return;
    const handleApiLoad = () => setIsApiLoaded(true);
    window.addEventListener('google-maps-api-loaded', handleApiLoad);
    return () => window.removeEventListener('google-maps-api-loaded', handleApiLoad);
  }, [isApiLoaded]);
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Control' || e.key === 'Meta') { // Meta for Cmd on Mac
            isCtrlPressedRef.current = true;
        }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
        if (e.key === 'Control' || e.key === 'Meta') {
            isCtrlPressedRef.current = false;
        }
    };
    const handleBlur = () => { // Handle window losing focus
        isCtrlPressedRef.current = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    
    return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
        window.removeEventListener('blur', handleBlur);
    };
  }, []);
  
  const handleReset = () => {
    mapComponentRef.current?.clearDrawnPolygon();
    setPolygon(null);
    setStreets([]);
    setLuminarias([]);
    setTableros([]);
    setSelectedLuminaria(null);
    setTableroAddresses(new Map());
    setConnectionPaths([]);
    setIsProcessing(false);
    setShowConfigurePlanModal(false);
    setPlanDataForConfig(null);
    setHiddenTableros(new Set());
    setHiddenPhases(new Set());
    setHighlightedPath(null);
    setIsConnectingMode(false);
    setIsAddingLuminariaMode(false);
    setIsSelectionMode(false);
    setSelectedLuminariaIds(new Set());
    setConnectionStartPoint(null);
    setManualConnections([]);
    setShowAddLuminariaModal(false);
    setNewLuminariaPosition(null);
    setInfoMessage('Proceso reiniciado. Dibuja un polígono nuevo para empezar.');
  };
  
  const updateSummaryInfo = useCallback((updatedLuminarias: Luminaria[], updatedTableros: Tablero[]) => {
    if (updatedLuminarias.length === 0 && updatedTableros.length === 0 && luminarias.length === 0) {
        setInfoMessage('Dibuja un polígono en el mapa para empezar.');
        return;
    }
    
    if (updatedLuminarias.length === 0 && updatedTableros.length > 0) {
        setInfoMessage('Todas las luminarias de los tableros visibles están ocultas. Use el panel de visibilidad para mostrarlas.');
        return;
    }

    let summaryText = `Visible: ${updatedLuminarias.length} lums, ${updatedLuminarias.reduce((s, l) => s + l.potenciaW, 0).toLocaleString('de-DE')} W\n`;
    
    updatedTableros.forEach(tablero => {
        const lumsForTablero = updatedLuminarias.filter(l => l.tableroId === tablero.id);
        const powerForTablero = lumsForTablero.reduce((s, l) => s + l.potenciaW, 0);

        const phaseSummary: { [key in (1|2|3)]: { count: number; power: number } } = {
            1: { count: 0, power: 0 }, 2: { count: 0, power: 0 }, 3: { count: 0, power: 0 },
        };
        lumsForTablero.forEach(lum => {
            if(lum.fase && phaseSummary[lum.fase as 1|2|3]) {
                phaseSummary[lum.fase as 1|2|3].power += lum.potenciaW;
                phaseSummary[lum.fase as 1|2|3].count++;
            }
        });

        summaryText += `\n--- Tablero ${tablero.id} ---\n`;
        summaryText += `Lums: ${lumsForTablero.length}, Potencia: ${powerForTablero.toLocaleString('de-DE')} W\n`;
        summaryText += `F1: ${phaseSummary[1].count} (${phaseSummary[1].power.toLocaleString('de-DE')} W)\n`;
        summaryText += `F2: ${phaseSummary[2].count} (${phaseSummary[2].power.toLocaleString('de-DE')} W)\n`;
        summaryText += `F3: ${phaseSummary[3].count} (${phaseSummary[3].power.toLocaleString('de-DE')} W)\n`;
    });
    
    if (luminarias.length > 0 && !isConnectingMode && !isAddingLuminariaMode) {
       summaryText += `\nPuede arrastrar los tableros para re-planificar.`;
    }
    setInfoMessage(summaryText);
  }, [luminarias.length, isConnectingMode, isAddingLuminariaMode]);

  // UseMemo to create renderable paths from manual connections
  const manualConnectionPaths = useMemo(() => {
    if (manualConnections.length === 0) return [];
    
    const luminariaMap = new Map(luminarias.map(l => [l.id, l]));

    return manualConnections.map(conn => {
        const startLum = luminariaMap.get(conn.startLumId);
        const endLum = luminariaMap.get(conn.endLumId);

        if (!startLum || !endLum) return null;

        return {
            path: [startLum.position, endLum.position],
            phase: startLum.fase,
            tableroId: startLum.tableroId!,
        };
    }).filter(p => p !== null && p.phase !== null && p.tableroId !== undefined) as ConnectionPath[];
  }, [manualConnections, luminarias]);

  // Combine automatic and manual paths for rendering
  const allConnectionPaths = useMemo(() => [...connectionPaths, ...manualConnectionPaths], [connectionPaths, manualConnectionPaths]);
  
  const visibleLuminarias = luminarias.filter(l => !hiddenTableros.has(l.tableroId!) && !hiddenPhases.has(l.fase!));
  const visibleTableros = tableros.filter(t => !hiddenTableros.has(t.id));
  const visibleConnectionPaths = allConnectionPaths.filter(p => 
      !hiddenTableros.has(p.tableroId) &&
      (typeof p.phase !== 'number' || !hiddenPhases.has(p.phase))
  );

  useEffect(() => {
    if (!isConnectingMode && !isAddingLuminariaMode && !showConfigurePlanModal && !showAddLuminariaModal) {
        updateSummaryInfo(visibleLuminarias, visibleTableros);
    }
  }, [luminarias, tableros, hiddenTableros, hiddenPhases, updateSummaryInfo, visibleLuminarias, visibleTableros, isConnectingMode, isAddingLuminariaMode, showConfigurePlanModal, showAddLuminariaModal]);
  
  // Effect to validate manual connections whenever luminarias change
  useEffect(() => {
    if (manualConnections.length === 0) return;
    
    const luminariaMap = new Map(luminarias.map(l => [l.id, l]));

    const validManualConnections = manualConnections.filter(conn => {
        const startLum = luminariaMap.get(conn.startLumId);
        const endLum = luminariaMap.get(conn.endLumId);
        if (!startLum || !endLum) return false; // One was deleted
        if (startLum.tableroId !== endLum.tableroId || startLum.fase !== endLum.fase) return false; // Mismatch
        return true;
    });

    if (validManualConnections.length !== manualConnections.length) {
        setManualConnections(validManualConnections);
    }
  }, [luminarias, manualConnections]);

  const assignPhasesAndRecalculateConnections = useCallback((
      luminariasForTablero: Luminaria[],
      controlTablero: Tablero,
      currentStreets: Street[],
      options: { reassignPhases: boolean } = { reassignPhases: true }
    ): { updatedLuminarias: Luminaria[], newConnectionPaths: ConnectionPath[], maxPhaseInfo: Tablero['maxPhaseInfo'] } => {
      
      const pointToIndex = new Map<string, number>();
      const indexToPoint: google.maps.LatLngLiteral[] = [];
      const adj: { node: number; weight: number }[][] = [];

      const getPointIndex = (p: google.maps.LatLngLiteral) => {
          const key = `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;
          if (!pointToIndex.has(key)) {
              const index = indexToPoint.length;
              pointToIndex.set(key, index);
              indexToPoint.push(p);
              adj.push([]);
          }
          return pointToIndex.get(key)!;
      };

      // Step 1: Build the initial graph from street data and manual connections.
      currentStreets.forEach(street => {
          for (let i = 0; i < street.path.length - 1; i++) {
              const p1 = street.path[i];
              const p2 = street.path[i + 1];
              const p1Index = getPointIndex(p1);
              const p2Index = getPointIndex(p2);
              const dist = google.maps.geometry.spherical.computeDistanceBetween(new google.maps.LatLng(p1), new google.maps.LatLng(p2));
              adj[p1Index].push({ node: p2Index, weight: dist });
              adj[p2Index].push({ node: p1Index, weight: dist });
          }
      });
      
      const luminariaMap = new Map(luminarias.map(l => [l.id, l]));
      manualConnections.forEach(conn => {
        const startLum = luminariaMap.get(conn.startLumId);
        const endLum = luminariaMap.get(conn.endLumId);
        if (startLum && endLum && startLum.tableroId === controlTablero.id) {
            const p1Index = getPointIndex(startLum.position);
            const p2Index = getPointIndex(endLum.position);
            const dist = google.maps.geometry.spherical.computeDistanceBetween(new google.maps.LatLng(startLum.position), new google.maps.LatLng(endLum.position));
            adj[p1Index].push({ node: p2Index, weight: dist });
            adj[p2Index].push({ node: p1Index, weight: dist });
        }
      });
      
      // Step 2: "Stitch" the graph by connecting nearby but disconnected nodes.
      // This is crucial for handling imperfect intersection data from OpenStreetMap.
      const allEdges = new Set<string>();
      const getEdgeKey = (u: number, v: number) => u < v ? `${u}-${v}` : `${v}-${u}`;

      for (let i = 0; i < adj.length; i++) {
          adj[i].forEach(edge => {
              allEdges.add(getEdgeKey(i, edge.node));
          });
      }

      for (let i = 0; i < indexToPoint.length; i++) {
          for (let j = i + 1; j < indexToPoint.length; j++) {
              const edgeKey = getEdgeKey(i, j);
              if (allEdges.has(edgeKey)) continue;

              const p1 = indexToPoint[i];
              const p2 = indexToPoint[j];
              const distance = google.maps.geometry.spherical.computeDistanceBetween(new google.maps.LatLng(p1), new google.maps.LatLng(p2));

              if (distance > 0 && distance < GRAPH_STITCHING_THRESHOLD) {
                  adj[i].push({ node: j, weight: distance });
                  adj[j].push({ node: i, weight: distance });
                  allEdges.add(edgeKey);
              }
          }
      }
      
      if (indexToPoint.length === 0) {
        return { updatedLuminarias: luminariasForTablero, newConnectionPaths: [], maxPhaseInfo: {} };
      }
      
      const findClosestNode = (pos: google.maps.LatLngLiteral) => {
          let closestNodeIndex = -1;
          let minDistance = Infinity;
          indexToPoint.forEach((nodePos, index) => {
              const dist = google.maps.geometry.spherical.computeDistanceBetween(new google.maps.LatLng(pos), new google.maps.LatLng(nodePos));
              if (dist < minDistance) {
                  minDistance = dist;
                  closestNodeIndex = index;
              }
          });
          return closestNodeIndex;
      };
      
      const tableroGraphNodeIndex = findClosestNode(controlTablero.position);
      
      const graphNodeCount = indexToPoint.length;
      const distances = Array(graphNodeCount).fill(Infinity);
      const parents: (number | null)[] = Array(graphNodeCount).fill(null);
      const pq = new PriorityQueue<number>();

      if (tableroGraphNodeIndex !== -1) {
        distances[tableroGraphNodeIndex] = 0;
        pq.enqueue(tableroGraphNodeIndex, 0);
      }

      while (!pq.isEmpty()) {
          const u = pq.dequeue()!;
          adj[u].forEach(({ node: v, weight }) => {
              if (distances[u] + weight < distances[v]) {
                  distances[v] = distances[u] + weight;
                  parents[v] = u;
                  pq.enqueue(v, distances[v]);
              }
          });
      }

      let finalLuminarias = [...luminariasForTablero];
      const phaseLoads: { [phase: number]: number } = { 1: 0, 2: 0, 3: 0 };
      
      if (options.reassignPhases && tableroGraphNodeIndex !== -1 && finalLuminarias.length > 0) {
        // --- TOPOLOGICAL & BALANCED PHASE ASSIGNMENT ---
        const neighborNodes = adj[tableroGraphNodeIndex].map(edge => edge.node);
        const branchToLuminarias = new Map<number, Luminaria[]>();
        neighborNodes.forEach(node => branchToLuminarias.set(node, []));

        finalLuminarias.forEach(lum => {
          const closestNodeIndex = findClosestNode(lum.position);
          if (closestNodeIndex === -1 || closestNodeIndex === tableroGraphNodeIndex || distances[closestNodeIndex] === Infinity) {
            return;
          }

          let pathNode = closestNodeIndex;
          let branchRootNode: number | null = null;
          let safetyCounter = 0;
          
          while (parents[pathNode] !== null && safetyCounter < graphNodeCount) {
            if (parents[pathNode] === tableroGraphNodeIndex) {
              branchRootNode = pathNode;
              break;
            }
            pathNode = parents[pathNode]!;
            safetyCounter++;
          }
          
          if (branchRootNode && branchToLuminarias.has(branchRootNode)) {
            branchToLuminarias.get(branchRootNode)!.push(lum);
          }
        });

        const branchPower = Array.from(branchToLuminarias.entries())
          .map(([branchRootNode, lums]) => ({
            branchRootNode,
            luminarias: lums,
            power: lums.reduce((sum, l) => sum + l.potenciaW, 0)
          }))
          .filter(branch => branch.luminarias.length > 0);
          
        branchPower.sort((a, b) => b.power - a.power);
        
        const lumToPhaseMap = new Map<string, 1 | 2 | 3>();

        branchPower.forEach(branch => {
          const targetPhase = Object.entries(phaseLoads).sort((a, b) => a[1] - b[1])[0][0];
          const phaseNumber = parseInt(targetPhase, 10) as 1 | 2 | 3;
          
          branch.luminarias.forEach(lum => {
            lumToPhaseMap.set(lum.id, phaseNumber);
          });
          
          phaseLoads[phaseNumber] += branch.power;
        });

        finalLuminarias = finalLuminarias.map(lum => ({
          ...lum,
          fase: lumToPhaseMap.get(lum.id) ?? null,
        }));
        
        // --- START: Component-based phase assignment for "islands" ---
        const unassignedLuminarias = finalLuminarias.filter(l => l.fase === null);
        if (unassignedLuminarias.length > 0) {
            const visitedLumsInIslands = new Set<string>();

            unassignedLuminarias.forEach(startLum => {
                if (visitedLumsInIslands.has(startLum.id)) {
                    return;
                }

                // 1. Find the full connected component of nodes for this island
                const componentNodes = new Set<number>();
                const qNodes = [];
                const startNodeIndex = findClosestNode(startLum.position);
                
                if (startNodeIndex !== -1 && distances[startNodeIndex] === Infinity) {
                    qNodes.push(startNodeIndex);
                    componentNodes.add(startNodeIndex);
                } else {
                    visitedLumsInIslands.add(startLum.id);
                    return;
                }
                
                let head = 0;
                while (head < qNodes.length) {
                    const u = qNodes[head++];
                    adj[u].forEach(edge => {
                        if (!componentNodes.has(edge.node)) {
                            componentNodes.add(edge.node);
                            qNodes.push(edge.node);
                        }
                    });
                }
                
                // 2. Identify all unassigned luminarias belonging to this component
                const componentLuminarias = unassignedLuminarias.filter(lum => {
                    if (visitedLumsInIslands.has(lum.id)) return false;
                    const nodeIdx = findClosestNode(lum.position);
                    return nodeIdx !== -1 && componentNodes.has(nodeIdx);
                });
                
                componentLuminarias.forEach(lum => visitedLumsInIslands.add(lum.id));
                if (componentLuminarias.length === 0) return;

                // 3. Assign the entire component to the least-loaded phase
                const componentPower = componentLuminarias.reduce((sum, l) => sum + l.potenciaW, 0);
                const targetPhaseKey = Object.entries(phaseLoads).sort((a, b) => a[1] - b[1])[0][0];
                const targetPhase = parseInt(targetPhaseKey, 10) as 1 | 2 | 3;
                
                componentLuminarias.forEach(lumToUpdate => {
                    const lumInFinalList = finalLuminarias.find(l => l.id === lumToUpdate.id);
                    if (lumInFinalList) {
                        lumInFinalList.fase = targetPhase;
                    }
                });
                
                phaseLoads[targetPhase] += componentPower;
            });
        }
        // --- END: Component-based phase assignment ---

        // --- START: Final cleanup for luminarias at the tablero's node ---
        const remainingUnassignedLums = finalLuminarias.filter(l => l.fase === null);
        if (remainingUnassignedLums.length > 0) {
            remainingUnassignedLums.forEach(lumToFix => {
                const closestNodeToLum = findClosestNode(lumToFix.position);
                if (closestNodeToLum === tableroGraphNodeIndex) {
                    const targetPhaseKey = Object.entries(phaseLoads).sort((a, b) => a[1] - b[1])[0][0];
                    const targetPhase = parseInt(targetPhaseKey, 10) as 1 | 2 | 3;

                    const originalLumIndex = finalLuminarias.findIndex(l => l.id === lumToFix.id);
                    if (originalLumIndex !== -1) {
                        finalLuminarias[originalLumIndex].fase = targetPhase;
                        phaseLoads[targetPhase] += finalLuminarias[originalLumIndex].potenciaW;
                    }
                }
            });
        }
        // --- END: Final cleanup ---
      }
      
      const newConnectionPaths: ConnectionPath[] = [];

      // Ensure we have a valid graph and tablero to work with.
      if (tableroGraphNodeIndex !== -1) {
        const edgeToPhases = new Map<string, Set<number>>();
        const getEdgeKey = (u: number, v: number) => u < v ? `${u}-${v}` : `${v}-${u}`;

        finalLuminarias.forEach(lum => {
          if (!lum.fase) return;

          let currentNodeIndex = findClosestNode(lum.position);

          if (currentNodeIndex === -1 || distances[currentNodeIndex] === Infinity) return;

          let safetyCounter = 0;
          while (parents[currentNodeIndex] !== null && safetyCounter < graphNodeCount) {
            const parentNodeIndex = parents[currentNodeIndex]!;
            const edgeKey = getEdgeKey(currentNodeIndex, parentNodeIndex);

            if (!edgeToPhases.has(edgeKey)) {
              edgeToPhases.set(edgeKey, new Set());
            }
            edgeToPhases.get(edgeKey)!.add(lum.fase);

            currentNodeIndex = parentNodeIndex;
            safetyCounter++;
          }
        });

        edgeToPhases.forEach((phases, edgeKey) => {
          const [uStr, vStr] = edgeKey.split('-');
          const u = parseInt(uStr, 10);
          const v = parseInt(vStr, 10);

          let phase: ConnectionPath['phase'] = null;
          if (phases.size === 1) {
            phase = phases.values().next().value;
          } else if (phases.size > 1) {
            phase = 'mixed';
          }

          if (phase !== null) {
            newConnectionPaths.push({
              path: [indexToPoint[u], indexToPoint[v]],
              phase,
              tableroId: controlTablero.id,
            });
          }
        });
      }

      // --- START: Connect "Island" Luminarias ---
      const islandLuminarias = finalLuminarias.filter(lum => {
        const closestNode = findClosestNode(lum.position);
        return closestNode !== -1 && distances[closestNode] === Infinity && lum.fase !== null;
      });

      const visitedIslandLums = new Set<string>();

      islandLuminarias.forEach(startLum => {
          if (visitedIslandLums.has(startLum.id)) {
              return;
          }
          
          const startNodeIndex = findClosestNode(startLum.position);
          if (startNodeIndex === -1) return;

          const componentNodes = new Set<number>();
          const q: number[] = [startNodeIndex];
          const visitedNodesInComponent = new Set<number>([startNodeIndex]);
          
          let head = 0;
          while (head < q.length) {
              const u = q[head++];
              componentNodes.add(u);
              
              adj[u].forEach(edge => {
                  if (!visitedNodesInComponent.has(edge.node)) {
                      visitedNodesInComponent.add(edge.node);
                      q.push(edge.node);
                  }
              });
          }

          const componentLuminarias = islandLuminarias.filter(l => {
              const nodeIdx = findClosestNode(l.position);
              return nodeIdx !== -1 && componentNodes.has(nodeIdx);
          });

          componentLuminarias.forEach(l => visitedIslandLums.add(l.id));
          if (componentLuminarias.length === 0) return;
          
          const islandPhase = componentLuminarias[0].fase;

          componentNodes.forEach(u => {
              adj[u].forEach(edge => {
                  const v = edge.node;
                  if (u < v && componentNodes.has(v)) {
                      newConnectionPaths.push({
                          path: [indexToPoint[u], indexToPoint[v]],
                          phase: islandPhase,
                          tableroId: controlTablero.id,
                      });
                  }
              });
          });
      });
      // --- END: Connect "Island" Luminarias ---

      const maxPhaseInfo: { [phase: number]: { distance: number; path: google.maps.LatLngLiteral[] } } = {
        1: { distance: 0, path: [] },
        2: { distance: 0, path: [] },
        3: { distance: 0, path: [] },
      };

      if (tableroGraphNodeIndex !== -1) {
          finalLuminarias.forEach(lum => {
              if (lum.fase) {
                  const closestNodeIndexToLum = findClosestNode(lum.position);
                  if (closestNodeIndexToLum !== -1 && distances[closestNodeIndexToLum] !== Infinity) {
                      const distanceToLum = distances[closestNodeIndexToLum];
                      if (distanceToLum > maxPhaseInfo[lum.fase].distance) {
                          maxPhaseInfo[lum.fase].distance = distanceToLum;
                          
                          const path: google.maps.LatLngLiteral[] = [];
                          let currentNodeIndex: number | null = closestNodeIndexToLum;
                          let safety = 0;
                          while(currentNodeIndex !== null && currentNodeIndex !== tableroGraphNodeIndex && safety < graphNodeCount) {
                              path.push(indexToPoint[currentNodeIndex]);
                              currentNodeIndex = parents[currentNodeIndex];
                              safety++;
                          }
                          if (currentNodeIndex === tableroGraphNodeIndex) {
                               path.push(indexToPoint[tableroGraphNodeIndex]);
                          }
                          maxPhaseInfo[lum.fase].path = path.reverse();
                      }
                  }
              }
          });
      }

      return { updatedLuminarias: finalLuminarias, newConnectionPaths, maxPhaseInfo };
  }, [luminarias, manualConnections]);

  // Effect to recalculate pathing when a manual connection is added.
  useEffect(() => {
      if (manualConnections.length > prevManualConnectionsLength.current) {
          const newConnection = manualConnections[manualConnections.length - 1];
          
          const luminariaMap = new Map(luminarias.map(l => [l.id, l]));
          const startLum = luminariaMap.get(newConnection.startLumId);
          
          if (startLum?.tableroId) {
              const tableroIdToUpdate = startLum.tableroId;

              setTableros(currentTableros => {
                  const tableroToUpdate = currentTableros.find(t => t.id === tableroIdToUpdate);
                  if (!tableroToUpdate || streets.length === 0) {
                      return currentTableros; // No change
                  }

                  const luminariasForTablero = luminarias.filter(l => l.tableroId === tableroIdToUpdate);
                  
                  const { newConnectionPaths, maxPhaseInfo } = assignPhasesAndRecalculateConnections(
                      luminariasForTablero,
                      tableroToUpdate,
                      streets,
                      { reassignPhases: false }
                  );
                  
                  setConnectionPaths(currentPaths => [
                      ...currentPaths.filter(p => p.tableroId !== tableroIdToUpdate),
                      ...newConnectionPaths
                  ]);

                  return currentTableros.map(t => 
                      t.id === tableroIdToUpdate ? { ...tableroToUpdate, maxPhaseInfo } : t
                  );
              });
          }
      }
      prevManualConnectionsLength.current = manualConnections.length;
  }, [manualConnections, luminarias, streets, assignPhasesAndRecalculateConnections]);


  const replanFromTableros = useCallback((
    luminariasToPlan: Luminaria[],
    currentTableros: Tablero[],
    streetsForPlan: Street[]
  ) => {
    if (currentTableros.length === 0 || luminariasToPlan.length === 0 || streetsForPlan.length === 0) return;
    
    setIsProcessing(true);
    setInfoMessage("Re-planificando...");

    // Use a timeout to allow the UI to update with "processing" message
    setTimeout(() => {
        // 1. Re-assign each luminaria to its nearest tablero.
        const luminariasWithNewAssignments = luminariasToPlan.map(lum => {
          let closestTableroId: number = -1;
          let minDistance = Infinity;
          currentTableros.forEach(tablero => {
            const distance = google.maps.geometry.spherical.computeDistanceBetween(
              new google.maps.LatLng(lum.position),
              new google.maps.LatLng(tablero.position)
            );
            if (distance < minDistance) {
              minDistance = distance;
              closestTableroId = tablero.id;
            }
          });
          return { ...lum, tableroId: closestTableroId };
        });

        let finalLuminarias: Luminaria[] = [];
        const finalTableros: Tablero[] = [];
        let allConnectionPaths: ConnectionPath[] = [];

        // 2. For each tablero, recalculate phases and connections for its assigned luminarias.
        currentTableros.forEach(tablero => {
          const luminariasForThisTablero = luminariasWithNewAssignments.filter(l => l.tableroId === tablero.id);
          
          if (luminariasForThisTablero.length > 0) {
            const { updatedLuminarias, newConnectionPaths, maxPhaseInfo } = assignPhasesAndRecalculateConnections(
              luminariasForThisTablero, tablero, streetsForPlan
            );
            finalLuminarias.push(...updatedLuminarias);
            allConnectionPaths.push(...newConnectionPaths);
            finalTableros.push({ ...tablero, maxPhaseInfo });
          } else {
            // Tablero has no luminarias, just add it back to the list with empty info.
            finalTableros.push({ ...tablero, maxPhaseInfo: {} });
          }
        });

        // 3. Update all states at once.
        setTableros(finalTableros);
        setLuminarias(finalLuminarias);
        setConnectionPaths(allConnectionPaths);
        setSelectedLuminaria(null);
        setSelectedLuminariaIds(new Set());
        setHighlightedPath(null);
        setIsProcessing(false);
    }, 50);
  }, [assignPhasesAndRecalculateConnections]);

  const setupPlan = useCallback((
    luminariasToPlan: Luminaria[],
    streetsForPlan: Street[],
    numTableros: number
  ) => {
    setInfoMessage(`Configurando plan con ${numTableros} tablero(s)...`);
    
    // --- START: Intelligent Tablero Placement Logic ---

    // 1. Build a simple graph to find intersection degrees.
    const pointToDegree = new Map<string, number>();
    const keyToPoint = new Map<string, google.maps.LatLngLiteral>();
    const getKey = (p: google.maps.LatLngLiteral) => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;

    streetsForPlan.forEach(street => {
        street.path.forEach(point => {
            const key = getKey(point);
            if (!keyToPoint.has(key)) {
                keyToPoint.set(key, point);
                pointToDegree.set(key, 0);
            }
        });
        for (let i = 0; i < street.path.length - 1; i++) {
            const key1 = getKey(street.path[i]);
            const key2 = getKey(street.path[i+1]);
            // A simple way to count connections: count how many times a point appears as an endpoint of a segment
            pointToDegree.set(key1, (pointToDegree.get(key1) || 0) + 1);
            pointToDegree.set(key2, (pointToDegree.get(key2) || 0) + 1);
        }
    });

    const tIntersections: google.maps.LatLngLiteral[] = [];
    const otherIntersections: google.maps.LatLngLiteral[] = [];

    pointToDegree.forEach((degree, key) => {
        const point = keyToPoint.get(key);
        if (point) {
            if (degree === 3) { // T-Junctions
                tIntersections.push(point);
            } else if (degree > 1) { // Other intersections (corners, crosses)
                otherIntersections.push(point);
            }
        }
    });
    
    // --- END: Intelligent Tablero Placement Logic ---
    
    let finalLuminarias: Luminaria[] = [];
    const newTableros: Tablero[] = [];
    let allConnectionPaths: ConnectionPath[] = [];

    const luminariaPositions = luminariasToPlan.map(l => l.position);
    const assignments = numTableros > 1 ? kmeans(luminariaPositions, numTableros) : luminariasToPlan.map(() => 0);

    for (let i = 0; i < numTableros; i++) {
        const tableroId = i + 1;
        const luminariasInCluster = luminariasToPlan.filter((_, index) => assignments[index] === i);
        
        if (luminariasInCluster.length === 0) continue;

        const totalLat = luminariasInCluster.reduce((sum, lum) => sum + lum.position.lat, 0);
        const totalLng = luminariasInCluster.reduce((sum, lum) => sum + lum.position.lng, 0);
        const centerOfLuminarias = new google.maps.LatLng(totalLat / luminariasInCluster.length, totalLng / luminariasInCluster.length);

        let closestPoint: google.maps.LatLngLiteral | null = null;
        
        // --- START: Find best position ---
        const findClosest = (center: google.maps.LatLng, points: google.maps.LatLngLiteral[]) => {
            let bestPoint: google.maps.LatLngLiteral | null = null;
            let minDistance = Infinity;
            points.forEach(point => {
                const dist = google.maps.geometry.spherical.computeDistanceBetween(center, new google.maps.LatLng(point));
                if (dist < minDistance) {
                    minDistance = dist;
                    bestPoint = point;
                }
            });
            return bestPoint;
        };
        
        // Priority 1: Find the closest T-intersection
        closestPoint = findClosest(centerOfLuminarias, tIntersections);

        // Priority 2: If no T-intersection, find any other intersection
        if (!closestPoint) {
            closestPoint = findClosest(centerOfLuminarias, otherIntersections);
        }

        // Priority 3: Fallback to original method if no intersections found
        if (!closestPoint) {
            let minDistance = Infinity;
            streetsForPlan.forEach(street => street.path.forEach(point => {
                const dist = google.maps.geometry.spherical.computeDistanceBetween(centerOfLuminarias, new google.maps.LatLng(point));
                if (dist < minDistance) {
                    minDistance = dist;
                    closestPoint = point;
                }
            }));
        }
        // --- END: Find best position ---

        if (closestPoint) {
            const tempTablero = { id: tableroId, position: closestPoint };
            const luminariasWithTableroId = luminariasInCluster.map(l => ({ ...l, tableroId }));
            
            const { updatedLuminarias, newConnectionPaths, maxPhaseInfo } = assignPhasesAndRecalculateConnections(
                luminariasWithTableroId, tempTablero, streetsForPlan
            );
            
            const newTablero = { ...tempTablero, maxPhaseInfo };
            newTableros.push(newTablero);
            
            finalLuminarias.push(...updatedLuminarias);
            allConnectionPaths.push(...newConnectionPaths);
        }
    }
    
    setLuminarias(finalLuminarias);
    setTableros(newTableros);
    setConnectionPaths(allConnectionPaths);
  }, [assignPhasesAndRecalculateConnections]);

  const handlePolygonComplete = useCallback(async (newPolygon: google.maps.Polygon) => {
    const path = newPolygon.getPath().getArray().map(latLng => latLng.toJSON());
    
    // Manually reset relevant states before starting a new plan
    setStreets([]);
    setLuminarias([]);
    setTableros([]);
    setSelectedLuminaria(null);
    setTableroAddresses(new Map());
    setConnectionPaths([]);
    setShowConfigurePlanModal(false);
    setPlanDataForConfig(null);
    setHiddenTableros(new Set());
    setHiddenPhases(new Set());
    setHighlightedPath(null);
    setIsConnectingMode(false);
    setConnectionStartPoint(null);
    setManualConnections([]);

    setPolygon(path);
    setIsProcessing(true);
    setInfoMessage('Buscando calles...');
    
    const query = `
      [out:json][timeout:25];
      ( way["highway"~"primary|secondary|tertiary|residential|unclassified|living_street|service|pedestrian|track|road|path"](poly:"${path.map(p => `${p.lat} ${p.lng}`).join(" ")}"); );
      out geom;
    `.trim();

    try {
        const response = await fetch("https://z.overpass-api.de/api/interpreter", {
            method: "POST",
            body: `data=${encodeURIComponent(query)}`,
        });
        if (!response.ok) throw new Error(`Error en Overpass: ${response.statusText}`);

        const data = await response.json();
        const googlePolygon = new google.maps.Polygon({ paths: path });
        const ways = data.elements.filter((el: any) => el.type === 'way' && el.geometry?.length > 1);
        const foundStreets: Street[] = [];
        let streetIdCounter = 0;

        ways.forEach((way: any) => {
            const streetName = way.tags?.name || 'Calle sin nombre';
            let currentPath: google.maps.LatLngLiteral[] = [];
            
            way.geometry.forEach((point: any) => {
                const latLng = new google.maps.LatLng(point.lat, point.lon);
                const isInside = google.maps.geometry.poly.containsLocation(latLng, googlePolygon);
                // Aumentamos la tolerancia. 0.0002 grados son ~22 metros, para compensar mejor la vista de satélite.
                const isOnEdge = google.maps.geometry.poly.isLocationOnEdge(latLng, googlePolygon, 0.0002);

                if (isInside || isOnEdge) {
                    currentPath.push({ lat: point.lat, lng: point.lon });
                } else {
                    if (currentPath.length > 1) {
                        foundStreets.push({ id: `street-${way.id}-${streetIdCounter++}`, name: streetName, path: currentPath });
                    }
                    currentPath = [];
                }
            });
            if (currentPath.length > 1) {
                foundStreets.push({ id: `street-${way.id}-${streetIdCounter++}`, name: streetName, path: currentPath });
            }
        });
        setStreets(foundStreets);

        if (foundStreets.length > 0) {
            setInfoMessage('Generando luminarias...');
            const newLuminarias = generarCoordenadasLuminariasGeometricamente(foundStreets, distance, luminariaPower);
            const totalPower = newLuminarias.reduce((sum, lum) => sum + lum.potenciaW, 0);

            if (newLuminarias.length > 0) {
              const recommendedByLuminarias = Math.ceil(newLuminarias.length / MAX_LUMINARIAS_PER_TABLERO);
              const recommendedByPower = Math.ceil(totalPower / MAX_POWER_PER_TABLERO_W);
              const recommendedTableros = Math.max(1, recommendedByLuminarias, recommendedByPower);

              setPlanDataForConfig({
                  luminarias: newLuminarias,
                  streets: foundStreets,
                  totalPower,
                  recommendedTableros,
              });
              setShowConfigurePlanModal(true);
              setInfoMessage('Análisis completado. Por favor, configure el plan.');
            } else {
                setInfoMessage('No se pudieron generar luminarias. El área puede ser muy pequeña.');
            }
        } else {
            setInfoMessage('No se encontraron calles. Intenta con un polígono diferente.');
        }

    } catch (error) {
        console.error("Error en el proceso:", error);
        const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
        setInfoMessage(`Error al buscar calles: ${errorMessage}. Revisa la conexión o prueba un área diferente.`);
    } finally {
        setIsProcessing(false);
    }
  }, [distance, luminariaPower, generarCoordenadasLuminariasGeometricamente, setupPlan]);

  const handleConfirmPlanConfiguration = useCallback((numTableros: number) => {
    if (!planDataForConfig) return;
    setIsProcessing(true);
    setTimeout(() => {
        setupPlan(planDataForConfig.luminarias, planDataForConfig.streets, numTableros);
        setShowConfigurePlanModal(false);
        setPlanDataForConfig(null);
        setIsProcessing(false);
    }, 50);
  }, [planDataForConfig, setupPlan]);

  const handleCancelPlanConfiguration = () => {
    setShowConfigurePlanModal(false);
    setPlanDataForConfig(null);
    handleReset();
    setInfoMessage('Configuración cancelada. Dibuja un polígono para empezar de nuevo.');
  };

  useEffect(() => {
    if (tableros.length > 0 && isApiLoaded) {
      const geocoder = new google.maps.Geocoder();
      const newAddresses = new Map<number, string>();
      let fetchedCount = 0;

      tableros.forEach(tablero => {
          geocoder.geocode({ location: tablero.position })
            .then(({ results }) => {
              if (results && results[0]) {
                newAddresses.set(tablero.id, results[0].formatted_address);
              } else {
                newAddresses.set(tablero.id, 'Dirección no encontrada');
              }
            })
            .catch(e => {
              console.error(`Geocoder failed for tablero ${tablero.id}:`, e);
              newAddresses.set(tablero.id, 'Error de geocodificación');
            })
            .finally(() => {
              fetchedCount++;
              if (fetchedCount === tableros.length) {
                setTableroAddresses(newAddresses);
              }
            });
      });
    } else if (tableros.length === 0) {
      setTableroAddresses(new Map());
    }
  }, [tableros, isApiLoaded]);

  // Effect to calculate voltage drop
  useEffect(() => {
    if (tableros.length === 0 || luminarias.length === 0) {
        setVoltageDropResults(new Map());
        return;
    }

    const newResults = new Map<number, { [phase: number]: number }>();
    const { cableType, voltage, powerFactor } = calculationParams;
    
    // Find the key in CABLE_TYPES that matches the value `cableType`
    const cableTypeKey = Object.keys(CABLE_TYPES).find(key => CABLE_TYPES[key as keyof typeof CABLE_TYPES] === cableType);
    const cableSpec = cableTypeKey ? CABLE_SPECS[cableType] : null;

    if (!cableSpec || voltage <= 0 || powerFactor <= 0 || powerFactor > 1) {
        return; // Invalid params
    }

    const r_per_m = cableSpec.r / 1000;
    const x_per_m = cableSpec.x / 1000;
    const sinPhi = Math.sin(Math.acos(powerFactor));

    tableros.forEach(tablero => {
        const phaseData: { [phase: number]: number } = {};
        const lumsForTablero = luminarias.filter(l => l.tableroId === tablero.id);
        
        for (let phase = 1; phase <= 3; phase++) {
            const distance = tablero.maxPhaseInfo?.[phase]?.distance ?? 0;
            if (distance === 0) {
                phaseData[phase] = 0;
                continue;
            }

            const lumsOnPhase = lumsForTablero.filter(l => l.fase === phase);
            const totalPowerOnPhase = lumsOnPhase.reduce((sum, lum) => sum + lum.potenciaW, 0);

            if (totalPowerOnPhase === 0) {
                phaseData[phase] = 0;
                continue;
            }

            const current = totalPowerOnPhase / (voltage * powerFactor);
            
            // Formula for single-phase voltage drop in Volts. Factor 2 is for there-and-back path.
            const voltageDropV = 2 * distance * current * (r_per_m * powerFactor + x_per_m * sinPhi);
            const voltageDropPercent = (voltageDropV / voltage) * 100;

            phaseData[phase] = voltageDropPercent;
        }
        newResults.set(tablero.id, phaseData);
    });
    
    setVoltageDropResults(newResults);

  }, [luminarias, tableros, calculationParams]);

  const handleTableroMove = useCallback((position: google.maps.LatLngLiteral, tableroId: number) => {
    if (isProcessing) return;
    if (!streets || streets.length === 0 || luminarias.length === 0) return;
    
    const updatedTableros = tableros.map(t => 
      t.id === tableroId ? { ...t, position } : t
    );
    
    replanFromTableros(luminarias, updatedTableros, streets);
  }, [streets, luminarias, tableros, replanFromTableros, isProcessing]);
  
  const handleUpdateLuminaria = (updatedLuminaria: Luminaria) => {
    const newLuminarias = luminarias.map(lum =>
      lum.id === updatedLuminaria.id ? updatedLuminaria : lum
    );
    
    const tableroIdToUpdate = updatedLuminaria.tableroId;
    if (tableroIdToUpdate && tableros.length > 0 && streets.length > 0) {
        const tableroToUpdate = tableros.find(t => t.id === tableroIdToUpdate);
        if (tableroToUpdate) {
            const luminariasForTablero = newLuminarias.filter(l => l.tableroId === tableroIdToUpdate);
            const { updatedLuminarias: recalculatedLuminarias, newConnectionPaths, maxPhaseInfo } = assignPhasesAndRecalculateConnections(
              luminariasForTablero, tableroToUpdate, streets, { reassignPhases: false }
            );
            
            const updatedTableros = tableros.map(t => 
                t.id === tableroIdToUpdate ? { ...t, maxPhaseInfo } : t
            );
            setTableros(updatedTableros);

            const otherLuminarias = newLuminarias.filter(l => l.tableroId !== tableroIdToUpdate);
            const otherConnections = connectionPaths.filter(p => p.tableroId !== tableroIdToUpdate);
            
            setLuminarias([...otherLuminarias, ...recalculatedLuminarias]);
            setConnectionPaths([...otherConnections, ...newConnectionPaths]);
        }
    } else {
        setLuminarias(newLuminarias);
    }
    
    setSelectedLuminaria(null);
  };

  const handleDeleteLuminaria = (id: string) => {
    const lumToDelete = luminarias.find(l => l.id === id);
    if (!lumToDelete) return;

    const newLuminarias = luminarias.filter(lum => lum.id !== id);
    setSelectedLuminaria(null);
    
    if (newLuminarias.length === 0) {
      handleReset();
      setInfoMessage('Todas las luminarias han sido eliminadas.');
      return;
    }

    const tableroIdToUpdate = lumToDelete.tableroId;
    if (tableroIdToUpdate && tableros.length > 0 && streets.length > 0) {
       const tableroToUpdate = tableros.find(t => t.id === tableroIdToUpdate);
       if (tableroToUpdate) {
            const luminariasForTablero = newLuminarias.filter(l => l.tableroId === tableroIdToUpdate);
            if (luminariasForTablero.length > 0) {
                const { updatedLuminarias, newConnectionPaths, maxPhaseInfo } = assignPhasesAndRecalculateConnections(
                  luminariasForTablero, tableroToUpdate, streets, { reassignPhases: false }
                );

                const updatedTableros = tableros.map(t => 
                    t.id === tableroIdToUpdate ? { ...t, maxPhaseInfo } : t
                );
                setTableros(updatedTableros);

                const otherLuminarias = newLuminarias.filter(l => l.tableroId !== tableroIdToUpdate);
                const otherConnections = connectionPaths.filter(p => p.tableroId !== tableroIdToUpdate);
                setLuminarias([...otherLuminarias, ...updatedLuminarias]);
                setConnectionPaths([...otherConnections, ...newConnectionPaths]);
            } else {
                // Last luminaria of a tablero was deleted. Remove the tablero.
                setTableros(tableros.filter(t => t.id !== tableroIdToUpdate));
                setLuminarias(newLuminarias); // Already filtered
                setConnectionPaths(connectionPaths.filter(p => p.tableroId !== tableroIdToUpdate));
            }
       }
    }
  };
  
  const handleToggleConnectMode = () => {
    setIsConnectingMode(prev => {
        const nextState = !prev;
        if (nextState) {
            setIsAddingLuminariaMode(false);
            setIsSelectionMode(false);
            setSelectedLuminariaIds(new Set());
            setInfoMessage('Modo conexión: Haz clic en la primera luminaria para empezar.');
            setSelectedLuminaria(null);
        } else {
            updateSummaryInfo(visibleLuminarias, visibleTableros);
        }
        setConnectionStartPoint(null);
        return nextState;
    });
  };
  
  const handleToggleAddLuminariaMode = () => {
    setIsAddingLuminariaMode(prev => {
        const nextState = !prev;
        if (nextState) {
            setIsConnectingMode(false);
            setIsSelectionMode(false);
            setSelectedLuminariaIds(new Set());
            setInfoMessage('Modo añadir: Haz clic en el mapa para colocar una luminaria.');
            setSelectedLuminaria(null);
        } else {
            updateSummaryInfo(visibleLuminarias, visibleTableros);
        }
        return nextState;
    });
  };

  const handleToggleSelectionMode = () => {
    setIsSelectionMode(prev => {
        const nextState = !prev;
        if (nextState) {
            setIsConnectingMode(false);
            setIsAddingLuminariaMode(false);
            setInfoMessage('Modo selección: Dibuja un rectángulo para seleccionar. Mantén Ctrl/Cmd para añadir a la selección.');
            setSelectedLuminaria(null);
            // Clear selection when entering the mode to start fresh
            if (selectedLuminariaIds.size > 0) {
                setSelectedLuminariaIds(new Set());
            }
        } else {
            updateSummaryInfo(visibleLuminarias, visibleTableros);
            setSelectedLuminariaIds(new Set());
        }
        return nextState;
    });
  };
  
  const handleAddLuminaria = (position: google.maps.LatLngLiteral) => {
    if (streets.length === 0 || tableros.length === 0) {
        setInfoMessage("Debe existir un plan antes de añadir luminarias.");
        return;
    }
    setNewLuminariaPosition(position);
    setShowAddLuminariaModal(true);
  };

  const handleConfirmAddLuminaria = (details: { potenciaW: number; tipoColumna: PoleType; fase: number; tableroId: number; }) => {
    if (!newLuminariaPosition) return;

    const { potenciaW, tipoColumna, fase, tableroId } = details;
    
    let nearestStreetId: string = 'manual';
    if (streets.length > 0 && window.google) {
        let minDistanceToStreet = Infinity;
        streets.forEach(street => {
            street.path.forEach(point => {
                const dist = google.maps.geometry.spherical.computeDistanceBetween(newLuminariaPosition, point);
                if (dist < minDistanceToStreet) {
                    minDistanceToStreet = dist;
                    nearestStreetId = street.id;
                }
            });
        });
    }

    const newLum: Luminaria = {
        id: `manual-${Date.now()}`,
        position: newLuminariaPosition,
        potenciaW,
        tipoColumna,
        streetId: nearestStreetId,
        tableroId,
        fase,
    };

    const newLuminarias = [...luminarias, newLum];
    const tableroToUpdate = tableros.find(t => t.id === tableroId);

    if (tableroToUpdate) {
        const luminariasForTablero = newLuminarias.filter(l => l.tableroId === tableroId);
        
        const { updatedLuminarias, newConnectionPaths, maxPhaseInfo } = assignPhasesAndRecalculateConnections(
          luminariasForTablero, 
          tableroToUpdate, 
          streets, 
          { reassignPhases: false }
        );
        
        const finalTableros = tableros.map(t => 
            t.id === tableroId ? { ...t, maxPhaseInfo } : t
        );
        
        const otherLuminarias = newLuminarias.filter(l => l.tableroId !== tableroId);
        const otherConnections = allConnectionPaths.filter(p => p.tableroId !== tableroId);

        setLuminarias([...otherLuminarias, ...updatedLuminarias]);
        setTableros(finalTableros);
        setConnectionPaths([...otherConnections, ...newConnectionPaths]);
        setInfoMessage(`Luminaria añadida al tablero ${tableroId}, Fase ${fase}. Plan actualizado.`);
    }
    
    setShowAddLuminariaModal(false);
    setNewLuminariaPosition(null);
  };

  const handleCancelAddLuminaria = () => {
    setShowAddLuminariaModal(false);
    setNewLuminariaPosition(null);
  };


  const handleLuminariaConnectClick = (luminaria: Luminaria) => {
    if (!connectionStartPoint) {
        setConnectionStartPoint(luminaria);
        setInfoMessage(`Punto de inicio: ${luminaria.id.split('-').pop()}. Haz clic en la luminaria de destino.`);
        return;
    }

    if (connectionStartPoint.id === luminaria.id) {
        setInfoMessage("No puedes conectar una luminaria consigo misma.");
        setConnectionStartPoint(null);
        return;
    }

    if (connectionStartPoint.tableroId !== luminaria.tableroId || connectionStartPoint.fase !== luminaria.fase) {
        setInfoMessage("Error: Las luminarias deben pertenecer al mismo tablero y fase. Reiniciando conexión.");
        setConnectionStartPoint(null);
        return;
    }

    const newConnection: ManualConnection = {
        id: `manual-${connectionStartPoint.id}-${luminaria.id}`,
        startLumId: connectionStartPoint.id,
        endLumId: luminaria.id,
    };
    
    // Avoid duplicates
    if (!manualConnections.some(c => (c.startLumId === newConnection.startLumId && c.endLumId === newConnection.endLumId) || (c.startLumId === newConnection.endLumId && c.endLumId === newConnection.startLumId))) {
        setManualConnections(prev => [...prev, newConnection]);
    }

    setConnectionStartPoint(null);
    setInfoMessage('Conexión creada. Selecciona otra luminaria o desactiva el modo.');
  };

  const handleLuminariaClick = (luminaria: Luminaria) => {
    if (isSelectionMode) {
      if (isCtrlPressedRef.current) {
        setSelectedLuminariaIds(prevIds => {
          const newIds = new Set(prevIds);
          if (newIds.has(luminaria.id)) {
            newIds.delete(luminaria.id);
          } else {
            newIds.add(luminaria.id);
          }
          setInfoMessage(`${newIds.size} luminarias seleccionadas.`);
          return newIds;
        });
      } else {
        setInfoMessage("Mantén Ctrl/Cmd y haz clic para añadir o quitar una luminaria de la selección.");
      }
      return; 
    }

    if (isConnectingMode) {
      handleLuminariaConnectClick(luminaria);
    } else if (isAddingLuminariaMode) {
      setInfoMessage("Modo añadir activo. Haz clic en el mapa, no sobre una luminaria.");
    } else {
      setSelectedLuminaria(luminaria);
      setSelectedLuminariaIds(new Set());
    }
  };

  const onLuminariaLabelTypeChange = (value: LuminariaLabelType) => setLuminariaLabelType(value);
  
  const handleToggleTableroVisibility = (tableroId: number) => {
    setHiddenTableros(prevHidden => {
      const newHidden = new Set(prevHidden);
      if (newHidden.has(tableroId)) {
        newHidden.delete(tableroId);
      } else {
        newHidden.add(tableroId);
        if (selectedLuminaria?.tableroId === tableroId) {
          setSelectedLuminaria(null);
        }
        if (highlightedPath?.tableroId === tableroId) {
          setHighlightedPath(null);
        }
      }
      return newHidden;
    });
  };

  const handleTogglePhaseVisibility = (phase: number) => {
    setHiddenPhases(prevHidden => {
      const newHidden = new Set(prevHidden);
      if (newHidden.has(phase)) {
        newHidden.delete(phase);
      } else {
        newHidden.add(phase);
        if (selectedLuminaria?.fase === phase) {
          setSelectedLuminaria(null);
        }
        if (highlightedPath?.phase === phase) {
          setHighlightedPath(null);
        }
      }
      return newHidden;
    });
  };

  const handleHighlightPhasePath = (tableroId: number, phase: number) => {
    setHighlightedPath(current => {
        if (current && current.tableroId === tableroId && current.phase === phase) {
            return null; // Toggle off if clicking the same path again
        }
        return { tableroId, phase };
    });
  };

  const handleRectangleSelect = (bounds: google.maps.LatLngBounds) => {
    const selectedInBounds = luminarias
        .filter(lum => bounds.contains(new google.maps.LatLng(lum.position)))
        .map(lum => lum.id);
    
    if (isCtrlPressedRef.current) {
        setSelectedLuminariaIds(prevIds => {
            const newIds = new Set(prevIds);
            selectedInBounds.forEach(id => newIds.add(id));
            setInfoMessage(`${newIds.size} luminarias seleccionadas.`);
            return newIds;
        });
    } else {
        const newIds = new Set(selectedInBounds);
        setSelectedLuminariaIds(newIds);
        setInfoMessage(`${newIds.size} luminarias seleccionadas.`);
    }
  };

  const handleClearSelection = () => {
    setSelectedLuminariaIds(new Set());
    updateSummaryInfo(visibleLuminarias, visibleTableros);
  };
  
  const handleBulkUpdateLuminarias = (updates: Partial<Pick<Luminaria, 'potenciaW' | 'tipoColumna' | 'fase'>>) => {
    if (selectedLuminariaIds.size === 0) return;

    setInfoMessage(`Actualizando ${selectedLuminariaIds.size} luminarias...`);
    setIsProcessing(true);
    
    setTimeout(() => {
        try {
            const updatedLuminarias = luminarias.map(lum => {
                if (selectedLuminariaIds.has(lum.id)) {
                    const newLum = { ...lum };
                    if (updates.potenciaW !== undefined) newLum.potenciaW = updates.potenciaW;
                    if (updates.tipoColumna !== undefined) newLum.tipoColumna = updates.tipoColumna;
                    if (updates.fase !== undefined) newLum.fase = updates.fase;
                    return newLum;
                }
                return lum;
            });

            const affectedTableroIds = new Set<number>();
            selectedLuminariaIds.forEach(lumId => {
                const lum = luminarias.find(l => l.id === lumId);
                if (lum?.tableroId) affectedTableroIds.add(lum.tableroId);
            });

            let finalLuminarias = [...updatedLuminarias];
            let finalConnectionPaths = connectionPaths.filter(p => !Array.from(affectedTableroIds).includes(p.tableroId));
            let finalTableros = [...tableros];

            affectedTableroIds.forEach(tableroId => {
                const tableroToUpdate = finalTableros.find(t => t.id === tableroId);
                if (!tableroToUpdate) return;

                const luminariasForTablero = finalLuminarias.filter(l => l.tableroId === tableroId);
                const { updatedLuminarias: recalculatedLuminarias, newConnectionPaths, maxPhaseInfo } = assignPhasesAndRecalculateConnections(
                    luminariasForTablero, tableroToUpdate, streets, { reassignPhases: false }
                );
                
                finalLuminarias = [...finalLuminarias.filter(l => l.tableroId !== tableroId), ...recalculatedLuminarias];
                finalConnectionPaths.push(...newConnectionPaths);
                finalTableros = finalTableros.map(t => t.id === tableroId ? { ...t, maxPhaseInfo } : t);
            });

            setLuminarias(finalLuminarias);
            setConnectionPaths(finalConnectionPaths);
            setTableros(finalTableros);
        } catch (error) {
            console.error("Error during bulk update:", error);
            setInfoMessage("Error al actualizar. Intente de nuevo.");
        } finally {
            setSelectedLuminariaIds(new Set());
            setIsProcessing(false);
            setIsSelectionMode(false);
        }
    }, 50);
  };

  const handleBulkDeleteLuminarias = () => {
    if (selectedLuminariaIds.size === 0) return;

    setInfoMessage(`Eliminando ${selectedLuminariaIds.size} luminarias...`);
    setIsProcessing(true);

    setTimeout(() => {
        try {
            const affectedTableroIds = new Set<number>();
            luminarias.forEach(lum => {
                if (selectedLuminariaIds.has(lum.id) && lum.tableroId) {
                    affectedTableroIds.add(lum.tableroId);
                }
            });

            const newLuminarias = luminarias.filter(lum => !selectedLuminariaIds.has(lum.id));
            
            if (selectedLuminaria?.id && selectedLuminariaIds.has(selectedLuminaria.id)) {
                setSelectedLuminaria(null);
            }
            
            if (newLuminarias.length === 0) {
                handleReset();
                setInfoMessage('Todas las luminarias han sido eliminadas.');
                return;
            }

            let finalLuminarias = [...newLuminarias];
            let finalConnectionPaths = connectionPaths.filter(p => !Array.from(affectedTableroIds).includes(p.tableroId));
            let finalTableros = [...tableros];

            affectedTableroIds.forEach(tableroId => {
                const tableroToUpdate = finalTableros.find(t => t.id === tableroId);
                if (!tableroToUpdate) return;
                
                const luminariasForTablero = finalLuminarias.filter(l => l.tableroId === tableroId);
                
                if (luminariasForTablero.length > 0) {
                    const { updatedLuminarias, newConnectionPaths, maxPhaseInfo } = assignPhasesAndRecalculateConnections(
                        luminariasForTablero, tableroToUpdate, streets, { reassignPhases: false }
                    );
                    finalLuminarias = [...finalLuminarias.filter(l => l.tableroId !== tableroId), ...updatedLuminarias];
                    finalConnectionPaths.push(...newConnectionPaths);
                    finalTableros = finalTableros.map(t => t.id === tableroId ? { ...t, maxPhaseInfo } : t);
                } else {
                    finalTableros = finalTableros.filter(t => t.id !== tableroId);
                    // Also remove paths associated with the now-deleted board
                    finalConnectionPaths = finalConnectionPaths.filter(p => p.tableroId !== tableroId);
                }
            });
            
            setLuminarias(finalLuminarias);
            setConnectionPaths(finalConnectionPaths);
            setTableros(finalTableros);
        } catch (error) {
            console.error("Error during bulk delete:", error);
            setInfoMessage("Error al eliminar. Intente de nuevo.");
        } finally {
            setSelectedLuminariaIds(new Set());
            setIsProcessing(false);
            setIsSelectionMode(false);
        }
    }, 50);
};


  const handleExportPdf = async () => {
    if (!window.jspdf || !window.html2canvas) {
        setInfoMessage("Error: La librería de exportación (jspdf o html2canvas) no está cargada.");
        return;
    }
    const mapElement = mapContainerRef.current;
    if (!mapElement || luminarias.length === 0 || !mapComponentRef.current) {
        setInfoMessage("No hay luminarias para exportar o el mapa no está listo.");
        return;
    }

    setInfoMessage("Iniciando exportación a PDF...");
    setIsProcessing(true);
    setIsExporting(true);
    
    const originalCenter = mapComponentRef.current.getCenter();
    const originalZoom = mapComponentRef.current.getZoom();
    const originalHiddenTableros = hiddenTableros;
    const originalHiddenPhases = hiddenPhases;
    const originalHighlightedPath = highlightedPath;
    const allTableroIds = tableros.map(t => t.id);

    const perBoardExportData: BoardExportData[] = [];

    try {
        // Prepare map for export: show all phases and remove highlights
        setHiddenPhases(new Set()); 
        setHighlightedPath(null);
        
        // Loop through each visible tablero to generate its maps
        for (const tablero of visibleTableros) {
            setInfoMessage(`Preparando mapas para Tablero ${tablero.id}...`);

            // Hide all OTHER tableros to focus on the current one
            const otherTableroIds = allTableroIds.filter(id => id !== tablero.id);
            setHiddenTableros(new Set(otherTableroIds));
            // Wait for map to re-render with only one tablero visible
            await new Promise(resolve => setTimeout(resolve, 500)); 

            const bounds = new google.maps.LatLngBounds();
            const lumsForTablero = luminarias.filter(l => l.tableroId === tablero.id);
            if (lumsForTablero.length === 0) continue;
            
            lumsForTablero.forEach(lum => bounds.extend(lum.position));
            bounds.extend(tablero.position);

            if (!bounds.isEmpty() && mapComponentRef.current) {
                mapComponentRef.current.fitBounds(bounds);
                await mapComponentRef.current.waitForIdle();
                
                // Small zoom-in if needed for labels
                const currentZoom = mapComponentRef.current.getZoom();
                if (currentZoom && currentZoom < 16) {
                    mapComponentRef.current.setZoom(16);
                    await mapComponentRef.current.waitForIdle();
                }
            }

            await new Promise(resolve => setTimeout(resolve, 1500)); // Wait for render

            // Capture the 3 maps for this specific board view
            setInfoMessage(`Capturando mapa de fases (Tablero ${tablero.id})...`);
            setExportRenderConfig({ colorMode: 'default', labelType: 'fase' });
            await new Promise(resolve => setTimeout(resolve, 1000));
            const phaseMapCanvas = await window.html2canvas(mapElement, { scale: 2, useCORS: true, logging: false });

            setInfoMessage(`Capturando mapa de potencias (Tablero ${tablero.id})...`);
            setExportRenderConfig({ colorMode: 'default', labelType: 'potencia' });
            await new Promise(resolve => setTimeout(resolve, 1000));
            const powerMapCanvas = await window.html2canvas(mapElement, { scale: 2, useCORS: true, logging: false });
            
            setInfoMessage(`Capturando mapa de columnas (Tablero ${tablero.id})...`);
            setExportRenderConfig({ colorMode: 'poleType', labelType: 'tipoColumna' });
            await new Promise(resolve => setTimeout(resolve, 1000));
            const poleTypeMapCanvas = await window.html2canvas(mapElement, { scale: 2, useCORS: true, logging: false });

            perBoardExportData.push({
                tablero,
                phaseMapCanvas,
                powerMapCanvas,
                poleTypeMapCanvas
            });
        }
        
        if (perBoardExportData.length === 0) {
            setInfoMessage("No hay tableros con luminarias visibles para exportar.");
            throw new Error("No data to export.");
        }

        setInfoMessage("Generando PDF de múltiples páginas...");
        
        await exportToPdf(
            perBoardExportData,
            luminarias, 
            tableros, 
            streets, 
            tableroAddresses,
            calculationParams,
            voltageDropResults,
            allConnectionPaths
        );
        
        setInfoMessage("PDF generado con éxito.");

    } catch (e) {
        console.error("PDF Export failed", e);
        const errorMessage = e instanceof Error ? e.message : 'Ocurrió un error desconocido.';
        setInfoMessage(`Error de exportación: ${errorMessage}`);
    } finally {
        if (mapComponentRef.current && originalCenter && originalZoom !== undefined) {
            mapComponentRef.current.setCenter(originalCenter);
            mapComponentRef.current.setZoom(originalZoom);
        }
        setHiddenTableros(originalHiddenTableros);
        setHiddenPhases(originalHiddenPhases);
        setExportRenderConfig(null); // Reset render config
        setHighlightedPath(originalHighlightedPath);
        updateSummaryInfo(visibleLuminarias, visibleTableros);
        setIsExporting(false);
        setIsProcessing(false);
    }
  };
  
  const handleExportExcel = () => exportToExcel(luminarias, tableros);

  const isPlanFinished = luminarias.length > 0;

  const handleSaveProject = () => {
      if (!isPlanFinished) return;

      const projectState = {
          version: 1,
          polygon,
          streets,
          luminarias,
          tableros,
          distance,
          luminariaPower,
          manualConnections,
          connectionPaths,
          calculationParams,
          hiddenTableros: Array.from(hiddenTableros),
          hiddenPhases: Array.from(hiddenPhases),
      };

      const dataStr = JSON.stringify(projectState, null, 2);
      const blob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const timestamp = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '-');
      link.download = `proyecto_alumbrado_${timestamp}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setInfoMessage('Proyecto guardado con éxito.');
  };

  const handleLoadRequest = (file: File) => {
    setFileToLoad(file);
  };
  
  const executeLoadProject = () => {
    if (!fileToLoad) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const text = e.target?.result;
            if (typeof text !== 'string') {
                throw new Error("El archivo está vacío o no se puede leer.");
            }
            const loadedState = JSON.parse(text);

            if (loadedState.version !== 1 || !loadedState.luminarias || !loadedState.tableros) {
                throw new Error("El archivo no es un proyecto válido o es de una versión incompatible.");
            }
            
            handleReset();
            
            setTimeout(() => {
                setDistance(loadedState.distance);
                setLuminariaPower(loadedState.luminariaPower);
                setCalculationParams(loadedState.calculationParams);
                setManualConnections(loadedState.manualConnections || []);
                setPolygon(loadedState.polygon);
                setStreets(loadedState.streets);
                setTableros(loadedState.tableros);
                setLuminarias(loadedState.luminarias);
                setConnectionPaths(loadedState.connectionPaths || []);
                setHiddenTableros(new Set(loadedState.hiddenTableros || []));
                setHiddenPhases(new Set(loadedState.hiddenPhases || []));
                
                setInfoMessage(`Proyecto "${fileToLoad.name}" cargado. ${loadedState.luminarias.length} luminarias.`);
            }, 100);

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
            console.error("Error loading project:", error);
            setInfoMessage(`Error al cargar el proyecto: ${errorMessage}`);
        } finally {
          setFileToLoad(null);
        }
    };
    reader.onerror = () => {
        setInfoMessage('Fallo al cargar el archivo.');
        setFileToLoad(null);
    };
    reader.readAsText(fileToLoad);
  };

  const cancelLoadProject = () => {
    setFileToLoad(null);
  };

  const handleZoomIn = () => mapComponentRef.current?.setZoom((currentZoom || 14) + 1);
  const handleZoomOut = () => mapComponentRef.current?.setZoom((currentZoom || 14) - 1);

  return (
    <div className="relative w-screen h-screen font-sans">
      <div ref={mapContainerRef} className="w-full h-full">
          {isApiLoaded ? (
            <MapContainer
              ref={mapComponentRef}
              polygon={polygon}
              streets={streets}
              luminarias={visibleLuminarias}
              tableros={visibleTableros}
              onPolygonComplete={handlePolygonComplete}
              onRectangleComplete={handleRectangleSelect}
              onLuminariaClick={handleLuminariaClick}
              onTableroMove={handleTableroMove}
              onMapClick={handleAddLuminaria}
              selectedLuminariaId={selectedLuminaria?.id}
              selectedLuminariaIds={selectedLuminariaIds}
              luminariaLabelType={exportRenderConfig?.labelType || luminariaLabelType}
              colorMode={exportRenderConfig?.colorMode || 'default'}
              connectionPaths={visibleConnectionPaths}
              onZoomChange={setCurrentZoom}
              highlightedPath={highlightedPath}
              isProcessing={isProcessing}
              isConnectingMode={isConnectingMode}
              isAddingLuminariaMode={isAddingLuminariaMode}
              isSelectionMode={isSelectionMode}
              connectionStartPointId={connectionStartPoint?.id}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-900 text-white">Cargando mapa...</div>
          )}
      </div>
      {!isExporting && (
          <ControlsPanel
            onReset={handleReset}
            distance={distance}
            onDistanceChange={setDistance}
            luminariaPower={luminariaPower}
            onLuminariaPowerChange={setLuminariaPower}
            infoMessage={infoMessage}
            isProcessing={isProcessing}
            isPlanFinished={isPlanFinished}
            luminariaLabelType={luminariaLabelType}
            onLuminariaLabelTypeChange={onLuminariaLabelTypeChange}
            onExportExcel={handleExportExcel}
            onExportPdf={handleExportPdf}
            tableros={tableros}
            hiddenTableros={hiddenTableros}
            onToggleTableroVisibility={handleToggleTableroVisibility}
            hiddenPhases={hiddenPhases}
            onTogglePhaseVisibility={handleTogglePhaseVisibility}
            highlightedPath={highlightedPath}
            onHighlightPhasePath={handleHighlightPhasePath}
            calculationParams={calculationParams}
            onCalculationParamsChange={setCalculationParams}
            voltageDropResults={voltageDropResults}
            isConnectingMode={isConnectingMode}
            onToggleConnectMode={handleToggleConnectMode}
            isAddingLuminariaMode={isAddingLuminariaMode}
            onToggleAddLuminariaMode={handleToggleAddLuminariaMode}
            isSelectionMode={isSelectionMode}
            onToggleSelectionMode={handleToggleSelectionMode}
            onSaveProject={handleSaveProject}
            onLoadProject={handleLoadRequest}
          />
      )}
      {showAddLuminariaModal && (
        <AddLuminariaModal
          show={showAddLuminariaModal}
          onConfirm={handleConfirmAddLuminaria}
          onCancel={handleCancelAddLuminaria}
          tableros={tableros}
          defaultPower={luminariaPower}
          defaultPoleType={PoleType.Concrete7m}
        />
      )}
       {showConfigurePlanModal && planDataForConfig && (
        <ConfigurePlanModal
          show={showConfigurePlanModal}
          onConfirm={handleConfirmPlanConfiguration}
          onCancel={handleCancelPlanConfiguration}
          isProcessing={isProcessing}
          totalLuminarias={planDataForConfig.luminarias.length}
          totalPower={planDataForConfig.totalPower}
          recommendedTableros={planDataForConfig.recommendedTableros}
        />
      )}
      {selectedLuminaria && !isExporting && !isConnectingMode && !isAddingLuminariaMode && !isSelectionMode && (
        <EditPanel
          luminaria={selectedLuminaria}
          onSave={handleUpdateLuminaria}
          onCancel={() => setSelectedLuminaria(null)}
          onDelete={handleDeleteLuminaria}
        />
      )}
      {!isExporting && isPlanFinished && selectedLuminariaIds.size > 0 && (
          <BulkEditPanel
            selectedCount={selectedLuminariaIds.size}
            onSave={handleBulkUpdateLuminarias}
            onDelete={handleBulkDeleteLuminarias}
            onClearSelection={handleClearSelection}
            isProcessing={isProcessing}
          />
      )}
      {!isExporting && isPlanFinished && (
        <div className="absolute bottom-4 right-4 flex flex-col items-center gap-2 p-2 bg-gray-800 bg-opacity-80 backdrop-blur-sm rounded-lg shadow-2xl z-10">
          <button
            onClick={handleZoomIn}
            disabled={isProcessing}
            title="Acercar"
            className="w-10 h-10 flex items-center justify-center font-bold text-lg bg-gray-700 text-white rounded-md shadow-lg hover:bg-gray-600 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors"
          >
            <PlusIcon />
          </button>
          <div className="text-white font-semibold text-xs px-2 py-1 bg-gray-900 rounded-md">
            {currentZoom !== undefined ? currentZoom.toFixed(0) : '-'}
          </div>
          <button
            onClick={handleZoomOut}
            disabled={isProcessing}
            title="Alejar"
            className="w-10 h-10 flex items-center justify-center font-bold text-lg bg-gray-700 text-white rounded-md shadow-lg hover:bg-gray-600 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors"
          >
            <MinusIcon />
          </button>
        </div>
      )}
       <ConfirmLoadModal
        show={!!fileToLoad}
        fileName={fileToLoad?.name || ''}
        onConfirm={executeLoadProject}
        onCancel={cancelLoadProject}
      />
    </div>
  );
}