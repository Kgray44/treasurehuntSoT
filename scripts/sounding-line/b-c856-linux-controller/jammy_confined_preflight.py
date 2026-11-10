"""Narrow denial checks for the Jammy private runtime; no standalone launcher."""
import ctypes
import errno
import os
import re
import socket
import stat

from jammy_native_runtime_inputs import load_plan, require, verify_inventory, verify_loader_listing

MANAGER_ENDPOINTS = ("/run/user/1001/bus", "/run/user/1001/systemd/private")
CONTROLS = ("cgroup.procs", "cgroup.threads", "cgroup.subtree_control", "memory.swap.max",
            "memory.max", "pids.max")
# Linux x86_64 only. Modern filesystem API probes have valid filesystem names.
FSOPEN = 430
UNSHARE = 272
CLONE3 = 435
CLONE_NEWCGROUP = 0x02000000
CLONE_INTO_CGROUP = 0x200000000
NAMESPACES = ("user", "mnt", "pid", "net", "cgroup")
ABSENT = {errno.ENOENT}
EXPECTED_VERSION_OUTPUT = b"bubblewrap 0.12.0\n"


def namespace_ids():
    return {name: os.stat("/proc/self/ns/" + name).st_ino for name in NAMESPACES}


def denied(operation, expected, code):
    try:
        operation()
    except OSError as error:
        require(error.errno in expected, code + "_UNEXPECTED_ERRNO")
        return errno.errorcode[error.errno]
    raise ValueError(code + "_SUCCEEDED")


def connect(endpoint):
    client = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    try:
        client.settimeout(0.25)
        client.connect(endpoint)
    finally:
        try:
            client.close()
        except OSError:
            raise ValueError("PREFLIGHT_SOCKET_CLEANUP") from None


def close_descriptor(fd):
    try:
        os.close(fd)
    except OSError:
        raise ValueError("PREFLIGHT_DESCRIPTOR_CLEANUP") from None


def open_control(path, flags):
    fd = os.open(path, flags | os.O_NOFOLLOW | os.O_NONBLOCK | os.O_CLOEXEC)
    try:
        return os.fstat(fd).st_mode
    finally:
        close_descriptor(fd)


def fresh_cgroup_mount_attempt(libc, target):
    status = libc.mount(b"none", target, b"cgroup2", 0, None)
    if status == 0:
        # A successful attack invalidates the probe. Undo only its own mount.
        require(libc.umount2(target, 2) == 0, "PREFLIGHT_CGROUP_MOUNT_CLEANUP")
        return
    number = ctypes.get_errno()
    raise OSError(number, os.strerror(number))


def syscall(libc, number, *arguments):
    result = libc.syscall(number, *arguments)
    if result == -1:
        number = ctypes.get_errno()
        raise OSError(number, os.strerror(number))
    return result


def fsopen_attempt(libc):
    fd = syscall(libc, FSOPEN, b"cgroup2", 0)
    close_descriptor(fd)


def clone_policy_attempt(libc, private_fd):
    # The plain private directory intentionally cannot be a valid migration
    # target. This checks syscall policy only, even when it returns EPERM.
    args = (ctypes.c_uint64 * 11)()
    args[0] = CLONE_INTO_CGROUP
    args[4] = 17  # SIGCHLD
    args[10] = private_fd
    pid = syscall(libc, CLONE3, ctypes.byref(args), ctypes.sizeof(args))
    if pid == 0:
        os._exit(97)
    try:
        reaped, _ = os.waitpid(pid, 0)
    except OSError:
        raise ValueError("PREFLIGHT_MIGRATION_CLEANUP") from None
    require(reaped == pid, "PREFLIGHT_MIGRATION_CLEANUP")


def validate_control_directory(path):
    require(re.fullmatch(r"/sys/fs/cgroup/user\.slice/user-1001\.slice/"
                         r"user@1001\.service/(?:app\.slice/)?"
                         r"sounding-line-native-preflight-[1-9][0-9]{0,14}\.service", path),
            "PREFLIGHT_CONTROL_PATH")


def validate_targets(path, abstract_endpoint):
    validate_control_directory(path)
    require(type(abstract_endpoint) is str and
            re.fullmatch(r"\x00sounding-line-native-preflight-[a-f0-9]{32}", abstract_endpoint),
            "PREFLIGHT_ABSTRACT_ENDPOINT")


def observe_host_controls(path, abstract_endpoint):
    """Trusted parent, before crossing into the private namespaces."""
    validate_targets(path, abstract_endpoint)
    for endpoint in (*MANAGER_ENDPOINTS, abstract_endpoint):
        connect(endpoint)
    for name in CONTROLS:
        mode = open_control(path + "/" + name, os.O_RDONLY)
        require(stat.S_ISREG(mode), "PREFLIGHT_CONTROL_TYPE")
    return namespace_ids()


def probe_denials(path, abstract_endpoint, host_ids):
    """Trusted worker after chroot, capability drop, FD cleanup and seccomp.

    The controller must call observe_host_controls itself. This function never
    treats fixture data or its own return value as external isolation evidence.
    """
    validate_targets(path, abstract_endpoint)
    private_ids = namespace_ids()
    require(set(host_ids) == set(private_ids) == set(NAMESPACES) and
            all(type(host_ids[name]) is int and private_ids[name] != host_ids[name]
                for name in private_ids), "PREFLIGHT_NAMESPACE_IDENTITY")
    require(os.uname().machine == "x86_64", "PREFLIGHT_ARCHITECTURE")
    require(set(os.listdir("/proc/self/fd")) <= {"0", "1", "2", "3"}, "PREFLIGHT_FD_LIST")
    # listdir itself uses fd 3. Distinguish that from a persistent descriptor.
    denied(lambda: os.fstat(3), {errno.EBADF}, "PREFLIGHT_INHERITED_FD")
    require(os.getpid() > 1, "PREFLIGHT_PID_BOUNDARY")

    result = {endpoint: denied(lambda: connect(endpoint), ABSENT, "PREFLIGHT_MANAGER")
              for endpoint in MANAGER_ENDPOINTS}
    result["abstractManager"] = denied(lambda: connect(abstract_endpoint),
                                       {errno.ECONNREFUSED}, "PREFLIGHT_ABSTRACT_MANAGER")
    for name in CONTROLS:
        target = path + "/" + name
        result[target] = denied(lambda: open_control(target, os.O_WRONLY), ABSENT,
                                "PREFLIGHT_CGROUP_CONTROL")
    result["/proc/1/root"] = denied(lambda: os.stat("/proc/1/root"),
                                  {errno.EACCES, errno.EPERM}, "PREFLIGHT_SUPERVISOR_ROOT")
    result["/proc/1/fd"] = denied(lambda: os.listdir("/proc/1/fd"),
                                {errno.EACCES, errno.EPERM}, "PREFLIGHT_SUPERVISOR_FDS")

    libc = ctypes.CDLL(None, use_errno=True)
    libc.syscall.restype = ctypes.c_long
    result["freshCgroupMountPolicy"] = denied(lambda: fresh_cgroup_mount_attempt(libc, b"/probe"),
                                            {errno.EPERM}, "PREFLIGHT_CGROUP_MOUNT_POLICY")
    result["fsopen"] = denied(lambda: fsopen_attempt(libc), {errno.EPERM}, "PREFLIGHT_FSOPEN")
    result["unshare"] = denied(lambda: syscall(libc, UNSHARE, CLONE_NEWCGROUP), {errno.EPERM},
                               "PREFLIGHT_UNSHARE")
    fd = os.open("/probe", os.O_RDONLY | os.O_DIRECTORY | os.O_CLOEXEC | os.O_NOFOLLOW)
    try:
        result["clone3PolicyWithPrivateDirectory"] = denied(lambda: clone_policy_attempt(libc, fd),
                                                           {errno.EPERM}, "PREFLIGHT_CLONE_POLICY")
    finally:
        close_descriptor(fd)
    return result


def verify_runtime_output(inventory, listing_status, listing_stdout, listing_stderr,
                          version_status, version_stdout, version_stderr):
    require(type(listing_status) is int and type(version_status) is int and
            listing_status == version_status == 0, "PREFLIGHT_CHILD_STATUS")
    plan = load_plan()
    observed = verify_inventory(plan, inventory)
    found = verify_loader_listing(plan, observed, listing_stdout, listing_stderr)
    require(version_stdout == EXPECTED_VERSION_OUTPUT and not version_stderr, "PREFLIGHT_BWRAP_VERSION")
    return {"resolvedLibraries": found, "reportedVersion": version_stdout.decode("ascii").strip()}
