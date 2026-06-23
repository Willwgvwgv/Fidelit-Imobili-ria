import React, { useState } from 'react';
import { Edit, Trash2, UserPlus, X, Mail, Shield, User as UserIcon, Phone, Users, Crown, Briefcase } from 'lucide-react';
import { User, UserRole } from '../types';

interface TeamProps {
  team: User[];
  setTeam: React.Dispatch<React.SetStateAction<User[]>>;
  currentUser: User;
}

const AVATAR_COLORS = [
  { bg: 'bg-blue-500', text: 'text-white' },
  { bg: 'bg-violet-500', text: 'text-white' },
  { bg: 'bg-rose-500', text: 'text-white' },
  { bg: 'bg-amber-500', text: 'text-white' },
  { bg: 'bg-emerald-500', text: 'text-white' },
  { bg: 'bg-cyan-500', text: 'text-white' },
  { bg: 'bg-pink-500', text: 'text-white' },
  { bg: 'bg-indigo-500', text: 'text-white' },
];

const getAvatarColor = (name: string) => {
  const index = name.charCodeAt(0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
};

const Team: React.FC<TeamProps> = ({ team, setTeam, currentUser }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState<Partial<User>>({ name: '', email: '', phone: '', role: UserRole.BROKER });

  const admins = team.filter(u => u.role === UserRole.ADMIN);
  const brokers = team.filter(u => u.role === UserRole.BROKER);

  const openModal = (user?: User) => {
    if (user) { setEditingUser(user); setFormData(user); }
    else { setEditingUser(null); setFormData({ name: '', email: '', phone: '', role: UserRole.BROKER }); }
    setIsModalOpen(true);
  };

  const closeModal = () => { setIsModalOpen(false); setEditingUser(null); };

  const handleSave = () => {
    if (!formData.name || !formData.email) { alert('Por favor, preencha nome e e-mail.'); return; }
    if (editingUser) {
      setTeam(prev => prev.map(u => u.id === editingUser.id ? { ...u, ...formData as User } : u));
    } else {
      const newUser: User = { id: `u-${Date.now()}`, name: formData.name!, email: formData.email!, phone: formData.phone, role: formData.role as UserRole, agencyId: currentUser.agencyId };
      setTeam(prev => [...prev, newUser]);
    }
    closeModal();
  };

  const handleRemove = (id: string) => {
    if (id === currentUser.id) { alert('Você não pode remover a si mesmo.'); return; }
    if (confirm('Tem certeza que deseja remover este membro?')) setTeam(prev => prev.filter(u => u.id !== id));
  };

  const UserCard = ({ user }: { user: User }) => {
    const avatar = getAvatarColor(user.name);
    const isAdmin = user.role === UserRole.ADMIN;
    const isMe = user.id === currentUser.id;
    return (
      <div className={`bg-white rounded-2xl border overflow-hidden shadow-sm hover:shadow-md transition-all ${isAdmin ? 'border-indigo-100' : 'border-slate-100'}`}>
        <div className={`h-1.5 w-full ${isAdmin ? 'bg-gradient-to-r from-indigo-500 to-violet-500' : 'bg-gradient-to-r from-emerald-400 to-teal-500'}`} />
        <div className="p-5">
          <div className="flex items-start gap-3 mb-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-black shrink-0 ${avatar.bg} ${avatar.text} shadow-sm`}>
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              <div className="flex items-center gap-1.5">
                <h4 className="font-bold text-slate-800 truncate text-sm">{user.name}</h4>
                {isMe && <span className="text-[9px] bg-blue-100 text-blue-600 font-black px-1.5 py-0.5 rounded-md uppercase tracking-wide shrink-0">Você</span>}
              </div>
              <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md mt-1 ${isAdmin ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>
                {isAdmin ? <Crown size={9} /> : <Briefcase size={9} />}
                {isAdmin ? 'Admin' : 'Corretor'}
              </span>
            </div>
          </div>
          <div className="space-y-1.5 mb-4">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Mail size={12} className="text-slate-400 shrink-0" />
              <span className="truncate">{user.email}</span>
            </div>
            {user.phone ? (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Phone size={12} className="text-slate-400 shrink-0" />
                <span>{user.phone}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-slate-300 italic">
                <Phone size={12} className="shrink-0" />
                <span>Telefone não cadastrado</span>
              </div>
            )}
          </div>
          <div className="flex items-center justify-between pt-3 border-t border-slate-50">
            <span className="text-[10px] font-bold text-slate-300 font-mono">#{user.id.substring(0, 6)}</span>
            <div className="flex items-center gap-1">
              <button onClick={() => openModal(user)} className="flex items-center gap-1 text-xs text-slate-400 hover:text-blue-600 hover:bg-blue-50 px-2.5 py-1.5 rounded-lg transition-all font-semibold">
                <Edit size={12} /> Editar
              </button>
              {!isMe && (
                <button onClick={() => handleRemove(user.id)} className="flex items-center gap-1 text-xs text-slate-400 hover:text-red-500 hover:bg-red-50 px-2.5 py-1.5 rounded-lg transition-all font-semibold">
                  <Trash2 size={12} /> Remover
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-800">Membros da Equipe</h3>
          <p className="text-sm text-slate-400">Gerencie os acessos e perfis da sua imobiliária.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-xl">
              <Crown size={12} className="text-indigo-500" />
              <span className="text-xs font-bold text-indigo-600">{admins.length} Admin{admins.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-xl">
              <Briefcase size={12} className="text-emerald-500" />
              <span className="text-xs font-bold text-emerald-600">{brokers.length} Corretor{brokers.length !== 1 ? 'es' : ''}</span>
            </div>
          </div>
          <button onClick={() => openModal()} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-blue-200 text-sm">
            <UserPlus size={16} /> Adicionar Membro
          </button>
        </div>
      </div>

      {admins.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Crown size={14} className="text-indigo-500" />
            <h4 className="text-xs font-black uppercase tracking-widest text-indigo-500">Administradores</h4>
            <div className="flex-1 h-px bg-indigo-100" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {admins.map(user => <UserCard key={user.id} user={user} />)}
          </div>
        </div>
      )}

      {brokers.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Briefcase size={14} className="text-emerald-500" />
            <h4 className="text-xs font-black uppercase tracking-widest text-emerald-500">Corretores</h4>
            <div className="flex-1 h-px bg-emerald-100" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {brokers.map(user => <UserCard key={user.id} user={user} />)}
          </div>
        </div>
      )}

      {team.length === 0 && (
        <div className="text-center py-16">
          <Users className="mx-auto mb-4 text-slate-200" size={48} />
          <p className="text-slate-400 font-semibold">Nenhum membro cadastrado</p>
          <p className="text-slate-300 text-sm mt-1">Adicione o primeiro membro da equipe</p>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-[28px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-800">{editingUser ? 'Editar Membro' : 'Novo Membro'}</h3>
                <p className="text-xs text-slate-400 mt-0.5">Configure as informações do usuário.</p>
              </div>
              <button onClick={closeModal} className="bg-slate-100 hover:bg-slate-200 p-2 rounded-full text-slate-400 hover:text-slate-600 transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Nome Completo *</label>
                <div className="relative">
                  <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                  <input type="text" value={formData.name} placeholder="Ex: João da Silva" className="w-full pl-10 pr-4 py-3 bg-slate-50 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-100 border border-transparent focus:border-blue-200 transition-all font-sans" onChange={e => setFormData({ ...formData, name: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">E-mail *</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                  <input type="email" value={formData.email} placeholder="joao@imobiliaria.com" className="w-full pl-10 pr-4 py-3 bg-slate-50 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-100 border border-transparent focus:border-blue-200 transition-all font-sans" onChange={e => setFormData({ ...formData, email: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Telefone / WhatsApp</label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                  <input type="tel" value={formData.phone || ''} placeholder="(62) 99999-9999" className="w-full pl-10 pr-4 py-3 bg-slate-50 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-100 border border-transparent focus:border-blue-200 transition-all font-sans" onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Perfil de Acesso *</label>
                <div className="relative">
                  <Shield className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                  <select className="w-full pl-10 pr-4 py-3 bg-slate-50 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-100 border border-transparent focus:border-blue-200 transition-all appearance-none cursor-pointer font-sans" value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value as UserRole })}>
                    <option value={UserRole.BROKER}>Corretor</option>
                    <option value={UserRole.ADMIN}>Administrador</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
              <button onClick={closeModal} className="px-5 py-2.5 text-slate-400 font-bold hover:text-slate-600 transition-colors text-sm rounded-xl hover:bg-slate-100 font-sans">Cancelar</button>
              <button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 text-white px-7 py-2.5 rounded-xl font-bold transition-all shadow-md shadow-blue-200 text-sm font-sans">
                {editingUser ? 'Salvar Alterações' : 'Adicionar Membro'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Team;
