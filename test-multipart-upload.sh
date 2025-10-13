#!/bin/bash
# Test multipart upload with local image

PATTERN_ID="$1"
API_KEY="$2"
IMAGE_FILE="$3"

if [ -z "$PATTERN_ID" ] || [ -z "$API_KEY" ] || [ -z "$IMAGE_FILE" ]; then
  echo "Usage: ./test-multipart-upload.sh <PATTERN_ID> <API_KEY> <IMAGE_FILE>"
  exit 1
fi

curl -X POST "http://localhost:3000/api/patterns/$PATTERN_ID/ingest" \
  -H "Authorization: Bearer $API_KEY" \
  -F "image=@$IMAGE_FILE" \
  -F "idempotency_key=$(uuidgen)" \
  -v

