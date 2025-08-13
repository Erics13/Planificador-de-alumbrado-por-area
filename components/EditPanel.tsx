import React, { useState, useEffect } from 'react';
import { Luminaria, PoleType } from '../types';

interface EditPanelProps {
  luminaria: Luminaria;
  onSave: (luminaria: Luminaria) => void;
  onCancel: () => void;
  onDelete: (id: string) => void;
}

const EditPanel: React.FC<EditPanelProps> = ({ luminaria, onSave, onCancel, onDelete }) => {
  const [potencia, setPotencia] = useState(luminaria.potenciaW);
  const [tipoColumna, setTipoColumna] = useState(luminaria.tipoColumna);
  const [fase, setFase] = useState<number | null>(luminaria.fase);

  useEffect(() => {
    setPotencia(luminaria.potenciaW);
    setTipoColumna(luminaria.tipoColumna);
    setFase(luminaria.fase);
  }, [luminaria]);

  const handleSave = () => {
    onSave({
      ...luminaria,
      potenciaW: potencia,
      tipoColumna: tipoColumna,
      fase: fase,
    });
  };
  
  return (
    <div className="edit-panel absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 bg-gray-800 bg-opacity-95 backdrop-blur-sm text-white rounded-xl shadow-2xl p-6 z-20">
      <h3 className="text-xl font-bold mb-4 text-yellow-300">Editar Luminaria</h3>
      <div className="space-y-4">
        <div>
          <label htmlFor="potenciaInput" className="block text-sm font-medium mb-1">Potencia (W):</label>
          <input
            type="number"
            id="potenciaInput"
            min="1"
            step="1"
            value={potencia}
            onChange={(e) => setPotencia(Number(e.target.value))}
            className="w-full bg-gray-900 border border-gray-600 rounded-md p-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
        <div>
          <label htmlFor="tipoColumnaSelect" className="block text-sm font-medium mb-1">Tipo de columna:</label>
          <select
            id="tipoColumnaSelect"
            value={tipoColumna}
            onChange={(e) => setTipoColumna(e.target.value as PoleType)}
            className="w-full bg-gray-900 border border-gray-600 rounded-md p-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            {Object.values(PoleType).map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="faseSelect" className="block text-sm font-medium mb-1">Fase Eléctrica:</label>
          <select
            id="faseSelect"
            value={fase || ''}
            onChange={(e) => setFase(Number(e.target.value) as 1 | 2 | 3)}
            className="w-full bg-gray-900 border border-gray-600 rounded-md p-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="1">Fase 1 (Verde)</option>
            <option value="2">Fase 2 (Naranja)</option>
            <option value="3">Fase 3 (Azul)</option>
          </select>
        </div>
      </div>
      <div className="mt-6 flex justify-between items-center">
        <button
          onClick={() => onDelete(luminaria.id)}
          className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-500 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-red-500"
        >
          Eliminar
        </button>
        <div className="flex justify-end gap-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm font-semibold bg-gray-600 hover:bg-gray-500 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors"
            >
              Guardar
            </button>
        </div>
      </div>
    </div>
  );
};

export default EditPanel;