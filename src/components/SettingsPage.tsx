import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard } from './GlassCard';
import { Icon, type IconName } from './Icon';
import { useTheme } from '../hooks/useTheme';
import type { ThemeMode } from '../hooks/useTheme';
import { useAuth } from './AuthProvider';
import { useToast } from './useToast';
import { getUniverseCounts, refreshUniverse } from '../services/universeService';

const ADMIN_TOKEN_STORAGE_KEY = 'stock-selector.adminToken';

interface UserSettings {
  total_capital: number;
  risk_per_trade_pct: number;
  max_position_pct: number;
  max_sector_pct: number;
  max_open_strategies: number;
  daily_loss_limit_pct: number;
  paper_trading_enabled: boolean;
  paper_trading_capital: number;
  zerodha_api_key?: string | null;
  zerodha_api_secret?: string | null;
  zerodha_access_token_expires_at?: string | null;
  full_name?: string | null;
}

interface SettingsPageProps {
  isLoggedIn: boolean;
  onLoginClick: () => void;
}

const SECTIONS = [
  { id: 'capital', label: 'Capital & Risk', icon: 'wallet' },
  { id: 'paper', label: 'Paper Trading', icon: 'note' },
  { id: 'kite', label: 'Zerodha API', icon: 'plug' },
  { id: 'universe', label: 'Stock Universe', icon: 'globe' },
  { id: 'appearance', label: 'Appearance', icon: 'palette' },
  { id: 'notifications', label: 'Notifications', icon: 'bell' },
] as const;

type SectionId = (typeof SECTIONS)[number]['id'];

export function SettingsPage({ isLoggedIn, onLoginClick }: SettingsPageProps) {
  const { user, getAccessToken } = useAuth();
  const toast = useToast();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [draft, setDraft] = useState<UserSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingToken, setIsGeneratingToken] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [activeSection, setActiveSection] = useState<SectionId>('capital');
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Notification preferences (local state since table doesn't exist yet)
  const [notifPrefs, setNotifPrefs] = useState({
    orderFills: true,
    gttTriggers: true,
    dailyLossAlert: true,
    emailNotifications: false,
  });

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

  useEffect(() => {
    fetchSettings();
  }, [isLoggedIn]);

  const handleSave = async () => {
    if (!draft || !user) return;
    setIsSaving(true);
    setSaveMessage(null);
    // Snapshot the previous server-confirmed settings so we can roll back
    // on error. Without this, a failed PATCH leaves the form in a
    // "saved-looking" state that diverges from the server.
    const previousSettings = settings;
    // Optimistic update: show the new values immediately so the UI
    // doesn't feel laggy. On failure we revert to `previousSettings`.
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
      // Roll back the optimistic update.
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

  /**
   * Generate token - redirects to Zerodha OAuth, then exchanges
   * the request_token for an access_token internally.
   */
  const handleGenerateToken = async () => {
    if (!draft?.zerodha_api_key?.trim() || !draft?.zerodha_api_secret?.trim()) {
      setSaveMessage({ type: 'error', text: 'Enter both API Key and API Secret' });
      toast.error('Enter both API Key and API Secret');
      setActiveSection('kite');
      return;
    }
    if (!user) {
      setSaveMessage({ type: 'error', text: 'Please sign in first' });
      toast.error('Please sign in first');
      return;
    }
    setIsGeneratingToken(true);
    setSaveMessage(null);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Not signed in');
      // Persist credentials first, then redirect to OAuth
      const res = await fetch('/api/kite/credentials', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          api_key: draft.zerodha_api_key.trim(),
          api_secret: draft.zerodha_api_secret.trim(),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to save credentials');
      }
      toast.success('Redirecting to Zerodha to authorize...');
      // Redirect to Zerodha OAuth - callback will exchange token
      const apiKey = draft.zerodha_api_key.trim();
      window.location.href = `https://kite.zerodha.com/connect/login?v=3&api_key=${encodeURIComponent(apiKey)}`;
    } catch (err: any) {
      setIsGeneratingToken(false);
      const message = err?.message || 'Failed to start token generation';
      setSaveMessage({ type: 'error', text: message });
      toast.error(`Token generation failed: ${message}`);
    }
  };

  const handleResetKite = async () => {
    if (!confirm('Reset Kite credentials? This will clear your API key and secret. You can reconfigure anytime from Settings.')) return;
    setIsResetting(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Not signed in');
      const res = await fetch('/api/kite/credentials', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to reset credentials');
      }
      // Refresh settings from server to get fresh state
      await fetchSettings();
      toast.success('Kite credentials reset. You can reconfigure anytime from Settings.');
    } catch (err: any) {
      toast.error(`Reset failed: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsResetting(false);
    }
  };

  const handleSaveKiteCredentials = async () => {
    if (!draft?.zerodha_api_key?.trim() || !draft?.zerodha_api_secret?.trim()) {
      setSaveMessage({ type: 'error', text: 'Enter both API Key and API Secret' });
      toast.error('Enter both API Key and API Secret');
      return;
    }
    if (!user) {
      setSaveMessage({ type: 'error', text: 'Please sign in first' });
      toast.error('Please sign in first');
      return;
    }
    setIsSaving(true);
    setSaveMessage(null);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Not signed in');
      const res = await fetch('/api/kite/credentials', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          api_key: draft.zerodha_api_key.trim(),
          api_secret: draft.zerodha_api_secret.trim(),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to save credentials');
      }
      // Refresh settings to get updated state
      await fetchSettings();
      setSaveMessage({ type: 'success', text: 'Credentials saved securely' });
      toast.success('Kite credentials saved securely');
    } catch (err: any) {
      const message = err?.message || 'Failed to save credentials';
      setSaveMessage({ type: 'error', text: message });
      toast.error(`Save failed: ${message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetPaper = async () => {
    if (!confirm('Reset paper trading portfolio? This cancels all open paper positions.')) return;
    if (!user) return;
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Not signed in');
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'reset_paper_portfolio' }),
      });
      if (!response.ok) throw new Error('Reset failed');
      const data = await response.json();
      setSaveMessage({ type: 'success', text: data.message });
      toast.success(data.message || 'Paper portfolio reset');
      fetchSettings();
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err: any) {
      const message = err?.message || 'Failed to reset paper portfolio';
      setSaveMessage({ type: 'error', text: message });
      toast.error(`Reset failed: ${message}`);
    }
  };

  const updateDraft = <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
    setDraft(prev => (prev ? { ...prev, [key]: value } : prev));
  };

  if (!isLoggedIn) {
    return (
      <GlassCard variant="default" padding="lg" className="text-center">
        <div className="w-16 h-16 flex items-center justify-center mx-auto mb-4 text-[color:var(--text-tertiary)]">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-slate-900 mb-1">Settings</h3>
        <p className="text-sm text-slate-500 mb-4">Login to manage your account settings</p>
        <button
          onClick={onLoginClick}
          className="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800"
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

      {/* Save bar */}
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
          {activeSection === 'capital' && (
            <CapitalRiskSettings 
              draft={draft} 
              updateDraft={updateDraft}
              onSave={handleSave}
              isSaving={isSaving}
            />
          )}
          {activeSection === 'paper' && (
            <PaperTradingSettings
              draft={draft}
              updateDraft={updateDraft}
              onReset={handleResetPaper}
              onSave={handleSave}
              isSaving={isSaving}
            />
          )}
          {activeSection === 'kite' && (
            <KiteSettings
              apiKey={settings?.zerodha_api_key}
              hasApiSecret={!!settings?.zerodha_api_secret}
              expiresAt={settings?.zerodha_access_token_expires_at}
              draft={draft}
              updateDraft={updateDraft}
              handleSave={handleSaveKiteCredentials}
              isSaving={isSaving}
              handleGenerateToken={handleGenerateToken}
              isGeneratingToken={isGeneratingToken}
              handleReset={handleResetKite}
              isResetting={isResetting}
            />
          )}
          {activeSection === 'universe' && (
            <StockUniverseSettings />
          )}
          {activeSection === 'appearance' && (
            <AppearanceSettings
              themeMode={themeMode}
              resolvedTheme={resolvedTheme}
              setThemeMode={setThemeMode}
              options={THEME_OPTIONS}
            />
          )}
          {activeSection === 'notifications' && (
            <NotificationSettings prefs={notifPrefs} setPrefs={setNotifPrefs} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step,
  prefix,
  suffix,
  helpText,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  prefix?: string;
  suffix?: string;
  helpText?: string;
}) {
  return (
    <div>
      <label className="text-xs font-bold text-slate-700 block mb-1">{label}</label>
      <div className="relative">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">{prefix}</span>
        )}
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          className={`w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            prefix ? 'pl-7' : ''
          } ${suffix ? 'pr-8' : ''}`}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">{suffix}</span>
        )}
      </div>
      {helpText && <p className="text-[10px] text-slate-400 mt-1">{helpText}</p>}
    </div>
  );
}

function CapitalRiskSettings({
  draft,
  updateDraft,
  onSave,
  isSaving,
}: {
  draft: UserSettings;
  updateDraft: <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => void;
  onSave: () => void;
  isSaving: boolean;
}) {
  return (
    <GlassCard variant="default" padding="lg" className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
            <Icon name="wallet" size={15} strokeWidth={2} />
            Capital & Risk Configuration
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            These limits protect your capital. The screener will block trades that exceed them.
          </p>
        </div>
        <button
          onClick={onSave}
          disabled={isSaving}
          className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-slate-700 hover:bg-slate-800 disabled:bg-slate-400 transition-colors"
        >
          {isSaving ? 'Saving…' : 'Save'}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <NumberField
          label="Total Capital"
          value={draft.total_capital}
          onChange={v => updateDraft('total_capital', v)}
          min={10000}
          max={100000000}
          step={10000}
          prefix="₹"
          helpText="Total deployable capital in your live account"
        />
        <NumberField
          label="Risk Per Trade"
          value={draft.risk_per_trade_pct}
          onChange={v => updateDraft('risk_per_trade_pct', v)}
          min={0.1}
          max={10}
          step={0.1}
          suffix="%"
          helpText="Maximum % of capital to risk on a single trade"
        />
        <NumberField
          label="Max Position Size"
          value={draft.max_position_pct}
          onChange={v => updateDraft('max_position_pct', v)}
          min={1}
          max={100}
          step={1}
          suffix="%"
          helpText="Maximum % of capital in a single position"
        />
        <NumberField
          label="Max Sector Exposure"
          value={draft.max_sector_pct}
          onChange={v => updateDraft('max_sector_pct', v)}
          min={1}
          max={100}
          step={1}
          suffix="%"
          helpText="Maximum % of capital in any one sector"
        />
        <NumberField
          label="Max Open Strategies"
          value={draft.max_open_strategies}
          onChange={v => updateDraft('max_open_strategies', v)}
          min={1}
          max={50}
          step={1}
          helpText="Maximum number of concurrent open positions"
        />
        <NumberField
          label="Daily Loss Limit"
          value={draft.daily_loss_limit_pct}
          onChange={v => updateDraft('daily_loss_limit_pct', v)}
          min={0.5}
          max={20}
          step={0.5}
          suffix="%"
          helpText="Block new trades when daily losses exceed this %"
        />
      </div>
    </GlassCard>
  );
}

function PaperTradingSettings({
  draft,
  updateDraft,
  onReset,
  onSave,
  isSaving,
}: {
  draft: UserSettings;
  updateDraft: <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => void;
  onReset: () => void;
  onSave: () => void;
  isSaving: boolean;
}) {
  return (
    <div className="space-y-4">
      <GlassCard variant="default" padding="lg" className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <Icon name="note" size={15} strokeWidth={2} />
              Paper Trading Mode
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Test strategies with simulated trades before risking real capital.
            </p>
          </div>
          <button
            onClick={onSave}
            disabled={isSaving}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-slate-700 hover:bg-slate-800 disabled:bg-slate-400 transition-colors"
          >
            {isSaving ? 'Saving…' : 'Save'}
          </button>
        </div>

        <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 cursor-pointer">
          <div>
            <div className="text-sm font-bold text-slate-900">Enable Paper Trading</div>
            <div className="text-xs text-slate-500">Show paper trading options in execute modal</div>
          </div>
          <input
            type="checkbox"
            checked={draft.paper_trading_enabled}
            onChange={e => updateDraft('paper_trading_enabled', e.target.checked)}
            className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
        </label>

        <NumberField
          label="Virtual Capital"
          value={draft.paper_trading_capital}
          onChange={v => updateDraft('paper_trading_capital', v)}
          min={10000}
          max={100000000}
          step={10000}
          prefix="₹"
          helpText="Starting capital for paper trading simulation"
        />

        <button
          onClick={onReset}
          className="w-full px-3 py-2 rounded-lg bg-rose-50 text-rose-700 text-xs font-bold border border-rose-200 hover:bg-rose-100 transition-colors"
        >
          Reset Paper Portfolio (cancel all open paper positions)
        </button>
      </GlassCard>
    </div>
  );
}

function KiteSettings({
  apiKey,
  hasApiSecret,
  expiresAt,
  draft,
  updateDraft,
  handleSave,
  isSaving,
  handleGenerateToken,
  isGeneratingToken,
  handleReset,
  isResetting,
}: {
  apiKey?: string | null;
  hasApiSecret?: boolean;
  expiresAt?: string | null;
  draft: UserSettings | null;
  updateDraft: <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => void;
  handleSave: () => void;
  isSaving: boolean;
  handleGenerateToken: () => void;
  isGeneratingToken: boolean;
  handleReset: () => void;
  isResetting: boolean;
}) {
  const isConfigured = !!apiKey && !!hasApiSecret;
  const expiresAtDate = expiresAt ? new Date(expiresAt) : null;
  const isExpired = expiresAtDate ? expiresAtDate < new Date() : true;
  const needsToken = !expiresAt || isExpired;

  // 3 states:
  // 1. Fully connected (credentials + active token) → status only, no form
  // 2. Configured but token expired/missing → Generate Token button
  // 3. Not configured → show form

  // Fully active - no form needed
  if (isConfigured && !needsToken) {
    return (
      <GlassCard variant="default" padding="lg" className="space-y-4">
        <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
          <Icon name="plug" size={15} strokeWidth={2} />
          Zerodha Kite API
        </h3>
        <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 border border-emerald-200">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-emerald-500" />
            <div>
              <div className="text-sm font-bold text-slate-900">Connected</div>
              {expiresAtDate && (
                <div className="text-xs text-slate-500">
                  Expires: {expiresAtDate.toLocaleString('en-IN')}
                </div>
              )}
            </div>
          </div>
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard variant="default" padding="lg" className="space-y-4">
      <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
        <Icon name="plug" size={15} strokeWidth={2} />
        Zerodha Kite API
      </h3>

      {/* Status Banner */}
      <div
        className={`flex items-center justify-between p-3 rounded-xl ${
          isConfigured ? 'bg-amber-50 border border-amber-200' : 'bg-rose-50 border border-rose-200'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${isConfigured ? 'bg-amber-500 animate-pulse' : 'bg-rose-500'}`} />
          <div>
            <div className="text-sm font-bold text-slate-900">
              {isConfigured ? 'Token Expired' : 'Not Configured'}
            </div>
            {expiresAtDate && isConfigured && (
              <div className="text-xs text-slate-500">
                Expired: {expiresAtDate.toLocaleString('en-IN')}
              </div>
            )}
          </div>
        </div>
        {isConfigured && (
          <button
            onClick={handleGenerateToken}
            disabled={isGeneratingToken}
            className="px-3 py-1.5 rounded-lg bg-orange-600 text-white text-xs font-bold hover:bg-orange-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
          >
            {isGeneratingToken ? 'Generating...' : 'Generate Token'}
          </button>
        )}
      </div>

      {/* Form - only shown when NOT configured */}
      {!isConfigured && (
        <>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Kite API Key
            </label>
            <input
              type="text"
              value={draft?.zerodha_api_key ?? ''}
              onChange={e => updateDraft('zerodha_api_key', e.target.value)}
              placeholder="e.g. 5u968to2eligtgz8"
              className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white/70 focus:ring-2 focus:ring-slate-900 focus:outline-none transition-all font-mono text-xs focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Kite API Secret <span className="text-rose-500">*</span>
            </label>
            <input
              type="password"
              value={(draft as any)?.zerodha_api_secret ?? ''}
              onChange={e => updateDraft('zerodha_api_secret' as any, e.target.value as any)}
              placeholder="••••••••••••••••"
              className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white/70 focus:ring-2 focus:ring-slate-900 focus:outline-none transition-all font-mono text-xs focus:bg-white"
            />
          </div>

          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-slate-700 hover:bg-slate-800 disabled:bg-slate-400 transition-colors w-full sm:w-auto"
          >
            {isSaving ? 'Saving…' : 'Save Credentials'}
          </button>
        </>
      )}

      {isConfigured && (
        <button
          onClick={handleReset}
          disabled={isResetting}
          className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 disabled:bg-slate-50 transition-colors"
        >
          {isResetting ? 'Resetting...' : 'Reset Credentials'}
        </button>
      )}

      <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-800 flex items-start gap-1.5">
        <Icon name="info" size={14} strokeWidth={2} className="mt-0.5 shrink-0" />
        <span className="font-semibold">Get your API key + secret from{' '}</span>
        <a
          href="https://developers.kite.trade/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline font-semibold"
        >
          developers.kite.trade
        </a>
        <span className="font-semibold">.</span>
        <span className="font-semibold">Credentials are stored encrypted and only used to generate your daily access token. Access tokens auto-expire at 6 AM next day.</span>
      </div>
    </GlassCard>
  );
}

function NotificationSettings({
  prefs,
  setPrefs,
}: {
  prefs: { orderFills: boolean; gttTriggers: boolean; dailyLossAlert: boolean; emailNotifications: boolean };
  setPrefs: React.Dispatch<React.SetStateAction<typeof prefs>>;
}) {
  return (
    <GlassCard variant="default" padding="lg" className="space-y-4">
      <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
        <Icon name="bell" size={15} strokeWidth={2} />
        Notification Preferences
      </h3>
      <p className="text-xs text-slate-500">
        Choose which events trigger notifications.
      </p>

      {[
        { key: 'orderFills', label: 'Order Fills', desc: 'Notify when entry or exit orders execute' },
        { key: 'gttTriggers', label: 'GTT Triggers', desc: 'Notify when stop loss or target GTTs fire' },
        { key: 'dailyLossAlert', label: 'Daily Loss Limit', desc: 'Alert when daily P&L approaches your configured limit' },
      ].map(item => (
        <label key={item.key} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 cursor-pointer">
          <div>
            <div className="text-sm font-bold text-slate-900">{item.label}</div>
            <div className="text-xs text-slate-500">{item.desc}</div>
          </div>
          <input
            type="checkbox"
            checked={prefs[item.key as keyof typeof prefs]}
            onChange={e => setPrefs(prev => ({ ...prev, [item.key]: e.target.checked }))}
            className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
        </label>
      ))}

      <div className="pt-3 border-t border-slate-200">
        <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 cursor-pointer">
          <div>
            <div className="text-sm font-bold text-slate-900">Email Notifications</div>
            <div className="text-xs text-slate-500">Also send critical alerts via email (coming soon)</div>
          </div>
          <input
            type="checkbox"
            checked={prefs.emailNotifications}
            onChange={e => setPrefs(prev => ({ ...prev, emailNotifications: e.target.checked }))}
            disabled
            className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
          />
        </label>
      </div>
    </GlassCard>
  );
}

interface AppearanceOption {
  id: ThemeMode;
  label: string;
  sub: string;
  icon: IconName;
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
  options: AppearanceOption[];
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
        {options.map((opt) => {
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
                  ? 'border-accent-blue bg-accent-blue-light ring-2 ring-accent-blue/30'
                  : 'border-glass-border-subtle hover:border-accent-blue/50 hover:bg-glass-bg-subtle'
              }`}
            >
              <div className="flex items-center gap-2 w-full">
                <Icon name={opt.icon} size={18} strokeWidth={2} />
                <span className="text-sm font-bold text-[color:var(--text-primary)]">{opt.label}</span>
                {isActive && (
                  <span className="ml-auto w-2 h-2 rounded-full bg-accent-blue animate-pulse" aria-hidden="true" />
                )}
              </div>
              <span className="text-xs text-[color:var(--text-secondary)]">{opt.sub}</span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between p-3 rounded-lg bg-glass-bg-subtle border border-glass-border-subtle">
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

// ---------------------------------------------------------------------------
// Stock Universe Settings
// ---------------------------------------------------------------------------
//
// Lets admins (those who hold the CRON_SECRET) trigger a server-side
// re-fetch of the NSE index lists (Nifty 100 / Midcap 100 / Smallcap 250)
// and upsert them into the `stock_universe` table. The token never leaves
// the browser; the server compares it to CRON_SECRET on each request.
//
// The token is stored in localStorage so the user only has to paste it once
// per browser. It is masked in the UI (type=password) and never logged.
// ---------------------------------------------------------------------------

interface UniverseCounts {
  large: number;
  mid: number;
  small: number;
  total: number;
}

function StockUniverseSettings() {
  const toast = useToast();
  const [counts, setCounts] = useState<UniverseCounts | null>(null);
  const [lastRefresh, setLastRefresh] = useState<string | null>(null);
  const [isLoadingCounts, setIsLoadingCounts] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [adminToken, setAdminToken] = useState<string>(() => {
    try {
      return localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) ?? '';
    } catch {
      return '';
    }
  });
  const [showToken, setShowToken] = useState(false);

  const loadCounts = async () => {
    setIsLoadingCounts(true);
    try {
      const c = await getUniverseCounts();
      setCounts(c);
    } catch (err: any) {
      console.error('Universe counts error:', err);
      toast.error(`Couldn't load universe counts: ${err?.message || 'network error'}`);
    } finally {
      setIsLoadingCounts(false);
    }
  };

  useEffect(() => {
    loadCounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTokenChange = (value: string) => {
    setAdminToken(value);
    try {
      if (value) localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, value);
      else localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
    } catch {
      // localStorage may be unavailable (private mode, SSR) — non-fatal
    }
  };

  const handleClearToken = () => {
    handleTokenChange('');
    setShowToken(false);
    toast.info('Admin token cleared from this browser');
  };

  const handleRefresh = async () => {
    const token = adminToken.trim();
    if (!token) {
      toast.error('Enter the admin token first (CRON_SECRET).');
      return;
    }
    setIsRefreshing(true);
    try {
      const res = await fetch('/api/admin/refresh-universe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': token,
        },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      // Clear the in-memory universe cache so subsequent reads pick up new tickers
      await refreshUniverse();
      const c = await getUniverseCounts();
      setCounts(c);
      setLastRefresh(new Date().toISOString());
      toast.success(
        `Universe refreshed: ${data.large ?? 0} large · ${data.mid ?? 0} mid · ${data.small ?? 0} small (${data.total ?? c.total} total) in ${(data.durationMs ?? 0) / 1000}s`
      );
    } catch (err: any) {
      console.error('Refresh universe error:', err);
      const msg = err?.message || 'network error';
      // 401 means the token didn't match CRON_SECRET
      if (/401|unauthorized/i.test(msg)) {
        toast.error('Token rejected by server. Check CRON_SECRET and try again.');
      } else {
        toast.error(`Refresh failed: ${msg}`);
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <GlassCard variant="default" padding="lg" className="space-y-4">
      <div>
        <h3 className="text-sm font-extrabold text-[color:var(--text-primary)]">Stock Universe</h3>
        <p className="text-xs text-[color:var(--text-secondary)] mt-1">
          Source of truth for the scanner. Counts are pulled from the in-memory
          cache (DB-backed when Supabase is reachable, seed fallback otherwise).
        </p>
      </div>

      {/* Counts */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" data-testid="universe-counts">
        {isLoadingCounts ? (
          [1, 2, 3, 4].map((n) => (
            <div key={n} className="h-16 rounded-xl bg-glass-bg-subtle animate-pulse" />
          ))
        ) : counts ? (
          <>
            <CountChip label="Large" value={counts.large} capCategory="large" />
            <CountChip label="Mid" value={counts.mid} capCategory="mid" />
            <CountChip label="Small" value={counts.small} capCategory="small" />
            <CountChip label="Total" value={counts.total} capCategory="total" highlight />
          </>
        ) : (
          <div className="col-span-full text-xs text-[color:var(--text-secondary)]">Counts unavailable.</div>
        )}
      </div>

      {lastRefresh && (
        <p className="text-[11px] text-[color:var(--text-secondary)]" data-testid="universe-last-refresh">
          Last server refresh: {new Date(lastRefresh).toLocaleString()}
        </p>
      )}

      {/* Admin token + refresh */}
      <div className="p-3 rounded-xl border border-glass-border-subtle bg-glass-bg-subtle space-y-3">
        <div>
          <p className="text-xs font-bold text-[color:var(--text-primary)]">Refresh from NSE</p>
          <p className="text-[11px] text-[color:var(--text-secondary)] mt-0.5">
            Fetches Nifty 100 / Midcap 100 / Smallcap 250 CSV lists and upserts to
            the <span className="font-mono">stock_universe</span> table. Requires
            the <span className="font-mono">CRON_SECRET</span> admin token.
          </p>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="admin-token" className="text-[11px] font-bold text-[color:var(--text-secondary)]">
            Admin token (CRON_SECRET)
          </label>
          <div className="flex gap-2">
            <input
              id="admin-token"
              data-testid="universe-admin-token"
              type={showToken ? 'text' : 'password'}
              value={adminToken}
              onChange={(e) => handleTokenChange(e.target.value)}
              placeholder="Paste your CRON_SECRET here"
              autoComplete="off"
              spellCheck={false}
              className="flex-1 px-3 py-2 rounded-lg border border-glass-border-subtle bg-white text-xs font-mono text-[color:var(--text-primary)] placeholder:text-[color:var(--text-tertiary)] focus:outline-none focus:border-accent-blue"
            />
            <button
              type="button"
              onClick={() => setShowToken((v) => !v)}
              className="px-3 py-2 rounded-lg border border-glass-border-subtle bg-white text-[11px] font-bold text-[color:var(--text-secondary)] hover:bg-glass-bg-subtle"
              aria-label={showToken ? 'Hide token' : 'Show token'}
            >
              {showToken ? 'Hide' : 'Show'}
            </button>
            {adminToken && (
              <button
                type="button"
                onClick={handleClearToken}
                className="px-3 py-2 rounded-lg border border-glass-border-subtle bg-white text-[11px] font-bold text-rose-600 hover:bg-rose-50"
              >
                Clear
              </button>
            )}
          </div>
          <p className="text-[10px] text-[color:var(--text-tertiary)]">
            Stored locally in this browser only. Never sent anywhere except
            directly to the refresh endpoint.
          </p>
        </div>

        <button
          type="button"
          onClick={handleRefresh}
          disabled={isRefreshing || !adminToken.trim()}
          data-testid="universe-refresh-button"
          className="w-full sm:w-auto px-4 py-2 rounded-lg bg-accent-blue text-white text-xs font-bold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isRefreshing ? (
            <>
              <span className="w-3 h-3 rounded-full border-2 border-white/40 border-t-white animate-spin" />
              Refreshing from NSE…
            </>
          ) : (
            <>
              <Icon name="refresh" size={13} strokeWidth={2.2} />
              <span>Refresh Universe</span>
            </>
          )}
        </button>
      </div>
    </GlassCard>
  );
}

function CountChip({
  label,
  value,
  capCategory,
  highlight = false,
}: {
  label: string;
  value: number;
  capCategory: 'large' | 'mid' | 'small' | 'total';
  highlight?: boolean;
}) {
  return (
    <div
      data-testid={`universe-count-${capCategory}`}
      className={`p-3 rounded-xl border ${
        highlight
          ? 'border-accent-blue bg-accent-blue-light'
          : 'border-glass-border-subtle bg-white'
      }`}
    >
      <p className="text-[10px] font-extrabold uppercase tracking-wide text-[color:var(--text-secondary)]">{label}</p>
      <p className="text-lg font-extrabold text-[color:var(--text-primary)] mt-0.5">{value}</p>
    </div>
  );
}
