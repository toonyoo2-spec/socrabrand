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

    def fake_bin(self, root, name, body):
        path = root / name
        path.write_text('#!/usr/bin/env python3\nimport sys, json\nfrom pathlib import Path\n' + body)
        path.chmod(0o700)
        return str(path)

    def run_design(self, claude_body, codex_final=None, with_claude=True):
        db = FakeDB()
        job = {'id':'design-job','kind':'duty','payload':{'runner':'claude'}}
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            codex = self.fake_bin(root, 'fake-codex', ('Path(sys.argv[sys.argv.index("--output-last-message")+1]).write_text('+repr(codex_final)+')\n') if codex_final else 'sys.exit(1)\n')
            config = {'CODEX_BIN':codex}
            if with_claude: config['CLAUDE_BIN'] = self.fake_bin(root, 'fake-claude', claude_body)
            with patch.object(worker, 'RUNTIME', root / 'runtime'):
                result = worker.run_job(db, job, config)
        self.assertEqual([op for op, _ in db.calls].count('finish'), 1)
        return result

    def test_design_job_runs_on_claude_with_opus(self):
        job = {'id':'x','kind':'duty','payload':{'runner':'claude'}}
        cmd = worker.command_for(job, Path('out.json'), {'CLAUDE_BIN':'claude'}, worker.runner_for(job, {'CLAUDE_BIN':'claude'}))
        self.assertEqual(cmd[0], 'claude')
        self.assertEqual(cmd[cmd.index('--model')+1], 'claude-opus-5-5')
        self.assertIn('--json-schema', cmd)

    def test_other_jobs_stay_on_codex(self):
        self.assertEqual(worker.runner_for({'payload':{'runner':'codex'}}, {'CLAUDE_BIN':'claude'}), 'codex')
        self.assertEqual(worker.runner_for({'payload':{}}, {'CLAUDE_BIN':'claude'}), 'codex')
        self.assertEqual(worker.runner_for({'payload':{'runner':'claude'}}, {}), 'codex')

    def test_claude_structured_result_completes(self):
        out = json.dumps({'is_error':False,'structured_output':{'status':'done','summary':'figma drafts saved'}})
        result = self.run_design('print('+repr(out)+')\n')
        self.assertEqual((result['status'], result['runner']), ('done', 'claude'))

    def test_claude_error_result_is_not_success(self):
        out = json.dumps({'is_error':True,'result':'usage limit'})
        result = self.run_design('print('+repr(out)+')\nsys.exit(1)\n')
        self.assertEqual(result['runner'], 'codex')  # 시작 직후 실패 → Codex가 이어받음
        self.assertEqual(result['status'], 'blocked')  # 가짜 Codex도 실패하면 성공으로 처리하지 않는다

    def test_claude_early_failure_falls_back_to_codex(self):
        final = json.dumps({'status':'done','summary':'codex finished'})
        result = self.run_design('sys.exit(1)\n', codex_final=final)
        self.assertEqual((result['status'], result['runner']), ('done', 'codex'))
        self.assertIn('fallback_from_claude', result)

    def test_missing_claude_uses_codex(self):
        final = json.dumps({'status':'done','summary':'codex finished'})
        result = self.run_design('', codex_final=final, with_claude=False)
        self.assertEqual(result['runner'], 'codex')

if __name__ == '__main__': unittest.main()
