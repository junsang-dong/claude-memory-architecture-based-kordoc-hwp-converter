# API 설계

## `POST /api/convert`

- **요청:** `multipart/form-data`, 필드명 `file`
- **지원 확장자:** `.hwp`, `.hwpx`, `.pdf`
- **크기 제한:** 10MB (클라이언트·서버 모두 검증)

### 성공 응답 (200)

```json
{
  "markdown": "# ...",
  "analysis": {
    "summary": "...",
    "keywords": [],
    "structure": "...",
    "tone": "...",
    "key_sections": [],
    "page_count": 5
  }
}
```

`page_count`는 Claude JSON에 없으면 kordoc 메타데이터에서 보강할 수 있습니다.

### 오류 응답

JSON `{ "error": "사용자에게 보여줄 메시지" }` 와 적절한 HTTP 상태 코드.

| 상황 | 코드 |
|------|------|
| 메서드 불일치 | 405 |
| 본문 파싱 실패 | 400 |
| 파일 없음 / 형식 불가 | 400 |
| 용량 초과 | 413 |
| 파싱·AI 실패 | 500 |

## 변경 이력

| 날짜 | 내용 |
|------|------|
| 2026-04-03 | 최초 명세 반영, Node + busboy 멀티파트 처리 |
