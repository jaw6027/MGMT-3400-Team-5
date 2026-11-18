import { readFile, mkdir, writeFile } from 'node:fs/promises';

// Bundle the demonstration into one downloadable file with no server required.
const root = new URL('../', import.meta.url);
let html = await readFile(new URL('index.html', root), 'utf8');
const css = await readFile(new URL('src/style.css', root), 'utf8');
let javascript = (await readFile(new URL('src/main.js', root), 'utf8')).replace("import './style.css';", '');
for (const [variable, filename] of [['teePhoto','tee'],['trousersPhoto','trousers'],['shirtPhoto','shirt'],['leggingsPhoto','leggings']]) {
  const base64 = (await readFile(new URL(`src/assets/${filename}.png`, root))).toString('base64');
  javascript = javascript.replace(`import ${variable} from './assets/${filename}.png';`, () => `const ${variable} = 'data:image/png;base64,${base64}';`);
}
const image = (await readFile(new URL('public/images/skirt-comparison.png', root))).toString('base64');
html = html.replace('</head>', () => `<style>${css}</style></head>`)
  .replaceAll('./images/skirt-comparison.png', `data:image/png;base64,${image}`)
  .replace('<script type="module" src="/src/main.js"></script>', () => `<script>${javascript.replaceAll('</script', '<\\/script')}</script>`);
await mkdir(new URL('exports/', root), { recursive: true });
await writeFile(new URL('exports/CraftNDetail-demo.html', root), html);
console.log('Created exports/CraftNDetail-demo.html — download and open in a browser.');
