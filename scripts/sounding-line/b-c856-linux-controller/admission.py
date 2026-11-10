"""Fixed source and runner admission for the B-C856 diagnostic controller."""
import os
import re
from pathlib import Path

GIB = 1 << 30
MIB = 1 << 20
MAX_CAPSULE = 6 * GIB
MAX_ARCHIVE = 2 * GIB
MAX_ORIGINALS = 128 * MIB
# Up to 120,000 rounded file blocks, 24 MiB manifest, inode/directory
# overhead, evidence sidecars and temporary package verification.
ALLOCATOR_MARGIN = 1 * GIB
RESERVE = 2 * GIB
MAX_ADDITIONAL = 12 * GIB
SOURCE = "31181b7b94816b0cf22c79bcebbaecb24e01eec9"
TREE = "1f92226da882098af1fdd6d42a3e43927f6ad676"
V3_SHA256 = "84be75e7a0f97e63a5953c3491142d4cbbd6531f5ef71350478ef5795753bb13"
V3_PACKAGE_SHA256 = "8811cf2c10e4dab8573594260d0029b6209395491eab0121297d311acda8f37f"
REPOSITORY = "Kgray44/treasurehuntSoT"
ACTOR = "Kgray44"
ARTIFACT_NAME = "sounding-line-b-c856-runtime-capsule"
WORKFLOW_PATH = ".github/workflows/sounding-line-b-c856-runtime-producer.yml"
SHA256 = re.compile(r"[a-f0-9]{64}\Z")
GIT_SHA = re.compile(r"[a-f0-9]{40}\Z")


class BudgetError(ValueError):
    pass


def need(condition, code):
    if not condition:
        raise BudgetError(code)


def storage_plan(total, free, archive, capsule, *, archive_already_allocated=False):
    need(all(type(value) is int for value in (total, free, archive, capsule)), "STORAGE_INTEGER")
    need(0 < free <= total and 0 < archive <= MAX_ARCHIVE and 0 < capsule <= MAX_CAPSULE, "STORAGE_BOUNDS")
    additional = (0 if archive_already_allocated else archive) + capsule + MAX_ORIGINALS + ALLOCATOR_MARGIN
    need(additional <= MAX_ADDITIONAL and free - additional >= RESERVE, "RUNNER_FREE_SPACE")
    return {"archiveAlreadyAllocated": archive_already_allocated, "filesystemTotalBytes": total, "availableBeforeBytes": free, "archiveBytes": archive,
            "capsuleBytes": capsule, "retainedOriginalsCapBytes": MAX_ORIGINALS,
            "allocationMarginBytes": ALLOCATOR_MARGIN, "projectedAdditionalBytes": additional,
            "projectedFreeAfterBytes": free - additional, "requiredReserveBytes": RESERVE}


def available(path):
    st = os.statvfs(path)
    need(0 < st.f_frsize <= 4096, "UNSUPPORTED_FILESYSTEM_BLOCK_SIZE")
    return st.f_blocks * st.f_frsize, st.f_bavail * st.f_frsize


def artifact_identity(chosen, run, artifact):
    need(type(chosen["run"]) is int and chosen["run"] > 0 and type(chosen["artifact"]) is int and
         chosen["artifact"] > 0 and type(chosen["workflow"]) is int and chosen["workflow"] > 0 and
         0 < chosen["bytes"] <= MAX_ARCHIVE and SHA256.fullmatch(chosen["sha256"]) and
         GIT_SHA.fullmatch(chosen["producer"]), "APPROVED_ARTIFACT_INPUT")
    repository = run["repository"]
    head = run["head_repository"]
    need(repository["full_name"] == head["full_name"] == REPOSITORY and
         type(repository["id"]) is int and repository["id"] == head["id"], "PRODUCER_REPOSITORY")
    need(run["id"] == chosen["run"] and run["workflow_id"] == chosen["workflow"] and
         run["head_sha"] == chosen["producer"] and run["head_branch"] == "main" and
         run["run_attempt"] == 1 and run["status"] == "completed" and
         run["conclusion"] == "success" and run["event"] == "workflow_dispatch" and
         run["actor"]["login"] == run["triggering_actor"]["login"] == ACTOR, "PRODUCER_RUN")
    linked = artifact["workflow_run"]
    need(artifact["id"] == chosen["artifact"] and artifact["name"] == ARTIFACT_NAME and
         artifact["expired"] is False and artifact["digest"] == "sha256:" + chosen["sha256"] and
         artifact["size_in_bytes"] == chosen["bytes"] and linked["id"] == chosen["run"] and
         linked["head_sha"] == chosen["producer"] and linked["repository_id"] == repository["id"] and
         linked["head_repository_id"] == repository["id"], "PROVIDER_ARTIFACT")
    return repository["id"]
