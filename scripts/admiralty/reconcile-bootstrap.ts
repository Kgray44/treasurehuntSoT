import { bootstrapInputFromEnvironment, reconcileAdmiraltyBootstrap } from "../../src/admiralty/bootstrap";

const commit = process.argv.includes("--commit");
const result = await reconcileAdmiraltyBootstrap(bootstrapInputFromEnvironment(), { commit });
console.log(JSON.stringify(result, null, 2));
