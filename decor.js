import*as e from'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.min.js';const t=(t,o={})=>new e.MeshLambertMaterial({color:t,flatShading:!0,...o});function o(t=1){
return new e.LatheGeometry([[0,0],[.95,0],[1.22,.4],[1.3,.85],[1.12,1.3],[.78,1.72],[.4,2.1],[.16,2.48],[.05,2.8],[0,2.9]].map((([o,n])=>new e.Vector2(o*t,n*t))),10)}function n(t,o=2.4){const n=new e.Group,s=(o,s,r,i,a=0)=>{
const c=new e.Mesh(new e.BoxGeometry(o,s,r),t);c.position.y=i,c.rotation.z=a,n.add(c)};return s(.14,o,.14,o/2),s(.9,.12,.12,.72*o),s(.5,.1,.1,.88*o),s(.6,.1,.1,.38*o,-.35),n}function s(o,n){
const s=new e.Group,r=[14165548,2643657,2071640,14721562,12727162],i=r[Math.floor(o()*r.length)],a=new e.Mesh(new e.LatheGeometry([[0,0],[1,0],[1.15,.45],[1.2,1],[1.05,1.55],[.78,1.88],[.74,2],[.84,2.25],[.8,2.6],[.56,2.9],[.25,3.05],[0,3.1]].map((([t,o])=>new e.Vector2(t,o))),14),t(i))
;s.add(a);const c=new e.Mesh(new e.SphereGeometry(.75,10,8),t(16773577));c.scale.set(1,1.15,.45),c.position.set(0,.95,-.92),s.add(c);const d=new e.Mesh(new e.SphereGeometry(.28,8,6),t(14165548===i?2643657:14165548));d.scale.set(1,1,.5),
d.position.set(0,1,-1.25),s.add(d);const w=new e.Mesh(new e.SphereGeometry(.5,10,8),t(16769220));w.scale.set(1,1.05,.5),w.position.set(0,2.5,-.62),s.add(w);const h=t(2236962),l=t(16743050);for(const t of[-1,1]){
const o=new e.Mesh(new e.SphereGeometry(.06,6,4),h);o.position.set(.17*t,2.6,-.86),s.add(o);const n=new e.Mesh(new e.SphereGeometry(.09,6,4),l);n.position.set(.26*t,2.4,-.84),s.add(n)}
const M=new e.Mesh(new e.SphereGeometry(.5,10,6,0,2*Math.PI,0,Math.PI/2.4),t(5911060));return M.scale.set(1,.7,.55),M.position.set(0,2.72,-.6),s.add(M),s.scale.setScalar(n),s}function r(t){const o=document.createElement('canvas')
;o.width=96,o.height=64;const n=o.getContext('2d');'ru'===t?(n.fillStyle='#ffffff',n.fillRect(0,0,96,22),n.fillStyle='#1c3fd6',n.fillRect(0,21,96,22),n.fillStyle='#d62718',n.fillRect(0,42,96,22)):(n.fillStyle='#0046ae',
n.fillRect(0,0,32,64),n.fillStyle='#ffd200',n.fillRect(32,0,32,64),n.fillStyle='#cc092f',n.fillRect(64,0,32,64),n.fillStyle='#9c6b30',n.fillRect(42,22,12,18),n.fillStyle='#cc092f',n.fillRect(44,30,8,8));const s=new e.CanvasTexture(o)
;return s.colorSpace=e.SRGBColorSpace,s}export function buildFunkDecor(i,a,c,d=7){const w=function(e){let t=e>>>0;return()=>(t=1664525*t+1013904223>>>0,t/4294967296)
}(d),h=new e.Group,{N:l,P:M,R:f,U:y,T:p,gapSample:m,width:u}=i,G=u/2,x=(e,t,o,n,s)=>{for(let r=0;r<l;r+=3){const i=M[r],a=i.x-e,c=i.z-t;if(Math.sqrt(a*a+c*c)<o+G+6&&i.y-2<s+n)return!1}return!0},I=(e,t)=>{
const o=Math.floor(w()*(l-20))+10,n=w()<.5?-1:1,s=e+w()*(t-e);return{x:M[o].x+f[o].x*s*n+10*(w()-.5),z:M[o].z+f[o].z*s*n+10*(w()-.5),i:o}},g=(e,t,o,n,s=40)=>{let r=0;for(let i=0;i<t*s&&r<t;i++){const{x:t,z:s,i:i}=I(o,n),c=e(),d=a(t,s)
;x(t,s,c.radius,c.height,d)&&(c.obj.position.set(t,d-.3,s),c.obj.lookAt(M[i].x,d,M[i].z),h.add(c.obj),r++)}};g((()=>function(s){const r=new e.Group,i=t(15986662),a=t(3112271),c=t(15251747,{emissive:3811840
}),d=[2842585,15251747,3121242,14169132],w=new e.Mesh(new e.BoxGeometry(12,12,14),i);w.position.y=6,r.add(w);const h=new e.Mesh(new e.ConeGeometry(10,3.5,4,1),a);h.position.y=13.75,h.rotation.y=Math.PI/4,h.scale.set(1,1,1.15),r.add(h)
;const l=new e.Mesh(new e.CylinderGeometry(2.6,2.6,6,10),i);l.position.y=17,r.add(l);const M=d[Math.floor(s()*d.length)],f=new e.Mesh(o(2.6),15251747===M?c:t(M));f.position.y=20,r.add(f);const y=n(c,3);y.position.y=27.4,r.add(y)
;for(const[a,w]of[[-4.2,-4.8],[4.2,-4.8],[-4.2,4.8],[4.2,4.8]]){const h=new e.Mesh(new e.CylinderGeometry(1.1,1.1,2.5,8),i);h.position.set(a,14.8,w),r.add(h);const l=new e.Mesh(o(1.1),s()<.5?c:t(d[Math.floor(4*s())]))
;l.position.set(a,16,w),r.add(l);const M=n(c,1.4);M.position.set(a,19.1,w),r.add(M)}const p=new e.Mesh(new e.BoxGeometry(5,18,5),i);p.position.set(0,9,10),r.add(p);const m=new e.Mesh(new e.ConeGeometry(3.8,7,8),a);m.position.set(0,21.5,10),
r.add(m);const u=new e.Mesh(o(.9),c);u.position.set(0,25,10),r.add(u);const G=t(2766160);for(const t of[-3.5,0,3.5])for(const o of[-1,1]){const n=new e.Mesh(new e.BoxGeometry(.2,3,1.4),G);n.position.set(6.05*o,7,t),r.add(n)}return{obj:r,
radius:12,height:30}}(w)),5,45,160),g((()=>function(o){const n=new e.Group,s=t(9067058),r=[8004384,3107654,4016747][Math.floor(3*o())],i=new e.Mesh(new e.BoxGeometry(7,4.2,8),s);i.position.y=2.1,n.add(i);const a=t(7226662)
;for(let t=.5;t<4.2;t+=.8)for(const o of[-1,1]){const s=new e.Mesh(new e.BoxGeometry(.25,.25,8.6),a);s.position.set(3.55*o,t,0),n.add(s)}const c=new e.Mesh(new e.CylinderGeometry(4.34,4.34,9,3,1),t(r));c.rotation.x=Math.PI/2,c.rotation.y=0,
c.rotation.z=Math.PI/2*0,c.position.y=5.6,c.rotation.set(Math.PI/2,0,Math.PI/2+Math.PI/6*0),c.rotation.z=-Math.PI/2,c.rotation.y=Math.PI/2,c.scale.set(1,1,.55),n.add(c);const d=t(3108822),w=t(13625599)
;for(const t of[-2,2])for(const o of[-1,1]){const s=new e.Mesh(new e.BoxGeometry(.15,1.6,1.4),d);s.position.set(3.62*o,2.2,t),n.add(s);const r=new e.Mesh(new e.BoxGeometry(.16,1.1,.9),w);r.position.set(3.64*o,2.2,t),n.add(r)}
const h=new e.Mesh(new e.BoxGeometry(.8,2,.8),t(11575440));return h.position.set(1.5,6.5,1),n.add(h),{obj:n,radius:6,height:9}}(w)),16,30,120),g((()=>function(){
const o=new e.Group,n=t(12433062),s=t(8015402),r=t(3108822),i=new e.Mesh(new e.CylinderGeometry(1.4,1.5,1.6,10),n);i.position.y=.8,o.add(i);for(const t of[-1,1]){const n=new e.Mesh(new e.BoxGeometry(.25,3,.25),s)
;n.position.set(1.2*t,2.5,0),o.add(n)}const a=new e.Mesh(new e.ConeGeometry(2,1.4,4),r);a.rotation.y=Math.PI/4,a.position.y=4.6,o.add(a);const c=new e.Mesh(new e.CylinderGeometry(.15,.15,2.6,6),s);return c.rotation.z=Math.PI/2,
c.position.y=3.2,o.add(c),{obj:o,radius:3,height:6}}()),8,25,90),g((()=>function(){const o=new e.Group,n=t(11874858),s=t(2911817),r=t(15251747,{emissive:3811840}),i=new e.Mesh(new e.BoxGeometry(70,9,3),n);i.position.y=4.5,o.add(i)
;for(let t=-34;t<35;t+=2.2){const s=new e.Mesh(new e.BoxGeometry(1.2,1.4,3.2),n);s.position.set(t,9.7,0),o.add(s)}for(const t of[-35,0,35]){const i=0===t,a=new e.Mesh(new e.BoxGeometry(i?9:7,i?22:16,i?9:7),n);a.position.set(t,i?11:8,0),
o.add(a);const c=new e.Mesh(new e.BoxGeometry(i?6:5,5,i?6:5),n);c.position.set(t,i?24.5:18.5,0),o.add(c);const d=new e.Mesh(new e.ConeGeometry(i?5:4,i?14:10,4),s);d.rotation.y=Math.PI/4,d.position.set(t,i?34:26,0),o.add(d)
;const w=new e.Mesh(new e.OctahedronGeometry(i?1.3:1,0),r);w.position.set(t,i?42:32,0),o.add(w)}return{obj:o,radius:40,height:44}}()),1,70,130),g((()=>function(){const o=new e.Group,n=t(14263361,{emissive:2758656
}),s=t(3811866),r=new e.Mesh(new e.LatheGeometry([[0,0],[2.6,0],[2.8,.6],[2,1.4],[2.2,2],[4.6,4],[5,7],[4.4,10],[3,11.2],[2.6,12.4],[3.4,13.2],[2.2,14.6],[.9,15.6],[1.2,16.6],[0,17.2]].map((([t,o])=>new e.Vector2(t,o))),14),n);o.add(r)
;const i=new e.Mesh(new e.CylinderGeometry(.4,.4,3,6),n);i.rotation.z=Math.PI/2,i.position.set(5.6,4.5,0),o.add(i);for(const t of[-1,1]){const n=new e.Mesh(new e.TorusGeometry(1.6,.3,6,12,Math.PI),s);n.position.set(0,9.5,4.6*t),
n.rotation.y=Math.PI/2*0,n.rotation.x=0,n.rotation.z=Math.PI/2*0,n.rotation.set(0,0,t>0?-Math.PI/2:Math.PI/2),n.position.set(4.9*t,8.5,0),o.add(n)}return{obj:o,radius:7,height:18}}()),1,40,90),g((()=>function(){
const o=new e.Group,n=t(13073200),s=t(5911060),r=t(1907997),i=new e.Shape;i.moveTo(-7,0),i.lineTo(7,0),i.lineTo(0,11),i.lineTo(-7,0);const a=new e.Mesh(new e.ExtrudeGeometry(i,{depth:3,bevelEnabled:!1}),n);a.position.z=-1.5,o.add(a)
;const c=new e.Mesh(new e.CylinderGeometry(1.2,1.2,.2,10),r);c.rotation.x=Math.PI/2,c.position.set(0,4,1.55),o.add(c);const d=new e.Mesh(new e.BoxGeometry(1.4,16,1),s);d.position.set(0,18,.5),o.add(d)
;const w=new e.Mesh(new e.BoxGeometry(2.4,3.2,1),n);w.position.set(0,27.4,.5),o.add(w);for(const n of[-.35,0,.35]){const s=new e.Mesh(new e.BoxGeometry(.06,25,.06),t(15658734));s.position.set(n,13.5,1.6),o.add(s)}return o.rotation.z=.18,{
obj:o,radius:9,height:30}}()),1,40,90),g((()=>{const t=new e.Group;let o=0;for(let e=0;e<5;e++){const n=4.5*Math.pow(.72,e),r=s(w,n);r.position.x=o,o+=2.5*n,t.add(r)}return t.children.forEach((e=>{e.position.x-=o/2})),{obj:t,radius:14,
height:15}}),5,28,90);{const o=new e.DodecahedronGeometry(.9,0),n=new e.BoxGeometry(.15,2,.15);n.translate(0,1,0);const s=new e.IcosahedronGeometry(.35,0),r=[];for(let e=0;e<4;e++)for(let e=0;e<30;e++){const{x:e,z:t}=I(40,140)
;if(x(e,t,22,4,a(e,t))){r.push([e,t,w()*Math.PI]);break}}
const i=240,c=new e.InstancedMesh(o,t(4165434),r.length*i),d=new e.InstancedMesh(n,t(7226662),r.length*i/4),l=new e.InstancedMesh(s,t(5974638),r.length*i),M=new e.Matrix4,f=new e.Quaternion,y=new e.Vector3(1,1,1),p=new e.Vector3;let m=0,u=0
;for(const[o,n,s]of r){const r=Math.cos(s),i=Math.sin(s);for(let e=0;e<10;e++)for(let t=0;t<24;t++){const s=3.2*(e-4.5),h=1.6*(t-11.5),G=o+s*r-h*i,x=n+s*i+h*r,I=a(G,x);p.set(G,I+1.3,x),y.set(1,.9+.3*w(),1),M.compose(p,f,y),
c.setMatrixAt(m,M),p.set(G+.6*(w()-.5),I+.9,x+.6*(w()-.5)),y.set(1,1.3,1),M.compose(p,f,y),l.setMatrixAt(m,M),m++,t%4==0&&(p.set(G,I,x),y.set(1,1,1),M.compose(p,f,y),d.setMatrixAt(u++,M))}const G=t(9132587),x=t(3355443)
;for(let t=0;t<6;t++){const s=o+(17+t%3*2.3)*r,c=n+(17+t%3*2.3)*i,d=a(s,c)+1+(t>=3?1.9:0),w=new e.Mesh(new e.CylinderGeometry(1,1,2.2,10),G);w.rotation.x=Math.PI/2,w.position.set(s+(t>=3?1.15*r:0),d,c+(t>=3?1.15*i:0))
;const l=new e.Mesh(new e.TorusGeometry(1.02,.07,4,12),x);l.position.z=.6,w.add(l);const M=l.clone();M.position.z=-.6,w.add(M),h.add(w)}}c.count=m,l.count=m,d.count=u,h.add(c,l,d)}{const o=new e.CylinderGeometry(.08,.1,2.6,4)
;o.translate(0,1.3,0);const n=new e.CylinderGeometry(.75,.75,.12,8);n.rotateX(Math.PI/2);const s=new e.CylinderGeometry(.38,.38,.16,8);s.rotateX(Math.PI/2);const r=[];for(let e=0;e<5;e++)for(let e=0;e<30;e++){const{x:e,z:t}=I(35,150)
;if(x(e,t,18,4,a(e,t))){r.push([e,t]);break}}const i=196,c=new e.InstancedMesh(o,t(5212716),r.length*i),d=new e.InstancedMesh(n,t(16762394,{emissive:3351040
}),r.length*i),l=new e.InstancedMesh(s,t(4860434),r.length*i),M=new e.Matrix4,f=new e.Quaternion,y=new e.Vector3(1,1,1),p=new e.Vector3,m=(new e.Quaternion).setFromAxisAngle(new e.Vector3(0,1,0),.6);let u=0
;for(const[e,t]of r)for(let o=0;o<14;o++)for(let n=0;n<14;n++){const s=e+1.8*(o-6.5)+(w()-.5),r=t+1.8*(n-6.5)+(w()-.5),i=a(s,r),h=.85+.35*w();p.set(s,i,r),y.set(1,h,1),M.compose(p,f,y),c.setMatrixAt(u,M),p.set(s,i+2.6*h,r+.12),y.set(1,1,1),
M.compose(p,m,y),d.setMatrixAt(u,M),p.set(s+.05,i+2.6*h,r+.2),M.compose(p,m,y),l.setMatrixAt(u,M),u++}c.count=d.count=l.count=u,h.add(c,d,l)}{const o=360,n=260,s=new e.CylinderGeometry(.28,.36,9,6,6);s.translate(0,4.5,0)
;const r=[],i=s.attributes.position;for(let t=0;t<i.count;t++){const o=Math.floor(1.3*i.getY(t)+3*i.getX(t))%4==0?new e.Color(2763306):new e.Color(15921386);r.push(o.r,o.g,o.b)}s.setAttribute('color',new e.Float32BufferAttribute(r,3))
;const d=new e.IcosahedronGeometry(2.4,0);d.scale(1,1.5,1),d.translate(0,9,0);const l=new e.ConeGeometry(2.6,9,6);l.translate(0,6.5,0);const M=new e.CylinderGeometry(.3,.4,2.5,5);M.translate(0,1.25,0)
;const f=new e.InstancedMesh(s,new e.MeshLambertMaterial({vertexColors:!0,flatShading:!0
}),o),y=new e.InstancedMesh(d,t(9225791),o),p=new e.InstancedMesh(l,t(2318650),n),m=new e.InstancedMesh(M,t(5913122),n),u=new e.Matrix4,G=new e.Quaternion,x=new e.Vector3,I=new e.Vector3,g=new e.Vector3(0,1,0),P=(e,t,o)=>{let n=0
;for(let s=0;n<o&&s<6*o;s++){const o=w()*Math.PI*2,s=25+640*Math.sqrt(w()),r=c.x+Math.cos(o)*s,i=c.z+Math.sin(o)*s,d=.7+.7*w();I.set(r,a(r,i)-.3,i),G.setFromAxisAngle(g,6.28*w()),x.set(d,d,d),u.compose(I,G,x),e.setMatrixAt(n,u),
t.setMatrixAt(n,u),n++}e.count=t.count=n};P(f,y,o),P(p,m,n),h.add(f,y,p,m)}{const o=t(14540253),n={ru:new e.MeshLambertMaterial({map:r('ru'),side:e.DoubleSide}),md:new e.MeshLambertMaterial({map:r('md'),side:e.DoubleSide})
},s=new e.CylinderGeometry(.08,.1,6,5);s.translate(0,3,0);const i=new e.PlaneGeometry(2.4,1.6);i.translate(1.2,0,0);let a=0;for(let t=10;t<l-10;t+=22)if(!m[t]&&!m[t-1]){for(const r of[-1,1]){
const c=M[t].clone().addScaledVector(f[t],r*(G+.7)),d=new e.Mesh(s,o);d.position.copy(c),h.add(d);const w=new e.Mesh(i,(a+(r>0?1:0))%2?n.md:n.ru);w.position.copy(c).add(new e.Vector3(0,5.1,0));const l=p[t].clone().negate();l.y=0,
l.normalize(),w.rotation.y=Math.atan2(-l.z,l.x),h.add(w)}a++}}return h}

export function buildThemedDecor(key,i,a,c,d=7){
if(key==='funk') return buildFunkDecor(i,a,c,d);
const w=(function(e){let t=e>>>0;return()=>(t=1664525*t+1013904223>>>0,t/4294967296)})(d);
const h=new e.Group;
const {N:l,P:M,R:f,U:y,T:p,gapSample:m,width:u}=i;
const G=u/2;
const x=(ex,tz,o,n,s)=>{for(let r=0;r<l;r+=3){const ii=M[r],aa=ii.x-ex,cc=ii.z-tz;if(Math.sqrt(aa*aa+cc*cc)<o+G+6&&ii.y-2<s+n)return!1}return!0};
const I=(e,t)=>{const o=Math.floor(w()*(l-20))+10,n=w()<.5?-1:1,s=e+w()*(t-e);return{x:M[o].x+f[o].x*s*n+10*(w()-.5),z:M[o].z+f[o].z*s*n+10*(w()-.5),i:o}};
const g=(factory,count,emin,emax,maxtries=60)=>{let r=0;for(let ii=0;ii<count*maxtries&&r<count;ii++){const pt=I(emin,emax),obj=factory(w);const ground=a(pt.x,pt.z);if(x(pt.x,pt.z,obj.radius,obj.height,ground)){obj.obj.position.set(pt.x,ground-.3,pt.z);obj.obj.lookAt(M[pt.i].x,ground,M[pt.i].z);h.add(obj.obj);r++}}};
const tmat=(col,o={})=>new e.MeshLambertMaterial({color:col,flatShading:!0,...o});
const rng=w;

if(key==='samosa'){
  // samosas
  g(()=>{const grp=new e.Group;const pastry=tmat(13408563);const mesh=new e.Mesh(new e.TetrahedronGeometry(1.4,0),pastry);mesh.position.y=1.2;grp.add(mesh);const filling=tmat(11231286);const f=new e.Mesh(new e.SphereGeometry(.6,6,4),filling);f.position.y=1.2;grp.add(f);return{obj:grp,radius:2.5,height:3}},18,20,120);
  // auto-rickshaws
  g(()=>{const grp=new e.Group;const body=tmat(16753920);const b=new e.Mesh(new e.BoxGeometry(2.6,1.6,1.8),body);b.position.y=1.3;grp.add(b);const cabin=tmat(16777215,{transparent:!0,opacity:.7});const c=new e.Mesh(new e.BoxGeometry(1.6,1.2,1.6),cabin);c.position.set(-.2,2.4,.0);grp.add(c);const wheel=tmat(2236962);for(const wx of[-1,1])for(const wz of[-.7,.7]){const wh=new e.Mesh(new e.CylinderGeometry(.45,.45,.25,8),wheel);wh.rotation.z=Math.PI/2;wh.position.set(wx*.9,.4,wz);grp.add(wh)}const canopy=tmat(3121242);const cn=new e.Mesh(new e.ConeGeometry(1.6,1,.4),canopy);cn.position.set(-.2,3.3,0);grp.add(cn);return{obj:grp,radius:3,height:4}},12,30,140);
  // traditional arches
  g(()=>{const grp=new e.Group;const stone=tmat(12632256);const left=new e.Mesh(new e.BoxGeometry(.6,4,1),stone);left.position.set(-2.2,2,0);grp.add(left);const right=left.clone();right.position.x=2.2;grp.add(right);const top=new e.Mesh(new e.BoxGeometry(5,1,1.2),stone);top.position.y=4.2;grp.add(top);const dome=new e.Mesh(new e.SphereGeometry(1.6,8,6,0,Math.PI*2,0,Math.PI/2),tmat(16737843));dome.position.y=5.2;grp.add(dome);return{obj:grp,radius:4,height:7}},8,40,130);
  // spice baskets
  g(()=>{const grp=new e.Group;const basket=tmat(9074017);const b=new e.Mesh(new e.CylinderGeometry(1.2,1,1,8),basket);b.position.y=.5;grp.add(b);const spice=tmat(16737843);const s=new e.Mesh(new e.SphereGeometry(.9,8,6),spice);s.position.y=1.2;s.scale.y=.6;grp.add(s);return{obj:grp,radius:2,height:2}},10,25,110);
}

if(key==='africanium'){
  // baobab trees
  g(()=>{const grp=new e.Group;const trunk=tmat(8947848);const tr=new e.Mesh(new e.CylinderGeometry(1.6,2.4,9,8),trunk);tr.position.y=4.5;grp.add(tr);const foliage=tmat(5592405);const f=new e.Mesh(new e.SphereGeometry(4.5,10,8),foliage);f.position.y=10;f.scale.set(1.3,1,1.3);grp.add(f);const f2=new e.Mesh(new e.SphereGeometry(3.2,8,6),foliage);f2.position.set(2.5,12,-1);grp.add(f2);return{obj:grp,radius:6,height:14}},14,35,160);
  // grass tufts
  g(()=>{const grp=new e.Group;const gmat=tmat(5592405);for(let i=0;i<5;i++){const blade=new e.Mesh(new e.ConeGeometry(.15,.8,4),gmat);blade.position.set((w()-.5)*2,0,(w()-.5)*2);blade.rotation.z=(w()-.5)*.6;grp.add(blade)}return{obj:grp,radius:1.5,height:1}},40,15,100);
  // animals (low-poly)
  g(()=>{const grp=new e.Group;const body=tmat(13421772);const b=new e.Mesh(new e.BoxGeometry(2.2,1.4,1.2),body);b.position.y=1.2;grp.add(b);const head=new e.Mesh(new e.BoxGeometry(1.2,1,1),body);head.position.set(1.4,1.9,0);grp.add(head);const leg=tmat(8947848);for(const lx of[-.7,.7])for(const lz of[-.4,.4]){const l=new e.Mesh(new e.CylinderGeometry(.18,.18,1.2,6),leg);l.position.set(lx,.6,lz);grp.add(l)}return{obj:grp,radius:3,height:2.5}},10,30,140);
  // safari jeep
  g(()=>{const grp=new e.Group;const body=tmat(6579300);const b=new e.Mesh(new e.BoxGeometry(3.4,1.4,1.8),body);b.position.y=1.2;grp.add(b);const cabin=tmat(16777215,{transparent:!0,opacity:.6});const c=new e.Mesh(new e.BoxGeometry(1.8,1.1,1.6),cabin);c.position.set(-.3,2.2,0);grp.add(c);const wheel=tmat(2236962);for(const wx of[-1.2,1.2])for(const wz of[-.8,.8]){const wh=new e.Mesh(new e.CylinderGeometry(.4,.4,.3,8),wheel);wh.rotation.z=Math.PI/2;wh.position.set(wx,.4,wz);grp.add(wh)}return{obj:grp,radius:3.5,height:3}},6,40,150);
}

if(key==='gymbros'){
  // dumbbells
  g(()=>{const grp=new e.Group;const metal=tmat(1118481);const bar=new e.Mesh(new e.CylinderGeometry(.12,.12,2.4,8),metal);bar.rotation.z=Math.PI/2;bar.position.y=1.2;grp.add(bar);const plate=tmat(3355443);for(const px of[-1.1,1.1]){const p=new e.Mesh(new e.CylinderGeometry(.7,.7,.3,12),plate);p.rotation.z=Math.PI/2;p.position.set(px,1.2,0);grp.add(p)}return{obj:grp,radius:2,height:2}},16,20,120);
  // protein shakers
  g(()=>{const grp=new e.Group;const cup=tmat(16777215);const c=new e.Mesh(new e.CylinderGeometry(.5,.6,2.2,10),cup);c.position.y=1.1;grp.add(c);const lid=tmat(16711680);const l=new e.Mesh(new e.CylinderGeometry(.55,.55,.3,10),lid);l.position.y=2.3;grp.add(l);const logo=tmat(16711680);const lo=new e.Mesh(new e.BoxGeometry(.3,.6,.05),logo);lo.position.set(.55,1.2,0);grp.add(lo);return{obj:grp,radius:1.5,height:2.5}},14,20,110);
  // weight plates
  g(()=>{const grp=new e.Group;const plate=tmat(3355443);const p=new e.Mesh(new e.CylinderGeometry(1.1,1.1,.25,16),plate);p.position.y=.15;grp.add(p);const hole=tmat(1118481);const h=new e.Mesh(new e.CylinderGeometry(.2,.2,.3,8),hole);h.position.y=.15;grp.add(h);return{obj:grp,radius:1.5,height:.5}},20,18,110);
  // buff NPC obstacles
  g(()=>{const grp=new e.Group;const skin=tmat(13408563);const torso=new e.Mesh(new e.BoxGeometry(1.6,2,1),skin);torso.position.y=2.2;grp.add(torso);const head=new e.Mesh(new e.SphereGeometry(.55,8,6),skin);head.position.y=3.6;grp.add(head);const arm=tmat(13408563);for(const ax of[-1.1,1.1]){const a=new e.Mesh(new e.CylinderGeometry(.35,.35,1.6,8),arm);a.position.set(ax,2.2,0);a.rotation.z=Math.PI/2;grp.add(a)}const leg=tmat(2236962);for(const lx of[-.4,.4]){const l=new e.Mesh(new e.CylinderGeometry(.3,.3,1.4,8),leg);l.position.set(lx,.7,0);grp.add(l)}return{obj:grp,radius:2,height:4}},12,25,130);
  // gym equipment rack
  g(()=>{const grp=new e.Group;const frame=tmat(1118481);const f=new e.Mesh(new e.BoxGeometry(4,3.5,.4),frame);f.position.y=1.75;grp.add(f);const bar=tmat(3355443);for(let i=0;i<4;i++){const b=new e.Mesh(new e.CylinderGeometry(.08,.08,3.8,6),bar);b.position.set(0,.6+i*.7,0);b.rotation.z=Math.PI/2;grp.add(b)}return{obj:grp,radius:3,height:4}},6,40,150);
}

if(key==='border'){
  // saguaro cacti
  g(()=>{const grp=new e.Group;const cactus=tmat(3368703);const trunk=new e.Mesh(new e.CylinderGeometry(.5,.6,4,8),cactus);trunk.position.y=2;grp.add(trunk);for(const side of[-1,1]){const arm=new e.Mesh(new e.CylinderGeometry(.3,.35,2.2,8),cactus);arm.position.set(side*1,3.2,0);arm.rotation.z=side>0?Math.PI/3:-Math.PI/3;grp.add(arm);const top=new e.Mesh(new e.SphereGeometry(.35,6,4),cactus);top.position.set(side*1.9,4.2,0);grp.add(top)}const top2=new e.Mesh(new e.SphereGeometry(.45,6,4),cactus);top2.position.y=4.2;grp.add(top2);return{obj:grp,radius:1.5,height:4.5}},24,18,120);
  // hacienda archways
  g(()=>{const grp=new e.Group;const stone=tmat(13474406);const left=new e.Mesh(new e.BoxGeometry(.7,4.5,1),stone);left.position.set(-2.5,2.25,0);grp.add(left);const right=left.clone();right.position.x=2.5;grp.add(right);const arch=new e.Mesh(new e.TorusGeometry(2.5,.35,8,12,Math.PI),stone);arch.position.y=4.5;arch.rotation.z=Math.PI;grp.add(arch);const roof=new e.Mesh(new e.BoxGeometry(6,1,1.2),tmat(16737843));roof.position.y=5.2;grp.add(roof);return{obj:grp,radius:4,height:6}},8,40,140);
  // pinatas
  g(()=>{const grp=new e.Group;const body=tmat(16711680);const b=new e.Mesh(new e.SphereGeometry(1.3,8,6),body);b.scale.set(1,1.4,1);b.position.y=3.5;grp.add(b);const cone=tmat(16776960);const c=new e.Mesh(new e.ConeGeometry(.6,1.2,6),cone);c.position.y=5.2;grp.add(c);const leg=tmat(9074017);const l=new e.Mesh(new e.CylinderGeometry(.1,.1,2,6),leg);l.position.y=1.5;grp.add(l);return{obj:grp,radius:2,height:6}},10,25,120);
  // sun-baked rocks
  g(()=>{const grp=new e.Group;const rock=tmat(10066329);const r=new e.Mesh(new e.DodecahedronGeometry(1.6,0),rock);r.position.y=1;grp.add(r);const r2=new e.Mesh(new e.DodecahedronGeometry(1.1,0),rock);r2.position.set(1.2,.7,.5);grp.add(r2);return{obj:grp,radius:2.5,height:2}},16,20,120);
  // desert bushes
  g(()=>{const grp=new e.Group;const bush=tmat(6710886);const b=new e.Mesh(new e.SphereGeometry(1,6,4),bush);b.scale.set(1.2,.8,1.2);b.position.y=.6;grp.add(b);return{obj:grp,radius:1.5,height:1.2}},18,20,110);
}

if(key==='finalmatushka'){
  // onion domes
  g(()=>{const grp=new e.Group;const base=tmat(8947848);const b=new e.Mesh(new e.BoxGeometry(3.5,3,3.5),base);b.position.y=1.5;grp.add(b);const dome=tmat(3368703);const d=new e.Mesh(new e.SphereGeometry(1.8,10,8,0,Math.PI*2,0,Math.PI/2),dome);d.position.y=3.2;grp.add(d);const spire=tmat(16776960);const s=new e.Mesh(new e.ConeGeometry(.3,1.8,6),spire);s.position.y=5.2;grp.add(s);const cross=tmat(16777215);const c1=new e.Mesh(new e.BoxGeometry(.1,1.2,.1),cross);c1.position.y=6.2;grp.add(c1);const c2=new e.Mesh(new e.BoxGeometry(.6,.1,.1),cross);c2.position.y=6.5;grp.add(c2);return{obj:grp,radius:3,height:7}},12,35,150);
  // nesting dolls
  g(()=>{const grp=new e.Group;const colors=[16711680,16776960,3368703,16777215];const n=colors[Math.floor(rng()*colors.length)];const mat=tmat(n);const bottom=new e.Mesh(new e.SphereGeometry(1,8,6,0,Math.PI*2,0,Math.PI/2),mat);bottom.scale.set(1,1.3,1);bottom.position.y=1.3;grp.add(bottom);const top=new e.Mesh(new e.SphereGeometry(.7,8,6),mat);top.scale.set(.9,1.1,.9);top.position.y=2.6;grp.add(top);const face=tmat(16777215);const f=new e.Mesh(new e.SphereGeometry(.2,6,4),face);f.position.set(0,2.8,.65);grp.add(f);return{obj:grp,radius:2,height:3.5}},16,25,130);
  // heavy machinery
  g(()=>{const grp=new e.Group;const metal=tmat(1118481);const base=new e.Mesh(new e.BoxGeometry(4,2,3),metal);base.position.y=1;grp.add(base);const cabin=tmat(16737843,{transparent:!0,opacity:.5});const c=new e.Mesh(new e.BoxGeometry(1.8,1.6,2),cabin);c.position.set(-.5,2.8,.2);grp.add(c);const arm=tmat(3355443);const a2=new e.Mesh(new e.CylinderGeometry(.25,.25,4,8),arm);a2.position.set(1.5,3,0);a2.rotation.z=Math.PI/4;grp.add(a2);const bucket=new e.Mesh(new e.BoxGeometry(1.4,1,1.4),arm);bucket.position.set(3,4.5,0);grp.add(bucket);return{obj:grp,radius:4,height:5}},8,40,160);
  // giant muscular guards
  g(()=>{const grp=new e.Group;const skin=tmat(13421772);const torso=new e.Mesh(new e.BoxGeometry(2.2,2.6,1.4),skin);torso.position.y=2.6;grp.add(torso);const head=new e.Mesh(new e.BoxGeometry(1.2,1.2,1.2),skin);head.position.y=4.6;grp.add(head);const arm=tmat(13421772);for(const ax of[-1.5,1.5]){const a=new e.Mesh(new e.CylinderGeometry(.45,.45,2,8),arm);a.position.set(ax,2.6,0);a.rotation.z=Math.PI/2;grp.add(a)}const leg=tmat(2236962);for(const lx of[-.6,.6]){const l=new e.Mesh(new e.CylinderGeometry(.4,.4,1.8,8),leg);l.position.set(lx,.9,0);grp.add(l)}const hat=tmat(2236962);const ht=new e.Mesh(new e.CylinderGeometry(1,1,.4,8),hat);ht.position.y=5.3;grp.add(ht);return{obj:grp,radius:2.5,height:5.5}},10,30,140);
  // ice patches (flat cylinders)
  g(()=>{const grp=new e.Group;const ice=tmat(14540253,{transparent:!0,opacity:.7});const p=new e.Mesh(new e.CylinderGeometry(3,3,.1,12),ice);p.position.y=.05;grp.add(p);return{obj:grp,radius:3.5,height:.2}},12,20,120);
}

return h;
}
