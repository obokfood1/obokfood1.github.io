// Generate the self-contained ES module used in Cloudflare's dashboard editor.
import fs from 'node:fs/promises';
const shared=await fs.readFile(new URL('./shared.mjs',import.meta.url),'utf8');
const accounts=await fs.readFile(new URL('./accounts.mjs',import.meta.url),'utf8');
const worker=await fs.readFile(new URL('./worker.mjs',import.meta.url),'utf8');
const output='// OBOK Foods staff API - paste this entire file into Cloudflare worker.js.\n'+shared.replaceAll('export const ','const ').replaceAll('export function ','function ')+'\n'+accounts.replaceAll('export const ','const ').replaceAll('export function ','function ').replaceAll('export async function ','async function ').replace("const fail=(message,status=400)=>Object.assign(new Error(message),{status});\n",'').replace("const enc=new TextEncoder();\n",'')+'\n'+worker.replace(/^import \{cleanItems,summarize\} from '\.\/shared\.mjs';\n/,'');
const bundled=output.replace(/^import .* from '\.\/accounts\.mjs';\n/m,'');
if(/^import\s/m.test(bundled))throw new Error('Bundle still has imports');
await fs.writeFile(new URL('./worker-dashboard.js',import.meta.url),bundled);

await fs.writeFile(new URL('./worker-dashboard.txt',import.meta.url),bundled);
