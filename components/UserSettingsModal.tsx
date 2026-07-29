import React, { useState } from 'react';
import { X, User as UserIcon, Camera, Key, Lock, Phone, Mail, Shield, Check, Loader2, AlertCircle } from 'lucide-react';
import { User } from '../types';
import { supabaseService } from '../services/supabaseService';

interface UserSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  onUserUpdated: (updatedUser: User) => void;
  initialTab?: 'profile' | 'password';
}

export const UserSettingsModal: React.FC<UserSettingsModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onUserUpdated,
  initialTab = 'profile'
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'password'>(initialTab);
  
  // Profile state
  const [name, setName] = useState(currentUser.name || '');
  const [phone, setPhone] = useState(currentUser.phone || '');
  const [avatarUrl, setAvatarUrl] = useState(currentUser.avatarUrl || '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState<string | null>(null);
  const [profileErrorMsg, setProfileErrorMsg] = useState<string | null>(null);

  // Password state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [passwordSuccessMsg, setPasswordSuccessMsg] = useState<string | null>(null);
  const [passwordErrorMsg, setPasswordErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  // Handle photo upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 3 * 1024 * 1024) {
        alert('A foto deve ter no máximo 3MB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setProfileErrorMsg('O nome é obrigatório.');
      return;
    }

    setIsSavingProfile(true);
    setProfileSuccessMsg(null);
    setProfileErrorMsg(null);

    try {
      const updatedData = {
        name: name.trim(),
        phone: phone.trim(),
        avatarUrl
      };

      const success = await supabaseService.updateUserProfile(currentUser.id, updatedData);

      const updatedUser: User = {
        ...currentUser,
        name: updatedData.name,
        phone: updatedData.phone,
        avatarUrl: updatedData.avatarUrl
      };

      onUserUpdated(updatedUser);
      setProfileSuccessMsg('Perfil atualizado com sucesso!');
      setTimeout(() => setProfileSuccessMsg(null), 3000);
    } catch (err: any) {
      setProfileErrorMsg(err.message || 'Erro ao salvar perfil.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordSuccessMsg(null);
    setPasswordErrorMsg(null);

    if (newPassword.length < 6) {
      setPasswordErrorMsg('A senha deve conter no mínimo 6 caracteres.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordErrorMsg('As senhas não coincidem.');
      return;
    }

    setIsSavingPassword(true);

    try {
      const res = await supabaseService.updateUserPassword(newPassword);
      if (res.success) {
        setPasswordSuccessMsg('Senha alterada com sucesso!');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => setPasswordSuccessMsg(null), 4000);
      } else {
        setPasswordErrorMsg(res.error || 'Erro ao alterar senha.');
      }
    } catch (err: any) {
      setPasswordErrorMsg(err.message || 'Erro inesperado.');
    } finally {
      setIsSavingPassword(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header do Modal */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-2xl backdrop-blur-md">
              <UserIcon size={20} className="text-indigo-300" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Configurações da Conta</h3>
              <p className="text-xs text-slate-300">Gerencie seu perfil, dados pessoais e senha</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100 bg-slate-50/80 px-6 pt-3 gap-2">
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 cursor-pointer ${
              activeTab === 'profile'
                ? 'bg-white text-indigo-600 border-indigo-600 shadow-xs'
                : 'text-slate-500 border-transparent hover:text-slate-800'
            }`}
          >
            <UserIcon size={14} />
            Meu Perfil & Foto
          </button>

          <button
            onClick={() => setActiveTab('password')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 cursor-pointer ${
              activeTab === 'password'
                ? 'bg-white text-indigo-600 border-indigo-600 shadow-xs'
                : 'text-slate-500 border-transparent hover:text-slate-800'
            }`}
          >
            <Key size={14} />
            Alterar Senha
          </button>
        </div>

        {/* Conteúdo da Tab Profile */}
        {activeTab === 'profile' && (
          <form onSubmit={handleSaveProfile} className="p-6 space-y-5">
            {profileSuccessMsg && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200/80 text-emerald-800 rounded-2xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
                <Check size={16} className="text-emerald-600 shrink-0" />
                {profileSuccessMsg}
              </div>
            )}

            {profileErrorMsg && (
              <div className="p-3.5 bg-rose-50 border border-rose-200/80 text-rose-800 rounded-2xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
                <AlertCircle size={16} className="text-rose-600 shrink-0" />
                {profileErrorMsg}
              </div>
            )}

            {/* Upload de Foto */}
            <div className="flex items-center gap-5 bg-slate-50/80 p-4 rounded-2xl border border-slate-100">
              <div className="relative group shrink-0">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={currentUser.name}
                    className="w-16 h-16 rounded-2xl object-cover border-2 border-indigo-500 shadow-sm"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-indigo-600 text-white font-black text-2xl flex items-center justify-center shadow-sm">
                    {currentUser.name.charAt(0).toUpperCase()}
                  </div>
                )}

                <label
                  htmlFor="avatar-upload"
                  className="absolute -bottom-1 -right-1 bg-indigo-600 hover:bg-indigo-700 text-white p-1.5 rounded-xl shadow-md cursor-pointer transition-transform hover:scale-110 flex items-center justify-center"
                  title="Alterar Foto"
                >
                  <Camera size={13} />
                </label>
                <input
                  id="avatar-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-800">Foto do Perfil</p>
                <p className="text-[11px] text-slate-400 mt-0.5 mb-2">JPG, PNG ou WEBP (máx 3MB)</p>
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="avatar-upload"
                    className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-100 transition-colors cursor-pointer shadow-2xs"
                  >
                    Escolher Imagem
                  </label>
                  {avatarUrl && (
                    <button
                      type="button"
                      onClick={() => setAvatarUrl('')}
                      className="px-3 py-1.5 text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                    >
                      Remover
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Form Fields */}
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                  Nome Completo
                </label>
                <div className="relative">
                  <UserIcon size={16} className="absolute left-3.5 top-3 text-slate-400" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    placeholder="Seu nome completo"
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 text-xs font-medium text-slate-800 outline-none transition-all shadow-2xs"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                  Telefone / WhatsApp
                </label>
                <div className="relative">
                  <Phone size={16} className="absolute left-3.5 top-3 text-slate-400" />
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(62) 99999-9999"
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 text-xs font-medium text-slate-800 outline-none transition-all shadow-2xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                    E-mail de Acesso
                  </label>
                  <div className="relative">
                    <Mail size={15} className="absolute left-3.5 top-3 text-slate-300" />
                    <input
                      type="text"
                      disabled
                      value={currentUser.email}
                      className="w-full pl-10 pr-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-500 cursor-not-allowed"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                    Cargo / Nível
                  </label>
                  <div className="relative">
                    <Shield size={15} className="absolute left-3.5 top-3 text-slate-300" />
                    <input
                      type="text"
                      disabled
                      value={currentUser.role === 'ADMIN' ? 'Administrador' : 'Corretor'}
                      className="w-full pl-10 pr-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-500 cursor-not-allowed"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSavingProfile}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {isSavingProfile ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Salvando...
                  </>
                ) : (
                  'Salvar Alterações'
                )}
              </button>
            </div>
          </form>
        )}

        {/* Conteúdo da Tab Password */}
        {activeTab === 'password' && (
          <form onSubmit={handleChangePassword} className="p-6 space-y-5">
            {passwordSuccessMsg && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200/80 text-emerald-800 rounded-2xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
                <Check size={16} className="text-emerald-600 shrink-0" />
                {passwordSuccessMsg}
              </div>
            )}

            {passwordErrorMsg && (
              <div className="p-3.5 bg-rose-50 border border-rose-200/80 text-rose-800 rounded-2xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
                <AlertCircle size={16} className="text-rose-600 shrink-0" />
                {passwordErrorMsg}
              </div>
            )}

            <div className="bg-amber-50/80 border border-amber-200/70 p-3.5 rounded-2xl text-amber-900 text-xs leading-relaxed flex items-start gap-2.5">
              <Lock size={16} className="text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Segurança da Senha</p>
                <p className="text-[11px] text-amber-800 mt-0.5">
                  Sua nova senha deve ter no mínimo 6 caracteres. Após a alteração, use a nova senha em seus próximos acessos.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                  Nova Senha
                </label>
                <div className="relative">
                  <Key size={16} className="absolute left-3.5 top-3 text-slate-400" />
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 text-xs font-medium text-slate-800 outline-none transition-all shadow-2xs"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                  Confirmar Nova Senha
                </label>
                <div className="relative">
                  <Key size={16} className="absolute left-3.5 top-3 text-slate-400" />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 text-xs font-medium text-slate-800 outline-none transition-all shadow-2xs"
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSavingPassword || !newPassword || !confirmPassword}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {isSavingPassword ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Atualizando...
                  </>
                ) : (
                  'Atualizar Senha'
                )}
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
};

export default UserSettingsModal;
