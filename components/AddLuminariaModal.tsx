import React, { useState, useEffect } from 'react';
import { PoleType, Tablero } from '../types';

interface AddLuminariaModalProps {
  show: boolean;
  onConfirm: (details: { potenciaW: number; tipoColumna: PoleType; fase: number; tableroId: number; }) => void;
  onCancel: () => void;
  tableros: Tablero[];
  defaultPower: number;
  defaultPoleType: PoleType;
}

const AddLuminariaModal: React.FC<AddLuminariaModalProps> = ({ show, onConfirm, onCancel, tableros, defaultPower, defaultPoleType }) => {
  const [potenciaW, setPotenciaW] = useState(defaultPower);
  const [tipoColumna, setTipoColumna] = useState(defaultPoleType);
  const [fase, setFase] = useState<number | ''>('');
  const [tableroId, setTableroId] = useState<number | ''>('');

  useEffect(() => {
    if (show) {
      setPotenciaW(defaultPower);
      setTipoColumna(defaultPoleType);
      setFase('');
      setTableroId(tableros.length === 1 ? tableros[0].id : '');
    }
  }, [show, defaultPower, defaultPoleType, tableros]);

  const isFormValid = fase !== '' && tableroId !== '';

  const handleConfirm = () => {
    if (isFormValid) {
      onConfirm({
        potenciaW: Number(potenciaW),
        tipoColumna,
        fase: Number(fase),
        tableroId: Number(tableroId),
      });
    }
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 transition-opacity duration-300">
      <div className="bg-gray-800 text-white rounded-xl shadow-2xl p-8 max-w-lg w-full transform transition-all duration-300 scale-95 animate-fade-in-up">
        <h2 className="text-2xl font-bold mb-6 text-yellow-300">Añadir Nueva Luminaria</h2>
        <div className="space-y-4">
          <div>
            <label htmlFor="tableroId" className="block text-sm font-medium mb-1">Tablero de Control:</label>
            <select
              id="tableroId"
              value={tableroId}
              onChange={(e) => setTableroId(Number(e.target.value))}
              className="w-full bg-gray-900 border border-gray-600 rounded-md p-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="" disabled>Seleccione un tablero...</option>
              {tableros.map(t => (
                <option key={t.id} value={t.id}>Tablero {t.id}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="fase" className="block text-sm font-medium mb-1">Fase Eléctrica:</label>
            <select
              id="fase"
              value={fase}
              onChange={(e) => setFase(Number(e.target.value))}
              className="w-full bg-gray-900 border border-gray-600 rounded-md p-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="" disabled>Seleccione una fase...</option>
              <option value="1">Fase 1 (Verde)</option>
              <option value="2">Fase 2 (Naranja)</option>
              <option value="3">Fase 3 (Azul)</option>
            </select>
          </div>
          <div>
            <label htmlFor="potenciaW" className="block text-sm font-medium mb-1">Potencia (W):</label>
            <input
              type="number"
              id="potenciaW"
              min="1"
              value={potenciaW}
              onChange={(e) => setPotenciaW(Number(e.target.value))}
              className="w-full bg-gray-900 border border-gray-600 rounded-md p-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div>
            <label htmlFor="tipoColumna" className="block text-sm font-medium mb-1">Tipo de Columna:</label>
            <select
              id="tipoColumna"
              value={tipoColumna}
              onChange={(e) => setTipoColumna(e.target.value as PoleType)}
              className="w-full bg-gray-900 border border-gray-600 rounded-md p-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              {Object.values(PoleType).map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-4 mt-8">
          <button
            onClick={onCancel}
            className="px-6 py-2 text-sm font-semibold bg-gray-600 hover:bg-gray-500 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={!isFormValid}
            className="px-6 py-2 text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Añadir Luminaria
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddLuminariaModal;
