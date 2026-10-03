// Supabase Edge Function: ppt-ai-review
// PPT 자동화 탭의 "AI 내용 검수" 버튼이 부른다. 강의 하나(해석된 JSON)를 받아
// 정답이 맞는지, 문법·철자 오류, 스크립트와 어긋난 독해 문항 등을 찾아 목록으로 돌려준다.
//
// 인증: 탭에서 로그인한 구글 토큰을 x-google-token 으로 받아 socra.ai 계정인지 확인한다.
// API 키는 Supabase 시크릿 ANTHROPIC_API_KEY 에만 있다.
// 배포: verify_jwt=false (Supabase 로그인이 아니라 구글 토큰으로 확인하므로)
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import Anthropic from 'npm:@anthropic-ai/sdk';

const ALLOWED_ORIGINS = ['https://www.socrabrand.cloud', 'https://socrabrand.cloud'];
const GOOGLE_CLIENT_ID = '43041548577-s4cgqtv0fle3njshdgljnh34quuet4od.apps.googleusercontent.com';
const ALLOWED_DOMAIN = 'socra.ai';
const MODEL = 'claude-opus-5-5';
const MAX_INPUT = 80_000;

function cors(req: Request) {
  const origin = req.headers.get('origin') || '';
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, x-google-token',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'issues'],
  properties: {
    summary: { type: 'string' },
    issues: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['severity', 'section', 'problem', 'current', 'suggestion'],
        properties: {
          severity: { type: 'string', enum: ['error', 'warn', 'info'] },
          section: { type: 'string' },
          problem: { type: 'string' },
          current: { type: 'string' },
          suggestion: { type: 'string' },
        },
      },
    },
  },
};

const SYSTEM = `당신은 한국 초·중등 학생용 영어 뉴스 수업(CNN 10) 자료의 검수자입니다.
강의 하나의 데이터(JSON)를 받습니다. 이 데이터는 그대로 수업 PPT에 들어갑니다.
형식(글자 수, 보기 개수, 번호)은 이미 코드로 검사했으니 다시 보고하지 마세요. 내용만 봅니다.

확인할 것:
- 정답이 정말 맞는지. 4지선다에서 표시된 정답 외에 다른 보기도 정답이 될 수 있는지.
- 영어 문장(예문, 연습 문제, 정답, 퀴즈, 헤드라인)의 문법·철자 오류. 예: 주어가 복수인데 단수 동사(My parents ... is renovating).
- 빈칸 문제에서 정답을 넣은 완성 문장이 자연스러운지.
- T/F, Two Truths and a Lie, 사건 순서 문항이 스크립트 내용과 맞는지.
- 단어 뜻(정답 보기)이 원문 문장 속 의미와 맞는지, 새 예문이 그 단어를 바르게 쓰는지.
- 문법 패턴 설명이 정확한지, 연습·퀴즈가 그 패턴을 실제로 묻는지.

규칙:
- 확실한 문제만 보고합니다. 취향 차이나 문체 제안은 빼세요.
- severity: 수업에서 틀린 내용을 가르치게 되면 error, 고치는 편이 좋으면 warn, 참고는 info.
- section: 어디인지 한국어로 짧게. 예: "Script 1 연습 3", "단어 2", "퀴즈 4", "Trivia".
- problem: 무엇이 왜 문제인지 한국어 한두 문장. 영어 원문은 그대로 인용.
- current: 지금 들어 있는 영어 원문(짧게). suggestion: 고친 영어 문장이나 값. 고칠 값이 없으면 빈 문자열.
- 문제가 없으면 issues는 빈 배열.
- summary: 전체 평가 한 문장(한국어).`;

async function checkGoogleUser(token: string): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/tokeninfo?access_token=' + encodeURIComponent(token));
  if (!res.ok) throw new Error('구글 로그인이 만료되었습니다. 다시 로그인해 주세요.');
  const info = await res.json();
  if (info.azp !== GOOGLE_CLIENT_ID && info.aud !== GOOGLE_CLIENT_ID) throw new Error('이 사이트에서 받은 로그인이 아닙니다.');
  const email = String(info.email || '');
  if (!email.endsWith('@' + ALLOWED_DOMAIN) || String(info.email_verified) !== 'true') throw new Error(`${ALLOWED_DOMAIN} 계정만 쓸 수 있습니다.`);
  return email;
}

Deno.serve(async (req: Request) => {
  const headers = cors(req);
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json' } });
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  let email = '';
  try {
    email = await checkGoogleUser(req.headers.get('x-google-token') || '');
  } catch (e) {
    return json({ error: (e as Error).message }, 401);
  }

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) return json({ error: 'ANTHROPIC_API_KEY 시크릿이 없습니다. Supabase → Edge Functions → Secrets 에 추가해 주세요.', code: 'no_key' }, 500);

  const raw = await req.text();
  if (raw.length > MAX_INPUT) return json({ error: '강의 데이터가 너무 큽니다.' }, 413);
  let body: { lesson?: unknown };
  try { body = JSON.parse(raw); } catch { return json({ error: 'JSON 형식이 아닙니다.' }, 400); }
  if (!body.lesson) return json({ error: 'lesson 이 없습니다.' }, 400);

  const client = new Anthropic({ apiKey });
  try {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      system: SYSTEM,
      messages: [{ role: 'user', content: '다음 강의를 검수해 주세요.\n\n' + JSON.stringify(body.lesson) }],
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA } },
      // 안전 분류기가 거절하면 서버에서 다른 모델로 다시 시도
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
    } as any);

    if (response.stop_reason === 'refusal') return json({ error: 'AI가 이 요청을 처리하지 못했습니다.' }, 502);
    const text = response.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('');
    let result;
    try { result = JSON.parse(text); } catch { return json({ error: 'AI 응답을 읽지 못했습니다.' }, 502); }
    console.log(JSON.stringify({ email, model: response.model, issues: result.issues?.length, usage: response.usage }));
    return json({ ...result, model: response.model });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return json({ error: '요청이 많아 잠시 뒤 다시 시도해 주세요.' }, 429);
    if (e instanceof Anthropic.AuthenticationError) return json({ error: 'ANTHROPIC_API_KEY 가 올바르지 않습니다.', code: 'bad_key' }, 500);
    if (e instanceof Anthropic.APIError) return json({ error: `AI 호출 실패 (${e.status}): ${e.message}` }, 502);
    console.error(e);
    return json({ error: 'AI 검수 중 오류가 났습니다.' }, 500);
  }
});
