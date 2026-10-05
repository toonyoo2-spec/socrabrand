-- Jay(DS)·Mia(AD) 디자인 일은 Claude(Opus 5.5)로, 나머지는 Codex로 (KWAN 2026-10-05)
-- claim이 돌려주는 payload에 runner('claude'|'codex')를 붙인다. 판단은 DB에서 하고, 실행기(worker.py)는 그 값만 따른다.
-- 끄기: update agency_config set value=jsonb_set(value,'{enabled}','false') where key='design_runner';

insert into agency_config(key,value,note) values('design_runner',
 jsonb_build_object('enabled',true,'agents',jsonb_build_array('DS','AD'),
  'pattern','(jay|제이|mia|미아|시안|피그마|figma|배너|썸네일|디자인|레이아웃|일러스트|키\s?비주얼|목업|mockup)'),
 'Jay·Mia 일을 Claude 실행기로 보낼지 정하는 기준(codex-bridge/design-runner.sql)')
on conflict(key) do nothing;

create or replace function public.agency_codex_runner(p_id uuid)
returns text language plpgsql stable security definer set search_path=public,pg_temp as $$
declare j agency_codex_jobs; cfg jsonb; agents text[]; pat text; c record; s record; code text;
begin
 select * into j from agency_codex_jobs where id=p_id;
 if j.id is null then return 'codex'; end if;
 select value into cfg from agency_config where key='design_runner';
 if cfg is null or coalesce((cfg->>'enabled')::boolean,false) is not true then return 'codex'; end if;
 agents := array(select jsonb_array_elements_text(coalesce(cfg->'agents','[]'::jsonb)));
 pat := coalesce(cfg->>'pattern','$^');
 -- 정기 보고·공부·리서치: 담당이 Jay·Mia면
 code := coalesce(j.payload->>'code', j.payload->>'agent');
 if code = any(agents) then return 'claude'; end if;
 if j.source_table='agency_research' then
  select r.code into code from agency_research r where r.id::text=j.source_id;
  if code = any(agents) then return 'claude'; end if;
 end if;
 -- 채팅·첨부: Jay·Mia 1:1 방, 또는 단체방의 디자인 요청
 if j.source_table in ('agency_chat','agency_media') then
  select ch.code, ch.body into c from agency_chat ch
   where ch.id::text = case when j.source_table='agency_chat' then j.source_id
                            else (select m.chat_id::text from agency_media m where m.id::text=j.source_id) end;
  if c.code = any(agents) then return 'claude'; end if;
  if (c.code='TEAM' or c.code ~ '^R[0-9]+$') and coalesce(c.body,'') ~* pat then return 'claude'; end if;
 end if;
 -- 강제 출근: Jay·Mia를 불렀고 목적이 디자인이면
 if j.source_table='agency_summons' then
  select sm.team, sm.note into s from agency_summons sm where sm.id::text=j.source_id;
  if s.team && agents and coalesce(s.note,'') ~* pat then return 'claude'; end if;
 end if;
 return 'codex';
end $$;
revoke all on function public.agency_codex_runner(uuid) from public,anon,authenticated;

-- claim 응답에만 runner를 더한다(나머지는 기존 함수 그대로)
do $do$
declare d text;
begin
 d := pg_get_functiondef('public.agency_codex_rpc(text,text,jsonb)'::regprocedure);
 if position('agency_codex_runner' in d) > 0 then return; end if;
 d := replace(d,
  $$jsonb_build_object('lane',coalesce(p_args->>'lane','background')));$$,
  $$jsonb_build_object('lane',coalesce(p_args->>'lane','background'),'runner',agency_codex_runner(r.id)));$$);
 if position('agency_codex_runner' in d) = 0 then raise exception 'claim return line not found; agency_codex_rpc changed'; end if;
 execute d;
end $do$;
