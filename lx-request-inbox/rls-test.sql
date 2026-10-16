begin;
-- Test only this new queue; all rows roll back and no account is changed.
select set_config('lx.test_owner',(select id::text from public.profiles where 'lecture'=any(visible_tabs) and role='viewer' limit 1),true);
select set_config('lx.test_other',(select id::text from public.profiles where not 'lecture'=any(visible_tabs) and role='viewer' limit 1),true);
select set_config('lx.test_admin',(select id::text from public.profiles where role='editor' limit 1),true);
select set_config('request.jwt.claims',json_build_object('sub',current_setting('lx.test_owner'),'role','authenticated')::text,true);
set local role authenticated;
insert into public.lx_work_requests(request_key,tool,title,request_text) values('00000000-0000-0000-0000-000000101601','editing-script','[TEST ONLY] rollback',repeat('강의',50000));
do $$ begin
 if (select char_length(request_text) from public.lx_work_requests where request_key='00000000-0000-0000-0000-000000101601')<>100000 then raise exception 'truncated';end if;
 begin
  update public.lx_work_requests set status='completed' where request_key='00000000-0000-0000-0000-000000101601';
  raise exception 'owner bypassed completion guard';
 exception when insufficient_privilege then null;end;
 begin
  update public.lx_work_requests set request_text='tampered' where request_key='00000000-0000-0000-0000-000000101601';
  raise exception 'owner changed immutable payload';
 exception when insufficient_privilege then null;end;
end $$;
reset role;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('lx.test_other'),'role','authenticated')::text,true);
set local role authenticated;
do $$ begin
 if exists(select 1 from public.lx_work_requests where request_key='00000000-0000-0000-0000-000000101601') then raise exception 'other user read';end if;
 begin
  insert into public.lx_work_requests(request_key,tool,title,request_text) values('00000000-0000-0000-0000-000000101602','editing-script','forbidden','forbidden');
  raise exception 'unrelated account submitted';
 exception when insufficient_privilege then null;end;
end $$;
reset role;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('lx.test_admin'),'role','authenticated')::text,true);
set local role authenticated;
do $$ begin
 if not exists(select 1 from public.lx_work_requests where request_key='00000000-0000-0000-0000-000000101601') then raise exception 'admin cannot read';end if;
end $$;
reset role;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('lx.test_owner'),'role','authenticated')::text,true);
set local role authenticated;
update public.lx_work_requests set status='cancelled' where request_key='00000000-0000-0000-0000-000000101601';
do $$ begin
 if not exists(select 1 from public.lx_work_requests where request_key='00000000-0000-0000-0000-000000101601' and status='cancelled') then raise exception 'cancel failed';end if;
end $$;
reset role;
set local role anon;
do $$ begin
 begin
  perform id from public.lx_work_requests;
  raise exception 'anonymous read';
 exception when insufficient_privilege then null;end;
end $$;
reset role;
rollback;
select 'PASS: long text, owner read/cancel, other user denied, admin read, anonymous denied, immutable request, guarded completion' as verification;
