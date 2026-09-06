import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from './AuthProvider';
import { useToast } from './useToast';

export interface DeleteAccountModalProps {
  isOpen: boolean;
  email: string;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
  isDeleting: boolean;
}

export function DeleteAccountModal({
  isOpen,
  email,
  onConfirm,
  onCancel,
  isDeleting,
}: DeleteAccountModalProps) {
  const [confirmEmail, setConfirmEmail] = useState('');
  const toast = useToast();
  const { signOut } = useAuth();

  if (!isOpen) return null;

  const isEmailMatch = confirmEmail.trim().toLowerCase() === email.trim().toLowerCase();

  const handleConfirm = async () => {
    if (!isEmailMatch) {
      toast.error('Email does not match');
      return;
    }
    try {
      await onConfirm();
      // Sign out after successful deletion
      await signOut();
    } catch (err: any) {
      toast.error(`Failed to delete account: ${err?.message || 'network error'}`);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2 }}
        className="relative z-10 w-full max-w-md mx-4 p-6 rounded-2xl bg-[color:var(--elevated-1)] border border-[color:var(--border-default)] shadow-2xl"
      >
        {/* Warning Icon */}
        <div className="flex justify-center mb-4">
          <div className="w-14 h-14 rounded-full bg-[color:var(--negative)]/10 flex items-center justify-center">
            <svg
              className="w-7 h-7 text-[color:var(--negative)]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
        </div>

        {/* Heading */}
        <h2 className="text-lg font-bold text-[color:var(--text-primary)] text-center mb-2">
          Delete Account?
        </h2>

        {/* Message */}
        <p className="text-sm text-[color:var(--text-secondary)] text-center mb-6">
          This will permanently delete your account and all paper trading data. This action cannot be undone.
        </p>

        {/* Email confirmation */}
        <div className="mb-6">
          <label className="text-xs font-bold text-[color:var(--text-primary)] block mb-1.5">
            Type your email to confirm
          </label>
          <input
            type="email"
            value={confirmEmail}
            onChange={e => setConfirmEmail(e.target.value)}
            placeholder={email}
            className="w-full px-3 py-2 rounded-lg border border-[color:var(--border-default)] bg-[color:var(--ground-secondary)] text-sm text-[color:var(--text-primary)] placeholder:text-[color:var(--text-tertiary)] focus:outline-none focus:border-[color:var(--negative)]"
            autoComplete="off"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={isDeleting}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-[color:var(--text-primary)] bg-[color:var(--ground-secondary)] border border-[color:var(--border-default)] hover:bg-[color:var(--card-bg-hover)] disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!isEmailMatch || isDeleting}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-[color:var(--negative)] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {isDeleting ? 'Deleting...' : 'Delete Account'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
