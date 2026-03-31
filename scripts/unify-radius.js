import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const replacements = [
  // 按钮、输入框、小组件：使用 md
  { from: 'rounded-lg', to: 'misub-radius-md' },
  { from: 'rounded-md', to: 'misub-radius-md' },
  { from: 'rounded-xl', to: 'misub-radius-lg' },
  { from: 'rounded-2xl', to: 'misub-radius-lg' },
  { from: 'rounded-3xl', to: 'misub-radius-lg' },
  // 保持 rounded-full 不变（圆形元素）
];

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  replacements.forEach(({ from, to }) => {
    if (content.includes(from)) {
      content = content.split(from).join(to);
      modified = true;
    }
  });

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated: ${filePath}`);
  }
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      walkDir(filePath);
    } else if (file.endsWith('.vue') || file.endsWith('.js')) {
      processFile(filePath);
    }
  });
}

const srcPath = path.join(__dirname, '../src');
walkDir(srcPath);
console.log('Radius unification complete!');
