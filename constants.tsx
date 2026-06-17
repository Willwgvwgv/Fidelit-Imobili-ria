
import React from 'react';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Wallet, 
  BarChart3, 
  Users, 
  Settings,
  ShieldCheck,
  Building2,
  Landmark,
  FileText,
  PieChart,
  RefreshCw,
  Tag,
  CreditCard
} from 'lucide-react';
import { UserRole, Sale, User, CommissionStatus, SplitRole } from './types';

export const CURRENT_AGENCY_ID = 'agency_001';

export const MOCK_USERS: User[] = [
  { id: 'u1', name: 'Admin Imobiliária', email: 'admin@comissone.com', role: UserRole.ADMIN, agencyId: CURRENT_AGENCY_ID },
  { id: 'u2', name: 'João Silva', email: 'joao@comissone.com', role: UserRole.BROKER, agencyId: CURRENT_AGENCY_ID },
  { id: 'u3', name: 'Maria Souza', email: 'maria@comissone.com', role: UserRole.BROKER, agencyId: CURRENT_AGENCY_ID },
  { id: 'u4', name: 'Ricardo Pereira', email: 'ricardo@comissone.com', role: UserRole.BROKER, agencyId: CURRENT_AGENCY_ID },
  { id: 'u5', name: 'Reginaldo Oliveira', email: 'reginaldo@comissone.com', role: UserRole.BROKER, agencyId: CURRENT_AGENCY_ID },
];

export const MOCK_SALES: Sale[] = [
  {
    id: 's1',
    agencyId: CURRENT_AGENCY_ID,
    saleDate: '2023-11-15',
    propertyAddress: 'Av. Paulista, 1000 - Apto 42',
    buyerName: 'Carlos Eduardo',
    sellerName: 'Construtora XYZ',
    vgv: 1200000,
    commissionPercentage: 6,
    totalCommissionValue: 72000,
    invoiceIssued: true,
    splits: [
      { brokerId: 'u2', brokerName: 'João Silva', percentage: 50, calculatedValue: 36000, status: CommissionStatus.PAID, paymentDate: '2023-11-20', paymentMethod: 'PIX', role: SplitRole.BROKER },
      { brokerId: 'u3', brokerName: 'Maria Souza', percentage: 50, calculatedValue: 36000, status: CommissionStatus.PENDING, role: SplitRole.BROKER }
    ]
  },
  {
    id: 's2',
    agencyId: CURRENT_AGENCY_ID,
    saleDate: '2024-02-20',
    propertyAddress: 'Rua Oscar Freire, 500 - Casa',
    buyerName: 'Fernanda Lima',
    sellerName: 'Proprietário Direto',
    vgv: 3500000,
    commissionPercentage: 5,
    totalCommissionValue: 175000,
    invoiceIssued: false,
    splits: [
      { brokerId: 'u4', brokerName: 'Ricardo Pereira', percentage: 100, calculatedValue: 175000, status: CommissionStatus.OVERDUE, role: SplitRole.BROKER }
    ]
  },
  {
    id: 's3',
    agencyId: CURRENT_AGENCY_ID,
    saleDate: '2024-03-05',
    propertyAddress: 'Alameda Santos, 222 - Sala 12',
    buyerName: 'Global Tech Ltda',
    sellerName: 'Invest Imóveis',
    vgv: 850000,
    commissionPercentage: 6,
    totalCommissionValue: 51000,
    invoiceIssued: true,
    splits: [
      { brokerId: 'u2', brokerName: 'João Silva', percentage: 70, calculatedValue: 35700, status: CommissionStatus.PENDING, role: SplitRole.BROKER },
      { brokerId: 'u3', brokerName: 'Maria Souza', percentage: 30, calculatedValue: 15300, status: CommissionStatus.PENDING, role: SplitRole.BROKER }
    ]
  },
  {
    id: 's4',
    agencyId: CURRENT_AGENCY_ID,
    saleDate: '2026-03-10',
    propertyAddress: 'Rua Amauri, 120 - Loft',
    buyerName: 'Reginaldo Oliveira',
    sellerName: 'Empreendimentos Alfa',
    vgv: 2400000,
    commissionPercentage: 6,
    totalCommissionValue: 144000,
    invoiceIssued: true,
    splits: [
      { brokerId: 'u5', brokerName: 'Reginaldo Oliveira', percentage: 30, calculatedValue: 43200, status: CommissionStatus.PENDING, role: SplitRole.BROKER },
      { brokerId: 'u5', brokerName: 'Reginaldo Oliveira', percentage: 10, calculatedValue: 14400, status: CommissionStatus.PENDING, role: SplitRole.CAPTURER },
      { brokerId: 'u5', brokerName: 'Reginaldo Oliveira', percentage: 5, calculatedValue: 7200, status: CommissionStatus.PENDING, role: SplitRole.PARTNER },
      { brokerId: 'AGENCY', brokerName: 'Agência (Imobiliária)', percentage: 55, calculatedValue: 79200, status: CommissionStatus.PENDING, role: SplitRole.AGENCY }
    ]
  },
  {
    id: 's5',
    agencyId: CURRENT_AGENCY_ID,
    saleDate: '2026-04-10',
    propertyAddress: 'Rua Haddock Lobo, 800',
    buyerName: 'Marcelo Vieira',
    sellerName: 'Renato Porto',
    vgv: 950000,
    commissionPercentage: 6,
    totalCommissionValue: 57000,
    invoiceIssued: false,
    splits: [
      { brokerId: 'u2', brokerName: 'João Silva', percentage: 50, calculatedValue: 28500, status: CommissionStatus.PENDING, role: SplitRole.BROKER, forecastDate: '2026-05-10' },
      { brokerId: 'u3', brokerName: 'Maria Souza', percentage: 50, calculatedValue: 28500, status: CommissionStatus.PENDING, role: SplitRole.BROKER, forecastDate: '2026-05-10' }
    ]
  }
];

export const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} />, roles: [UserRole.ADMIN, UserRole.BROKER] },
  { id: 'sales', label: 'Vendas', icon: <ShoppingCart size={20} />, roles: [UserRole.ADMIN] },
  { id: 'commissions', label: 'Comissões', icon: <Wallet size={20} />, roles: [UserRole.ADMIN, UserRole.BROKER] },
  { id: 'reports', label: 'Relatórios', icon: <BarChart3 size={20} />, roles: [UserRole.ADMIN] },
  { 
    id: 'financial', 
    label: 'Financeiro', 
    icon: <Landmark size={20} />, 
    roles: [UserRole.ADMIN],
    subItems: [
      { id: 'financial-extrato', label: 'Extrato', icon: <FileText size={18} /> },
      { id: 'financial-fluxo', label: 'Fluxo de Caixa', icon: <PieChart size={18} /> },
      { id: 'financial-cartoes', label: 'Cartões', icon: <CreditCard size={18} /> },
      { id: 'financial-contas', label: 'Contas Bancárias', icon: <Landmark size={18} /> },
      { id: 'financial-conciliacao', label: 'Conciliação Bancária', icon: <RefreshCw size={18} /> },
      { id: 'financial-categorias', label: 'Categorias', icon: <Tag size={18} /> },
    ]
  },
  { id: 'team', label: 'Equipe', icon: <Users size={20} />, roles: [UserRole.ADMIN] },
];
