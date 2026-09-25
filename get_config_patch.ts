import fs from 'fs';
const indexTs = fs.readFileSync('src/index.ts', 'utf8');
const patch = `
    // DUMP CONFIG FOR DEBUGGING
    try {
      const dbgConfig = await sandbox.readFile('/root/.openclaw/openclaw.json');
      console.log('--- CONTAINER CONFIG DUMP ---');
      console.log(dbgConfig);
      console.log('-----------------------------');
    } catch (e) {
      console.log('Failed to read config:', e);
    }
`;
const updated = indexTs.replace('// Get WebSocket connection to the container', patch + '\n    // Get WebSocket connection to the container');
fs.writeFileSync('src/index.ts', updated);
