/** Map git-root paths → paths relative to zendt-frontend. */

function frontendRelativePaths(paths) {
  const prefix = "zendt-frontend/";
  const out = [];
  for (const f of paths) {
    if (f.startsWith(prefix)) out.push(f.slice(prefix.length));
    else if (f.startsWith("src/") || f.startsWith("tests/")) out.push(f);
  }
  return out;
}

module.exports = {
  "*.{ts,tsx,js,mjs,cjs}": (paths) => {
    const rel = frontendRelativePaths(paths).filter(Boolean);
    if (!rel.length) return [];
    return [`eslint --fix --max-warnings=0 ${rel.join(" ")}`, `prettier --write ${rel.join(" ")}`];
  },
};
