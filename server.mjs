import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('.',import.meta.url));
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'};
const localEnv=Object.fromEntries((await readFile(path.join(root,'.env.local'),'utf8').catch(()=>''))
  .split(/\r?\n/).map((line)=>line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)).filter(Boolean).map(([,key,value])=>[key,value.replace(/^['"]|['"]$/g,'')]));
const publicConfig=Object.fromEntries(['VITE_SUPABASE_URL','VITE_SUPABASE_ANON_KEY'].map((key)=>[key,process.env[key]||localEnv[key]||'']));
http.createServer(async(req,res)=>{
  try {
    const relative=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(relative==='/runtime-config.js'){res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'no-cache'});res.end(`window.__SHICI_ENV__=${JSON.stringify(publicConfig)};`);return;}
    if(relative==='/vendor/supabase.js'){const data=await readFile(path.join(root,'node_modules','@supabase','supabase-js','dist','umd','supabase.js'));res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'no-cache'});res.end(data);return;}
    const file=path.resolve(root,'.'+(relative==='/'?'/index.html':relative));
    if(!file.startsWith(root)){res.writeHead(403);res.end();return;}
    const data=await readFile(file);
    res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});res.end(data);
  }catch{res.writeHead(404);res.end('Not found');}
}).listen(5173,'127.0.0.1',()=>console.log('拾词 http://127.0.0.1:5173'));
