#!/usr/bin/env node
/**
 * NSE Stock Universe Loader
 *
 * Fetches the official NSE index constituent lists (Nifty 100, Midcap 100,
 * Smallcap 250) and upserts them into the `stock_universe` Supabase table.
 *
 * Source: https://archives.nseindia.com/content/indices/ (NSE public archives)
 *
 *   - Nifty 100:         ind_nifty100list.csv
 *   - Nifty Midcap 100:  ind_niftymidcap100list.csv
 *   - Nifty Smallcap 250: ind_niftysmallcap250list.csv
 *
 * Run:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/load-nse-universe.mjs
 *
 * Idempotent: re-running updates existing rows in place, never deletes
 * (history is preserved for Kite listing-change detection).
 *
 * Output: prints per-source counts + total.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
// Prefer the new Secret key; fall back to the legacy service_role name so
// existing CI/secret stores keep working until they're rotated.
const SUPABASE_KEY =
  process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SECRET_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

console.log(`[config] URL=${SUPABASE_URL}`);
console.log(`[config] KEY length=${SUPABASE_KEY.length}, starts with=${SUPABASE_KEY.slice(0, 8)}...`);

// Sanity ping: confirm key + URL work before we start parsing CSVs.
const { error: pingErr } = await supabase
  .from('stock_universe')
  .select('symbol', { count: 'exact', head: true });
if (pingErr) {
  console.error('[ping] FAILED:', pingErr.message, pingErr);
  process.exit(1);
}
console.log(`[ping] OK, table reachable`);

// NSE public CSV endpoints. We use the public `archives.nseindia.com` host
// (the same CSV that NSE links to from its index pages).
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

/**
 * Minimal CSV parser. NSE's CSVs are simple comma-separated, with quoted
 * values that may contain commas. No newlines in fields, no escaping.
 */
function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const header = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map((line) => {
    const values = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        values.push(cur.trim());
        cur = '';
      } else {
        cur += ch;
      }
    }
    values.push(cur.trim());
    const row = {};
    header.forEach((h, i) => {
      row[h] = (values[i] || '').replace(/^"|"$/g, '');
    });
    return row;
  });
}

/**
 * Fetch a CSV with NSE-friendly headers + 3x retry on transient failures.
 * NSE archives occasionally 503; we backoff and retry.
 */
async function fetchCsv(url) {
  const headers = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    Accept: 'text/csv,*/*;q=0.1',
    'Accept-Language': 'en-US,en;q=0.9',
    Referer: 'https://www.nseindia.com/',
  };

  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      const text = await res.text();
      if (text.length < 100) {
        throw new Error(`Suspiciously short CSV (${text.length}b) for ${url}`);
      }
      return text;
    } catch (e) {
      lastErr = e;
      console.warn(`  Attempt ${attempt}/3 failed: ${e.message}`);
      if (attempt < 3) await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
  throw lastErr;
}

/**
 * Map a row from NSE CSV to our schema.
 * NSE's CSVs typically have columns:
 *   Company Name, Industry, Symbol, Series, ISIN Code, Trading Segment,
 *   (and sometimes cap_category, weightage etc.)
 */
function mapRow(row, capCategory, sourceList) {
  // Try common column names; NSE has changed these over time.
  const symbol =
    row.Symbol || row.symbol || row.SYMBOL || row['Symbol '] || '';
  const companyName =
    row['Company Name'] ||
    row['COMPANY NAME'] ||
    row['Issuer Name'] ||
    row.companyName ||
    row.company ||
    '';
  const isin = row['ISIN Code'] || row.ISIN || row.isin || null;
  const series = row.Series || row.series || 'EQ';
  const tradingSegment =
    row['Trading Segment'] || row.tradingSegment || 'Cash Only';
  const industry = row.Industry || row.industry || null;

  if (!symbol || !companyName) {
    return null; // skip malformed row
  }

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

async function loadSource(source) {
  console.log(`\n[${source.label}] fetching ${source.url}`);
  const text = await fetchCsv(source.url);
  const rows = parseCsv(text);
  console.log(`  parsed ${rows.length} rows from CSV`);

  const records = rows
    .map((r) => mapRow(r, source.capCategory, source.label))
    .filter((r) => r !== null);

  console.log(`  mapped ${records.length} valid records`);

  if (records.length === 0) {
    console.warn(`  WARNING: no records mapped for ${source.label}`);
    return [];
  }

  // Upsert in batches of 100 to avoid hitting payload size limits.
  const BATCH = 100;
  let inserted = 0;
  for (let i = 0; i < records.length; i += BATCH) {
    const batch = records.slice(i, i + BATCH);
    const { error } = await supabase
      .from('stock_universe')
      .upsert(batch, { onConflict: 'symbol' });

    if (error) {
      console.error(`  batch ${i / BATCH + 1} failed:`, error.message);
      throw error;
    }
    inserted += batch.length;
  }
  console.log(`  upserted ${inserted} rows`);

  return records;
}

async function main() {
  const startedAt = Date.now();
  console.log('NSE Stock Universe Loader');
  console.log('=========================');

  let allRecords = [];
  for (const source of SOURCES) {
    try {
      const records = await loadSource(source);
      allRecords = allRecords.concat(records);
    } catch (e) {
      console.error(`FAILED to load ${source.label}: ${e.message}`);
      console.error('  cause:', e.cause);
      // Continue to next source so one failure doesn't kill the whole run.
    }
  }

  // Count distinct symbols by cap.
  const byCap = { large: 0, mid: 0, small: 0 };
  for (const r of allRecords) byCap[r.cap_category]++;

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log('\n=========================');
  console.log(`Total upserted: ${allRecords.length} tickers in ${elapsed}s`);
  console.log(`  large (Nifty 100):      ${byCap.large}`);
  console.log(`  mid   (Midcap 100):     ${byCap.mid}`);
  console.log(`  small (Smallcap 250):   ${byCap.small}`);
  console.log('=========================');
}

main().catch((e) => {
  console.error('Loader crashed:', e);
  process.exit(1);
});
