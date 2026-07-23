import React, { useState } from 'react';
import {
  Settings,
  Save,
  Upload,
  Download,
  RefreshCw,
  CheckCircle2,
  Building,
  UserCheck,
  Share2,
  Database,
  Shield,
  Layers,
} from 'lucide-react';
import { CompanySettings } from '../types';

interface SettingsPageProps {
  settings: CompanySettings;
  onSaveSettings: (settings: CompanySettings) => void;
  onExportBackup: () => void;
  onImportBackup: (jsonStr: string) => boolean;
  onResetData: () => void;
  onNavigateTab: (tab: string) => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  settings,
  onSaveSettings,
  onExportBackup,
  onImportBackup,
  onResetData,
  onNavigateTab,
}) => {
  const [activeTab, setActiveTab] = useState<
    'company' | 'accountant' | 'categories' | 'comissione' | 'backup' | 'access'
  >('company');

  const [formData, setFormData] = useState<CompanySettings>(settings);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [backupStatus, setBackupStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleChange = (field: keyof CompanySettings, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (evt) => {
        setFormData((prev) => ({
          ...prev,
          logoBase64: evt.target?.result as string,
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings(formData);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleFileBackupImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const jsonContent = evt.target?.result as string;
        if (onImportBackup(jsonContent)) {
          setBackupStatus({ type: 'success', message: 'Backup restaurado com sucesso!' });
        } else {
          setBackupStatus({ type: 'error', message: 'Erro ao restaurar arquivo de backup. Formato inválido.' });
        }
        setTimeout(() => setBackupStatus(null), 4000);
      };
      reader.readAsText(e.target.files[0]);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Top Banner Header */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-2xs flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Settings className="w-5 h-5 text-blue-600" />
            Painel de Configurações do ERP (PrestConta / Comissione)
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Parâmetros da empresa imobiliária, escritório de contabilidade, integrações e backups.
          </p>
        </div>

        {savedSuccess && (
          <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            Configurações salvas!
          </span>
        )}
      </div>

      {/* Tabs Navigation Bar */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-2 shadow-2xs flex flex-wrap items-center gap-1.5 text-xs font-bold">
        <button
          onClick={() => setActiveTab('company')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg transition cursor-pointer ${
            activeTab === 'company'
              ? 'bg-blue-600 text-white shadow-2xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Building className="w-4 h-4" />
          <span>Empresa Imobiliária</span>
        </button>

        <button
          onClick={() => setActiveTab('accountant')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg transition cursor-pointer ${
            activeTab === 'accountant'
              ? 'bg-blue-600 text-white shadow-2xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>Contador & Fiscal</span>
        </button>

        <button
          onClick={() => onNavigateTab('categories')}
          className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-slate-600 hover:bg-slate-100 transition cursor-pointer"
        >
          <Layers className="w-4 h-4 text-purple-600" />
          <span>Plano de Contas / Categorias</span>
        </button>

        <button
          onClick={() => onNavigateTab('comissione')}
          className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-slate-600 hover:bg-slate-100 transition cursor-pointer"
        >
          <Share2 className="w-4 h-4 text-emerald-600" />
          <span>Integração Comissione</span>
        </button>

        <button
          onClick={() => setActiveTab('backup')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg transition cursor-pointer ${
            activeTab === 'backup'
              ? 'bg-blue-600 text-white shadow-2xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>Backup & Dados</span>
        </button>

        <button
          onClick={() => setActiveTab('access')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg transition cursor-pointer ${
            activeTab === 'access'
              ? 'bg-blue-600 text-white shadow-2xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>Aparência & Auditoria</span>
        </button>
      </div>

      {/* TAB 1: EMPRESA IMOBILIÁRIA */}
      {activeTab === 'company' && (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white border border-slate-200/90 rounded-xl p-6 shadow-2xs space-y-4">
            <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-3">
              <Building className="w-4 h-4 text-blue-600" />
              Identificação do Estabelecimento Imobiliário
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Razão Social / Nome Fantasia <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg h-10 px-3.5 text-xs text-slate-800 font-bold focus:ring-2 focus:ring-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  CNPJ <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.cnpj}
                  onChange={(e) => handleChange('cnpj', e.target.value)}
                  placeholder="00.000.000/0001-00"
                  className="w-full bg-white border border-slate-200 rounded-lg h-10 px-3.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-600 focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Responsável Financeiro / Gestor <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.responsible}
                  onChange={(e) => handleChange('responsible', e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg h-10 px-3.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Cidade
                  </label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => handleChange('city', e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg h-10 px-3 text-xs text-slate-800 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Estado (UF)
                  </label>
                  <input
                    type="text"
                    value={formData.state}
                    onChange={(e) => handleChange('state', e.target.value)}
                    maxLength={2}
                    className="w-full bg-white border border-slate-200 rounded-lg h-10 px-3 text-xs text-slate-800 uppercase focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  E-mail do Financeiro
                </label>
                <input
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) => handleChange('email', e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg h-10 px-3.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Telefone de Contato
                </label>
                <input
                  type="text"
                  value={formData.phone || ''}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg h-10 px-3.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                />
              </div>
            </div>

            {/* Logo upload */}
            <div className="pt-2">
              <label className="block text-xs font-semibold text-slate-700 mb-2">
                Logomarca da Empresa (Sairá no PDF do ERP)
              </label>
              <div className="flex items-center gap-4">
                {formData.logoBase64 ? (
                  <div className="p-2 border border-slate-200 rounded-lg bg-slate-50 shrink-0">
                    <img
                      src={formData.logoBase64}
                      alt="Logo preview"
                      className="h-10 object-contain"
                    />
                  </div>
                ) : (
                  <div className="w-16 h-12 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-center text-slate-400 text-[10px]">
                    Sem Logo
                  </div>
                )}

                <label className="h-10 flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-3.5 rounded-lg text-xs font-medium cursor-pointer transition shadow-2xs">
                  <Upload className="w-3.5 h-3.5 text-blue-600" />
                  <span>Upload Logo (PNG/JPG)</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="h-10 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-6 rounded-lg transition shadow-2xs cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Salvar Dados da Empresa</span>
            </button>
          </div>
        </form>
      )}

      {/* TAB 2: CONTADOR & FISCAL */}
      {activeTab === 'accountant' && (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white border border-slate-200/90 rounded-xl p-6 shadow-2xs space-y-4">
            <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-3">
              <UserCheck className="w-4 h-4 text-emerald-600" />
              Dados do Escritório Contábil Responsável
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nome da Contabilidade / Contador
                </label>
                <input
                  type="text"
                  value={formData.accountantName || ''}
                  onChange={(e) => handleChange('accountantName', e.target.value)}
                  placeholder="Ex: Contabilidade Silva & Associados"
                  className="w-full bg-white border border-slate-200 rounded-lg h-10 px-3.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  E-mail do Contador
                </label>
                <input
                  type="email"
                  value={formData.accountantEmail || ''}
                  onChange={(e) => handleChange('accountantEmail', e.target.value)}
                  placeholder="fiscal@contabilidade.com.br"
                  className="w-full bg-white border border-slate-200 rounded-lg h-10 px-3.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="h-10 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-6 rounded-lg transition shadow-2xs cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Salvar Dados do Contador</span>
            </button>
          </div>
        </form>
      )}

      {/* TAB 5: BACKUP & DATA RESTORE */}
      {activeTab === 'backup' && (
        <div className="bg-white border border-slate-200/90 rounded-xl p-6 shadow-2xs space-y-4">
          <h3 className="font-bold text-sm text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">
            <Database className="w-4 h-4 text-blue-600" />
            Backup, Restauração e Dados em LocalStorage
          </h3>

          {backupStatus && (
            <div className={`p-3 rounded-lg text-xs font-semibold ${
              backupStatus.type === 'success'
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border border-rose-200 text-rose-800'
            }`}>
              {backupStatus.message}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={onExportBackup}
              className="h-10 flex items-center gap-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-medium text-xs px-4 rounded-lg transition shadow-2xs cursor-pointer"
            >
              <Download className="w-4 h-4 text-blue-600" />
              <span>Exportar Backup Completo (JSON)</span>
            </button>

            <label className="h-10 flex items-center gap-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-medium text-xs px-4 rounded-lg transition shadow-2xs cursor-pointer">
              <Upload className="w-4 h-4 text-emerald-600" />
              <span>Restaurar Backup (JSON)</span>
              <input
                type="file"
                accept=".json"
                onChange={handleFileBackupImport}
                className="hidden"
              />
            </label>

            <button
              onClick={onResetData}
              className="h-10 flex items-center gap-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 font-medium text-xs px-4 rounded-lg transition border border-rose-200/80 cursor-pointer ml-auto"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Restaurar Dados Iniciais</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 6: APARÊNCIA & PERMISSÕES */}
      {activeTab === 'access' && (
        <div className="bg-white border border-slate-200/90 rounded-xl p-6 shadow-2xs space-y-4">
          <h3 className="font-bold text-sm text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">
            <Shield className="w-4 h-4 text-purple-600" />
            Controle de Perfis & Auditoria do ERP
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
              <p className="font-bold text-slate-800">Perfil Ativo</p>
              <p className="text-slate-500 mt-0.5">Administrador Financeiro</p>
              <span className="inline-block bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded text-[10px] mt-2">
                Acesso Total
              </span>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
              <p className="font-bold text-slate-800">Versão do Sistema</p>
              <p className="text-slate-500 mt-0.5">Comissione Finance / PrestConta v2.4.0</p>
              <span className="inline-block bg-emerald-100 text-emerald-700 font-bold px-2 py-0.5 rounded text-[10px] mt-2">
                Conectado
              </span>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
              <p className="font-bold text-slate-800">Modo de Persistência</p>
              <p className="text-slate-500 mt-0.5">LocalStorage Criptografado</p>
              <span className="inline-block bg-purple-100 text-purple-700 font-bold px-2 py-0.5 rounded text-[10px] mt-2">
                Sem Perda de Dados
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
