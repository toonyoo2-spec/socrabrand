import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import worker

class FakeDB:
    def __init__(self): self.calls = []
    def rpc(self, op, args=None):
        self.calls.append((op, args))
        return None

class WorkerTests(unittest.TestCase):
    def test_credentials_do_not_reach_model_process(self):
        with patch.dict(os.environ, {'OPENAI_API_KEY':'secret', 'AGENCY_WORKER_TOKEN':'token', 'PATH':'keep'}):
            env = worker.model_environment()
            self.assertNotIn('OPENAI_API_KEY', env)
            self.assertNotIn('AGENCY_WORKER_TOKEN', env)
            self.assertEqual(env['PATH'], 'keep')

    def execute_fake(self, final, exit_code=0):
        db = FakeDB()
        job = {'id':'test-job','kind':'test'}
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            executable = root / 'fake-codex'
            executable.write_text('#!/usr/bin/env python3\nimport sys\nfrom pathlib import Path\n'
                + ('Path(sys.argv[sys.argv.index("--output-last-message")+1]).write_text('+repr(final)+')\n' if final is not None else '')
                + f'sys.exit({exit_code})\n')
            executable.chmod(0o700)
            with patch.object(worker, 'RUNTIME', root / 'runtime'):
                result = worker.run_job(db, job, {'CODEX_BIN':str(executable)})
        self.assertEqual([op for op, _ in db.calls].count('finish'), 1)
        return result

    def test_saved_result_is_required(self):
        self.assertEqual(self.execute_fake(None)['status'], 'blocked')

    def test_malformed_result_is_blocked(self):
        self.assertEqual(self.execute_fake('{bad json')['status'], 'blocked')

    def test_partial_failure_is_not_success(self):
        final = json.dumps({'status':'done','summary':'saved'})
        self.assertEqual(self.execute_fake(final, 1)['status'], 'blocked')

    def test_verified_final_result_can_complete(self):
        final = json.dumps({'status':'done','summary':'read-only test completed'})
        self.assertEqual(self.execute_fake(final)['status'], 'done')

if __name__ == '__main__': unittest.main()
