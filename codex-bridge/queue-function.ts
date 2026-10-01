// Existing Edge Function compatibility layer: authenticate, persist, return. No model APIs.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
const FUNCTION_NAME = '__FUNCTION_NAME__';
const cors = { 'Access-Control-Allow-Origin': 'https://www.socrabrand.cloud', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, x-scout-token', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const respond = (b: unknown, status=200) => new Response(JSON.stringify(b),{status,headers:{...cors,'Content-Type':'application/json'}});
Deno.serve(async(req: Request)=>{
 if(req.method==='OPTIONS') return new Response('ok',{headers:cors});
 if(req.method!=='POST') return respond({error:'POST required'},405);
 const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
 const token=req.headers.get('authorization')?.replace(/^Bearer\s+/i,'');
 const {data: cfg}=await admin.from('agency_config').select('key,value').in('key',['scout_token','execution_provider','codex_bridge']);
 const config=Object.fromEntries((cfg||[]).map(r=>[r.key,r.value]));
 const internal=Boolean(config.scout_token && req.headers.get('x-scout-token')===config.scout_token);
 let uid: string | null=null;
 if(!internal && token){
  const {data:{user}}=await admin.auth.getUser(token);
  if(user){const {data:owner}=await admin.from('agency_owners').select('user_id').eq('user_id',user.id).maybeSingle();if(owner)uid=user.id;}
 }
 if(!internal && !uid)return respond({error:'KWAN authentication required'},403);
 if(config.execution_provider!=='codex')return respond({error:'Codex cutover is not active'},409);
 const body=await req.json().catch(()=>({}));
 try{
  if(FUNCTION_NAME==='agency-summon'){
   if(!uid)return respond({error:'Owner sign-in required'},403);
   const {data:agents,error:aerr}=await admin.from('agency_agents').select('code').eq('active',true);
   if(aerr)throw aerr;
   const active=new Set((agents||[]).map(a=>a.code));
   const team=[...new Set(['PM','YK',...(Array.isArray(body.team)?body.team:[])])].filter(x=>active.has(x)&&x!=='HR');
   const {data,error}=await admin.from('agency_summons').insert({requested_by:uid,team,note:String(body.note||'').slice(0,12000),status:'queued'}).select('id').single();
   if(error)throw error;
   return respond({ok:true,id:data.id,status:'queued',provider:'codex'});
  }
  if(FUNCTION_NAME==='agency-duty'||FUNCTION_NAME==='agency-media'){
   const {error}=await admin.rpc('agency_codex_scan');if(error)throw error;
  }else if(FUNCTION_NAME==='agency-routine-check'){
   return respond({ok:true,provider:'codex',claude:false,worker:config.codex_bridge||null});
  }else{
   const kind=FUNCTION_NAME==='agency-report'?'report':FUNCTION_NAME==='agency-study'?'study':FUNCTION_NAME==='agency-growth'?(body.mode==='scout'?'hr_scout':'growth'):'scout';
   const {error}=await admin.rpc('agency_codex_schedule',{p_kind:kind});if(error)throw error;
  }
  return respond({ok:true,provider:'codex',status:'queued'});
 }catch(_){return respond({error:'작업 저장에 실패했습니다. Codex 연결 상태를 확인해 주세요.'},500);}
});
