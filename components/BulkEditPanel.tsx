import React, { useState } from 'react';
import { PoleType, Luminaria } from '../types';

interface BulkEditPanelProps {
  selectedCount: number;
  onSave: (updates: Partial<Pick<Luminaria, 'potenciaW' | 'tipoColumna' | 'fase'>>) => void;
  onDelete: () => void;
  onClearSelection: () => void;
  isProcessing: boolean;
}

const BulkEditPanel: React.FC<BulkEditPanelProps> = ({ selectedCount, onSave, onDelete, onClearSelection, isProcessing }) => {
  const [potencia, setPotencia] = useState('');
  const [tipoColumna, setTipoColumna] = useState(''); // PoleType or ''
  const [fase, setFase] = useState(''); // number or ''

  const handleApply = () => {
    const updates: Partial<Pick<Luminaria, 'potenciaW' | 'tipoColumna' | 'fase'>> = {};
    const potenciaNum = Number(potencia);
    if (potencia !== '' && !isNaN(potenciaNum) && potenciaNum > 0) {
      updates.potenciaW = potenciaNum;
    }
    if (tipoColumna !== '') {
      updates.tipoColumna = tipoColumna as PoleType;
    }
    if (fase !== '') {
      updates.fase = Number(fase) as 1 | 2 | 3;
    }

    if (Object.keys(updates).length > 0) {
      onSave(updates);
    }
  };
  
  const handleDelete = () => {
    // The window.confirm dialog is removed to prevent errors in sandboxed environments.
    // The user's intent to delete is clear from clicking the "Eliminar" button.
    onDelete();
  };
  
  const handleClear = () => {
      onClearSelection();
      setPotencia('');
      setTipoColumna('');
      setFase('');
  };

  const hasChanges = potencia !== '' || tipoColumna !== '' || fase !== '';

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-auto max-w-5xl bg-gray-800 bg-opacity-90 backdrop-blur-sm text-white rounded-xl shadow-2xl p-4 z-20 flex items-center justify-center gap-x-4 md:gap-x-6 animate-fade-in-up">
      <div className="flex-shrink-0">
        <span className="font-bold text-lg text-yellow-300">{selectedCount}</span>
        <span className="ml-2 text-gray-300">seleccionadas</span>
      </div>
      
      <div className="h-10 border-l border-gray-600"></div>

      <div className="flex items-center gap-x-2 md:gap-x-4">
        <div className="flex flex-col">
            <label htmlFor="bulkPotencia" className="text-xs text-gray-400 mb-1 text-center">Potencia</label>
            <input
                type="number"
                id="bulkPotencia"
                value={potencia}
                onChange={(e) => setPotencia(e.target.value)}
                placeholder="W"
                disabled={isProcessing}
                className="w-20 bg-gray-900 border border-gray-600 rounded-md p-1 text-center focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-50"
            />
        </div>
         <div className="flex flex-col">
             <label htmlFor="bulkTipoColumna" className="text-xs text-gray-400 mb-1 text-center">Columna</label>
            <select
                id="bulkTipoColumna"
                value={tipoColumna}
                onChange={(e) => setTipoColumna(e.target.value)}
                disabled={isProcessing}
                className="w-32 bg-gray-900 border border-gray-600 rounded-md p-1 focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-50"
            >
                <option value="">-- Mantener --</option>
                {Object.values(PoleType).map(type => (
                <option key={type} value={type}>{type}</option>
                ))}
            </select>
        </div>
         <div className="flex flex-col">
            <label htmlFor="bulkFase" className="text-xs text-gray-400 mb-1 text-center">Fase</label>
            <select
                id="bulkFase"
                value={fase}
                onChange={(e) => setFase(e.target.value)}
                disabled={isProcessing}
                className="w-28 bg-gray-900 border border-gray-600 rounded-md p-1 focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-50"
            >
                <option value="">-- Mantener --</option>
                <option value="1">Fase 1</option>
                <option value="2">Fase 2</option>
                <option value="3">Fase 3</option>
            </select>
        </div>
      </div>

      <div className="h-10 border-l border-gray-600"></div>

      <div className="flex items-center gap-x-3">
        <button
          onClick={handleApply}
          disabled={!hasChanges || isProcessing}
          className="px-4 py-2 text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed"
        >
          {isProcessing ? '...' : 'Aplicar'}
        </button>
        <button
          onClick={handleDelete}
          disabled={isProcessing}
          className="px-4 py-2 text-sm font-semibold bg-red-600 hover:bg-red-500 rounded-lg transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed"
        >
          {isProcessing ? '...' : 'Eliminar'}
        </button>
        <button
          onClick={handleClear}
          disabled={isProcessing}
          title="Deseleccionar todo"
          className="px-3 py-2 text-sm font-semibold bg-gray-600 hover:bg-gray-500 rounded-lg transition-colors disabled:opacity-50"
        >
            &times;
        </button>
      </div>
    </div>
  );
};

export default BulkEditPanel;