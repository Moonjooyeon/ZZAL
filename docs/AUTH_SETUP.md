# ZZAL Apple·Google 로그인 설정

서비스 주소는 `https://zzal.ashwoodfriends.com`입니다. 키 값과 `.p8` 파일은
GitHub에 올리지 말고 Lightsail 서버의 `.env`와 `secrets/`에만 보관합니다.
코드는 키가 없어도 배포할 수 있지만, 해당 로그인 버튼을 누르면 키 설정 오류가 납니다.

## Google

Google Cloud Console에서 OAuth 동의 화면을 설정하고 **웹 애플리케이션**
OAuth 클라이언트를 만듭니다. 승인된 리디렉션 URI에 아래 주소를 정확히 넣습니다.

`https://zzal.ashwoodfriends.com/api/auth/google/callback`

발급된 클라이언트 ID와 보안 비밀번호를 서버 `~/ZZAL/.env`의
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`에 넣습니다. 앱이 테스트 상태면
로그인할 계정을 테스트 사용자로 추가해야 합니다.

## Apple

Apple Developer 계정의 Certificates, Identifiers & Profiles에서 Sign in with Apple이
활성화된 **App ID**를 준비하고, 여기에 연결할 **Services ID**를 만듭니다.
Services ID의 웹사이트 도메인은 `zzal.ashwoodfriends.com`, Return URL은
`https://zzal.ashwoodfriends.com/api/auth/apple/callback`입니다. Sign in with Apple
키를 만들어 `.p8` 파일을 한 번 다운로드하고 Key ID와 Team ID를 기록합니다.

서버의 `~/ZZAL/.env`에는 다음 값을 넣습니다.

```dotenv
APPLE_CLIENT_ID=Services-ID
APPLE_TEAM_ID=10자리-Team-ID
APPLE_KEY_ID=Key-ID
APPLE_PRIVATE_KEY_PATH=/run/secrets/apple-signin.p8
```

서버에서 `mkdir -p ~/ZZAL/secrets`를 실행한 뒤 다운로드한 `.p8` 파일을
`~/ZZAL/secrets/apple-signin.p8`에 놓고
`chmod 600 ~/ZZAL/secrets/apple-signin.p8`을 실행합니다. Docker Compose가 해당
폴더를 백엔드 컨테이너에 읽기 전용으로 연결합니다. `.p8` 원본과 클라이언트
보안 비밀번호를 채팅이나 GitHub에 붙여 넣지 마세요.

Apple은 이름을 첫 로그인 때만 전달할 수 있습니다. ZZAL은 처음 받은 이름을
유지하고, 이후 로그인에서 이메일만 갱신합니다. 기존 카카오 계정은 DB에 남지만
카카오 로그인 버튼과 새 로그인 경로는 제거됩니다.

## 적용 및 확인

`.env`와 키 파일을 준비한 뒤 `cd ~/ZZAL && docker compose up -d --build --wait backend web`을
실행합니다. 로그인은 실제 브라우저에서 Apple·Google 버튼을 각각 눌러 확인해야
합니다. 성공하면 `/api/auth/me`가 `provider`와 사용자 정보를 반환합니다.
`DEMO_AUTH=0`, `COOKIE_SECURE=1`, `PUBLIC_ORIGIN=https://zzal.ashwoodfriends.com`을 유지합니다.
