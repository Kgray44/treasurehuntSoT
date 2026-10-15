"""Creation-bound Linux subreaper. stdin EOF ends the parent's ownership lease."""
import ctypes
import json
import os
import signal
import subprocess
import sys
import threading
import time


def identity(pid):
    try:
        with open(f"/proc/{pid}/stat", encoding="utf8") as source:
            text = source.read()
        fields = text[text.rfind(")") + 2:].split()
        return {"pid": pid, "ppid": int(fields[1]), "birth": fields[19], "state": fields[0]}
    except (FileNotFoundError, ProcessLookupError):
        return None


def direct_children():
    # The live guardian PID cannot be reused. Never join ancestry through
    # stale numeric intermediate parent IDs.
    owned = []
    for entry in os.listdir("/proc"):
        if entry.isdigit():
            item = identity(int(entry))
            if item and item["ppid"] == os.getpid():
                owned.append(item)
    return owned


def send(item, requested_signal):
    # The fd pins kernel identity before the birth check; PID reuse between
    # checking procfs and sending the signal cannot target an unrelated process.
    try:
        descriptor = os.pidfd_open(item["pid"])
        try:
            current = identity(item["pid"])
            if current and current["birth"] == item["birth"] and current["ppid"] == os.getpid():
                signal.pidfd_send_signal(descriptor, requested_signal)
        finally:
            os.close(descriptor)
    except ProcessLookupError:
        pass


def main():
    # Fail before launching work unless both ownership and identity primitives
    # are supported. The guardian remains the ancestor of every owned payload.
    if ctypes.CDLL(None, use_errno=True).prctl(36, 1, 0, 0, 0) != 0:
        raise RuntimeError("SUBREAPER_UNAVAILABLE")
    if not hasattr(os, "pidfd_open") or not hasattr(signal, "pidfd_send_signal"):
        raise RuntimeError("PIDFD_UNAVAILABLE")
    config = json.loads(sys.stdin.readline())
    stopped = threading.Event()
    signal.signal(signal.SIGTERM, lambda *_: stopped.set())
    signal.signal(signal.SIGINT, lambda *_: stopped.set())
    # Popen's exec-error pipe is bounded by the outer supervisor. The child
    # inherits this already established subreaper ancestry before it can fork.
    child = subprocess.Popen([config["command"], *config["args"]], stdin=subprocess.DEVNULL)
    threading.Thread(target=lambda: (sys.stdin.readline(), stopped.set()), daemon=True).start()
    while child.poll() is None and not stopped.wait(0.02):
        pass
    original_code = child.poll()
    began = time.monotonic()
    escalated = False
    error = False

    def remaining():
        # Kernel ECHILD proves that neither live nor zombie adopted children
        # remain. An empty procfs snapshot alone is not a completion condition.
        while True:
            try:
                pid, status = os.waitpid(-1, os.WNOHANG)
                if pid == 0:
                    return direct_children(), True
                if pid == child.pid:
                    child.returncode = os.waitstatus_to_exitcode(status)
            except ChildProcessError:
                return [], False

    try:
        graceful_end = began + config.get("gracefulMs", 2000) / 1000
        sent = set()
        while True:
            owned, has_children = remaining()
            if not has_children:
                break
            for item in reversed(owned):
                key = (item["pid"], item["birth"])
                if key not in sent:
                    send(item, signal.SIGTERM)
                    sent.add(key)
            if time.monotonic() >= graceful_end:
                break
            time.sleep(0.02)
        force_end = time.monotonic() + config.get("forceMs", 3000) / 1000
        while True:
            owned, has_children = remaining()
            if not has_children:
                break
            escalated = True
            for item in reversed(owned):
                send(item, signal.SIGKILL)
            if time.monotonic() >= force_end:
                break
            time.sleep(0.01)
        _, has_children = remaining()
        reaped = not has_children
    except Exception:
        error = True
        reaped = False
    receipt = {"treeReaped": reaped, "terminated": escalated, "verificationFailed": error,
               "payloadExitCode": child.returncode, "payloadPid": child.pid, "cleanupMs": round((time.monotonic() - began) * 1000)}
    with open(config["receiptPath"], "w", encoding="utf8") as target:
        json.dump(receipt, target)
    if not reaped or error:
        return 1
    return original_code if original_code is not None and original_code >= 0 else 1


try:
    sys.exit(main())
except Exception:
    # Launch arguments, environment values and exception text are never logged.
    print("SOUNDING_LINE_LINUX_SUBREAPER_FAILURE", file=sys.stderr)
    sys.exit(1)
