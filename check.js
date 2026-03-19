import { execSync } from 'child_process';
import { writeFileSync } from 'fs';
try {
    execSync('npx tsx server/index.ts', { stdio: 'pipe', encoding: 'utf8' });
} catch (e) {
    writeFileSync('clean_err.txt', e.stderr || e.stdout || e.message);
}
