import sharp from "sharp";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Resizes the master logo into the PWA icon set.
// Usage: node scripts/gen-icons.mjs <master.png>
const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", "public");
mkdirSync(outDir, { recursive: true });

const master = process.argv[2] ?? join(here, "..", "willow_logo.png");
const src = sharp(readFileSync(master)).resize(1024, 1024, { fit: "cover" });

async function write(name, size, extra) {
  let img = src.clone().resize(size, size);
  if (extra === "maskable") {
    // Scale content into the center 80% safe zone on a solid amber background
    const bg = await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: { r: 185, g: 122, b: 42, alpha: 1 },
      },
    }).png().toBuffer();
    img = sharp(bg)
      .composite([
        {
          input: await src.clone().resize(Math.round(size * 0.8), Math.round(size * 0.8)).png().toBuffer(),
          gravity: "center",
        },
      ])
      .resize(size, size);
  }
  const buf = await img.png().toBuffer();
  writeFileSync(join(outDir, name), buf);
  console.log(`✓ ${name} (${size}×${size})`);
}

await write("icon-192.png", 192);
await write("icon-512.png", 512);
await write("icon-maskable-512.png", 512, "maskable");
await write("apple-touch-icon.png", 180);
// Favicon: small square
await write("favicon.png", 64);
console.log("Done.");
