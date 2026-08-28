import React, { useState } from 'react';

interface CustomScripModalProps {
  isOpen?: boolean;
  onClose: () => void;
  onLoadScrips?: (scrips: string[]) => void;
  onImportScrips?: (scrips: string[]) => void;
}

export const CustomScripModal: React.FC<CustomScripModalProps> = ({
  isOpen = true,
  onClose,
  onLoadScrips,
  onImportScrips,
}) => {
  const [rawInput, setRawInput] = useState<string>(
    `SUZLON MAZDOCK BSE POLYCAB TRENT DIXON TATAMOTORS RELIANCE INFY HDFCBANK CGPOWER KAYNES ANANTRAJ KFINTECH TEJASNET RCF`
  );

  if (!isOpen) return null;

  const handleParse = () => {
    const list = rawInput
      .split(/[\s,\n\r]+/)
      .map((s) => s.trim().toUpperCase().replace(/[^A-Z0-9]/g, ''))
      .filter((s) => s.length >= 2);

    const parsedScrips = Array.from(new Set(list));
    if (onLoadScrips) onLoadScrips(parsedScrips);
    if (onImportScrips) onImportScrips(parsedScrips);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-900/50">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Custom Scrip Ingestion
              </span>
              <span className="text-xs text-slate-400">Section 1.2 / scrip.txt</span>
            </div>
            <h2 className="text-xl font-bold text-white mt-1">Import Custom Watchlist / Scrips</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <p className="text-xs text-slate-400">
            Paste space-separated, comma-separated, or newline-separated trading symbols from your Zerodha Kite marketwatch, trading journal, or <code className="text-emerald-400">scrip.txt</code> file:
          </p>

          <textarea
            value={rawInput}
            onChange={(e) => setRawInput(e.target.value)}
            rows={6}
            className="w-full p-4 rounded-xl bg-slate-950 border border-slate-800 text-emerald-300 font-mono text-xs focus:outline-none focus:border-emerald-500 leading-relaxed"
            placeholder="e.g. SUZLON MAZDOCK BSE POLYCAB TRENT DIXON"
          />

          <div className="text-[11px] text-slate-500 italic">
            Scrips will be processed against the equal-weighted sector NAV engine and Renko price-only ATH breakout filters.
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleParse}
            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-semibold text-white text-sm transition-colors shadow-lg shadow-emerald-600/30"
          >
            Load & Filter Scrips
          </button>
        </div>
      </div>
    </div>
  );
};
