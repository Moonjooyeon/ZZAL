# 이짤이이짤 모바일 앱

Android와 iOS 모두 `https://zzal.ashwoodfriends.com`의 기존 계정과 데이터를 사용합니다. 패키지/번들 식별자는 `com.ashwoodfriends.zzal`입니다.

## Android / Google Play

- Play Console에 올릴 파일: `dist/zzal-android-1.0.0.aab`. 서명 검증을 마쳤습니다.
- 버전을 올릴 때 `android/twa-manifest.json`의 `appVersion`과 `appVersionCode`, `android/app/build.gradle`의 `versionName`과 `versionCode`를 함께 올리고 `android/build-release.sh`를 실행합니다.
- `android/secrets/upload.keystore`와 `android/secrets/upload-password.txt`는 업로드 키입니다. **두 파일을 함께 안전하게 백업하세요.** Git에는 포함되지 않습니다. Play App Signing은 켜고 업로드합니다.
- Android 앱과 사이트의 소유권 확인 파일은 `.well-known/assetlinks.json`입니다. 현재 로컬 설치에 사용하는 업로드 키 지문이 들어 있습니다. Play Console에서 첫 AAB 업로드 후 **앱 서명 키 인증서의 SHA-256 지문**을 확인하고 이 파일의 `sha256_cert_fingerprints` 배열에 추가한 다음 웹 컨테이너를 갱신해야 Play에서 설치한 앱이 주소창 없이 열립니다.
- 웹 컨테이너 배포: `docker compose up -d --build --wait backend web`. `https://zzal.ashwoodfriends.com/manifest.webmanifest`와 `https://zzal.ashwoodfriends.com/.well-known/assetlinks.json`이 열리는지 확인합니다.

## iOS / App Store Connect

- Xcode 프로젝트: `ios/ZZAL.xcodeproj`. 앱의 Google·Apple 로그인은 시스템 인증 화면으로 열리고, 일회용 로그인 티켓을 통해 기존 웹 세션에 연결됩니다.
- `dist/ZZAL.xcarchive`는 기기용 **미서명** 아카이브입니다. 현재 Mac에 유효한 Apple 배포 서명 인증서가 없어 App Store 업로드용 `.ipa`는 아직 만들 수 없습니다.
- Xcode에서 프로젝트를 열고 팀 `LRLSLC2RMQ`의 자동 서명을 설정한 뒤 실제 기기에서 두 로그인, 저장함, 이미지 업로드를 시험합니다. 이후 Product → Archive, Organizer → Distribute App → App Store Connect로 제출합니다.
- iOS 앱이 작동하려면 모바일 로그인 API가 포함된 최신 백엔드가 서버에 배포되어야 합니다.
