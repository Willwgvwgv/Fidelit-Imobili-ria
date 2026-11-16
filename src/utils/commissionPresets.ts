import { SplitRole } from '../../types';

// Repartições padrão de comissão da Fidelité.
// Cada linha é a fatia da comissão total (soma sempre 100%).
// Quem recebe (corretor, gerente, captador) é escolhido na hora de lançar a venda.
export interface CommissionPresetLine {
  role: SplitRole;
  percentage: number;
  label?: string; // texto curto mostrado no botão quando difere do nome do papel
}

export interface CommissionPreset {
  id: string;
  name: string;
  lines: CommissionPresetLine[];
}

export const COMMISSION_PRESETS: CommissionPreset[] = [
  {
    id: 'ipe-buritis-giardino',
    name: 'Ipê / Parque dos Buritis / Giardino',
    lines: [
      { role: SplitRole.AGENCY, percentage: 30 },
      { role: SplitRole.BROKER, percentage: 50, label: 'Corretor Diferor' },
      { role: SplitRole.MANAGER, percentage: 20 },
    ],
  },
  {
    id: 'ipe-buritis-giardino-iniciante',
    name: 'Ipê / Buritis / Giardino – Iniciante',
    lines: [
      { role: SplitRole.AGENCY, percentage: 45 },
      { role: SplitRole.BROKER, percentage: 35, label: 'Corretor iniciante' },
      { role: SplitRole.MANAGER, percentage: 20 },
    ],
  },
  {
    id: 'cidade-jardim',
    name: 'Cidade Jardim',
    lines: [
      { role: SplitRole.AGENCY, percentage: 25 },
      { role: SplitRole.BROKER, percentage: 63 },
      { role: SplitRole.MANAGER, percentage: 12 },
    ],
  },
  {
    id: 'iniciante-captador',
    name: 'Iniciante com captador',
    lines: [
      { role: SplitRole.AGENCY, percentage: 30 },
      { role: SplitRole.BROKER, percentage: 35, label: 'Corretor iniciante' },
      { role: SplitRole.MANAGER, percentage: 15 },
      { role: SplitRole.CAPTURER, percentage: 20 },
    ],
  },
  {
    id: 'veterano-captador',
    name: 'Veterano com captador',
    lines: [
      { role: SplitRole.AGENCY, percentage: 30 },
      { role: SplitRole.BROKER, percentage: 40, label: 'Corretor veterano' },
      { role: SplitRole.MANAGER, percentage: 10 },
      { role: SplitRole.CAPTURER, percentage: 20 },
    ],
  },
  {
    id: 'mercado',
    name: 'Mercado',
    lines: [
      { role: SplitRole.AGENCY, percentage: 30 },
      { role: SplitRole.BROKER, percentage: 50 },
      { role: SplitRole.CAPTURER, percentage: 20 },
    ],
  },
];

export const describePreset = (p: CommissionPreset) =>
  p.lines
    .map(l => `${l.role === SplitRole.AGENCY ? 'Fidelité' : l.label || l.role} ${l.percentage}%`)
    .join(' · ');
