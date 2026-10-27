// Generate the self-contained ES module used in Cloudflare's dashboard editor.
import fs from 'node:fs/promises';
const shared=await fs.readFile(new URL('./shared.mjs',import.meta.url),'utf8');
const worker=await fs.readFile(new URL('./worker.mjs',import.meta.url),'utf8');
const output='// OBOK Foods staff API - paste this entire file into Cloudflare worker.js.\n'+shared.replaceAll('export const ','const ').replaceAll('export function ','function ')+'\n'+worker.replace(/^import \{cleanItems,summarize\} from '\.\/shared\.mjs';\n/,'');
if(/^import\s/m.test(output))throw new Error('Bundle still has imports');
await fs.writeFile(new URL('./worker-dashboard.js',import.meta.url),output);
