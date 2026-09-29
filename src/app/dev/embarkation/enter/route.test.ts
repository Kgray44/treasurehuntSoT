import { afterEach, describe, expect, it, vi } from "vitest";
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import { GET } from "./route";
import path from "node:path";
describe("Embarkation screening isolation", () => {
  let fixtureTestRoot:string|undefined;
  afterEach(async () => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    if(fixtureTestRoot){
      const resolved=path.resolve(fixtureTestRoot);
      if(path.dirname(resolved)!==path.resolve(tmpdir()) || !path.basename(resolved).startsWith('embarkation-entry-test-'))throw new Error('Unexpected fixture cleanup path');
      await rm(resolved,{recursive:true,force:true});fixtureTestRoot=undefined;
    }
  });
  it("never opens a fixture session in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("EMBARKATION_PREVIEW", "1");
    const response = await GET(new Request("http://localhost/dev/embarkation/enter?role=captain"));
    expect(response.status).toBe(404);
    expect(response.headers.get("set-cookie")).toBeNull();
  });
  it("requires both the preview switch and this worktree's exact synthetic database", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("EMBARKATION_PREVIEW", "1");
    vi.stubEnv("DATABASE_URL", "file:/different/shared.sqlite");
    expect((await GET(new Request("http://localhost/dev/embarkation/enter"))).status).toBe(404);
  });
  it("opens only the fixed audit snapshot when audit isolation is requested", async () => {
    fixtureTestRoot=await mkdtemp(path.join(tmpdir(),'embarkation-entry-test-'));
    vi.spyOn(process,'cwd').mockReturnValue(fixtureTestRoot);
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("EMBARKATION_PREVIEW", "1");
    vi.stubEnv("EMBARKATION_AUDIT_FIXTURE", "1");
    vi.stubEnv("DATABASE_URL", `file:${path.resolve(".runtime/muster/muster.sqlite").replaceAll("\\", "/")}`);
    expect((await GET(new Request("http://localhost/dev/embarkation/enter"))).status).toBe(404);
    const root = path.resolve(".runtime/embarkation/audit-repair/fixture");
    vi.stubEnv("DATABASE_URL", `file:${path.join(root, "muster.sqlite").replaceAll("\\", "/")}`);
    await mkdir(root,{recursive:true});
    await writeFile(path.join(root,'fixture.json'),JSON.stringify({profiles:{captain:{token:'synthetic-fixture-token'}}}));
    const response=await GET(new Request("http://localhost/dev/embarkation/enter"));
    expect(response.status).toBe(307);
    expect(response.cookies.get('wayfarer_account')?.value).toBe('synthetic-fixture-token');
  });
});
