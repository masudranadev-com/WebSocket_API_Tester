import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");

const copyTargets = [
  ".env.example",
  ".nvmrc",
  ".editorconfig",
  "LICENSE",
  "README.md",
  "public",
  "src",
  "views"
];

await rm(distDir, { recursive: true, force: true });
await mkdir(distDir, { recursive: true });

for (const target of copyTargets) {
  await cp(path.join(rootDir, target), path.join(distDir, target), {
    recursive: true
  });
}

const packageJson = JSON.parse(await readFile(path.join(rootDir, "package.json"), "utf8"));
const distPackage = {
  name: packageJson.name,
  version: packageJson.version,
  description: packageJson.description,
  type: packageJson.type,
  main: packageJson.main,
  license: packageJson.license,
  engines: packageJson.engines,
  keywords: packageJson.keywords,
  scripts: {
    start: "node src/server.js"
  },
  dependencies: packageJson.dependencies
};

await writeFile(path.join(distDir, "package.json"), `${JSON.stringify(distPackage, null, 2)}\n`, "utf8");

console.log(`Production bundle created in ${distDir}`);
