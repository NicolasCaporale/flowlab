// Writes examples/README.md from examples/<language>/index.json (the list with links to open each example in FlowLab)
// Usage: node tools/examples.js
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..', 'examples');
const PAGE = 'https://nicvac.github.io/flowlab/dist/FlowLab.html';
const langs = fs.readdirSync(root).filter((d) => fs.existsSync(path.join(root, d, 'index.json'))).sort((a, b) => (a === 'en' ? -1 : b === 'en' ? 1 : a.localeCompare(b)));
let md = `# Examples

The example programs of FlowLab in \`.fprg\` format, one folder per language: FlowLab shows the examples of the chosen language (or the English ones). The link in the first column opens the example directly in FlowLab.

To add the examples of a language, create the folder \`examples/<code>/\` (the code of the language file in \`languages/\`) with the \`.fprg\` files and an \`index.json\` with id, title and topics of each example, in the order of the menu.
`;
for (const l of langs) {
  const index = JSON.parse(fs.readFileSync(path.join(root, l, 'index.json'), 'utf8'));
  md += `\n## ${l}\n\n| Example | Topics | File |\n|---|---|---|\n`;
  for (const e of index) md += `| [${e.title}](${PAGE}?url=../examples/${l}/${e.id}.fprg) | ${e.tags} | [${e.id}.fprg](${l}/${e.id}.fprg) |\n`;
}
md += `\nThe \`classroom\` folder contains exercises used in class (in Italian).

Any \`.fprg\` file published online opens in FlowLab by adding \`?url=\` to the FlowLab address, for example:

\`\`\`
${PAGE}?url=https://github.com/user/repo/blob/main/exercise.fprg
\`\`\`

This README is generated with \`node tools/examples.js\`.
`;
fs.writeFileSync(path.join(root, 'README.md'), md);
console.log('examples/README.md:', langs.join(', '));
