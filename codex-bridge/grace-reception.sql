create or replace function public.agency_codex_rpc(p_token text,p_op text,p_args jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare wid text; r record; v jsonb;
begin
 select worker_id into wid from agency_codex_workers where enabled and key_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex');
 if wid is null then raise exception 'worker authentication failed' using errcode='42501'; end if;
 if p_op in ('heartbeat','claim') then
  update agency_codex_workers set heartbeat_at=now(),state=coalesce(p_args->>'state','idle') where worker_id=wid;
  insert into agency_config(key,value,note) values('codex_bridge',jsonb_build_object('provider','codex','heartbeat_at',now(),'state',case when exists(select 1 from agency_codex_jobs where status='running') then 'working' else coalesce(p_args->>'state','idle') end,'worker',wid),'Codex local worker heartbeat')
  on conflict(key) do update set value=excluded.value,updated_at=now();
 end if;
 if p_op='heartbeat' then
  update agency_codex_jobs set lease_until=now()+interval '35 minutes',updated_at=now() where worker_id=wid and status='running' and id=nullif(p_args->>'job_id','')::uuid;
  return jsonb_build_object('ok',true);
 elsif p_op='claim' then
  update agency_codex_jobs set status='blocked',result=jsonb_build_object('summary','Worker stopped before completion; inspect partial outputs before retrying.'),updated_at=now() where status='running' and lease_until<now();
  if (select value#>>'{}' from agency_config where key='execution_provider')='codex' then perform agency_codex_scan(); end if;
  select * into r from agency_codex_jobs where status='queued' and case coalesce(p_args->>'lane','background')
 when 'reception' then kind='duty' and ((coalesce(source_table,'')='agency_chat' and exists(select 1 from agency_chat c where c.id::text=agency_codex_jobs.source_id and c.code='PM')) or coalesce(payload->>'agent','')='PM')
 when 'interactive' then kind in ('duty','summon','media') and not(kind='duty' and ((coalesce(source_table,'')='agency_chat' and exists(select 1 from agency_chat c where c.id::text=agency_codex_jobs.source_id and c.code='PM')) or coalesce(payload->>'agent','')='PM'))
 when 'background' then kind not in ('duty','summon','media')
 else false end
 order by priority,created_at for update skip locked limit 1;
  if r.id is null then return 'null'::jsonb; end if;
  update agency_codex_jobs set status='running',worker_id=wid,lease_until=now()+interval '35 minutes',updated_at=now() where id=r.id;
  return to_jsonb(r)||jsonb_build_object('payload',r.payload||jsonb_build_object('lane',coalesce(p_args->>'lane','background')));
 elsif p_op='finish' then
  if p_args->>'status' not in ('done','needs_user','failed','blocked') then raise exception 'invalid job status'; end if;
  update agency_codex_jobs set status=p_args->>'status',result=p_args->'result',lease_until=null,updated_at=now() where id=(p_args->>'job_id')::uuid and worker_id=wid and status='running' returning to_jsonb(agency_codex_jobs.*) into v;
  if v is null then raise exception 'job lease not owned'; end if;
  return v;
 elsif p_op='health' then
  return jsonb_build_object('paired',true,'active_agents',(select count(*) from agency_agents where active),'worker',wid);
 else
  raise exception 'operation not allowed';
 end if;
end $$;
revoke all on function public.agency_codex_rpc(text,text,jsonb) from public;
grant execute on function public.agency_codex_rpc(text,text,jsonb) to anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.agency_codex_smalltalk()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare last_kwan timestamptz; now_kst timestamp:=now() at time zone 'Asia/Seoul'; d text:=now_kst::date::text;
begin
 if (select value#>>'{}' from agency_config where key='execution_provider') is distinct from 'codex' then return; end if;
 if (select value from agency_config where key='grace_smalltalk_enabled') is distinct from 'true'::jsonb then return; end if;
 if not exists(select 1 from agency_codex_workers where enabled and heartbeat_at>now()-interval '90 seconds') then return; end if;
 if extract(hour from now_kst)<9 or extract(hour from now_kst)>=21 then return; end if;
 select max(created_at) into last_kwan from agency_chat where sender='kwan';
 if last_kwan is null or last_kwan<now()-interval '3 hours' or last_kwan>now()-interval '20 minutes' then return; end if;
 if exists(select 1 from agency_chat where code='PM' and sender='kwan' and not handled) then return; end if;
 if exists(select 1 from agency_chat where code='PM' and sender='agent' and not coalesce(read_by_kwan,false) and created_at>now()-interval '1 day') then return; end if;
 if exists(select 1 from agency_codex_jobs where payload->>'mode'='smalltalk' and created_at>now()-interval '6 hours') then return; end if;
 if (select count(*) from agency_codex_jobs where payload->>'mode'='smalltalk' and (created_at at time zone 'Asia/Seoul')::date=now_kst::date)>=2 then return; end if;
 perform agency_codex_enqueue('duty','smalltalk:'||d||':'||floor(extract(hour from now_kst)/6)::text,null,null,jsonb_build_object('agent','PM','mode','smalltalk','date',d),30);
end $function$
;
revoke all on function public.agency_codex_smalltalk() from public,anon,authenticated;
grant execute on function public.agency_codex_smalltalk() to service_role;

