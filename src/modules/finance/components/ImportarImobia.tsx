import React, { useState } from 'react';
import { Upload, Building2, CheckCircle2, AlertCircle, Loader2, FileSpreadsheet, ArrowRight } from 'lucide-react';
import { supabase } from '../../../../supabase';
import { User } from '../../../../types';

interface ImportarImobiaProps {
  currentUser: User;
  showToast?: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  onImportDone?: () => void;
}

interface ParsedContractRow {
  property_address: string;
  tenant_name: string;
  tenant_document: string;
  owner_name: string;
  monthly_rent: number;
  brokerage_fee_pct: number;
  start_date: string;
  day_of_month: number;
}

export const ImportarImobia: React.FC<ImportarImobiaProps> = ({
  currentUser,
  showToast,
  onImportDone,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedContractRow[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  // Column mapping states
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawLines, setRawLines] = useState<string[][]>([]);

  const handleFileChange = (selectedFile: File) => {
    setFile(selectedFile);
    setIsParsing(true);
    setParsedRows([]);

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = (e.target?.result as string) || '';
      const lines = content.split(/\r?\n/).filter((l) => l.trim() !== '');

      if (lines.length === 0) {
        setIsParsing(false);
        return;
      }

      const delimiter = content.includes(';') ? ';' : ',';
      const fileHeaders = lines[0].split(delimiter).map((h) => h.trim().replace(/^["']|["']$/g, ''));
      setHeaders(fileHeaders);

      const parsedData: ParsedContractRow[] = [];
      const dataLines: string[][] = [];

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(delimiter).map((c) => c.trim().replace(/^["']|["']$/g, ''));
        if (cols.length < 3) continue;
        dataLines.push(cols);

        // Auto-detect indices
        let imovelIdx = fileHeaders.findIndex((h) => /imovel|imóvel|endereco|endereço|propriedade/i.test(h));
        let tenantIdx = fileHeaders.findIndex((h) => /inquilino|locatario|locatário|cliente/i.test(h));
        let cpfIdx = fileHeaders.findIndex((h) => /cpf|cnpj|documento/i.test(h));
        let ownerIdx = fileHeaders.findIndex((h) => /proprietario|proprietário|locador/i.test(h));
        let rentIdx = fileHeaders.findIndex((h) => /valor|aluguel|mensalidade/i.test(h));
        let feeIdx = fileHeaders.findIndex((h) => /taxa|adm|comissao|comissão/i.test(h));
        let dateIdx = fileHeaders.findIndex((h) => /inicio|início|data|start/i.test(h));
        let dayIdx = fileHeaders.findIndex((h) => /vencimento|dia/i.test(h));

        if (imovelIdx === -1) imovelIdx = 0;
        if (tenantIdx === -1) tenantIdx = 1;
        if (rentIdx === -1) rentIdx = 2;

        const property_address = cols[imovelIdx] || 'Imóvel imobia.app';
        const tenant_name = cols[tenantIdx] || 'Inquilino';
        const tenant_document = cpfIdx !== -1 ? cols[cpfIdx] || '' : '';
        const owner_name = ownerIdx !== -1 ? cols[ownerIdx] || 'Proprietário' : 'Proprietário';

        // Parse monetary rent
        let rawRent = cols[rentIdx] || '0';
        rawRent = rawRent.replace(/[R$\s]/gi, '');
        if (/\d+\.\d+,\d+/.test(rawRent)) {
          rawRent = rawRent.replace(/\./g, '').replace(',', '.');
        } else if (rawRent.includes(',') && !rawRent.includes('.')) {
          rawRent = rawRent.replace(',', '.');
        }
        const monthly_rent = Math.abs(parseFloat(rawRent)) || 1000;

        // Parse fee
        let brokerage_fee_pct = 10;
        if (feeIdx !== -1 && cols[feeIdx]) {
          const parsedFee = parseFloat(cols[feeIdx].replace(',', '.'));
          if (!isNaN(parsedFee) && parsedFee > 0) brokerage_fee_pct = parsedFee;
        }

        // Parse date
        let start_date = new Date().toISOString().split('T')[0];
        if (dateIdx !== -1 && cols[dateIdx]) {
          const rawDate = cols[dateIdx];
          if (rawDate.includes('/')) {
            const p = rawDate.split('/');
            if (p.length === 3) {
              const d = p[0].padStart(2, '0');
              const m = p[1].padStart(2, '0');
              const y = p[2].length === 2 ? `20${p[2]}` : p[2];
              start_date = `${y}-${m}-${d}`;
            }
          } else if (rawDate.includes('-')) {
            start_date = rawDate;
          }
        }

        // Parse day of month
        let day_of_month = 5;
        if (dayIdx !== -1 && cols[dayIdx]) {
          const parsedDay = parseInt(cols[dayIdx], 10);
          if (!isNaN(parsedDay) && parsedDay >= 1 && parsedDay <= 31) {
            day_of_month = parsedDay;
          }
        }

        parsedData.push({
          property_address,
          tenant_name,
          tenant_document,
          owner_name,
          monthly_rent,
          brokerage_fee_pct,
          start_date,
          day_of_month,
        });
      }

      setRawLines(dataLines);
      setParsedRows(parsedData);
      setIsParsing(false);
    };
    reader.readAsText(selectedFile, 'ISO-8859-1');
  };

  const handleConfirmImport = async () => {
    if (!supabase || !parsedRows.length) return;
    setIsImporting(true);

    try {
      let createdContractsCount = 0;
      let createdInstallmentsCount = 0;

      for (const item of parsedRows) {
        // Insert rent_contracts
        const contractPayload = {
          agency_id: currentUser.agencyId,
          property_address: item.property_address,
          tenant_name: item.tenant_name,
          tenant_document: item.tenant_document,
          owner_name: item.owner_name,
          monthly_rent: item.monthly_rent,
          brokerage_fee_pct: item.brokerage_fee_pct,
          start_date: item.start_date,
          day_of_month: item.day_of_month,
          status: 'active',
          imported_from: 'imobia.app',
          seguro_locaticio_value: 0,
          seguro_incendio_value: 0,
          outras_taxas_value: 0,
        };

        const { data: contractData, error: contractErr } = await supabase
          .from('rent_contracts')
          .insert(contractPayload)
          .select()
          .single();

        if (contractErr) {
          console.error('Error inserting rent contract:', contractErr);
          continue;
        }

        createdContractsCount++;

        // Generate installments for current month + retroactive if start_date < current month
        const startDateObj = new Date(item.start_date);
        const today = new Date();

        let currentIterDate = new Date(startDateObj.getFullYear(), startDateObj.getMonth(), item.day_of_month);
        const endIterDate = new Date(today.getFullYear(), today.getMonth(), item.day_of_month);

        while (currentIterDate <= endIterDate) {
          const dueDateStr = currentIterDate.toISOString().split('T')[0];
          const expectedFee = item.monthly_rent * (item.brokerage_fee_pct / 100);
          const seguroLocaticio = Number(contractData.seguro_locaticio_value || 0);
          const seguroIncendio = Number(contractData.seguro_incendio_value || 0);
          const outrasTaxas = Number(contractData.outras_taxas_value || 0);
          // Nova fórmula de repasse para parcelas geradas a partir de agora:
          const ownerRepasse = item.monthly_rent - expectedFee - seguroLocaticio - seguroIncendio - outrasTaxas;

          const installmentPayload = {
            contract_id: contractData.id,
            agency_id: currentUser.agencyId,
            due_date: dueDateStr,
            expected_amount: item.monthly_rent,
            expected_fee: expectedFee,
            owner_repasse_amount: ownerRepasse,
            seguro_locaticio_amount: seguroLocaticio,
            seguro_incendio_amount: seguroIncendio,
            outras_taxas_amount: outrasTaxas,
            broker_commission_pct: null,
            broker_commission_amount: 0,
            broker_commission_launched: false,
            status: currentIterDate < today ? 'overdue' : 'pending',
          };

          const { error: instErr } = await supabase
            .from('rent_installments')
            .upsert(installmentPayload, { onConflict: 'contract_id,due_date' });

          if (!instErr) createdInstallmentsCount++;

          // Advance 1 month
          currentIterDate.setMonth(currentIterDate.getMonth() + 1);
        }
      }

      if (showToast) {
        showToast(
          `Sucesso! ${createdContractsCount} contratos do imobia.app importados e ${createdInstallmentsCount} parcelas geradas.`,
          'success'
        );
      }

      if (onImportDone) onImportDone();
    } catch (err: any) {
      console.error('Erro ao importar contratos:', err);
      if (showToast) showToast('Erro ao importar contratos do imobia.app.', 'error');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-6">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div>
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Building2 size={20} className="text-indigo-600" />
            Importar Contratos de Aluguel (imobia.app)
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Faça upload do relatório de contratos exportado do imobia.app em formato CSV.
          </p>
        </div>
      </div>

      {/* Upload Dropzone */}
      <div className="border-2 border-dashed border-indigo-200 hover:border-indigo-400 bg-indigo-50/30 rounded-2xl p-8 text-center transition-all cursor-pointer relative">
        <input
          type="file"
          accept=".csv,.txt"
          onChange={(e) => e.target.files && e.target.files[0] && handleFileChange(e.target.files[0])}
          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
        />
        <div className="flex flex-col items-center justify-center gap-2">
          <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center">
            <FileSpreadsheet size={24} />
          </div>
          <p className="text-sm font-bold text-slate-700">
            {file ? file.name : 'Arraste a planilha do imobia.app aqui (.csv)'}
          </p>
          <p className="text-xs text-slate-500">
            Colunas mapeadas automaticamente: imóvel, inquilino, aluguel, taxa adm, início, vencimento
          </p>
        </div>
      </div>

      {isParsing && (
        <div className="flex items-center justify-center gap-2 py-6 text-indigo-600 text-sm font-semibold">
          <Loader2 className="animate-spin" size={20} />
          <span>Mapeando colunas e lendo contratos do imobia.app...</span>
        </div>
      )}

      {!isParsing && parsedRows.length > 0 && (
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Prévia dos Contratos Encontrados ({parsedRows.length} contratos)
            </span>
            <span className="text-xs text-slate-500">
              Serão geradas parcelas para o mês atual e retroativos
            </span>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                  <th className="p-3">Inquilino</th>
                  <th className="p-3">Imóvel</th>
                  <th className="p-3 text-right">Aluguel Mensal</th>
                  <th className="p-3 text-center">Taxa Adm (%)</th>
                  <th className="p-3 text-center">Vencimento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {parsedRows.slice(0, 10).map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80">
                    <td className="p-3 font-bold text-slate-800">{row.tenant_name}</td>
                    <td className="p-3 text-slate-600">{row.property_address}</td>
                    <td className="p-3 font-bold text-right text-emerald-600 font-mono">
                      R$ {row.monthly_rent.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3 text-center font-semibold text-slate-700">{row.brokerage_fee_pct}%</td>
                    <td className="p-3 text-center font-mono">Dia {row.day_of_month}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={handleConfirmImport}
              disabled={isImporting}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl transition-all shadow-xs flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {isImporting ? (
                <>
                  <Loader2 className="animate-spin" size={16} />
                  <span>Cadastrando Contratos e Gerando Parcelas...</span>
                </>
              ) : (
                <>
                  <span>Importar {parsedRows.length} Contratos e Gerar Parcelas</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
