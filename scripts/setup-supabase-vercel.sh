#!/usr/bin/env bash
#
# setup-supabase-vercel.sh
#
# Walks you through provisioning a new Supabase project and wiring it up to
# the GitHub repo (neelganesh/stock-selector-deploy) and Vercel. Captures the
# credentials and writes them to .env.local at the project root.
#
# Run from the project root:
#   bash scripts/setup-supabase-vercel.sh
#
# Idempotent: re-running keeps existing .env values. Ctrl-C any time.

set -euo pipefail

# ──────────────────────────────────────────────────────────────────────────
# Wizard library: delightful, consistent UX, identical across every wizard.
# ──────────────────────────────────────────────────────────────────────────

if [[ -t 1 ]] && command -v tput >/dev/null 2>&1 && [[ "$(tput colors 2>/dev/null || echo 0)" -ge 8 ]]; then
  BOLD=$(tput bold); DIM=$(tput dim); RESET=$(tput sgr0)
  BLUE=$(tput setaf 4); GREEN=$(tput setaf 2); YELLOW=$(tput setaf 3); RED=$(tput setaf 1)
else
  BOLD=""; DIM=""; RESET=""; BLUE=""; GREEN=""; YELLOW=""; RED=""
fi

# Author sets this at the top of the stages section.
TOTAL_STAGES=0

_STAGE_INDEX=0
ENV_FILE="${ENV_FILE:-.env.local}"
WRITTEN_ENV=()    # KEYs written to ENV_FILE this run
WRITTEN_SECRET=() # secret NAMEs set this run
SKIPPED=()        # things we couldn't do (e.g. gh missing)

# _clear wipes the terminal so only the current step is on screen. No-op when
# output isn't a terminal, so piped logs stay readable.
_clear() {
  [[ -t 1 ]] || return 0
  if command -v tput >/dev/null 2>&1; then tput clear; else printf '\033[2J\033[H'; fi
}

# banner "Title" shows the opening frame: what this wizard does.
banner() {
  _clear
  printf '\n%s%s  %s%s\n' "$BOLD" "$BLUE" "$1" "$RESET"
  printf '%s  %s stages%s\n\n' "$DIM" "$TOTAL_STAGES" "$RESET"
  printf '%s  You drive the browser; this wizard tells you exactly what to do and\n' "$DIM"
  printf '  captures the values you copy back. Stop any time with Ctrl-C and re-run\n'
  printf '  later, since it remembers values already saved.%s\n' "$RESET"
  pause "Ready to start?"
}

# stage "Name" clears the screen, then announces a stage and shows progress.
# Clearing keeps only the current step on screen.
stage() {
  _clear
  _STAGE_INDEX=$((_STAGE_INDEX + 1))
  printf '\n%s%s▸ Stage %s/%s · %s%s\n' \
    "$BOLD" "$BLUE" "$_STAGE_INDEX" "$TOTAL_STAGES" "$1" "$RESET"
}

# say "..." prints a plain instruction line.
say()  { printf '  %s\n' "$1"; }
# step "..." is a numbered-feeling action the human takes in the browser.
step() { printf '  %s•%s %s\n' "$BLUE" "$RESET" "$1"; }
note() { printf '  %s%s%s\n' "$DIM" "$1" "$RESET"; }
warn() { printf '  %s⚠ %s%s\n' "$YELLOW" "$1" "$RESET"; }

# open_url URL opens it in the human's browser, cross-platform incl. WSL.
open_url() {
  local url="$1"
  printf '  %s↗ opening%s %s\n' "$GREEN" "$RESET" "$url"
  { if   command -v wslview     >/dev/null 2>&1; then wslview "$url"
    elif command -v explorer.exe >/dev/null 2>&1; then explorer.exe "$url"
    elif command -v xdg-open    >/dev/null 2>&1; then xdg-open "$url"
    elif command -v open        >/dev/null 2>&1; then open "$url"
    else warn "couldn't open a browser; visit it manually: $url"; fi
  } >/dev/null 2>&1 || warn "couldn't open a browser, so visit it manually: $url"
}

# pause "msg" waits for the human to confirm they've done the manual part.
pause() {
  printf '  %s%s%s ' "$DIM" "${1:-Press Enter to continue}" "$RESET"
  read -r _ || true
}

# confirm "question" is a y/N gate; returns success on yes.
confirm() {
  local reply=""
  printf '  %s? %s [y/N] ' "$YELLOW" "$1"
  read -r reply || true
  [[ "$reply" =~ ^[Yy] ]]
}

# _existing KEY: current value of KEY in ENV_FILE, if any.
_existing() {
  [[ -f "$ENV_FILE" ]] || return 1
  local line; line=$(grep -E "^${1}=" "$ENV_FILE" | tail -n1) || return 1
  printf '%s' "${line#*=}"
}

# ask KEY "Prompt" reads a value into $KEY. Offers the existing .env value as
# a default on re-runs (Enter keeps it). Visible input (non-secret).
ask() {
  local key="$1" prompt="$2" current input
  current=$(_existing "$key" || true)
  if [[ -n "$current" ]]; then
    printf '  %s%s%s %s[Enter keeps current]%s ' "$BOLD" "$prompt" "$RESET" "$DIM" "$RESET"
  else
    printf '  %s%s%s ' "$BOLD" "$prompt" "$RESET"
  fi
  read -r input || true
  [[ -z "$input" && -n "$current" ]] && input="$current"
  printf -v "$key" '%s' "$input"
}

# ask_secret KEY "Prompt" is like ask, but input is hidden.
ask_secret() {
  local key="$1" prompt="$2" current input
  current=$(_existing "$key" || true)
  if [[ -n "$current" ]]; then
    printf '  %s%s%s %s[Enter keeps current]%s ' "$BOLD" "$prompt" "$RESET" "$DIM" "$RESET"
  else
    printf '  %s%s%s ' "$BOLD" "$prompt" "$RESET"
  fi
  read -rs input || true
  printf '\n'
  [[ -z "$input" && -n "$current" ]] && input="$current"
  printf -v "$key" '%s' "$input"
}

# write_env KEY VALUE upserts KEY=VALUE into ENV_FILE (creates it; replaces
# any existing line). Idempotent.
write_env() {
  local key="$1" value="$2" tmp
  touch "$ENV_FILE"
  tmp=$(mktemp)
  grep -vE "^${key}=" "$ENV_FILE" > "$tmp" || true
  printf '%s=%s\n' "$key" "$value" >> "$tmp"
  mv "$tmp" "$ENV_FILE"
  WRITTEN_ENV+=("$key")
  printf '  %s✓ wrote%s %s → %s\n' "$GREEN" "$RESET" "$key" "$ENV_FILE"
}

# set_secret NAME VALUE sets a GitHub Actions repo secret via gh. Falls back
# to a warning (and records it) if gh is unavailable or unauthenticated.
set_secret() {
  local name="$1" value="$2"
  if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
    if printf '%s' "$value" | gh secret set "$name" >/dev/null 2>&1; then
      WRITTEN_SECRET+=("$name")
      printf '  %s✓ set%s GitHub secret %s\n' "$GREEN" "$RESET" "$name"
      return
    fi
  fi
  SKIPPED+=("GitHub secret $name (set it manually: gh secret set $name)")
  warn "skipped GitHub secret $name: gh not ready; set it later"
}

# set_var NAME VALUE sets a GitHub Actions repo variable (non-secret).
set_var() {
  local name="$1" value="$2"
  if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
    if gh variable set "$name" --body "$value" >/dev/null 2>&1; then
      printf '  %s✓ set%s GitHub variable %s\n' "$GREEN" "$RESET" "$name"
      return
    fi
  fi
  SKIPPED+=("GitHub variable $name")
  warn "skipped GitHub variable $name, gh not ready; set it later"
}

# finish clears, then shows a closing summary of everything configured.
finish() {
  _clear
  printf '\n%s%s  ✓ Setup complete%s\n' "$BOLD" "$GREEN" "$RESET"
  (( ${#WRITTEN_ENV[@]} ))    && note "wrote ${#WRITTEN_ENV[@]} value(s) to $ENV_FILE: ${WRITTEN_ENV[*]}"
  (( ${#WRITTEN_SECRET[@]} )) && note "set ${#WRITTEN_SECRET[@]} GitHub secret(s): ${WRITTEN_SECRET[*]}"
  if (( ${#SKIPPED[@]} )); then
    printf '\n'; warn "still to do by hand:"
    for s in "${SKIPPED[@]}"; do note "  - $s"; done
  fi
  printf '\n'
}

# ──────────────────────────────────────────────────────────────────────────
# STAGES — author this section. One stage() per step the human takes.
# ──────────────────────────────────────────────────────────────────────────

TOTAL_STAGES=6

PROJECT_ROOT="C:\\Code\\VS_Workspace\\stock-selector"
GITHUB_REPO="neelganesh/stock-selector-deploy"
SUPABASE_REGION="ap-south-1"   # Mumbai — closest to Indian markets + Vercel
PROJECT_NAME="stock-selector-app"

# ── Auto-skip stage 1 if Supabase CLI is already authenticated ────────────
SUPABASE_READY=0
if command -v supabase >/dev/null 2>&1 && supabase projects list --output json >/dev/null 2>&1; then
  SUPABASE_READY=1
fi

# ── Auto-detect Supabase org (CLI requires --org-id for non-interactive) ─
SUPABASE_ORG_ID=""
if [[ "$SUPABASE_READY" -eq 1 ]]; then
  SUPABASE_ORG_ID=$(supabase orgs list --output json 2>/dev/null \
    | grep -oE '"id"[[:space:]]*:[[:space:]]*"[^"]+"' \
    | head -n1 \
    | sed -E 's/.*"id"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/' || true)
fi

banner "Provision Supabase + wire GitHub & Vercel"

# ── Stage 1: Supabase CLI login (auto-skipped if already authenticated) ──
if [[ "$SUPABASE_READY" -eq 0 ]]; then
  stage "Supabase CLI: log in"
  say "The Supabase CLI needs a personal access token to create projects on your account."
  open_url "https://supabase.com/dashboard/account/tokens"
  step "On the Account → Access Tokens page, click 'Generate New Token'."
  step "Name it 'stock-selector-cli' (or anything), select 'All' scope, Generate."
  step "Copy the token (starts with sbp_). You won't see it again."
  ask_secret SUPABASE_ACCESS_TOKEN "Paste the Supabase access token:"
  printf '%s' "$SUPABASE_ACCESS_TOKEN" | supabase login --no-browser --token "$SUPABASE_ACCESS_TOKEN" >/dev/null
  printf '  %s✓ logged in to Supabase CLI%s\n' "$GREEN" "$RESET"
else
  say "Supabase CLI already authenticated — skipping token prompt."
  pause "Press Enter to continue"
fi

# ── Stage 2: Create the Supabase project ──────────────────────────────────
stage "Create new Supabase project"
say "We'll create a fresh project for stock-selector in $SUPABASE_REGION (Mumbai)."
say "Project name: $PROJECT_NAME  (subdomain: $PROJECT_NAME.supabase.co)"
say "If that subdomain is taken, the CLI will tell you and you can re-run with a different name."
note "Pick a strong database password (>= 12 chars, mixed). Save it — you'll reuse it for migrations."
ask_secret DB_PASSWORD "Database password for the new project (12+ chars, mixed case + digits):"
say "Creating project (this takes ~1 minute while Supabase provisions Postgres)..."
CREATE_OUT=$(supabase projects create "$PROJECT_NAME" \
  --region "$SUPABASE_REGION" \
  --db-password "$DB_PASSWORD" \
  --org-id "$SUPABASE_ORG_ID" \
  --output json 2>&1) || CREATE_OUT=""
PROJECT_REF=$(printf '%s' "$CREATE_OUT" | grep -oE '"ref"[[:space:]]*:[[:space:]]*"[^"]+"' | head -n1 | sed -E 's/.*"ref"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/')
if [[ -z "$PROJECT_REF" ]]; then
  warn "couldn't auto-parse the new project ref from CLI output. Open the dashboard:"
  open_url "https://supabase.com/dashboard/projects"
  ask PROJECT_REF "Paste the new project's reference (the subdomain, e.g. abcdefghij):"
else
  printf '  %s✓ created%s https://%s.supabase.co (ref=%s)\n' "$GREEN" "$RESET" "$PROJECT_REF" "$PROJECT_REF"
fi
write_env SUPABASE_PROJECT_REF "$PROJECT_REF"
write_env SUPABASE_DB_PASSWORD "$DB_PASSWORD"

# ── Stage 3: Capture the project API keys into .env.local ────────────────
stage "Capture API keys into .env.local"
open_url "https://supabase.com/dashboard/project/$PROJECT_REF/settings/api"
step "On Project Settings → API, find the 'Project URL' row and copy the URL."
ask VITE_SUPABASE_URL "Paste Project URL (https://<ref>.supabase.co):"
step "In the same page, under 'Project API keys', click 'Reveal' next to the 'anon' / 'public' key, then copy."
ask VITE_SUPABASE_ANON_KEY "Paste the anon (public) key (starts with eyJ...):"
step "Now reveal the 'service_role' key (NEVER expose to the browser) and copy."
ask_secret SUPABASE_SERVICE_ROLE_KEY "Paste the service_role key (starts with eyJ...):"
write_env VITE_SUPABASE_URL "$VITE_SUPABASE_URL"
write_env VITE_SUPABASE_ANON_KEY "$VITE_SUPABASE_ANON_KEY"
write_env SUPABASE_SERVICE_ROLE_KEY "$SUPABASE_SERVICE_ROLE_KEY"

# ── Stage 4: Initialize supabase/ + link to the new project ──────────────
stage "Initialize supabase/ + link to the project"
say "This creates supabase/config.toml (migration config) and links the CLI to your new project."
cd "$PROJECT_ROOT"
if [[ ! -d supabase ]]; then
  supabase init
else
  say "supabase/ already initialized, skipping init."
fi
say "Linking CLI to project $PROJECT_REF ..."
supabase link --project-ref "$PROJECT_REF" --password "$DB_PASSWORD"
printf '  %s✓ linked%s supabase CLI to %s\n' "$GREEN" "$RESET" "$PROJECT_REF"

# ── Stage 5: Store the Kite API secret in Supabase + GitHub ─────────────
stage "Set KITE_API_SECRET in Supabase & GitHub (for the deploy repo)"
say "Kite's API secret is used by the server-side /api routes to sign GTT payloads."
open_url "https://supabase.com/dashboard/project/$PROJECT_REF/settings/functions"
note "Supabase Edge Functions secrets (Dashboard → Project Settings → Edge Functions → Secrets):"
step "Click 'Add new secret'. Name = KITE_API_SECRET. Value = your Kite API secret."
step "Click Save."
ask_secret KITE_API_SECRET "Paste the Kite API secret (also stored in .env.local + as GitHub secret):"
write_env KITE_API_SECRET "$KITE_API_SECRET"
say "Adding it as a GitHub Actions secret on $GITHUB_REPO so any future CI workflows can read it..."
set_secret KITE_API_SECRET "$KITE_API_SECRET"

# ── Stage 6: Vercel — link repo + add env vars via CLI ──────────────────
stage "Vercel: link repo + add env vars"
say "Linking Vercel to the GitHub repo and pushing the same env vars as the Supabase project."
cd "$PROJECT_ROOT"
say "Running 'vercel link' (auto-detects existing project or creates one connected to $GITHUB_REPO)..."
vercel link --yes
printf '  %s✓ linked%s Vercel project\n' "$GREEN" "$RESET"

# Add each env var to all 3 environments (Production, Preview, Development).
add_vercel_env() {
  local key="$1" value="$2"
  for env in production preview development; do
    # --force overwrites if it already exists. Echo value to satisfy vercel env add.
    printf '%s' "$value" | vercel env add "$key" "$env" --force --yes >/dev/null 2>&1 || true
  done
  printf '  %s✓ added%s %s to production/preview/development\n' "$GREEN" "$RESET" "$key"
}

note "Pushing 4 env vars to Vercel (same values now in $ENV_FILE)..."
add_vercel_env VITE_SUPABASE_URL         "$VITE_SUPABASE_URL"
add_vercel_env VITE_SUPABASE_ANON_KEY    "$VITE_SUPABASE_ANON_KEY"
add_vercel_env SUPABASE_SERVICE_ROLE_KEY "$SUPABASE_SERVICE_ROLE_KEY"
add_vercel_env KITE_API_SECRET           "$KITE_API_SECRET"

say "Triggering a fresh production deploy so the new env vars take effect..."
vercel deploy --prod --yes
printf '  %s✓ deployed%s to production\n' "$GREEN" "$RESET"

finish

say "Next: your Vite dev server can be launched with the new credentials."
say "Run from project root: npx vite"
say "If Vite warns 'Supabase credentials not configured', re-check .env.local — restart Vite after edits."
