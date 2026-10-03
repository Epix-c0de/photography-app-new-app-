#!/usr/bin/env node
/**
 * Codemod: rewrite `import { A, B } from 'lucide-react-native'`
 * into deep per-icon imports:
 *
 *   import A from 'lucide-react-native/dist/esm/icons/a';
 *   import B from 'lucide-react-native/dist/esm/icons/b';
 *
 * Resolves each exported icon name via the package barrel's own
 * re-export map, so deprecated aliases (e.g. AlertTriangle ->
 * triangle-alert.js) map correctly. Falls back to kebab-case when
 * the name isn't in the barrel.
 */
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const barrelPath = path.join(
  projectRoot,
  'node_modules/lucide-react-native/dist/esm/lucide-react-native.js'
);

// Build name -> file map from the barrel's re-exports.
// The barrel uses multi-name re-exports like:
//   export { default as CircleX, default as LucideXCircle, default as XCircle } from './icons/circle-x.js'
// so deprecated aliases (XCircle, AlertTriangle, HelpCircle...) resolve correctly.
const barrel = fs.readFileSync(barrelPath, 'utf8');
const nameToFile = new Map();
const re = /export \{([^}]+)\} from '\.\/icons\/([^']+)'/g;
let m;
while ((m = re.exec(barrel))) {
  const file = m[2];
  for (const part of m[1].split(',')) {
    const mm = part.trim().match(/^default as ([A-Za-z0-9]+)$/);
    if (mm) nameToFile.set(mm[1], file);
  }
}
// Non-icon exports keep the barrel (rarely used, tiny)
const NON_ICONS = new Set(['createLucideIcon', 'Icon']);

const kebab = (n) => n.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

const targets = ['app', 'components', 'contexts', 'hooks', 'lib', 'services'];
let filesChanged = 0;
let importsChanged = 0;

function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      walk(p);
      continue;
    }
    if (!/\.(tsx?|jsx?)$/.test(e.name)) continue;
    let src = fs.readFileSync(p, 'utf8');
    const importRe = /import\s*\{([^}]*)\}\s*from\s*['"]lucide-react-native['"];?\r?\n/g;
    let changed = false;
    src = src.replace(importRe, (full, names) => {
      const lines = [];
      for (const raw of names.split(',')) {
        const name = raw.trim().replace(/\s+as\s+.*$/, '');
        if (!name) continue;
        if (NON_ICONS.has(name)) {
          lines.push(
            `import { ${name} } from 'lucide-react-native/dist/esm/lucide-react-native';`
          );
          continue;
        }
        const file = nameToFile.get(name) || kebab(name);
        lines.push(
          `import ${name} from 'lucide-react-native/dist/esm/icons/${file}';`
        );
      }
      if (lines.length) {
        changed = true;
        importsChanged += lines.length;
        return lines.join('\n') + '\n';
      }
      return full;
    });
    if (changed) {
      fs.writeFileSync(p, src);
      filesChanged++;
      console.log('rewrote', path.relative(projectRoot, p));
    }
  }
}

targets.forEach((d) => {
  const abs = path.join(projectRoot, d);
  if (fs.existsSync(abs)) walk(abs);
});

console.log(
  `\nDone: ${filesChanged} files, ${importsChanged} icon imports rewritten.`
);
