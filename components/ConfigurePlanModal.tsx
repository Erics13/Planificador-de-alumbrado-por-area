
import React, { useState, useEffect } from 'react';

interface ConfigurePlanModalProps {
  show: boolean;
  onConfirm: (numTableros: number) => void;
  onCancel: () => void;
  isProcessing: boolean;
  totalLuminarias: number;
  totalPower: number;
  recommendedTableros: number;
}

const ConfigurePlanModal: React.FC<ConfigurePlanModalProps> = ({
  show,
  onConfirm,
  onCancel,
  isProcessing,
  totalLuminarias,
  totalPower,
  recommendedTableros,
}) => {
  const [numTableros, setNumTableros] = useState(recommendedTableros);

  useEffect(() => {
    // Reset to recommended when modal is shown
    if (show) {
      setNumTableros(recommendedTableros);
    }
  }, [recommendedTableros, show]);

  if (!show) return null;

  const handleConfirm = () => {
    if (numTableros > 0) {
      onConfirm(numTableros);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 transition-opacity duration-300">
      <div className="bg-gray-800 text-white rounded-xl shadow-2xl p-8 max-w-lg w-full transform transition-all duration-300 scale-95 animate-fade-in-up">
        <h2 className="text-2xl font-bold mb-4 text-yellow-300">Configurar Plan de Alumbrado</h2>
        <div className="mb-6 text-gray-300 space-y-4">
            <p>Se ha finalizado el análisis del área. Revisa los resultados y configura el número de tableros para el plan.</p>
            <div className="grid grid-cols-2 gap-4 bg-gray-900 p-4 rounded-lg">
                <div>
                    <p className="text-sm text-gray-400">Total Luminarias</p>
                    <p className="text-xl font-bold">{totalLuminarias.toLocaleString('de-DE')}</p>
                </div>
                <div>
                    <p className="text-sm text-gray-400">Potencia Total</p>
                    <p className="text-xl font-bold">{totalPower.toLocaleString('de-DE')} W</p>
                </div>
            </div>
            <div>
                <label htmlFor="numTableros" className="block text-sm font-medium mb-2">
                    Número de Tableros (Recomendado: {recommendedTableros})
                </label>
                <input
                    type="number"
                    id="numTableros"
                    min="1"
                    value={numTableros}
                    onChange={(e) => setNumTableros(Math.max(1, Number(e.target.value)))}
                    className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-center text-lg font-bold focus:ring-indigo-500 focus:border-indigo-500"
                    disabled={isProcessing}
                />
            </div>
        </div>
        <div className="flex justify-end gap-4">
          <button
            onClick={onCancel}
            disabled={isProcessing}
            className="px-6 py-2 text-sm font-semibold bg-gray-600 hover:bg-gray-500 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-wait"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={isProcessing || numTableros < 1}
            className="px-6 py-2 text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-wait flex items-center"
          >
            {isProcessing && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>}
            Crear Plan
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfigurePlanModal;
