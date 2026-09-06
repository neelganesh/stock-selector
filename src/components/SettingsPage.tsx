import { useState, useEffect, useCallback } from 'react';
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
  { id: 'paper', label: 'Paper Trading', icon: 'note' as const },
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
      if (!token) return;
      setIsLoadingKeyStatus(true);
      const res = await fetch('/api/kite/key-status', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setKeyStatus({ configured: data.configured ?? false, working: data.working ?? false });
      }
    } catch {
      // non-critical
    } finally {
      setIsLoadingKeyStatus(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    const timer = setTimeout(fetchSettings, 100);
    return () => clearTimeout(timer);
  }, [isLoggedIn]);

  // Load profile name from user
  useEffect(() => {
    if (user) {
      setProfileNameDraft(user.full_name ?? '');
    }
  }, [user]);

  // Load zerodha key status whenever profile section is active
  useEffect(() => {
    if (activeSection === 'profile') {
      fetchKeyStatus();
    }
  }, [activeSection, fetchKeyStatus]);

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
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Save failed');
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
        const err = await res.json().catch(() => ({}));
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
        const err = await res.json().catch(() => ({}));
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
      const res = await fetch('/api/kite/save-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ api_key: apiKeyInput.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
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
      const res = await fetch('/api/kite/delete-key', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
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
        const err = await res.json().catch(() => ({}));
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
        email={user?.email ?? ''}
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

      {/* Save bar for paper trading */}
      <AnimatePresence>
        {activeSection === 'paper' && JSON.stringify(settings) !== JSON.stringify(draft) && (
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
            />
          )}
          {activeSection === 'paper' && (
            <PaperTradingSettings
              draft={draft}
              updateDraft={updateDraft}
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
            {user?.email ?? 'Not available'}
          </div>
          <p className="text-[10px] text-[color:var(--text-tertiary)] mt-1">Email cannot be changed</p>
        </div>

        <button
          onClick={onSaveProfileName}
          disabled={isSavingProfile || profileName === (user?.full_name ?? '')}
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

      {/* Zerodha Publisher API Key */}
      <GlassCard variant="default" padding="lg" className="space-y-4">
        <div>
          <h3 className="text-sm font-extrabold text-[color:var(--text-primary)] flex items-center gap-2">
            <Icon name="link" size={15} strokeWidth={2} />
            Zerodha Publisher API Key
          </h3>
          <p className="text-xs text-[color:var(--text-secondary)] mt-1">
            Publisher mode connects your Kite account without OAuth.
          </p>
        </div>

        {savedApiKey ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-[color:var(--ground-secondary)] border border-[color:var(--border-default)]">
              <div>
                <p className="text-xs font-bold text-[color:var(--text-primary)]">Saved API Key</p>
                <p className="text-sm font-mono text-[color:var(--text-secondary)]">{savedApiKey}</p>
              </div>
              <button
                onClick={onDeleteApiKey}
                disabled={isDeletingKey}
                className="px-3 py-1.5 rounded-lg text-xs font-bold text-[color:var(--negative)] border border-[color:var(--negative)]/30 hover:bg-[color:var(--negative)]/10 disabled:opacity-50 transition-colors"
              >
                {isDeletingKey ? 'Removing...' : 'Remove'}
              </button>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span className={keyStatus.configured ? 'w-2 h-2 rounded-full bg-[color:var(--positive)]' : 'w-2 h-2 rounded-full bg-[color:var(--text-tertiary)]'} />
                <span className="text-xs text-[color:var(--text-secondary)]">
                  {isLoadingKeyStatus ? 'Checking...' : keyStatus.configured ? 'Configured' : 'Not configured'}
                </span>
              </div>
              {keyStatus.configured && (
                <div className="flex items-center gap-1.5">
                  <span className={keyStatus.working ? 'w-2 h-2 rounded-full bg-[color:var(--positive)]' : 'w-2 h-2 rounded-full bg-[color:var(--warning-amber)]'} />
                  <span className="text-xs text-[color:var(--text-secondary)]">
                    {keyStatus.working ? 'Working' : 'Not working'}
                  </span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="relative">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={apiKeyInput}
                onChange={e => setApiKeyInput(e.target.value)}
                placeholder="Enter your Kite API key"
                className="w-full px-3 py-2 pr-10 rounded-lg border border-[color:var(--border-default)] bg-[color:var(--elevated-1)] text-sm font-mono text-[color:var(--text-primary)] placeholder:text-[color:var(--text-tertiary)] focus:outline-none focus:border-[color:var(--accent)]"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[color:var(--text-tertiary)] hover:text-[color:var(--text-primary)]"
                aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
              >
                <Icon name={showApiKey ? 'eye-off' : 'eye'} size={15} strokeWidth={2} />
              </button>
            </div>
            <button
              onClick={onSaveApiKey}
              disabled={isSavingKey || !apiKeyInput.trim()}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-[color:var(--accent)] hover:opacity-90 disabled:opacity-50 transition-colors"
            >
              {isSavingKey ? 'Saving...' : 'Save API Key'}
            </button>
          </div>
        )}
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

function PaperTradingSettings({
  draft,
  updateDraft,
}: {
  draft: UserSettings;
  updateDraft: <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => void;
}) {
  return (
    <GlassCard variant="default" padding="lg" className="space-y-4">
      <div>
        <h3 className="text-sm font-extrabold text-[color:var(--text-primary)] flex items-center gap-2">
          <Icon name="note" size={15} strokeWidth={2} />
          Paper Trading
        </h3>
        <p className="text-xs text-[color:var(--text-secondary)] mt-1">
          Test strategies with simulated trades before risking real capital.
        </p>
      </div>

      <label className="flex items-center justify-between p-3 rounded-xl bg-[color:var(--ground-secondary)] cursor-pointer">
        <div>
          <div className="text-sm font-bold text-[color:var(--text-primary)]">Enable Paper Trading</div>
          <div className="text-xs text-[color:var(--text-secondary)]">Show paper trading options in execute modal</div>
        </div>
        <input
          type="checkbox"
          checked={draft.paper_trading_enabled}
          onChange={e => updateDraft('paper_trading_enabled', e.target.checked)}
          className="w-5 h-5 rounded border-[color:var(--border-default)] text-[color:var(--accent)] focus:ring-[color:var(--accent)]"
        />
      </label>

      <div>
        <label className="text-xs font-bold text-[color:var(--text-primary)] block mb-1">Virtual Capital</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-[color:var(--text-tertiary)]">{'₹'}</span>
          <input
            type="number"
            value={draft.paper_trading_capital}
            min={10000}
            max={100000000}
            step={10000}
            onChange={e => updateDraft('paper_trading_capital', parseFloat(e.target.value) || 0)}
            className="w-full pl-7 pr-3 py-2 rounded-lg border border-[color:var(--border-default)] bg-[color:var(--elevated-1)] text-sm font-bold text-[color:var(--text-primary)] focus:outline-none focus:border-[color:var(--accent)]"
          />
        </div>
        <p className="text-[10px] text-[color:var(--text-tertiary)] mt-1">Starting capital for paper trading simulation</p>
      </div>
    </GlassCard>
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
