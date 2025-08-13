import React from 'react';

interface SplitPromptModalProps {
  show: boolean;
  onConfirm: () => void;
  onDecline: () => void;
  isProcessingSplit: boolean;
}

const SplitPromptModal: React.FC<SplitPromptModalProps> = ({ show, onConfirm, onDecline, isProcessingSplit }) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 transition-opacity duration-300">
      <div className="bg-gray-800 text-white rounded-xl shadow-2xl p-8 max-w-lg w-full transform transition-all duration-300 scale-95 animate-fade-in-up">
        <h2 className="text-2xl font-bold mb-4 text-yellow-300">Límite de Plan Excedido</h2>
        <p className="mb-6 text-gray-300">
          El plan generado supera los límites recomendados (100 luminarias o 15 kW). 
          Puede continuar con un único tablero sobredimensionado o dividir el plan en dos tableros para una mejor gestión.
        </p>
        <div className="flex justify-end gap-4">
          <button
            onClick={onDecline}
            disabled={isProcessingSplit}
            className="px-6 py-2 text-sm font-semibold bg-gray-600 hover:bg-gray-500 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-wait"
          >
            Usar 1 Tablero
          </button>
          <button
            onClick={onConfirm}
            disabled={isProcessingSplit}
            className="px-6 py-2 text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-wait flex items-center"
          >
            {isProcessingSplit && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>}
            Dividir en 2 Tableros
          </button>
        </div>
      </div>
    </div>
  );
};

export default SplitPromptModal;
