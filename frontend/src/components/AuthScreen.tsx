import React, { useState } from 'react';
import {
  ChefHat,
  Lock,
  User as UserIcon,
  Keyboard,
  ShieldAlert,
  KeyRound,
  ArrowRight,
  UserPlus,
  CheckCircle,
  Loader2,
} from 'lucide-react';
import { User } from '../types';
import { loginUser, registerUser, setToken } from '../lib/api';

import ceylonBistroStamp from '../assets/images/ceylon_bistro_stamp_1779429111035.png';

interface AuthScreenProps {
  onLoginSuccess: (user: User) => void;
}

export default function AuthScreen({ onLoginSuccess }: AuthScreenProps) {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');

  // Login
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register
  const [regUsername, setRegUsername] = useState('');
  const [regFullName, setRegFullName] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regRole, setRegRole] = useState<'Admin' | 'Cashier'>('Cashier');

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const clearMessages = () => {
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  // ── Login via backend API (with localStorage fallback) ─────────────────
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();

    if (!loginUsername.trim() || !loginPassword) {
      setErrorMsg('Please enter both username and password.');
      return;
    }

    setIsLoading(true);

    // Try backend first
    try {
      const result = await loginUser(loginUsername.trim(), loginPassword);
      setToken(result.token);
      localStorage.setItem('gusto_pos_current_user', JSON.stringify(result.user));
      onLoginSuccess(result.user);
      return;
    } catch (backendErr: any) {
      // Backend unavailable — fall back to localStorage demo accounts
      console.warn('Backend login failed, trying localStorage fallback:', backendErr.message);
    } finally {
      setIsLoading(false);
    }

    // Fallback: check localStorage users
    try {
      const raw = localStorage.getItem('gusto_pos_users');
      const users: User[] = raw
        ? JSON.parse(raw)
        : [
            { username: 'admin', fullName: 'Bistro Administrator', password: 'admin', role: 'Admin' },
            { username: 'cashier', fullName: 'Nimal Perera', password: 'cashier', role: 'Cashier' },
          ];

      const found = users.find(
        (u) =>
          u.username.toLowerCase() === loginUsername.trim().toLowerCase() &&
          (u as any).password === loginPassword
      );

      if (found) {
        onLoginSuccess({ username: found.username, fullName: found.fullName, role: found.role });
      } else {
        setErrorMsg(
          'Invalid credentials. Backend offline — using demo accounts (admin/admin, cashier/cashier).'
        );
      }
    } catch {
      setErrorMsg('Login failed. Please try again.');
    }
  };

  // ── Register via backend API (Admin-only on backend) ───────────────────
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();

    if (!regUsername.trim() || !regFullName.trim() || !regPassword) {
      setErrorMsg('Please fill in all fields.');
      return;
    }
    if (regUsername.trim().length < 3) {
      setErrorMsg('Username must be at least 3 characters.');
      return;
    }

    setIsLoading(true);

    // Try backend register (requires Admin JWT — if not authed, will fail gracefully)
    try {
      await registerUser(regUsername.trim(), regFullName.trim(), regPassword, regRole);
      setSuccessMsg(`Account "${regFullName.trim()}" registered! Please sign in.`);
      setLoginUsername(regUsername.trim());
      setLoginPassword(regPassword);
      setActiveTab('login');
      setRegUsername('');
      setRegFullName('');
      setRegPassword('');
      setRegRole('Cashier');
      setIsLoading(false);
      return;
    } catch (backendErr: any) {
      console.warn('Backend register failed, using localStorage fallback:', backendErr.message);
    } finally {
      setIsLoading(false);
    }

    // Fallback: save to localStorage
    const raw = localStorage.getItem('gusto_pos_users');
    const users: User[] = raw
      ? JSON.parse(raw)
      : [
          { username: 'admin', fullName: 'Bistro Administrator', password: 'admin', role: 'Admin' },
          { username: 'cashier', fullName: 'Nimal Perera', password: 'cashier', role: 'Cashier' },
        ];

    if (users.some((u) => u.username.toLowerCase() === regUsername.trim().toLowerCase())) {
      setErrorMsg('Username already taken.');
      return;
    }

    const newUser: User & { password: string } = {
      username: regUsername.trim().toLowerCase(),
      fullName: regFullName.trim(),
      password: regPassword,
      role: regRole,
    };
    localStorage.setItem('gusto_pos_users', JSON.stringify([...users, newUser]));
    setSuccessMsg(`Account "${newUser.fullName}" created (offline)! Please sign in.`);
    setLoginUsername(newUser.username);
    setLoginPassword(newUser.password);
    setActiveTab('login');
    setRegUsername('');
    setRegFullName('');
    setRegPassword('');
    setRegRole('Cashier');
  };

  const handleQuickDemoLogin = async (role: 'Admin' | 'Cashier') => {
    clearMessages();
    const username = role === 'Admin' ? 'admin' : 'cashier';
    const password = role === 'Admin' ? 'admin' : 'cashier';
    setLoginUsername(username);
    setLoginPassword(password);

    setIsLoading(true);
    try {
      const result = await loginUser(username, password);
      setToken(result.token);
      localStorage.setItem('gusto_pos_current_user', JSON.stringify(result.user));
      onLoginSuccess(result.user);
    } catch {
      // Fallback localStorage
      const raw = localStorage.getItem('gusto_pos_users');
      const users: (User & { password?: string })[] = raw
        ? JSON.parse(raw)
        : [
            { username: 'admin', fullName: 'Bistro Administrator', password: 'admin', role: 'Admin' },
            { username: 'cashier', fullName: 'Nimal Perera', password: 'cashier', role: 'Cashier' },
          ];
      const found = users.find((u) => u.username === username && u.password === password);
      if (found) {
        onLoginSuccess({ username: found.username, fullName: found.fullName, role: found.role });
      } else {
        setErrorMsg('Demo account not found. Please seed the backend first.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans select-none">
      {/* Ambient glows */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-emerald-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-amber-500/10 blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md bg-slate-850/90 border border-slate-700/50 rounded-2xl shadow-2xl p-6 lg:p-8 relative z-10 backdrop-blur-md">
        {/* Brand */}
        <div className="text-center mb-6">
          <img
            src={ceylonBistroStamp}
            alt="Gusto Ceylon Bistro"
            className="w-20 h-20 object-contain mx-auto mb-3 rounded-full border border-slate-700 p-1 bg-white"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
          <h1 className="text-xl font-black text-white tracking-tight uppercase">
            Gusto Ceylon Bistro
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-light font-mono">
            Colombo 03 • Terminal Billing Desk
          </p>
        </div>

        {/* Tabs */}
        <div className="bg-slate-900 rounded-xl p-1 mb-5 flex gap-1 border border-slate-700/70">
          <button
            onClick={() => { setActiveTab('login'); clearMessages(); }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'login'
                ? 'bg-slate-800 text-emerald-400 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <KeyRound className="h-3.5 w-3.5" /> Sign In
          </button>
          <button
            onClick={() => { setActiveTab('register'); clearMessages(); }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'register'
                ? 'bg-slate-800 text-emerald-400 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <UserPlus className="h-3.5 w-3.5" /> Register Account
          </button>
        </div>

        {/* Messages */}
        {errorMsg && (
          <div className="mb-4 bg-rose-950/40 border border-rose-900/40 text-rose-400 p-3 rounded-xl text-xs flex gap-2 items-center">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            <p className="font-semibold">{errorMsg}</p>
          </div>
        )}
        {successMsg && (
          <div className="mb-4 bg-emerald-950/40 border border-emerald-900/40 text-emerald-400 p-3 rounded-xl text-xs flex gap-2 items-center">
            <CheckCircle className="h-4 w-4 shrink-0" />
            <p className="font-semibold">{successMsg}</p>
          </div>
        )}

        {/* Login Form */}
        {activeTab === 'login' ? (
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="text-[10px] uppercase font-mono tracking-wider text-slate-400 block mb-1">
                Account Username
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <UserIcon className="h-4 w-4" />
                </span>
                <input
                  type="text"
                  required
                  placeholder="e.g. admin"
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700/60 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/80 transition-all font-mono"
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] uppercase font-mono tracking-wider text-slate-400 block mb-1">
                Password
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <Lock className="h-4 w-4" />
                </span>
                <input
                  type="password"
                  required
                  placeholder="Enter password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700/60 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/80 transition-all font-mono"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white font-bold text-xs py-3 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-md transition-all"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>Access Terminal <ArrowRight className="h-3.5 w-3.5" /></>
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegisterSubmit} className="space-y-4">
            <div>
              <label className="text-[10px] uppercase font-mono tracking-wider text-slate-400 block mb-1">
                Full Name
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <UserIcon className="h-4 w-4" />
                </span>
                <input
                  type="text"
                  required
                  placeholder="e.g. Priyantha Silva"
                  value={regFullName}
                  onChange={(e) => setRegFullName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700/60 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/80 transition-all"
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] uppercase font-mono tracking-wider text-slate-400 block mb-1">
                Username
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <Keyboard className="h-4 w-4" />
                </span>
                <input
                  type="text"
                  required
                  placeholder="e.g. priyantha"
                  value={regUsername}
                  onChange={(e) => setRegUsername(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700/60 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/80 transition-all font-mono"
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] uppercase font-mono tracking-wider text-slate-400 block mb-1">
                Password
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <Lock className="h-4 w-4" />
                </span>
                <input
                  type="password"
                  required
                  placeholder="Create password"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700/60 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/80 transition-all font-mono"
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] uppercase font-mono tracking-wider text-slate-400 block mb-1">
                Staff Role
              </label>
              <div className="bg-slate-900 p-1 rounded-xl flex gap-1 border border-slate-700/65">
                <button
                  type="button"
                  onClick={() => setRegRole('Cashier')}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    regRole === 'Cashier'
                      ? 'bg-slate-800 text-white border border-slate-700 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  🛎️ Cashier
                </button>
                <button
                  type="button"
                  onClick={() => setRegRole('Admin')}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    regRole === 'Admin'
                      ? 'bg-slate-800 text-white border border-slate-700 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  👑 Admin
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white font-bold text-xs py-3 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-md transition-all"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>Register Account <ArrowRight className="h-3.5 w-3.5" /></>
              )}
            </button>
          </form>
        )}

        {/* Divider */}
        <div className="relative my-5">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-700/40" />
          </div>
          <div className="relative flex justify-center text-[10px] uppercase font-mono">
            <span className="bg-[#1e293b] px-3.5 text-slate-400">Demo Shortcuts</span>
          </div>
        </div>

        {/* Quick demo buttons */}
        <div className="grid grid-cols-2 gap-2.5">
          <button
            onClick={() => handleQuickDemoLogin('Admin')}
            type="button"
            disabled={isLoading}
            className="bg-slate-900 hover:bg-slate-800 border border-slate-700/70 p-2.5 rounded-xl text-center cursor-pointer text-[11px] group transition-all text-slate-300 disabled:opacity-50"
          >
            <div className="font-extrabold text-amber-400 group-hover:scale-105 transition-transform">
              Demo Admin
            </div>
            <div className="text-[9px] text-slate-400 mt-0.5 font-mono">admin / admin</div>
          </button>
          <button
            onClick={() => handleQuickDemoLogin('Cashier')}
            type="button"
            disabled={isLoading}
            className="bg-slate-900 hover:bg-slate-800 border border-slate-700/70 p-2.5 rounded-xl text-center cursor-pointer text-[11px] group transition-all text-slate-300 disabled:opacity-50"
          >
            <div className="font-extrabold text-emerald-400 group-hover:scale-105 transition-transform">
              Demo Cashier
            </div>
            <div className="text-[9px] text-slate-400 mt-0.5 font-mono">cashier / cashier</div>
          </button>
        </div>
      </div>

      <p className="text-[10px] text-slate-500 font-mono tracking-wider text-center mt-6 z-10">
        RESTAURANT POS TERMINAL — PORT 5000 BACKEND
      </p>
    </div>
  );
}
