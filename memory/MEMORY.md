# HWP Analyzer — 프로젝트 메모리

## 마지막 업데이트

2026-04-03 / Vite React 프론트 + Vercel `api/convert.js`(kordoc + Claude) MVP 구현

## 프로젝트 목적

HWP/HWPX/PDF 파일을 마크다운으로 변환하고 Claude로 분석하는 웹앱.

## 현재 상태

- [x] 프로젝트 초기화
- [x] kordoc 연동 완료 (Node 서버리스, npm 패키지)
- [x] Claude API 연동 완료
- [x] 프론트엔드 UI 완성
- [ ] Vercel 배포 완료 (저장소 연결 후 대시보드에서 진행)

## 핵심 기술 결정 (빠른 참조)

| 결정 | 선택 | 이유 |
|------|------|------|
| 백엔드 런타임 | Node (Vercel) | `kordoc`이 PyPI가 아닌 npm 전용 |
| API 구조 | 단일 엔드포인트 `POST /api/convert` | MVP 단순화 |
| Claude 호출 | 변환 + 분석 2회 분리 | 역할 명확화 |

## 현재 알려진 문제

- 로컬에서 `npm run dev`만 쓰면 API가 없을 수 있음 → `npx vercel dev` 또는 Vite 프록시 대상(기본 3000)에서 API 실행 필요

## 다음 할 일

1. `.env.local`에 `ANTHROPIC_API_KEY` 설정
2. `npx vercel dev`로 전체 연동 테스트
3. GitHub에 푸시 후 Vercel 연동·환경 변수 등록

## 상세 내용 위치

- 아키텍처 결정: memory/topics/architecture.md
- API 설계: memory/topics/api_design.md
- 기술 결정 이유: memory/topics/decisions.md
