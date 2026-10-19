# The Job handle is an ownership lease: closing it kills every payload descendant.
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading;
public static class SoundingLineOwnedJob {
  [StructLayout(LayoutKind.Sequential)] struct STARTUPINFO {
    public int cb; public IntPtr reserved, desktop, title;
    public int x,y,xSize,ySize,xChars,yChars,fill,flags;
    public short show, reservedSize; public IntPtr reservedBytes, input, output, error;
  }
  [StructLayout(LayoutKind.Sequential)] struct PROCESSINFO { public IntPtr process, thread; public int pid, tid; }
  [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)]
  static extern bool CreateProcess(string app, StringBuilder cmd, IntPtr pa, IntPtr ta, bool inherit,
    uint flags, IntPtr env, string cwd, ref STARTUPINFO startup, out PROCESSINFO process);
  [DllImport("kernel32.dll", SetLastError=true)] static extern IntPtr CreateJobObject(IntPtr attr, string name);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool SetInformationJobObject(IntPtr job, int cls, IntPtr info, uint size);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool QueryInformationJobObject(IntPtr job, int cls, IntPtr info, uint size, IntPtr returned);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);
  [DllImport("kernel32.dll")] static extern bool TerminateJobObject(IntPtr job, uint code);
  [DllImport("kernel32.dll")] static extern bool TerminateProcess(IntPtr process, uint code);
  [DllImport("kernel32.dll")] static extern uint ResumeThread(IntPtr thread);
  [DllImport("kernel32.dll")] static extern uint WaitForSingleObject(IntPtr handle, uint ms);
  [DllImport("kernel32.dll")] static extern bool GetExitCodeProcess(IntPtr process, out uint code);
  [DllImport("kernel32.dll")] static extern IntPtr GetStdHandle(int handle);
  [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)]
  static extern IntPtr CreateFile(string name, uint access, uint share, IntPtr security, uint disposition, uint flags, IntPtr template);
  [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool SetHandleInformation(IntPtr handle, uint mask, uint flags);
  static string Quote(string value) {
    var result = new StringBuilder("\""); int slashes = 0;
    foreach (char c in value) {
      if (c == '\\') { slashes++; continue; }
      if (c == '"') { result.Append('\\', slashes * 2 + 1); result.Append(c); }
      else { result.Append('\\', slashes); result.Append(c); }
      slashes = 0;
    }
    result.Append('\\', slashes * 2); return result.Append('"').ToString();
  }
  static int Active(IntPtr job) {
    IntPtr info = Marshal.AllocHGlobal(48);
    try {
      if (!QueryInformationJobObject(job, 1, info, 48, IntPtr.Zero)) throw new Exception("JOB_QUERY_FAILED");
      return Marshal.ReadInt32(info, 40);
    } finally { Marshal.FreeHGlobal(info); }
  }
  public static int Run(string command, string[] args, string receiptPath) {
    IntPtr job = CreateJobObject(IntPtr.Zero, null);
    IntPtr input = IntPtr.Zero;
    var child = new PROCESSINFO(); bool assigned = false;
    try {
      if (job == IntPtr.Zero) throw new Exception("JOB_CREATE_FAILED");
      // JOBOBJECT_EXTENDED_LIMIT_INFORMATION, x64: BasicLimitInformation.LimitFlags offset 16.
      int size = IntPtr.Size == 8 ? 144 : 112;
      IntPtr limits = Marshal.AllocHGlobal(size);
      try {
        for (int i = 0; i < size; i++) Marshal.WriteByte(limits, i, 0);
        Marshal.WriteInt32(limits, 16, 0x2000); // JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
        if (!SetInformationJobObject(job, 9, limits, (uint)size)) throw new Exception("JOB_LIMIT_FAILED");
      } finally { Marshal.FreeHGlobal(limits); }
      var si = new STARTUPINFO(); si.cb = Marshal.SizeOf(si); si.flags = 0x100;
      input = CreateFile("NUL", 0x80000000, 3, IntPtr.Zero, 3, 0, IntPtr.Zero);
      if (input == new IntPtr(-1)) throw new Exception("OWNED_STDIN_FAILED");
      if (!SetHandleInformation(input, 1, 1)) throw new Exception("OWNED_STDIN_INHERIT_FAILED");
      si.input = input; si.output = GetStdHandle(-11); si.error = GetStdHandle(-12);
      var line = new StringBuilder(Quote(command)); foreach (string arg in args) line.Append(" ").Append(Quote(arg));
      if (!CreateProcess(command, line, IntPtr.Zero, IntPtr.Zero, true, 0x08000004, IntPtr.Zero, null, ref si, out child))
        throw new Exception("OWNED_PROCESS_CREATE_FAILED");
      if (!AssignProcessToJobObject(job, child.process)) throw new Exception("JOB_ASSIGN_FAILED");
      assigned = true;
      if (ResumeThread(child.thread) == 0xffffffff) throw new Exception("OWNED_PROCESS_RESUME_FAILED");
      // Parent closes stdin on cancellation or death; this also ends the lease.
      var stop = System.Threading.Tasks.Task.Run(() => Console.In.ReadLine());
      while (WaitForSingleObject(child.process, 20) != 0 && !stop.IsCompleted) { }
      uint code; GetExitCodeProcess(child.process, out code);
      bool terminated = Active(job) > 0;
      if (terminated && !TerminateJobObject(job, 1)) throw new Exception("JOB_TERMINATE_FAILED");
      var end = DateTime.UtcNow.AddSeconds(3);
      while (Active(job) != 0 && DateTime.UtcNow < end) Thread.Sleep(10);
      bool empty = Active(job) == 0;
      File.WriteAllText(receiptPath, "{\"treeReaped\":" + (empty ? "true" : "false") +
        ",\"terminated\":" + (terminated ? "true" : "false") +
        ",\"payloadExitCode\":" + (code == 259 ? "null" : code.ToString()) + "}");
      return empty ? (code == 259 ? 1 : (int)code) : 1;
    } finally {
      if (!assigned && child.process != IntPtr.Zero) TerminateProcess(child.process, 1);
      if (job != IntPtr.Zero) CloseHandle(job);
      if (input != IntPtr.Zero && input != new IntPtr(-1)) CloseHandle(input);
      if (child.process != IntPtr.Zero) CloseHandle(child.process);
      if (child.thread != IntPtr.Zero) CloseHandle(child.thread);
    }
  }
}
'@
try {
  $ownedLaunch = [Console]::In.ReadLine() | ConvertFrom-Json
  exit ([SoundingLineOwnedJob]::Run($ownedLaunch.command, [string[]]$ownedLaunch.args, $ownedLaunch.receiptPath))
} catch {
  [Console]::Error.WriteLine('SOUNDING_LINE_WINDOWS_JOB_FAILURE')
  exit 1
}
