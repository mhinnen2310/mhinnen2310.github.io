import "dotenv/config";
import { spawnSync } from "node:child_process";
import { prisma } from "../src/lib/prisma";

async function main() {
  if (process.env.DEPLOYMENT_MODE !== "preview") {
    console.log("Preview bootstrap skipped: DEPLOYMENT_MODE is not preview.");
    return;
  }

  const [userCount, bikeCount, productCount, bikeImageCount, productImageCount] = await Promise.all([
    prisma.user.count(),
    prisma.bike.count(),
    prisma.product.count(),
    prisma.bikeImage.count(),
    prisma.productImage.count(),
  ]);
  const previewSeedIsComplete =
    userCount >= 2 && bikeCount >= 7 && productCount >= 6 && bikeImageCount > 0 && productImageCount > 0;
  if (previewSeedIsComplete) {
    console.log("Preview bootstrap skipped: complete demo data is already present.");
    return;
  }

  console.log(
    userCount === 0
      ? "Empty preview database detected; inserting demo data once."
      : "Incomplete preview seed detected; rebuilding the demo data once.",
  );
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
