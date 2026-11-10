import io
import textwrap
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, Mock, patch

import controller
import producer_driver


CURRENT = "ghs_15368_" + "a"*88 + "." + "b"*348 + "." + "-_c"*25
ACCEPTED = ("ghs_"+"a"*36, CURRENT)
REJECTED = ("", "a"*4097, "a\r\nb", "a\rb", "a\nb", "a\tb", "a\x00b", "a\x1fb", "a\x7fb", "a b", "a\u00e9b")


class CredentialTests(unittest.TestCase):
    def test_producer_bootstrap_accepts_only_safe_header_values(self):
        workflow = Path(__file__).resolve().parents[3]/".github/workflows/sounding-line-b-c856-runtime-producer.yml"
        source = textwrap.dedent(workflow.read_text(encoding="utf-8").split("<<'PY'\n", 1)[1].split("          PY", 1)[0])
        bootstrap = compile(source, str(workflow), "exec")
        sha = "a"*40
        for token in (*ACCEPTED, *REJECTED):
            with self.subTest(accepted=token in ACCEPTED, length=len(token)):
                env = {"C856_PRODUCER_SHA": sha, "GITHUB_SHA": sha, "GITHUB_WORKFLOW_SHA": sha,
                       "C856_CHECKOUT_READ_TOKEN": token}
                client = Mock()
                client.open.side_effect = TimeoutError
                with patch("os.environ", env), patch("urllib.request.build_opener", return_value=client):
                    message = "code transfer refused" if token in ACCEPTED else "read token unavailable"
                    with self.assertRaisesRegex(SystemExit, message):
                        exec(bootstrap, {})
                if token in ACCEPTED:
                    request = client.open.call_args.args[0]
                    self.assertEqual(request.get_header("Authorization"), "Bearer "+token)
                    self.assertNotIn("C856_CHECKOUT_READ_TOKEN", env)
                else:
                    client.open.assert_not_called()

    def test_producer_pipe_and_host_admission_accept_the_same_credentials(self):
        for token in (*ACCEPTED, *REJECTED):
            with self.subTest(accepted=token in ACCEPTED, length=len(token)):
                raw = token.encode()
                with patch.object(producer_driver.sys, "stdin", SimpleNamespace(buffer=io.BytesIO(raw))):
                    if token in ACCEPTED:
                        self.assertEqual(producer_driver.read_token(), raw)
                    else:
                        with self.assertRaisesRegex(ValueError, "^PRODUCER_CHECKOUT_TOKEN$"):
                            producer_driver.read_token()
                with patch.object(producer_driver, "guard", return_value={"GITHUB_RUN_ID": "123"}), \
                     patch.object(producer_driver, "host_paths", side_effect=RuntimeError("host reached")):
                    message = "host reached" if token in ACCEPTED else "^PRODUCER_CHECKOUT_TOKEN$"
                    with self.assertRaisesRegex((RuntimeError, ValueError), message):
                        producer_driver.run_outer(b"", raw)

    def test_diagnostic_validates_before_provider_access(self):
        for token in (*ACCEPTED, *REJECTED):
            with self.subTest(accepted=token in ACCEPTED, length=len(token)):
                env = {"C856_ARTIFACT_READ_TOKEN": token}
                with patch.object(controller.os, "environ", env), \
                     patch.object(controller, "v3_bytes"), patch.object(controller, "live_space"), \
                     patch.object(controller, "write_document"), \
                     patch.object(controller, "artifact_metadata", side_effect=RuntimeError("provider reached")) as provider:
                    message = "provider reached" if token in ACCEPTED else "^CONTROLLER_ARTIFACT_TOKEN$"
                    with self.assertRaisesRegex((RuntimeError, ValueError), message):
                        controller.prepare({}, Mock(), MagicMock())
                if token in ACCEPTED:
                    provider.assert_called_once_with({}, token)
                else:
                    provider.assert_not_called()
                self.assertNotIn("C856_ARTIFACT_READ_TOKEN", env)
