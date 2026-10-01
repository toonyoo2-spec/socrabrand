-- Run only after the metadata migration, pairing and live Codex test succeed.
begin;
insert into public.agency_config(key,value,note) values
 ('execution_provider','"codex"','KWAN requested Claude to Codex migration'),
 ('claude_mode','"disabled"','No Claude API or routine fallback'),
 ('codex_auto_meeting','false','Preserve KWAN request to stop automatic meetings')
on conflict(key) do update set value=excluded.value,note=excluded.note,updated_at=now();

create or replace function public.agency_duty_call()
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin perform public.agency_codex_scan(); end $$;
create or replace function public.agency_media_call()
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin perform public.agency_codex_scan(); end $$;

create or replace function public.agency_codex_schedule(p_kind text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare a record; d text:=(now() at time zone 'Asia/Seoul')::date::text; k timestamp:=now() at time zone 'Asia/Seoul';
begin
 if (select value#>>'{}' from agency_config where key='execution_provider') is distinct from 'codex' then return; end if;
 if p_kind in ('report','study') then
  for a in select code from agency_agents where active and not on_call and (p_kind<>'report' or code<>'PM') order by sort loop
   perform agency_codex_enqueue(p_kind,p_kind||':'||d||':'||a.code,'agency_agents',a.code,jsonb_build_object('date',d,'code',a.code),case when p_kind='report' then 50 else 70 end);
  end loop;
 elsif p_kind in ('growth','hr_scout','scout') then
  perform agency_codex_enqueue(p_kind,p_kind||':'||d,null,null,jsonb_build_object('date',d),case when p_kind='growth' then 60 else 80 end);
 elsif p_kind in ('night1','night2') then
  if (select value#>>'{}' from agency_config where key='night_mode')='off' then return; end if;
  perform agency_codex_enqueue(p_kind,p_kind||':'||d,null,null,jsonb_build_object('date',d),90);
 else raise exception 'schedule type not allowed';
 end if;
end $$;
revoke all on function public.agency_codex_schedule(text) from public,anon,authenticated;
grant execute on function public.agency_codex_schedule(text) to service_role;
grant execute on function public.agency_codex_enqueue(text,text,text,text,jsonb,int) to service_role;
grant execute on function public.agency_codex_scan() to service_role;
create or replace function public.agency_scout_call(p_mode text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin perform public.agency_codex_schedule('scout'); end $$;

-- Preserve the existing cadence while removing every Agency model API cron call.
do $$ declare j record; cmd text; begin
 for j in select jobid,jobname from cron.job where jobname like 'agency-%' loop
  cmd:=case
   when j.jobname in ('agency-duty-sweep','agency-media-sweep') then 'select public.agency_codex_scan();'
   when j.jobname='agency-scout-collect' then 'select public.agency_codex_schedule(''scout'');'
   when j.jobname='agency-report' then 'select public.agency_codex_schedule(''report'');'
   when j.jobname='agency-study' then 'select public.agency_codex_schedule(''study'');'
   when j.jobname='agency-growth' then 'select public.agency_codex_schedule(''growth'');'
   when j.jobname='agency-hr-scout' then 'select public.agency_codex_schedule(''hr_scout'');'
   else null end;
  if cmd is not null then perform cron.alter_job(j.jobid,command:=cmd);
  elsif j.jobname like 'agency-scout-analyze%' then perform cron.alter_job(j.jobid,active:=false);
  end if;
 end loop;
end $$;
-- No automatic morning meeting is re-enabled. Night still obeys the current off setting.
select cron.schedule('agency-codex-night1','17 16 * * 0-4','select public.agency_codex_schedule(''night1'');');
select cron.schedule('agency-codex-night2','17 19 * * 0-4','select public.agency_codex_schedule(''night2'');');
select public.agency_codex_scan();
commit;
