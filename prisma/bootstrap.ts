import "dotenv/config";
import { spawnSync } from "node:child_process";
import { prisma } from "../src/lib/prisma";

async function main() {
  if (process.env.DEPLOYMENT_MODE !== "preview") {
    console.log("Preview bootstrap skipped: DEPLOYMENT_MODE is not preview.");
    return;
  }

  const userCount = await prisma.user.count();
  if (userCount > 0) {
    console.log("Preview bootstrap skipped: the database already contains users.");
    return;
  }

  console.log("Empty preview database detected; inserting demo data once.");
  await prisma.$disconnect();

  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  const result = spawnSync(npmCommand, ["run", "db:seed"], {
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error(`Preview seed failed with exit code ${result.status ?? "unknown"}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
