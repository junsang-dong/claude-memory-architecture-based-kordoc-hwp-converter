# 기술 결정 기록

## 결정 #1: Node Serverless로 구현 (명세 초안은 Python)

- 날짜: 2026-04-03
- 결정: `api/convert.py` 대신 `api/convert.js` 사용
- 이유: [kordoc](https://github.com/chrisryugj/kordoc)은 npm 패키지이며 PyPI에 동명 패키지가 없음
- 트레이드오프: 명세서의 Python 런타임(`vercel-python@3.x`) 대신 Node 런타임 사용

## 결정 #2: Claude 호출 2회 분리

- 날짜: 2026-04-03
- 결정: 마크다운 정리 호출과 분석(JSON) 호출을 분리
- 이유: 프롬프트 역할 분리로 품질 유지
- 트레이드오프: API 비용·지연 증가

## 결정 #3: 로컬 개발 이중 경로

- 날짜: 2026-04-03
- 결정: `npx vercel dev` 권장, 보조로 Vite `server.proxy`로 `/api`를 `127.0.0.1:3000`에 연결
- 이유: 순수 `vite`만으로는 서버리스 함수가 실행되지 않음
