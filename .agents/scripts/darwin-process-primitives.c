/* Hosted feasibility observations only. This is not a process-tree guardian.
 * Every payload is a known direct child with a five-second alarm. Denied task
 * access waits for that child's own deadline; there is no numeric-PID signal.
 */
#include <bsm/libbsm.h>
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
#include <unistd.h>

static const char *boolean(int value) { return value ? "true" : "false"; }

static int observed_uid_count(uid_t uid) {
  /* A NULL buffer reports global allocation size, before UID filtering.
   * A full buffer is ambiguous and must not be called an empty observation.
   */
  int processes[8192];
  errno = 0;
  int bytes = proc_listpids(PROC_UID_ONLY, uid, processes, sizeof(processes));
  if (bytes < 0 || errno != 0 || bytes >= (int)sizeof(processes) || bytes % (int)sizeof(int) != 0) return -1;
  return bytes / (int)sizeof(int);
}

static int observe(const char *label, uid_t uid, int platform_binary) {
  int ready_pipe[2];
  if (pipe(ready_pipe) != 0) {
    printf("{\"case\":\"%s\",\"setupFailed\":true}", label);
    return 0;
  }
  pid_t child = fork();
  if (child == -1) {
    close(ready_pipe[0]); close(ready_pipe[1]);
    printf("{\"case\":\"%s\",\"setupFailed\":true}", label);
    return 0;
  }
  if (child == 0) {
    close(ready_pipe[0]);
    signal(SIGALRM, SIG_DFL);
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
  int ready = read(ready_pipe[0], &response, 1) == 1 && response == 'R';
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
    && process.pbi_pid == (uint32_t)child && process.pbi_uid == uid
    && process.pbi_ruid == uid && process.pbi_svuid == uid
    && (uid == 0 || (process.pbi_gid == uid && process.pbi_rgid == uid && process.pbi_svgid == uid));
  mach_port_t task = MACH_PORT_NULL;
  kern_return_t access = KERN_FAILURE, information = KERN_FAILURE, termination = KERN_FAILURE;
  int token_matches = 0;
  if (ready && image_observed && credentials) {
    access = task_for_pid(mach_task_self(), child, &task);
    if (access == KERN_SUCCESS) {
      audit_token_t token;
      mach_msg_type_number_t count = TASK_AUDIT_TOKEN_COUNT;
      information = task_info(task, TASK_AUDIT_TOKEN, (task_info_t)&token, &count);
      token_matches = information == KERN_SUCCESS && count == TASK_AUDIT_TOKEN_COUNT
        && audit_token_to_pid(token) == child && audit_token_to_euid(token) == uid
        && audit_token_to_ruid(token) == uid;
      if (token_matches) termination = task_terminate(task);
      mach_port_deallocate(mach_task_self(), task);
    }
  }
  /* Do not reap before any identity-sensitive operation. The kernel retains
   * this direct-child PID until waitpid; task_terminate uses the pinned port.
   * Child alarm/natural exit bounds all denied-access cases independently.
   */
  int status = 0;
  pid_t waited;
  do { waited = waitpid(child, &status, 0); } while (waited == -1 && errno == EINTR);
  int reaped = waited == child;
  int isolated_empty = uid != 0 && observed_uid_count(uid) == 0;
  printf("{\"case\":\"%s\",\"ready\":%s,\"expectedImageObserved\":%s,"
    "\"realEffectiveSavedUidMatch\":%s,\"taskPortResult\":%d,\"auditTokenResult\":%d,"
    "\"auditTokenIdentityMatches\":%s,\"taskTerminateResult\":%d,"
    "\"directChildReaped\":%s,\"isolatedUidEmptyAtObservation\":%s}",
    label, boolean(ready), boolean(image_observed), boolean(credentials), access, information,
    boolean(token_matches), termination, boolean(reaped), boolean(isolated_empty));
  return ready && image_observed && credentials && reaped && (uid == 0 || isolated_empty);
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
  if (sigaction(SIGCHLD, &child_disposition, NULL) != 0) return 2;
  signal(SIGALRM, SIG_DFL);
  alarm(30);
  if (observed_uid_count(0) <= 0) return 3;
  uid_t uid = 0;
  for (int attempt = 0; attempt < 20; attempt++) {
    uid_t proposed = 1000000 + arc4random_uniform(1000000);
    errno = 0;
    if (getpwuid(proposed) == NULL && errno == 0 && observed_uid_count(proposed) == 0) {
      uid = proposed;
      break;
    }
  }
  if (!uid) return 4;
  printf("{\"classification\":\"HOST_PRIMITIVE_FEASIBILITY_NOT_ACCEPTANCE\",\"sourceSha\":\"%s\","
    "\"ownershipImplementationAccepted\":false,\"physicalEvidence\":false,"
    "\"uidAccountCreated\":false,\"exclusiveUidLeaseProven\":false,"
    "\"descendantOrServiceContainmentProven\":false,\"pidVersionValidationProven\":false,\"cases\":[", argv[1]);
  int first = observe("COMPILED_DIRECT_CHILD", 0, 0);
  printf(",");
  int second = observe("UNREGISTERED_UID_COMPILED_DIRECT_CHILD", uid, 0);
  printf(",");
  int third = observe("UNREGISTERED_UID_PLATFORM_DIRECT_CHILD", uid, 1);
  printf("],\"probeDirectChildrenCleaned\":%s}\n", boolean(first && second && third));
  return first && second && third ? 0 : 1;
}
