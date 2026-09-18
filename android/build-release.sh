#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
if [[ ! -f secrets/upload.keystore || ! -f secrets/upload-password.txt ]]; then
  echo 'android/secrets/에 업로드 키와 비밀번호 파일이 필요합니다.' >&2
  exit 1
fi
./gradlew bundleRelease
export ZZAL_UPLOAD_PASS
ZZAL_UPLOAD_PASS="$(cat secrets/upload-password.txt)"
mkdir -p ../dist
version="$(node -p "require('./twa-manifest.json').appVersion")"
jarsigner -keystore secrets/upload.keystore \
  -storepass:env ZZAL_UPLOAD_PASS -keypass:env ZZAL_UPLOAD_PASS \
  -signedjar "../dist/zzal-android-${version}.aab" \
  app/build/outputs/bundle/release/app-release.aab zzal-upload
jarsigner -verify "../dist/zzal-android-${version}.aab"
