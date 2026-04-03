# 아키텍처 기록

## v0.1 초기 설계 (MVP)

- 프론트엔드: React + Vite (SPA)
- 백엔드: Vercel Node Serverless (`api/convert.js`)
- 파싱: kordoc (npm)
- AI: Claude API (`ANTHROPIC_MODEL`, 기본 `claude-sonnet-4-20250514`)
- 배포: Vercel (GitHub 연동 자동 배포 가정)

## 아키텍처 다이어그램

명세서의 브라우저 → React → `POST /api/convert` → kordoc 파싱 → Claude 2회 호출 → `{ markdown, analysis }` JSON 응답 흐름과 동일합니다. 백엔드 구현 언어만 명세 초안의 Python에서 Node로 조정되었습니다.

## 변경 이력

| 날짜 | 변경 내용 | 이유 |
|------|---------|------|
| 초기 | 단일 엔드포인트 설계 | MVP 단순화 |
| 2026-04-03 | Python → Node 서버리스 | PyPI에 kordoc 없음, 공식 라이브러리는 npm |
