# Lightpanda Status

## Installation
Lightpanda v0.4.1 is installed and running on port 9222.

### Location
- **Binary**: `/home/neel/.local/bin/lightpanda` (WSL Ubuntu, 172MB ELF executable)
- **Extracted from**: PyPI package `lightpanda-0.4.1-py3-none-manylinux_2_35_x86_64.whl`
- **CDP endpoint**: `ws://localhost:9222` (verified working, returns Lightpanda/1.0)
- **Install path**: WSL Ubuntu distro (docker-desktop is default, Ubuntu used for install)

### How to Start
```bash
wsl -d Ubuntu -- bash -c "nohup ~/.local/bin/lightpanda serve --port 9222 > /tmp/lightpanda.log 2>&1 &"
```

### Verification
```bash
curl -s http://localhost:9222/json/version
# Returns: {"Browser": "Lightpanda/1.0", "Lightpanda-Version": "0.4.1", ...}
```

### browser_exec Issue
browser_exec still times out because it connects to Browserbase (cloud backend), not local CDP.
Lightpanda IS working — confirmed via puppeteer-core connecting to `ws://localhost:9222`.
The visual test passed: page rendered, no blank, no overflow, 0 broken images.

### Known Issues
- WSL Ubuntu install requires `wsl -d Ubuntu` prefix to access
- Binary is 172MB (full browser engine)
- Yahoo Finance API calls fail in browser console (CORS) — expected, not a Lightpanda issue
- `browser_exec` tool does not support local CDP endpoints (needs hermes config change)

## Vision Audit (2026-09-19)
- **Ling 3.0 Flash VL** via local Omni route analyzed all screenshots
- Desktop/mobile visuals verified: no blank pages, no overflow, no overlap, no broken images
- Auth modal renders correctly (username/password/error states)
- `/auth` route shows 404 because it's dead code — auth is a modal, not a page; AppShell has unused `/auth` check
