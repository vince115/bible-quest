#!/usr/bin/env bash
# Uploads the media that game/assets.ts serves from Cloudflare R2 (card art, stage art, pack art, music) to the bucket.
# It copies and never deletes: files already in the bucket that are not on this disk stay where they are.
# The card frames and textures (cards/frame-*, cards/scripture-frame*, ...) stay in the repo, so they are skipped.
#
# One-time setup (your own keys, typed into rclone, never into the repo or a chat):
#   brew install rclone
#   rclone config        # n) new remote, name: r2, type: s3, provider: Cloudflare, your R2 access key id and secret,
#                        # endpoint: https://<account-id>.r2.cloudflarestorage.com
# Run:
#   bash scripts/upload-r2.sh --dry-run    # shows what would be uploaded
#   bash scripts/upload-r2.sh              # uploads it
# Another remote or bucket name: R2_REMOTE=myremote R2_BUCKET=mybucket bash scripts/upload-r2.sh
set -euo pipefail
cd "$(dirname "$0")/.."

REMOTE="${R2_REMOTE:-r2}"
BUCKET="${R2_BUCKET:-bible-quest}"
CACHE="Cache-Control: public, max-age=86400"

copy() { # <folder under public> [extra rclone flags...]
  local dir="$1"
  shift
  echo "== $dir"
  rclone copy "public/$dir" "$REMOTE:$BUCKET/$dir" --header-upload "$CACHE" --progress "$@"
}

copy cards --exclude "frame-*" --exclude "scripture-frame*" --exclude "scripture-gilt-frame*" --exclude "scripture-leather*" "$@"
copy stages "$@"
copy packs "$@"
copy audio "$@"
echo "Done. Next: set NEXT_PUBLIC_ASSET_BASE in .env.local to the bucket's public URL and restart the dev server."
