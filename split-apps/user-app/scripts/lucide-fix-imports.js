#!/usr/bin/env node
/** One-time repair: fix deep lucide imports whose file name changed
 *  (deprecated aliases like XCircle -> circle-x.js) by re-resolving
 *  each import's exported default name through the barrel map. */
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const barrelPath = path.join(
  projectRoot,
  'node_modules/lucide-react-native/dist/esm/lucide-react-native.js'
);
const iconsDir = path.join(projectRoot, 'node_modules/lucide-react-native/dist/esm/icons');

// File stem -> canonical exported names (first is canonical PascalCase)
const fileToNames = new Map();
const barrel = fs.readFileSync(barrelPath, 'utf8');
const re = /export \{([^}]+)\} from '\.\/icons\/([^']+)'/g;
let m;
while ((m = re.exec(barrel))) {
  const file = m[2];
  const names = [];
  for (const part of m[1].split(',')) {
    const mm = part.trim().match(/^default as ([A-Za-z0-9]+)$/);
    if (mm) names.push(mm[1]);
  }
  if (names.length) fileToNames.set(file, names);
}

// For each icon file, every alias name that maps to it
const nameToFile = new Map();
for (const [file, names] of fileToNames) {
  for (const n of names) nameToFile.set(n, file);
}

const targets = ['app', 'components', 'contexts', 'hooks', 'lib', 'services'];
let fixed = 0;

function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      walk(p);
      continue;
    }
    if (!/\.(tsx?)$/.test(e.name)) continue;
    let src = fs.readFileSync(p, 'utf8');
    const importRe = /import ([A-Za-z0-9_]+)(?:, \{([^}]*)\})? from '(lucide-react-native\/dist\/esm\/icons\/[^']+)';/g;
    let changed = false;
    src = src.replace(importRe, (full, local, named, modPath) => {
      if (fs.existsSync(path.join(projectRoot, 'node_modules', modPath + '.js'))) {
        return full; // already valid
      }
      // Resolve by local binding name; if unknown, scan files for an export matching it
      let file = nameToFile.get(local);
      if (!file) {
        outer: for (const [f, names] of fileToNames) {
          if (names.includes(local)) {
            file = f;
            break outer;
          }
        }
      }
      if (!file || !fs.existsSync(path.join(iconsDir, file))) {
        console.warn('UNRESOLVED:', local, 'in', p);
        return full;
      }
      fixed++;
      changed = true;
      const namedPart = named ? `, { ${named.trim()} }` : '';
      return `import ${local}${namedPart} from 'lucide-react-native/dist/esm/icons/${file.replace(/\.js$/, '')}';`;
    });
    if (changed) {
      fs.writeFileSync(p, src);
      console.log('fixed', path.relative(projectRoot, p));
    }
  }
}

targets.forEach((d) => {
  const abs = path.join(projectRoot, d);
  if (fs.existsSync(abs)) walk(abs);
});

console.log(`\nFixed ${fixed} imports.`);
