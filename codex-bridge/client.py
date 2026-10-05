"""Credential-free tool interface to the scoped Supabase worker RPC."""
import json
import os
from pathlib import Path
import urllib.request
import urllib.error

ROOT = Path(__file__).resolve().parent

def settings():
    values = {}
    env_file = ROOT / '.env'
    if env_file.exists():
        if env_file.stat().st_mode & 0o077:
            raise RuntimeError('.env permissions must be 0600')
        for line in env_file.read_text().splitlines():
            if line and not line.startswith('#') and '=' in line:
                k, v = line.split('=', 1)
                values[k.strip()] = v.strip()
    for k in ('SUPABASE_URL', 'SUPABASE_ANON_KEY', 'AGENCY_WORKER_TOKEN', 'CODEX_BIN', 'CLAUDE_BIN', 'CLAUDE_MODEL', 'POLL_SECONDS', 'JOB_TIMEOUT_SECONDS'):
        if k in os.environ:
            values[k] = os.environ[k]
    url = values.get('SUPABASE_URL', '')
    if url != 'https://eoljasmgogdcvnytaoax.supabase.co':
        raise RuntimeError('Only the existing socrabrand project is supported')
    if not values.get('SUPABASE_ANON_KEY') or not values.get('AGENCY_WORKER_TOKEN'):
        raise RuntimeError('Bridge is not paired; run setup before starting')
    return values

class Database:
    def __init__(self, config=None):
        self.config = config or settings()

    def rpc(self, operation, args=None):
        c = self.config
        body = json.dumps({'p_token': c['AGENCY_WORKER_TOKEN'], 'p_op': operation, 'p_args': args or {}}).encode()
        req = urllib.request.Request(c['SUPABASE_URL'] + '/rest/v1/rpc/agency_codex_rpc', body,
              {'apikey': c['SUPABASE_ANON_KEY'], 'Authorization': 'Bearer ' + c['SUPABASE_ANON_KEY'], 'Content-Type': 'application/json'})
        try:
            with urllib.request.urlopen(req, timeout=30) as response:
                return json.load(response)
        except urllib.error.HTTPError as e:
            # PostgREST sometimes echoes query arguments. Do not log raw error bodies.
            raw = e.read().decode(errors='replace')
            for secret in (c['AGENCY_WORKER_TOKEN'], c['SUPABASE_ANON_KEY']):
                raw = raw.replace(secret, '[redacted]')
            try:
                message = json.loads(raw).get('message', 'request rejected')
            except ValueError:
                message = 'request rejected'
            raise RuntimeError(f'Supabase HTTP {e.code}: {message}') from None
