"""Dormant service-worker and controller wiring for the confined Jammy preflight."""
import base64
import json
import os
import re
import select
import socket
import struct
import sys
import time
from dataclasses import replace
from pathlib import Path

# The unit uses isolated Python. Import only from this reviewed source bundle.
if __name__ == "__main__":
    sys.path.insert(0, str(Path(__file__).resolve().parent))

from jammy_confined_preflight import namespace_ids, verify_runtime_output
from jammy_native_runtime_inputs import LISTING_LIMIT, bind_member_bytes, load_plan, require, verify_inventory
from jammy_preflight_custody import CustodyBinding
from jammy_preflight_launcher import (
    admit_owned_unit, arm_watchdog, attest_service_peer, compare_with_positive_controls, exec_loader_worker,
    finish_watchdog, read_lease, recover, run_denial_worker,
)
from jammy_preflight_supervisor import (
    PreflightFailure, Run, Scope, TrackedProcess, attest_worker_root, bounded_command, control_write,
    load_supervisor_plan, read_control, read_private_root, verify_denials, verify_limits,
    verify_pidfds_gone, verify_root, verify_run,
)

REQUEST_BYTES = 8 * 1024 * 1024
RESPONSE_BYTES = 64 * 1024
SOURCE = Path(__file__).resolve()
CGROUP_ROOT = Path("/sys/fs/cgroup")
NATIVE_ENABLED = False


def encode(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":")).encode("ascii")


def pack(data):
    return base64.b64encode(data).decode("ascii")


def unpack(value):
    return base64.b64decode(value, validate=True)


def receive_exact(channel, size, deadline):
    data = bytearray()
    while len(data) < size:
        remaining = deadline - time.monotonic()
        require(remaining > 0, "LAUNCH_CHANNEL_DEADLINE")
        channel.settimeout(remaining)
        part = channel.recv(min(65536, size - len(data)))
        require(part, "LAUNCH_CHANNEL_EOF")
        data.extend(part)
    return bytes(data)


def receive(channel, maximum, deadline):
    size, = struct.unpack("!I", receive_exact(channel, 4, deadline))
    require(0 < size <= maximum, "LAUNCH_CHANNEL_SIZE")
    return json.loads(receive_exact(channel, size, deadline))


def transmit(channel, value, maximum, deadline):
    data = encode(value)
    require(0 < len(data) <= maximum, "LAUNCH_CHANNEL_SIZE")
    remaining = deadline - time.monotonic()
    require(remaining > 0, "LAUNCH_CHANNEL_DEADLINE")
    channel.settimeout(remaining)
    channel.sendall(struct.pack("!I", len(data)) + data)


def channel_name(scope):
    return "\0sl-native-control-" + scope.nonce


def peer_pid(channel):
    pid, uid, _ = struct.unpack("3i", channel.getsockopt(socket.SOL_SOCKET, socket.SO_PEERCRED, 12))
    require(pid > 1 and uid == os.geteuid() == 1001, "LAUNCH_CHANNEL_PEER")
    return pid


def open_directory(path):
    require(path.resolve(strict=True) == path, "LAUNCH_CGROUP_PATH")
    return os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_DIRECTORY | os.O_CLOEXEC)


def write_cgroup(path, name, data):
    fd = open_directory(path)
    try:
        control_write(fd, name, data)
    finally:
        os.close(fd)


def delegate_service(scope):
    pid = os.getpid()
    verify_limits(scope.run, pid)
    group = CGROUP_ROOT / scope.run.cgroup.lstrip("/")
    worker = group / "preflight-worker"
    worker.mkdir()
    write_cgroup(worker, "cgroup.procs", f"{pid}\n".encode("ascii"))
    write_cgroup(group, "cgroup.subtree_control", b"+memory +pids\n")
    require({"memory", "pids"} <= set(read_control(group, "cgroup.subtree_control").split()),
            "LAUNCH_CGROUP_DELEGATION")
    verify_limits(scope.run, pid, "preflight-worker")
    for name in ("preflight-source", "preflight-target"):
        (group / name).mkdir()
    return group


def build_request(receipt, members):
    inputs = load_plan()
    verify_inventory(inputs, receipt)
    bind_member_bytes(inputs, members)
    return {"receipt": pack(receipt), "members": {name: pack(data) for name, data in members.items()}}


def verify_request(value):
    require(type(value) is dict and set(value) == {"receipt", "members"} and type(value["members"]) is dict,
            "LAUNCH_REQUEST_FIELDS")
    inputs = load_plan()
    require(value["members"].keys() == inputs["members"].keys(), "LAUNCH_REQUEST_MEMBERS")
    receipt = unpack(value["receipt"])
    verify_inventory(inputs, receipt)
    members = {name: unpack(data) for name, data in value["members"].items()}
    bind_member_bytes(inputs, members)
    return receipt, members


def worker_child(wrapper_pid):
    location = Path("/proc") / str(wrapper_pid) / "task" / str(wrapper_pid)
    children = read_control(location, "children").split()
    require(len(children) == 1 and re.fullmatch(r"[1-9][0-9]{0,9}", children[0]),
            "LAUNCH_NAMESPACE_CHILD")
    return int(children[0])


def attest_child(scope, tracked, root_id, details, members):
    pid = tracked.pid
    fd = os.pidfd_open(pid)
    try:
        verify_limits(scope.run, pid, "preflight-worker")
        status = read_control(Path("/proc") / str(pid), "status")
        require(all(re.search(pattern, status, re.M) for pattern in (
            r"^NoNewPrivs:\s+1$", r"^Seccomp:\s+2$", r"^CapEff:\s+0+$",
        )), "LAUNCH_CHILD_KERNEL_POLICY")
        plan = load_supervisor_plan()
        root = read_private_root(pid, details["host"], scope.scratch)
        if members is None:
            probe = [row for row in root["mounts"] if row["path"] == "/probe"]
            require(len(probe) == 1 and probe[0]["type"] == "cgroup2" and
                    {"ro", "nosuid", "nodev", "noexec"} <= probe[0]["flags"] and
                    not probe[0]["propagation"], "LAUNCH_PROBE_ROOT_MOUNT")
            root["mounts"] = [row for row in root["mounts"] if row["path"] != "/probe"]
            plan["limits"] = {**plan["limits"], "privateTmpfsBytes": 1048576, "privateTmpfsInodes": 32}
            proc_root = Path("/proc") / str(pid) / "root"
            info, target = proc_root.stat(), (proc_root / "probe").stat()
            require((info.st_dev, info.st_ino) == root_id and
                    (target.st_dev, target.st_ino) == tuple(details["identity"]) and
                    set(os.listdir(proc_root)) == {"probe", "proc"}, "LAUNCH_PROBE_ROOT_ATTESTATION")
        else:
            attest_worker_root(pid, fd, root_id, bind_member_bytes(load_plan(), members))
        verify_root(root, plan, executable=members is not None)
    finally:
        os.close(fd)


def child_command(scope, mode, details, timeout):
    import fcntl

    raw = encode(details)
    require(mode in ("denials", "listing", "version") and 0 < len(raw) <= REQUEST_BYTES,
            "LAUNCH_CHILD_REQUEST")
    fd = os.memfd_create("sl-native-input", os.MFD_CLOEXEC | os.MFD_ALLOW_SEALING)
    owned_fds = {fd}
    tracked = None
    try:
        members = None if mode == "denials" else verify_request(details["request"])[1]
        ack_read, ack_write = os.pipe2(os.O_CLOEXEC)
        owned_fds.update((ack_read, ack_write))
        permit_read, permit_write = os.pipe2(os.O_CLOEXEC)
        owned_fds.update((permit_read, permit_write))
        child_barrier = (ack_write, permit_read)
        details = {**details, "barrier": child_barrier}
        raw = encode(details)
        require(len(raw) <= REQUEST_BYTES, "LAUNCH_CHILD_REQUEST")

        def before_capture(wrapper_pid, deadline):
            nonlocal tracked
            for descriptor in child_barrier:
                owned_fds.remove(descriptor)
                os.close(descriptor)

            def receive_ack(maximum):
                remaining = deadline - time.monotonic()
                require(remaining > 0 and select.select([ack_read], [], [], remaining)[0] == [ack_read],
                        "LAUNCH_ROOT_BARRIER_TIMEOUT")
                return os.read(ack_read, maximum)

            require(receive_ack(1) == b"R", "LAUNCH_STAGE_BARRIER")
            pid = worker_child(wrapper_pid)
            pidfd = os.pidfd_open(pid)
            try:
                tracked = TrackedProcess(pid, pidfd)
                verify_limits(scope.run, pid, "preflight-worker")
            finally:
                os.close(pidfd)
            require(deadline > time.monotonic() and os.write(permit_write, b"S") == 1, "LAUNCH_STAGE_PERMIT")
            match = re.fullmatch(rb"([1-9][0-9]{0,19}):([1-9][0-9]{0,19})\n", receive_ack(128))
            require(match is not None and worker_child(wrapper_pid) == pid, "LAUNCH_ROOT_BARRIER_IDENTITY")
            attest_child(scope, tracked, (int(match[1]), int(match[2])), details, members)
            require(deadline > time.monotonic() and os.write(permit_write, b"G") == 1,
                    "LAUNCH_ROOT_BARRIER_PERMIT")

        require(os.write(fd, raw) == len(raw), "LAUNCH_CHILD_INPUT")
        fcntl.fcntl(fd, fcntl.F_ADD_SEALS, fcntl.F_SEAL_SEAL | fcntl.F_SEAL_SHRINK |
                    fcntl.F_SEAL_GROW | fcntl.F_SEAL_WRITE)
        os.lseek(fd, 0, os.SEEK_SET)
        command = ["/usr/bin/unshare", "--user", "--map-current-user", "--keep-caps", "--mount",
                   "--pid", "--fork", "--kill-child=KILL", "--net", "--cgroup", "--",
                   "/usr/bin/python3", "-IB", str(SOURCE), scope.run.source, str(scope.run.run_id),
                   "1", scope.nonce, mode, *scope.custody.arguments(), str(fd)]
        result = bounded_command(command, timeout=timeout, pass_fds=(fd, *child_barrier),
                                 before_capture=before_capture)
        require(tracked is not None and verify_pidfds_gone([tracked], 1), "LAUNCH_NAMESPACE_CHILD_STILL_LIVE")
        return result
    finally:
        if tracked is not None:
            tracked.release()
        for descriptor in owned_fds:
            os.close(descriptor)


def drive_denials(scope, lease, group, deadline):
    read_fd, write_fd = os.pipe2(os.O_CLOEXEC)
    pid = None
    try:
        pid = os.fork()
        if pid == 0:
            try:
                os.close(write_fd)
                os.read(read_fd, 1)
            finally:
                os._exit(0)
        os.close(read_fd)
        read_fd = None
        pidfd = os.pidfd_open(pid)
        try:
            write_cgroup(group / "preflight-source", "cgroup.procs", f"{pid}\n".encode("ascii"))

            def private_probe(scope, lease, host_ns, target, identity):
                remaining = min(3, deadline - time.monotonic())
                require(remaining > 0, "LAUNCH_CHILD_DEADLINE")
                status, out, err = child_command(scope, "denials", {"host": host_ns, "target": str(target),
                                                                   "identity": identity}, remaining)
                require(status == 0 and not err, "LAUNCH_DENIAL_CHILD")
                return json.loads(out)

            proof = compare_with_positive_controls(scope, lease, os.getpid(), pid, pidfd, private_probe)
        finally:
            os.close(pidfd)
    finally:
        if read_fd is not None:
            os.close(read_fd)
        os.close(write_fd)
        if pid:
            try:
                os.waitpid(pid, os.WNOHANG)
            except ChildProcessError:
                pass  # The positive control already reaped its own child.
    for name in ("preflight-source", "preflight-target"):
        (group / name).rmdir()
    return proof


def service(scope, controller):
    lease = read_lease(scope)
    deadline = time.monotonic() + 11
    group = delegate_service(scope)
    with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as channel:
        channel.settimeout(2)
        channel.connect(channel_name(scope))
        require(peer_pid(channel) == controller, "LAUNCH_CONTROLLER_PEER")
        transmit(channel, {"ready": os.getpid()}, RESPONSE_BYTES, deadline)
        request = receive(channel, REQUEST_BYTES, deadline)
        receipt, _ = verify_request(request)
        denials = drive_denials(scope, lease, group, deadline)
        verify_denials(denials)
        outputs = []
        for mode in ("listing", "version"):
            verify_limits(scope.run, os.getpid(), "preflight-worker")
            remaining = min(2, deadline - time.monotonic())
            require(remaining > 0, "LAUNCH_CHILD_DEADLINE")
            result = child_command(scope, mode, {"host": namespace_ids(), "request": request}, remaining)
            outputs.append(result)
        verify_runtime_output(receipt, *outputs[0], *outputs[1])
        verify_limits(scope.run, os.getpid(), "preflight-worker")
        transmit(channel, {"denials": denials, "commands": [[code, pack(out), pack(err)]
                                                           for code, out, err in outputs]},
                 RESPONSE_BYTES, deadline)


def read_child_input(fd):
    import fcntl

    seals = fcntl.F_SEAL_SEAL | fcntl.F_SEAL_SHRINK | fcntl.F_SEAL_GROW | fcntl.F_SEAL_WRITE
    with os.fdopen(fd, "rb") as stream:
        require(fcntl.fcntl(stream, fcntl.F_GET_SEALS) & seals == seals, "LAUNCH_CHILD_SEALS")
        raw = stream.read(REQUEST_BYTES + 1)
    require(0 < len(raw) <= REQUEST_BYTES, "LAUNCH_CHILD_REQUEST")
    return json.loads(raw)


def namespace_child(scope, mode, fd):
    lease = read_lease(scope)
    value = read_child_input(fd)
    barrier = value.get("barrier")
    require(type(barrier) is list and len(barrier) == 2 and
            all(type(item) is int and item >= 3 and item != fd for item in barrier) and
            barrier[0] != barrier[1], "LAUNCH_LOADER_BARRIER")
    if mode == "denials":
        require(set(value) == {"host", "target", "identity", "barrier"}, "LAUNCH_DENIAL_CHILD_FIELDS")
        proof = run_denial_worker(scope, lease, value["host"], Path(value["target"]),
                                  tuple(value["identity"]), tuple(barrier))
        os.write(1, encode(proof))
    else:
        require(mode in ("listing", "version") and set(value) == {"host", "request", "barrier"},
                "LAUNCH_LOADER_MODE")
        receipt, members = verify_request(value["request"])
        exec_loader_worker(scope, lease, value["host"], receipt, members, int(mode == "version"), tuple(barrier))


def controller(scope, expected_source, receipt, members, tracking, runner_image, runner_temp):
    """Held workflow integration point. No remote acquisition or publication."""
    require(NATIVE_ENABLED is True, "LAUNCH_ACTION_NOT_AUTHORIZED")
    verify_run(scope.run, expected_source)
    require(type(scope.custody) is CustodyBinding and
            scope.run.unit_nonce in (None, scope.nonce) and re.fullmatch(r"[a-f0-9]{32}", scope.nonce),
            "LAUNCH_UNIT_NONCE")
    scope = Scope(replace(scope.run, unit_nonce=scope.nonce), scope.nonce, custody=scope.custody)
    plan = load_supervisor_plan()
    expected = plan["runner"]
    host = os.uname()
    require(host.sysname == "Linux" and host.machine == expected["architecture"] and
            host.release == expected["kernel"] and os.geteuid() == expected["uid"] and
            runner_image == expected["image"], "LAUNCH_RUNNER")
    runtime = os.statvfs(scope.scratch.parent)
    free = os.statvfs(runner_temp)
    require(runtime.f_bavail * runtime.f_frsize >= plan["limits"]["hostScratchBytes"] and
            free.f_bavail * free.f_frsize >=
            plan["limits"]["hostScratchBytes"] + plan["limits"]["minimumHostFreeBytesAfterScratch"],
            "LAUNCH_FREE_SPACE")
    request = build_request(receipt, members)
    with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as listener:
        listener.bind(channel_name(scope))
        listener.listen(1)
        watchdog = arm_watchdog(scope, SOURCE, tracking, timeout=2)
        lease = watchdog.lease
        primary = None
        output = None
        try:
            admit_owned_unit(scope, lease, watchdog)
            listener.settimeout(5)
            with listener.accept()[0] as channel:
                pid = peer_pid(channel)
                deadline = time.monotonic() + 12
                require(receive(channel, RESPONSE_BYTES, deadline) == {"ready": pid}, "LAUNCH_WORKER_READY")
                scope.owned.invocation = attest_service_peer(scope, lease, pid, timeout=2)
                verify_limits(scope.run, pid, "preflight-worker")
                transmit(channel, request, REQUEST_BYTES, deadline)
                response = receive(channel, RESPONSE_BYTES, deadline)
                require(type(response) is dict and set(response) == {"denials", "commands"} and
                        type(response["commands"]) is list and len(response["commands"]) == 2,
                        "LAUNCH_RESULT_FIELDS")
                verify_denials(response["denials"])
                commands = [(code, unpack(out), unpack(err)) for code, out, err in response["commands"]]
                require(all(len(out) <= LISTING_LIMIT and len(err) <= LISTING_LIMIT for _, out, err in commands),
                        "LAUNCH_RESULT_SIZE")
                output = verify_runtime_output(receipt, *commands[0], *commands[1])
        except BaseException as error:
            primary = error
        try:
            require(recover(scope, lease) is True, "LAUNCH_RECOVERY_UNVERIFIED")
        except BaseException as error:
            if watchdog is not None:
                finish_watchdog(watchdog, cleanup_verified=False)
            raise PreflightFailure(primary, [("passive_recovery", error)]) from error
        if watchdog is not None:
            try:
                finish_watchdog(watchdog, cleanup_verified=True)
            except BaseException as error:
                raise PreflightFailure(primary, [("watchdog_retirement", error)]) from error
        if primary is not None:
            raise primary
    return {"kind": "PREFLIGHT_DIAGNOSTIC_ONLY", "source": scope.run.source, "run": scope.run.run_id,
            "attempt": scope.run.attempt, "loader": output, "cleanupVerified": True,
            "qualification": False, "externalIsolationProved": False, "reuseAuthorized": False}


def main(args):
    require(NATIVE_ENABLED is True, "LAUNCH_ACTION_NOT_AUTHORIZED")
    require(len(args) in (9, 10) and re.fullmatch(r"[a-f0-9]{40}", args[0]) and
            re.fullmatch(r"[1-9][0-9]{0,14}", args[1]) and args[2] == "1" and
            re.fullmatch(r"[a-f0-9]{32}", args[3]) and
            all(re.fullmatch(r"[1-9][0-9]{0,19}", value) for value in args[5:9]) and
            os.geteuid() == 1001, "LAUNCH_WORKER_ARGS")
    source, run_id, _, nonce, mode = args[:5]
    run = Run(source, source, int(run_id), 1, "Kgray44", "Kgray44", "Kgray44/treasurehuntSoT",
              "refs/heads/main", "workflow_dispatch", "confined-loader-and-denials-only", nonce)
    scope = Scope(run, nonce, custody=CustodyBinding.from_values([int(value) for value in args[5:9]]))
    verify_run(run, source)
    if len(args) == 9:
        require(re.fullmatch(r"[1-9][0-9]{0,9}", mode) and int(mode) > 1, "LAUNCH_CONTROLLER_PID")
        service(scope, int(mode))
    else:
        require(re.fullmatch(r"[1-9][0-9]{0,5}", args[9]) and int(args[9]) >= 3, "LAUNCH_CHILD_FD")
        namespace_child(scope, mode, int(args[9]))


if __name__ == "__main__":
    try:
        main(sys.argv[1:])
    except (OSError, ValueError, KeyError, TypeError) as error:
        reason = str(error)
        raise SystemExit(reason if re.fullmatch(r"(?:LAUNCH|PREFLIGHT|RUNTIME_INPUT)_[A-Z_]+", reason)
                         else "LAUNCH_WORKER_REFUSED") from None
