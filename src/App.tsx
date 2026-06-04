import React, { useState, useEffect } from 'react';
import { 
  Film, Boxes, ClipboardList, RefreshCw, Layers, Menu, X, 
  LogIn, LogOut, Shield, Mail, Lock, CheckCircle2, User 
} from 'lucide-react';
import { Video, Equipment, Assignment, SidebarTab } from './types';
import { apiUrl } from './api';
import VideoManager from './components/VideoManager';
import Inventory from './components/Inventory';
import DistributionVerification from './components/DistributionVerification';
import CantorDustLogo from './components/CantorDustLogo';
import UserAccessPanel from './components/UserAccessPanel';

interface UserSession {
  email: string;
  name: string;
  role: 'Admin' | 'Supervisor' | 'User';
}

export default function App() {
  const [activeTab, setActiveTab] = useState<SidebarTab>('Video Manager');
  const [videos, setVideos] = useState<Video[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Authentication States
  const [currentUser, setCurrentUser] = useState<UserSession | null>(() => {
    const raw = localStorage.getItem('currentUser');
    if (raw) {
      try { return JSON.parse(raw); } catch { return null; }
    }
    return null;
  });
  
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  const fetchAllData = async () => {
    if (!currentUser) return; // Only fetch if authenticated
    try {
      const [vRes, eRes, aRes] = await Promise.all([
        fetch(apiUrl('/api/videos')),
        fetch(apiUrl('/api/equipment')),
        fetch(apiUrl('/api/assignments'))
      ]);

      if (vRes.ok && eRes.ok && aRes.ok) {
        const vData = await vRes.json();
        const eData = await eRes.json();
        const aData = await aRes.json();

        setVideos(vData);
        setEquipment(eData);
        setAssignments(aData);
      }
    } catch (err) {
      console.error("Error synchronizing datasets from Express server:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchAllData();
    } else {
      setLoading(false);
    }
  }, [currentUser]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);

    if (!loginEmail.trim() || !loginPassword.trim()) {
      setAuthError('Please fill in both Email and Password fields.');
      setAuthLoading(false);
      return;
    }

    try {
      const response = await fetch(apiUrl('/api/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: loginEmail.trim(),
          password: loginPassword.trim()
        })
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Login attempt failed.');
      }

      const sessionUser: UserSession = {
        email: data.email,
        name: data.name,
        role: data.role
      };

      localStorage.setItem('currentUser', JSON.stringify(sessionUser));
      setCurrentUser(sessionUser);
    } catch (err: any) {
      const message =
        err.message === 'Failed to fetch'
          ? 'Cannot reach the API server. Start the backend: cd backend && npm run dev'
          : err.message || 'An error occurred during authentication.';
      setAuthError(message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('currentUser');
    setCurrentUser(null);
    // Clear component states
    setVideos([]);
    setEquipment([]);
    setAssignments([]);
    setMobileMenuOpen(false);
  };

  // Render Login Gate if user is not authenticated
  if (!currentUser) {
    return (
      <div className="min-h-screen w-screen bg-slate-950 flex items-center justify-center p-4 md:p-8 relative overflow-hidden font-sans text-slate-100" id="login-module">
        {/* Abstract Ambient Gradients for Premium Cantor Dust Branding */}
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-900/10 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[45%] h-[45%] rounded-full bg-emerald-950/10 blur-[120px] pointer-events-none" />

        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-8 space-y-6 relative z-10 animate-fade-in">
          {/* Centered Cantor Dust Logo */}
          <div className="flex flex-col items-center text-center space-y-3">
            <CantorDustLogo iconSize={48} showText={true} textClassName="font-extrabold text-white tracking-widest text-lg" className="flex flex-col items-center gap-3" />
            <h2 className="text-xl font-bold tracking-tight text-slate-100 mt-4">Sign in to your Workspace</h2>
            <p className="text-xs text-slate-400">Enter your authorized email and password to access system directories.</p>
          </div>

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 font-mono">
                Authorized Email Address
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <Mail className="h-4 w-4 text-slate-500" />
                </span>
                <input
                  type="email"
                  required
                  placeholder="name@company.com"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors placeholder:text-slate-650"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 font-mono">
                System Password
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <Lock className="h-4 w-4 text-slate-500" />
                </span>
                <input
                  type="password"
                  required
                  placeholder="••••••••••••"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
            </div>

            {authError && (
              <div className="p-3 bg-red-950/40 text-red-450 border border-red-900/30 rounded-lg text-xs leading-relaxed text-red-400">
                {authError}
              </div>
            )}

            <button
              type="submit"
              disabled={authLoading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white font-bold py-2.5 rounded-lg text-sm transition-all text-center flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-indigo-950/50"
            >
              <LogIn className="h-4 w-4" />
              {authLoading ? 'Verifying access...' : 'Access Workspace'}
            </button>
          </form>

          {/* Protected Access Notification */}
          <div className="border-t border-slate-800/80 pt-4 text-center space-y-1">
            <span className="text-[10px] font-semibold text-slate-500 uppercase flex items-center justify-center gap-1.5">
              <Shield className="h-3.5 w-3.5 text-indigo-400" /> Authorized Personnel Only
            </span>
            <p className="text-[9px] text-slate-600 leading-relaxed">
              This system contains proprietary equipment logs and production archives. All authentication events are logged under strict security registry policies.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const canManageInventory = currentUser.role === 'Admin' || currentUser.role === 'Supervisor';

  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-950 flex flex-col md:flex-row font-sans text-slate-100 relative" id="main-application-frame">
      {/* SIDEBAR NAVIGATION - Elegant Dark theme - FIXED on Desktop, Hidden on mobile */}
      <aside className="hidden md:flex w-64 bg-slate-900 border-r border-slate-850 flex-col justify-between shrink-0 h-full" id="streamlit-sidebar">
        <div className="p-6 space-y-6">
          {/* Main Logo with Cantor Dust Custom Branding */}
          <CantorDustLogo iconSize={36} showText={true} className="flex items-center gap-2.5 px-1 py-1" />

          <hr className="border-slate-800" />

          {/* Navigation Items */}
          <div className="space-y-1.5 navigation-panel">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">
              Application Modules
            </label>

            <button
              id="nav-tab-video-manager"
              onClick={() => setActiveTab('Video Manager')}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition-all border cursor-pointer ${
                activeTab === 'Video Manager'
                  ? 'bg-indigo-600/10 text-indigo-400 border-indigo-500/20 font-bold'
                  : 'text-slate-400 hover:bg-slate-800/60 hover:text-white border-transparent'
              }`}
            >
              <Film className="h-4 w-4 shrink-0" />
              Video Manager
            </button>

            <button
              id="nav-tab-inventory"
              onClick={() => canManageInventory && setActiveTab('Inventory')}
              disabled={!canManageInventory}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition-all border ${
                !canManageInventory
                  ? 'text-slate-600 border-transparent cursor-not-allowed opacity-60'
                  : activeTab === 'Inventory'
                  ? 'bg-indigo-600/10 text-indigo-400 border-indigo-500/20 font-bold cursor-pointer'
                  : 'text-slate-400 hover:bg-slate-800/60 hover:text-white border-transparent cursor-pointer'
              }`}
              title={canManageInventory ? 'Inventory & Dashboard' : 'Admin or Supervisor access required'}
            >
              <Boxes className="h-4 w-4 shrink-0" />
              Inventory & Dashboard
              {!canManageInventory && <Lock className="h-3 w-3 ml-auto text-slate-600" />}
            </button>

            <button
              id="nav-tab-distribution"
              onClick={() => setActiveTab('Distribution & Verification')}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition-all border cursor-pointer ${
                activeTab === 'Distribution & Verification'
                  ? 'bg-indigo-600/10 text-indigo-400 border-indigo-500/20 font-bold'
                  : 'text-slate-400 hover:bg-slate-800/60 hover:text-white border-transparent'
              }`}
            >
              <ClipboardList className="h-4 w-4 shrink-0" />
              Distribution & Verification
            </button>

            {(currentUser.role === 'Admin' || currentUser.role === 'Supervisor') && (
              <button
                id="nav-tab-user-access"
                onClick={() => setActiveTab('User Access Panel')}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition-all border cursor-pointer ${
                  activeTab === 'User Access Panel'
                    ? 'bg-indigo-600/10 text-indigo-400 border-indigo-500/20 font-bold'
                    : 'text-slate-400 hover:bg-slate-800/60 hover:text-white border-transparent'
                }`}
              >
                <Shield className="h-4 w-4 shrink-0 text-indigo-400" />
                User Access Panel
              </button>
            )}
          </div>
        </div>

        {/* Sidebar Footer - Current Authenticated User with LOGOUT button */}
        <div className="p-6 border-t border-slate-800 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-slate-850 border border-slate-750 flex items-center justify-center font-bold text-xs text-indigo-400">
              <User className="h-4 w-4" />
            </div>
            <div className="text-xs truncate max-w-[150px]">
              <p className="font-semibold text-slate-200 truncate">{currentUser.name}</p>
              <p className="text-[9px] text-slate-500 font-mono flex items-center gap-1">
                <Shield className="h-2.5 w-2.5 text-indigo-500" />
                {currentUser.role.toUpperCase()}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-slate-800 hover:border-red-900/30 hover:bg-red-950/20 hover:text-red-400 text-slate-400 rounded-lg text-xs font-bold transition-all cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
            Logout Session
          </button>
        </div>
      </aside>

      {/* REGION: MAIN INTERFACE MODULE */}
      <main className="flex-1 flex flex-col bg-slate-950 overflow-y-auto h-full relative" id="main-content-window">
        {/* Sticky Top Action Bar */}
        <header className="h-16 border-b border-slate-850 flex items-center justify-between px-4 md:px-8 bg-slate-950/80 backdrop-blur-md sticky top-0 z-30 shrink-0">
          <div className="flex items-center gap-3">
            {/* Mobile Menu Toggle Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors border border-slate-800 cursor-pointer flex items-center justify-center"
              aria-label="Toggle Menu"
            >
              {mobileMenuOpen ? <X className="h-4.5 w-4.5" /> : <Menu className="h-4.5 w-4.5" />}
            </button>
            <h1 className="text-xs md:text-sm font-bold uppercase tracking-wider text-slate-305 flex items-center gap-2.5">
              <span className="hidden md:inline text-slate-500">/</span> {activeTab}
            </h1>
          </div>
          
          <div className="flex items-center gap-3 md:gap-5">
            {/* Logo embedded on top navbar as well */}
            <CantorDustLogo iconSize={24} showText={false} className="hidden md:flex border-r border-slate-800 pr-4" />

            <div className="flex items-center gap-3 md:gap-4 text-[10px] md:text-xs text-slate-400 font-mono">
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="hidden sm:inline">Stock:</span> {equipment.reduce((acc, eq) => acc + eq.available_quantity, 0)} Avail
              </span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-505 bg-indigo-500"></span>
                <span className="hidden sm:inline">Active Out:</span> {assignments.filter(a => a.status === 'Out').length} units
              </span>
            </div>

            {/* Logout on Navbar for mobile layout context */}
            <button
              onClick={handleLogout}
              className="md:hidden p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title="Logout session"
            >
              <LogOut className="h-4.5 w-4.5" />
            </button>
          </div>
        </header>

        {/* Mobile Menu Dropdown Panel */}
        {mobileMenuOpen && (
          <div className="md:hidden fixed top-16 left-0 right-0 bottom-0 bg-slate-955/95 bg-slate-950 z-40 border-b border-slate-850 flex flex-col justify-between p-6 overflow-y-auto">
            <div className="space-y-6">
              <CantorDustLogo iconSize={32} showText={true} className="flex items-center gap-2.5" />

              <hr className="border-slate-800" />

              <div className="space-y-2">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">
                  Application Modules
                </label>

                <button
                  onClick={() => {
                    setActiveTab('Video Manager');
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-xs font-semibold tracking-wide transition-all border ${
                    activeTab === 'Video Manager'
                      ? 'bg-indigo-600/15 text-indigo-400 border-indigo-500/30 font-bold'
                      : 'text-slate-400 hover:bg-slate-800/60 hover:text-white border-transparent'
                  }`}
                >
                  <Film className="h-4 w-4 shrink-0" />
                  Video Manager
                </button>

                {canManageInventory && (
                <button
                  onClick={() => {
                    setActiveTab('Inventory');
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-xs font-semibold tracking-wide transition-all border ${
                    activeTab === 'Inventory'
                      ? 'bg-indigo-600/15 text-indigo-400 border-indigo-500/30 font-bold'
                      : 'text-slate-400 hover:bg-slate-800/60 hover:text-white border-transparent'
                  }`}
                >
                  <Boxes className="h-4 w-4 shrink-0" />
                  Inventory & Dashboard
                </button>
                )}

                <button
                  onClick={() => {
                    setActiveTab('Distribution & Verification');
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-xs font-semibold tracking-wide transition-all border ${
                    activeTab === 'Distribution & Verification'
                      ? 'bg-indigo-600/15 text-indigo-400 border-indigo-500/30 font-bold'
                      : 'text-slate-400 hover:bg-slate-800/60 hover:text-white border-transparent'
                  }`}
                >
                  <ClipboardList className="h-4 w-4 shrink-0" />
                  Distribution & Verification
                </button>

                {(currentUser.role === 'Admin' || currentUser.role === 'Supervisor') && (
                  <button
                    onClick={() => {
                      setActiveTab('User Access Panel');
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-xs font-semibold tracking-wide transition-all border ${
                      activeTab === 'User Access Panel'
                        ? 'bg-indigo-600/15 text-indigo-400 border-indigo-500/30 font-bold'
                        : 'text-slate-400 hover:bg-slate-800/60 hover:text-white border-transparent'
                    }`}
                  >
                    <Shield className="h-4 w-4 shrink-0 text-indigo-400" />
                    User Access Panel
                  </button>
                )}
              </div>
            </div>

            <div className="border-t border-slate-850 pt-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-850 flex items-center justify-center font-bold text-xs text-indigo-400">
                  <User className="h-4 w-4" />
                </div>
                <div className="text-xs">
                  <p className="font-semibold text-slate-200">{currentUser.name}</p>
                  <p className="text-[10px] text-slate-500 font-mono">{currentUser.email}</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-red-950/20 border border-red-900/30 text-red-400 rounded-lg text-xs font-bold transition-all cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" />
                Logout Session
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 py-12">
            <RefreshCw className="h-8 w-8 text-indigo-500 animate-spin" />
            <p className="text-xs text-slate-500 font-semibold tracking-wider font-mono">Loading Cantor Dust tables...</p>
          </div>
        ) : (
          <div className="p-8 max-w-7xl w-full mx-auto space-y-8 flex-1">
            {/* Context Active TAB render */}
            {activeTab === 'Video Manager' && (
              <VideoManager videos={videos} onRefresh={fetchAllData} />
            )}

            {activeTab === 'Inventory' && (
              canManageInventory ? (
                <Inventory equipment={equipment} assignments={assignments} onRefresh={fetchAllData} />
              ) : (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center space-y-4">
                  <Lock className="h-10 w-10 text-slate-600 mx-auto" />
                  <h3 className="text-lg font-bold text-slate-200">Inventory Access Restricted</h3>
                  <p className="text-sm text-slate-400 max-w-md mx-auto">
                    Only Administrators and Supervisors can manage equipment stock, add inventory, or delete equipment profiles.
                  </p>
                </div>
              )
            )}

            {activeTab === 'Distribution & Verification' && (
              <DistributionVerification 
                equipment={equipment} 
                assignments={assignments} 
                onRefresh={fetchAllData} 
              />
            )}

            {activeTab === 'User Access Panel' && (
              <UserAccessPanel />
            )}
          </div>
        )}

        {/* Bottom Activity Bar */}
        <footer className="mt-auto border-t border-slate-900 bg-slate-900/60 h-10 flex items-center justify-between px-8 text-[10px] text-slate-500 tracking-wider">
          <div className="flex gap-6 uppercase font-mono">
            <span>DB Schema v1.1.2</span>
            <span className="text-emerald-500 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block pointer-events-none"></span>
              Secure Auth & MongoDB Active
            </span>
            <span className="text-slate-550 truncate hidden sm:inline">Logged: {currentUser.email} ({currentUser.role})</span>
          </div>
          <span className="font-mono text-slate-605 text-slate-600">Sync: Realtime</span>
        </footer>
      </main>
    </div>
  );
}
