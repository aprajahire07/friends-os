import React, { useState } from 'react';
import { X, Database, Copy, Check, ExternalLink, ShieldCheck, Download, AlertCircle } from 'lucide-react';
import { isSupabaseConfigured, supabaseUrl, supabaseAnonKey, saveSupabaseConfig } from '../../lib/supabase';
import { SUPABASE_SQL_SCHEMA } from '../../lib/sql-generator';
import { useToast } from '../ui/Toast';

interface SupabaseConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SupabaseConfigModal: React.FC<SupabaseConfigModalProps> = ({ isOpen, onClose }) => {
  const { showToast } = useToast();
  const [urlInput, setUrlInput] = useState(supabaseUrl);
  const [keyInput, setKeyInput] = useState(supabaseAnonKey);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'credentials' | 'sql'>('credentials');

  if (!isOpen) return null;

  const handleSaveCredentials = (e: React.FormEvent) => {
    e.preventDefault();
    saveSupabaseConfig(urlInput, keyInput);
    showToast('Saved Supabase Configuration!', 'Application is reloading with new backend keys.', 'success');
  };

  const handleCopySQL = () => {
    navigator.clipboard.writeText(SUPABASE_SQL_SCHEMA);
    setCopied(true);
    showToast('Copied SQL DDL Schema!', 'Paste this into your Supabase SQL Editor and click Run.', 'success');
    setTimeout(() => setCopied(false), 3000);
  };

  const handleDownloadSQL = () => {
    const blob = new Blob([SUPABASE_SQL_SCHEMA], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'friend_os_supabase_schema.sql';
    a.click();
    showToast('Downloaded Schema File', 'friend_os_supabase_schema.sql saved.', 'info');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 text-slate-100 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-lg bg-slate-800/50"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="p-3 bg-emerald-950/80 border border-emerald-800/60 rounded-xl text-emerald-400">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Supabase Backend & Database Setup</h3>
            <p className="text-xs text-slate-400">Configure your live Supabase project & export PostgreSQL schemas.</p>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex gap-2 p-1 bg-slate-950 rounded-xl mb-6 border border-slate-800">
          <button
            onClick={() => setActiveTab('credentials')}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'credentials' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Backend Credentials
          </button>
          <button
            onClick={() => setActiveTab('sql')}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'sql' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            PostgreSQL DDL & RLS Policies
          </button>
        </div>

        {activeTab === 'credentials' ? (
          <div>
            {/* Status Banner */}
            <div className={`p-4 rounded-xl border mb-5 flex items-start gap-3 ${
              isSupabaseConfigured 
                ? 'bg-emerald-950/40 border-emerald-800/50 text-emerald-200'
                : 'bg-amber-950/40 border-amber-800/50 text-amber-200'
            }`}>
              {isSupabaseConfigured ? (
                <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              )}
              <div className="text-xs">
                <p className="font-bold">
                  {isSupabaseConfigured ? 'Supabase Client Connected' : 'Running in Offline / Local Persistent Mode'}
                </p>
                <p className="opacity-90 mt-1 leading-relaxed">
                  {isSupabaseConfigured
                    ? 'FRIEND OS is syncing with your live Supabase PostgreSQL database, Auth, and Storage buckets.'
                    : 'All features (Chat, Expenses, Snaps, Attendance) work seamlessly locally right now. Enter your Supabase Project URL and Anon Key below to link your cloud project.'}
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveCredentials} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Supabase Project URL (`VITE_SUPABASE_URL`)
                </label>
                <input
                  type="text"
                  placeholder="https://xyz.supabase.co"
                  value={urlInput}
                  onChange={e => setUrlInput(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Supabase Anon Public Key (`VITE_SUPABASE_ANON_KEY`)
                </label>
                <input
                  type="password"
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  value={keyInput}
                  onChange={e => setKeyInput(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/30 transition-all"
                >
                  Save & Reload Backend
                </button>
                <a
                  href="https://supabase.com/dashboard"
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl flex items-center gap-1.5"
                >
                  <span>Supabase Dashboard</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </form>
          </div>
        ) : (
          <div>
            <p className="text-xs text-slate-400 mb-3">
              Copy and paste this script directly into your <strong className="text-slate-200">Supabase SQL Editor</strong> to create all tables (`profiles`, `messages`, `expenses`, `snaps`, `attendance`), indexes, triggers, storage buckets, and RLS security policies.
            </p>

            <div className="relative mb-4">
              <textarea
                readOnly
                value={SUPABASE_SQL_SCHEMA}
                rows={10}
                className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl font-mono text-[11px] text-emerald-400 leading-tight focus:outline-none overflow-y-auto"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleCopySQL}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Copied to Clipboard!' : 'Copy Entire SQL Script'}</span>
              </button>
              <button
                onClick={handleDownloadSQL}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span>.sql File</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
