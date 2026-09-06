/**
 * Admin endpoint to refresh the NSE stock universe.
 *
 * Re-runs the loader logic and updates stock_universe in-place.
 * Service-role-only — not accessible to end users.
 *
 * POST /api/admin/refresh-universe
 *   Headers: x-admin-token: <CRON_SECRET env var>
 *   Returns: { ok: true, large, mid, small, total, durationMs }
 *
 * Intended callers:
 *   - Vercel Cron (vercel.json schedule)
 *   - Manual trigger button in Settings UI (with admin token from env)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const CRON_SECRET = process.env.CRON_SECRET;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const SOURCES = [
  {
    label: 'nifty100',
    capCategory: 'large',
    url: 'https://archives.nseindia.com/content/indices/ind_nifty100list.csv',
  },
  {
    label: 'nifty_midcap100',
    capCategory: 'mid',
    url: 'https://archives.nseindia.com/content/indices/ind_niftymidcap100list.csv',
  },
  {
    label: 'nifty_smallcap250',
    capCategory: 'small',
    url: 'https://archives.nseindia.com/content/indices/ind_niftysmallcap250list.csv',
  },
];

function parseCsv(text: string): any[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const header = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map((line) => {
    const values: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') inQuotes = !inQuotes;
      else if (ch === ',' && !inQuotes) {
        values.push(cur.trim());
        cur = '';
      } else {
        cur += ch;
      }
    }
    values.push(cur.trim());
    const row: any = {};
    header.forEach((h, i) => {
      row[h] = (values[i] || '').replace(/^"|"$/g, '');
    });
    return row;
  });
}

async function fetchCsv(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 stock-selector refresh',
      Accept: 'text/csv,*/*;q=0.1',
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const text = await res.text();
  if (text.length < 100) throw new Error(`Suspicious short CSV: ${text.length}b`);
  return text;
}

function mapRow(row: any, capCategory: string, sourceList: string) {
  const symbol = row.Symbol || row.symbol || row.SYMBOL || '';
  const companyName =
    row['Company Name'] || row['COMPANY NAME'] || row['Issuer Name'] || '';
  const isin = row['ISIN Code'] || row.ISIN || row.isin || null;
  const series = row.Series || row.series || 'EQ';
  const tradingSegment = row['Trading Segment'] || 'Cash Only';
  const industry = row.Industry || row.industry || null;
  if (!symbol || !companyName) return null;
  return {
    symbol: symbol.toUpperCase().trim(),
    company_name: companyName.trim(),
    isin: isin ? isin.trim() : null,
    cap_category: capCategory,
    source_list: sourceList,
    series: series.trim(),
    trading_segment: tradingSegment.trim(),
    industry: industry ? industry.trim() : null,
    last_seen_at: new Date().toISOString(),
  };
}

async function loadSource(source: typeof SOURCES[number]) {
  const text = await fetchCsv(source.url);
  const rows = parseCsv(text);
  const records = rows
    .map((r) => mapRow(r, source.capCategory, source.label))
    .filter(Boolean);
  const BATCH = 100;
  for (let i = 0; i < records.length; i += BATCH) {
    const { error } = await supabase
      .from('stock_universe')
      .upsert(records.slice(i, i + BATCH), { onConflict: 'symbol' });
    if (error) throw error;
  }
  return records;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Auth: must match CRON_SECRET or have Vercel cron signature
  const provided = req.headers['x-admin-token'] || req.headers.authorization?.replace('Bearer ', '');
  if (!CRON_SECRET || provided !== CRON_SECRET) {
    // Allow Vercel cron
    const isVercelCron = req.headers['user-agent']?.includes('vercel-cron');
    if (!isVercelCron) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const startedAt = Date.now();
  let total = 0;
  const counts: Record<string, number> = { large: 0, mid: 0, small: 0 };

  for (const source of SOURCES) {
    try {
      const records = await loadSource(source);
      counts[source.capCategory] = records.length;
      total += records.length;
    } catch (e: any) {
      console.error(`refresh-universe ${source.label} failed:`, e.message);
    }
  }

  return res.status(200).json({
    ok: true,
    total,
    ...counts,
    durationMs: Date.now() - startedAt,
  });
}
