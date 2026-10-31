'use strict';
// Serveur statique minimal (les GLTF ne se chargent pas en file://). Usage : node tools/serve.js [port]
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const ROOT=path.join(__dirname,'..');
const TYPES={'.html':'text/html','.js':'text/javascript','.json':'application/json','.gltf':'model/gltf+json','.glb':'model/gltf-binary','.bin':'application/octet-stream','.png':'image/png','.jpg':'image/jpeg','.css':'text/css'};

function start(port=0){
  const server=http.createServer((req,res)=>{
    const p=path.normalize(path.join(ROOT,decodeURIComponent(new URL(req.url,'http://x').pathname)));
    if(!p.startsWith(ROOT)){res.writeHead(403);return res.end()}
    fs.readFile(p,(err,data)=>{
      if(err){res.writeHead(404);return res.end('not found')}
      res.writeHead(200,{'Content-Type':TYPES[path.extname(p).toLowerCase()]||'application/octet-stream'});res.end(data);
    });
  });
  return new Promise(r=>server.listen(port,'127.0.0.1',()=>r(server)));
}
module.exports={start};
if(require.main===module)start(+process.argv[2]||8080).then(s=>console.log(`http://127.0.0.1:${s.address().port}/`));
