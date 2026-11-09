import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";

// Exact Windows binaries from the signed Git for Windows and GitHub CLI
// installations reviewed for this private console. An update requires a new pin.
const tools = {
  git: {
    file: path.join(os.homedir(), "AppData", "Local", "Programs", "Git", "mingw64", "bin", "git.exe"),
    bytes: 4422544,
    links: 4,
    sha256: "cab4c4eea1d869cf9f7be73868dc9a90ad2df1b1b673e5f8c8714a576c25ea96",
  },
  gh: {
    file: "C:\\Program Files\\GitHub CLI\\gh.exe",
    bytes: 40563000,
    links: 1,
    sha256: "e98a646f524d0094fac3a6c5866ebc8fdcca0461a11f4146525a15b853e60068",
  },
};
export function verifiedRegistryOwnerTool(name) {
  const tool = Object.hasOwn(tools, name) ? tools[name] : null;
  const fail = () => {
    throw Error("OWNER_CUSTODY_TOOL_IDENTITY");
  };
  if (process.platform !== "win32" || !tool || fs.realpathSync.native(tool.file) !== tool.file) fail();
  const named = fs.lstatSync(tool.file);
  if (!named.isFile() || named.isSymbolicLink() || named.nlink !== tool.links || named.size !== tool.bytes) fail();
  const fd = fs.openSync(tool.file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0));
  try {
    const same = (stat) =>
      ["dev", "ino", "size", "mtimeMs", "ctimeMs", "nlink"].every((key) => named[key] === stat[key]);
    if (!same(fs.fstatSync(fd))) fail();
    const bytes = Buffer.alloc(tool.bytes);
    let offset = 0;
    while (offset < bytes.length) {
      const count = fs.readSync(fd, bytes, offset, bytes.length - offset, offset);
      if (!count) fail();
      offset += count;
    }
    if (
      !same(fs.fstatSync(fd)) ||
      !same(fs.lstatSync(tool.file)) ||
      createHash("sha256").update(bytes).digest("hex") !== tool.sha256
    )
      fail();
    return tool.file;
  } finally {
    fs.closeSync(fd);
  }
}
