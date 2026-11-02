// Native-observed denial and descriptor primitives, with the frame writer
// renamed. The production adapter never imports the pilot controller.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const need = (ok, code) => {
  if (!ok) throw Error(`SOUNDING_LINE_CUSTODY_PROOF_${code}`);
};
const singleLink = (stat) => stat.isFile() && stat.nlink === 1n;
const signature = (stat) =>
  [stat.dev, stat.ino, stat.mode, stat.nlink, stat.size, stat.mtimeNs, stat.ctimeNs].map(String).join(":");
export function custodyShadowPreload(filename, gitPath) {
  need(path.isAbsolute(filename) && path.isAbsolute(gitPath), "PRELOAD_PATH");
  return [
    "const fs=require('node:fs'), cp=require('node:child_process');",
    "const counts={fetchAttempts:0,networkAttempts:0,nonGitProcessAttempts:0,gitCalls:0};",
    "globalThis.fetch=()=>{counts.fetchAttempts++;throw Error('CUSTODY_SHADOW_NETWORK_FORBIDDEN')};",
    "const deny=()=>{counts.networkAttempts++;throw Error('CUSTODY_SHADOW_NETWORK_FORBIDDEN')};",
    "for(const [name,methods]of[['node:net',['connect','createConnection']],['node:tls',['connect']],['node:http',['request','get']],['node:https',['request','get']],['node:dgram',['createSocket']]]){const value=require(name);for(const method of methods)value[method]=deny;}",
    "require('node:net').Socket.prototype.connect=deny;",
    "require('node:net').Server.prototype.listen=deny;",
    "for(const dns of[require('node:dns'),require('node:dns').promises]){for(const name of Object.keys(dns))if(/^(?:lookup|resolve|reverse)/.test(name)&&typeof dns[name]==='function')dns[name]=deny;const Resolver=dns.Resolver;if(Resolver)for(const name of Object.getOwnPropertyNames(Resolver.prototype))if(/^(?:lookup|resolve|reverse)/.test(name))Resolver.prototype[name]=deny;}",
    `const git=${JSON.stringify(gitPath)};`,
    "const allowed=new Set(['ls-tree','show','merge-base','rev-parse','diff','diff-tree','log','cat-file','status']);",
    "for(const method of ['execFileSync','spawnSync','execFile','spawn']){const original=cp[method];cp[method]=function(command,args,...rest){if((command!==git&&command!=='git')||!Array.isArray(args)||!allowed.has(args[0])){counts.nonGitProcessAttempts++;throw Error('CUSTODY_SHADOW_PROCESS_FORBIDDEN')}counts.gitCalls++;return original.call(this,command,args,...rest)}}",
    "for(const method of ['exec','execSync','fork'])cp[method]=()=>{counts.nonGitProcessAttempts++;throw Error('CUSTODY_SHADOW_PROCESS_FORBIDDEN')};",
    "require('node:module').syncBuiltinESMExports();",
    `process.on('exit',()=>fs.writeFileSync(${JSON.stringify(filename)},JSON.stringify(counts),{flag:'wx'}));`,
  ].join("\n");
}
export function readCustodyPilotSource(filename) {
  need(fs.realpathSync.native(filename) === path.resolve(filename), "SOURCE_ALIAS");
  let fd, failure, bytes;
  try {
    fd = fs.openSync(filename, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0) | (fs.constants.O_NONBLOCK || 0));
    const before = fs.fstatSync(fd, { bigint: true });
    need(
      singleLink(before) &&
        before.size <= 16n * 1024n ** 2n &&
        signature(before) === signature(fs.lstatSync(filename, { bigint: true })),
      "SOURCE_FILE",
    );
    bytes = Buffer.alloc(Number(before.size));
    let offset = 0;
    while (offset < bytes.length) {
      const count = fs.readSync(fd, bytes, offset, Math.min(65536, bytes.length - offset), offset);
      need(count > 0, "SOURCE_TRUNCATED");
      offset += count;
    }
    need(
      signature(fs.fstatSync(fd, { bigint: true })) === signature(before) &&
        signature(fs.lstatSync(filename, { bigint: true })) === signature(before) &&
        fs.realpathSync.native(filename) === path.resolve(filename),
      "SOURCE_CHANGED",
    );
  } catch (error) {
    failure = error;
  }
  if (fd !== undefined)
    try {
      fs.closeSync(fd);
    } catch (error) {
      if (failure)
        throw new AggregateError([failure, error], "CUSTODY_SOURCE_READ_AND_CLOSE_FAILED", { cause: failure });
      throw error;
    }
  if (failure) throw failure;
  return bytes;
}

export function retainCustodyProofFrame(filename, bytes) {
  need(path.isAbsolute(filename) && Buffer.isBuffer(bytes) && bytes.length <= 16 * 1024 ** 2, "FRAME_BOUND");
  const parent = path.dirname(filename),
    directory = fs.lstatSync(parent, { bigint: true });
  need(
    fs.realpathSync.native(parent) === path.resolve(parent) && directory.isDirectory() && !directory.isSymbolicLink(),
    "FRAME_PARENT",
  );
  const sameParent = () => {
    const current = fs.lstatSync(parent, { bigint: true });
    need(
      current.dev === directory.dev &&
        current.ino === directory.ino &&
        fs.realpathSync.native(parent) === path.resolve(parent),
      "FRAME_PARENT_CHANGED",
    );
  };
  let fd, failure, pinned;
  try {
    sameParent();
    fd = fs.openSync(
      filename,
      fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | (fs.constants.O_NOFOLLOW || 0),
      0o600,
    );
    let offset = 0;
    while (offset < bytes.length) {
      const count = fs.writeSync(fd, bytes, offset, Math.min(65536, bytes.length - offset));
      need(count > 0, "FRAME_SHORT_WRITE");
      offset += count;
    }
    fs.fsyncSync(fd);
    const stat = fs.fstatSync(fd, { bigint: true });
    need(
      singleLink(stat) &&
        stat.size === BigInt(bytes.length) &&
        signature(stat) === signature(fs.lstatSync(filename, { bigint: true })),
      "FRAME_WRITE_CHANGED",
    );
    pinned = signature(stat);
    sameParent();
  } catch (error) {
    failure = error;
  }
  if (fd !== undefined)
    try {
      fs.closeSync(fd);
    } catch (error) {
      if (failure)
        throw new AggregateError([failure, error], "CUSTODY_FRAME_WRITE_AND_CLOSE_FAILED", { cause: failure });
      throw error;
    }
  if (failure) throw failure;
  fd = undefined;
  try {
    sameParent();
    fd = fs.openSync(filename, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0) | (fs.constants.O_NONBLOCK || 0));
    need(signature(fs.fstatSync(fd, { bigint: true })) === pinned, "FRAME_READ_CHANGED");
    const actual = createHash("sha256"),
      buffer = Buffer.alloc(65536);
    let total = 0,
      count;
    while ((count = fs.readSync(fd, buffer, 0, buffer.length, null)) > 0) {
      total += count;
      need(total <= bytes.length, "FRAME_READ_BOUND");
      actual.update(buffer.subarray(0, count));
    }
    need(
      total === bytes.length &&
        actual.digest("hex") === hash(bytes) &&
        signature(fs.fstatSync(fd, { bigint: true })) === pinned &&
        signature(fs.lstatSync(filename, { bigint: true })) === pinned,
      "FRAME_READBACK_CHANGED",
    );
    sameParent();
  } catch (error) {
    failure = error;
  }
  if (fd !== undefined)
    try {
      fs.closeSync(fd);
    } catch (error) {
      if (failure)
        throw new AggregateError([failure, error], "CUSTODY_FRAME_READ_AND_CLOSE_FAILED", { cause: failure });
      throw error;
    }
  if (failure) throw failure;
  return Object.freeze({ bytes: bytes.length, sha256: hash(bytes), completeReadback: true });
}
