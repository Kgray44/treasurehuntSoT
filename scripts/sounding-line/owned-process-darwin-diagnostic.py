"""Ephemeral macOS benchmark diagnostic. Verifies the original process group only."""
import json
import os
import signal
import subprocess
import sys
import threading
import time


def main():
    if sys.platform != "darwin" or os.environ.get("GITHUB_ACTIONS") != "true":
        raise RuntimeError("DARWIN_EPHEMERAL_PROBE_REQUIRED")
    config = json.loads(sys.stdin.readline())
    stopped = threading.Event()
    for sig in (signal.SIGTERM, signal.SIGINT):
        signal.signal(sig, lambda *_: stopped.set())
    process = subprocess.Popen([config["command"], *config["args"]],
                               start_new_session=True, stdin=subprocess.DEVNULL)
    threading.Thread(target=lambda: (sys.stdin.readline(), stopped.set()), daemon=True).start()
    while process.poll() is None and not stopped.wait(0.02):
        pass
    original_code = process.poll()
    began = time.monotonic()

    def signal_group(sig):
        try:
            os.killpg(process.pid, sig)
            return True
        except ProcessLookupError:
            return False

    def wait_for_group(ms):
        deadline = time.monotonic() + ms / 1000
        while True:
            process.poll()
            if not signal_group(0):
                return True
            if time.monotonic() >= deadline:
                return False
            time.sleep(0.02)

    graceful = not signal_group(signal.SIGTERM) or wait_for_group(config["gracefulMs"])
    reaped = graceful or not signal_group(signal.SIGKILL) or wait_for_group(config["forceMs"])
    with open(config["receiptPath"], "w", encoding="utf8") as output:
        json.dump({"treeReaped": reaped, "scope": "ORIGINAL_PROCESS_GROUP_ONLY",
                   "terminated": not graceful, "verificationFailed": not reaped,
                   "payloadExitCode": process.returncode, "payloadPid": process.pid,
                   "cleanupMs": round((time.monotonic() - began) * 1000)}, output)
    return original_code if reaped and original_code is not None and original_code >= 0 else 1


sys.exit(main())
