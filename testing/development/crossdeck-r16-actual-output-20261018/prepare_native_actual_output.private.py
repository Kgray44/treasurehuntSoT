"""Create-only offline original-ZIP verification, extraction and C16 projection.

No network, browser, DB, repository mutation or qualification. Run only against
the provider-original artifact and isolated exact source checkouts in the contract.
"""
import argparse
import datetime
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import stat
import subprocess
import sys
import zipfile

os.umask(0o077)
EXPECTED = {
    'bytes': 543172413,
    'sha256': '7f7006aa7fb39ed52a871015205285438fb26286ee6f6a9acb7195f1f6df7dd2',
    'base': 'ea0918e0eb176507fe7cf8a41490ada9c51d0852',
    'candidate': 'b1f06c10d3f2709cda366c266137fc38f4eb1df4',
    'candidateTree': 'a35ec3a926ea5ccd900f6c1a21f234070ad0a72c',
    'repair': '8a035ecb6a3ee4a941cbbe0f29b57362e164e01f',
    'repairTree': '025a5efd6a6f14513035fbf2c235a3b818194fef',
    'sourceDigest': 'ffdcc90ae07e8d178bd76cf2de9d083d71763931ce3a372ddc0e3b845b88d25f',
    'contractDigest': 'befbdf5fa900b58f2a706c94a80861bb1819fbb045c17bb00756fa83b9b4af3d',
    'recordDigest': '49234c32a1c2ff0125cc8f9618c19df2029843a9a934fc3d9126f9592f5eb148',
    'publisherDigest': 'fcfbeb4e4e4752dd171b6b472e84528864c4157c2121ce7fe1b51fbd211502e0',
}
CANONICAL = 'Development_Docs/Testing/Product_Experience/evidence'
EXTERNAL = 'Development_Docs/Testing/Product_Experience/candidate-review.json'
MEMBERS = {
    'plan': 'product-experience-submission/plan.json',
    'capture': 'product-experience-capture-staging/capture-xvYUrw/capture/capture.json',
    'journal': 'product-experience-capture-publication/capture-xvYUrw/journal.json',
}


def need(value, code):
    if not value:
        raise ValueError('NATIVE_ACTUAL_INTAKE_' + code)


def sha256(raw):
    return hashlib.sha256(raw).hexdigest()


def fingerprint(file):
    before = file.lstat()
    need(stat.S_ISREG(before.st_mode) and not file.is_symlink(), 'REGULAR_INPUT_REQUIRED')
    digest = hashlib.sha256()
    count = 0
    with file.open('rb') as stream:
        while True:
            chunk = stream.read(1024 * 1024)
            if not chunk:
                break
            count += len(chunk)
            digest.update(chunk)
    after = file.lstat()
    need((before.st_dev, before.st_ino, before.st_size, before.st_mtime_ns) ==
         (after.st_dev, after.st_ino, after.st_size, after.st_mtime_ns), 'INPUT_CHANGED')
    return {'bytes': count, 'sha256': digest.hexdigest()}


def safe(name):
    need(isinstance(name, str) and name and '\\' not in name and ':' not in name and
         not any(ord(c) < 32 or ord(c) == 127 for c in name), 'MEMBER_PATH')
    parts = name.split('/')
    need(not PurePosixPath(name).is_absolute() and all(p not in ('', '.', '..') for p in parts), 'MEMBER_PATH')
    return name


env = {k: v for k, v in os.environ.items()
       if not k.startswith(('GIT_', 'GH_', 'GITHUB_', 'SOUNDING_LINE_'))}
env.update({'GIT_NO_LAZY_FETCH': '1', 'GIT_OPTIONAL_LOCKS': '0'})


def git(root, *parts):
    return subprocess.check_output(['git', '-C', str(root), *parts], env=env)


def nested(first, second):
    first, second = os.path.normcase(str(first)), os.path.normcase(str(second))
    try:
        return os.path.commonpath([first, second]) == second
    except ValueError:  # Separate Windows volumes cannot overlap.
        return False


parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--archive', required=True)
parser.add_argument('--original-authority-root', required=True)
parser.add_argument('--repair-authority-root', required=True)
parser.add_argument('--candidate-root', required=True)
parser.add_argument('--output', required=True, help='New private directory; never reused')
args = parser.parse_args()
archive = Path(args.archive).absolute()
roots = {k: Path(v).resolve() for k, v in {
    'original': args.original_authority_root,
    'repair': args.repair_authority_root,
    'candidate': args.candidate_root,
}.items()}
output = Path(args.output).absolute()
need(not output.exists() and output.parent.exists(), 'CREATE_ONLY_OUTPUT_REQUIRED')
need(output.parent.resolve() == output.parent, 'OUTPUT_PARENT_LINK')
protected_directories = [*roots.values(), archive.parent.resolve()]
for source_root in roots.values():
    git_dir = Path(git(source_root, 'rev-parse', '--absolute-git-dir').decode().strip()).resolve()
    common = Path(git(source_root, 'rev-parse', '--git-common-dir').decode().strip())
    common_dir = common.resolve() if common.is_absolute() else (source_root / common).resolve()
    protected_directories.extend([git_dir, common_dir])
for protected in protected_directories:
    need(not nested(output, protected) and not nested(protected, output), 'OUTPUT_INPUT_OR_REPOSITORY_OVERLAP')
output.mkdir(mode=0o700)


def write_json(name, value):
    raw = (json.dumps(value, indent=2) + '\n').encode()
    file = output / name
    with file.open('xb') as stream:
        stream.write(raw)
    file.chmod(0o600)
    return {'path': str(file.resolve()), 'bytes': len(raw), 'sha256': sha256(raw)}


phase = 'ORIGINAL_IDENTITY'
started = datetime.datetime.now(datetime.timezone.utc).isoformat()
try:
    original_pin = fingerprint(archive)
    need(original_pin == {'bytes': EXPECTED['bytes'], 'sha256': EXPECTED['sha256']}, 'ORIGINAL_MISMATCH')
    for kind, expected in [('original', EXPECTED['base']), ('repair', EXPECTED['repair']), ('candidate', EXPECTED['candidate'])]:
        need(git(roots[kind], 'rev-parse', 'HEAD').decode().strip() == expected, kind.upper() + '_HEAD')
    need(git(roots['candidate'], 'rev-parse', 'HEAD^{tree}').decode().strip() == EXPECTED['candidateTree'], 'CANDIDATE_TREE')
    need(git(roots['repair'], 'rev-parse', 'HEAD^{tree}').decode().strip() == EXPECTED['repairTree'], 'REPAIR_TREE')
    candidate_git_dir = git(roots['candidate'], 'rev-parse', '--absolute-git-dir').decode().strip()
    candidate_index_before = sha256(git(roots['candidate'], 'ls-files', '--stage', '-z'))
    registry_raw = git(roots['original'], 'show', EXPECTED['base'] + ':testing/product-experience-exceptions.json')
    need(sha256(registry_raw) == 'a3638c208b5e38c89db2391718b491333d3583bf829b7c7941b69748ba5d7c46', 'REGISTRY_BYTES')
    records = json.loads(registry_raw)['exceptions']
    phase = 'CENTRAL_DIRECTORY_AND_SPACE'
    with zipfile.ZipFile(archive, 'r') as z:
        entries = z.infolist()
        files = []
        seen = set()
        folded = set()
        for entry in entries:
            name = safe(entry.filename[:-1] if entry.is_dir() else entry.filename)
            need(name not in seen and name.casefold() not in folded, 'DUPLICATE_OR_CASE_COLLISION')
            seen.add(name)
            folded.add(name.casefold())
            mode = entry.external_attr >> 16
            need(not stat.S_ISLNK(mode) and stat.S_IFMT(mode) in (0, stat.S_IFREG, stat.S_IFDIR), 'SPECIAL_MEMBER')
            need(not entry.flag_bits & 1, 'ENCRYPTED_ZIP_MEMBER')
            if not entry.is_dir():
                need(entry.file_size <= 512 * 1024 * 1024, 'MEMBER_SIZE_BOUND')
                files.append(entry)
        need(len(files) == 529, 'ORIGINAL_FILE_COUNT')
        uncompressed = sum(e.file_size for e in files)
        need(uncompressed <= 2 * 1024**3, 'UNCOMPRESSED_BOUND')
        for member in MEMBERS.values():
            need(member in {e.filename for e in files}, 'REQUIRED_MEMBER_MISSING')
        capture = json.loads(z.read(MEMBERS['capture']))
        plan = json.loads(z.read(MEMBERS['plan']))
        journal = json.loads(z.read(MEMBERS['journal']))
        working = safe(journal['workingDirectory'])
        need(re.fullmatch(r'artifacts/sounding-line/product-experience-capture-staging/capture-[A-Za-z0-9_-]+/capture', working), 'ORIGINAL_SCOPE')
        record = next(row for row in records if row['id'] == plan['exception']['id'])
        need(plan['exception']['recordDigest'] == EXPECTED['recordDigest'], 'RECORD_BINDING')
        need(plan['baseSha'] == EXPECTED['base'] and plan['candidateSha'] == EXPECTED['candidate'], 'PLAN_TUPLE')
        need(plan['sourceDigest'] == EXPECTED['sourceDigest'] and plan['contractDigest'] == EXPECTED['contractDigest'], 'PLAN_DIGESTS')
        json_targets = [f for f in record['currentSourceAdmission']['publicationFiles'] if f.startswith(CANONICAL + '/')]
        media = set()
        for artifact in capture['artifacts']:
            name = safe(artifact['path'])
            need(name.startswith(working + '/'), 'MEDIA_SCOPE')
            media.add(CANONICAL + name[len(working):])
        need(len(json_targets) == 25 and len(media) == 298, 'SELECTED_CLOSURE_COUNTS')
        target_paths = sorted(set(json_targets) | media | {EXTERNAL})
        tracked = {}
        for row in git(roots['candidate'], 'ls-tree', '-r', '-z', EXPECTED['candidate'], '--', CANONICAL, EXTERNAL).split(b'\0'):
            if not row:
                continue
            meta, name = row.split(b'\t', 1)
            mode, kind, oid = meta.decode().split()
            tracked[name.decode()] = {'mode': mode, 'kind': kind, 'oid': oid}
        projection_bytes = sum(int(git(roots['candidate'], 'cat-file', '-s', tracked[n]['oid'])) for n in target_paths if n in tracked)
        stage_prefix = str(PurePosixPath(MEMBERS['capture']).parent) + '/'
        stage_bytes = sum(e.file_size for e in files if e.filename.startswith(stage_prefix))
        selected_bytes = sum(e.file_size for e in files if e.filename.startswith(stage_prefix) and
                             CANONICAL + '/' + e.filename[len(stage_prefix):] in set(json_targets) | media)
        # One original-control root and one repaired root. Raw/encryption are
        # produced once; all three ready/preimage journals remain preserved.
        # Round encrypted raw up to 2x plus a 512MiB metadata/JSON margin.
        conservative_future = (uncompressed + 5 * projection_bytes +
                               4 * stage_bytes + 4 * selected_bytes +
                               max(projection_bytes, selected_bytes) + 512 * 1024**2)
        free = shutil.disk_usage(output).free
        space = {'uncompressedOriginalBytes': uncompressed, 'stageBytes': stage_bytes,
                 'selectedStageBytes': selected_bytes, 'projectionBytes': projection_bytes,
                 'conservativeRequiredFreeBytes': conservative_future, 'actualFreeBytes': free}
        write_json('space-preflight.private.json', space)
        need(free >= conservative_future, 'INSUFFICIENT_SPACE_PRESERVE_ALL_CASES')
        phase = 'FULL_CRC_VERIFIED_EXTRACTION'
        extracted = output / 'extracted-original'
        extracted.mkdir(mode=0o700)
        members = []
        for entry in files:
            destination = extracted.joinpath(*PurePosixPath(entry.filename).parts)
            destination.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
            digest = hashlib.sha256()
            count = 0
            with z.open(entry, 'r') as source, destination.open('xb') as target:
                while True:
                    chunk = source.read(1024 * 1024)
                    if not chunk:
                        break
                    count += len(chunk)
                    need(count <= entry.file_size, 'MEMBER_GREW')
                    digest.update(chunk)
                    target.write(chunk)
            need(count == entry.file_size, 'MEMBER_SIZE_MISMATCH')
            destination.chmod(0o644)
            members.append({'path': entry.filename, 'bytes': count, 'sha256': digest.hexdigest(), 'crc32': f'{entry.CRC:08x}'})
        need(fingerprint(archive) == original_pin, 'ORIGINAL_CHANGED_AFTER_EXTRACTION')
        manifest = write_json('verified-extraction-manifest.private.json', {
            'version': 1, 'status': 'PASS', 'archive': {'path': str(archive), **original_pin},
            'checks': {'wholeOriginalSHA256': True, 'centralDirectoryComplete': True, 'allFilesCRCVerified': True},
            'files': members, 'qualification': False, 'acceptance': False,
        })
    phase = 'EXACT_C16_PREIMAGE_PROJECTION'
    projection = output / 'candidate-preimages'
    projection.mkdir(mode=0o700)
    projection_pins = []
    for name in target_paths:
        if name not in tracked:
            need(name != EXTERNAL, 'EXTERNAL_REVIEW_MISSING')
            continue
        metadata = tracked[name]
        need(metadata['mode'] == '100644' and metadata['kind'] == 'blob', 'PREIMAGE_TYPE')
        raw = git(roots['candidate'], 'cat-file', 'blob', metadata['oid'])
        need(hashlib.sha1(b'blob ' + str(len(raw)).encode() + b'\0' + raw).hexdigest() == metadata['oid'], 'PREIMAGE_BLOB')
        destination = projection.joinpath(*PurePosixPath(safe(name)).parts)
        destination.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
        with destination.open('xb') as stream:
            stream.write(raw)
        destination.chmod(0o644)
        projection_pins.append({'path': name, 'blob': metadata['oid'], 'bytes': len(raw), 'sha256': sha256(raw)})
    need(sha256(git(roots['candidate'], 'ls-files', '--stage', '-z')) == candidate_index_before, 'CANDIDATE_INDEX_CHANGED')
    need(fingerprint(archive) == original_pin, 'ORIGINAL_CHANGED_AFTER_PROJECTION')
    config = {
        'version': 1, 'acknowledgement': 'ACTUAL_BYTES_PUBLICATION_DIAGNOSTIC_ONLY',
        'originalZip': {'path': str(archive), **original_pin},
        'extraction': {'root': str(extracted.resolve()), 'manifestPath': manifest['path'], 'manifestSHA256': manifest['sha256']},
        'members': MEMBERS,
        'source': {'originalAuthorityRoot': str(roots['original']), 'originalAuthoritySha': EXPECTED['base'],
                   'repairAuthorityRoot': str(roots['repair']), 'repairSha': EXPECTED['repair'],
                   'repairTree': EXPECTED['repairTree'], 'candidateGitDir': candidate_git_dir,
                   'candidateTree': EXPECTED['candidateTree']},
        'preimageProjectionRoot': str(projection.resolve()), 'outputRoot': str(output.resolve() / 'publication-replay'),
        'expected': {'baseSha': EXPECTED['base'], 'candidateSha': EXPECTED['candidate'],
                     'sourceDigest': EXPECTED['sourceDigest'], 'contractDigest': EXPECTED['contractDigest'],
                     'recordDigest': EXPECTED['recordDigest'], 'strictPublisherSHA256': EXPECTED['publisherDigest'],
                     'preparationReservation': '9273d5951bbe20198b97bf87edb9532e7e216c1f',
                     'counts': {'originalFiles': 529, 'stageFiles': 527, 'jsonFiles': 25, 'uniqueMedia': 298,
                                'extras': 204, 'genericContexts': 32, 'pairedContexts': 6}},
    }
    config_pin = write_json('replay-configuration.private.json', config)
    result = write_json('intake-and-projection.actual.private.json', {
        'status': 'PASS', 'startedAt': started, 'completedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'originalArchive': {'path': str(archive), **original_pin}, 'extractionManifest': manifest,
        'config': config_pin, 'projection': projection_pins, 'spacePreflight': space,
        'repositoryMutation': False, 'browserExecution': False, 'qualification': False, 'acceptance': False,
    })
    print(json.dumps({'status': 'PASS_INTAKE_ONLY_NOT_PUBLICATION_ACCEPTANCE', 'result': result, 'configuration': config_pin}))
except BaseException as error:
    failure = write_json('intake-failure.actual.private.json', {
        'status': 'FAIL', 'phase': phase, 'errorType': type(error).__name__, 'message': str(error),
        'startedAt': started, 'completedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'outputsPreserved': True, 'originalArchiveModified': False, 'qualification': False, 'acceptance': False,
    })
    print(json.dumps({'status': 'FAIL', 'failure': failure}), file=sys.stderr)
    raise
