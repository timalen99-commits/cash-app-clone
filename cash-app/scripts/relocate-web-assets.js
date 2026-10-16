// Vercel drops any deployed path containing "node_modules", which would break
// fonts and images that Expo exports under dist/assets/node_modules.
const fs = require("fs");
const path = require("path");

const dist = path.join(__dirname, "..", "dist");
const from = path.join(dist, "assets", "node_modules");
const to = path.join(dist, "assets", "vendor");

if (!fs.existsSync(from)) process.exit(0);

fs.rmSync(to, { recursive: true, force: true });
fs.renameSync(from, to);

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(js|html|css|json|map)$/.test(entry.name)) {
      const content = fs.readFileSync(full, "utf8");
      if (content.includes("assets/node_modules/")) {
        fs.writeFileSync(
          full,
          content.split("assets/node_modules/").join("assets/vendor/")
        );
      }
    }
  }
}

walk(dist);
