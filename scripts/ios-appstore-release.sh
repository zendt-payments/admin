#!/usr/bin/env bash
# Build Zendt iOS App Store archive + export IPA for handoff / Transporter upload.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
IOS_DIR="$ROOT/ios"
APP_DIR="$IOS_DIR/App"
WORKSPACE="$APP_DIR/App.xcworkspace"
SCHEME="App"
ARCHIVE_PATH="$APP_DIR/build/Zendt.xcarchive"
EXPORT_DIR="$APP_DIR/output"
EXPORT_OPTIONS="$IOS_DIR/ExportOptions.plist"
IPA_PATH="$EXPORT_DIR/Zendt.ipa"

resolve_team_id() {
  if [[ -n "${IOS_DEVELOPMENT_TEAM:-}" ]]; then
    echo "$IOS_DEVELOPMENT_TEAM"
    return
  fi
  local cfg="$IOS_DIR/Release.local.xcconfig"
  if [[ -f "$cfg" ]]; then
    local team
    team="$(grep -E '^DEVELOPMENT_TEAM\s*=' "$cfg" | head -1 | sed 's/.*=\s*//' | tr -d ' ;')"
    if [[ -n "$team" && "$team" != "YOUR_TEAM_ID_HERE" ]]; then
      echo "$team"
      return
    fi
  fi
  return 1
}

TEAM_ID="$(resolve_team_id)" || {
  cat <<'EOF'
Missing Apple Development Team ID.

Do ONE of the following, then re-run:

  1) Create ios/Release.local.xcconfig from Release.local.xcconfig.example
     and set DEVELOPMENT_TEAM = your 10-character Team ID

  2) Export for this shell:
     export IOS_DEVELOPMENT_TEAM=XXXXXXXXXX

  3) Open Xcode once (npm run cap:open:ios) → App target → Signing & Capabilities
     → enable Automatically manage signing → pick your Team, then retry.

Also ensure Xcode is signed in: Xcode → Settings → Accounts → your Apple ID
with App Store Connect / Developer Program access.
EOF
  exit 1
}

if ! xcodebuild -version >/dev/null 2>&1; then
  echo "Xcode command line tools not found. Install Xcode from the Mac App Store."
  exit 1
fi

if [[ "${SKIP_IOS_SYNC:-}" != "1" ]]; then
  echo "==> Syncing web assets to iOS (npm run cap:sync:ios)..."
  (cd "$ROOT" && npm run cap:sync:ios)
else
  echo "==> Skipping cap sync (SKIP_IOS_SYNC=1)."
fi

mkdir -p "$APP_DIR/build" "$EXPORT_DIR"
rm -rf "$ARCHIVE_PATH" "$EXPORT_DIR"/*

echo "==> Archiving (Team: $TEAM_ID)..."
xcodebuild \
  -workspace "$WORKSPACE" \
  -scheme "$SCHEME" \
  -configuration Release \
  -destination "generic/platform=iOS" \
  -archivePath "$ARCHIVE_PATH" \
  archive \
  CODE_SIGN_STYLE=Automatic \
  DEVELOPMENT_TEAM="$TEAM_ID" \
  -allowProvisioningUpdates

echo "==> Exporting App Store IPA..."
xcodebuild \
  -exportArchive \
  -archivePath "$ARCHIVE_PATH" \
  -exportPath "$EXPORT_DIR" \
  -exportOptionsPlist "$EXPORT_OPTIONS" \
  -allowProvisioningUpdates

# Xcode names the IPA after the product; normalize for handoff.
EXPORTED_IPA="$(find "$EXPORT_DIR" -maxdepth 1 -name '*.ipa' | head -1)"
if [[ -z "$EXPORTED_IPA" ]]; then
  echo "Export finished but no .ipa found in $EXPORT_DIR"
  exit 1
fi
if [[ "$EXPORTED_IPA" != "$IPA_PATH" ]]; then
  mv "$EXPORTED_IPA" "$IPA_PATH"
fi

IPA_SIZE="$(du -h "$IPA_PATH" | awk '{print $1}')"
HANDOFF="$IOS_DIR/RELEASE-HANDOFF.local.txt"
PBX="$APP_DIR/App.xcodeproj/project.pbxproj"
MARKETING_VERSION="$(grep -m1 'MARKETING_VERSION = ' "$PBX" | sed 's/.*= //;s/;//;s/^[[:space:]]*//')"
CURRENT_PROJECT_VERSION="$(grep -m1 'CURRENT_PROJECT_VERSION = ' "$PBX" | sed 's/.*= //;s/;//;s/^[[:space:]]*//')"

cat >"$HANDOFF" <<EOF
Zendt iOS — App Store handoff (generated $(date +%Y-%m-%d))
KEEP SECRET — do not commit to git

App name:     Zendt
Bundle ID:    com.zendt.app
Version:      $MARKETING_VERSION (build $CURRENT_PROJECT_VERSION)
Team ID used: $TEAM_ID

Deliver to company / upload to App Store Connect
  IPA:      ios/App/output/Zendt.ipa ($IPA_SIZE)
  Archive:  ios/App/build/Zendt.xcarchive (optional backup)

Upload options (company)
  A) Apple Transporter app — drag Zendt.ipa
  B) Xcode → Organizer → Distribute App → App Store Connect
  C) xcrun altool / notarytool (CI)

Apple Developer (one-time, before first upload)
  - App ID com.zendt.app with Sign in with Apple enabled
  - App Store Connect app record for bundle com.zendt.app

Rebuild after code changes
  npm run ios:release

Note: Unlike Android AAB, iOS signing uses Apple Developer certificates
(stored in Xcode / Keychain), not a .jks file. Future builds need the same
Apple Team + bundle ID access.
EOF

echo ""
echo "==> Done."
echo "    IPA:      $IPA_PATH ($IPA_SIZE)"
echo "    Handoff:  $HANDOFF"
echo "    Archive:  $ARCHIVE_PATH"
