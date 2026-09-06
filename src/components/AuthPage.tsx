import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from './AuthProvider';

export function AuthPage({ onClose }: { onClose: () => void }) {
  const { signIn, signUp, loading } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      let result;
      if (isLogin) {
        result = await signIn(email, password);
      } else {
        result = await signUp(email, password, fullName);
      }

      if (result.error) {
        setError(result.error.message);
      } else {
        onClose();
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 backdrop-blur-md"
          style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-md rounded-3xl shadow-2xl overflow-hidden p-6 sm:p-8 space-y-6"
          data-modal-panel
          style={{
            backgroundColor: 'var(--elevated-1)',
            border: '1px solid var(--border-default)',
          }}
        >
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-full transition-colors"
            style={{ color: 'var(--text-tertiary)' }}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div className="text-center">
            <h3 className="text-xl font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>
              {isLogin ? 'Welcome Back' : 'Create Account'}
            </h3>
            <p className="text-xs font-medium mt-1" style={{ color: 'var(--text-secondary)' }}>
              {isLogin ? 'Sign in to access your trading dashboard' : 'Join to track strategies and execute trades'}
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-xl text-xs font-medium" style={{ 
              backgroundColor: 'var(--ground-secondary)', 
              color: 'var(--negative)', 
              border: '1px solid var(--negative)' 
            }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div>
                <label className="block font-bold mb-1 text-xs" style={{ color: 'var(--text-secondary)' }}>Full Name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your name"
                  className="w-full px-3.5 py-2.5 rounded-xl border transition-all text-xs"
                  style={{ 
                    backgroundColor: 'var(--elevated-2)', 
                    borderColor: 'var(--border-default)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>
            )}

            <div>
              <label className="block font-bold mb-1 text-xs" style={{ color: 'var(--text-secondary)' }}>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-3.5 py-2.5 rounded-xl border transition-all text-xs"
                style={{ 
                  backgroundColor: 'var(--elevated-2)', 
                  borderColor: 'var(--border-default)',
                  color: 'var(--text-primary)',
                }}
                required
              />
            </div>

            <div>
              <label className="block font-bold mb-1 text-xs" style={{ color: 'var(--text-secondary)' }}>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 rounded-xl border transition-all text-xs"
                style={{ 
                  backgroundColor: 'var(--elevated-2)', 
                  borderColor: 'var(--border-default)',
                  color: 'var(--text-primary)',
                }}
                required
                minLength={6}
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || loading}
              className="w-full px-5 py-2.5 rounded-xl text-xs font-bold shadow-lg transition-all flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ 
                backgroundColor: 'var(--accent-brand)', 
                color: '#fff',
              }}
            >
              {isSubmitting ? (
                <>
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span>Please wait...</span>
                </>
              ) : isLogin ? (
                'Sign In'
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          <div className="text-center text-xs" style={{ color: 'var(--text-tertiary)' }}>
            <span>{isLogin ? "Don't have an account?" : 'Already have an account?'}</span>
            <button
              onClick={() => { setIsLogin(!isLogin); setError(''); }}
              className="ml-1.5 font-bold"
              style={{ color: 'var(--accent-brand)' }}
            >
              {isLogin ? 'Sign Up' : 'Sign In'}
            </button>
          </div>

          <div className="pt-4 border-t text-center text-[11px]" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-quaternary)' }}>
            <p>By continuing, you agree to our Terms of Service and Privacy Policy.</p>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}