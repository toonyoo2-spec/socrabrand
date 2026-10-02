"""One Codex process per fixed reception/interactive/background lane; no idle inference."""
import argparse
import datetime as dt
import fcntl
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import time
from client import Database, ROOT, settings

RUNTIME = ROOT / 'runtime'
STOP = False

def log(event, **fields):
    print(json.dumps({'at':dt.datetime.now(dt.timezone.utc).isoformat(),'event':event,**fields},ensure_ascii=False),flush=True)

def model_environment():
    env = dict(os.environ)
    # The app's connector integration is retained. Inference always uses ChatGPT sign-in.
    for name in ('OPENAI_API_KEY','ANTHROPIC_API_KEY','CLAUDE_API_KEY','GEMINI_API_KEY','SUPABASE_SERVICE_ROLE_KEY','AGENCY_WORKER_TOKEN','SUPABASE_ANON_KEY','SUPABASE_URL'):
        env.pop(name, None)
    return env

def prompt_for(job):
    source = {'id':job['id'],'kind':job['kind'],'source_table':job.get('source_table'),'source_id':job.get('source_id'),'payload':job.get('payload',{})}
    if job.get('payload', {}).get('lane') == 'reception':
        return ('Read OPERATING.md and GRACE_PERSONAL.md. You are Grace, KWAN personal secretary, responding in PM 1:1. '
                'Use the connected Supabase plugin. In one focused query read the exact source message, recent PM conversation, '
                'current grace_personal_policy, explicit user preferences and codex_bridge/queued-running job counts. '
                'Do not read every config/spec, all employee profiles, daily reports or unrelated rooms for an ordinary greeting or status check. '
                'Reply naturally and briefly as soon as that relevant context is checked; do not turn small talk into an organization audit. '
                'No reference research, formal report, meeting, review note or multi-step project unless the user actually requests one. '
                'If a problem is visible, tell the fact and next action without claiming all systems are verified. '
                'Preserve scope, permissions, credentials and truthful tool outcomes. '
                'For payload.mode=smalltalk, recheck unread/pending messages and current personal policy; quietly skip if inappropriate. '
                'Write only to PM, verify the saved answer, and mark the exact user message handled only after the answer is saved. '
                'Keep PM idle on completion, 24-hour duty. Finish with result.schema.json JSON. Job metadata:\n'
                + json.dumps(source, ensure_ascii=False))
    return ('Read OPERATING.md before doing anything. This is a KWAN-authorized Agency job. '
            'Use the connected Supabase plugin for Agency DB rows and connected Notion/Figma/Slack tools only within OPERATING.md. '
            'Read current spec_codex, spec_senior and reference_policy through the database, then the assigned active agent guideline, self, skill and study. '
            'Follow senior_role and execution_contract. Verify, produce real outputs, review outcomes and apply relevant references from Pinterest, YouTube, Instagram and role communities. '
            'Research in the background: prefer web search and read-only page retrieval without visible browser windows. '
            'If browser inspection is essential, use background tabs without changing the user current window, tab or focus. '
            'If background control is unavailable, use public alternative sources or record the access limit instead of opening foreground windows, unless the user explicitly requested visible UI work. '
            'Clean up only temporary tabs created by this job; never close the user existing tabs. '
            'Use legacy spec_morning/spec_night only for needed compatible data formats. Never use an external model API. '
            'Do not operate on socraauto blog/cardnews pipelines, change server configuration, create schedules, '
            'spawn unrelated chats, or read .env/runtime credential files. '
            'For source IDs cast integer IDs to numbers in exact JSON filters; meeting IDs remain strings. '
            'Do not claim output success before reading back the saved result. '
            'For a reception lane job, read grace_personal_policy and the PM context. Simple conversational/status messages need a short answer without unrelated browsing or formal reports. '
            'For payload.mode=smalltalk, check grace_personal_policy, recent PM chat and user availability again; only write a natural useful opener if appropriate, otherwise quietly finish as skipped in the summary. '
            'If this job is test, only read the active agents and reply with a JSON done status; do not change any Agency content. '
            'Finish with exactly the JSON required by result.schema.json. Job metadata follows:\n'+json.dumps(source,ensure_ascii=False))

def command_for(job, output, config):
    return [config['CODEX_BIN'],'exec','--skip-git-repo-check','--approve-for-me',
            '--cd',str(ROOT),'--json','--output-schema',str(ROOT/'result.schema.json'),
            '--output-last-message',str(output),
            prompt_for(job)]

def run_job(db, job, config):
    folder=RUNTIME/job['id']; folder.mkdir(mode=0o700,parents=True,exist_ok=True)
    output=folder/'result.json'
    timeout=int(config.get('JOB_TIMEOUT_SECONDS','1800'))
    log('job_started',job_id=job['id'],kind=job['kind'])
    started=time.monotonic(); last_beat=0
    with (folder/'events.jsonl').open('w') as events, (folder/'stderr.log').open('w') as errors:
        process=subprocess.Popen(command_for(job,output,config),env=model_environment(),stdin=subprocess.DEVNULL,
                                 stdout=events,stderr=errors,start_new_session=True)
        try:
            while process.poll() is None:
                if STOP or time.monotonic()-started>timeout:
                    os.killpg(process.pid,signal.SIGTERM)
                    try:process.wait(timeout=10)
                    except subprocess.TimeoutExpired:
                        os.killpg(process.pid,signal.SIGKILL);process.wait()
                    raise RuntimeError('Worker interrupted or job time limit exceeded; inspect partial output before retry')
                if time.monotonic()-last_beat>30:
                    db.rpc('heartbeat',{'state':'working','job_id':job['id']});last_beat=time.monotonic()
                time.sleep(1)
            if process.returncode!=0:
                raise RuntimeError(f'Codex exited with status {process.returncode}; no automatic retry of partial work')
            if not output.exists():
                raise RuntimeError('Codex produced no verified final result')
            result=json.loads(output.read_text())
            if result.get('status') not in ('done','needs_user','blocked') or not isinstance(result.get('summary'),str):
                raise RuntimeError('Invalid Codex final result')
        except Exception as e:
            if process.poll() is None:
                os.killpg(process.pid,signal.SIGTERM)
                process.wait(timeout=10)
            result={'status':'blocked','summary':str(e)}
    db.rpc('finish',{'job_id':job['id'],'status':result['status'],'result':result})
    db.rpc('heartbeat',{'state':'idle'})
    log('job_finished',job_id=job['id'],status=result['status'])
    return result

def stop(_signum,_frame):
    global STOP
    STOP=True

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--once',action='store_true');parser.add_argument('--check',action='store_true');parser.add_argument('--lane',choices=('reception','interactive','background'),default='background')
    args=parser.parse_args();config=settings();db=Database(config)
    if args.check:
        print(json.dumps(db.rpc('health'),ensure_ascii=False));return
    RUNTIME.mkdir(mode=0o700,parents=True,exist_ok=True)
    lock=(RUNTIME/('worker-'+args.lane+'.lock')).open('a')
    try:fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
    except BlockingIOError:raise SystemExit('A worker is already running')
    signal.signal(signal.SIGTERM,stop);signal.signal(signal.SIGINT,stop)
    interval=max(3,int(config.get('POLL_SECONDS','5')))
    log('worker_started',poll_seconds=interval,lane=args.lane)
    try:
        while not STOP:
            try:
                job=db.rpc('claim',{'state':'idle','lane':args.lane})
                if job:
                    run_job(db,job,config)
                if args.once:
                    break
                time.sleep(interval)
            except Exception as e:
                log('connection_error',error=str(e));
                if args.once:raise
                time.sleep(min(30,interval*3))
    finally:
        try:db.rpc('heartbeat',{'state':'offline'})
        except Exception:pass
        log('worker_stopped')

if __name__=='__main__':
    main()
