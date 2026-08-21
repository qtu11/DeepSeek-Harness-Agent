import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const cordisYml = path.join(os.homedir(), '.dsh', 'profiles', 'web', 'cordis.yml');
if (fs.existsSync(cordisYml)) {
  let content = fs.readFileSync(cordisYml, 'utf8');
  if (content.includes('@deepseek-harness-tui/dsh-tui')) {
    // Disable or remove dsh-tui from web profile
    console.log('Disabling dsh-tui in web cordis.yml...');
    content = content.replace(
      /(\s*-\s*id:\s*dsh-tui[\s\S]*?name:\s*['"]?@deepseek-harness-tui\/dsh-tui['"]?)/g,
      '$1\n      disabled: true'
    );
    fs.writeFileSync(cordisYml, content, 'utf8');
    console.log('dsh-tui disabled in web cordis.yml');
  }
}

const tuiPlugin = path.join(os.homedir(), '.dsh', 'profiles', 'web', 'node_modules', '@deepseek-harness-tui', 'dsh-tui', 'lib', 'types', 'dsh-adapter', 'plugin.js');
if (fs.existsSync(tuiPlugin)) {
  let code = fs.readFileSync(tuiPlugin, 'utf8');
  code = code.replace(
    'throw new Error(\'dsh-tui requires an interactive terminal (stdout must be a TTY).\');',
    'return;'
  );
  code = code.replace(
    'if (!process.stdout.isTTY) {',
    'if (!process.stdout.isTTY) { return;'
  );
  fs.writeFileSync(tuiPlugin, code, 'utf8');
  console.log('dsh-tui plugin.js patched safely for non-TTY.');
}
