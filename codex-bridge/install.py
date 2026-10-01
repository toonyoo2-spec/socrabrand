"""Install the prepared local worker after production pairing is verified."""
import argparse
import os
from pathlib import Path
import plistlib
import subprocess
import sys
from client import ROOT

LABEL = 'com.kwan.agency-codex'

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--install', action='store_true')
    args = parser.parse_args()
    runtime = ROOT / 'runtime'
    runtime.mkdir(mode=0o700, exist_ok=True)
    spec = {
        'Label': LABEL,
        'ProgramArguments': [sys.executable, str(ROOT / 'worker.py')],
        'WorkingDirectory': str(ROOT),
        'RunAtLoad': True,
        'KeepAlive': True,
        'ThrottleInterval': 30,
        'ProcessType': 'Background',
        'StandardOutPath': str(runtime / 'worker.log'),
        'StandardErrorPath': str(runtime / 'worker-error.log'),
        'EnvironmentVariables': {'PATH': '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin'},
    }
    target = Path.home() / 'Library' / 'LaunchAgents' / (LABEL + '.plist')
    if not args.install:
        preview = runtime / (LABEL + '.plist')
        preview.write_bytes(plistlib.dumps(spec))
        print('Prepared:', preview)
        return
    # Never start a service which has not been paired successfully.
    subprocess.run([sys.executable, str(ROOT / 'worker.py'), '--check'], check=True)
    target.parent.mkdir(parents=True, exist_ok=True)
    domain = f'gui/{os.getuid()}'
    if target.exists():
        subprocess.run(['launchctl', 'bootout', domain, str(target)], check=False)
    target.write_bytes(plistlib.dumps(spec))
    target.chmod(0o600)
    subprocess.run(['launchctl', 'bootstrap', domain, str(target)], check=True)
    print('Installed:', target)

if __name__ == '__main__':
    main()
