#!/bin/bash
# create-test-user.sh — Create a test user via Supabase Admin API
# Usage: ./create-test-user.sh <username> <password> [email] [full_name]
#
# This bypasses all auth API rate limits by using the service_role key.
# Set CRON_SECRET in your environment first.

if [ -z "$1" ]; then
    echo "Usage: $0 <username> <password> [email] [full_name]"
    echo "Example: $0 kailuneel1995 MyPassword123"
    exit 1
fi

USERNAME="$1"
PASSWORD="$2"
EMAIL="${3:-${USERNAME}@stock-selector.local}"
FULL_NAME="${4:-$1}"

# Get Supabase URL and key from .env.local
source .env.local 2>/dev/null

if [ -z "$VITE_SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo "Error: Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local"
    exit 1
fi

echo "Creating user: $USERNAME"
curl -s -X POST "${VITE_SUPABASE_URL}/rest/v1/admin/users"     -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}"     -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}"     -H "Content-Type: application/json"     -d "{
        "email": "${EMAIL}",
        "password": "${PASSWORD}",
        "email_confirm": true,
        "user_metadata": {
            "username": "${USERNAME}",
            "full_name": "${FULL_NAME}"
        }
    }" | python3 -m json.tool

echo ""
echo "User created! Now login with username: ${USERNAME} and your password."
