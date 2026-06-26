import React, { useState, useMemo, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  RotateCcw, 
  AlertCircle, 
  MapPin, 
  User as UserIcon, 
  Calendar, 
  FileText, 
  DollarSign, 
  Percent, 
  CheckCircle2, 
  CreditCard, 
  GitBranch,
  X
} from 'lucide-react';
import { Sale, BrokerSplit, CommissionStatus, SplitRole, User, UserRole } from '../types';

interface SaleFormProps {
  agencyId: string;
  team: User[];
  onSave: (saleData: Omit<Sale, 'id' | 'splits'>, splitsData: Omit<BrokerSplit, 'id' | 'sale_id'>[]) => void;
  onCancel: () => void;
  editingSale?: Sale | null;
  onUpdate?: (saleId: string, saleData: Partial<Sale>, splitsData: Omit<BrokerSplit, 'id' | 'sale_id'>[]) => void;
}

interface TempSplit {
  brokerId: string;
  brokerName: string;
  percentage: number;
  role: SplitRole;
}

interface InstallmentItem {
  installment_number: number;
  value: number;
  valueStr: string;
  due_date: string;
  is_down_payment?: boolean;
}

// Robust Brazilian Real format to float number converter
const parseBrlValue = (valueStr: string): number => {
  if (!valueStr) return 0;
  let clean = valueStr.replace(/[R$\s]/gi, '');
  if (!clean) return 0;
  
  // If there is a comma, it is the decimal separator (BRL standard)
  if (clean.includes(',')) {
    clean = clean.replace(/\./g, '').replace(',', '.');
  } else {
    // No comma. If there is a dot:
    // A single dot followed by exactly 3 digits is assumed to be a thousands separator (e.g., "1.500" -> 1500, but "1500.50" -> 1500.50)
    // Multiple dots (e.g. "1.500.000") are also treated as thousands separators and removed.
    const dotCount = (clean.match(/\./g) || []).length;
    if (dotCount > 1) {
      clean = clean.replace(/\./g, '');
    } else if (dotCount === 1) {
      const parts = clean.split('.');
      if (parts[1].length === 3) {
        clean = clean.replace(/\./g, '');
      }
    }
  }
  
  const parsed = parseFloat(clean);
  return isNaN(parsed) ? 0 : parsed;
};

export const SaleForm: React.FC<SaleFormProps> = ({
  agencyId,
  team,
  onSave,
  onCancel,
  editingSale,
  onUpdate
}) => {
  // Main fields
  const [propertyAddress, setPropertyAddress] = useState('');
  const [saleDate, setSaleDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  
  // Participants
  const [buyerName, setBuyerName] = useState('');
  const [buyerCpf, setBuyerCpf] = useState('');
  const [sellerName, sellerSetName] = useState('');
  const [sellerCpf, setSellerCpf] = useState('');

  // Values
  const [vgv, setVgv] = useState<number>(0);
  const [vgvInputStr, setVgvInputStr] = useState<string>('');
  const [commissionPercentage, setCommissionPercentage] = useState<number>(6);

  // Installment
  const [isInstallment, setIsInstallment] = useState(false);
  const [installmentCount, setInstallmentCount] = useState<number>(4);
  const [firstDueDate, setFirstDueDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Custom & Down-payment installment states
  const [installmentPlanType, setInstallmentPlanType] = useState<'EQUAL' | 'CUSTOM'>('EQUAL');
  const [hasDownPayment, setHasDownPayment] = useState<boolean>(false);
  const [downPaymentValue, setDownPaymentValue] = useState<number>(0);
  const [downPaymentInputStr, setDownPaymentInputStr] = useState<string>('');
  const [installmentsList, setInstallmentsList] = useState<InstallmentItem[]>([]);
  const [hasLoadedEditingSale, setHasLoadedEditingSale] = useState(false);

  // Splits & Split UI modes
  const [tempSplits, setTempSplits] = useState<TempSplit[]>([]);
  const [splitMode, setSplitMode] = useState<'commission' | 'vgv'>('commission');

  // Load editing sale if any
  useEffect(() => {
    if (editingSale) {
      setPropertyAddress(editingSale.propertyAddress || '');
      setSaleDate(editingSale.saleDate || new Date().toISOString().split('T')[0]);
      setNotes(editingSale.notes || '');
      setBuyerName(editingSale.buyerName || '');
      setBuyerCpf(editingSale.buyer_cpf || '');
      sellerSetName(editingSale.sellerName || '');
      setSellerCpf(editingSale.seller_cpf || '');
      setVgv(editingSale.vgv || 0);
      if (editingSale.vgv) {
        setVgvInputStr(editingSale.vgv.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
      } else {
        setVgvInputStr('');
      }
      setCommissionPercentage(editingSale.commissionPercentage || 6);
      setIsInstallment(editingSale.is_installment || false);
      
      if (editingSale.installments && Array.isArray(editingSale.installments)) {
        setInstallmentCount(editingSale.installments.length || 1);
        if (editingSale.installments[0]?.due_date) {
          setFirstDueDate(editingSale.installments[0].due_date);
        }
        
        const mapped = editingSale.installments.map(inst => ({
          installment_number: inst.installment_number,
          value: inst.value,
          valueStr: inst.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
          due_date: inst.due_date,
          is_down_payment: inst.installment_number === 1 && editingSale.installments.length > 1
        }));
        setInstallmentsList(mapped);

        if (editingSale.installments.length > 1) {
          const firstVal = editingSale.installments[0].value;
          const isAllEqual = editingSale.installments.every(inst => Math.abs(inst.value - firstVal) < 0.05);
          setInstallmentPlanType(isAllEqual ? 'EQUAL' : 'CUSTOM');
          if (!isAllEqual) {
            setHasDownPayment(true);
            setDownPaymentValue(firstVal);
            setDownPaymentInputStr(firstVal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
          }
        } else {
          setInstallmentPlanType('EQUAL');
        }
      }

      if (editingSale.splits) {
        // Deduplicar por brokerId — venda parcelada tem um split por parcela por corretor
        const seen = new Set<string>();
        const mappedSplits = editingSale.splits
          .filter(split => {
            const key = `${split.brokerName}|${split.role || ''}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          })
          .map(split => ({
            brokerId: split.brokerId,
            brokerName: split.brokerName,
            percentage: split.percentage,
            role: split.role || SplitRole.BROKER
          }));
        setTempSplits(mappedSplits);
      }
      setHasLoadedEditingSale(true);
    } else {
      setTempSplits([
        {
          brokerId: 'AGENCY',
          brokerName: 'Agência (Imobiliária)',
          percentage: 100,
          role: SplitRole.AGENCY
        }
      ]);
      setHasLoadedEditingSale(true);
    }
  }, [editingSale]);

  const totalCommission = useMemo(() => {
    return Math.round(((vgv * commissionPercentage) / 100 + Number.EPSILON) * 100) / 100;
  }, [vgv, commissionPercentage]);

  // Helper to generate default list
  const generateDefaultInstallmentsList = (
    count: number,
    total: number,
    startDate: string,
    hasDown: boolean,
    downVal: number
  ): InstallmentItem[] => {
    const list: InstallmentItem[] = [];
    if (count <= 0 || total <= 0) return [];

    let d = new Date(startDate + 'T12:00:00');
    if (isNaN(d.getTime())) {
      d = new Date();
    }

    if (hasDown) {
      // 1st item is down payment
      const actualDown = Math.min(downVal, total);
      list.push({
        installment_number: 1,
        value: actualDown,
        valueStr: actualDown.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        due_date: startDate,
        is_down_payment: true
      });

      const remainingVal = Math.max(0, total - actualDown);
      const remainingCount = count - 1;
      if (remainingCount > 0) {
        const baseValue = Math.floor((remainingVal / remainingCount) * 100) / 100;
        let remainder = Math.round((remainingVal - baseValue * remainingCount) * 100) / 100;

        for (let i = 2; i <= count; i++) {
          const installmentDate = new Date(d);
          installmentDate.setMonth(d.getMonth() + (i - 1));
          
          const val = i === 2 ? Math.round((baseValue + remainder) * 100) / 100 : baseValue;
          
          list.push({
            installment_number: i,
            value: val,
            valueStr: val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
            due_date: installmentDate.toISOString().split('T')[0],
            is_down_payment: false
          });
        }
      }
    } else {
      // Split equally
      const baseValue = Math.floor((total / count) * 100) / 100;
      let remainder = Math.round((total - baseValue * count) * 100) / 100;

      for (let i = 1; i <= count; i++) {
        const installmentDate = new Date(d);
        installmentDate.setMonth(d.getMonth() + (i - 1));

        const val = i === 1 ? Math.round((baseValue + remainder) * 100) / 100 : baseValue;

        list.push({
          installment_number: i,
          value: val,
          valueStr: val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
          due_date: installmentDate.toISOString().split('T')[0],
          is_down_payment: false
        });
      }
    }

    return list;
  };

  // Sync installments list when core params change, but avoid overwriting loaded existing installments on mount
  useEffect(() => {
    if (!hasLoadedEditingSale) return;

    if (isInstallment) {
      const list = generateDefaultInstallmentsList(
        installmentCount,
        totalCommission,
        firstDueDate,
        hasDownPayment,
        downPaymentValue
      );
      setInstallmentsList(list);
    } else {
      setInstallmentsList([]);
    }
  }, [hasLoadedEditingSale, isInstallment, installmentCount, totalCommission, firstDueDate, hasDownPayment, downPaymentValue]);

  const installmentsSum = useMemo(() => {
    return installmentsList.reduce((acc, curr) => acc + curr.value, 0);
  }, [installmentsList]);

  const isInstallmentsSumValid = useMemo(() => {
    return Math.abs(installmentsSum - totalCommission) < 0.05;
  }, [installmentsSum, totalCommission]);

  const handleAutoAdjustInstallments = () => {
    if (installmentsList.length === 0) return;
    const currentSumExceptLast = installmentsList.slice(0, -1).reduce((acc, curr) => acc + curr.value, 0);
    const balancedLastValue = Math.max(0, Math.round((totalCommission - currentSumExceptLast) * 100) / 100);
    
    const updated = [...installmentsList];
    const lastIdx = updated.length - 1;
    updated[lastIdx] = {
      ...updated[lastIdx],
      value: balancedLastValue,
      valueStr: balancedLastValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    };
    setInstallmentsList(updated);
  };

  const handleUpdateInstallmentRow = (index: number, valOrStr: string | number, dueDate: string) => {
    const updated = [...installmentsList];
    let parsedVal = 0;
    let strVal = '';
    
    if (typeof valOrStr === 'number') {
      parsedVal = valOrStr;
      strVal = valOrStr.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } else {
      strVal = valOrStr;
      parsedVal = parseBrlValue(valOrStr);
    }

    updated[index] = {
      ...updated[index],
      value: parsedVal,
      valueStr: strVal,
      due_date: dueDate
    };
    setInstallmentsList(updated);
  };

  // Helpers to format CPF or CNPJ
  const formatCPFOrCNPJ = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 11) {
      return digits
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    } else {
      return digits
        .slice(0, 14)
        .replace(/^(\d{2})(\d)/, '$1.$2')
        .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
        .replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3/$4')
        .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
    }
  };

  // Format currency helper
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  // Quick distribution templates
  const applyQuickSplitTemplate = (type: '50-50' | '60-40' | '70-30' | '100-agency') => {
    if (type === '100-agency') {
      setTempSplits([
        {
          brokerId: 'AGENCY',
          brokerName: 'Agência (Imobiliária)',
          percentage: 100,
          role: SplitRole.AGENCY
        }
      ]);
      return;
    }

    // Attempt to distribute if we have at least 2 splits, or we generate them
    const brokerOption = filteredBrokers[0];
    const brokerId = brokerOption ? brokerOption.id : 'AGENCY';
    const brokerName = brokerOption ? brokerOption.name : 'Agência (Imobiliária)';

    if (type === '50-50') {
      setTempSplits([
        { brokerId: 'AGENCY', brokerName: 'Agência (Imobiliária)', percentage: 50, role: SplitRole.AGENCY },
        { brokerId: brokerId, brokerName: brokerName, percentage: 50, role: SplitRole.BROKER }
      ]);
    } else if (type === '60-40') {
      setTempSplits([
        { brokerId: 'AGENCY', brokerName: 'Agência (Imobiliária)', percentage: 60, role: SplitRole.AGENCY },
        { brokerId: brokerId, brokerName: brokerName, percentage: 40, role: SplitRole.BROKER }
      ]);
    } else if (type === '70-30') {
      setTempSplits([
        { brokerId: 'AGENCY', brokerName: 'Agência (Imobiliária)', percentage: 70, role: SplitRole.AGENCY },
        { brokerId: brokerId, brokerName: brokerName, percentage: 30, role: SplitRole.BROKER }
      ]);
    }
  };

  const handleAddBroker = () => {
    const defaultBroker = filteredBrokers[0] || { id: 'AGENCY', name: 'Agência (Imobiliária)' };
    const newSplit: TempSplit = {
      brokerId: defaultBroker.id === 'AGENCY' ? 'AGENCY' : defaultBroker.id,
      brokerName: defaultBroker.id === 'AGENCY' ? 'Agência (Imobiliária)' : defaultBroker.name,
      percentage: 0,
      role: SplitRole.BROKER
    };
    setTempSplits([...tempSplits, newSplit]);
  };

  const handleRemoveSplit = (index: number) => {
    setTempSplits(tempSplits.filter((_, i) => i !== index));
  };

  const handleUpdateSplit = (index: number, fields: Partial<TempSplit>) => {
    const updated = [...tempSplits];
    
    if (fields.brokerId !== undefined) {
      const bId = fields.brokerId;
      let bName = 'Agência (Imobiliária)';
      if (bId !== 'AGENCY') {
        const found = team.find(b => b.id === bId);
        if (found) bName = found.name;
      }
      updated[index] = {
        ...updated[index],
        brokerId: bId,
        brokerName: bName,
        ...fields
      };
    } else {
      updated[index] = {
        ...updated[index],
        ...fields
      };
    }
    
    setTempSplits(updated);
  };

  // Filter brokers in dropdown excluding the company user, if any
  const filteredBrokers = useMemo(() => {
    return team.filter(b => {
      const nameLower = b.name?.toLowerCase() || '';
      const emailLower = b.email?.toLowerCase() || '';
      const isCompany = nameLower === 'fidelité imobiliária' || nameLower === 'fidelite imobiliaria';
      return !isCompany;
    });
  }, [team]);

  const totalSplitPercentage = useMemo(() => {
    return tempSplits.reduce((acc, s) => acc + s.percentage, 0);
  }, [tempSplits]);

  const isSplitsValid = useMemo(() => {
    return Math.abs(totalSplitPercentage - 100) < 0.01;
  }, [totalSplitPercentage]);

  const progressColorClass = useMemo(() => {
    if (totalSplitPercentage === 0) return 'bg-slate-200';
    if (totalSplitPercentage === 100) return 'bg-emerald-500';
    if (totalSplitPercentage > 100) return 'bg-red-500';
    return 'bg-amber-500';
  }, [totalSplitPercentage]);

  const progressLabelColorClass = useMemo(() => {
    if (totalSplitPercentage === 0) return 'text-slate-400';
    if (totalSplitPercentage === 100) return 'text-emerald-600 font-bold';
    if (totalSplitPercentage > 100) return 'text-red-600 font-bold';
    return 'text-amber-500 font-semibold';
  }, [totalSplitPercentage]);

  const handleClearForm = () => {
    setPropertyAddress('');
    setSaleDate(new Date().toISOString().split('T')[0]);
    setNotes('');
    setBuyerName('');
    setBuyerCpf('');
    sellerSetName('');
    setSellerCpf('');
    setVgv(0);
    setVgvInputStr('');
    setCommissionPercentage(6);
    setIsInstallment(false);
    setInstallmentCount(4);
    setFirstDueDate(new Date().toISOString().split('T')[0]);
    setInstallmentPlanType('EQUAL');
    setHasDownPayment(false);
    setDownPaymentValue(0);
    setDownPaymentInputStr('');
    setInstallmentsList([]);
    setTempSplits([
      {
        brokerId: 'AGENCY',
        brokerName: 'Agência (Imobiliária)',
        percentage: 100,
        role: SplitRole.AGENCY
      }
    ]);
  };

  const handleSaveBtn = (isDraft = false) => {
    if (!propertyAddress.trim()) {
      alert('Endereço do imóvel é obrigatório.');
      return;
    }
    if (!buyerName.trim()) {
      alert('Nome do comprador é obrigatório.');
      return;
    }
    if (!sellerName.trim()) {
      alert('Nome do vendedor é obrigatório.');
      return;
    }
    if (vgv <= 0) {
      alert('O valor do VGV deve ser maior que zero.');
      return;
    }
    if (commissionPercentage <= 0) {
      alert('O percentual de comissão deve ser maior que zero.');
      return;
    }
    if (!isDraft && !isSplitsValid) {
      alert('Os splits de comissão devem somar exatamente 100%.');
      return;
    }

    if (isInstallment && !isDraft && !isInstallmentsSumValid) {
      alert(`A soma das parcelas (${formatCurrency(installmentsSum)}) não confere com o valor total da comissão (${formatCurrency(totalCommission)}). Por favor clique em 'Ajustar última parcela' ou ajuste manualmente.`);
      return;
    }

    // Generate installments array if installment mode is true
    const generatedInstallments = [];
    if (isInstallment && installmentsList.length > 0) {
      for (let i = 0; i < installmentsList.length; i++) {
        const inst = installmentsList[i];
        generatedInstallments.push({
          installment_number: inst.installment_number,
          percentage: totalCommission > 0 ? Math.round(((inst.value / totalCommission) * 100 + Number.EPSILON) * 100) / 100 : 0,
          value: inst.value,
          due_date: inst.due_date,
          status: (inst as any).status || 'PENDING'
        });
      }
    }

    const saleData: Omit<Sale, 'id' | 'splits'> = {
      agencyId,
      saleDate,
      propertyAddress,
      buyerName,
      sellerName,
      vgv,
      commissionPercentage,
      totalCommissionValue: totalCommission,
      invoiceIssued: editingSale ? editingSale.invoiceIssued : false,
      invoiceNumber: editingSale ? editingSale.invoiceNumber : '',
      notes,
      buyer_cpf: buyerCpf,
      seller_cpf: sellerCpf,
      is_installment: isInstallment,
      installments: isInstallment ? generatedInstallments : null,
      status: isDraft ? 'DRAFT' : (editingSale?.status || 'ACTIVE')
    };

    // Construct final splits with calculated values
    let finalSplits: Omit<BrokerSplit, 'id' | 'sale_id'>[] = [];

    if (isInstallment && installmentsList.length > 0) {
      installmentsList.forEach(parcela => {
        tempSplits.forEach(s => {
          const calculatedValue = Math.round(((parcela.value * s.percentage) / 100 + Number.EPSILON) * 100) / 100;
          finalSplits.push({
            brokerId: s.brokerId,
            brokerName: s.brokerName,
            percentage: s.percentage,
            calculatedValue,
            status: CommissionStatus.PENDING,
            role: s.role,
            forecastDate: parcela.due_date,
            installment_number: parcela.installment_number,
            total_installments: installmentCount
          });
        });
      });
    } else {
      finalSplits = tempSplits.map(s => {
        const calculatedValue = Math.round(((totalCommission * s.percentage) / 100 + Number.EPSILON) * 100) / 100;
        return {
          brokerId: s.brokerId,
          brokerName: s.brokerName,
          percentage: s.percentage,
          calculatedValue,
          status: CommissionStatus.PENDING,
          role: s.role,
          forecastDate: saleDate,
          installment_number: 1,
          total_installments: 1
        };
      });
    }

    if (editingSale && onUpdate) {
      onUpdate(editingSale.id, saleData, finalSplits);
    } else {
      onSave(saleData, finalSplits);
    }
  };

  return (
    <div className="bg-white rounded-[32px] border border-slate-200 overflow-hidden shadow-xl animate-in fade-in zoom-in-95 duration-200">
      {/* RICH HEADER */}
      <div className="bg-gradient-to-r from-[#1e3a5f] to-[#2563eb] p-6 text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black tracking-tight">
            {editingSale ? 'EDITAR DADOS DA VENDA' : 'CADASTRAR NOVA VENDA'}
          </h2>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="p-2 hover:bg-white/20 rounded-xl transition-colors text-white/80 hover:text-white"
          title="Fechar"
        >
          <X size={22} />
        </button>
      </div>

      <div className="p-6 md:p-8 space-y-8 max-h-[80vh] overflow-y-auto">
        {/* BLOCO 1: INFORMAÇÕES DO IMÓVEL */}
        <div className="bg-slate-50/40 border border-slate-100 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100 mb-2">
            <MapPin size={16} className="text-[#1e3a5f]" />
            <h3 className="text-[11px] font-black uppercase tracking-wider text-[#1e3a5f]">
              Bloco 1 — Informações do Imóvel
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-[#1e3a5f] block">
                Endereço Completo / Unidade *
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Ex: Av. T-10, Qd. 120, Lt. 14 - Ed. Metropolitan, Apto 1402"
                  value={propertyAddress}
                  onChange={(e) => setPropertyAddress(e.target.value)}
                  className="w-full pl-3 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm font-medium text-slate-800 shadow-sm"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-[#1e3a5f] block">
                Data da Assinatura / Venda *
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={saleDate}
                  onChange={(e) => setSaleDate(e.target.value)}
                  className="w-full px-3 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm font-medium text-slate-800 shadow-sm"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-[#1e3a5f] block">
              Observações / Notas de Vencimento NF (Opcional)
            </label>
            <textarea
              placeholder="Descreva detalhes como repasse diferenciado, bônus adicionais ou notas de vencimento fiscais."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm font-medium text-slate-800 shadow-sm"
            />
          </div>
        </div>

        {/* BLOCO 2: PARTICIPANTES DO NEGÓCIO */}
        <div className="bg-slate-50/40 border border-slate-100 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100 mb-2">
            <UserIcon size={16} className="text-[#1e3a5f]" />
            <h3 className="text-[11px] font-black uppercase tracking-wider text-[#1e3a5f]">
              Bloco 2 — Participantes do Negócio (Clientes)
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Comprador CARD */}
            <div className="border border-slate-100 rounded-xl p-4 bg-white/60 space-y-3">
              <span className="text-[9px] font-black uppercase tracking-widest text-blue-600 bg-blue-50 px-2.5 py-1 rounded">
                COMPRADOR / ADQUIRENTE
              </span>
              <div className="grid grid-cols-1 gap-2.5 pt-1">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                    Nome Completo *
                  </label>
                  <input
                    type="text"
                    placeholder="Nome do cliente comprador"
                    value={buyerName}
                    onChange={(e) => setBuyerName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-150 rounded-lg text-sm text-slate-800 font-medium"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                    CPF ou CNPJ (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="000.000.000-00 ou 00.000.000/0000-00"
                    value={buyerCpf}
                    onChange={(e) => setBuyerCpf(formatCPFOrCNPJ(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-150 rounded-lg text-sm text-slate-800 font-medium"
                  />
                </div>
              </div>
            </div>

            {/* Vendedor CARD */}
            <div className="border border-slate-100 rounded-xl p-4 bg-white/60 space-y-3">
              <span className="text-[9px] font-black uppercase tracking-widest text-[#b45309] bg-amber-50 px-2.5 py-1 rounded">
                PROPRIETÁRIO / VENDEDOR
              </span>
              <div className="grid grid-cols-1 gap-2.5 pt-1">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                    Nome Completo *
                  </label>
                  <input
                    type="text"
                    placeholder="Nome do proprietário vendedor"
                    value={sellerName}
                    onChange={(e) => sellerSetName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-150 rounded-lg text-sm text-slate-800 font-medium"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                    CPF ou CNPJ (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="000.000.000-00 ou 00.000.000/0000-00"
                    value={sellerCpf}
                    onChange={(e) => setSellerCpf(formatCPFOrCNPJ(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-150 rounded-lg text-sm text-slate-800 font-medium"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* BLOCO 3: VALORES E COMISSÃO */}
        <div className="bg-slate-50/40 border border-slate-100 rounded-2xl p-6">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100 mb-6">
            <DollarSign size={16} className="text-[#1e3a5f]" />
            <h3 className="text-[11px] font-black uppercase tracking-wider text-[#1e3a5f]">
              Bloco 3 — Parâmetros de Valores e Comissão
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-[#1e3a5f] block">
                VGV (Valor Bruto de Venda) *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">R$</span>
                <input
                  type="text"
                  placeholder="0,00"
                  value={vgvInputStr}
                  onChange={(e) => {
                    const rawVal = e.target.value;
                    setVgvInputStr(rawVal);
                    const parsed = parseBrlValue(rawVal);
                    setVgv(parsed);
                  }}
                  onBlur={() => {
                    const parsed = parseBrlValue(vgvInputStr);
                    if (parsed > 0) {
                      setVgv(parsed);
                      setVgvInputStr(parsed.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
                    } else {
                      setVgv(0);
                      setVgvInputStr('');
                    }
                  }}
                  className="w-full pl-9 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm font-bold text-slate-800 shadow-sm"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-[#1e3a5f] block">
                Comissão Contratual (%) *
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  placeholder="6"
                  value={commissionPercentage}
                  onChange={(e) => setCommissionPercentage(Number(e.target.value))}
                  className="w-full pr-8 pl-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm font-bold text-slate-800 shadow-sm"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">%</span>
              </div>
            </div>

            {/* Total calculated value Card */}
            <div className="bg-[#eff6ff] border border-blue-100 rounded-2xl p-4 flex flex-col justify-center h-[76px] mt-1">
              <span className="text-[9px] font-black uppercase tracking-wider text-blue-600 block text-center">
                VALOR TOTAL GERADO DE COMISSÃO
              </span>
              <p className="text-xl font-black text-blue-800 text-center mt-1">
                {formatCurrency(totalCommission)}
              </p>
            </div>
          </div>
        </div>

        {/* BLOCO 4: FORMA DE RECEBIMENTO */}
        <div className="bg-slate-50/40 border border-slate-100 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-2">
            <div className="flex items-center gap-2">
              <CreditCard size={16} className="text-[#1e3a5f]" />
              <h3 className="text-[11px] font-black uppercase tracking-wider text-[#1e3a5f]">
                Bloco 4 — Forma de Recebimento da Comissão
              </h3>
            </div>
            
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
              <button
                type="button"
                onClick={() => {
                  setIsInstallment(false);
                  setInstallmentCount(1);
                }}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                  !isInstallment 
                    ? 'bg-blue-600 text-white' 
                    : 'text-slate-400 hover:text-slate-600 bg-transparent'
                }`}
              >
                À Vista
              </button>
              <button
                type="button"
                onClick={() => setIsInstallment(true)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                  isInstallment 
                    ? 'bg-blue-600 text-white' 
                    : 'text-slate-400 hover:text-slate-600 bg-transparent'
                }`}
              >
                Parcelado / Diferido
              </button>
            </div>
          </div>

          {isInstallment ? (
            <div className="space-y-6 animate-in slide-in-from-top-2 duration-150">
              {/* Type of installment plan selection */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-100/50 p-4 rounded-xl border border-slate-200">
                <div className="space-y-1">
                  <span className="text-xs font-bold text-[#1e3a5f] block">Tipo de Parcelamento</span>
                  <span className="text-[11px] text-slate-500 font-medium">Escolha se as parcelas serão iguais ou se deseja incluir entrada e valores diferentes.</span>
                </div>
                <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
                  <button
                    type="button"
                    onClick={() => setInstallmentPlanType('EQUAL')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                      installmentPlanType === 'EQUAL'
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-400 hover:text-slate-600 bg-transparent'
                    }`}
                  >
                    Parcelas Iguais
                  </button>
                  <button
                    type="button"
                    onClick={() => setInstallmentPlanType('CUSTOM')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                      installmentPlanType === 'CUSTOM'
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-400 hover:text-slate-600 bg-transparent'
                    }`}
                  >
                    Entrada e parcelas (Diferentes)
                  </button>
                </div>
              </div>

              {/* Installment parameters */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#1e3a5f] block">
                    {installmentPlanType === 'CUSTOM' ? 'Número Total de Recebimentos' : 'Número de Parcelas'}
                  </label>
                  <select
                    value={installmentCount}
                    onChange={(e) => setInstallmentCount(Number(e.target.value))}
                    className="w-full px-3 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm font-semibold text-slate-800 shadow-sm"
                  >
                    {[2, 3, 4, 5, 6, 8, 10, 12, 18, 24, 30, 36].map(num => (
                      <option key={num} value={num}>{num}x {installmentPlanType === 'CUSTOM' && num === 4 ? '(Ex: Entrada + 3 parcelas)' : ''}</option>
                    ))}
                  </select>
                  <span className="text-[10px] text-slate-400 font-medium">
                    As previsões geram datas com intervalo mensal de 30 dias.
                  </span>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#1e3a5f] block">
                    Vencimento 1ª Parcela {hasDownPayment ? '(ou Entrada)' : ''}
                  </label>
                  <input
                    type="date"
                    value={firstDueDate}
                    onChange={(e) => setFirstDueDate(e.target.value)}
                    className="w-full px-3 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm font-medium text-slate-800 shadow-sm"
                  />
                </div>
              </div>

              {/* Custom Down Payment UI if CUSTOM is selected */}
              {installmentPlanType === 'CUSTOM' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border border-slate-200 bg-white p-4 rounded-xl shadow-sm animate-in fade-in duration-150">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[#1e3a5f] block">
                      Possui Entrada?
                    </label>
                    <div className="flex items-center gap-3 h-11">
                      <input
                        type="checkbox"
                        id="hasDownPayment"
                        checked={hasDownPayment}
                        onChange={(e) => {
                          setHasDownPayment(e.target.checked);
                          if (!e.target.checked) {
                            setDownPaymentValue(0);
                            setDownPaymentInputStr('');
                          }
                        }}
                        className="w-5 h-5 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                      />
                      <label htmlFor="hasDownPayment" className="text-sm font-semibold text-slate-700 cursor-pointer">
                        Sim, incluir valor de Entrada
                      </label>
                    </div>
                  </div>

                  {hasDownPayment && (
                    <div className="space-y-1 animate-in slide-in-from-left-2 duration-150">
                      <label className="text-[10px] font-black uppercase tracking-widest text-[#1e3a5f] block">
                        Valor da Entrada *
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">R$</span>
                        <input
                          type="text"
                          placeholder="0,00"
                          value={downPaymentInputStr}
                          onChange={(e) => {
                            const rawVal = e.target.value;
                            setDownPaymentInputStr(rawVal);
                            const parsed = parseBrlValue(rawVal);
                            setDownPaymentValue(parsed);
                          }}
                          onBlur={() => {
                            const parsed = parseBrlValue(downPaymentInputStr);
                            if (parsed > 0) {
                              setDownPaymentValue(parsed);
                              setDownPaymentInputStr(parsed.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
                            } else {
                              setDownPaymentValue(0);
                              setDownPaymentInputStr('');
                            }
                          }}
                          className="w-full pl-9 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm font-bold text-slate-800 shadow-sm"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Installment Rows Detail list */}
              <div className="space-y-3 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <span className="text-xs font-black text-[#1e3a5f] uppercase tracking-wider block">
                    Detalhamento das Parcelas
                  </span>
                  
                  {installmentPlanType === 'CUSTOM' && (
                    <button
                      type="button"
                      onClick={handleAutoAdjustInstallments}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl transition-all shadow-sm border border-blue-100"
                    >
                      <RotateCcw size={12} className="animate-spin-slow" />
                      Ajustar última parcela
                    </button>
                  )}
                </div>

                <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                  {installmentsList.map((item, idx) => (
                    <div key={item.installment_number} className="flex flex-col md:flex-row items-center gap-4 bg-slate-50 border border-slate-100 p-3 rounded-xl hover:border-slate-200 transition-colors">
                      <div className="w-full md:w-36 flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold flex items-center justify-center">
                          {item.installment_number}
                        </span>
                        <span className="text-xs font-black text-[#1e3a5f] uppercase">
                          {item.is_down_payment ? 'Entrada' : `Parcela ${item.installment_number}`}
                        </span>
                      </div>

                      <div className="w-full md:flex-1 space-y-1">
                        <label className="text-[9px] font-black uppercase tracking-wider text-slate-400 block md:hidden">Valor</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">R$</span>
                          <input
                            type="text"
                            disabled={installmentPlanType === 'EQUAL'}
                            value={item.valueStr}
                            onChange={(e) => {
                              if (installmentPlanType === 'EQUAL') return;
                              handleUpdateInstallmentRow(idx, e.target.value, item.due_date);
                            }}
                            onBlur={() => {
                              if (installmentPlanType === 'EQUAL') return;
                              const parsed = parseBrlValue(item.valueStr);
                              handleUpdateInstallmentRow(idx, parsed.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), item.due_date);
                            }}
                            className={`w-full pl-9 pr-4 py-2 bg-white border rounded-xl outline-none transition-all text-xs font-bold text-slate-800 shadow-sm ${
                              installmentPlanType === 'EQUAL'
                                ? 'bg-slate-100 text-slate-500 border-slate-200 cursor-not-allowed shadow-none'
                                : 'border-slate-200 focus:ring-2 focus:ring-blue-100'
                            }`}
                          />
                        </div>
                      </div>

                      <div className="w-full md:w-48 space-y-1">
                        <label className="text-[9px] font-black uppercase tracking-wider text-slate-400 block md:hidden">Vencimento</label>
                        <input
                          type="date"
                          disabled={installmentPlanType === 'EQUAL'}
                          value={item.due_date}
                          onChange={(e) => {
                            if (installmentPlanType === 'EQUAL') return;
                            handleUpdateInstallmentRow(idx, item.valueStr, e.target.value);
                          }}
                          className={`w-full px-3 py-2 bg-white border rounded-xl outline-none transition-all text-xs font-medium text-slate-800 shadow-sm ${
                            installmentPlanType === 'EQUAL'
                              ? 'bg-slate-100 text-slate-500 border-slate-200 cursor-not-allowed shadow-none'
                              : 'border-slate-200 focus:ring-2 focus:ring-blue-100'
                          }`}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Installments sum status */}
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-50 border border-slate-100 p-4 rounded-xl mt-2">
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Status da Alocação</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black text-[#1e3a5f]">
                        Total Alocado: {formatCurrency(installmentsSum)}
                      </span>
                      <span className="text-xs text-slate-400 font-medium">de {formatCurrency(totalCommission)}</span>
                    </div>
                  </div>

                  {isInstallmentsSumValid ? (
                    <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-600 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border border-emerald-100 shadow-sm">
                      <CheckCircle2 size={12} /> Valores Conciliados
                    </span>
                  ) : (
                    <div className="flex flex-col items-end gap-1">
                      <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-500 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border border-rose-100 shadow-sm">
                        <AlertCircle size={12} /> Diferença de {formatCurrency(Math.abs(totalCommission - installmentsSum))}
                      </span>
                      {installmentPlanType === 'CUSTOM' && (
                        <span className="text-[9px] text-slate-400 font-semibold">
                          Clique em "Ajustar última parcela" para conciliar o valor.
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl flex items-center gap-3">
              <CheckCircle2 size={20} className="text-emerald-500" />
              <div>
                <p className="text-xs font-black text-slate-700 uppercase tracking-wider">Recebimento Único</p>
                <p className="text-[11px] text-slate-400 font-medium">
                  A comissão entra em cota única de {formatCurrency(totalCommission)} na data {saleDate}.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* BLOCO 5: SPLITS DE REPASSE */}
        <div className="bg-slate-50/40 border border-slate-100 rounded-2xl p-6 space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <GitBranch size={16} className="text-[#1e3a5f]" />
              <h3 className="text-[11px] font-black uppercase tracking-wider text-[#1e3a5f]">
                Bloco 5 — Splits de Repasse de Comissão
              </h3>
            </div>

            <div className="flex items-center gap-4">
              {/* Split Mode Toggle */}
              <div className="flex items-center bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
                <button
                  type="button"
                  onClick={() => setSplitMode('commission')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                    splitMode === 'commission'
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-400 hover:text-slate-600 bg-transparent'
                  }`}
                >
                  % da Comissão
                </button>
                <button
                  type="button"
                  onClick={() => setSplitMode('vgv')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                    splitMode === 'vgv'
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-400 hover:text-slate-600 bg-transparent'
                  }`}
                >
                  % do VGV
                </button>
              </div>

              <button
                type="button"
                onClick={handleAddBroker}
                className="flex items-center gap-1 bg-[#1e3a5f]/10 hover:bg-[#1e3a5f]/20 text-[#1e3a5f] px-3 py-1.5 rounded-xl font-bold text-xs"
              >
                <Plus size={14} />
                + Corretor
              </button>
            </div>
          </div>

          {/* Quick Distribution Templates */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mr-2">Configurações Rápidas:</span>
            <button
              type="button"
              onClick={() => applyQuickSplitTemplate('100-agency')}
              className="px-2.5 py-1 text-[11px] font-bold bg-white border border-slate-200 hover:border-slate-350 rounded-lg text-slate-600"
            >
              100% Imobiliária
            </button>
            <button
              type="button"
              onClick={() => applyQuickSplitTemplate('50-50')}
              className="px-2.5 py-1 text-[11px] font-bold bg-white border border-slate-200 hover:border-slate-350 rounded-lg text-slate-600"
            >
              50/50 (Meio a Meio)
            </button>
            <button
              type="button"
              onClick={() => applyQuickSplitTemplate('60-40')}
              className="px-2.5 py-1 text-[11px] font-bold bg-white border border-slate-200 hover:border-slate-350 rounded-lg text-slate-600"
            >
              60/40 (Imob/Corretor)
            </button>
            <button
              type="button"
              onClick={() => applyQuickSplitTemplate('70-30')}
              className="px-2.5 py-1 text-[11px] font-bold bg-white border border-slate-200 hover:border-slate-350 rounded-lg text-slate-600"
            >
              70/30 (Imob/Corretor)
            </button>
          </div>

          {/* PROGRESS BAR FOR SPLITS */}
          <div className="bg-white border border-slate-100 rounded-2xl p-4 space-y-2 shadow-sm">
            <div className="flex justify-between items-center text-[10px] uppercase font-black">
              <span className="text-slate-400 tracking-widest">Soma da distribuição</span>
              <span className={progressLabelColorClass}>
                {totalSplitPercentage}% / 100%
              </span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden flex">
              <div
                className={`h-full transition-all duration-300 ${progressColorClass}`}
                style={{ width: `${Math.min(totalSplitPercentage, 100)}%` }}
              />
              {totalSplitPercentage > 100 && (
                <div
                  className="h-full bg-red-600 transition-all duration-300"
                  style={{ width: `${Math.min(totalSplitPercentage - 100, 100)}%` }}
                />
              )}
            </div>
            {totalSplitPercentage !== 100 && (
              <div className="flex items-center gap-1.5 text-[10px] font-semibold text-amber-600 pt-1">
                <AlertCircle size={12} />
                <span>O repasse total precisa somar exatamente 100% da comissão para aprovação do cadastro.</span>
              </div>
            )}
          </div>

          {/* SPLIT CARDS */}
          <div className="space-y-4">
            {tempSplits.map((split, idx) => {
              // Value equivalent
              const equivalentOfCommission = split.percentage;
              const equivalentOfVgv = vgv > 0 
                ? Math.round((((totalCommission * split.percentage) / 100) / vgv) * 100 * 100) / 100 
                : 0;

              return (
                <div key={idx} className="bg-white border border-slate-150 rounded-2xl p-4 grid grid-cols-1 md:grid-cols-12 gap-4 items-center shadow-sm relative hover:border-slate-300 transition-all">
                  
                  {/* Select Receiver */}
                  <div className="md:col-span-4 space-y-1">
                    <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">RECEBEDOR</label>
                    <select
                      value={split.brokerId}
                      onChange={(e) => handleUpdateSplit(idx, { brokerId: e.target.value })}
                      className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                    >
                      <option value="AGENCY">Fidelité Imobiliária (Agência)</option>
                      {filteredBrokers.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Select Role */}
                  <div className="md:col-span-3 space-y-1">
                    <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">FUNÇÃO / PAPEL</label>
                    <select
                      value={split.role}
                      onChange={(e) => handleUpdateSplit(idx, { role: e.target.value as SplitRole })}
                      className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                    >
                      <option value={SplitRole.BROKER}>{SplitRole.BROKER}</option>
                      <option value={SplitRole.CAPTURER}>{SplitRole.CAPTURER}</option>
                      <option value={SplitRole.MANAGER}>{SplitRole.MANAGER}</option>
                      <option value={SplitRole.PARTNER}>{SplitRole.PARTNER}</option>
                      <option value={SplitRole.AGENCY}>{SplitRole.AGENCY}</option>
                    </select>
                  </div>

                  {/* Split Percent Input container */}
                  <div className="md:col-span-2 space-y-1">
                    <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                      {splitMode === 'commission' ? '% DO REPASSE' : '% DO VGV'}
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        placeholder="0"
                        step="0.01"
                        value={
                          splitMode === 'commission'
                            ? split.percentage
                            : Math.round(((split.percentage * commissionPercentage) / 100 + Number.EPSILON) * 100) / 100
                        }
                        onChange={(e) => {
                          const inputVal = Number(e.target.value);
                          if (splitMode === 'commission') {
                            handleUpdateSplit(idx, { percentage: inputVal });
                          } else {
                            // Convert VGV % back to commission %
                            // (VGV_percentage / commissionPercentage) * 100
                            const commPct = commissionPercentage > 0 
                              ? Math.round(((inputVal / commissionPercentage) * 100 + Number.EPSILON) * 100) / 100 
                              : 0;
                            handleUpdateSplit(idx, { percentage: commPct });
                          }
                        }}
                        className="w-full pr-6 pl-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] font-bold">%</span>
                    </div>
                  </div>

                  {/* Dynamic value equivalence & outcome metrics */}
                  <div className="md:col-span-2 text-center md:text-left pt-2 md:pt-0">
                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block">VALOR EM R$</span>
                    <p className="text-xs font-black text-slate-800">
                      {formatCurrency((totalCommission * split.percentage) / 100)}
                    </p>
                    <span className="text-[9px] text-[#4f46e5] font-semibold">
                      {splitMode === 'commission' 
                        ? `≈ ${equivalentOfVgv}% do VGV` 
                        : `≈ ${equivalentOfCommission}% do Rep`
                      }
                    </span>
                  </div>

                  {/* Delete button */}
                  <div className="md:col-span-1 flex justify-end">
                    <button
                      type="button"
                      onClick={() => handleRemoveSplit(idx)}
                      className="p-1 px-2.5 bg-red-50 hover:bg-red-100 text-red-500 rounded-md transition-colors"
                      title="Excluir Split"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>

                </div>
              );
            })}

            {tempSplits.length === 0 && (
              <div className="text-center p-6 bg-white border border-dashed border-slate-200 rounded-2xl text-slate-400 text-xs font-semibold">
                Nenhum corretor adicionado no rateio. Clique em "+ Corretor" acima para cadastrar splits.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* FOOTER ACTIONS */}
      <div className="p-6 md:p-8 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row justify-end items-center gap-4">
        <div className="flex gap-4 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-2.5 text-gray-500 font-bold hover:text-gray-700 transition-colors rounded-lg text-sm border border-slate-200 bg-white"
          >
            Cancelar
          </button>
          
          {!editingSale && (
            <button
              type="button"
              onClick={() => handleSaveBtn(true)}
              className="px-6 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-lg text-sm transition-colors"
            >
              Salvar como Rascunho
            </button>
          )}

          <button
            type="button"
            onClick={() => handleSaveBtn(false)}
            disabled={!isSplitsValid}
            className={`px-8 py-2.5 rounded-lg font-bold text-sm flex items-center gap-2 transition-all ${
              isSplitsValid
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm hover:scale-[1.01]'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {editingSale ? 'Salvar Alterações' : 'Salvar Venda'}
          </button>
        </div>
      </div>
    </div>
  );
};
