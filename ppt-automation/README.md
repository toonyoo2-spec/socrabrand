# PPT 자동화 (커리큘럼 시트 → 구글 슬라이드)

사이트 탭: `https://www.socrabrand.cloud/#pptauto`
바로가기: `https://www.socrabrand.cloud/ppt-automation.html` (사이트 로그인 없이 사용 가능)

## 흐름

1. **불러오기**: 각자 socra.ai 구글 계정으로 로그인하면 드라이브에서 이름에 "커리큘럼"이 들어간 시트를 찾아 목록으로 보여 준다. 고르면 바로 읽고, 마지막 선택을 기억한다. 로그인 없이 CSV 파일을 올려도 된다.
2. **검수**: 강마다 형식 오류(정답 표시 없음, 보기 개수, 순서 정답 누락 등)와 시트 `Ex` 행의 글자 수 규칙 초과를 열 이름과 함께 보여 준다.
3. **미리보기**: 만들어질 슬라이드 순서와 내용을 그린다. 1강은 기존 완성본과 같은 91장이 나온다.
4. **만들기**: 템플릿을 복사해 유형별 원본 슬라이드를 순서대로 복제하고 `{{토큰}}`을 채운다. 단어·표현은 강조 색을 입히고, 정답 강조 박스는 맞는 보기 위로 옮긴다. 템플릿과 기존 PPT는 바뀌지 않는다.

시트 내용과 PPT는 이 저장소에 저장되지 않는다. 브라우저가 로그인한 사람의 권한으로 구글 API를 직접 부른다.

## 처음 한 번: 자동화용 템플릿 만들기

1. 1강 PPT를 복사한다 (파일 → 사본 만들기).
2. 유형마다 한 장씩만 남기고 지운다. 유형 목록과 토큰은 탭의 **토큰 안내**에 있다.
3. 남긴 슬라이드의 **발표자 노트**에 `#유형`을 적는다. 예: `#word_q`
4. 바뀔 글자를 토큰으로 바꾼다. 예: 문장 → `{{sentence}}`, "단어 1/4" → `단어 {{n}}/4`
5. 정답 슬라이드의 강조 박스 안 글자는 `{{answer}}`로 바꾸고 아무 보기 위에 겹쳐 둔다.
6. 단어 이미지 자리는 `{{image}}`라고 적은 도형으로 둔다.
7. 파일 이름에 "템플릿"을 넣으면 탭 왼쪽 3번 목록에 바로 나온다. 고른 뒤 **템플릿 점검**으로 빠진 유형을 확인한다.
8. 결과물 폴더·파일 이름 형식 등은 **고급 설정**에서 바꾼다.

## Google Cloud

- 프로젝트 `socrabrand-ppt`, 앱 유형 **내부**(socra.ai 계정만), 웹 클라이언트 ID는 `ppt-automation.html`의 `GOOGLE_CLIENT_ID`.
- 사용 API: Google Slides API, Google Sheets API, Google Drive API.
- 승인된 JavaScript 원본: `https://www.socrabrand.cloud`, `https://socrabrand.cloud`.

## 파일

| 파일 | 역할 |
|---|---|
| `ppt-automation.html` | 탭 화면, 구글 로그인, API 호출 |
| `ppt-automation/ppt-core.js` | 시트 해석, 검수, 슬라이드 계획 |
| `ppt-automation/slides-builder.js` | 계획 → Slides API 요청 (순수 함수) |
| `ppt-automation/test/ppt.test.js` | 가짜 데이터로 만든 테스트 (`node --test ppt-automation/test/ppt.test.js`) |

## AI 내용 검수

- 검수 탭의 **AI로 검수하기** → Supabase 함수 `ppt-ai-review`(소스: `ppt-automation/edge/ppt-ai-review.ts`) → Claude Opus 5.5.
- 정답이 맞는지, 영어 문법·철자, 스크립트와 어긋난 독해 문항, 단어 뜻·예문을 본다. 형식·글자 수는 코드 검수가 맡는다.
- 탭에서 로그인한 구글 토큰으로 socra.ai 계정인지 확인한 뒤에만 실행한다 (외부에서 API 비용을 쓰지 못하게).
- API 키는 Supabase 프로젝트 시크릿 `ANTHROPIC_API_KEY`. 없으면 탭에 안내가 뜬다.
- 배포: `verify_jwt=false` (Supabase 로그인이 아니라 구글 토큰으로 확인).

## 아직 없는 것

- **글자 넘침 자동 축소**: Slides API로는 "넘치면 축소"를 켤 수 없다. 대신 시트 가이드의 글자 수 규칙으로 미리 경고한다.
