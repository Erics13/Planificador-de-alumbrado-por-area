

import React, { useState, useRef } from 'react';
import { ExportIcon, ResetIcon, EyeIcon, EyeOffIcon, LinkIcon, SaveIcon, UploadIcon, AddLuminariaIcon, SelectionIcon } from './Icons';
import { LuminariaLabelType, Tablero } from '../types';
import { PHASE_COLORS } from '../constants';
import { CABLE_TYPES } from '../data/cableData';

interface CalculationParams {
  cableType: string;
  voltage: number;
  powerFactor: number;
}

interface ControlsPanelProps {
  onReset: () => void;
  distance: number;
  onDistanceChange: (value: number) => void;
  luminariaPower: number;
  onLuminariaPowerChange: (value: number) => void;
  infoMessage: string;
  isProcessing: boolean;
  isPlanFinished: boolean;
  luminariaLabelType: LuminariaLabelType;
  onLuminariaLabelTypeChange: (value: LuminariaLabelType) => void;
  onExportExcel: () => void;
  onExportPdf: () => void;
  tableros: Tablero[];
  hiddenTableros: Set<number>;
  onToggleTableroVisibility: (tableroId: number) => void;
  hiddenPhases: Set<number>;
  onTogglePhaseVisibility: (phase: number) => void;
  highlightedPath: {tableroId: number; phase: number} | null;
  onHighlightPhasePath: (tableroId: number, phase: number) => void;
  calculationParams: CalculationParams;
  onCalculationParamsChange: (params: CalculationParams) => void;
  voltageDropResults: Map<number, { [phase: number]: number }>;
  isConnectingMode: boolean;
  onToggleConnectMode: () => void;
  isAddingLuminariaMode: boolean;
  onToggleAddLuminariaMode: () => void;
  isSelectionMode: boolean;
  onToggleSelectionMode: () => void;
  onSaveProject: () => void;
  onLoadProject: (file: File) => void;
}

const ActionButton: React.FC<{ onClick: () => void; disabled: boolean; children: React.ReactNode; isLoading?: boolean; className?: string, title?: string }> = ({ onClick, disabled, children, isLoading = false, className = '', title = ''}) => (
    <button
      onClick={onClick}
      disabled={disabled || isLoading}
      title={title}
      className={`w-full flex items-center justify-center text-sm font-semibold px-4 py-2 rounded-lg shadow-md transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 ${
        disabled
          ? 'bg-gray-500 text-gray-300 cursor-not-allowed'
          : `bg-indigo-600 text-white hover:bg-indigo-500 focus:ring-indigo-500 ${className}`
      }`}
    >
      {isLoading ? (
        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
      ) : (
        children
      )}
    </button>
);


const ControlsPanel: React.FC<ControlsPanelProps> = (props) => {
  const [isAnalysisPanelOpen, setIsAnalysisPanelOpen] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLoadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      props.onLoadProject(file);
      event.target.value = ''; 
    }
  };

  const getVoltageDropColor = (drop: number | undefined): string => {
      if (drop === undefined || drop === 0) return 'text-gray-400';
      if (drop > 5) return 'text-red-400 font-bold';
      if (drop > 3) return 'text-yellow-400';
      return 'text-green-400';
  };

  const ChevronIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );

  return (
    <>
      <div className="controls-panel absolute top-4 left-4 w-96 bg-gray-800 bg-opacity-90 backdrop-blur-sm text-white rounded-xl shadow-2xl p-4 flex flex-col gap-4 overflow-y-auto max-h-[calc(100vh-2rem)]">
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-bold text-yellow-300">Planificador de Alumbrado</h1>
        </div>

        <div className="space-y-3">
          <button
              onClick={props.onReset}
              title="Reiniciar proceso"
              disabled={props.isProcessing}
              className="w-full flex items-center justify-center text-sm font-semibold px-4 py-2 rounded-lg shadow-md transition-all duration-200 ease-in-out bg-gray-600 text-white hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-gray-500 disabled:opacity-50"
          >
              <ResetIcon />
              <span className="ml-2">Reiniciar Proceso</span>
          </button>
          
          <fieldset className="space-y-2 bg-gray-700 p-2 rounded-lg" disabled={props.isProcessing || props.isPlanFinished}>
            <div className="flex items-center justify-between">
              <label htmlFor="distancia" className="text-sm font-medium">Distancia (m):</label>
              <input
                type="number"
                id="distancia"
                value={props.distance}
                onChange={(e) => props.onDistanceChange(Number(e.target.value))}
                className="w-20 bg-gray-900 border border-gray-600 rounded-md p-1 text-center focus:ring-indigo-500 focus:border-indigo-500"
                min="1"
              />
            </div>
            <div className="flex items-center justify-between">
              <label htmlFor="potencia" className="text-sm font-medium">Potencia (W):</label>
              <input
                type="number"
                id="potencia"
                value={props.luminariaPower}
                onChange={(e) => props.onLuminariaPowerChange(Number(e.target.value))}
                className="w-20 bg-gray-900 border border-gray-600 rounded-md p-1 text-center focus:ring-indigo-500 focus:border-indigo-500"
                min="1"
              />
            </div>
          </fieldset>

          {props.isPlanFinished && (
              <fieldset className="space-y-2 bg-gray-700 p-2 rounded-lg" disabled={props.isProcessing}>
                  <div className="flex items-center justify-between">
                      <label htmlFor="labelType" className="text-sm font-medium">Ver etiquetas:</label>
                      <select
                        id="labelType"
                        value={props.luminariaLabelType}
                        onChange={(e) => props.onLuminariaLabelTypeChange(e.target.value as LuminariaLabelType)}
                        className="w-32 bg-gray-900 border border-gray-600 rounded-md p-1 text-center focus:ring-indigo-500 focus:border-indigo-500"
                      >
                        <option value="none">Ninguna</option>
                        <option value="potencia">Potencia</option>
                        <option value="fase">Fase</option>
                        <option value="tipoColumna">Tipo Columna</option>
                      </select>
                  </div>
              </fieldset>
          )}

          {props.isPlanFinished && (
            <fieldset className="space-y-3 bg-gray-700 p-3 rounded-lg" disabled={props.isProcessing}>
              <legend className="text-sm font-medium px-1">Visibilidad</legend>
              
              {props.tableros.length > 1 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase">Tableros</h3>
                  {props.tableros.map(tablero => (
                    <div key={tablero.id} className="flex items-center justify-between">
                      <span className={`text-sm ${props.hiddenTableros.has(tablero.id) ? 'text-gray-400' : 'text-white'}`}>
                        Tablero {tablero.id}
                      </span>
                      <button 
                        onClick={() => props.onToggleTableroVisibility(tablero.id)}
                        title={props.hiddenTableros.has(tablero.id) ? 'Mostrar tablero' : 'Ocultar tablero'}
                        className="p-1 rounded-full hover:bg-gray-600 transition-colors"
                      >
                        {props.hiddenTableros.has(tablero.id) ? <EyeOffIcon /> : <EyeIcon />}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-gray-400 uppercase pt-2">Fases</h3>
                <div className="flex justify-between items-center space-x-2">
                    {[1, 2, 3].map(phase => (
                        <button
                            key={phase}
                            onClick={() => props.onTogglePhaseVisibility(phase as 1 | 2 | 3)}
                            title={props.hiddenPhases.has(phase) ? `Mostrar Fase ${phase}` : `Ocultar Fase ${phase}`}
                            className={`flex-1 flex items-center justify-center gap-2 p-2 rounded-md transition-all text-white font-semibold text-sm ${
                                props.hiddenPhases.has(phase) 
                                ? 'bg-gray-600 opacity-70 hover:opacity-100' 
                                : 'hover:opacity-80'
                            }`}
                            style={{ backgroundColor: !props.hiddenPhases.has(phase) ? PHASE_COLORS[phase] : undefined }}
                        >
                            {props.hiddenPhases.has(phase) ? <EyeOffIcon /> : <EyeIcon />}
                            <span>F{phase}</span>
                        </button>
                    ))}
                </div>
              </div>
            </fieldset>
          )}

          {props.isPlanFinished && (
            <fieldset className="bg-gray-700 p-3 rounded-lg" disabled={props.isProcessing}>
                <legend className="text-sm font-medium px-1">Herramientas</legend>
                <div className="grid grid-cols-3 gap-2">
                   <ActionButton
                      onClick={props.onToggleSelectionMode}
                      disabled={props.isProcessing}
                      className={props.isSelectionMode ? '!bg-yellow-500 hover:!bg-yellow-400 focus:!ring-yellow-400' : '!bg-purple-600 hover:!bg-purple-500 focus:!ring-purple-500'}
                      title="Seleccionar múltiples luminarias"
                  >
                      <SelectionIcon />
                      <span className="ml-2">{props.isSelectionMode ? '...' : 'Sel.'}</span>
                  </ActionButton>
                  <ActionButton
                      onClick={props.onToggleAddLuminariaMode}
                      disabled={props.isProcessing}
                      className={props.isAddingLuminariaMode ? '!bg-yellow-500 hover:!bg-yellow-400 focus:!ring-yellow-400' : '!bg-teal-600 hover:!bg-teal-500 focus:!ring-teal-500'}
                      title="Añadir nueva luminaria en el mapa"
                  >
                      <AddLuminariaIcon />
                      <span className="ml-2">{props.isAddingLuminariaMode ? '...' : 'Añadir'}</span>
                  </ActionButton>
                  <ActionButton
                      onClick={props.onToggleConnectMode}
                      disabled={props.isProcessing}
                      className={props.isConnectingMode ? '!bg-yellow-500 hover:!bg-yellow-400 focus:!ring-yellow-400' : '!bg-blue-600 hover:!bg-blue-500 focus:!ring-blue-500'}
                      title="Añadir conexiones faltantes manualmente"
                  >
                      <LinkIcon />
                      <span className="ml-2">{props.isConnectingMode ? '...' : 'Conectar'}</span>
                  </ActionButton>
                </div>
            </fieldset>
          )}
          
          {props.isPlanFinished && (
            <fieldset className="bg-gray-700 p-3 rounded-lg" disabled={props.isProcessing}>
                <legend
                    className={`w-full flex justify-between items-center text-base font-medium px-1 ${props.isProcessing ? 'cursor-default' : 'cursor-pointer'}`}
                    onClick={() => !props.isProcessing && setIsAnalysisPanelOpen(prev => !prev)}
                    aria-expanded={isAnalysisPanelOpen}
                >
                    <span>Análisis de Caída de Tensión</span>
                    <span className={`transform transition-transform duration-200 ${isAnalysisPanelOpen ? 'rotate-0' : '-rotate-90'}`}>
                        <ChevronIcon />
                    </span>
                </legend>
                
                {isAnalysisPanelOpen && (
                  <div className="mt-3 space-y-3">
                    <div className="space-y-2 border-b border-gray-600 pb-3">
                        <div className="flex items-center justify-between">
                            <label htmlFor="cableType" className="text-sm font-medium">Cable:</label>
                            <select
                                id="cableType"
                                value={props.calculationParams.cableType}
                                onChange={(e) => props.onCalculationParamsChange({ ...props.calculationParams, cableType: e.target.value })}
                                className="w-48 bg-gray-900 border border-gray-600 rounded-md p-1 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                            >
                                {Object.values(CABLE_TYPES).map(type => (
                                    <option key={type} value={type}>{type}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex items-center justify-between">
                            <label htmlFor="voltage" className="text-sm font-medium">Tensión (V):</label>
                            <input
                                type="number"
                                id="voltage"
                                value={props.calculationParams.voltage}
                                onChange={(e) => props.onCalculationParamsChange({ ...props.calculationParams, voltage: Number(e.target.value) || 0 })}
                                className="w-20 bg-gray-900 border border-gray-600 rounded-md p-1 text-center focus:ring-indigo-500 focus:border-indigo-500"
                                min="1"
                            />
                        </div>
                        <div className="flex items-center justify-between">
                            <label htmlFor="powerFactor" className="text-sm font-medium">Factor Potencia:</label>
                            <input
                                type="number"
                                id="powerFactor"
                                step="0.01"
                                min="0"
                                max="1"
                                value={props.calculationParams.powerFactor}
                                onChange={(e) => props.onCalculationParamsChange({ ...props.calculationParams, powerFactor: Number(e.target.value) || 0 })}
                                className="w-20 bg-gray-900 border border-gray-600 rounded-md p-1 text-center focus:ring-indigo-500 focus:border-indigo-500"
                            />
                        </div>
                    </div>
                  
                    <p className="text-xs text-gray-400 pt-1 px-1">Resultados por fase (Distancia / ΔV%). Caídas &gt; 5% son críticas.</p>
                  
                    {props.tableros
                      .filter(tablero => !props.hiddenTableros.has(tablero.id))
                      .map(tablero => (
                        <div key={`dist-tab-${tablero.id}`} className="text-sm border-t border-gray-600 pt-3 first:border-t-0 first:pt-0 mt-3 first:mt-0">
                          <h4 className="font-semibold text-gray-200">Tablero {tablero.id}</h4>
                          <ul className="pl-1 space-y-1 mt-1">
                              {[1, 2, 3].map(phase => {
                              const info = tablero.maxPhaseInfo?.[phase];
                              const distance = info?.distance ?? 0;
                              const pathExists = info?.path && info.path.length > 0;
                              const isHighlighted = props.highlightedPath?.tableroId === tablero.id && props.highlightedPath?.phase === phase;
                              const voltageDrop = props.voltageDropResults.get(tablero.id)?.[phase];
                              
                              return (
                                <li 
                                  key={phase}
                                  onClick={() => pathExists && props.onHighlightPhasePath(tablero.id, phase)}
                                  title={pathExists ? 'Clic para resaltar el recorrido en el mapa' : 'No hay luminarias en esta fase'}
                                  className={`p-1.5 rounded transition-colors ${pathExists ? 'cursor-pointer hover:bg-gray-600' : 'opacity-50'} ${isHighlighted ? 'bg-indigo-500/50' : ''}`}
                                >
                                  <div className="grid grid-cols-[max-content_1fr] items-center gap-x-4">
                                    <span className="font-bold text-base whitespace-nowrap" style={{ color: PHASE_COLORS[phase] }}>● Fase {phase}:</span>
                                    <div className="flex justify-end items-center gap-x-3">
                                      <span className="font-mono font-bold text-base text-gray-200 whitespace-nowrap">
                                        {distance.toFixed(0)} m
                                      </span>
                                      <span className={`font-mono text-base px-2 py-0.5 rounded ${getVoltageDropColor(voltageDrop)} bg-gray-900/70 whitespace-nowrap`}>
                                        {voltageDrop !== undefined ? `ΔV ${voltageDrop.toFixed(2)}%` : '-'}
                                      </span>
                                    </div>
                                  </div>
                                </li>
                              );
                              })}
                          </ul>
                        </div>
                    ))}
                </div>
              )}
            </fieldset>
          )}

        </div>

        <div className="p-3 rounded-lg bg-gray-900">
          <p className="text-sm text-left whitespace-pre-wrap">
            {props.isProcessing ? 'Procesando...' : props.infoMessage}
          </p>
        </div>

        <div className="space-y-4 border-t border-gray-700 mt-auto pt-4">
            <div>
                <h2 className="text-lg font-semibold mb-2 text-center">Proyecto</h2>
                <div className="grid grid-cols-2 gap-2">
                    <ActionButton
                        onClick={handleLoadClick}
                        disabled={props.isProcessing}
                        className="!bg-teal-600 hover:!bg-teal-500 focus:!ring-teal-500"
                        title="Cargar proyecto desde archivo .json"
                    >
                        <UploadIcon />
                        <span className="ml-2">Cargar</span>
                    </ActionButton>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        className="hidden"
                        accept=".json"
                    />
                    <ActionButton
                        onClick={props.onSaveProject}
                        disabled={props.isProcessing || !props.isPlanFinished}
                        className="!bg-sky-600 hover:!bg-sky-500 focus:!ring-sky-500"
                        title="Guardar proyecto a archivo .json"
                    >
                        <SaveIcon />
                        <span className="ml-2">Guardar</span>
                    </ActionButton>
                </div>
            </div>
            {props.isPlanFinished && (
              <div>
                <h2 className="text-lg font-semibold mb-2 text-center">Exportar Vistas</h2>
                <div className="grid grid-cols-2 gap-2">
                    <ActionButton onClick={props.onExportExcel} disabled={props.isProcessing} className="bg-green-600 hover:bg-green-500 focus:ring-green-500"><ExportIcon /><span className="ml-1">XLS</span></ActionButton>
                    <ActionButton onClick={props.onExportPdf} disabled={props.isProcessing} className="bg-red-600 hover:bg-red-500 focus:ring-red-500"><ExportIcon /><span className="ml-1">PDF</span></ActionButton>
                </div>
              </div>
            )}
        </div>
      </div>
    </>
  );
};

export default ControlsPanel;
