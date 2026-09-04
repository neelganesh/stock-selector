import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard } from './GlassCard';
import { useTheme } from '../hooks/useTheme';
import type { ThemeMode } from '../hooks/useTheme';
import { useAuth } from './AuthProvider';

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
  { id: 'capital', label: 'Capital & Risk', icon: '💰' },
  { id: 'paper', label: 'Paper Trading', icon: '📝' },
  { id: 'kite', label: 'Zerodha API', icon: '🔌' },
  { id: 'appearance', label: 'Appearance', icon: '🎨' },
  { id: 'notifications', label: 'Notifications', icon: '🔔' },
] as const;

type SectionId = (typeof SECTIONS)[number]['id'];

export function SettingsPage({ isLoggedIn, onLoginClick }: SettingsPageProps) {
  const { user, getAccessToken } = useAuth();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [draft, setDraft] = useState<UserSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
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

  const THEME_OPTIONS: { id: ThemeMode; label: string; sub: string; icon: string }[] = [
    { id: 'system', label: 'System', sub: 'Follow OS setting', icon: '🖥️' },
    { id: 'light', label: 'Light', sub: 'Always light', icon: '☀️' },
    { id: 'dark', label: 'Dark', sub: 'Always dark', icon: '🌙' },
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
    } catch (err) {
      console.error('Settings fetch error:', err);
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
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err: any) {
      setSaveMessage({ type: 'error', text: err.message || 'Failed to save settings' });
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Auto-save credentials + redirect to Zerodha OAuth in one step.
   * Why: previously the user had to click "Save Credentials" and then
   * "Login to Zerodha" separately. If they forgot Save, the Login button
   * would redirect but the backend would have no api_secret to exchange
   * the request_token later, leading to a confusing 400.
   */
  const handleSaveAndLogin = async () => {
    if (!draft?.zerodha_api_key?.trim() || !draft?.zerodha_api_secret?.trim()) {
      setSaveMessage({ type: 'error', text: 'Enter both API Key and API Secret' });
      setActiveSection('kite');
      return;
    }
    if (!user) {
      setSaveMessage({ type: 'error', text: 'Please sign in first' });
      return;
    }
    setIsLoggingIn(true);
    setSaveMessage(null);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Not signed in');
      // Persist the credentials to the backend first so the OAuth callback
      // can use them to exchange the request_token for an access_token.
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          zerodha_api_key: draft.zerodha_api_key.trim(),
          zerodha_api_secret: draft.zerodha_api_secret.trim(),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to save credentials');
      }
      // Now redirect to Zerodha's OAuth page.
      const apiKey = draft.zerodha_api_key.trim();
      window.location.href = `https://kite.zerodha.com/connect/login?v=3&api_key=${encodeURIComponent(apiKey)}`;
    } catch (err: any) {
      setIsLoggingIn(false);
      setSaveMessage({ type: 'error', text: err.message || 'Failed to start Zerodha login' });
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
      fetchSettings();
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err) {
      setSaveMessage({ type: 'error', text: 'Failed to reset paper portfolio' });
    }
  };

  const updateDraft = <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
    setDraft(prev => (prev ? { ...prev, [key]: value } : prev));
  };

  if (!isLoggedIn) {
    return (
      <GlassCard variant="default" padding="lg" className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4 text-slate-400">
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
            <div key={n} className="h-12 rounded-xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-4">
      {/* Section Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-slate-50/50 border border-slate-200/60 overflow-x-auto">
        {SECTIONS.map(section => (
          <button
            key={section.id}
            onClick={() => setActiveSection(section.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
              activeSection === section.id
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <span>{section.icon}</span>
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
            className="flex items-center justify-between p-3 rounded-xl bg-amber-50 border border-amber-200"
          >
            <span className="text-xs font-bold text-amber-800">You have unsaved changes</span>
            <div className="flex gap-2">
              <button
                onClick={() => setDraft(settings)}
                className="px-3 py-1.5 rounded-lg bg-white text-slate-700 text-xs font-bold hover:bg-slate-50"
              >
                Discard
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-bold hover:bg-amber-700 disabled:opacity-50"
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
            className={`p-3 rounded-xl text-xs font-bold ${
              saveMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
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
            <CapitalRiskSettings draft={draft} updateDraft={updateDraft} />
          )}
          {activeSection === 'paper' && (
            <PaperTradingSettings
              draft={draft}
              updateDraft={updateDraft}
              onReset={handleResetPaper}
            />
          )}
          {activeSection === 'kite' && (
            <KiteSettings
              apiKey={settings?.zerodha_api_key}
              expiresAt={settings?.zerodha_access_token_expires_at}
              draft={draft}
              updateDraft={updateDraft}
              handleSave={handleSave}
              isSaving={isSaving}
              handleSaveAndLogin={handleSaveAndLogin}
              isLoggingIn={isLoggingIn}
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
}: {
  draft: UserSettings;
  updateDraft: <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => void;
}) {
  return (
    <GlassCard variant="default" padding="lg" className="space-y-4">
      <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
        <span>💰</span>
        Capital & Risk Configuration
      </h3>
      <p className="text-xs text-slate-500">
        These limits protect your capital. The screener will block trades that exceed them.
      </p>

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
}: {
  draft: UserSettings;
  updateDraft: <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => void;
  onReset: () => void;
}) {
  return (
    <div className="space-y-4">
      <GlassCard variant="default" padding="lg" className="space-y-4">
        <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
          <span>📝</span>
          Paper Trading Mode
        </h3>
        <p className="text-xs text-slate-500">
          Test strategies with simulated trades before risking real capital.
        </p>

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
  expiresAt,
  draft,
  updateDraft,
  handleSave,
  isSaving,
  handleSaveAndLogin,
  isLoggingIn,
}: {
  apiKey?: string | null;
  expiresAt?: string | null;
  draft: UserSettings | null;
  updateDraft: <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => void;
  handleSave: () => void;
  isSaving: boolean;
  handleSaveAndLogin: () => void;
  isLoggingIn: boolean;
}) {
  const isConnected = !!apiKey;
  const expiresAtDate = expiresAt ? new Date(expiresAt) : null;
  const isExpired = expiresAtDate ? expiresAtDate < new Date() : true;

  const handleLoginRedirect = () => {
    if (!draft?.zerodha_api_key) return;
    window.location.href = `https://kite.zerodha.com/connect/login?v=3&api_key=${encodeURIComponent(draft.zerodha_api_key)}`;
  };

  return (
    <GlassCard variant="default" padding="lg" className="space-y-4">
      <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
        <span>🔌</span>
        Zerodha Kite API
      </h3>

      <div
        className={`flex items-center justify-between p-3 rounded-xl ${
          isConnected && !isExpired
            ? 'bg-emerald-50 border border-emerald-200'
            : 'bg-rose-50 border border-rose-200'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-3 h-3 rounded-full ${
              isConnected && !isExpired ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
            }`}
          />
          <div>
            <div className="text-sm font-bold text-slate-900">
              {isConnected && !isExpired ? 'Connected' : isConnected ? 'Token Expired' : 'Not Connected'}
            </div>
            {expiresAtDate && (
              <div className="text-xs text-slate-500">
                {isExpired ? 'Expired' : 'Expires'}: {expiresAtDate.toLocaleString('en-IN')}
              </div>
            )}
          </div>
        </div>
        <button
          onClick={handleLoginRedirect}
          disabled={!draft?.zerodha_api_key}
          className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed"
        >
          {isConnected ? 'Reconnect' : 'Login to Zerodha'}
        </button>
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1">
          Kite API Key
        </label>
        <input
          type="text"
          value={draft?.zerodha_api_key ?? ''}
          onChange={e => updateDraft('zerodha_api_key', e.target.value)}
          placeholder="e.g. 5u968to2eligtgz8"
          className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white/70 focus:bg-white focus:ring-2 focus:ring-slate-900 focus:outline-none transition-all font-mono text-xs"
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
          className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white/70 focus:bg-white focus:ring-2 focus:ring-slate-900 focus:outline-none transition-all font-mono text-xs"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-slate-700 hover:bg-slate-800 disabled:bg-slate-400 transition-colors"
        >
          {isSaving ? 'Saving…' : 'Save Credentials'}
        </button>
        <button
          onClick={handleSaveAndLogin}
          disabled={isLoggingIn || !draft?.zerodha_api_key?.trim() || !draft?.zerodha_api_secret?.trim()}
          className="px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-orange-600 hover:bg-orange-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
        >
          {isLoggingIn ? 'Redirecting…' : 'Save & Login to Zerodha'}
        </button>
      </div>

      <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-800">
        <strong>ℹ️</strong> Get your API key + secret from{' '}
        <a
          href="https://developers.kite.trade/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline font-semibold"
        >
          developers.kite.trade
        </a>
        . Credentials are stored encrypted and only used to generate your daily access token.
        Access tokens auto-expire at 6 AM next day.
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
        <span>🔔</span>
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
  icon: string;
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
        <h3 className="text-sm font-extrabold text-text-primary flex items-center gap-2">
          <span>🎨</span>
          Appearance
        </h3>
        <p className="text-xs text-text-secondary mt-1">
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
                <span className="text-lg" aria-hidden="true">{opt.icon}</span>
                <span className="text-sm font-bold text-text-primary">{opt.label}</span>
                {isActive && (
                  <span className="ml-auto w-2 h-2 rounded-full bg-accent-blue animate-pulse" aria-hidden="true" />
                )}
              </div>
              <span className="text-xs text-text-secondary">{opt.sub}</span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between p-3 rounded-lg bg-glass-bg-subtle border border-glass-border-subtle">
        <div>
          <p className="text-xs font-bold text-text-primary">Currently showing</p>
          <p className="text-[11px] text-text-secondary mt-0.5">
            Resolved to <span className="font-mono font-bold text-text-primary">{resolvedTheme}</span>
            {themeMode === 'system' && <span className="text-text-tertiary"> (following OS)</span>}
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
