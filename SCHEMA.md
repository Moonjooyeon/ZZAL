# 데이터베이스 설계

운영 DB의 전체 구조와 관계 그림은 [docs/ERD.md](docs/ERD.md)에 있습니다.
첫 설치의 다섯 테이블은 [schema.sql](server/src/db/schema.sql), 이후 변경은
[migrations](server/src/db/migrations)에 정의합니다. 백엔드가 시작할 때 아직
적용되지 않은 마이그레이션을 트랜잭션으로 한 번씩 적용합니다.

운영 데이터는 Docker의 `postgres_data` 볼륨에 있습니다. `docker compose down -v`는
이 볼륨을 삭제하므로 사용하지 마세요. 변경 전 백업과 적용 방법은
[README.md](README.md#docker로-운영-배포)를 따릅니다.
