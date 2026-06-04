import React, { useState, useEffect } from 'react';
import { 
  Shield, UserPlus, Trash2, Key, Mail, Lock, 
  UserCheck, Users, Search, AlertCircle, CheckCircle 
} from 'lucide-react';
import { AuthorizedUser } from '../types';

interface UserAccessPanelProps {
  onRefreshData?: () => void;
}

export default function UserAccessPanel({ onRefreshData }: UserAccessPanelProps) {
  const [users, setUsers] = useState<AuthorizedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Create User States
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'Admin' | 'Supervisor' | 'User'>('User');
  
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Authenticated user session
  const [currentUser] = useState<{ email: string; name: string; role: string } | null>(() => {
    const raw = localStorage.getItem('currentUser');
    if (raw) {
      try { return JSON.parse(raw); } catch { return null; }
    }
    return null;
  });

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (err) {
      console.error('Error loading authorized users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleGeneratePassword = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let generated = '';
    for (let i = 0; i < 10; i++) {
      generated += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(generated);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!email.trim() || !password.trim()) {
      setErrorMsg('Email and Password are required.');
      return;
    }

    try {
      const res = await fetch('/api/users/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          name: name.trim() || 'Team Member',
          role,
          password: password.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to authorize user access.');
      }

      setSuccessMsg(`✓ Successfully registered access for "${email.trim()}" (${role} privilege).`);
      setEmail('');
      setName('');
      setPassword('');
      setRole('User');
      fetchUsers();
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error occurred while saving credentials.');
    }
  };

  const handleDeleteUser = async (targetEmail: string) => {
    if (targetEmail.toLowerCase() === currentUser?.email.toLowerCase()) {
      alert('Action Denied: You cannot revoke authorization for your own active account!');
      return;
    }

    if (!window.confirm(`Are you sure you want to permanently revoke system access for "${targetEmail}"?`)) {
      return;
    }

    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetEmail })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to revoke system authorization.');
      }

      setSuccessMsg(`✓ Successfully removed dynamic workspace access for "${targetEmail}".`);
      fetchUsers();
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error occurred while revoking account privileges.');
    }
  };

  const filteredUsers = users.filter(u => 
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const adminCount = users.filter(u => u.role === 'Admin').length;
  const supervisorCount = users.filter(u => u.role === 'Supervisor').length;
  const userCount = users.filter(u => u.role === 'User').length;

  const isGranted = currentUser?.role === 'Admin' || currentUser?.role === 'Supervisor';

  if (!isGranted) {
    return (
      <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl text-center space-y-4 shadow-xl">
        <Lock className="h-12 w-12 text-slate-600 mx-auto" />
        <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400">Access Restricted</h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Under system compliance guidelines, only personnel with an **Administrator** or **Supervisor** role can manage workspace passwords and security access registers.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6" id="user-access-panel-module">
      <div className="border-b pb-4 border-slate-850">
        <h2 className="text-2xl font-bold text-slate-100 tracking-tight flex items-center gap-2.5 font-sans">
          <Shield className="h-6 w-6 text-indigo-400" />
          Login & Security Access Registry
        </h2>
        <p className="text-sm text-slate-400 mt-1">
          Monitor passwords, authorize new roles dynamically, and view precise system email keys.
        </p>
      </div>

      {/* METRIC SUMMARIES */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-850 p-4 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-500 font-mono uppercase tracking-widest font-bold">Administrators</span>
            <p className="text-xl font-extrabold text-white leading-tight mt-1">{adminCount}</p>
          </div>
          <div className="w-9 h-9 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
            <Shield className="h-4.5 w-4.5" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-850 p-4 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-500 font-mono uppercase tracking-widest font-bold">Supervisors</span>
            <p className="text-xl font-extrabold text-emerald-400 leading-tight mt-1">{supervisorCount}</p>
          </div>
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
            <UserCheck className="h-4.5 w-4.5" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-850 p-4 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-500 font-mono uppercase tracking-widest font-bold">Operators (Users)</span>
            <p className="text-xl font-extrabold text-slate-300 leading-tight mt-1">{userCount}</p>
          </div>
          <div className="w-9 h-9 rounded-lg bg-slate-950 flex items-center justify-center text-slate-400">
            <Users className="h-4.5 w-4.5" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* ADD USER WORKSPACE */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-widest text-indigo-400 flex items-center gap-2 border-b border-slate-850 pb-3">
            <UserPlus className="h-4.5 w-4.5" />
            Authorize Workspace
          </h3>

          <form onSubmit={handleCreateUser} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 font-mono">
                Email Address
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <Mail className="h-4 w-4 text-slate-500" />
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g., manager@cantordust.com"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 font-mono">
                Display Name
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <UserPlus className="h-4 w-4 text-slate-500" />
                </span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Jane Cooper"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 font-mono">
                  Privilege Role
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
                  required
                >
                  <option value="Admin">Admin</option>
                  <option value="Supervisor">Supervisor</option>
                  <option value="User">User (Operator)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 font-mono flex justify-between items-center">
                  <span>Password</span>
                  <button 
                    type="button" 
                    onClick={handleGeneratePassword} 
                    className="text-[9px] text-indigo-400 hover:underline hover:text-white uppercase font-bold"
                  >
                    Auto-Generate
                  </button>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <Lock className="h-4 w-4 text-slate-500" />
                  </span>
                  <input
                    type="text"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="password"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>
              </div>
            </div>

            {errorMsg && (
              <div className="flex gap-2 items-start bg-red-955/40 text-red-400 px-3 py-2.5 rounded-lg border border-red-900/30 text-xs">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="flex gap-2 items-start bg-emerald-905/40 text-emerald-400 px-3 py-2.5 rounded-lg border border-emerald-900/30 text-xs">
                <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{successMsg}</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold py-2.5 rounded-lg tracking-wider uppercase transition-all shadow-md cursor-pointer text-center"
            >
              Add Access Authorization
            </button>
          </form>
        </div>

        {/* AUTHORIZED LIST TABLE */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-850">
            <h3 className="text-sm font-bold uppercase tracking-widest text-slate-350 flex items-center gap-2">
              <Key className="h-4.5 w-4.5 text-slate-400" />
              Access Directory list
            </h3>

            {/* Search */}
            <div className="relative w-full sm:w-48">
              <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none">
                <Search className="h-3.5 w-3.5 text-slate-500" />
              </span>
              <input
                type="text"
                placeholder="Find email/name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1 text-[11px] text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-mono uppercase text-[9px] tracking-wider">
                  <th scope="col" className="pb-3 pr-2">Member / Email</th>
                  <th scope="col" className="pb-3 px-2">Role</th>
                  <th scope="col" className="pb-3 px-2">Password</th>
                  <th scope="col" className="pb-3 text-right">Revoke</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850/60 font-sans">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-8 text-slate-500 font-mono text-[11px]">
                      No authorized accounts match search filters.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => {
                    const isSelf = u.email.toLowerCase() === currentUser?.email.toLowerCase();
                    return (
                      <tr key={u.email} className="hover:bg-slate-950/20">
                        <td className="py-3 pr-2 min-w-[150px]">
                          <p className="font-semibold text-slate-200 flex items-center gap-1">
                            {u.name || 'Team Member'}
                            {isSelf && <span className="text-[8px] bg-indigo-500/20 text-indigo-400 font-mono uppercase font-bold px-1.5 py-0.5 rounded ml-1">You</span>}
                          </p>
                          <p className="text-[10px] text-slate-500 font-mono">{u.email}</p>
                        </td>
                        <td className="py-3 px-2">
                          <span className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded font-mono ${
                            u.role === 'Admin' 
                              ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' 
                              : u.role === 'Supervisor'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-slate-950 text-slate-400 border border-slate-855'
                          }`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="py-3 px-2 font-mono text-[11px] text-indigo-300">
                          {u.password || 'password123'}
                        </td>
                        <td className="py-3 text-right">
                          <button
                            type="button"
                            disabled={isSelf}
                            onClick={() => handleDeleteUser(u.email)}
                            className={`p-1.5 rounded transition-all ${
                              isSelf 
                                ? 'text-slate-700 cursor-not-allowed opacity-30' 
                                : 'text-red-400 hover:text-white hover:bg-red-950/50 cursor-pointer'
                            }`}
                            title={isSelf ? 'Self deletion is locked' : `Revoke privileges for ${u.email}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
