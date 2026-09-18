import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard } from './GlassCard';
import { Icon, type IconName } from './Icon';
import { useTheme } from '../hooks/useTheme';
import type { ThemeMode } from '../hooks/useTheme';
import { useAuth } from './AuthProvider';
import { useToast } from './useToast';
import { DeleteAccountModal } from './DeleteAccountModal';

interface UserSettings {
  paper_trading_enabled: boolean;
  paper_trading_capital: number;
  full_name?: string | null;
}

interface SettingsPageProps {
  isLoggedIn: boolean;
  onLoginClick: () => void;
}

const SECTIONS = [
  { id: 'profile', label: 'Profile', icon: 'user' as const },
  { id: 'connections', label: 'Connections', icon: 'link' as const },
  { id: 'appearance', label: 'Appearance', icon: 'palette' as const },
] as const;

type SectionId = (typeof SECTIONS)[number]['id'];

export function SettingsPage({ isLoggedIn, onLoginClick }: SettingsPageProps) {
  const { user, getAccessToken, refreshProfile } = useAuth();
  const toast = useToast();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [draft, setDraft] = useState<UserSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<SectionId>('profile');
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Profile tab state
  const [profileNameDraft, setProfileNameDraft] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current: '', newPass: '' });
  const [passwordError, setPasswordError] = useState('');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Zerodha key state
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [savedApiKey, setSavedApiKey] = useState<string | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [isSavingKey, setIsSavingKey] = useState(false);
  const [isDeletingKey, setIsDeletingKey] = useState(false);
  const [keyStatus, setKeyStatus] = useState<{ configured: boolean; working: boolean }>({ configured: false, working: false });
  const [isLoadingKeyStatus, setIsLoadingKeyStatus] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  // MegaBull paper-trading key state
  const [megabullKeyInput, setMegabullKeyInput] = useState('');
  const [savedMegabullKey, setSavedMegabullKey] = useState<string | null>(null);
  const [isSavingMegabullKey, setIsSavingMegabullKey] = useState(false);
  const [isDeletingMegabullKey, setIsDeletingMegabullKey] = useState(false);

  // Key reveal functionality
  const [isRevealingKey, setIsRevealingKey] = useState(false);
  const [revealedKey, setRevealedKey] = useState<string>('');
  const [isCopyingKey, setIsCopyingKey] = useState(false);
  const [revealTimeout, setRevealTimeout] = useState<NodeJS.Timeout | null>(null);

  // Theme — persisted by useTheme
  const { theme: themeMode, setTheme: setThemeMode, resolvedTheme } = useTheme();

  const THEME_OPTIONS: { id: ThemeMode; label: string; sub: string; icon: IconName }[] = [
    { id: 'system', label: 'System', sub: 'Follow OS setting', icon: 'monitor' },
    { id: 'light', label: 'Light', sub: 'Always light', icon: 'sun' },
    { id: 'dark', label: 'Dark', sub: 'Always dark', icon: 'moon' },
  ];

  const fetchSettings = async () => {
    if (!isLoggedIn || !user) {
      setSettings(null);
      setIsLoading(false);
      return;
    }
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Not signed in');
      const response = await fetch('/api/settings', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch settings');
      const data = await response.json();
      setSettings(data);
      setDraft(data);
    } catch (err: any) {
      console.error('Settings fetch error:', err);
      toast.error(`Couldn't load settings: ${err?.message || 'network error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchKeyStatus = useCallback(async () => {
    try {
      const token = await getAccessToken();
      if (!token) {
        setSavedApiKey(null);
        return;
      }
      setIsLoadingKeyStatus(true);
      const res = await fetch('/api/kite', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setSavedApiKey(null);
        return;
      }
      const data = await res.json();
      if (data.configured) {
        setSavedApiKey(data.maskedKey);
        setKeyStatus({ configured: true, working: data.working ?? false });
      } else {
        setSavedApiKey(null);
        setKeyStatus({ configured: false, working: false });
      }
    } catch {
      setSavedApiKey(null);
      setKeyStatus({ configured: false, working: false });
    } finally {
      setIsLoadingKeyStatus(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    const timer = setTimeout(fetchSettings, 100);
    return () => clearTimeout(timer);
  }, [isLoggedIn]);

  // Load profile name from user (full_name stored in user_metadata)
  useEffect(() => {
    if (user) {
      setProfileNameDraft(user.user_metadata?.full_name ?? user.full_name ?? '');
    }
  }, [user]);

  // Load zerodha key status whenever profile section is active
  useEffect(() => {
    if (activeSection === 'profile') {
      fetchKeyStatus();
    }
  }, [activeSection, fetchKeyStatus]);

  const fetchMegaBullKeyStatus = useCallback(async () => {
    try {
      const token = await getAccessToken();
      if (!token) return;
      const res = await fetch('/api/megabull', { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return;
      const data = await res.json();
      setSavedMegabullKey(data.configured ? data.maskedKey : null);
    } catch {
      setSavedMegabullKey(null);
    }
  }, [getAccessToken]);

  useEffect(() => {
    if (activeSection === 'connections') {
      fetchMegaBullKeyStatus();
      fetchKeyStatus();
    }
  }, [activeSection, fetchMegaBullKeyStatus, fetchKeyStatus]);

  const handleSaveMegaBullKey = async () => {
    if (!megabullKeyInput.trim()) return;
    setIsSavingMegabullKey(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Not signed in');
      const res = await fetch('/api/megabull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ api_key: megabullKeyInput.trim() }),
      });
      if (!res.ok) throw new Error((await res.text().then(t => { try { return JSON.parse(t || '{}').error || 'Failed to save MegaBull API key'; } catch { return 'Failed to save MegaBull API key'; } })));
      setMegabullKeyInput('');
      await fetchMegaBullKeyStatus();
      toast.success('MegaBull API key saved');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save MegaBull API key');
    } finally {
      setIsSavingMegabullKey(false);
    }
  };

  const handleDeleteMegaBullKey = async () => {
    setIsDeletingMegabullKey(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Not signed in');
      const res = await fetch('/api/megabull', { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Failed to remove MegaBull API key');
      setSavedMegabullKey(null);
      toast.success('MegaBull API key removed');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to remove MegaBull API key');
    } finally {
      setIsDeletingMegabullKey(false);
    }
  };

  // Key reveal handlers
  const handleRevealKey = useCallback(async () => {
    if (!savedApiKey) return;

    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Not signed in');

      const res = await fetch(`/api/kite?reveal=true`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const err = await res.text().then(t => { try { return JSON.parse(t || '{}').error || 'Failed'; } catch { return 'Failed'; } });
        throw new Error(err.error || 'Failed to reveal API key');
      }

      const data = await res.json();
      setRevealedKey(data.apiKey);
      setIsRevealingKey(true);

      // Auto-hide after 30 seconds or on blur
      if (revealTimeout.current) {
        clearTimeout(revealTimeout.current);
      }
      const timeout = setTimeout(() => {
        setIsRevealingKey(false);
        setRevealedKey('');
      }, 30000);
      setRevealTimeout(timeout);

    } catch (err: any) {
      toast.error(`Failed to reveal API key: ${err?.message || 'network error'}`);
    } finally {
      // Hide the input field while revealing
      setShowApiKey(false);
    }
  }, [getAccessToken, savedApiKey, toast]);

  const handleCopyKey = useCallback(async () => {
    if (!revealedKey) return;

    setIsCopyingKey(true);
    try {
      await navigator.clipboard.writeText(revealedKey);
      toast.success('API key copied to clipboard');
    } catch (err) {
      toast.error('Failed to copy API key');
    } finally {
      setIsCopyingKey(false);

      // Auto-hide after copy
      if (revealTimeout.current) {
        clearTimeout(revealTimeout.current);
      }
      setIsRevealingKey(false);
      setRevealedKey('');
    }
  }, [revealedKey, toast]);

  const handleApiKeyBlur = useCallback(() => {
    // Auto-hide revealed key on blur
    if (revealTimeout.current) {
      clearTimeout(revealTimeout.current);
    }
    setIsRevealingKey(false);
    setRevealedKey('');
  }, []);

  const handleSave = async () => {
    if (!draft || !user) return;
    setIsSaving(true);
    setSaveMessage(null);
    const previousSettings = settings;
    setSettings(draft);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Not signed in');
      const response = await fetch('/api/settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(draft),
      });
      if (!response.ok) {
        const body = await response.text();
        throw new Error(JSON.parse(body || '{}').error || 'Save failed');
      }
      const data = await response.json();
      setSettings(data);
      setDraft(data);
      setSaveMessage({ type: 'success', text: 'Settings saved' });
      toast.success('Settings saved');
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err: any) {
      if (previousSettings) {
        setSettings(previousSettings);
        setDraft(previousSettings);
      }
      const message = err?.message || 'Failed to save settings';
      setSaveMessage({ type: 'error', text: message });
      toast.error(`Save failed: ${message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveProfileName = async () => {
    if (!user) return;
    setIsSavingProfile(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Not signed in');
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ full_name: profileNameDraft }),
      });
      if (!res.ok) {
        const err = await res.text().then(t => { try { return JSON.parse(t || '{}').error || 'Failed'; } catch { return 'Failed'; } });
        throw new Error(err.error || 'Update failed');
      }
      await refreshProfile();
      toast.success('Profile name saved');
    } catch (err: any) {
      toast.error(`Failed to save name: ${err?.message || 'network error'}`);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setPasswordError('');
    setIsChangingPassword(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Not signed in');
      const res = await fetch('/api/profile/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          current_password: passwordForm.current,
          new_password: passwordForm.newPass,
        }),
      });
      if (!res.ok) {
        const err = await res.text().then(t => { try { return JSON.parse(t || '{}').error || 'Failed'; } catch { return 'Failed'; } });
        throw new Error(err.error || 'Password change failed');
      }
      setPasswordForm({ current: '', newPass: '' });
      toast.success('Password changed successfully');
    } catch (err: any) {
      setPasswordError(err?.message || 'Password change failed');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleSaveApiKey = async () => {
    if (!apiKeyInput.trim()) return;
    setIsSavingKey(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Not signed in');
      const res = await fetch('/api/kite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ api_key: apiKeyInput.trim() }),
      });
      if (!res.ok) {
        const err = await res.text().then(t => { try { return JSON.parse(t || '{}').error || 'Failed'; } catch { return 'Failed'; } });
        throw new Error(err.error || 'Failed to save API key');
      }
      const masked = 'kitepro' + '•'.repeat(12);
      setSavedApiKey(masked);
      setApiKeyInput('');
      await fetchKeyStatus();
      toast.success('API key saved');
    } catch (err: any) {
      toast.error(`Failed to save API key: ${err?.message || 'network error'}`);
    } finally {
      setIsSavingKey(false);
    }
  };

  const handleDeleteApiKey = async () => {
    setIsDeletingKey(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Not signed in');
      const res = await fetch('/api/kite', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.text().then(t => { try { return JSON.parse(t || '{}').error || 'Failed'; } catch { return 'Failed'; } });
        throw new Error(err.error || 'Failed to remove API key');
      }
      setSavedApiKey(null);
      setApiKeyInput('');
      await fetchKeyStatus();
      toast.success('API key removed');
    } catch (err: any) {
      toast.error(`Failed to remove API key: ${err?.message || 'network error'}`);
    } finally {
      setIsDeletingKey(false);
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeletingAccount(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Not signed in');
      const res = await fetch('/api/profile', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.text().then(t => { try { return JSON.parse(t || '{}').error || 'Failed'; } catch { return 'Failed'; } });
        throw new Error(err.error || 'Delete failed');
      }
      // The modal will call signOut() after this succeeds
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const updateDraft = <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
    setDraft(prev => (prev ? { ...prev, [key]: value } : prev));
  };

  if (!isLoggedIn) {
    return (
      <GlassCard variant="default" padding="lg" className="text-center">
        <div className="w-16 h-16 flex items-center justify-center mx-auto mb-4 text-[color:var(--text-tertiary)]">
          <Icon name="gear" size={32} strokeWidth={1.5} />
        </div>
        <h3 className="text-lg font-bold text-[color:var(--text-primary)] mb-1">Settings</h3>
        <p className="text-sm text-[color:var(--text-secondary)] mb-4">Login to manage your account settings</p>
        <button
          onClick={onLoginClick}
          className="px-4 py-2 rounded-xl bg-[color:var(--accent)] text-[color:var(--accent-fg)] text-sm font-bold hover:opacity-90"
        >
          Login
        </button>
      </GlassCard>
    );
  }

  if (isLoading || !draft) {
    return (
      <GlassCard variant="default" padding="lg">
        <div className="space-y-3">
          {[1, 2, 3].map(n => (
            <div key={n} className="h-12 rounded-[var(--card-radius)] bg-[color:var(--ground-secondary)] animate-pulse" />
          ))}
        </div>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-4">
      {/* Delete Account Modal */}
      <DeleteAccountModal
        isOpen={isDeleteModalOpen}
        email={user?.user_metadata?.username ?? user?.email ?? ''}
        onConfirm={handleDeleteAccount}
        onCancel={() => setIsDeleteModalOpen(false)}
        isDeleting={isDeletingAccount}
      />

      {/* Section Tabs */}
      <div className="flex gap-1 p-1 rounded-[var(--card-radius)] bg-[color:var(--ground-secondary)] border border-[color:var(--border-subtle)] overflow-x-auto">
        {SECTIONS.map(section => (
          <button
            key={section.id}
            onClick={() => setActiveSection(section.id)}
            className={`px-3 py-1.5 rounded-[10px] text-xs font-bold transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeSection === section.id
                ? 'bg-[color:var(--ground)] text-[color:var(--text-primary)] border border-[color:var(--border-default)]'
                : 'text-[color:var(--text-tertiary)] hover:text-[color:var(--text-primary)]'
            }`}
          >
            <Icon name={section.icon} size={13} strokeWidth={2.2} />
            <span>{section.label}</span>
          </button>
        ))}
      </div>

      {/* Save bar for unsaved changes */}
      <AnimatePresence>
        {JSON.stringify(settings) !== JSON.stringify(draft) && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center justify-between p-3 rounded-[var(--card-radius)] bg-[color:var(--ground-secondary)] border border-[color:var(--border-subtle)]"
          >
            <span className="text-xs font-bold text-[color:var(--text-primary)]">You have unsaved changes</span>
            <div className="flex gap-2">
              <button
                onClick={() => setDraft(settings)}
                className="px-3 py-1.5 rounded-[10px] bg-transparent text-[color:var(--text-primary)] text-xs font-bold hover:bg-[color:var(--card-bg-hover)]"
              >
                Discard
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-3 py-1.5 rounded-[10px] bg-[color:var(--accent)] text-[color:var(--accent-fg)] text-xs font-bold hover:opacity-90 disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Save message */}
      <AnimatePresence>
        {saveMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`p-3 rounded-[var(--card-radius)] text-xs font-bold border ${
              saveMessage.type === 'success'
                ? 'bg-[color:var(--ground-secondary)] text-[color:var(--positive)] border-[color:var(--positive)]/30'
                : 'bg-[color:var(--ground-secondary)] text-[color:var(--negative)] border-[color:var(--negative)]/30'
            }`}
          >
            {saveMessage.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Section Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeSection}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {activeSection === 'profile' && (
            <ProfileSettings
              user={user}
              profileName={profileNameDraft}
              setProfileName={setProfileNameDraft}
              onSaveProfileName={handleSaveProfileName}
              isSavingProfile={isSavingProfile}
              passwordForm={passwordForm}
              setPasswordForm={setPasswordForm}
              passwordError={passwordError}
              onChangePassword={handleChangePassword}
              isChangingPassword={isChangingPassword}
              onDeleteAccount={() => setIsDeleteModalOpen(true)}
              apiKeyInput={apiKeyInput}
              setApiKeyInput={setApiKeyInput}
              savedApiKey={savedApiKey}
              showApiKey={showApiKey}
              setShowApiKey={setShowApiKey}
              isSavingKey={isSavingKey}
              isDeletingKey={isDeletingKey}
              keyStatus={keyStatus}
              isLoadingKeyStatus={isLoadingKeyStatus}
              onSaveApiKey={handleSaveApiKey}
              onDeleteApiKey={handleDeleteApiKey}
              isRevealingKey={isRevealingKey}
              revealedKey={revealedKey}
              handleRevealKey={handleRevealKey}
              handleCopyKey={handleCopyKey}
              handleApiKeyBlur={handleApiKeyBlur}
              isCopyingKey={isCopyingKey}
              revealTimeout={revealTimeout}
              setIsRevealingKey={setIsRevealingKey}
              setRevealedKey={setRevealedKey}
            />
          )}
          {activeSection === 'connections' && (
            <ConnectionsSettings
              kite={{
                savedApiKey,
                apiKeyInput,
                setApiKeyInput,
                isSavingKey,
                isDeletingKey,
                onSave: handleSaveApiKey,
                onDelete: handleDeleteApiKey,
                status: keyStatus,
              }}
              megabull={{
                savedApiKey: savedMegabullKey,
                apiKeyInput: megabullKeyInput,
                setApiKeyInput: setMegabullKeyInput,
                isSavingKey: isSavingMegabullKey,
                isDeletingKey: isDeletingMegabullKey,
                onSave: handleSaveMegaBullKey,
                onDelete: handleDeleteMegaBullKey,
              }}
            />
          )}
          {activeSection === 'appearance' && (
            <AppearanceSettings
              themeMode={themeMode}
              resolvedTheme={resolvedTheme}
              setThemeMode={setThemeMode}
              options={THEME_OPTIONS}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// API connection onboarding
// ---------------------------------------------------------------------------

type ConnectionKeyProps = {
  savedApiKey: string | null;
  apiKeyInput: string;
  setApiKeyInput: (value: string) => void;
  isSavingKey: boolean;
  isDeletingKey: boolean;
  onSave: () => void;
  onDelete: () => void;
  status?: { configured: boolean; working: boolean };
};

function ConnectionKeyCard({
  title,
  description,
  setupSteps,
  keyData,
}: {
  title: string;
  description: string;
  setupSteps: string[];
  keyData: ConnectionKeyProps;
}) {
  const { savedApiKey, apiKeyInput, setApiKeyInput, isSavingKey, isDeletingKey, onSave, onDelete, status } = keyData;
  return (
    <GlassCard variant="default" padding="lg" className="space-y-4">
      <div>
        <h3 className="text-sm font-extrabold text-[color:var(--text-primary)] flex items-center gap-2">
          <Icon name="link" size={15} strokeWidth={2} /> {title}
        </h3>
        <p className="text-xs text-[color:var(--text-secondary)] mt-1">{description}</p>
      </div>
      <div className="rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--ground-secondary)] p-3">
        <p className="text-[10px] font-extrabold uppercase tracking-wider text-[color:var(--text-tertiary)] mb-2">Setup</p>
        <ol className="space-y-1.5 text-xs text-[color:var(--text-secondary)]">
          {setupSteps.map((step, index) => <li key={step} className="flex gap-2"><span className="font-bold text-[color:var(--accent)]">{index + 1}.</span><span>{step}</span></li>)}
        </ol>
      </div>
      {savedApiKey ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-[color:var(--border-default)] bg-[color:var(--ground-secondary)] p-3">
          <div>
            <p className="text-xs font-bold text-[color:var(--text-primary)]">Connected</p>
            <p className="text-xs font-mono text-[color:var(--text-secondary)]">{savedApiKey}</p>
            {status && <p className="text-[10px] text-[color:var(--positive)] mt-1">{status.configured ? 'Ready' : 'Needs setup'}</p>}
          </div>
          <button onClick={onDelete} disabled={isDeletingKey} className="px-3 py-1.5 rounded-lg text-xs font-bold text-[color:var(--negative)] border border-[color:var(--negative)]/30 hover:bg-[color:var(--negative)]/10 disabled:opacity-50">
            {isDeletingKey ? 'Removing...' : 'Remove'}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <input type="password" value={apiKeyInput} onChange={e => setApiKeyInput(e.target.value)} placeholder="Paste API key" className="w-full px-3 py-2 rounded-lg border border-[color:var(--border-default)] bg-[color:var(--elevated-1)] text-sm font-mono text-[color:var(--text-primary)] placeholder:text-[color:var(--text-tertiary)] focus:outline-none focus:border-[color:var(--accent)]" />
          <button onClick={onSave} disabled={isSavingKey || !apiKeyInput.trim()} className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-[color:var(--accent)] hover:opacity-90 disabled:opacity-50">
            {isSavingKey ? 'Saving securely...' : 'Save API Key'}
          </button>
        </div>
      )}
      <p className="text-[10px] text-[color:var(--text-tertiary)]">Stored encrypted on the server. The key is never exposed in the browser after saving.</p>
    </GlassCard>
  );
}

function ConnectionsSettings({ kite, megabull }: { kite: ConnectionKeyProps; megabull: ConnectionKeyProps }) {
  return (
    <div className="space-y-4">
      <div><h2 className="text-base font-extrabold text-[color:var(--text-primary)]">Trading Connections</h2><p className="text-xs text-[color:var(--text-secondary)] mt-1">Connect each account separately. Kite is used for real-order review; MegaBull is used for simulated trades and P&L.</p></div>
      <ConnectionKeyCard title="Zerodha Kite Publisher" description="Create a Kite Connect app, copy its API key, and use it to open reviewable orders on Kite." setupSteps={["Open developers.kite.trade and sign in.", "Create a Kite Connect app with Publisher access.", "Copy the API key and paste it here."]} keyData={kite} />
      <ConnectionKeyCard title="MegaBull Paper Trading" description="Create a MegaBull paper-trading API key to place virtual orders and sync positions and P&L into this console." setupSteps={["Create or sign in to a MegaBull account.", "Open Profile and generate an API key.", "Paste the key here; MegaBull keys expire monthly."]} keyData={megabull} />
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  helpText,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  helpText?: string;
}) {
  return (
    <div>
      <label className="text-xs font-bold text-[color:var(--text-primary)] block mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-lg border border-[color:var(--border-default)] bg-[color:var(--elevated-1)] text-sm font-bold text-[color:var(--text-primary)] placeholder:text-[color:var(--text-tertiary)] focus:outline-none focus:border-[color:var(--accent)]"
      />
      {helpText && <p className="text-[10px] text-[color:var(--text-tertiary)] mt-1">{helpText}</p>}
    </div>
  );
}

function ProfileSettings({
  user,
  profileName,
  setProfileName,
  onSaveProfileName,
  isSavingProfile,
  passwordForm,
  setPasswordForm,
  passwordError,
  onChangePassword,
  isChangingPassword,
  onDeleteAccount,
  apiKeyInput,
  setApiKeyInput,
  savedApiKey,
  showApiKey,
  setShowApiKey,
  isSavingKey,
  isDeletingKey,
  keyStatus,
  isLoadingKeyStatus,
  onSaveApiKey,
  onDeleteApiKey,
  isRevealingKey,
  revealedKey,
  handleRevealKey,
  handleCopyKey,
  handleApiKeyBlur,
  isCopyingKey,
}: {
  user: { email?: string | null; full_name?: string | null } | null;
  profileName: string;
  setProfileName: (v: string) => void;
  onSaveProfileName: () => void;
  isSavingProfile: boolean;
  passwordForm: { current: string; newPass: string };
  setPasswordForm: (f: { current: string; newPass: string }) => void;
  passwordError: string;
  onChangePassword: (e: React.FormEvent) => void;
  isChangingPassword: boolean;
  onDeleteAccount: () => void;
  apiKeyInput: string;
  setApiKeyInput: (v: string) => void;
  savedApiKey: string | null;
  showApiKey: boolean;
  setShowApiKey: (v: boolean) => void;
  isSavingKey: boolean;
  isDeletingKey: boolean;
  keyStatus: { configured: boolean; working: boolean };
  isLoadingKeyStatus: boolean;
  onSaveApiKey: () => void;
  onDeleteApiKey: () => void;
  isRevealingKey: boolean;
  revealedKey: string;
  handleRevealKey: () => void;
  handleCopyKey: () => void;
  handleApiKeyBlur: () => void;
  isCopyingKey: boolean;
  revealTimeout: NodeJS.Timeout | null;
  setIsRevealingKey: (v: boolean) => void;
  setRevealedKey: (v: string) => void;
}) {
  return (
    <div className="space-y-4">
      {/* Personal Info */}
      <GlassCard variant="default" padding="lg" className="space-y-4">
        <div>
          <h3 className="text-sm font-extrabold text-[color:var(--text-primary)] flex items-center gap-2">
            <Icon name="user" size={15} strokeWidth={2} />
            Personal Information
          </h3>
        </div>

        <TextField
          label="Full Name"
          value={profileName}
          onChange={setProfileName}
          placeholder="Enter your full name"
        />

        <div>
          <label className="text-xs font-bold text-[color:var(--text-primary)] block mb-1">Email</label>
          <div className="px-3 py-2 rounded-lg border border-[color:var(--border-default)] bg-[color:var(--ground-secondary)] text-sm text-[color:var(--text-secondary)]">
            {user?.user_metadata?.username ?? user?.email?.split('@')[0] ?? 'Not available'}
          </div>
          <p className="text-[10px] text-[color:var(--text-tertiary)] mt-1">Email cannot be changed</p>
        </div>

        <button
          onClick={onSaveProfileName}
          disabled={isSavingProfile || profileName.trim() === '' || profileName === (user?.user_metadata?.full_name ?? user?.full_name ?? '')}
          className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-[color:var(--accent)] hover:opacity-90 disabled:opacity-50 transition-colors"
        >
          {isSavingProfile ? 'Saving...' : 'Save Name'}
        </button>
      </GlassCard>

      {/* Change Password */}
      <GlassCard variant="default" padding="lg" className="space-y-4">
        <div>
          <h3 className="text-sm font-extrabold text-[color:var(--text-primary)] flex items-center gap-2">
            <Icon name="lock" size={15} strokeWidth={2} />
            Change Password
          </h3>
        </div>

        <form onSubmit={onChangePassword} className="space-y-3">
          <TextField
            label="Current Password"
            value={passwordForm.current}
            onChange={v => setPasswordForm({ ...passwordForm, current: v })}
            type="password"
            placeholder="Enter current password"
          />
          <TextField
            label="New Password"
            value={passwordForm.newPass}
            onChange={v => setPasswordForm({ ...passwordForm, newPass: v })}
            type="password"
            placeholder="Enter new password"
            helpText="Minimum 8 characters"
          />
          {passwordError && (
            <p className="text-xs font-bold text-[color:var(--negative)]">{passwordError}</p>
          )}
          <button
            type="submit"
            disabled={isChangingPassword || !passwordForm.current || !passwordForm.newPass}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-[color:var(--accent)] hover:opacity-90 disabled:opacity-50 transition-colors"
          >
            {isChangingPassword ? 'Changing...' : 'Change Password'}
          </button>
        </form>
      </GlassCard>

      {/* Delete Account */}
      <GlassCard variant="default" padding="lg">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-extrabold text-[color:var(--text-primary)]">Danger Zone</h3>
            <p className="text-xs text-[color:var(--text-secondary)] mt-1">
              Permanently delete your account and all paper trading data.
            </p>
          </div>
          <button
            onClick={onDeleteAccount}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-[color:var(--negative)] hover:opacity-90 transition-colors"
          >
            Delete Account
          </button>
        </div>
      </GlassCard>
    </div>
  );
}

function AppearanceSettings({
  themeMode,
  resolvedTheme,
  setThemeMode,
  options,
}: {
  themeMode: ThemeMode;
  resolvedTheme: 'light' | 'dark';
  setThemeMode: (m: ThemeMode) => void;
  options: { id: ThemeMode; label: string; sub: string; icon: IconName }[];
}) {
  return (
    <GlassCard variant="default" padding="lg" className="space-y-5">
      <div>
        <h3 className="text-sm font-extrabold text-[color:var(--text-primary)] flex items-center gap-2">
          <Icon name="palette" size={15} strokeWidth={2} />
          Appearance
        </h3>
        <p className="text-xs text-[color:var(--text-secondary)] mt-1">
          Choose how Quant Vision looks. System follows your operating system preference.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" data-testid="theme-options" data-current-theme={themeMode}>
        {options.map(opt => {
          const isActive = themeMode === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => setThemeMode(opt.id)}
              aria-pressed={isActive}
              data-testid={`theme-option-${opt.id}`}
              className={`relative flex flex-col items-start gap-2 p-4 rounded-xl border text-left transition-all duration-200 cursor-pointer ${
                isActive
                  ? 'border-[color:var(--accent)] bg-[color:var(--accent)]/10 ring-2 ring-[color:var(--accent)]/30'
                  : 'border-[color:var(--border-subtle)] hover:border-[color:var(--accent)]/50 hover:bg-[color:var(--ground-secondary)]'
              }`}
            >
              <div className="flex items-center gap-2 w-full">
                <Icon name={opt.icon} size={18} strokeWidth={2} />
                <span className="text-sm font-bold text-[color:var(--text-primary)]">{opt.label}</span>
                {isActive && (
                  <span className="ml-auto w-2 h-2 rounded-full bg-[color:var(--accent)] animate-pulse" aria-hidden="true" />
                )}
              </div>
              <span className="text-xs text-[color:var(--text-secondary)]">{opt.sub}</span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between p-3 rounded-lg bg-[color:var(--ground-secondary)] border border-[color:var(--border-subtle)]">
        <div>
          <p className="text-xs font-bold text-[color:var(--text-primary)]">Currently showing</p>
          <p className="text-[11px] text-[color:var(--text-secondary)] mt-0.5">
            Resolved to <span className="font-mono font-bold text-[color:var(--text-primary)]">{resolvedTheme}</span>
            {themeMode === 'system' && <span className="text-[color:var(--text-tertiary)]"> (following OS)</span>}
          </p>
        </div>
        <span
          data-testid="theme-resolved-badge"
          data-resolved={resolvedTheme}
          className="text-[10px] font-extrabold px-2.5 py-1 rounded-full border"
          style={{
            borderColor: resolvedTheme === 'dark' ? 'var(--accent-blue)' : 'var(--warning-amber)',
            color: resolvedTheme === 'dark' ? 'var(--accent-blue)' : 'var(--warning-amber)',
            background: resolvedTheme === 'dark' ? 'var(--accent-blue-light)' : 'var(--warning-amber-light)',
          }}
        >
          {resolvedTheme.toUpperCase()}
        </span>
      </div>
    </GlassCard>
  );
}
