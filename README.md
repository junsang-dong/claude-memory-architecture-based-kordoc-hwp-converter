# HWP Analyzer

HWP · HWPX · PDF 파일을 업로드하면 **kordoc**으로 텍스트를 추출하고, **Claude API**가 마크다운 정리와 문서 분석(요약·키워드·유형 등)을 수행하는 웹앱입니다. (MVP v0.1)

## 스택

| 구분 | 기술 |
|------|------|
| 프론트엔드 | React, Vite |
| 백엔드 | Vercel Serverless (`api/convert.js`, Node.js) |
| 문서 파싱 | [kordoc](https://github.com/chrisryugj/kordoc) (npm) |
| AI | [Anthropic Claude](https://docs.anthropic.com) API |

> **참고:** 공식 kordoc은 npm 전용이라 Python PyPI 패키지가 아닙니다. API는 Node 런타임으로 구현했습니다.

## 주요 기능

- 드래그 앤 드롭(또는 클릭)으로 `.hwp` / `.hwpx` / `.pdf` 업로드 (최대 10MB)
- 변환된 **마크다운** 미리보기 (`react-markdown` + `remark-gfm`)
- **분석 패널**: 요약, 키워드, 문서 유형, 톤, 주요 섹션 등
- 로컬 개발용 **API 서버** 스크립트 (`npm run dev:api`)로 `vercel dev` 없이도 전체 플로우 테스트 가능

## 빠른 시작

### 1. 의존성

```bash
npm install
```

### 2. 환경 변수

`.env.example`을 참고해 프로젝트 루트에 `.env`를 만들고 값을 넣습니다.

```env
ANTHROPIC_API_KEY=sk-ant-api03-...
# 선택: ANTHROPIC_MODEL=...
```

`.env`는 Git에 올리지 마세요. (`.gitignore`에 포함됨)

### 3. 로컬 실행 (UI + API)

터미널 두 개에서:

```bash
# API — http://127.0.0.1:3000/api/convert
npm run dev:api

# 프론트 — http://localhost:5151 (Vite가 /api 를 3000으로 프록시)
npm run dev -- --port 5151 --strictPort
```

한 번에 쓰려면 Vercel CLI 로그인 후:

```bash
npx vercel dev --listen 127.0.0.1:5151
```

### 4. 프로덕션 빌드

```bash
npm run build
npm run preview
```

## Vercel 배포

1. 이 저장소를 Vercel 프로젝트로 연결합니다.
2. **Settings → Environment Variables**에 `ANTHROPIC_API_KEY`를 등록합니다.
3. 배포 후 동일한 UI에서 파일 업로드 → `/api/convert`가 서버리스에서 실행됩니다.

## 프로젝트 구조 (요약)

```
api/convert.js       # POST /api/convert — kordoc + Claude
src/components/      # UploadZone, MarkdownViewer, AnalysisPanel, StatusBar
src/hooks/useConvert.js
memory/              # Claude용 프로젝트 맥락 (MEMORY.md 등)
scripts/local-api.mjs
vercel.json
```

자세한 설계·결정 사항은 `memory/` 디렉터리를 참고하세요.

## 라이선스

이 저장소의 앱 코드는 프로젝트 설정에 따릅니다. 문서 파싱은 kordoc([MIT](https://github.com/chrisryugj/kordoc))을 사용합니다.
