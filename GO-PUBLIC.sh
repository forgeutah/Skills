#!/usr/bin/env bash
# Flip the community skills repo to public and lock main down.
#
# Run this when you and Clint have reviewed the repo on GitHub and are happy
# for it to be public.
set -euo pipefail

REPO=ForgeUtah/Skills

echo "==> 1/3  Making $REPO public"
gh repo edit "$REPO" --visibility public --accept-visibility-change-consequences

echo "==> 2/3  Protecting main (no direct pushes, PR + code owner review)"
gh api -X PUT "repos/$REPO/branches/main/protection" --input - <<'JSON'
{
  "required_status_checks": null,
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "required_approving_review_count": 1,
    "require_code_owner_reviews": true,
    "dismiss_stale_reviews": true
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
JSON

echo "==> 3/3  Verifying"
gh repo view "$REPO" --json visibility,licenseInfo \
  --jq '"visibility: \(.visibility)   licence: \(.licenseInfo.name)"'
gh api "repos/$REPO/branches/main/protection" \
  --jq '"code owner review required: \(.required_pull_request_reviews.require_code_owner_reviews)   force pushes: \(.allow_force_pushes.enabled)"'

echo
echo "Done. main now requires a PR approved by @Soypete or @clintberry."
