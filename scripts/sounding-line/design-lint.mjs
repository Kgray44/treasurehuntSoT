import { promises as fs } from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = process.cwd();
const registry = JSON.parse(await fs.readFile(path.join(root, "testing/generated/active-test-registry.json"), "utf8"));
const capabilities = JSON.parse(await fs.readFile(path.join(root, "testing/browser-capabilities.json"), "utf8"));
const registered = new Set(registry.cases.map((entry) => `${entry.file}:${entry.line}`));
const files = [...new Set(registry.cases.map((entry) => entry.file))];
const errors = [];
for (const file of files) {
  const source = ts.createSourceFile(
    file,
    await fs.readFile(path.join(root, file), "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  const visit = (node) => {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const name = node.expression.name.text;
      const base = node.expression.expression.getText(source);
      const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
      if (["test", "it", "describe"].includes(base) && name === "only")
        errors.push(`${file}:${line}: forbidden ${base}.only`);
      if (["test", "it", "describe"].includes(base) && name === "skip") {
        const conditional = node.arguments.length > 1 && !ts.isStringLiteralLike(node.arguments[0]);
        const governed = capabilities.capabilities.some((capability) => capability.files.includes(file));
        if (!conditional) errors.push(`${file}:${line}: forbidden unconditional ${base}.skip`);
        else if (!governed) errors.push(`${file}:${line}: ungoverned conditional ${base}.skip`);
      }
      if (name === "waitForTimeout") errors.push(`${file}:${line}: arbitrary browser wait`);
    }
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      ["test", "it"].includes(node.expression.text)
    ) {
      const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
      if (!registered.has(`${file}:${line}`)) errors.push(`${file}:${line}: unregistered test case`);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}
if (errors.length) {
  process.stderr.write(`${errors.join("\n")}\n`);
  process.exit(1);
}
console.log(`Sounding Line design lint passed for ${registry.cases.length} registered cases.`);
