'use client';

import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/firestore';
import { useAuthContext } from '@/contexts/AuthContext';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  uid: string;
}

export default function SettingsModal({ isOpen, onClose, uid }: SettingsModalProps) {
  const { refreshPreferences } = useAuthContext();
  const [model, setModel] = useState('openrouter/free');
  const [apiKey, setApiKey] = useState('');
  
  const [workingHours, setWorkingHours] = useState('9 AM - 5 PM');
  const [breakPreference, setBreakPreference] = useState('10 mins every hour');
  const [focusStyle, setFocusStyle] = useState('Pomodoro (25m work / 5m break)');
  
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen && uid) {
      getDoc(doc(db, 'users', uid)).then(docSnap => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.settings?.model) setModel(data.settings.model);
          if (data.preferences?.workingHours) setWorkingHours(data.preferences.workingHours);
          if (data.preferences?.breakPreference) setBreakPreference(data.preferences.breakPreference);
          if (data.preferences?.focusStyle) setFocusStyle(data.preferences.focusStyle);
        }
      });
    }
  }, [isOpen, uid]);

  if (!isOpen) return null;

  const handleSave = () => {
    setSaving(true);
    
    // Fire and forget API and Firestore updates in the background
    const saveToCloud = async () => {
      try {
        if (apiKey) {
          localStorage.setItem('openRouterApiKey', apiKey.trim());
        }
        
        await setDoc(doc(db, 'users', uid), {
          settings: { model },
          preferences: {
            workingHours,
            breakPreference,
            focusStyle,
          }
        }, { merge: true });

        await refreshPreferences();
      } catch (error) {
        console.error('Failed to save settings:', error);
      }
    };
    
    saveToCloud();
    
    // Instantly close the modal for Optimistic UI
    setSaving(false);
    setApiKey('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" 
        onClick={onClose} 
      />
      
      {/* Modal */}
      <div className="glass w-full max-w-md rounded-2xl shadow-2xl overflow-hidden relative z-10 border border-white/20 transform transition-all">
        <div className="px-6 py-4 border-b border-white/10 bg-white/5">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            ⚙️ Preferences
          </h3>
        </div>
        
        <div className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">
              AI Engine Model (OpenRouter)
            </label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full rounded-xl glass bg-white/5 px-4 py-3 text-sm text-white border border-white/20 focus:outline-none focus:ring-2 focus:ring-violet-500 appearance-none [&>option]:bg-zinc-900"
            >
              <option value="openrouter/free">Auto Free Model (Default)</option>
              <option value="openai/gpt-4o">GPT-4o (OpenAI)</option>
              <option value="anthropic/claude-3-opus">Claude 3 Opus (Anthropic)</option>
              <option value="meta-llama/llama-3-70b-instruct">Llama 3 70B (Meta)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">
              OpenRouter API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Leave blank to keep existing key"
              className="w-full rounded-xl glass bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/30 border border-white/20 focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all"
            />
            <p className="mt-2 text-xs text-white/40">
              Keys are stored securely in your browser's local storage and are never saved to our database.
            </p>
          </div>
          
          <hr className="border-white/10" />
          
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">
              Working Hours
            </label>
            <input
              type="text"
              value={workingHours}
              onChange={(e) => setWorkingHours(e.target.value)}
              className="w-full rounded-xl glass bg-white/5 px-4 py-2.5 text-sm text-white border border-white/20 focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">
              Focus Style
            </label>
            <input
              type="text"
              value={focusStyle}
              onChange={(e) => setFocusStyle(e.target.value)}
              className="w-full rounded-xl glass bg-white/5 px-4 py-2.5 text-sm text-white border border-white/20 focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">
              Break Preference
            </label>
            <input
              type="text"
              value={breakPreference}
              onChange={(e) => setBreakPreference(e.target.value)}
              className="w-full rounded-xl glass bg-white/5 px-4 py-2.5 text-sm text-white border border-white/20 focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all"
            />
          </div>
        </div>
        
        <div className="px-6 py-4 border-t border-white/10 bg-black/20 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-medium text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-sm font-medium transition-all glow-violet disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
