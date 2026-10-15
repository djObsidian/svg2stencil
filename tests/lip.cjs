const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
(async()=>{
const THREE=await import('../vendor/three/three.module.js');
const html=fs.readFileSync(require('path').join(__dirname,'../index.html'),'utf8');const c=vm.createContext({THREE});
vm.runInContext(html.slice(html.indexOf('        function signedArea('),html.indexOf('        function generateStencil(')),c);
const rect=(a,b)=>[{x:a,y:a},{x:b,y:a},{x:b,y:b},{x:a,y:b}];
const inner=rect(-5,5),outer=rect(-6,6),shape=new THREE.Shape(inner.map(p=>new THREE.Vector2(p.x,p.y)));
shape.holes.push(new THREE.Path(rect(-1,1).map(p=>new THREE.Vector2(p.x,p.y))));
for(const opposite of [false,true]){
const geo=c.buildStencilWithLip(shape,inner,outer,0.2,1.2,opposite),p=geo.attributes.position,edges=new Map();let volume=0;
for(let i=0;i<p.count;i+=3){
const pts=[0,1,2].map(j=>[p.getX(i+j),p.getY(i+j),p.getZ(i+j)]),[a,b,d]=pts;
volume+=(a[0]*(b[1]*d[2]-b[2]*d[1])+a[1]*(b[2]*d[0]-b[0]*d[2])+a[2]*(b[0]*d[1]-b[1]*d[0]))/6;
const keys=pts.map(v=>v.map(x=>x.toFixed(5)).join(','));
for(let j=0;j<3;j++){const a=keys[j],b=keys[(j+1)%3],k=[a,b].sort().join('|'),e=edges.get(k)||[0,0];e[0]++;e[1]+=a<b?1:-1;edges.set(k,e);}
}
assert.ok([...edges.values()].every(([n,w])=>n===2&&w===0),'closed manifold');
assert.ok(Math.abs(volume-(140*0.2+44*1.2))<1e-4,'rim volume');
const mesh=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({side:THREE.DoubleSide})),s=opposite?1:-1;
const hit=(x,y)=>new THREE.Raycaster(new THREE.Vector3(x,y,s*3),new THREE.Vector3(0,0,-s)).intersectObject(mesh);
assert.equal(hit(0,0).length,0,'open aperture');
assert.ok(Math.abs(hit(3,3)[0].point.z-s*0.1)<1e-6,'thin interior');
assert.ok(Math.abs(hit(5.5,0)[0].point.z-s*1.3)<1e-6,'raised rim');
geo.dispose();
}
console.log('Both lip sides: closed manifold, correct volume, open aperture, thin interior and raised rim OK');
})();
