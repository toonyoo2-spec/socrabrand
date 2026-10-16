-- Isolated LX queue. No triggers start jobs and no existing tables or accounts are changed.
create table public.lx_work_requests (
 id uuid primary key default gen_random_uuid(),
 request_code text generated always as ('LX-' || upper(replace(id::text,'-',''))) stored unique,
 requester_id uuid not null default auth.uid() references public.profiles(id),
 request_key uuid not null,
 tool text not null check(tool in ('editing-script')),
 title text not null check(char_length(title) between 1 and 200),
 request_text text not null check(octet_length(request_text) between 1 and 2097152),
 status text not null default 'queued' check(status in ('queued','processing','needs_review','completed','failed','cancelled')),
 progress_done integer not null default 0 check(progress_done >= 0),
 progress_total integer not null default 0 check(progress_total >= progress_done),
 result jsonb not null default '{}'::jsonb,
 worker_id text, lease_until timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(requester_id,request_key)
);
create index lx_work_requests_queue on public.lx_work_requests(created_at) where status='queued';
create index lx_work_requests_owner on public.lx_work_requests(requester_id,created_at desc);
alter table public.lx_work_requests enable row level security;
revoke all on public.lx_work_requests from public,anon,authenticated;
grant select on public.lx_work_requests to authenticated;
grant insert(request_key,tool,title,request_text) on public.lx_work_requests to authenticated;
grant update(status) on public.lx_work_requests to authenticated;
grant all on public.lx_work_requests to service_role;
create policy lx_request_insert on public.lx_work_requests for insert to authenticated
with check (requester_id=(select auth.uid()) and status='queued' and exists (
 select 1 from public.profiles p where p.id=(select auth.uid()) and (p.role='editor' or 'lecture'=any(p.visible_tabs))
));
create policy lx_request_read on public.lx_work_requests for select to authenticated
using (requester_id=(select auth.uid()) or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='editor'));
create policy lx_request_owner_cancel on public.lx_work_requests for update to authenticated
using (requester_id=(select auth.uid()) and status='queued')
with check (requester_id=(select auth.uid()) and status='cancelled');
create policy lx_request_admin_status on public.lx_work_requests for update to authenticated
using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='editor'))
with check (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='editor'));

-- Human-friendly receipt number, independent of the unguessable internal ID.
alter table public.lx_work_requests add column request_number bigint generated always as identity unique;

alter table public.lx_work_requests add column sender_google_email text not null default '' check(char_length(sender_google_email)<=320);
grant insert(sender_google_email) on public.lx_work_requests to authenticated;
