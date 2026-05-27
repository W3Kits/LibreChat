import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());
const dist = path.join(root, "dist");
const src = path.join(root, "src");
const iconSource = path.join(root, "..", "client", "public", "assets", "logo.svg");
const w3kitsDir = path.join(dist, "__w3kits");

function copyRecursive(from, to) {
  const stat = fs.statSync(from);
  if (stat.isDirectory()) {
    fs.mkdirSync(to, { recursive: true });
    for (const entry of fs.readdirSync(from)) {
      copyRecursive(path.join(from, entry), path.join(to, entry));
    }
    return;
  }

  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

fs.rmSync(dist, { recursive: true, force: true });
copyRecursive(src, dist);

if (!fs.existsSync(iconSource)) {
  throw new Error("Missing upstream LibreChat icon source: client/public/assets/logo.svg");
}

fs.mkdirSync(w3kitsDir, { recursive: true });
fs.copyFileSync(iconSource, path.join(w3kitsDir, "icon.svg"));

console.log(`Prepared LibreChat plugin dist at ${dist}`);
