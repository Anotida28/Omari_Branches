const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const backendRoot = path.resolve(__dirname, "..");
const prismaClientDir = path.join(backendRoot, "node_modules", ".prisma", "client");

function removeStalePrismaTempFiles(dir) {
  if (!fs.existsSync(dir)) {
    return 0;
  }

  const entries = fs.readdirSync(dir);
  const staleFiles = entries.filter((entry) => entry.startsWith("query_engine-") && entry.includes(".tmp"));

  staleFiles.forEach((entry) => {
    fs.rmSync(path.join(dir, entry), { force: true });
  });

  return staleFiles.length;
}

function runPrismaGenerate() {
  const prismaCli = path.join(backendRoot, "node_modules", "prisma", "build", "index.js");
  const result = spawnSync(process.execPath, [prismaCli, "generate"], {
    cwd: backendRoot,
    stdio: "inherit",
    shell: false,
  });

  if (result.error) {
    console.error(result.error);
    process.exit(1);
  }

  process.exit(result.status ?? 1);
}

const removed = removeStalePrismaTempFiles(prismaClientDir);
if (removed > 0) {
  console.log(`[prisma] Removed ${removed} stale Prisma temp engine file(s).`);
}

runPrismaGenerate();
