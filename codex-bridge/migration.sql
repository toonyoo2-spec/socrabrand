-- Install while provider=claude. Routing switches only after a successful Codex test.
begin;
create table if not exists public.agency_codex_workers (
 worker_id text primary key, key_hash text not null, enabled boolean not null default true,
 heartbeat_at timestamptz, state text not null default 'offline'
);
alter table public.agency_codex_workers enable row level security;
revoke all on public.agency_codex_workers from public, anon, authenticated;
create table if not exists public.agency_codex_jobs (
 id uuid primary key default gen_random_uuid(), dedupe text unique not null,
 kind text not null check(kind in ('duty','summon','research','media','report','study','growth','scout','hr_scout','night1','night2','morning','test')),
 source_table text, source_id text, payload jsonb not null default '{}'::jsonb,
 status text not null default 'queued' check(status in ('queued','running','done','needs_user','failed','blocked')),
 priority integer not null default 50, worker_id text, lease_until timestamptz,
 result jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists agency_codex_jobs_queue on public.agency_codex_jobs(priority,created_at) where status='queued';
alter table public.agency_codex_jobs enable row level security;
create policy agency_codex_jobs_owner_read on public.agency_codex_jobs for select to authenticated using (public.is_agency_owner());
grant select on public.agency_codex_jobs to authenticated;
revoke all on public.agency_codex_jobs from anon;

create or replace function public.agency_codex_enqueue(p_kind text,p_dedupe text,p_table text default null,p_id text default null,p_payload jsonb default '{}'::jsonb,p_priority int default 50)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare jid uuid;
begin
 insert into agency_codex_jobs(kind,dedupe,source_table,source_id,payload,priority)
 values(p_kind,p_dedupe,p_table,p_id,p_payload,p_priority) on conflict(dedupe) do nothing returning id into jid;
 if jid is null then select id into jid from agency_codex_jobs where dedupe=p_dedupe; end if;
 return jid;
end $$;
revoke all on function public.agency_codex_enqueue(text,text,text,text,jsonb,int) from public,anon,authenticated;

create or replace function public.agency_codex_scan()
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare r record;
begin
 for r in select id from agency_media where status='queued' loop
  perform agency_codex_enqueue('media','media:'||r.id,'agency_media',r.id::text,'{}',5);
 end loop;
 for r in select id from agency_chat where sender='kwan' and not handled and not media_pending loop
  perform agency_codex_enqueue('duty','chat:'||r.id,'agency_chat',r.id::text,'{}',10);
 end loop;
 for r in select id from agency_interventions where status='open' and not duty_seen loop
  perform agency_codex_enqueue('duty','iv:'||r.id,'agency_interventions',r.id::text,'{}',10);
 end loop;
 for r in select id from agency_summons where status='queued' loop
  perform agency_codex_enqueue('summon','summon:'||r.id,'agency_summons',r.id::text,'{}',15);
 end loop;
 for r in select id from agency_research where status='queued' loop
  perform agency_codex_enqueue('research','research:'||r.id,'agency_research',r.id::text,'{}',20);
 end loop;
end $$;
revoke all on function public.agency_codex_scan() from public,anon,authenticated;

create or replace function public.agency_codex_on_row()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if (select value#>>'{}' from agency_config where key='execution_provider') is distinct from 'codex' then return new; end if;
 if tg_table_name='agency_chat' then
  if new.sender='kwan' and not new.handled and not new.media_pending then
   perform agency_codex_enqueue('duty','chat:'||new.id,tg_table_name,new.id::text,'{}',10);
  end if;
 elsif tg_table_name='agency_interventions' then
  if new.status='open' and not new.duty_seen then perform agency_codex_enqueue('duty','iv:'||new.id,tg_table_name,new.id::text,'{}',10); end if;
 elsif tg_table_name='agency_summons' then
  if new.status='queued' then perform agency_codex_enqueue('summon','summon:'||new.id,tg_table_name,new.id::text,'{}',15); end if;
 elsif tg_table_name='agency_research' then
  if new.status='queued' then perform agency_codex_enqueue('research','research:'||new.id,tg_table_name,new.id::text,'{}',20); end if;
 elsif tg_table_name='agency_media' then
  if new.status='queued' then perform agency_codex_enqueue('media','media:'||new.id,tg_table_name,new.id::text,'{}',5); end if;
 end if;
 return new;
end $$;
revoke all on function public.agency_codex_on_row() from public,anon,authenticated;
create trigger agency_codex_chat after insert or update of media_pending on agency_chat for each row execute function agency_codex_on_row();
create trigger agency_codex_iv after insert on agency_interventions for each row execute function agency_codex_on_row();
create trigger agency_codex_summon after insert on agency_summons for each row execute function agency_codex_on_row();
create trigger agency_codex_research after insert on agency_research for each row execute function agency_codex_on_row();
create trigger agency_codex_media after insert on agency_media for each row execute function agency_codex_on_row();

create or replace function public.agency_codex_rpc(p_token text,p_op text,p_args jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare wid text; r record; v jsonb;
begin
 select worker_id into wid from agency_codex_workers where enabled and key_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex');
 if wid is null then raise exception 'worker authentication failed' using errcode='42501'; end if;
 if p_op in ('heartbeat','claim') then
  update agency_codex_workers set heartbeat_at=now(),state=coalesce(p_args->>'state','idle') where worker_id=wid;
  insert into agency_config(key,value,note) values('codex_bridge',jsonb_build_object('provider','codex','heartbeat_at',now(),'state',coalesce(p_args->>'state','idle'),'worker',wid),'Codex local worker heartbeat')
  on conflict(key) do update set value=excluded.value,updated_at=now();
 end if;
 if p_op='heartbeat' then
  update agency_codex_jobs set lease_until=now()+interval '35 minutes',updated_at=now() where worker_id=wid and status='running' and id=nullif(p_args->>'job_id','')::uuid;
  return jsonb_build_object('ok',true);
 elsif p_op='claim' then
  update agency_codex_jobs set status='blocked',result=jsonb_build_object('summary','Worker stopped before completion; inspect partial outputs before retrying.'),updated_at=now() where status='running' and lease_until<now();
  if (select value#>>'{}' from agency_config where key='execution_provider')='codex' then perform agency_codex_scan(); end if;
  select * into r from agency_codex_jobs where status='queued' order by priority,created_at for update skip locked limit 1;
  if r.id is null then return 'null'::jsonb; end if;
  update agency_codex_jobs set status='running',worker_id=wid,lease_until=now()+interval '35 minutes',updated_at=now() where id=r.id;
  return to_jsonb(r);
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
commit;
