#!/bin/bash
# Get authentication token for a user

if [ $# -ne 2 ]; then
    echo "Usage: $0 <username> <password>"
    echo "Example: $0 demo DemoPass123!"
    exit 1
fi

USERNAME=$1
PASSWORD=$2

TOKEN=$(curl -s -X POST http://localhost/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email_or_username\": \"$USERNAME\", \"password\": \"$PASSWORD\"}" | jq -r '.access_token')

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
    echo "Error: Failed to get token. Check credentials." >&2
    exit 1
fi

echo "$TOKEN"