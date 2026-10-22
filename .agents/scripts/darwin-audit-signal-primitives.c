/* Development-only observation of an audit-token BSD signal primitive.
 * Only three finite known direct children are created. No PID signal fallback,
 * UID-wide signal, account, detached process or production guardian is used.
 */
#include <bsm/libbsm.h>
#include <dlfcn.h>
#include <errno.h>
#include <grp.h>
#include <libproc.h>
#include <mach/mach.h>
#include <mach/task_info.h>
#include <pwd.h>
#include <signal.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/utsname.h>
#include <sys/wait.h>
#include <time.h>
#include <unistd.h>

typedef int (*audit_signal_function)(audit_token_t *, int);
static const char *boolean(int value) { return value ? "true" : "false"; }

static int observed_uid_count(uid_t uid) {
  int processes[8192];
  errno = 0;
  int bytes = proc_listpids(PROC_UID_ONLY, uid, processes, sizeof(processes));
  if (bytes < 0 || errno != 0 || bytes >= (int)sizeof(processes) || bytes % (int)sizeof(int) != 0) return -1;
  return bytes / (int)sizeof(int);
}

static double monotonic_seconds(void) {
  struct timespec now;
  if (clock_gettime(CLOCK_MONOTONIC, &now) != 0) return -1;
  return (double)now.tv_sec + (double)now.tv_nsec / 1000000000.0;
}

static int observe(const char *label, uid_t uid, int platform_binary, audit_signal_function send_audit_signal) {
  double started = monotonic_seconds();
  int ready_pipe[2];
  if (pipe(ready_pipe) != 0) {
    printf("{\"case\":\"%s\",\"setupFailed\":true}", label);
    return 2; /* No child exists; primitive unobserved, direct-child cleanup vacuous. */
  }
  pid_t child = fork();
  if (child == -1) {
    close(ready_pipe[0]); close(ready_pipe[1]);
    printf("{\"case\":\"%s\",\"setupFailed\":true}", label);
    return 2;
  }
  if (child == 0) {
    close(ready_pipe[0]);
    signal(SIGALRM, SIG_DFL);
    signal(SIGTERM, SIG_DFL);
    alarm(5);
    int ready = 1;
    if (uid != 0) {
      gid_t intended_group = uid;
      ready = setgroups(1, &intended_group) == 0 && setgid(intended_group) == 0 && setuid(uid) == 0;
      gid_t groups[32];
      int group_count = getgroups(32, groups);
      ready = ready && getuid() == uid && geteuid() == uid && getgid() == intended_group
        && getegid() == intended_group && group_count >= 1 && group_count <= 32;
      for (int index = 0; ready && index < group_count; index++)
        if (groups[index] != intended_group) ready = 0;
      if (ready && setuid(0) == 0) ready = 0;
    }
    char result = ready ? 'R' : 'E';
    if (write(ready_pipe[1], &result, 1) != 1) _exit(124);
    close(ready_pipe[1]);
    if (!ready) _exit(125);
    if (platform_binary) {
      char *const args[] = {"sleep", "4", NULL};
      char *const environment[] = {"PATH=/usr/bin:/bin", NULL};
      execve("/bin/sleep", args, environment);
      _exit(126);
    }
    sleep(4);
    _exit(0);
  }
  close(ready_pipe[1]);
  char response = 'E';
  ssize_t received;
  do { received = read(ready_pipe[0], &response, 1); } while (received == -1 && errno == EINTR);
  int ready = received == 1 && response == 'R';
  close(ready_pipe[0]);
  int image_observed = !platform_binary;
  for (int attempt = 0; ready && platform_binary && attempt < 100; attempt++) {
    char image[PROC_PIDPATHINFO_MAXSIZE];
    if (proc_pidpath(child, image, sizeof(image)) > 0 && strcmp(image, "/bin/sleep") == 0) {
      image_observed = 1;
      break;
    }
    usleep(5000);
  }
  struct proc_bsdinfo process = {0};
  int credentials = proc_pidinfo(child, PROC_PIDTBSDINFO, 0, &process, sizeof(process)) == (int)sizeof(process)
    && process.pbi_pid == (uint32_t)child && process.pbi_ppid == (uint32_t)getpid()
    && process.pbi_uid == uid && process.pbi_ruid == uid && process.pbi_svuid == uid
    && (uid == 0 || (process.pbi_gid == uid && process.pbi_rgid == uid && process.pbi_svgid == uid));
  mach_port_t task = MACH_PORT_NULL;
  kern_return_t access = KERN_FAILURE, information = KERN_FAILURE;
  audit_token_t token = {{0}};
  int token_matches = 0, mismatch_result = -1, mismatch_attempted = 0, alive_after_mismatch = 0;
  int positive_result = -1, positive_attempted = 0, stale_result = -1, stale_attempted = 0;
  int status = 0, reaped = 0;
  if (ready && image_observed && credentials) {
    access = task_for_pid(mach_task_self(), child, &task);
    if (access == KERN_SUCCESS) {
      mach_msg_type_number_t count = TASK_AUDIT_TOKEN_COUNT;
      information = task_info(task, TASK_AUDIT_TOKEN, (task_info_t)&token, &count);
      token_matches = information == KERN_SUCCESS && count == TASK_AUDIT_TOKEN_COUNT
        && audit_token_to_pid(token) == child && audit_token_to_euid(token) == uid
        && audit_token_to_ruid(token) == uid && token.val[7] != 0;
      if (token_matches) {
        /* macOS15 XNU proc_find_audit_token checks val[7] against pidversion.
         * This token keeps the owned unreaped child's PID and changes only its
         * generation. It must be refused before the valid token is exercised.
         */
        audit_token_t wrong_generation = token;
        wrong_generation.val[7] ^= 1U;
        mismatch_attempted = 1;
        mismatch_result = send_audit_signal(&wrong_generation, SIGTERM);
        pid_t state;
        do { state = waitpid(child, &status, WNOHANG); } while (state == -1 && errno == EINTR);
        alive_after_mismatch = state == 0;
        reaped = state == child;
        if (mismatch_result == ESRCH && alive_after_mismatch) {
          positive_attempted = 1;
          positive_result = send_audit_signal(&token, SIGTERM);
        }
      }
      mach_port_deallocate(mach_task_self(), task);
    }
  }
  /* The child owns its five-second alarm. An API denial has no alternate kill.
   * Do not reap before any live-child identity-sensitive signal operation.
   */
  if (!reaped) {
    pid_t waited;
    do { waited = waitpid(child, &status, 0); } while (waited == -1 && errno == EINTR);
    reaped = waited == child;
  }
  if (token_matches && reaped) {
    /* SIG0 is invalid for this API. A post-reap SIGTERM must return ESRCH;
     * generation binding protects a newly reused PID, but no reuse is forced.
     */
    stale_attempted = 1;
    stale_result = send_audit_signal(&token, SIGTERM);
  }
  int signaled = reaped && WIFSIGNALED(status);
  int exited = reaped && WIFEXITED(status);
  int signal_number = signaled ? WTERMSIG(status) : 0;
  int exit_code = exited ? WEXITSTATUS(status) : -1;
  int isolated_empty = uid != 0 && observed_uid_count(uid) == 0;
  double ended = monotonic_seconds();
  int timing_observed = started >= 0 && ended >= started;
  double elapsed_ms = timing_observed ? (ended - started) * 1000.0 : -1;
  int observed = ready && image_observed && credentials && token_matches && mismatch_attempted
    && mismatch_result == ESRCH && alive_after_mismatch && positive_attempted && positive_result == 0
    && signaled && signal_number == SIGTERM && stale_attempted && stale_result == ESRCH && timing_observed;
  int cleaned = reaped && (uid == 0 || isolated_empty);
  printf("{\"case\":\"%s\",\"ready\":%s,\"expectedImageObserved\":%s,"
    "\"realEffectiveSavedUidMatch\":%s,\"knownDirectParentMatches\":%s,"
    "\"taskPortResult\":%d,\"auditTokenResult\":%d,\"auditTokenIdentityMatches\":%s,"
    "\"wrongGenerationAttempted\":%s,\"wrongGenerationResult\":%d,\"aliveAfterWrongGeneration\":%s,"
    "\"validTokenAttempted\":%s,\"validTokenResult\":%d,\"postReapTokenAttempted\":%s,\"postReapTokenResult\":%d,"
    "\"directChildReaped\":%s,\"exited\":%s,\"exitCode\":%d,\"signaled\":%s,\"signalNumber\":%d,"
    "\"isolatedUidEmptyAtObservation\":%s,\"elapsedMs\":%.3f,\"primitiveObserved\":%s,\"directChildCleaned\":%s}",
    label, boolean(ready), boolean(image_observed), boolean(credentials), boolean(credentials), access, information,
    boolean(token_matches), boolean(mismatch_attempted), mismatch_result, boolean(alive_after_mismatch),
    boolean(positive_attempted), positive_result, boolean(stale_attempted), stale_result, boolean(reaped),
    boolean(exited), exit_code, boolean(signaled), signal_number, boolean(isolated_empty), elapsed_ms,
    boolean(observed), boolean(cleaned));
  return (observed ? 1 : 0) | (cleaned ? 2 : 0);
}

int main(int argc, char **argv) {
  struct utsname host;
  if (argc != 2 || strlen(argv[1]) != 40 || strspn(argv[1], "0123456789abcdef") != 40
      || geteuid() != 0 || uname(&host) != 0 || strcmp(host.sysname, "Darwin") != 0
      || !getenv("GITHUB_ACTIONS") || strcmp(getenv("GITHUB_ACTIONS"), "true") != 0
      || !getenv("RUNNER_ENVIRONMENT") || strcmp(getenv("RUNNER_ENVIRONMENT"), "github-hosted") != 0)
    return 2;
  struct sigaction child_disposition;
  memset(&child_disposition, 0, sizeof(child_disposition));
  child_disposition.sa_handler = SIG_DFL;
  sigemptyset(&child_disposition.sa_mask);
  sigset_t unblocked;
  sigemptyset(&unblocked);
  sigaddset(&unblocked, SIGALRM);
  sigaddset(&unblocked, SIGTERM);
  if (sigaction(SIGCHLD, &child_disposition, NULL) != 0 || sigprocmask(SIG_UNBLOCK, &unblocked, NULL) != 0) return 2;
  signal(SIGALRM, SIG_DFL);
  alarm(30);
  printf("{\"classification\":\"HOST_AUDIT_SIGNAL_FEASIBILITY_NOT_ACCEPTANCE\",\"sourceSha\":\"%s\","
    "\"hostRelease\":\"%s\",\"hostMachine\":\"%s\",\"ownershipImplementationAccepted\":false,"
    "\"physicalEvidence\":false,\"uidAccountCreated\":false,\"exclusiveUidLeaseProven\":false,"
    "\"descendantOrServiceContainmentProven\":false,\"forcedPidReuseProven\":false,"
    "\"browserOrSimulatorContainmentProven\":false,", argv[1], host.release, host.machine);
  void *library = dlopen("/usr/lib/libproc.dylib", RTLD_NOW | RTLD_LOCAL);
  audit_signal_function send_audit_signal = library
    ? (audit_signal_function)dlsym(library, "proc_signal_with_audittoken") : NULL;
  if (!send_audit_signal) {
    printf("\"symbolAvailable\":false,\"cases\":[],\"probePrimitiveObserved\":false,\"probeDirectChildrenCleaned\":true}\n");
    if (library) dlclose(library);
    return 1;
  }
  printf("\"symbolAvailable\":true,");
  uid_t uid = 0;
  if (observed_uid_count(0) > 0) {
    for (int attempt = 0; attempt < 20; attempt++) {
      uid_t proposed = 1000000 + arc4random_uniform(1000000);
      errno = 0;
      if (getpwuid(proposed) == NULL && errno == 0 && observed_uid_count(proposed) == 0) {
        uid = proposed;
        break;
      }
    }
  }
  if (!uid) {
    printf("\"setupFailed\":true,\"cases\":[],\"probePrimitiveObserved\":false,\"probeDirectChildrenCleaned\":true}\n");
    dlclose(library);
    return 1;
  }
  printf("\"cases\":[");
  int first = observe("COMPILED_DIRECT_CHILD", 0, 0, send_audit_signal);
  printf(",");
  int second = observe("UNREGISTERED_UID_COMPILED_DIRECT_CHILD", uid, 0, send_audit_signal);
  printf(",");
  int third = observe("UNREGISTERED_UID_PLATFORM_DIRECT_CHILD", uid, 1, send_audit_signal);
  int primitive = (first & 1) && (second & 1) && (third & 1);
  int cleaned = (first & 2) && (second & 2) && (third & 2);
  printf("],\"probePrimitiveObserved\":%s,\"probeDirectChildrenCleaned\":%s}\n", boolean(primitive), boolean(cleaned));
  dlclose(library);
  return primitive && cleaned ? 0 : 1;
}
