/* Finite development-only audit-session capability observation.
 * Two known direct children and one known grandchild; no observer signals,
 * account, global audit configuration, arbitrary command or guardian.
 */
#define __APPLE_API_PRIVATE 1
#include <mach/mach.h>
#include <mach/task_info.h>
#include <bsm/audit.h>
#include <bsm/libbsm.h>
#include <errno.h>
#include <grp.h>
#include <libproc.h>
#include <pwd.h>
#include <signal.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/utsname.h>
#include <sys/wait.h>
#include <time.h>
#include <unistd.h>

enum { FIXED_CHILD_PORT = 0x6a03, MESSAGE_ID = 0x56574153, WIRE_VERSION = 1 };
enum { CHILD_A = 0, CHILD_B = 1, MAX_SESSION_REFS = 6 };
static const uid_t child_uid = 60000;

typedef struct {
  int available;
  char operation[48];
  int result;
  int error;
} failure_detail;

static void record_failure(failure_detail *failure, const char *operation, int result, int error) {
  if (failure->available) return;
  failure->available = 1;
  snprintf(failure->operation, sizeof(failure->operation), "%s", operation);
  failure->result = result;
  failure->error = error;
}

typedef struct {
  mach_msg_header_t header;
  mach_msg_body_t body;
  mach_msg_port_descriptor_t session;
  uint32_t version;
  uint32_t role;
  int32_t asid;
  uint32_t reserved;
} session_message;

typedef union {
  session_message message;
  unsigned char bytes[sizeof(session_message) + sizeof(mach_msg_audit_trailer_t) + 16];
  uint64_t alignment;
} receive_buffer;

typedef struct {
  int before_match;
  int setsid_ok;
  int after_match;
  int credentials_match;
} grand_observation;

typedef struct {
  int session_created;
  int self_right_obtained;
  int message_sent;
  int self_right_released;
  int endpoint_released;
  int drop_complete;
  int root_restore_denied;
  int new_session_denied;
  int foreign_session_denied;
  int identity_stable;
  int grand_started;
  int grand_waited;
  int grand_status;
  int grand_record_received;
  grand_observation grand;
  int failure_stage;
  int failure_code;
  failure_detail failure;
} child_observation;

typedef struct {
  int control[2];
  int ready[2];
  int result[2];
  pid_t pid;
  mach_port_t task;
  audit_token_t token;
  int task_bound;
  int unused_slot;
  int endpoint_inserted;
  int frame_valid;
  int task_release_attempted;
  int task_released;
  int waited;
  int wait_status;
  int record_received;
  child_observation observation;
} child_state;

static const char *boolean(int value) { return value ? "true" : "false"; }
static const char *observed_boolean(int available, int value) { return available ? boolean(value) : "null"; }
static double monotonic_seconds(void) {
  struct timespec now;
  if (clock_gettime(CLOCK_MONOTONIC, &now) != 0) return -1;
  return (double)now.tv_sec + (double)now.tv_nsec / 1000000000.0;
}
static int wait_naturally_until(double deadline) {
  double now;
  while ((now = monotonic_seconds()) >= 0 && now < deadline) {
    double remaining = deadline - now;
    struct timespec delay = { (time_t)remaining, (long)((remaining - (time_t)remaining) * 1000000000.0) };
    if (nanosleep(&delay, NULL) != 0 && errno != EINTR) return 0;
  }
  return now >= 0;
}
static int transfer_bytes(int fd, void *buffer, size_t length, int writing) {
  unsigned char *cursor = buffer;
  while (length) {
    ssize_t count = writing ? write(fd, cursor, length) : read(fd, cursor, length);
    if (count < 0 && errno == EINTR) continue;
    if (count <= 0) return 0;
    cursor += count;
    length -= (size_t)count;
  }
  return 1;
}
static int close_fd(int *fd) {
  if (*fd < 0) return 1;
  int result = close(*fd) == 0;
  *fd = -1;
  return result;
}
static int same_identity(const auditinfo_addr_t *left, const auditinfo_addr_t *right) {
  return left->ai_asid == right->ai_asid && left->ai_auid == right->ai_auid;
}
static int credentials_match(uid_t uid) {
  struct proc_bsdinfo process = {0};
  gid_t groups[32];
  int count = getgroups(32, groups);
  if (count < 1 || count > 32 || getuid() != uid || geteuid() != uid || getgid() != uid || getegid() != uid)
    return 0;
  for (int index = 0; index < count; index++) if (groups[index] != (gid_t)uid) return 0;
  return proc_pidinfo(getpid(), PROC_PIDTBSDINFO, 0, &process, sizeof(process)) == (int)sizeof(process)
    && process.pbi_uid == uid && process.pbi_ruid == uid && process.pbi_svuid == uid
    && process.pbi_gid == uid && process.pbi_rgid == uid && process.pbi_svgid == uid;
}
static int absent_fixed_uid(void) {
  int pids[8192];
  errno = 0;
  struct passwd *account = getpwuid(child_uid);
  if (account != NULL || errno != 0) return 0;
  errno = 0;
  int bytes = proc_listpids(PROC_UID_ONLY, child_uid, pids, sizeof(pids));
  return bytes == 0 && errno == 0;
}
static int create_session(auditinfo_addr_t *created, failure_detail *failure) {
  auditinfo_addr_t request = {0};
  int result = getaudit_addr(&request, sizeof(request));
  if (result != 0) { record_failure(failure, "getaudit_before_assignment", result, errno); return 0; }
  au_asid_t inherited = request.ai_asid;
  request.ai_asid = AU_ASSIGN_ASID;
  result = setaudit_addr(&request, sizeof(request));
  if (result != 0) { record_failure(failure, "setaudit_new_assignment", result, errno); return 0; }
  result = getaudit_addr(created, sizeof(*created));
  if (result != 0) { record_failure(failure, "getaudit_after_assignment", result, errno); return 0; }
  int valid = created->ai_asid != AU_DEFAUDITSID && created->ai_asid != AU_ASSIGN_ASID
    && created->ai_asid != inherited;
  if (!valid) record_failure(failure, "assigned_identity_validation", 0, 0);
  return valid;
}
static mach_msg_return_t send_session(unsigned int role, au_asid_t asid, mach_port_t session) {
  session_message message;
  memset(&message, 0, sizeof(message));
  message.header.msgh_bits = MACH_MSGH_BITS(MACH_MSG_TYPE_COPY_SEND, 0) | MACH_MSGH_BITS_COMPLEX;
  message.header.msgh_size = (mach_msg_size_t)sizeof(message);
  message.header.msgh_remote_port = FIXED_CHILD_PORT;
  message.header.msgh_id = MESSAGE_ID;
  message.body.msgh_descriptor_count = 1;
  message.session.name = session;
  message.session.disposition = MACH_MSG_TYPE_COPY_SEND;
  message.session.type = MACH_MSG_PORT_DESCRIPTOR;
  message.version = WIRE_VERSION;
  message.role = role;
  message.asid = asid;
  return mach_msg(&message.header, MACH_SEND_MSG, message.header.msgh_size, 0,
    MACH_PORT_NULL, MACH_MSG_TIMEOUT_NONE, MACH_PORT_NULL);
}
static void run_grandchild(int output, const auditinfo_addr_t *expected, double started) {
  alarm(5);
  grand_observation observation = {0};
  auditinfo_addr_t before = {0}, after = {0};
  observation.before_match = getaudit_addr(&before, sizeof(before)) == 0 && same_identity(&before, expected);
  observation.credentials_match = credentials_match(child_uid);
  observation.setsid_ok = setsid() >= 0;
  observation.after_match = getaudit_addr(&after, sizeof(after)) == 0 && same_identity(&after, expected);
  int complete = observation.before_match && observation.credentials_match && observation.setsid_ok
    && observation.after_match && wait_naturally_until(started + 1.0);
  complete = transfer_bytes(output, &observation, sizeof(observation), 1) && complete;
  complete = close(output) == 0 && complete;
  _exit(complete ? 0 : 1);
}
static void run_child(unsigned int role, int control, int ready, int output) {
  alarm(5);
  double started = monotonic_seconds();
  child_observation observation = {0};
  mach_port_t own_session = MACH_PORT_NULL;
  int endpoint_owned = 0;
  int success = 0;
  unsigned char marker = WIRE_VERSION;
  mach_port_name_t endpoint = MACH_PORT_NULL;
  auditinfo_addr_t created = {0};
  if (started < 0 || !transfer_bytes(ready, &marker, sizeof(marker), 1)) goto done;
  close_fd(&ready);
  observation.failure_stage = 1;
  if (!transfer_bytes(control, &endpoint, sizeof(endpoint), 0) || endpoint != FIXED_CHILD_PORT) goto done;
  endpoint_owned = 1;
  observation.failure_stage = 2;
  if (!create_session(&created, &observation.failure)) goto done;
  observation.session_created = 1;
  observation.failure_stage = 3;
  own_session = audit_session_self();
  if (!MACH_PORT_VALID(own_session)) { observation.failure_code = errno; goto done; }
  observation.self_right_obtained = 1;
  observation.failure_stage = 4;
  mach_msg_return_t send_result = send_session(role, created.ai_asid, own_session);
  if (send_result != MACH_MSG_SUCCESS) {
    record_failure(&observation.failure, "mach_msg_session_send", send_result, 0);
    goto done;
  }
  observation.message_sent = 1;
  if (role == CHILD_A) {
    au_asid_t other = AU_DEFAUDITSID;
    observation.failure_stage = 5;
    if (!transfer_bytes(control, &other, sizeof(other), 0) || other == created.ai_asid
      || other == AU_DEFAUDITSID || other == AU_ASSIGN_ASID) goto done;
    gid_t group = child_uid;
    observation.failure_stage = 6;
    int credential_result = setgroups(1, &group);
    if (credential_result != 0) { record_failure(&observation.failure, "child_setgroups", credential_result, errno); goto done; }
    credential_result = setgid(group);
    if (credential_result != 0) { record_failure(&observation.failure, "child_setgid", credential_result, errno); goto done; }
    credential_result = setuid(child_uid);
    if (credential_result != 0) { record_failure(&observation.failure, "child_setuid", credential_result, errno); goto done; }
    observation.drop_complete = credentials_match(child_uid);
    errno = 0;
    int restore_result = setuid(0);
    int restore_error = errno;
    observation.root_restore_denied = restore_result == -1 && restore_error == EPERM && credentials_match(child_uid);
    if (!observation.root_restore_denied)
      record_failure(&observation.failure, "child_root_restoration_negative", restore_result, restore_error);
    if (!observation.drop_complete || !observation.root_restore_denied) goto done;
    observation.failure_stage = 7;
    auditinfo_addr_t request = created;
    request.ai_asid = AU_ASSIGN_ASID;
    errno = 0;
    int new_result = setaudit_addr(&request, sizeof(request));
    int new_error = errno;
    observation.new_session_denied = new_result == -1 && new_error == EPERM;
    if (!observation.new_session_denied)
      record_failure(&observation.failure, "unprivileged_setaudit_negative", new_result, new_error);
    mach_port_t foreign = MACH_PORT_NULL;
    errno = 0;
    int foreign_result = audit_session_port(other, &foreign);
    int foreign_error = errno;
    observation.foreign_session_denied = foreign_result == -1 && foreign_error == EPERM && foreign == MACH_PORT_NULL;
    if (!observation.foreign_session_denied)
      record_failure(&observation.failure, "unprivileged_foreign_port_negative", foreign_result, foreign_error);
    if (MACH_PORT_VALID(foreign)) mach_port_deallocate(mach_task_self(), foreign);
    auditinfo_addr_t current = {0};
    observation.identity_stable = getaudit_addr(&current, sizeof(current)) == 0 && same_identity(&current, &created);
    if (!observation.new_session_denied || !observation.foreign_session_denied || !observation.identity_stable) goto done;
    observation.failure_stage = 8;
    int report[2];
    if (pipe(report) != 0) goto done;
    pid_t grandchild = fork();
    if (grandchild == 0) {
      close(report[0]);
      close(control);
      close(output);
      run_grandchild(report[1], &created, monotonic_seconds());
    }
    close(report[1]);
    if (grandchild < 0) { close(report[0]); goto done; }
    observation.grand_started = 1;
    pid_t waited;
    do { waited = waitpid(grandchild, &observation.grand_status, 0); } while (waited < 0 && errno == EINTR);
    observation.grand_waited = waited == grandchild;
    observation.grand_record_received = transfer_bytes(report[0], &observation.grand, sizeof(observation.grand), 0);
    int report_closed = close(report[0]) == 0;
    if (!observation.grand_waited || !WIFEXITED(observation.grand_status) || WEXITSTATUS(observation.grand_status) != 0
      || !observation.grand_record_received || !report_closed || !observation.grand.before_match
      || !observation.grand.setsid_ok || !observation.grand.after_match || !observation.grand.credentials_match) goto done;
  }
  observation.failure_stage = 9;
  if (!wait_naturally_until(started + 4.0)) goto done;
  success = 1;
done:
  if (MACH_PORT_VALID(own_session)) {
    kern_return_t code = mach_port_deallocate(mach_task_self(), own_session);
    observation.self_right_released = code == KERN_SUCCESS;
    if (!observation.self_right_released) record_failure(&observation.failure, "child_session_right_release", code, 0);
  }
  else observation.self_right_released = !observation.self_right_obtained;
  if (endpoint_owned) {
    kern_return_t code = mach_port_deallocate(mach_task_self(), endpoint);
    observation.endpoint_released = code == KERN_SUCCESS;
    if (!observation.endpoint_released) record_failure(&observation.failure, "child_endpoint_right_release", code, 0);
  }
  else observation.endpoint_released = 1;
  success = success && observation.self_right_released && observation.endpoint_released;
  if (success) observation.failure_stage = 0;
  int pipes_closed = close_fd(&ready);
  pipes_closed = close_fd(&control) && pipes_closed;
  success = transfer_bytes(output, &observation, sizeof(observation), 1) && pipes_closed && success;
  success = close(output) == 0 && success;
  _exit(success ? 0 : 1);
}

static int bind_known_child(child_state *child, const char *expected_image, failure_detail *failure) {
  char image[PROC_PIDPATHINFO_MAXSIZE] = {0};
  struct proc_bsdinfo info = {0};
  errno = 0;
  int result = proc_pidinfo(child->pid, PROC_PIDTBSDINFO, 0, &info, sizeof(info));
  if (result != (int)sizeof(info)) { record_failure(failure, "known_child_proc_info", result, errno); return 0; }
  if (info.pbi_pid != (uint32_t)child->pid || info.pbi_ppid != (uint32_t)getpid()
    || info.pbi_uid != 0 || info.pbi_ruid != 0 || info.pbi_svuid != 0
    || info.pbi_gid != 0 || info.pbi_rgid != 0 || info.pbi_svgid != 0
    ) { record_failure(failure, "known_child_credentials_or_parent", 0, 0); return 0; }
  errno = 0;
  result = proc_pidpath(child->pid, image, sizeof(image));
  if (result <= 0) { record_failure(failure, "known_child_image_query", result, errno); return 0; }
  if (strcmp(image, expected_image) != 0) { record_failure(failure, "known_child_image_validation", 0, 0); return 0; }
  kern_return_t code = task_for_pid(mach_task_self(), child->pid, &child->task);
  if (code != KERN_SUCCESS) { record_failure(failure, "known_child_task_for_pid", code, 0); return 0; }
  mach_msg_type_number_t count = TASK_AUDIT_TOKEN_COUNT;
  code = task_info(child->task, TASK_AUDIT_TOKEN, (task_info_t)&child->token, &count);
  if (code != KERN_SUCCESS) { record_failure(failure, "known_child_task_audit_token", code, 0); return 0; }
  int valid = count == TASK_AUDIT_TOKEN_COUNT && child->token.val[5] == (uint32_t)child->pid
    && child->token.val[1] == 0 && child->token.val[3] == 0
    && child->token.val[2] == 0 && child->token.val[4] == 0;
  if (!valid) record_failure(failure, "known_child_token_validation", 0, 0);
  return valid;
}
static int valid_frame(const receive_buffer *buffer, mach_port_t endpoint, const child_state *child, unsigned int role) {
  const session_message *message = &buffer->message;
  if (message->header.msgh_size != sizeof(*message) || message->header.msgh_id != MESSAGE_ID
    || !(message->header.msgh_bits & MACH_MSGH_BITS_COMPLEX) || message->header.msgh_local_port != endpoint
    || message->header.msgh_remote_port != MACH_PORT_NULL || message->header.msgh_voucher_port != MACH_PORT_NULL
    || MACH_MSGH_BITS_VOUCHER(message->header.msgh_bits) != 0 || message->body.msgh_descriptor_count != 1
    || message->session.type != MACH_MSG_PORT_DESCRIPTOR || message->session.disposition != MACH_MSG_TYPE_PORT_SEND
    || !MACH_PORT_VALID(message->session.name) || message->version != WIRE_VERSION || message->role != role
    || message->reserved != 0 || message->asid == AU_DEFAUDITSID || message->asid == AU_ASSIGN_ASID) return 0;
  size_t offset = (message->header.msgh_size + 3u) & ~(size_t)3u;
  if (offset + sizeof(mach_msg_audit_trailer_t) > sizeof(*buffer)) return 0;
  const mach_msg_audit_trailer_t *trailer = (const void *)(buffer->bytes + offset);
  return trailer->msgh_trailer_type == MACH_MSG_TRAILER_FORMAT_0
    && trailer->msgh_trailer_size == sizeof(*trailer)
    && trailer->msgh_audit.val[5] == (uint32_t)child->pid
    && trailer->msgh_audit.val[7] == child->token.val[7]
    && trailer->msgh_audit.val[1] == 0 && trailer->msgh_audit.val[3] == 0
    && trailer->msgh_audit.val[2] == 0 && trailer->msgh_audit.val[4] == 0
    && trailer->msgh_audit.val[0] == child->token.val[0]
    && trailer->msgh_audit.val[6] == (uint32_t)message->asid;
}

int main(int argc, char **argv) {
  struct utsname host;
  if (argc != 2 || strlen(argv[1]) != 40 || strspn(argv[1], "0123456789abcdef") != 40 || geteuid() != 0
    || getuid() != 0 || getgid() != 0 || getegid() != 0
    || uname(&host) != 0 || strcmp(host.sysname, "Darwin") != 0
    || !getenv("GITHUB_ACTIONS") || strcmp(getenv("GITHUB_ACTIONS"), "true") != 0
    || !getenv("RUNNER_ENVIRONMENT") || strcmp(getenv("RUNNER_ENVIRONMENT"), "github-hosted") != 0) return 2;
  struct sigaction disposition;
  memset(&disposition, 0, sizeof(disposition));
  disposition.sa_handler = SIG_DFL;
  sigemptyset(&disposition.sa_mask);
  sigset_t unblocked;
  sigemptyset(&unblocked);
  sigaddset(&unblocked, SIGALRM);
  if (sigaction(SIGCHLD, &disposition, NULL) != 0 || sigaction(SIGALRM, &disposition, NULL) != 0
    || sigprocmask(SIG_UNBLOCK, &unblocked, NULL) != 0) return 2;
  disposition.sa_handler = SIG_IGN;
  if (sigaction(SIGPIPE, &disposition, NULL) != 0) return 2;
  alarm(30);
  double started = monotonic_seconds();
  child_state children[2];
  memset(children, 0, sizeof(children));
  for (int index = 0; index < 2; index++) {
    children[index].pid = -1;
    for (int end = 0; end < 2; end++) children[index].control[end] = children[index].ready[end] = children[index].result[end] = -1;
  }
  auditinfo_addr_t original = {0}, final = {0};
  mach_port_t endpoint = MACH_PORT_NULL;
  int endpoint_send_owned = 0, endpoint_destroyed = 1, endpoint_send_released = 1;
  mach_port_t session_refs[MAX_SESSION_REFS] = {0};
  int ref_count = 0, refs_released = 0;
  au_asid_t asids[2] = {0, 0};
  receive_buffer frames[2];
  memset(frames, 0, sizeof(frames));
  char image[PROC_PIDPATHINFO_MAXSIZE] = {0};
  int phase = 1, success = 0, wrong_child_rejected = 0, held_lookup[2] = {0, 0}, pipes_closed = 1;
  int created = 0, reaped = 0, observer_unchanged = 0;
  failure_detail failure = {0};
  if (started < 0 || !absent_fixed_uid() || getaudit_addr(&original, sizeof(original)) != 0
    || proc_pidpath(getpid(), image, sizeof(image)) <= 0) goto cleanup;
  phase = 2;
  kern_return_t code = mach_port_allocate(mach_task_self(), MACH_PORT_RIGHT_RECEIVE, &endpoint);
  if (code != KERN_SUCCESS) { record_failure(&failure, "observer_endpoint_allocate", code, 0); goto cleanup; }
  endpoint_destroyed = 0;
  code = mach_port_insert_right(mach_task_self(), endpoint, endpoint, MACH_MSG_TYPE_MAKE_SEND);
  if (code != KERN_SUCCESS) { record_failure(&failure, "observer_endpoint_make_send", code, 0); goto cleanup; }
  endpoint_send_owned = 1;
  endpoint_send_released = 0;
  for (int index = 0; index < 2; index++)
    if (pipe(children[index].control) != 0 || pipe(children[index].ready) != 0 || pipe(children[index].result) != 0) goto cleanup;
  phase = 3;
  for (int index = 0; index < 2; index++) {
    children[index].pid = fork();
    if (children[index].pid == 0) {
      for (int other = 0; other < 2; other++) {
        close(children[other].control[1]);
        close(children[other].ready[0]);
        close(children[other].result[0]);
        if (other != index) {
          close(children[other].control[0]);
          close(children[other].ready[1]);
          close(children[other].result[1]);
        }
      }
      run_child((unsigned int)index, children[index].control[0], children[index].ready[1], children[index].result[1]);
    }
    if (children[index].pid < 0) goto cleanup;
    created++;
    pipes_closed = close_fd(&children[index].control[0]) && pipes_closed;
    pipes_closed = close_fd(&children[index].ready[1]) && pipes_closed;
    pipes_closed = close_fd(&children[index].result[1]) && pipes_closed;
  }
  phase = 4;
  for (int index = 0; index < 2; index++) {
    unsigned char ready = 0;
    if (!transfer_bytes(children[index].ready[0], &ready, sizeof(ready), 0) || ready != WIRE_VERSION) goto cleanup;
    pipes_closed = close_fd(&children[index].ready[0]) && pipes_closed;
    children[index].task_bound = bind_known_child(&children[index], image, &failure);
    if (!children[index].task_bound) goto cleanup;
    mach_port_type_t type = 0;
    code = mach_port_type(children[index].task, FIXED_CHILD_PORT, &type);
    children[index].unused_slot = code == KERN_INVALID_NAME;
    if (!children[index].unused_slot) { record_failure(&failure, "child_fixed_slot_must_be_unused", code, 0); goto cleanup; }
    code = mach_port_insert_right(children[index].task, FIXED_CHILD_PORT, endpoint, MACH_MSG_TYPE_COPY_SEND);
    children[index].endpoint_inserted = code == KERN_SUCCESS;
    if (!children[index].endpoint_inserted) { record_failure(&failure, "child_endpoint_insert", code, 0); goto cleanup; }
    mach_port_name_t name = FIXED_CHILD_PORT;
    if (!transfer_bytes(children[index].control[1], &name, sizeof(name), 1)) goto cleanup;
  }
  phase = 5;
  for (int received = 0; received < 2; received++) {
    receive_buffer buffer;
    memset(&buffer, 0, sizeof(buffer));
    mach_msg_return_t result = mach_msg(&buffer.message.header,
      MACH_RCV_MSG | MACH_RCV_TIMEOUT | MACH_RCV_TRAILER_TYPE(MACH_MSG_TRAILER_FORMAT_0)
        | MACH_RCV_TRAILER_ELEMENTS(MACH_RCV_TRAILER_AUDIT),
      0, (mach_msg_size_t)sizeof(buffer), endpoint, 1000, MACH_PORT_NULL);
    if (result != MACH_MSG_SUCCESS) { record_failure(&failure, "observer_session_receive", result, 0); goto cleanup; }
    unsigned int role = buffer.message.role;
    if (role > CHILD_B || children[role].frame_valid || !valid_frame(&buffer, endpoint, &children[role], role)) {
      record_failure(&failure, "received_frame_validation", 0, 0);
      mach_msg_destroy(&buffer.message.header);
      goto cleanup;
    }
    mach_port_type_t type = 0;
    code = mach_port_type(mach_task_self(), buffer.message.session.name, &type);
    if (code != KERN_SUCCESS || !(type & MACH_PORT_TYPE_SEND) || (type & MACH_PORT_TYPE_DEAD_NAME)) {
      record_failure(&failure, "received_session_right_type", code, 0);
      mach_msg_destroy(&buffer.message.header);
      goto cleanup;
    }
    if (ref_count >= MAX_SESSION_REFS) {
      mach_msg_destroy(&buffer.message.header);
      goto cleanup;
    }
    frames[role] = buffer;
    asids[role] = buffer.message.asid;
    session_refs[ref_count++] = buffer.message.session.name;
    children[role].frame_valid = 1;
    buffer.message.session.name = MACH_PORT_NULL;
  }
  if (asids[0] == asids[1] || asids[0] == original.ai_asid || asids[1] == original.ai_asid) goto cleanup;
  receive_buffer wrong_child = frames[CHILD_B];
  wrong_child.message.role = CHILD_A;
  wrong_child_rejected = !valid_frame(&wrong_child, endpoint, &children[CHILD_A], CHILD_A);
  if (!wrong_child_rejected) goto cleanup;
  phase = 6;
  for (int index = 0; index < 2; index++) {
    children[index].task_release_attempted = 1;
    code = mach_port_deallocate(mach_task_self(), children[index].task);
    children[index].task_released = code == KERN_SUCCESS;
    if (!children[index].task_released) { record_failure(&failure, "child_task_handle_release", code, 0); goto cleanup; }
    children[index].task = MACH_PORT_NULL;
    mach_port_t lookup = MACH_PORT_NULL;
    if (ref_count >= MAX_SESSION_REFS) goto cleanup;
    errno = 0;
    int lookup_result = audit_session_port(asids[index], &lookup);
    if (lookup_result != 0) { record_failure(&failure, "held_session_lookup_before_exit", lookup_result, errno); goto cleanup; }
    session_refs[ref_count++] = lookup;
    if (lookup != frames[index].message.session.name) goto cleanup;
  }
  phase = 7;
  if (!transfer_bytes(children[CHILD_A].control[1], &asids[CHILD_B], sizeof(asids[CHILD_B]), 1)) goto cleanup;
  for (int index = 0; index < 2; index++) pipes_closed = close_fd(&children[index].control[1]) && pipes_closed;
  phase = 8;
  for (int index = 0; index < 2; index++) {
    pid_t waited;
    do { waited = waitpid(children[index].pid, &children[index].wait_status, 0); } while (waited < 0 && errno == EINTR);
    children[index].waited = waited == children[index].pid;
    reaped += children[index].waited;
    if (!children[index].waited) goto cleanup;
    children[index].record_received = transfer_bytes(children[index].result[0], &children[index].observation,
      sizeof(children[index].observation), 0);
    if (!children[index].record_received || !WIFEXITED(children[index].wait_status)
      || WEXITSTATUS(children[index].wait_status) != 0) goto cleanup;
  }
  phase = 9;
  for (int index = 0; index < 2; index++) {
    mach_port_t lookup = MACH_PORT_NULL;
    if (ref_count >= MAX_SESSION_REFS) goto cleanup;
    errno = 0;
    int lookup_result = audit_session_port(asids[index], &lookup);
    if (lookup_result != 0) { record_failure(&failure, "held_session_lookup_after_exit", lookup_result, errno); goto cleanup; }
    session_refs[ref_count++] = lookup;
    held_lookup[index] = lookup == frames[index].message.session.name;
    if (!held_lookup[index]) goto cleanup;
  }
  success = 1;
cleanup:
  for (int index = 0; index < 2; index++) pipes_closed = close_fd(&children[index].control[1]) && pipes_closed;
  for (int index = 0; index < 2; index++) {
    if (children[index].pid > 0 && !children[index].waited) {
      pid_t waited;
      do { waited = waitpid(children[index].pid, &children[index].wait_status, 0); } while (waited < 0 && errno == EINTR);
      children[index].waited = waited == children[index].pid;
      reaped += children[index].waited;
    }
    if (MACH_PORT_VALID(children[index].task) && !children[index].task_release_attempted) {
      children[index].task_release_attempted = 1;
      code = mach_port_deallocate(mach_task_self(), children[index].task);
      children[index].task_released = code == KERN_SUCCESS;
      if (!children[index].task_released) record_failure(&failure, "cleanup_child_task_handle_release", code, 0);
      if (children[index].task_released) children[index].task = MACH_PORT_NULL;
    }
    if (children[index].waited && !children[index].record_received)
      children[index].record_received = transfer_bytes(children[index].result[0], &children[index].observation,
        sizeof(children[index].observation), 0);
    for (int end = 0; end < 2; end++) {
      pipes_closed = close_fd(&children[index].control[end]) && pipes_closed;
      pipes_closed = close_fd(&children[index].ready[end]) && pipes_closed;
      pipes_closed = close_fd(&children[index].result[end]) && pipes_closed;
    }
  }
  for (int index = 0; index < ref_count; index++) {
    code = mach_port_deallocate(mach_task_self(), session_refs[index]);
    if (code == KERN_SUCCESS) refs_released++;
    else record_failure(&failure, "cleanup_session_reference_release", code, 0);
  }
  if (endpoint_send_owned) {
    code = mach_port_deallocate(mach_task_self(), endpoint);
    endpoint_send_released = code == KERN_SUCCESS;
    if (!endpoint_send_released) record_failure(&failure, "cleanup_endpoint_send_release", code, 0);
  }
  if (MACH_PORT_VALID(endpoint)) {
    code = mach_port_mod_refs(mach_task_self(), endpoint, MACH_PORT_RIGHT_RECEIVE, -1);
    endpoint_destroyed = code == KERN_SUCCESS;
    if (!endpoint_destroyed) record_failure(&failure, "cleanup_endpoint_receive_release", code, 0);
  }
  observer_unchanged = getaudit_addr(&final, sizeof(final)) == 0 && same_identity(&original, &final);
  child_observation *a = &children[CHILD_A].observation;
  int a_available = children[CHILD_A].record_received;
  int grand_ok = a->grand_started && a->grand_waited && WIFEXITED(a->grand_status) && WEXITSTATUS(a->grand_status) == 0;
  char grand_status[32];
  if (a_available && a->grand_waited) snprintf(grand_status, sizeof(grand_status), "%d", a->grand_status);
  else snprintf(grand_status, sizeof(grand_status), "null");
  success = success && created == 2 && reaped == 2 && grand_ok && observer_unchanged && pipes_closed
    && ref_count == MAX_SESSION_REFS && refs_released == ref_count && endpoint_send_released && endpoint_destroyed;
  for (int index = 0; index < 2; index++) success = success && children[index].task_released;
  printf("{\"classification\":\"HOST_AUDIT_SESSION_CAPABILITY_FEASIBILITY_NOT_ACCEPTANCE\",\"sourceSha\":\"%s\","
    "\"hostRelease\":\"%s\",\"hostMachine\":\"%s\",\"pass\":%s,\"lastPhase\":%d,"
    "\"knownDirectChildrenCreated\":%d,\"knownDirectChildrenReaped\":%d,\"knownGrandchildCreated\":%s,\"knownGrandchildReaped\":%s,\"knownGrandchildSuccessfulExit\":%s,"
    "\"wrongChildFrameRejected\":%s,\"heldSessionAfterChildren\":[%s,%s],\"sessionReferencesAcquired\":%d,\"sessionReferencesReleased\":%d,"
    "\"privateEndpointSendReleased\":%s,\"privateEndpointDestroyed\":%s,\"ownedPipesClosed\":%s,"
    "\"observerIdentityFields\":\"AUID_AND_ASID\",\"observerIdentityUnchanged\":%s,\"elapsedMs\":%.3f,\"children\":[",
    argv[1], host.release, host.machine, boolean(success), phase, created, reaped,
    observed_boolean(a_available, a->grand_started), observed_boolean(a_available, a->grand_waited), observed_boolean(a_available, grand_ok),
    boolean(wrong_child_rejected), boolean(held_lookup[0]), boolean(held_lookup[1]), ref_count, refs_released,
    boolean(endpoint_send_released), boolean(endpoint_destroyed), boolean(pipes_closed), boolean(observer_unchanged),
    (monotonic_seconds() - started) * 1000.0);
  for (int index = 0; index < 2; index++) {
    child_state *child = &children[index];
    child_observation *item = &child->observation;
    char wait_status[32], failure_stage[32], failure_code[32];
    if (child->waited) snprintf(wait_status, sizeof(wait_status), "%d", child->wait_status);
    else snprintf(wait_status, sizeof(wait_status), "null");
    if (child->record_received) {
      snprintf(failure_stage, sizeof(failure_stage), "%d", item->failure_stage);
      snprintf(failure_code, sizeof(failure_code), "%d", item->failure_code);
    } else {
      snprintf(failure_stage, sizeof(failure_stage), "null");
      snprintf(failure_code, sizeof(failure_code), "null");
    }
    printf("%s{\"role\":\"%s\",\"taskBound\":%s,\"fixedNameUnused\":%s,\"endpointInserted\":%s,\"frameValid\":%s,\"taskHandleReleased\":%s,"
      "\"actualWaitObserved\":%s,\"actualWaitStatus\":%s,\"recordReceived\":%s,\"sessionCreated\":%s,\"messageSent\":%s,"
      "\"selfRightReleased\":%s,\"endpointRightReleased\":%s,\"failureStage\":%s,\"failureCode\":%s,\"apiFailure\":",
      index ? "," : "", index ? "B" : "A", boolean(child->task_bound), boolean(child->unused_slot), boolean(child->endpoint_inserted),
      boolean(child->frame_valid), boolean(child->task_released), boolean(child->waited), wait_status,
      boolean(child->record_received), observed_boolean(child->record_received, item->session_created),
      observed_boolean(child->record_received, item->message_sent), observed_boolean(child->record_received, item->self_right_released),
      observed_boolean(child->record_received, item->endpoint_released), failure_stage, failure_code);
    if (child->record_received && item->failure.available)
      printf("{\"operation\":\"%s\",\"returnCode\":%d,\"errno\":%d}", item->failure.operation, item->failure.result, item->failure.error);
    else printf("null");
    printf("}");
  }
  printf("],\"unprivileged\":{\"credentialDropComplete\":%s,\"rootRestorationDenied\":%s,\"newSessionDenied\":%s,\"foreignSessionDenied\":%s,"
    "\"auditIdentityStable\":%s,\"grandchildWaitStatus\":%s,\"grandchildRecordReceived\":%s,\"forkIdentityMatches\":%s,\"setsidSucceeded\":%s,\"detachedIdentityMatches\":%s,\"grandchildCredentialsMatch\":%s},"
    "\"observerSignalsIssued\":false,\"accountCreated\":false,\"globalAuditConfigurationChanged\":false,\"exclusiveUidLeaseProven\":false,"
    "\"globalSessionEmptinessProven\":false,\"forcedIdentifierReuseProven\":false,\"descendantOrServiceContainmentProven\":false,"
    "\"guardianAccepted\":false,\"browserOrSimulatorExecution\":false,\"qualification\":false,\"observerApiFailure\":",
    observed_boolean(a_available, a->drop_complete), observed_boolean(a_available, a->root_restore_denied),
    observed_boolean(a_available, a->new_session_denied), observed_boolean(a_available, a->foreign_session_denied),
    observed_boolean(a_available, a->identity_stable), grand_status, observed_boolean(a_available, a->grand_record_received),
    observed_boolean(a_available && a->grand_record_received, a->grand.before_match),
    observed_boolean(a_available && a->grand_record_received, a->grand.setsid_ok),
    observed_boolean(a_available && a->grand_record_received, a->grand.after_match),
    observed_boolean(a_available && a->grand_record_received, a->grand.credentials_match));
  if (failure.available) printf("{\"operation\":\"%s\",\"returnCode\":%d,\"errno\":%d}", failure.operation, failure.result, failure.error);
  else printf("null");
  printf("}\n");
  return success ? 0 : 1;
}
