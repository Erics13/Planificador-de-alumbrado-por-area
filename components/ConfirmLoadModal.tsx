import React from 'react';

interface ConfirmLoadModalProps {
  show: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  fileName: string;
}

const ConfirmLoadModal: React.FC<ConfirmLoadModalProps> = ({ show, onConfirm, onCancel, fileName }) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 transition-opacity duration-300">
      <div className="bg-gray-800 text-white rounded-xl shadow-2xl p-8 max-w-lg w-full transform transition-all duration-300 scale-95 animate-fade-in-up">
        <h2 className="text-2xl font-bold mb-4 text-yellow-300">Confirmar Carga de Proyecto</h2>
        <p className="mb-6 text-gray-300">
          Estás a punto de cargar el proyecto desde el archivo <strong className="font-bold text-gray-100">{fileName}</strong>.
          <br />
          Cualquier cambio no guardado se perderá. ¿Deseas continuar?
        </p>
        <div className="flex justify-end gap-4">
          <button
            onClick={onCancel}
            className="px-6 py-2 text-sm font-semibold bg-gray-600 hover:bg-gray-500 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="px-6 py-2 text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors"
          >
            Confirmar y Cargar
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmLoadModal;
