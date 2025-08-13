// data/cableData.ts

export const CABLE_TYPES = {
  AL_PRE_2x16: 'PR 2x16 mm² AL',
  AL_PRE_2x25: 'PR 2x25 mm² AL',
  AL_PRE_2x35: 'PR 2x35 mm² AL',
  CU_SUB_2x6: 'Cobre Subterráneo 2x6 mm²',
  CU_SUB_2x10: 'Cobre Subterráneo 2x10 mm²',
  CU_SUB_2x16: 'Cobre Subterráneo 2x16 mm²',
};

// Resistencia (r) y Reactancia (x) en Ohm/km
// Valores típicos para cables de distribución en baja tensión.
export const CABLE_SPECS: { [key: string]: { r: number; x: number } } = {
  [CABLE_TYPES.AL_PRE_2x16]: { r: 2.1, x: 0.08 },
  [CABLE_TYPES.AL_PRE_2x25]: { r: 1.38, x: 0.08 },
  [CABLE_TYPES.AL_PRE_2x35]: { r: 0.986, x: 0.078 },
  [CABLE_TYPES.CU_SUB_2x6]: { r: 3.39, x: 0.095 },
  [CABLE_TYPES.CU_SUB_2x10]: { r: 2.01, x: 0.09 },
  [CABLE_TYPES.CU_SUB_2x16]: { r: 1.26, x: 0.085 },
};
