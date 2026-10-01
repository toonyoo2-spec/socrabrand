"""One local Codex process at a time; no inference API keys or idle model calls."""
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
    return ('Read OPERATING.md before doing anything. This is a KWAN-authorized Agency job. '
            'Use the connected Supabase plugin for Agency DB rows and connected Notion/Figma/Slack tools only within OPERATING.md. '
            'Read current spec_codex, spec_senior and reference_policy through the database, then the assigned active agent guideline, self, skill and study. '
            'Follow senior_role and execution_contract. Verify, produce real outputs, review outcomes and apply relevant references from Pinterest, YouTube, Instagram and role communities. '
            'Use legacy spec_morning/spec_night only for needed compatible data formats. Never use an external model API. '
            'Do not operate on socraauto blog/cardnews pipelines, change server configuration, create schedules, '
            'spawn unrelated chats, or read .env/runtime credential files. '
            'For source IDs cast integer IDs to numbers in exact JSON filters; meeting IDs remain strings. '
            'Do not claim output success before reading back the saved result. '
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
    parser=argparse.ArgumentParser();parser.add_argument('--once',action='store_true');parser.add_argument('--check',action='store_true')
    args=parser.parse_args();config=settings();db=Database(config)
    RUNTIME.mkdir(mode=0o700,parents=True,exist_ok=True)
    lock=(RUNTIME/'worker.lock').open('a')
    try:fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
    except BlockingIOError:raise SystemExit('A worker is already running')
    signal.signal(signal.SIGTERM,stop);signal.signal(signal.SIGINT,stop)
    if args.check:
        db.rpc('heartbeat',{'state':'ready'})
        print(json.dumps(db.rpc('health'),ensure_ascii=False));return
    interval=max(3,int(config.get('POLL_SECONDS','5')))
    log('worker_started',poll_seconds=interval)
    try:
        while not STOP:
            try:
                job=db.rpc('claim',{'state':'idle'})
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
