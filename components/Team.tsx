
import React, { useState } from 'react';
import { 
  Plus, 
  Edit, 
  Trash2, 
  UserPlus, 
  X, 
  Mail, 
  Shield, 
  User as UserIcon 
} from 'lucide-react';
import { User, UserRole } from '../types';

interface TeamProps {
  team: User[];
  setTeam: React.Dispatch<React.SetStateAction<User[]>>;
  currentUser: User;
}

const Team: React.FC<TeamProps> = ({ team, setTeam, currentUser }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState<Partial<User>>({
    name: '',
    email: '',
    role: UserRole.BROKER
  });

  const openModal = (user?: User) => {
    if (user) {
      setEditingUser(user);
      setFormData(user);
    } else {
      setEditingUser(null);
      setFormData({
        name: '',
        email: '',
        role: UserRole.BROKER
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingUser(null);
  };

  const handleSave = () => {
    if (!formData.name || !formData.email) {
      alert("Por favor, preencha nome e e-mail.");
      return;
    }

    if (editingUser) {
      setTeam(prev => prev.map(u => u.id === editingUser.id ? { ...u, ...formData as User } : u));
    } else {
      const newUser: User = {
        id: `u-${Date.now()}`,
        name: formData.name!,
        email: formData.email!,
        role: formData.role as UserRole,
        agencyId: currentUser.agencyId
      };
      setTeam(prev => [...prev, newUser]);
    }
    closeModal();
  };

  const handleRemove = (id: string) => {
    if (id === currentUser.id) {
      alert("Você não pode remover a si mesmo.");
      return;
    }
    if (confirm("Tem certeza que deseja remover este membro da equipe?")) {
      setTeam(prev => prev.filter(u => u.id !== id));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header com Botão Adicionar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-800">Membros da Equipe</h3>
          <p className="text-sm text-slate-400">Gerencie os acessos e perfis da sua imobiliária.</p>
        </div>
        <button 
          onClick={() => openModal()}
          className="w-full sm:w-auto flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl font-bold transition-all shadow-lg shadow-blue-200"
        >
          <UserPlus size={20} /> Adicionar Membro
        </button>
      </div>

      {/* Grid de Membros */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {team.map(user => (
          <div key={user.id} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col transition-all hover:shadow-md group relative">
            {/* Ações Rápidas (Pencil / Trash) */}
            <div className="absolute top-4 right-4 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button 
                onClick={() => openModal(user)}
                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title="Editar"
              >
                <Edit size={16} />
              </button>
              {user.id !== currentUser.id && (
                <button 
                  onClick={() => handleRemove(user.id)}
                  className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Remover"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>

            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-xl border-2 border-white shadow-sm">
                {user.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-slate-800 truncate">{user.name}</h4>
                <p className="text-xs text-slate-400 truncate flex items-center gap-1">
                  <Mail size={12} /> {user.email}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-50">
              <span className={`text-[10px] px-2.5 py-1 rounded-lg font-black uppercase tracking-wider ${
                user.role === UserRole.ADMIN 
                  ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' 
                  : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
              }`}>
                {user.role}
              </span>
              <span className="text-[10px] font-bold text-slate-300">ID: {user.id.substring(0, 6)}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Modal de Adição / Edição */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-50 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-slate-800">{editingUser ? 'Editar Membro' : 'Novo Membro'}</h3>
                <p className="text-xs text-slate-400">Configure as informações do usuário.</p>
              </div>
              <button onClick={closeModal} className="bg-slate-50 p-2 rounded-full text-slate-400 hover:text-slate-600 transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Nome Completo</label>
                <div className="relative">
                  <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input 
                    type="text" 
                    value={formData.name}
                    placeholder="Ex: João da Silva"
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-100 outline-none text-sm font-semibold"
                    onChange={e => setFormData({...formData, name: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">E-mail</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input 
                    type="email" 
                    value={formData.email}
                    placeholder="joao@imobiliaria.com"
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-100 outline-none text-sm font-semibold"
                    onChange={e => setFormData({...formData, email: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Perfil de Acesso</label>
                <div className="relative">
                  <Shield className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <select 
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-100 outline-none text-sm font-semibold appearance-none cursor-pointer"
                    value={formData.role}
                    onChange={e => setFormData({...formData, role: e.target.value as UserRole})}
                  >
                    <option value={UserRole.BROKER}>Corretor (BROKER)</option>
                    <option value={UserRole.ADMIN}>Administrador (ADMIN)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-50 bg-slate-50/50 flex justify-end gap-3">
              <button 
                onClick={closeModal}
                className="px-6 py-2.5 text-slate-400 font-bold hover:text-slate-600 transition-colors text-sm"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSave}
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-blue-100 text-sm"
              >
                Salvar Membro
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Team;
