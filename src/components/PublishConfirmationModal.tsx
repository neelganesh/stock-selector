import { motion, AnimatePresence } from 'framer-motion';
import { motionVariants } from '../lib/motion';

interface PublishConfirmationModalProps {
  isOpen: boolean;
  strategyName: string;
  stockCount: number;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
  isPublishing: boolean;
}

export function PublishConfirmationModal({
  isOpen, strategyName, stockCount, onConfirm, onCancel, isPublishing,
}: PublishConfirmationModalProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        {...motionVariants.overlay}
        className="fixed inset-0 z-50 flex items-center justify-center"
      >
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
        <motion.div
          {...motionVariants.modalContent}
          className="relative z-10 w-full max-w-md mx-4 p-6 rounded-2xl bg-[color:var(--elevated-1)] border border-[color:var(--border-default)] shadow-2xl"
        >
          <h2 className="text-lg font-bold text-[color:var(--text-primary)] mb-2">Publish to Kite</h2>
          <p className="text-sm text-[color:var(--text-secondary)] mb-4">
            Strategy <strong>{strategyName}</strong> selects <strong>{stockCount}</strong> stocks.
          </p>
          <div className="flex gap-3">
            <button onClick={onCancel} disabled={isPublishing} className="flex-1 px-4 py-2 rounded-xl text-sm font-bold text-[color:var(--text-primary)] bg-[color:var(--ground-secondary)] border border-[color:var(--border-default)] hover:bg-[color:var(--card-bg-hover)] disabled:opacity-50">Cancel</button>
            <button onClick={onConfirm} disabled={isPublishing} className="flex-1 px-4 py-2 rounded-xl text-sm font-bold text-white bg-[color:var(--accent)] hover:opacity-90 disabled:opacity-50">{isPublishing ? 'Publishing…' : 'Confirm Publish'}</button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
