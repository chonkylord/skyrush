import*as e from'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.min.js';

// Big, bespoke roadside scenery for the five newer maps. Each theme gets:
//  - huge signature landmarks
//  - detailed medium props close to the track
//  - floating sky dioramas at eye level
//  - thousands of instanced ground details
//  - roadside flag poles and festival bunting
export function buildThemedDecor(key,i,a,c,d=7){
  const rng=(function(n){let t=n>>>0;return()=>(t=1664525*t+1013904223>>>0,t/4294967296)})(d);
  const root=new e.Group();
  const {N,P,R,U,T,gapSample,width}=i;
  const half=width/2;
  const UP=new e.Vector3(0,1,0);
  const matCache=new Map(),geoCache=new Map(),signCache=new Map(),flagCache=new Map();

  const mat=(color,opts={})=>{
    const k=color+'|'+JSON.stringify(opts);
    let m=matCache.get(k);
    if(!m){m=new e.MeshLambertMaterial({color,flatShading:!0,...opts});matCache.set(k,m)}
    return m;
  };
  const geo=(type,...args)=>{
    const k=type+':'+args.join(',');
    let g=geoCache.get(k);
    if(!g){g=new e[type](...args);geoCache.set(k,g)}
    return g;
  };
  const mesh=(g,m,x=0,y=0,z=0,rx=0,ry=0,rz=0)=>{
    const o=new e.Mesh(g,m);o.position.set(x,y,z);o.rotation.set(rx,ry,rz);return o;
  };
  const box=(w,h,d,m,x=0,y=0,z=0,ry=0)=>mesh(geo('BoxGeometry',w,h,d),m,x,y,z,0,ry,0);
  const cyl=(rt,rb,h,seg,m,x=0,y=0,z=0)=>mesh(geo('CylinderGeometry',rt,rb,h,seg),m,x,y,z);
  const sph=(r,m,x=0,y=0,z=0,sx=1,sy=1,sz=1)=>{const o=mesh(geo('SphereGeometry',r,10,8),m,x,y,z);o.scale.set(sx,sy,sz);return o};
  const cone=(r,h,seg,m,x=0,y=0,z=0)=>mesh(geo('ConeGeometry',r,h,seg),m,x,y,z);

  const onionGeo=(r,h,seg=10)=>{
    const k='onion:'+r+','+h+','+seg;
    let g=geoCache.get(k);
    if(!g){
      const pts=[[0,0],[1,0],[1.12,.14],[1,.32],[.8,.48],[.55,.62],[.4,.76],[.44,.9],[.36,1.05],[.2,1.2],[.08,1.36],[0,1.5]];
      g=new e.LatheGeometry(pts.map(([x,y])=>new e.Vector2(x*r,y*h/1.5)),seg);
      geoCache.set(k,g);
    }
    return g;
  };
  const onion=(r,h,m,seg=10)=>mesh(onionGeo(r,h,seg),m);
  const finial=(r,h,gold)=>{
    const g=new e.Group();
    g.add(onion(r,h,gold));
    g.add(cyl(.08*r,.12*r,2.2,5,gold,0,h+.9,0));
    g.add(sph(.22,.22,.22,gold,0,h+2.05,0));
    return g;
  };
  const archGroup=(w,h,depth,m,t)=>{
    const g=new e.Group();
    const rr=w/2;
    const ph=Math.max(1,h-rr);
    t=t||Math.max(.55,rr*.12);
    g.add(box(t,ph,depth,m,-rr+t/2,ph/2,0));
    g.add(box(t,ph,depth,m,rr-t/2,ph/2,0));
    g.add(mesh(geo('TorusGeometry',rr-t/2,t*.85,6,14,Math.PI),m,0,ph,0));
    return g;
  };
  const starGeo=(outer,inner,points,depth)=>{
    const shape=new e.Shape();
    for(let k=0;k<points*2;k++){
      const ang=-Math.PI/2+k*Math.PI/points;
      const rad=k%2?inner:outer;
      const x=Math.cos(ang)*rad,y=Math.sin(ang)*rad;
      k?shape.lineTo(x,y):shape.moveTo(x,y);
    }
    shape.closePath();
    const g=new e.ExtrudeGeometry(shape,{depth,bevelEnabled:!1});
    g.translate(0,0,-depth/2);
    return g;
  };

  const signMat=(text,bg,fg,glow=false)=>{
    const k=text+'|'+bg+'|'+fg+'|'+(glow?1:0);
    let m=signCache.get(k);
    if(m) return m;
    const W=256,H=96,cv=document.createElement('canvas');
    cv.width=W;cv.height=H;
    const g=cv.getContext('2d');
    g.fillStyle=bg;g.fillRect(0,0,W,H);
    g.strokeStyle=fg;g.lineWidth=8;g.strokeRect(5,5,W-10,H-10);
    g.fillStyle=fg;g.textAlign='center';g.textBaseline='middle';
    const lines=text.split('\n');
    const size=Math.floor(H*.42/Math.max(1,lines.length*.85));
    g.font='900 '+size+'px Arial Black, Arial, sans-serif';
    lines.forEach((ln,n)=>g.fillText(ln,W/2,H/2+(n-(lines.length-1)/2)*size*.95,W*.88));
    const tex=new e.CanvasTexture(cv);
    tex.colorSpace=e.SRGBColorSpace;tex.anisotropy=4;
    m=glow?new e.MeshBasicMaterial({map:tex,side:e.DoubleSide}):new e.MeshLambertMaterial({map:tex,side:e.DoubleSide,flatShading:!0});
    signCache.set(k,m);
    return m;
  };
  const signMesh=(text,bg,fg,w,h,glow=false)=>new e.Mesh(geo('PlaneGeometry',w,h),signMat(text,bg,fg,glow));

  const flagMat=(kind)=>{
    if(flagCache.has(kind)) return flagCache.get(kind);
    const W=96,H=64,cv=document.createElement('canvas');
    cv.width=W;cv.height=H;
    const g=cv.getContext('2d');
    const rect=(x,y,w,h,col)=>{g.fillStyle=col;g.fillRect(x,y,w,h)};
    if(kind==='in'){
      rect(0,0,96,22,'#ff9933');rect(0,22,96,20,'#ffffff');rect(0,42,96,22,'#138808');
      g.strokeStyle='#000080';g.lineWidth=2;g.beginPath();g.arc(48,32,7,0,7);g.stroke();
      for(let k=0;k<12;k++){const an=k*Math.PI/6;g.beginPath();g.moveTo(48,32);g.lineTo(48+Math.cos(an)*7,32+Math.sin(an)*7);g.stroke()}
    }else if(kind==='ru'){
      rect(0,0,96,22,'#ffffff');rect(0,22,96,20,'#0039a6');rect(0,42,96,22,'#d52b1e');
    }else if(kind==='mx'){
      rect(0,0,32,64,'#006847');rect(32,0,32,64,'#ffffff');rect(64,0,32,64,'#ce1126');
      g.fillStyle='#6b4a1f';g.beginPath();g.arc(48,34,6,0,7);g.fill();
      g.strokeStyle='#2e7d32';g.lineWidth=2;g.beginPath();g.arc(48,34,9,.3,2.8);g.stroke();
      g.fillStyle='#c62828';g.fillRect(45,29,6,7);
    }else if(kind==='usa'){
      for(let k=0;k<13;k++){rect(0,k*64/13,96,64/13,k%2?'#ffffff':'#b22234')}
      rect(0,0,42,34/64*64,'#3c3b6e');
      g.fillStyle='#ffffff';
      for(let y=0;y<4;y++)for(let x=0;x<6;x++){g.beginPath();g.arc(5+x*6.4,5+y*7.5,1.4,0,7);g.fill()}
    }else if(kind==='za'){
      rect(0,0,96,32,'#de3831');rect(0,32,96,32,'#002395');
      g.strokeStyle='#007a4d';g.lineWidth=11;
      g.beginPath();g.moveTo(0,32);g.lineTo(42,32);g.lineTo(96,5);g.stroke();
      g.beginPath();g.moveTo(0,32);g.lineTo(42,32);g.lineTo(96,59);g.stroke();
      g.fillStyle='#000000';g.beginPath();g.moveTo(0,0);g.lineTo(31,32);g.lineTo(0,64);g.closePath();g.fill();
      g.strokeStyle='#ffb612';g.lineWidth=5;g.beginPath();g.moveTo(0,0);g.lineTo(31,32);g.lineTo(0,64);g.stroke();
      g.strokeStyle='#ffffff';g.lineWidth=3;g.beginPath();g.moveTo(0,6);g.lineTo(25,32);g.lineTo(0,58);g.stroke();
    }else if(kind==='afr'){
      rect(0,0,96,21,'#2e7d32');rect(0,21,96,22,'#f2c14e');rect(0,43,96,21,'#c62828');
      g.fillStyle='#111';g.beginPath();
      for(let k=0;k<10;k++){const an=-Math.PI/2+k*Math.PI/5,r=k%2?7:14;const x=48+Math.cos(an)*r,y=32+Math.sin(an)*r;k?g.lineTo(x,y):g.moveTo(x,y)}
      g.closePath();g.fill();
    }else{
      rect(0,0,96,64,'#111111');rect(0,0,96,5,'#e53935');rect(0,59,96,5,'#e53935');
      g.fillStyle='#ffd54f';g.fillRect(28,29,40,6);g.fillRect(20,18,10,28);g.fillRect(66,18,10,28);
    }
    const tex=new e.CanvasTexture(cv);
    tex.colorSpace=e.SRGBColorSpace;tex.anisotropy=4;
    const m=new e.MeshLambertMaterial({map:tex,side:e.DoubleSide,flatShading:!0});
    flagCache.set(kind,m);
    return m;
  };

  const islandPal={
    samosa:{top:0x2e7d32,rim:0x8d5524,rock:0x6d4c41,accent:0xffb300,glow:0xffb300,hang:'vine'},
    africanium:{top:0x6b9b42,rim:0x8d5a3b,rock:0x6b4f39,accent:0xf2c14e,glow:0xf2c14e,hang:'vine'},
    gymbros:{top:0x5c7480,rim:0x9fb4bf,rock:0x6d8794,accent:0xff3d81,glow:0xff3d81,hang:'neon'},
    border:{top:0xc9a36a,rim:0x8d5a3b,rock:0x7a4f32,accent:0x2a9d8f,glow:0x2a9d8f,hang:'root'},
    finalmatushka:{top:0xdceef5,rim:0xa8d8ea,rock:0x7fa8b8,accent:0xe0b040,glow:0x9fe8ff,hang:'ice'}
  }[key]||{top:0x5b7d3a,rim:0x8d5524,rock:0x6d4c41,accent:0xffb300,glow:0xffb300,hang:'vine'};

  const makeIsland=(r,pal)=>{
    const g=new e.Group();
    const h=r*1.55;
    g.add(mesh(geo('ConeGeometry',r*.92,h,7),mat(pal.rock),0,-1.2-h/2,0,Math.PI,0,0));
    g.add(mesh(geo('CylinderGeometry',r*1.03,r*.95,1.2,7),mat(pal.rim),0,-.6,0));
    g.add(mesh(geo('CylinderGeometry',r,r*.97,.4,7),mat(pal.top),0,.2,0));
    if(pal.glow){
      const ring=mesh(geo('TorusGeometry',r*1.01,.11,5,24),mat(pal.glow,{emissive:pal.glow,emissiveIntensity:.8}),0,-.06,0,Math.PI/2);
      g.add(ring);
      for(let k=0;k<6;k++){
        const an=k*Math.PI/3;
        g.add(sph(r*.06,mat(pal.glow,{emissive:pal.glow,emissiveIntensity:.9}),Math.cos(an)*r*1.01,-.06,Math.sin(an)*r*1.01));
      }
    }
    for(let k=0;k<5;k++){
      const an=rng()*Math.PI*2,rr=r*(.65+rng()*.32);
      const x=Math.cos(an)*rr,z=Math.sin(an)*rr;
      if(pal.hang==='ice'){
        g.add(mesh(geo('ConeGeometry',.22+rng()*.18,2+rng()*2.2,5),mat(0xbfe9f5,{transparent:!0,opacity:.8,emissive:0x0a4b5e}),x,-1.4,z,Math.PI));
      }else if(pal.hang==='neon'){
        g.add(cyl(.05,.05,2.2+rng()*2,5,mat(pal.glow,{emissive:pal.glow}),x,-1.8,z));
      }else if(pal.hang==='root'){
        g.add(cyl(.06,.1,2+rng()*2.5,4,mat(0x5d4037),x,-1.7,z));
        g.add(sph(.18,mat(0x8d6e63),x,-2.7-rng()*1.5,z));
      }else{
        g.add(cyl(.05,.07,2.2+rng()*2.4,4,mat(0x2e7d32),x,-1.8,z));
        g.add(sph(.2+rng()*.1,mat(0x43a047),x,-2.8-rng()*1.3,z));
      }
    }
    for(let k=0;k<3;k++){
      const rr=r*(.14+rng()*.12),an=rng()*Math.PI*2,dd=r*(.35+rng()*.4);
      g.add(mesh(geo('DodecahedronGeometry',rr,0),mat(pal.rock),Math.cos(an)*dd,-1.4-rng()*r*.55,Math.sin(an)*dd));
    }
    return g;
  };

  const clearGround=(x,z,r,h)=>{
    const gy=a(x,z),rr=(r+half+6)*(r+half+6);
    for(let s=0;s<N;s+=2){
      const p=P[s],dx=p.x-x,dz=p.z-z;
      if(dx*dx+dz*dz<rr&&p.y-2<gy+h) return false;
    }
    return true;
  };
  const clearSky=(x,y,z,r,h)=>{
    const rr=(r+half+6)*(r+half+6);
    for(let s=0;s<N;s+=2){
      const p=P[s];
      if(p.y<y-5||p.y>y+h+5) continue;
      const dx=p.x-x,dz=p.z-z;
      if(dx*dx+dz*dz<rr) return false;
    }
    return true;
  };
  const cps=i.checkpoints||[];
  const nearCheckpoint=(idx,pad)=>cps.some(s=>Math.abs(s-idx)<pad);

  const roadside=(kinds,opts={})=>{
    const interval=opts.interval||22;
    const poleMat=mat(opts.pole||0x8a8f98);
    const pg=new e.CylinderGeometry(.08,.12,6,5);pg.translate(0,3,0);
    const fg=new e.PlaneGeometry(2.4,1.6);fg.translate(1.2,0,0);
    let n=0;
    for(let idx=10;idx<N-10;idx+=interval){
      if(gapSample[idx]||gapSample[idx-1]||nearCheckpoint(idx,12)) continue;
      for(const side of [-1,1]){
        const x=P[idx].x+R[idx].x*side*(half+1.05);
        const z=P[idx].z+R[idx].z*side*(half+1.05);
        const y=P[idx].y;
        root.add(mesh(pg,poleMat,x,y,z));
        const flag=mesh(fg,flagMat(kinds[n%kinds.length]),x,y+5.1,z);
        const t=T[idx].clone().negate();t.y=0;t.normalize();
        flag.rotation.y=Math.atan2(-t.z,t.x);
        root.add(flag);
        if(opts.topper) root.add(opts.topper(x,y+6.1,z));
        n++;
      }
    }
  };

  const bunting=(colors,interval=44)=>{
    const vmat=mat(0xffffff,{vertexColors:!0,side:e.DoubleSide});
    for(let idx=30;idx<N-30;idx+=interval){
      if(gapSample[idx]||gapSample[idx-1]||nearCheckpoint(idx,10)) continue;
      const grp=new e.Group();
      grp.position.copy(P[idx]).addScaledVector(U[idx],8.4);
      grp.quaternion.setFromRotationMatrix((new e.Matrix4).makeBasis(R[idx],U[idx],T[idx].clone().negate()));
      grp.add(box(width+2,.09,.09,mat(0x5a4a3a),0,0,0));
      const pos=[],col=[],n=7;
      for(let k=0;k<n;k++){
        const x=-width/2+(k+.5)*width/n;
        const cc=new e.Color(colors[k%colors.length]);
        const tri=[x-.55,0,0,x+.55,0,0,x,-1.35,0];
        for(let j=0;j<3;j++){pos.push(tri[j*3],tri[j*3+1],tri[j*3+2]);col.push(cc.r,cc.g,cc.b)}
      }
      const bg=new e.BufferGeometry();
      bg.setAttribute('position',new e.Float32BufferAttribute(pos,3));
      bg.setAttribute('color',new e.Float32BufferAttribute(col,3));
      bg.computeVertexNormals();
      grp.add(new e.Mesh(bg,vmat));
      root.add(grp);
    }
  };

  const nearby=(factory,count,opts={})=>{
    const {scaleMin=.9,scaleMax=1.2,minGap=8,extra=45,tries=50}=opts;
    let placed=0;
    for(let k=0;k<count*tries&&placed<count;k++){
      const idx=10+Math.floor(rng()*(N-20));
      if(gapSample[idx]) continue;
      const side=rng()<.5?-1:1;
      const obj=factory(rng);
      const sc=scaleMin+rng()*(scaleMax-scaleMin);
      const rad=obj.radius*sc,hgt=obj.height*sc;
      const off=half+rad+minGap+rng()*extra;
      const x=P[idx].x+R[idx].x*off*side;
      const z=P[idx].z+R[idx].z*off*side;
      if(!clearGround(x,z,rad,hgt)) continue;
      const gy=a(x,z);
      obj.obj.scale.setScalar(sc);
      obj.obj.position.set(x,gy-.25,z);
      obj.obj.rotation.y=Math.atan2(P[idx].x-x,P[idx].z-z);
      root.add(obj.obj);
      placed++;
    }
  };

  const exhibit=(factory,count,opts={})=>{
    const {scaleMin=.85,scaleMax=1.2,minGap=7,extra=26,tries=40}=opts;
    let placed=0;
    for(let k=0;k<count*tries&&placed<count;k++){
      const idx=12+Math.floor(rng()*(N-24));
      if(gapSample[idx]) continue;
      const side=rng()<.5?-1:1;
      const obj=factory(rng);
      const sc=scaleMin+rng()*(scaleMax-scaleMin);
      const rad=Math.max(obj.radius,4)*sc*1.05;
      const hgt=obj.height*sc+4;
      const off=half+rad+minGap+rng()*extra;
      const x=P[idx].x+R[idx].x*off*side;
      const z=P[idx].z+R[idx].z*off*side;
      const y=P[idx].y+(rng()*16-4);
      if(!clearSky(x,y,z,rad,hgt)) continue;
      const g=new e.Group();
      g.position.set(x,y,z);
      g.add(makeIsland(rad,islandPal));
      obj.obj.scale.setScalar(sc);
      obj.obj.position.y=.42;
      obj.obj.rotation.y=Math.atan2(P[idx].x-x,P[idx].z-z);
      g.add(obj.obj);
      root.add(g);
      placed++;
    }
  };

  const landmark=(factory,frac,side=1,scale=1,opts={})=>{
    const sky=!!opts.sky;
    const start=Math.round((N-1)*frac);
    for(let att=0;att<90;att++){
      const idx=Math.max(10,Math.min(N-11,start+(att%2?1:-1)*Math.floor(att/2)*8));
      const sd=(Math.floor(att/6)%2?1:-1)*side;
      const obj=factory(rng);
      obj.obj.scale.setScalar(scale);
      const rad=obj.radius*scale,hgt=obj.height*scale;
      const pr=sky?rad*1.1:rad;
      const off=half+pr+12+Math.floor(att/12)*16;
      const x=P[idx].x+R[idx].x*off*sd;
      const z=P[idx].z+R[idx].z*off*sd;
      const y=sky?P[idx].y+5:a(x,z);
      if(!(sky?clearSky(x,y,z,pr,hgt):clearGround(x,z,pr,hgt))) continue;
      if(sky){
        const g=new e.Group();
        g.position.set(x,y,z);
        g.add(makeIsland(pr,islandPal));
        obj.obj.position.y=.42;
        obj.obj.rotation.y=Math.atan2(P[idx].x-x,P[idx].z-z);
        g.add(obj.obj);
        root.add(g);
      }else{
        obj.obj.position.set(x,y-2,z);
        obj.obj.rotation.y=Math.atan2(P[idx].x-x,P[idx].z-z);
        root.add(obj.obj);
      }
      return true;
    }
    return false;
  };

  const distant=(factory,angle,dist,scale=1)=>{
    const obj=factory(rng);
    obj.obj.scale.setScalar(scale);
    const an=angle*Math.PI/180;
    const x=c.x+Math.cos(an)*dist,z=c.z+Math.sin(an)*dist;
    obj.obj.position.set(x,a(x,z)-4,z);
    obj.obj.rotation.y=Math.atan2(c.x-x,c.z-z);
    root.add(obj.obj);
  };

  const floater=(factory,count,opts={})=>{
    for(let k=0;k<count;k++){
      const obj=factory(rng);
      const an=rng()*Math.PI*2,dist=opts.min+Math.sqrt(rng())*(opts.max-opts.min);
      obj.obj.scale.setScalar(opts.scaleMin+rng()*(opts.scaleMax-opts.scaleMin));
      obj.obj.position.set(c.x+Math.cos(an)*dist,opts.yMin+rng()*(opts.yMax-opts.yMin),c.z+Math.sin(an)*dist);
      obj.obj.rotation.y=rng()*Math.PI*2;
      root.add(obj.obj);
    }
  };

  const scatterParts=(parts,count,opts={})=>{
    const {min=25,max=650,radius=1.5,height=2,avoid=true,smin=.8,smax=1.3}=opts;
    const lists=parts.map(()=>[]);
    let placed=0;
    for(let k=0;k<count*10&&placed<count;k++){
      let x,z;
      if(rng()<.72){
        // dense corridor hugging the track, where the player actually looks
        const idx=8+Math.floor(rng()*(N-16));
        if(gapSample[idx]) continue;
        const side=rng()<.5?-1:1;
        const off=half+10+Math.pow(rng(),.65)*110;
        x=P[idx].x+R[idx].x*off*side;
        z=P[idx].z+R[idx].z*off*side;
      }else{
        // wide background filler
        const an=rng()*Math.PI*2,dist=min+Math.sqrt(rng())*(max-min);
        x=c.x+Math.cos(an)*dist;z=c.z+Math.sin(an)*dist;
      }
      if(avoid&&!clearGround(x,z,radius,height)) continue;
      const gy=a(x,z),s=smin+rng()*(smax-smin);
      const q=new e.Quaternion().setFromAxisAngle(UP,rng()*Math.PI*2);
      for(let p=0;p<parts.length;p++){
        const part=parts[p],m=new e.Matrix4();
        m.compose(new e.Vector3(x+(part.x||0)*s,gy+(part.y||0)*s,z+(part.z||0)*s),q,new e.Vector3(s*(part.sx||1),s*(part.sy||1),s*(part.sz||1)));
        lists[p].push(m);
      }
      placed++;
    }
    parts.forEach((part,p)=>{
      const im=new e.InstancedMesh(part.geo,part.mat,lists[p].length);
      lists[p].forEach((m,n)=>im.setMatrixAt(n,m));
      im.frustumCulled=!1;
      root.add(im);
    });
  };

  // ===== SAMOSA LAND =====
  if(key==='samosa'){
    const cream=0xfff3d6,marble=0xf7f1e3,gold=0xe6b23a,goldD=0xa87818,saff=0xff8f1f,mag=0xd81b60,teal=0x00897b,green=0x2e7d32,red=0xc62828,blue=0x1565c0,wood=0x8d5524,clay=0xc96f3a,yellow=0xffd54f,brown=0x795548,skin=0x8d5524;

    // giant samosa on a brass tray
    const samosa=()=>{
      const g=new e.Group();
      g.add(cyl(4.7,4.9,.22,12,mat(0xb08d57),0,.11,0));
      g.add(mesh(geo('CylinderGeometry',3.5,3.5,.32,3),mat(0xc07a24),0,.35,0));
      const body=mesh(geo('ConeGeometry',3.35,4.6,3),mat(0xd99a3d),0,2.65,0,0,Math.PI/3,0);
      g.add(body);
      const crimp=mesh(geo('TorusGeometry',3.05,.28,5,12),mat(0xb87322),0,.55,0,Math.PI/2);
      g.add(crimp);
      for(const[tx,tz,cc]of[[-1.6,1.5,green],[1.6,1.5,red]]){
        g.add(cyl(.85,.75,.5,8,mat(0xf5f5f5),tx,.45,tz));
        g.add(cyl(.68,.68,.16,8,mat(cc),tx,.74,tz));
      }
      for(let k=0;k<6;k++) g.add(sph(.07,mat(0x3e2723),-1.5+rng()*3,2.4+rng()*1.6,1.2+rng()*1.1));
      return {obj:g,radius:5,height:5.5};
    };

    // spice cart with striped canopy
    const spiceStall=()=>{
      const g=new e.Group();
      g.add(box(8,.5,4,mat(wood),0,2.2,0));
      for(const x of[-3.4,3.4])for(const z of[-1.5,1.5]) g.add(box(.3,2.2,.3,mat(brown),x,1.1,z));
      for(const x of[-3.6,3.6]) g.add(cyl(.13,.13,4.6,6,mat(wood),x,4.5,0));
      for(let k=0;k<3;k++) g.add(box(2.8,.2,4.8,mat(k%2?cream:saff),-2.8+k*2.8,6.5,0));
      const spiceCols=[0xc62828,0xffb300,0xe65100,0x795548,0x2e7d32];
      for(let k=0;k<5;k++) g.add(cone(.95,1.7,8,mat(spiceCols[k]),-3.1+k*1.55,3.3,(k%2?-.7:.7)));
      for(const x of[-3.3,3.3]) for(const z of[-1.4,1.4]){
        g.add(mesh(geo('CylinderGeometry',.08,.08,1.1,5),mat(0x3e2723),x,5.4,z));
        g.add(sph(.28,mat(0xffd54f,{emissive:0x8a5a00}),x,4.95,z));
      }
      const sg=signMesh('SPICE','#8d5524','#ffd54f',5.5,1.5);sg.position.set(0,5.35,2.05);g.add(sg);
      return {obj:g,radius:6,height:7.5};
    };

    // chai stall
    const chai=()=>{
      const g=new e.Group();
      g.add(box(7,.5,4,mat(wood),0,1.8,0));
      for(const x of[-3,3])for(const z of[-1.5,1.5]) g.add(box(.28,1.8,.28,mat(brown),x,.9,z));
      for(const x of[-3.2,3.2]) g.add(cyl(.12,.12,4.6,6,mat(wood),x,4.3,0));
      for(let k=0;k<3;k++) g.add(box(2.5,.18,4.6,mat(k%2?cream:mag),-2.6+k*2.6,6.2,0));
      g.add(sph(1.55,mat(0xd7ccc8),0,3.8,0));
      g.add(cyl(.5,.6,.8,8,mat(0xb0bec5),0,5.3,0));
      g.add(cyl(.16,.22,1.6,6,mat(0xb0bec5),1.5,4.3,0));
      g.add(mesh(geo('TorusGeometry',.9,.12,5,10,Math.PI),mat(0x795548),0,4.3,0,0,0,Math.PI/2));
      for(const x of[-2.2,-1.5,1.7,2.4]) g.add(cyl(.22,.18,.35,7,mat(0xf5f5f5),x,2.15,1.1));
      for(let k=0;k<4;k++) g.add(sph(.35+k*.08,mat(0xffffff,{transparent:!0,opacity:.35}),-.3+k*.2,5.2+k*.55,.3));
      const sg=signMesh('CHAI','#d81b60','#fff3d6',4.8,1.4);sg.position.set(0,5.2,2.05);g.add(sg);
      return {obj:g,radius:6,height:7};
    };

    // decorated elephant
    const elephant=()=>{
      const g=new e.Group();
      const skin=mat(0x9e9e9e),dark=mat(0x757575),ivory=mat(0xf5f0d8);
      g.add(sph(3.6,skin,0,6.4,0,1.25,1.0,1.05));
      g.add(sph(2.2,skin,0,8.2,3.2));
      for(const s of[-1,1]){
        g.add(sph(1.8,skin,s*2.15,8.4,3.0,.18,1.15,1.0));
        g.add(mesh(geo('ConeGeometry',.45,2.4,6),ivory,s*.9,6.9,5.2,-.5,0,s*.15));
      }
      const trunk=[[0,7.4,4.8,1.1],[0,6.5,5.7,.85],[0,5.6,6.2,.62],[0,4.8,6.4,.42],[0,4.2,6.35,.26]];
      for(const[x,y,z,r]of trunk) g.add(sph(r,skin,x,y,z));
      for(const[x,z]of[[-2.4,-2.1],[-2.4,2.1],[2.4,-2.1],[2.4,2.1]]) g.add(cyl(1.05,1.25,4.8,7,skin,x,2.4,z));
      g.add(box(5.4,.5,4.4,mat(mag),0,7.4,0));
      g.add(box(5.8,.16,4.8,mat(gold),0,7.15,0));
      for(let k=0;k<5;k++) g.add(box(.2,.7,.2,mat(gold),-2.2+k*1.1,6.75,2.25));
      g.add(cyl(.9,.7,.55,8,mat(red),0,9.9,3.3));
      g.add(box(1.4,.2,.2,mat(gold),0,10.2,3.3));
      g.add(sph(.35,mat(yellow,{emissive:0x6b4a00}),0,10.55,3.3));
      g.add(mesh(geo('ConeGeometry',.35,1.4,5),mat(red),0,11.1,3.3));
      g.add(cyl(.12,.12,2.2,5,dark,0,6.2,-3.8,.8,0,0));
      g.add(sph(.35,dark,0,5.1,-4.4));
      return {obj:g,radius:7.5,height:13};
    };

    // auto rickshaw with driver
    const rickshaw=()=>{
      const g=new e.Group();
      g.add(box(5.4,2.2,2.5,mat(yellow),0,2.2,0));
      g.add(box(2.4,1.7,2.4,mat(green),-1.4,3.6,0));
      g.add(box(4.6,.28,2.7,mat(0xf5f5f5),.1,4.75,0));
      for(const x of[-1.9,2.1])for(const z of[-1.1,1.1]){
        g.add(mesh(geo('CylinderGeometry',.55,.55,.3,10),mat(0x212121),x,.65,z,0,0,Math.PI/2));
        g.add(mesh(geo('CylinderGeometry',.25,.25,.34,8),mat(0xb0bec5),x,.65,z,0,0,Math.PI/2));
      }
      g.add(box(.12,1.4,2.3,mat(0x90caf9,{transparent:!0,opacity:.55}),1.45,3.7,0));
      g.add(box(4.6,.35,.4,mat(0xf5f5f5),0,1.35,1.35));
      g.add(box(4.6,.35,.4,mat(0xf5f5f5),0,1.35,-1.35));
      for(const x of[-2.8,2.8]) g.add(sph(.3,mat(0xffd54f,{emissive:0x8a5a00}),x,2.7,1.2));
      g.add(sph(.52,mat(skin),-1.4,5.35,0));
      g.add(cyl(.42,.5,1.1,7,mat(0xf5f5f5),-1.4,4.55,0));
      g.add(sph(.18,mat(0x111111),-1.25,5.5,.45));
      g.add(sph(.18,mat(0x111111),-1.55,5.5,.45));
      g.add(box(.55,.18,.08,mat(red),-1.4,5.28,.5));
      g.add(mesh(geo('TorusGeometry',.65,.09,5,12,Math.PI),mat(0x212121),-1.4,4.15,0,0,0,Math.PI/2));
      g.add(cyl(.08,.08,2.6,5,mat(0x212121),-1.4,2.9,-1.35,0,0,Math.PI/2));
      g.add(mesh(geo('TorusGeometry',1.15,.06,4,16),mat(0x212121),-1.4,2.9,-1.35));
      return {obj:g,radius:4.5,height:6.2};
    };

    // banyan tree
    const banyan=()=>{
      const g=new e.Group();
      const bark=mat(0x6d4c41),leaf=mat(0x2e7d32),leaf2=mat(0x43a047);
      g.add(cyl(1.5,2.7,8,8,bark,0,4,0));
      for(let k=0;k<7;k++){
        const an=k*Math.PI*2/7,rr=4.5+rng()*2;
        g.add(cyl(.22,.34,8+rng()*3,5,bark,Math.cos(an)*rr,5.2,Math.sin(an)*rr));
      }
      for(const[x,y,z,r,mm]of[[0,10,0,6.5,leaf],[-4.5,9.5,2,4.5,leaf2],[4.4,9.8,-1.8,4.8,leaf],[0,12.5,2.4,4,leaf2],[-2.6,12,-3,3.6,leaf]]){
        g.add(sph(r,mm,x,y,z,1.3,.55,1.3));
      }
      return {obj:g,radius:11,height:15};
    };

    // peacock with fan tail
    const peacock=()=>{
      const g=new e.Group();
      const tealM=mat(0x00695c),blueM=mat(0x1565c0),goldM=mat(0xffd54f),bodyM=mat(0x00897b);
      const fan=new e.Mesh(geo('CircleGeometry',4.6,14,0,Math.PI),mat(0x00897b,{side:e.DoubleSide,emissive:0x003d33}));
      fan.position.set(0,4.5,-1.2);fan.scale.set(1,1,1);g.add(fan);
      for(let k=0;k<7;k++){
        const an=Math.PI*(.18+k*.107);
        g.add(sph(.45,mat([goldM,blueM,tealM][k%3],{emissive:0x1a237e}),Math.cos(an)*3.3,4.5+Math.sin(an)*3.3,-1.15));
        g.add(sph(.2,mat(0x1a237e),Math.cos(an)*3.5,4.5+Math.sin(an)*3.5,-1.1));
      }
      g.add(sph(1.35,bodyM,0,2.6,0,1,1.3,1));
      g.add(cyl(.3,.4,2.2,6,bodyM,0,4.4,.3));
      g.add(sph(.52,bodyM,0,5.5,.4));
      g.add(cone(.2,.8,5,mat(0xffb300),0,5.45,1));
      for(let k=0;k<3;k++) g.add(cyl(.04,.06,1,4,goldM,-.18+k*.18,6.15,.35,0,0,0));
      for(const x of[-.35,.35]) g.add(cyl(.1,.12,1.9,5,mat(0xffb300),x,.95,.15));
      return {obj:g,radius:5.5,height:7};
    };

    // bazaar tent
    const bazaar=()=>{
      const g=new e.Group();
      for(const x of[-5,5])for(const z of[-3.6,3.6]) g.add(cyl(.13,.16,5.8,6,mat(wood),x,2.9,z));
      for(let k=0;k<5;k++) g.add(box(2.05,.18,7.6,mat(k%2?saff:mag),-4.1+k*2.05,5.95,0));
      g.add(box(10.4,.3,.4,mat(gold),0,5.8,3.8));
      for(const[x,c]of[[-3,teal],[0,yellow],[3,red]]) g.add(box(2.2,3.2,.12,mat(c),x,3.9,3.82));
      g.add(box(7,.55,2.6,mat(wood),0,1.4,0));
      g.add(box(1.8,1.4,1.4,mat(brown),-3.4,.7,0));
      g.add(box(1.4,1.8,1.4,mat(0x6d4c41),3.4,.9,0));
      for(let k=0;k<3;k++) g.add(cyl(.55,.7,.9,8,mat(clay),-2+k*2,2.1,-1.4));
      g.add(sph(.5,mat(0xffd54f,{emissive:0x6b4a00}),0,5,3.2));
      return {obj:g,radius:7,height:6.5};
    };

    // festival gate
    const gate=()=>{
      const g=new e.Group();
      g.add(archGroup(9,7.5,1.2,mat(0xfff3d6)));
      for(let k=0;k<9;k++) g.add(sph(.28,mat(k%2?saff:yellow,{emissive:0x5a3a00}),-3.8+k*.95,6.9,0));
      for(const x of[-4.2,4.2]) g.add(cyl(.1,.12,3,5,mat(wood),x,9,0));
      g.add(box(9,.12,.12,mat(0x3e2723),0,9,0));
      return {obj:g,radius:5.5,height:9.5};
    };

    // golden temple landmark
    const temple=()=>{
      const g=new e.Group();
      g.add(box(36,2.6,30,mat(marble),0,1.3,0));
      g.add(box(32,1.4,26,mat(0xefe5cf),0,3,0));
      for(let k=0;k<5;k++) g.add(box(24-k*2,.55,2.2,mat(0xe8ddc4),0,.3+k*.55,14-k*2.2));
      g.add(box(16,12,16,mat(marble),0,9,0));
      g.add(box(17.2,1.6,17.2,mat(gold),0,15.7,0));
      for(const[x,z]of[[-8,-8],[8,-8],[-8,8],[8,8]]){
        g.add(box(4.4,16,4.4,mat(marble),x,10,z));
        g.add(box(5.1,1.3,5.1,mat(gold),x,18.4,z));
        g.add(onion(2.7,5.2,mat(gold),12));
        g.children[g.children.length-1].position.set(x,18.9,z);
        g.add(cyl(.16,.22,1.8,5,mat(gold),x,24.6,z));
        g.add(sph(.3,mat(0xffd54f),x,25.5,z));
      }
      const dome=onion(7.2,12,mat(gold),14);dome.position.y=16.5;g.add(dome);
      g.add(cyl(.24,.3,2.2,6,mat(gold),0,30.1,0));
      g.add(sph(.45,mat(0xffd54f,{emissive:0x8a5a00}),0,31.2,0));
      for(let k=0;k<4;k++) g.add(mesh(geo('TorusGeometry',7.3,.18,5,20),mat(goldD),0,17+k*1.8,0,Math.PI/2));
      g.add(archGroup(8,8,1.2,mat(gold),1.1));
      g.children[g.children.length-1].position.set(0,3,8.2);
      const pool=new e.Mesh(geo('CircleGeometry',11,20),mat(0x4fc3f7,{transparent:!0,opacity:.55,emissive:0x0d47a1}));
      pool.rotation.x=-Math.PI/2;pool.position.set(0,.18,20);pool.scale.set(1.3,1,1);g.add(pool);
      g.add(cyl(13,.5,.35,18,mat(marble),0,.2,20));
      for(const[x,z]of[[-14,20],[14,20],[-14,7],[14,7]]) g.add(cyl(.2,.28,10,5,mat(gold),x,5,z));
      for(const[x,z]of[[-14,20],[14,20],[-14,7],[14,7]]){
        const fl=new e.Mesh(geo('PlaneGeometry',2.1,1.4),flagMat('in'));fl.position.set(x,10.4,z);g.add(fl);
      }
      return {obj:g,radius:22,height:31};
    };

    // India Gate landmark
    const indiaGate=()=>{
      const g=new e.Group();
      g.add(box(38,2.4,13,mat(0xd7c9a8),0,1.2,0));
      g.add(box(30,24,8.5,mat(0xe8dcc2),0,15,-0));
      g.add(archGroup(20,21,9.2,mat(0xe8dcc2),2.2));
      g.children[g.children.length-1].position.set(0,2,0);
      g.add(box(32,3,9.4,mat(0xf3ead5),0,27,0));
      g.add(box(24,2.4,8.6,mat(0xe8dcc2),0,29.7,0));
      g.add(box(18,2,7.6,mat(0xf3ead5),0,31.9,0));
      g.add(cyl(2.1,2.4,.9,10,mat(0x5d4037),0,33.3,0));
      g.add(sph(1.5,mat(0xff6f00,{emissive:0xd84300}),0,34.5,0));
      for(const x of[-11,11]){
        g.add(box(5.6,2,8,mat(0xd7c9a8),x,33,0));
        g.add(cyl(.1,.14,5,5,mat(0x5d4037),x,36.5,0));
        g.add(sph(.35,mat(0xffd54f),x,39,0));
      }
      for(const x of[-9,9]) g.add(box(3.4,1.4,9.5,mat(0xf3ead5),x,25.6,0));
      g.add(box(20,.5,.5,mat(0xb08d57),0,12,4.4));
      return {obj:g,radius:22,height:39};
    };

    // distant Taj Mahal
    const taj=()=>{
      const g=new e.Group();
      g.add(box(46,2.5,38,mat(0xf7f1e3),0,1.25,0));
      g.add(box(30,14,30,mat(0xfaf5e8),0,9,0));
      g.add(box(32,1.6,32,mat(0xefe5cf),0,16.8,0));
      for(const[x,z]of[[-14,-14],[14,-14],[-14,14],[14,14]]){
        g.add(box(3.6,30,3.6,mat(0xfaf5e8),x,16,z));
        g.add(onion(2.1,4,mat(0xf7f1e3),10));
        g.children[g.children.length-1].position.set(x,31.5,z);
        g.add(cyl(.1,.16,2.2,5,mat(gold),x,36,z));
      }
      const d=onion(8.4,15,mat(0xfdf8ec),16);d.position.y=16.5;g.add(d);
      g.add(cyl(.3,.38,3.2,6,mat(gold),0,33.2,0));
      g.add(archGroup(10,11,1.4,mat(0x8d6e63),1.2));
      g.children[g.children.length-1].position.set(0,2,15.4);
      for(const[x,z]of[[-13,15],[13,15]]) g.add(cyl(.2,.3,10,5,mat(0x8d6e63),x,5,z));
      g.add(box(34,.8,2.2,mat(0xf7f1e3),0,.4,26));
      const pool=new e.Mesh(geo('CircleGeometry',12,18),mat(0x4fc3f7,{transparent:!0,opacity:.5,emissive:0x0d47a1}));
      pool.rotation.x=-Math.PI/2;pool.position.set(0,.14,30);pool.scale.set(1.6,1,1);g.add(pool);
      return {obj:g,radius:26,height:38};
    };

    distant(taj,-150,560,2.1);
    distant(taj,55,720,1.5);
    landmark(temple,.13,1,1.05);
    landmark(indiaGate,.63,-1,1.1);
    landmark(temple,.86,1,.72,{sky:!0});

    exhibit(banyan,6,{scaleMin:.9,scaleMax:1.15});
    exhibit(elephant,5,{scaleMin:.95,scaleMax:1.2});
    exhibit(peacock,5,{scaleMin:1.1,scaleMax:1.45});
    exhibit(rickshaw,4,{scaleMin:1,scaleMax:1.25});
    exhibit(samosa,4,{scaleMin:1.1,scaleMax:1.5});
    exhibit(bazaar,3,{scaleMin:.95,scaleMax:1.15});

    nearby(banyan,10);
    nearby(elephant,6,{minGap:12});
    nearby(rickshaw,9);
    nearby(spiceStall,10);
    nearby(chai,10);
    nearby(bazaar,8,{minGap:10});
    nearby(samosa,12,{scaleMin:1.1,scaleMax:1.4});
    nearby(peacock,9,{scaleMin:1.1,scaleMax:1.4});
    nearby(gate,9);

    scatterParts([
      {geo:geo('ConeGeometry',.55,1.1,5),mat:mat(0xffa000),y:.55},
      {geo:geo('ConeGeometry',.42,.85,5),mat:mat(0xffd54f),y:.45}
    ],650,{min:16,max:620,radius:1.2,height:1.3,smin:.75,smax:1.4});
    scatterParts([{geo:geo('DodecahedronGeometry',.9,0),mat:mat(0x8d6e63),y:.3}],220,{min:14,max:640,radius:1.5,height:1.4,smin:.6,smax:1.5});

    roadside(['in','in','in'],{pole:0xb08d57,topper:(x,y,z)=>sph(.26,mat(0xffa000,{emissive:0x5a3a00}),x,y,z)});
    bunting([0xff9933,0xffffff,0x138808,0xffa000,0xd81b60],42);
  }

  // ===== AFRICANIUM =====
  if(key==='africanium'){
    const bark=0x6b4f39,bark2=0x8a6a4f,leaf=0x3f6b2e,leaf2=0x6b9b42,sav=0xd2a24a,earth=0x8d5a3b,thatch=0xc9a24b,ivory=0xf0ead8,gray=0x8d8d8d,dark=0x5a5a5a,red=0xc0392b,yellow=0xf2c14e,green=0x2e7d32,blue=0x1565c0,pink=0xe76f51;

    const acacia=()=>{
      const g=new e.Group(),b=mat(bark),l1=mat(leaf),l2=mat(leaf2);
      g.add(cyl(1.3,2.1,8,7,b,0,4,0));
      for(const[x,z,rx,rz]of[[-2.2,0,-.45,0],[2.2,0,.45,0],[0,-2,.35,-.3],[0,2,-.35,.3]]){
        const arm=mesh(geo('CylinderGeometry',.45,.75,6,6),b,x,8.5,z,rx,0,rz);
        g.add(arm);
      }
      for(const[x,y,z,r]of[[0,12,0,7],[-5,11.5,2,4.6],[5,11.7,-1.6,4.8],[1,13.6,3,4.2],[-2,13.2,-3.4,3.8]]){
        g.add(sph(r,l1,x,y,z,1.35,.32,1.25));
        g.add(sph(r*.7,l2,x+.8,y+.5,z-.4,1.2,.25,1.1));
      }
      return {obj:g,radius:12,height:15};
    };

    const baobab=()=>{
      const g=new e.Group(),b=mat(bark2),b2=mat(bark),l=mat(leaf2);
      g.add(cyl(2.4,4.2,11,9,b,0,5.5,0));
      g.add(sph(4.1,b,0,4.6,0,1.1,.7,1.1));
      for(const[x,z,rx,rz]of[[-2.5,0,-.55,0],[2.5,0,.55,0],[0,-2.4,.5,-.45],[0,2.4,-.5,.45],[-2,-2,-.4,-.4],[2,2,.4,.4]]){
        g.add(mesh(geo('CylinderGeometry',.7,1.3,9,6),b,x,12,z,rx,0,rz));
      }
      for(const[x,y,z,r]of[[-5,18,0,3.2],[5,18.4,1,3.4],[0,19,-4,3],[2,20,4,2.6],[-3,19.6,3,2.4]]){
        g.add(sph(r,l,x,y,z,1.1,.8,1.1));
        g.add(sph(r*.7,mat(0x8fbc5a),x+.6,y+.6,z-.4,.9,.7,.9));
      }
      for(let k=0;k<7;k++){
        const an=k*Math.PI*2/7,rr=4.4+rng()*1.5;
        g.add(cyl(.55,.9,3,5,b2,Math.cos(an)*rr,.7,Math.sin(an)*rr));
      }
      return {obj:g,radius:10,height:21};
    };

    const elephant=()=>{
      const g=new e.Group(),skin=mat(gray),dk=mat(dark),iv=mat(ivory),blanket=mat(red),gold=mat(yellow);
      g.add(sph(4.2,skin,0,7.2,0,1.3,1.05,1.1));
      g.add(sph(2.5,skin,0,9.2,3.7));
      for(const s of[-1,1]){
        g.add(sph(2.8,skin,s*2.9,9.4,3.4,.18,1.2,1.05));
        g.add(mesh(geo('ConeGeometry',.5,2.8,6),iv,s*1.05,7.7,5.8,-.55,0,s*.18));
      }
      for(const[x,y,z,r]of[[0,8.4,5.4,1.35],[0,7.3,6.3,1.05],[0,6.2,6.9,.78],[0,5.1,7.1,.52],[0,4.2,7.05,.32]]) g.add(sph(r,skin,x,y,z));
      for(const[x,z]of[[-2.7,-2.4],[-2.7,2.4],[2.7,-2.4],[2.7,2.4]]) g.add(cyl(1.25,1.45,5.4,7,skin,x,2.7,z));
      g.add(box(6.4,.55,5.1,blanket,0,8.3,0));
      g.add(box(6.8,.18,5.5,gold,0,8.05,0));
      g.add(box(1.8,.7,.35,gold,0,8.35,2.6));
      g.add(sph(.4,mat(0xffd54f,{emissive:0x6b4a00}),0,8.35,2.85));
      g.add(cyl(.14,.14,2.6,5,dk,0,6.6,-4.4,.85,0,0));
      g.add(sph(.38,dk,0,5.4,-5.1));
      return {obj:g,radius:8,height:14};
    };

    const giraffe=()=>{
      const g=new e.Group(),skin=mat(0xd4a24a),spot=mat(0x8d5524),dk=mat(0x5d4037);
      for(const[x,z]of[[-1.4,-1.4],[-1.4,1.4],[1.4,-1.4],[1.4,1.4]]) g.add(cyl(.48,.62,8,6,skin,x,4,z));
      g.add(sph(2.3,skin,0,8.2,0,1.15,.85,.85));
      g.add(mesh(geo('CylinderGeometry',.62,.95,8,7),skin,0,12.5,1.3,.25,0,0));
      g.add(sph(1.0,skin,0,16.4,2.1,1,.85,1.1));
      g.add(sph(.32,skin,0,17.2,2.55));
      for(const s of[-1,1]){
        g.add(cyl(.08,.1,1,4,dk,s*.42,17.5,2.2));
        g.add(sph(.13,dk,s*.42,18.05,2.2));
        g.add(mesh(geo('ConeGeometry',.22,.8,4),skin,s*1.05,16.5,2.1,0,0,s*.9));
      }
      for(const[x,y,z,sx,sy]of[[-1.2,8.5,-.5,.55,.4],[1.1,8.3,.6,.5,.35],[-1.9,8.1,.4,.45,.3],[1.9,8.6,-.4,.5,.34],[0,7.5,1.1,.55,.4],[.3,13.6,1.6,.34,.45],[-.2,12,1.4,.3,.4],[.4,15,2,.28,.35],[1.8,8.9,.2,.4,.3],[-2,8.9,-.2,.4,.3]]){
        g.add(mesh(geo('SphereGeometry',.8,7,5),spot,x,y,z,0,0,0).clone());
        g.children[g.children.length-1].scale.set(sx,.6,sy);
      }
      g.add(cyl(.12,.16,2.2,5,dk,0,8.2,-2.3,-.3,0,0));
      g.add(sph(.3,dk,0,7.1,-2.9));
      return {obj:g,radius:7,height:18};
    };

    const zebra=()=>{
      const g=new e.Group(),wht=mat(0xf0ead8),blk=mat(0x212121);
      g.add(sph(2.2,wht,0,3.7,0,1.25,.8,.75));
      g.add(mesh(geo('CylinderGeometry',.65,.95,3.4,6),wht,0,5.7,1.4,.55,0,0));
      g.add(sph(.95,wht,0,6.9,2.4,1,.8,1.2));
      g.add(mesh(geo('ConeGeometry',.5,1.1,5),wht,0,6.6,3.4,Math.PI/2,0,0));
      for(const s of[-1,1]) g.add(mesh(geo('ConeGeometry',.18,.9,4),wht,s*.4,7.5,2.1,0,0,s*.35));
      for(const[x,z]of[[-1.1,-1.1],[-1.1,1.1],[1.1,-1.1],[1.1,1.1]]) g.add(cyl(.24,.3,3.3,5,wht,x,1.7,z));
      for(let k=0;k<6;k++) g.add(box(4.9,.22,.16,blk,0,2.9+k*.35,0));
      for(let k=0;k<4;k++) g.add(box(.25,1.9,.16,blk,-.7+k*.45,3.7,2.18));
      g.add(mesh(geo('ConeGeometry',.16,1.6,5),blk,0,5.4,-1.9,.4,0,0));
      return {obj:g,radius:5,height:8};
    };

    const zebraHerd=()=>{
      const g=new e.Group();
      for(const[x,z,ry]of[[0,0,0],[-4,2,.5],[4,-2,-.4]]){
        const zz=zebra();zz.obj.scale.setScalar(.85);zz.obj.position.set(x,0,z);zz.obj.rotation.y=ry;g.add(zz.obj);
      }
      return {obj:g,radius:9,height:8};
    };

    const lion=()=>{
      const g=new e.Group(),tan=mat(0xc99a4a),mane=mat(0x6b4a2a),dk=mat(0x3e2723);
      g.add(sph(2.2,tan,0,3.4,0,1.3,.75,.8));
      g.add(sph(1.5,mane,0,5,2.0,1,1,.55));
      g.add(sph(1.05,tan,0,5,2.55,1,.9,.9));
      g.add(sph(.3,tan,0,4.8,3.3));
      for(const s of[-1,1]) g.add(sph(.12,dk,s*.35,5.2,2.9));
      for(const[x,z]of[[-1,1],[1,1],[-1,-1],[1,-1]]) g.add(cyl(.28,.34,2.4,5,tan,x,1.2,z));
      g.add(mesh(geo('ConeGeometry',.18,2.4,5),mane,0,3.8,-2.1,-.4,0,0));
      g.add(sph(.35,mane,0,4.2,-3.2));
      return {obj:g,radius:4.5,height:6};
    };

    const huts=()=>{
      const g=new e.Group(),mud=mat(earth),th=mat(thatch),dk=mat(0x3e2723),bead=mat(red);
      for(const[x,z,s]of[[0,0,1],[-4.6,2,.78],[4.2,1.6,.7],[1,-4.2,.65]]){
        g.add(cyl(2.1*s,2.5*s,2.4*s,10,mud,x,1.2*s,z));
        g.add(cone(3.1*s,3.2*s,10,th,x,3.9*s,z));
        g.add(box(.8*s,1.6*s,.16*s,dk,x,.8*s,z+2.25*s));
        g.add(sph(.18*s,bead,x,2.5*s,z+2.3*s));
      }
      for(let k=0;k<18;k++){
        const an=k*Math.PI*2/18,rr=7.2;
        g.add(cyl(.09,.13,3.6,4,mat(0x795548),Math.cos(an)*rr,1.8,Math.sin(an)*rr,0,0,Math.sin(an)*.15));
      }
      return {obj:g,radius:9,height:7};
    };

    const drums=()=>{
      const g=new e.Group(),woodM=mat(0x795548),skinM=mat(0xf0ead8),rimM=mat(0x3e2723);
      for(const[x,z,h]of[[-2,0,3.6],[1.6,-1.2,2.8],[2.4,1.8,4.2]]){
        g.add(cyl(1.1,1.4,h,10,woodM,x,h/2,z));
        g.add(cyl(1.18,1.18,.18,10,skinM,x,h,z));
        g.add(cyl(1.22,1.22,.12,10,rimM,x,h+.16,z));
      }
      g.add(cone(1.5,2.4,7,mat(0xff6f00),0,.6,0));
      g.add(cone(.9,1.8,7,mat(0xffab00),0,1.1,0));
      for(let k=0;k<6;k++){
        const an=k*Math.PI*2/6;
        g.add(cyl(.1,.12,4.4,4,woodM,Math.cos(an)*4.4,2.2,Math.sin(an)*4.4,Math.sin(an)*.3,0,-Math.cos(an)*.3));
      }
      g.add(sph(.4,mat(0xffd54f,{emissive:0x6b4a00}),0,5.2,0));
      return {obj:g,radius:6,height:7};
    };

    const jeep=()=>{
      const g=new e.Group(),khaki=mat(0x8d7a4a),dk=mat(0x3e2723),glass=mat(0x90caf9,{transparent:!0,opacity:.55}),black=mat(0x212121);
      g.add(box(9,2.4,4.4,khaki,0,2.3,0));
      g.add(box(4.4,2,4.2,khaki,-2,4.2,0));
      g.add(box(4.2,1.3,4.3,glass,-2,4.4,0));
      g.add(box(9.4,.3,4.8,khaki,0,5.5,0));
      for(const x of[-3.1,3.1])for(const z of[-1.9,1.9]){
        g.add(mesh(geo('CylinderGeometry',1.1,1.1,.55,10),black,x,1.1,z,0,0,Math.PI/2));
        g.add(mesh(geo('CylinderGeometry',.48,.48,.6,8),mat(0xb0bec5),x,1.1,z,0,0,Math.PI/2));
      }
      g.add(mesh(geo('CylinderGeometry',.7,.7,.5,10),black,0,3.1,-2.5,0,0,Math.PI/2));
      for(const x of[-3.6,3.6]) g.add(sph(.32,mat(0xffd54f,{emissive:0x8a5a00}),x,2.7,2.25));
      g.add(box(9.2,.5,.4,mat(0x5d4037),0,1.2,2.3));
      g.add(cyl(.16,.2,3,5,black,-3.8,6,1.4));
      g.add(box(1.2,.5,.7,mat(0x3e2723),3.4,5.8,0));
      return {obj:g,radius:6,height:7};
    };

    const termite=()=>{
      const g=new e.Group(),mud=mat(0x8d5a3b),mud2=mat(0xa16a45);
      g.add(cyl(1.4,2.6,6,7,mud,0,3,0));
      g.add(mesh(geo('ConeGeometry',2.2,4.5,7),mud2,0,7.5,0));
      g.add(mesh(geo('ConeGeometry',1.3,3,6),mud,0,9.5,0));
      for(let k=0;k<8;k++){
        const an=rng()*Math.PI*2,rr=1.2+rng()*1.2,yy=1+rng()*6;
        g.add(sph(.18,mat(0x3e2723),Math.cos(an)*rr,yy,Math.sin(an)*rr));
      }
      return {obj:g,radius:4,height:10};
    };

    const waterhole=()=>{
      const g=new e.Group();
      const water=new e.Mesh(geo('CircleGeometry',11,18),mat(0x26a69a,{transparent:!0,opacity:.7,emissive:0x004d40}));
      water.rotation.x=-Math.PI/2;water.position.y=.12;g.add(water);
      for(let k=0;k<14;k++){
        const an=k*Math.PI*2/14,rr=10.5+rng()*1.5;
        g.add(mesh(geo('DodecahedronGeometry',.7+rng()*.6,0),mat(0x8d6e63),Math.cos(an)*rr,.3,Math.sin(an)*rr,0,rng()*3,0));
      }
      for(let k=0;k<8;k++){
        const an=k*Math.PI*2/8+.3,rr=8+rng()*3;
        const x=Math.cos(an)*rr,z=Math.sin(an)*rr;
        g.add(cyl(.08,.12,3,4,mat(0x6b8e23),x,1.5,z));
        g.add(sph(.3,mat(0x795548),x,3,z,.4,1.3,.4));
      }
      for(const[x,z]of[[-4,3],[4,-2]]){
        g.add(cyl(.12,.14,2.6,5,mat(pink),x,1.6,z));
        g.add(sph(.6,mat(pink),x,3,z,1.2,1,.8));
        g.add(cyl(.14,.18,1.8,5,mat(pink),x+.4,4.2,z));
        g.add(sph(.4,mat(pink),x+.6,5.2,z));
        g.add(cone(.24,.9,5,mat(0x212121),x+.75,5.1,z));
      }
      return {obj:g,radius:12,height:6};
    };

    const balloon=()=>{
      const g=new e.Group(),cols=[red,yellow,green,blue,0xff6f00];
      for(let k=0;k<8;k++){
        const m=new e.Mesh(new e.SphereGeometry(4.6,14,10,0,Math.PI*2,k*Math.PI/8,Math.PI/8),mat(cols[k%cols.length]));
        m.position.y=8;m.scale.y=1.35;g.add(m);
      }
      g.add(cyl(1.3,1.3,.5,10,mat(0x5d4037),0,2.4,0));
      for(const x of[-.8,.8])for(const z of[-.8,.8]) g.add(cyl(.06,.06,2.2,4,mat(0x8d6e63),x,4.3,z));
      g.add(cyl(.5,.65,1.2,8,mat(0x8d5524),0,1.7,0));
      return {obj:g,radius:5,height:14};
    };

    const lodge=()=>{
      const g=new e.Group(),woodM=mat(0x6d4c41),th=mat(thatch),deck=mat(0x8d6e63),warm=mat(0xffd54f,{emissive:0x8a5a00});
      for(const x of[-7,-2.3,2.3,7])for(const z of[-4,4]) g.add(cyl(.45,.6,9,6,woodM,x,4.5,z));
      g.add(box(17,.7,10,deck,0,8.7,0));
      g.add(box(13,5,8,mat(0xd7ccc8),0,11.5,0));
      g.add(box(13.6,.5,8.6,woodM,0,14.2,0));
      g.add(cone(10,6,4,th,0,17.4,0,Math.PI/4));
      for(let k=0;k<5;k++){
        if(k===2) continue;
        g.add(box(1.5,1.7,.15,mat(0x263238),-4.8+k*2.4,12,4.05));
        g.add(box(.3,1.7,1.5,mat(0x263238),-6.05,12,-4+k*2));
      }
      for(const x of[-6.5,6.5]) g.add(sph(.35,warm,x,9.8,4.5));
      g.add(box(17,.18,.18,woodM,0,10.2,5));
      for(const x of[-7,0,7]) g.add(box(.2,1.2,.2,woodM,x,9.6,5));
      g.add(archGroup(3.4,4,1,woodM,.5));
      g.children[g.children.length-1].position.set(0,8.7,5.4);
      return {obj:g,radius:13,height:19};
    };

    const kilimanjaro=()=>{
      const g=new e.Group();
      g.add(mesh(geo('ConeGeometry',150,190,9),mat(0x8d6e63),0,95,0));
      g.add(mesh(geo('ConeGeometry',105,120,9),mat(0x795548),0,130,0));
      g.add(mesh(geo('ConeGeometry',58,58,9),mat(0xf5f5f5),0,178,0));
      g.add(mesh(geo('ConeGeometry',34,40,8),mat(0xffffff),0,196,0));
      return {obj:g,radius:150,height:220};
    };

    const village=()=>{
      const g=new e.Group(),mud=mat(earth),th=mat(thatch),dk=mat(0x3e2723),bead=mat(red),bead2=mat(yellow);
      for(const[x,z,s]of[[0,0,1.1],[-6,3,.85],[6,2,.9],[2,-6,.8],[-4,-5,.75],[7,-4,.7]]){
        g.add(cyl(2.2*s,2.7*s,2.8*s,10,mud,x,1.4*s,z));
        g.add(cone(3.3*s,3.6*s,10,th,x,4.4*s,z));
        g.add(box(.8*s,1.7*s,.16*s,dk,x,1*s,z+2.35*s));
        g.add(sph(.2*s,bead,x,2.8*s,z+2.42*s));
        g.add(cyl(.06,.06,1.4,4,mat(0x5d4037),x,6.4*s,z));
        g.add(sph(.16,bead2,x,7.2*s,z));
      }
      for(let k=0;k<34;k++){
        const an=k*Math.PI*2/34,rr=12;
        g.add(cyl(.1,.16,4.2,4,mat(0x795548),Math.cos(an)*rr,2.1,Math.sin(an)*rr,0,0,Math.sin(an)*.12));
      }
      g.add(box(1.5,2.6,1.5,mat(0x6d4c41),0,1.3,0));
      return {obj:g,radius:14,height:10};
    };

    distant(kilimanjaro,-120,760,1.2);
    landmark(lodge,.18,1,1.1);
    landmark(village,.58,-1,1.15);
    landmark(baobab,.83,1,.95,{sky:!0});

    exhibit(acacia,7,{scaleMin:.9,scaleMax:1.2});
    exhibit(baobab,5,{scaleMin:.95,scaleMax:1.2});
    exhibit(elephant,5,{scaleMin:.95,scaleMax:1.2});
    exhibit(giraffe,5,{scaleMin:.95,scaleMax:1.2});
    exhibit(drums,4,{scaleMin:1,scaleMax:1.3});
    exhibit(huts,3,{scaleMin:.9,scaleMax:1.1});
    exhibit(waterhole,2,{scaleMin:.8,scaleMax:1});

    nearby(acacia,12);
    nearby(baobab,7,{minGap:10});
    nearby(elephant,7,{minGap:12});
    nearby(giraffe,6);
    nearby(zebraHerd,6,{minGap:10});
    nearby(lion,5);
    nearby(huts,5,{minGap:10});
    nearby(drums,6);
    nearby(jeep,8);
    nearby(termite,9);
    landmark(waterhole,.38,1,.9);
    landmark(waterhole,.72,-1,.8);

    scatterParts([
      {geo:geo('ConeGeometry',.22,1.2,4),mat:mat(0x9c8a3e),y:.6},
      {geo:geo('ConeGeometry',.18,.9,4),mat:mat(0xb8a450),y:.45},
      {geo:geo('ConeGeometry',.2,1.5,4),mat:mat(0x7a8f3a),y:.75}
    ],1100,{min:16,max:650,radius:1,height:1.6,smin:.7,smax:1.5});
    scatterParts([{geo:geo('DodecahedronGeometry',1,0),mat:mat(0x8d6e63),y:.3}],240,{min:14,max:660,radius:1.8,height:1.5,smin:.5,smax:1.7});

    floater(balloon,6,{min:120,max:520,yMin:80,yMax:190,scaleMin:.8,scaleMax:1.5});

    roadside(['za','afr','za'],{pole:0x6d4c41,topper:(x,y,z)=>sph(.24,mat(0xf2c14e,{emissive:0x6b4a00}),x,y,z)});
    bunting([0x2e7d32,0xf2c14e,0xc62828,0x111111,0xf5f0d8],44);
  }

  // ===== GYMBROS =====
  if(key==='gymbros'){
    const char=0x23282e,steel=0x78909c,chrome=0xcfd8dc,blk=0x111111,red=0xe53935,redD=0x8e1b18,yel=0xffd54f,gold=0xc9a227,wht=0xf5f5f5,neon=0xff3d81,cyan=0x00e5ff;

    const dumbbell=(s=1)=>{
      const g=new e.Group();
      const bar=mesh(geo('CylinderGeometry',.22*s,.22*s,6*s,8),mat(chrome),0,1.8*s,0,0,0,Math.PI/2);
      g.add(bar);
      for(const x of[-2.1,-2.7,2.1,2.7]){
        g.add(mesh(geo('CylinderGeometry',1.1*s,1.1*s,.38*s,12),mat(x<0?red:redD),x,1.8*s,0,0,0,Math.PI/2));
        g.add(mesh(geo('CylinderGeometry',.42*s,.42*s,.42*s,8),mat(steel),x,1.8*s,0,0,0,Math.PI/2));
      }
      return {obj:g,radius:3.6*s,height:2.9*s};
    };

    const dumbbellRack=()=>{
      const g=new e.Group(),frame=mat(steel);
      for(const x of[-5.5,5.5]){
        g.add(mesh(geo('BoxGeometry',.35,5.5,.35),frame,x,2.75,-1.8,0,0,-.35));
        g.add(mesh(geo('BoxGeometry',.35,4.2,.35),frame,x,2.1,1.8,0,0,.2));
      }
      for(let k=0;k<4;k++){
        const y=1+k*1.15,sc=.55+k*.16;
        g.add(box(11,.18,.7,frame,0,y,0));
        const d=dumbbell(sc);
        d.obj.position.set(0,y+.42,0);g.add(d.obj);
      }
      return {obj:g,radius:7,height:6};
    };

    const benchPress=()=>{
      const g=new e.Group(),frame=mat(steel),pad=mat(0x212121),plate=mat(red),barM=mat(chrome);
      g.add(box(5.5,.4,1.8,pad,0,1.7,0));
      for(const x of[-2,2]) g.add(box(.25,1.6,.3,frame,x,.8,0));
      for(const z of[-1.2,1.2]) g.add(box(6.5,.18,.25,frame,0,1.5,z));
      g.add(box(.35,4.4,.35,frame,-2.8,3.1,0));
      g.add(box(.35,4.4,.35,frame,2.8,3.1,0));
      g.add(box(6.6,.22,.22,barM,0,5,0));
      for(const x of[-2.4,-3,2.4,3]) g.add(mesh(geo('CylinderGeometry',1.05,1.05,.34,12),plate,x,5,0,0,0,Math.PI/2));
      g.add(box(1.1,.2,.6,mat(0x212121),0,2,0));
      return {obj:g,radius:4.5,height:5.2};
    };

    const squatRack=()=>{
      const g=new e.Group(),frame=mat(steel),redM=mat(red),chromeM=mat(chrome);
      for(const x of[-2.6,2.6]){
        g.add(box(.4,8.2,.4,frame,x,4.1,0));
        g.add(box(1.6,.35,.5,frame,x,.2,0));
        g.add(box(.4,.35,2.2,frame,x,.2,0));
      }
      g.add(box(5.8,.25,.25,chromeM,0,8.2,0));
      for(let k=0;k<3;k++) g.add(box(.16,.16,3,chromeM,0,8.4+k*.2,0));
      g.add(box(6.6,.24,.24,chromeM,0,4.6,0));
      for(const x of[-2.5,-3.1,2.5,3.1]) g.add(mesh(geo('CylinderGeometry',1.15,1.15,.36,12),redM,x,4.6,0,0,0,Math.PI/2));
      return {obj:g,radius:4.5,height:8.6};
    };

    const treadmill=()=>{
      const g=new e.Group(),frame=mat(steel),belt=mat(0x111111),redM=mat(red);
      g.add(box(6.4,.55,2.6,belt,0,.8,0));
      g.add(box(6.8,.3,2.8,frame,0,1.1,0));
      g.add(mesh(geo('BoxGeometry',.3,5,.3),frame,-2.9,3.2,-1));
      for(const x of[-2.9,2.9]) g.add(box(.3,3.8,.3,frame,x,2.4,1.15));
      g.add(mesh(geo('BoxGeometry',3.2,1.8,.35),mat(0x212121),0,4.3,1.25));
      g.add(box(2.6,1.1,.08,mat(0x00e5ff,{emissive:0x006064}),0,4.4,1.44));
      g.add(box(6.8,.2,.25,redM,0,1.35,1.35));
      return {obj:g,radius:4,height:5.5};
    };

    const protein=()=>{
      const g=new e.Group(),w=mat(wht),r=mat(red),y=mat(yel);
      g.add(cyl(2.4,2.4,5.2,14,w,0,2.6,0));
      g.add(cyl(2.55,2.55,.5,14,r,0,5.3,0));
      g.add(cyl(.8,1.1,.6,10,r,0,5.8,0));
      const sg=signMesh('PROTEIN','#e53935','#ffffff',3.4,1.5);sg.position.set(0,3,.0);sg.position.z=2.42;g.add(sg);
      g.add(box(.4,3.2,.4,y,2.8,2.1,1.3));
      g.add(mesh(geo('SphereGeometry',.85,8,6),y,2.8,4.1,1.3));
      g.add(cyl(.2,.35,1.1,8,y,2.8,3.5,1.3));
      return {obj:g,radius:3.4,height:6.1};
    };

    const kettlebell=()=>{
      const g=new e.Group(),body=mat(0x212121);
      g.add(mesh(geo('SphereGeometry',1.8,10,8),body,0,2,0,0,0,0));
      g.add(cyl(1.5,1.7,.35,10,body,0,.25,0));
      g.add(mesh(geo('TorusGeometry',1.05,.24,6,12,Math.PI),mat(steel),0,3.7,0));
      for(const x of[-.68,.68]) g.add(box(.28,1.1,.28,mat(steel),x,3.15,0));
      return {obj:g,radius:2.2,height:4.4};
    };

    const plates=()=>{
      const g=new e.Group();
      for(let k=0;k<5;k++){
        g.add(mesh(geo('CylinderGeometry',1.45,1.45,.32,14),mat(k%2?red:redD),0,.16+k*.33,0));
        g.add(mesh(geo('CylinderGeometry',.4,.4,.34,8),mat(steel),0,.16+k*.33,0));
      }
      g.add(box(.4,1.1,1.2,mat(steel),1.6,.55,0));
      return {obj:g,radius:2.2,height:2.2};
    };

    const ring=()=>{
      const g=new e.Group(),canvasM=mat(0xeceff1),post=mat(red),rope=mat(0xf5f5f5,{emissive:0x4a4a4a}),pad=mat(neon,{emissive:0x8a103f});
      g.add(box(14,1.2,14,mat(0x263238),0,.6,0));
      g.add(box(12.2,.3,12.2,canvasM,0,1.3,0));
      for(const[x,z]of[[-6,-6],[6,-6],[-6,6],[6,6]]){
        g.add(cyl(.3,.38,7.5,8,post,x,5,z));
        g.add(sph(.45,mat(yel),x,8.8,z));
        g.add(box(1.6,.9,1.6,pad,x,2,z));
      }
      for(let k=0;k<3;k++){
        const y=2.8+k*1.35;
        g.add(box(12,.12,.12,rope,0,y,-6));
        g.add(box(12,.12,.12,rope,0,y,6));
        g.add(box(.12,.12,12,rope,-6,y,0));
        g.add(box(.12,.12,12,rope,6,y,0));
      }
      for(const[x,z]of[[-4.5,-4.5],[4.5,-4.5]]) g.add(box(1.2,1.2,1.2,mat(0x212121),x,1.9,z));
      return {obj:g,radius:8,height:9};
    };

    const billboard=(text='NO PAIN',bg='#111111',fg='#ffd54f')=>()=>{
      const g=new e.Group(),post=mat(steel);
      for(const x of[-3.4,3.4]) g.add(box(.35,7,.35,post,x,3.5,0));
      g.add(box(10,4.6,.4,mat(0x111111),0,7.5,0));
      const sm=signMesh(text,bg,fg,9.2,3.8,!0);sm.position.set(0,7.5,.24);g.add(sm);
      for(const x of[-4.4,-1.4,1.4,4.4]) g.add(sph(.22,mat(0xffffff,{emissive:0xffffff}),x,9.9,0));
      return {obj:g,radius:6,height:10};
    };

    const trophy=()=>{
      const g=new e.Group(),goldM=mat(gold,{emissive:0x3e2a00});
      g.add(box(4.2,1,4.2,mat(0x263238),0,.5,0));
      g.add(box(3.4,.5,3.4,mat(0x37474f),0,1.2,0));
      g.add(cyl(1.4,2.2,3.4,12,goldM,0,3.2,0));
      g.add(cyl(1.5,1.1,.8,12,goldM,0,5.2,0));
      g.add(mesh(geo('TorusGeometry',1.7,.22,6,12,Math.PI),goldM,-1.6,4.2,0,0,0,Math.PI/2));
      g.add(mesh(geo('TorusGeometry',1.7,.22,6,12,Math.PI),goldM,1.6,4.2,0,0,0,-Math.PI/2));
      const st=new e.Mesh(starGeo(1.1,.5,5,.22),mat(yel,{emissive:0x6b4a00}));st.position.set(0,6.4,0);g.add(st);
      return {obj:g,radius:3,height:6.5};
    };

    const colossus=()=>{
      const g=new e.Group(),bronze=mat(0xc9a227,{emissive:0x2a1a00});
      g.add(box(16,1.2,16,mat(0x212121),0,.6,0));
      g.add(box(14,3.6,14,mat(0x37474f),0,3,0));
      g.add(box(12,.8,12,mat(0x455a64),0,5.2,0));
      for(const x of[-3.2,3.2]){
        g.add(cyl(1.7,2.1,12,8,bronze,x,11,0));
        g.add(mesh(geo('SphereGeometry',2,8,6),bronze,x,17,0,0,0,0));
      }
      g.add(mesh(geo('CylinderGeometry',5.6,3.4,10,7),bronze,0,21.5,0));
      g.add(box(12,5,6,bronze,0,25,0));
      for(const s of[-1,1]){
        g.add(sph(2.4,bronze,s*6.2,26,0));
        g.add(mesh(geo('CylinderGeometry',1.5,1.8,7,7),bronze,s*8,22.5,0,0,0,s*.5));
        g.add(mesh(geo('CylinderGeometry',1.15,1.5,6,7),bronze,s*10.3,25.5,.8,-.35,0,s*.18));
        g.add(sph(1.35,bronze,s*10.8,28.5,1.2));
      }
      g.add(sph(1.7,bronze,0,30.2,0,1,.9,.9));
      g.add(box(2.4,.6,1.6,mat(0x8d6e63),0,30.9,.4));
      g.add(sph(.3,mat(neon,{emissive:neon}),-.55,30.3,1.35));
      g.add(sph(.3,mat(neon,{emissive:neon}),.55,30.3,1.35));
      const bar=mesh(geo('CylinderGeometry',.3,.3,9,8),mat(chrome),0,35,1.2,0,0,Math.PI/2);g.add(bar);
      for(const x of[-4,-4.8,4,4.8]) g.add(mesh(geo('CylinderGeometry',1.3,1.3,.5,12),mat(red),x,35,1.2,0,0,Math.PI/2));
      return {obj:g,radius:14,height:36};
    };

    const building=()=>{
      const g=new e.Group(),dark=mat(char),frame=mat(steel),redM=mat(red);
      g.add(box(24,20,18,dark,0,10,0));
      g.add(box(25,.8,19,redM,0,20,0));
      g.add(box(25,.8,19,redM,0,1,0));
      for(let y=0;y<4;y++)for(let x=0;x<5;x++) g.add(box(2,1.6,.15,mat(0xffd54f,{emissive:0x6b4a00}),-8+x*4,5+y*3.6,9.05));
      for(let y=0;y<3;y++)for(const x of[-5,5]) g.add(box(1.4,2.2,.15,mat(0x90caf9,{emissive:0x0d47a1}),x,6+y*4,-9.05));
      g.add(box(8,7,.8,mat(0x90caf9,{transparent:!0,opacity:.55}),0,4,9.5));
      g.add(box(10,.5,4,frame,0,8,11));
      for(const x of[-4,4]) g.add(cyl(.15,.2,6,5,frame,x,5,11));
      const sm=signMesh('GYMBROS','#111111','#ff3d81',16,4,!0);sm.position.set(0,22.8,.2);g.add(sm);
      g.add(box(16.5,4.6,.5,dark,0,22.8,0));
      for(const x of[-7,7]) g.add(box(.4,3,.4,frame,x,20.5,0));
      const d=dumbbell(1.8);d.obj.position.set(10,0,10);d.obj.rotation.y=.4;g.add(d.obj);
      return {obj:g,radius:17,height:25};
    };

    const neonSign=(text,bg,fg)=>billboard(text,bg,fg);

    const gantry=(text,fg)=>{
      const g=new e.Group(),steelM=mat(steel),redM=mat(red);
      for(const s of[-1,1]){
        g.add(cyl(.24,.34,9.2,8,steelM,s*(half+1.7),4.6,0));
        g.add(box(.8,.8,.8,redM,s*(half+1.7),9.2,0));
      }
      g.add(box(width+4.6,.55,.55,redM,0,9.2,0));
      const sm=signMesh(text,'#111111',fg,width*.62,2.4,!0);sm.position.set(0,10.9,0);g.add(sm);
      for(let k=0;k<4;k++) g.add(sph(.26,mat(neon,{emissive:neon}),-width*.33+k*width*.22,9.95,.5));
      return g;
    };
    const placeGantry=(idx,text,fg)=>{
      if(idx>=N-20||gapSample[idx]||gapSample[idx-1]) return;
      const g=gantry(text,fg);
      g.position.copy(P[idx]);
      g.quaternion.setFromRotationMatrix((new e.Matrix4).makeBasis(R[idx],U[idx],T[idx].clone().negate()));
      root.add(g);
    };
    placeGantry(Math.floor(N*.22),'GYMBROS','#ff3d81');
    placeGantry(Math.floor(N*.52),'NO PAIN','#00e5ff');
    placeGantry(Math.floor(N*.78),'NO GAIN','#ffd54f');

    // glowing neon edge rails: pink on one side, cyan on the other
    const railBox=geo('BoxGeometry',.16,.16,1);
    const mkRail=(color,side)=>{
      const list=[];
      for(let idx=10;idx<N-10;idx+=3){
        if(gapSample[idx]||gapSample[idx+1]) continue;
        const j=Math.min(N-1,idx+3);
        const a=P[idx].clone().addScaledVector(R[idx],side*(half+.28)).addScaledVector(U[idx],.62);
        const b=P[j].clone().addScaledVector(R[j],side*(half+.28)).addScaledVector(U[j],.62);
        const dir=b.clone().sub(a),len=dir.length();
        if(len<.01) continue;
        const mid=a.clone().add(b).multiplyScalar(.5);
        const q=new e.Quaternion().setFromUnitVectors(new e.Vector3(0,0,1),dir.normalize());
        list.push(new e.Matrix4().compose(mid,q,new e.Vector3(1,1,len)));
      }
      const im=new e.InstancedMesh(railBox,mat(color,{emissive:color,emissiveIntensity:.85}),list.length);
      list.forEach((m,n)=>im.setMatrixAt(n,m));
      im.frustumCulled=!1;root.add(im);
    };
    mkRail(neon,-1);
    mkRail(cyan,1);

    landmark(colossus,.14,1,1.25);
    landmark(building,.53,-1,1.3);
    landmark(colossus,.86,1,.95,{sky:!0});

    exhibit(dumbbellRack,7,{scaleMin:1.15,scaleMax:1.45});
    exhibit(ring,3,{scaleMin:1.2,scaleMax:1.45});
    exhibit(protein,6,{scaleMin:1.5,scaleMax:1.9});
    exhibit(treadmill,5,{scaleMin:1.2,scaleMax:1.5});
    exhibit(trophy,6,{scaleMin:1.5,scaleMax:2});
    exhibit(kettlebell,6,{scaleMin:1.6,scaleMax:2.1});

    nearby(dumbbellRack,8);
    nearby(benchPress,8);
    nearby(squatRack,8);
    nearby(treadmill,8);
    nearby(protein,10);
    nearby(kettlebell,8);
    nearby(plates,10);
    nearby(ring,4,{minGap:12});
    nearby(trophy,8);
    nearby(billboard('NO PAIN'),6,{minGap:10});
    nearby(billboard('DO YOU\nEVEN LIFT?','#111111','#00e5ff'),5,{minGap:10});
    nearby(billboard('GAINS','#e53935','#ffffff'),5,{minGap:10});

    scatterParts([
      {geo:geo('CylinderGeometry',.55,.55,.18,12),mat:mat(red),y:.09,sy:1},
      {geo:geo('CylinderGeometry',.55,.55,.18,12),mat:mat(redD),y:.3},
      {geo:geo('CylinderGeometry',.16,.16,1.7,6),mat:mat(chrome),y:.9,rx:0}
    ],260,{min:14,max:640,radius:1.3,height:1.2,smin:.6,smax:1.5});
    scatterParts([
      {geo:geo('CylinderGeometry',.08,.08,1.9,6),mat:mat(chrome),y:.1,sy:1},
      {geo:geo('CylinderGeometry',.4,.4,.16,8),mat:mat(red),y:.1,x:-.8}
    ],220,{min:14,max:620,radius:1.2,height:.8,smin:.5,smax:1.2});
    scatterParts([{geo:geo('BoxGeometry',2.2,.12,1),mat:mat(0x283593),y:.08}],180,{min:12,max:600,radius:2,height:.5,smin:.6,smax:1.4});

    floater(()=>{
      const g=new e.Group(),bar=mesh(geo('CylinderGeometry',.25,.25,8,8),mat(chrome),0,0,0,0,0,Math.PI/2);g.add(bar);
      for(const x of[-3.5,-4.2,3.5,4.2]) g.add(mesh(geo('CylinderGeometry',1.4,1.4,.55,12),mat(red),x,0,0,0,0,Math.PI/2));
      return {obj:g,radius:5,height:4};
    },5,{min:90,max:380,yMin:70,yMax:150,scaleMin:1,scaleMax:2});

    roadside(['gym','gym','gym'],{pole:0x37474f,topper:(x,y,z)=>sph(.25,mat(neon,{emissive:neon}),x,y,z)});
    bunting([0xe53935,0xffd54f,0x111111,0xff3d81,0x00e5ff],40);
  }

  // ===== BORDER =====
  if(key==='border'){
    const sand=0xd9b380,adobe=0xe6d3b3,adobeD=0xbfa27a,terra=0xb35c2e,rust=0x8d4a2a,cactus=0x3c7a4a,cactusD=0x2e5e38,cream=0xf5f0e0,wht=0xf7f2e6,turq=0x2a9d8f,pink=0xe76f51,yel=0xf4a261,red=0xc62828,green=0x2a9d8f,blue=0x1565c0,blk=0x222222,steel=0x5a626d;

    const saguaro=()=>{
      const g=new e.Group(),cm=mat(cactus),cd=mat(cactusD);
      g.add(cyl(1.05,1.25,11,8,cm,0,5.5,0));
      g.add(sph(1.05,cm,0,11,0));
      for(const s of[-1,1]){
        g.add(mesh(geo('CylinderGeometry',.55,.65,3.2,7),cm,s*1.8,5.4,0,0,0,Math.PI/2));
        g.add(cyl(.52,.65,5.4,7,cm,s*3.3,7.8,0));
        g.add(sph(.55,cm,s*3.3,10.5,0));
        g.add(mesh(geo('CylinderGeometry',.4,.5,2.6,6),cm,s*1.4,8.6,0,0,0,Math.PI/2));
      }
      for(let k=0;k<6;k++){
        const an=k*Math.PI/3;
        g.add(cyl(.1,.13,10.5,4,cd,Math.cos(an)*.9,5.4,Math.sin(an)*.9));
      }
      for(const[x,y,z]of[[0,11.5,0],[-3.3,11,-0], [3.3,11,0]]){
        g.add(sph(.28,mat(0xffeb3b,{emissive:0x6b5a00}),x,y,z));
        g.add(sph(.14,mat(0xff7043),x+.16,y+.12,z));
      }
      return {obj:g,radius:4,height:12.2};
    };

    const prickly=()=>{
      const g=new e.Group(),cm=mat(cactus),cd=mat(cactusD),fruit=mat(pink);
      const pads=[[0,1.4,0,1.1,1.6,.6],[1.4,2.4,.4,.9,1.3,.55],[-1.3,2.7,-.3,.85,1.2,.5],[-.3,3.8,.3,.7,1,.45],[.8,4,-.2,.6,.9,.4]];
      for(const[x,y,z,sx,sy,sz]of pads){
        g.add(sph(.9,cm,x,y,z,sx,sy,sz));
        g.add(sph(.9,cd,x+.1,y+.1,z-.1,sx*.9,sy*.9,sz*.9));
      }
      for(const[x,y,z]of[[0,3.1,.5],[1.4,3.7,.7],[-1.3,3.8,.2],[.8,4.9,.2]]) g.add(sph(.28,fruit,x,y,z));
      return {obj:g,radius:3,height:5};
    };

    const hacienda=()=>{
      const g=new e.Group(),wall=mat(adobe),trim=mat(adobeD),roof=mat(terra),dk=mat(0x3e2723);
      g.add(box(14,6.5,10,wall,0,3.25,0));
      g.add(box(14.6,.5,10.6,trim,0,6.6,0));
      for(let k=0;k<5;k++) g.add(box(2.5,1.1,.5,trim,-5.2+k*2.6,7,5.05));
      g.add(box(15,1.2,1.8,roof,0,7.6,5.1));
      g.add(archGroup(4,5.2,1.2,trim,.5));
      g.children[g.children.length-1].position.set(0,0,5.15);
      for(const x of[-4.2,4.2]) g.add(box(1.6,2,.15,dk,x,3.4,5.05));
      g.add(box(2.4,2.8,2.4,wall,5.8,7.4,-3.6));
      g.add(box(2.8,.4,2.8,roof,5.8,8.9,-3.6));
      for(const x of[-5,-2.6,2.6,5]) g.add(cyl(.2,.25,1,5,mat(terra),x,1,6));
      for(const x of[-5,-2.6,2.6,5]) g.add(cone(.55,.8,6,mat(green),x,2,6));
      return {obj:g,radius:8,height:9.5};
    };

    const pinata=()=>{
      const g=new e.Group(),woodM=mat(0x8d5524),rope=mat(0x5d4037);
      for(const x of[-2.8,2.8]) g.add(cyl(.15,.2,8,5,woodM,x,4,0));
      g.add(box(6.4,.2,.2,woodM,0,8,0));
      g.add(cyl(.05,.05,2.4,4,rope,0,6.8,0));
      const colors=[pink,yel,turq,red,blue];
      const st=new e.Mesh(starGeo(2.4,1.1,5,.7),mat(yel));st.position.set(0,5.3,0);g.add(st);
      for(let k=0;k<5;k++){
        const an=-Math.PI/2+k*Math.PI/5;
        g.add(mesh(geo('ConeGeometry',.6,1.6,5),mat(colors[k%colors.length]),Math.cos(an)*2.6,5.3+Math.sin(an)*2.6,.2,Math.PI/2,0,an+Math.PI/2));
      }
      for(let k=0;k<10;k++){
        const an=k*Math.PI*2/10;
        g.add(mesh(geo('BoxGeometry',.12,.8,.06),mat(colors[(k+2)%colors.length]),Math.cos(an)*2.1,4.1,Math.sin(an)*.4));
      }
      g.add(box(1.3,1.2,1.3,mat(pink),0,4.6,0));
      return {obj:g,radius:5,height:9.5};
    };

    const skull=()=>{
      const g=new e.Group(),bone=mat(0xf7f2e6),dk=mat(0x4e342e),horn=mat(0xe0d6c0);
      g.add(mesh(geo('DodecahedronGeometry',2.2,0),mat(0x8d6e63),0,1,0,0,0,0));
      g.add(sph(1.8,bone,0,4,0,1.2,1,1));
      g.add(box(1.7,1.6,2,1.2,bone,0,3,1.1));
      for(const s of[-1,1]){
        g.add(sph(.45,dk,s*.75,4.1,.9));
        g.add(mesh(geo('TorusGeometry',2.6,.28,6,12,Math.PI),horn,s*2.7,4.2,0,0,0,s>0?-.3:Math.PI+.3));
      }
      g.add(box(1.4,.3,.2,bone,0,2.3,1.9));
      g.add(cyl(.35,.5,1.2,6,mat(0x8d6e63),0,6,0));
      return {obj:g,radius:5.5,height:7};
    };

    const tacoTruck=()=>{
      const g=new e.Group(),body=mat(turq),whtM=mat(wht),dk=mat(0x263238),redM=mat(red),yelM=mat(yel);
      g.add(box(10,4,4.4,body,0,2.8,0));
      g.add(box(3.6,2.7,4.2,body,-3.6,3.4,0));
      g.add(box(3.3,1.5,4.3,mat(0x90caf9,{transparent:!0,opacity:.55}),-3.6,4,0));
      g.add(box(9.6,2.2,4.6,whtM,2.6,2.3,0));
      for(const x of[-3.1,3.1])for(const z of[-1.9,1.9]){
        g.add(mesh(geo('CylinderGeometry',1,1,.55,10),dk,x,1,z,0,0,Math.PI/2));
        g.add(mesh(geo('CylinderGeometry',.42,.42,.6,8),mat(0xb0bec5),x,1,z,0,0,Math.PI/2));
      }
      g.add(box(5.6,2.3,.15,dk,1.8,3.3,2.25));
      g.add(box(5.6,.2,2.8,mat(red),1.8,5,2.9));
      for(let k=0;k<4;k++) g.add(box(1.3,.2,2.85,mat(k%2?green:red),-.2+k*1.4,5.05,2.9));
      const sm=signMesh('TACOS','#2a9d8f','#ffd54f',4.6,1.8,!0);sm.position.set(1.8,3.7,2.35);g.add(sm);
      for(let k=0;k<8;k++) g.add(sph(.14,mat(0xffd54f,{emissive:0xffb300}),-4.6+k*1.3,5.3,2.9));
      g.add(cyl(.25,.32,2,5,dk,3.6,6,0));
      g.add(sph(.35,mat(wht),3.6,7.2,0));
      return {obj:g,radius:6.5,height:7.5};
    };

    const mariachi=()=>{
      const g=new e.Group(),stage=mat(0x6d4c41),suit=mat(0x1a237e),trim=mat(0xc5cae9),skin=mat(0x8d5524),hat=mat(0x3e2723);
      g.add(box(9,1,5,stage,0,.5,0));
      const pos=[[-3,0,0],[0,0,-.3],[3,0,.2],[-1.2,0,2]];
      pos.forEach(([x,,z],k)=>{
        g.add(cyl(.35,.45,2.2,6,suit,x,2.1,z));
        g.add(sph(.48,skin,x,3.6,z));
        for(const s of[-1,1]) g.add(cyl(.15,.18,1.8,5,suit,x+s*.55,2.3,z));
        for(const s of[-1,1]) g.add(cyl(.17,.2,1.3,5,suit,x+s*.3,1.1,z));
        g.add(cyl(.85,.85,.2,10,hat,x,4.05,z));
        g.add(cyl(.4,.5,.5,8,hat,x,4.3,z));
        g.add(mesh(geo('TorusGeometry',.82,.12,4,12,Math.PI),trim,x,4.15,z,0,0,Math.PI));
        for(const s of[-1,1]) g.add(sph(.09,mat(blk),x+s*.18,3.7,z+.42));
        if(k===0){g.add(box(1.1,1.4,.3,mat(0x8d5524),x+.7,2.6,z+.4));g.add(box(.22,1.8,.22,stage,x+.7,3.7,z+.4))}
        if(k===1){g.add(cyl(.12,.3,1.3,7,mat(0xffd54f),x+.7,3,z+.5,0,0,-.4))}
        if(k===2){g.add(box(1.2,1.2,.25,mat(0x8d5524),x+.7,2.7,z+.4));g.add(box(.2,1.8,.2,stage,x+.7,3.8,z+.4))}
      });
      g.add(sph(.3,mat(0xffd54f,{emissive:0xffb300}),0,5.4,-1.5));
      for(const x of[-4,4]) g.add(cyl(.12,.15,2.4,5,stage,x,2.2,-1.7));
      return {obj:g,radius:6,height:6};
    };

    const oilPump=()=>{
      const g=new e.Group(),metal=mat(steel),rustM=mat(rust),dk=mat(0x263238);
      g.add(box(5,1,4,dk,0,.5,0));
      g.add(box(.5,8,.5,metal,-1.6,4,0));
      g.add(box(.5,8,.5,metal,1.6,4,0));
      g.add(box(9,.5,.5,metal,0,8,0,0,0,.12));
      g.add(sph(1.3,rustM,-4,8.4,0));
      g.add(box(2,1.2,1.4,metal,4,7.4,0));
      g.add(cyl(.35,.45,5,6,metal,4,4,0));
      g.add(cyl(.8,1,1.2,8,dk,4,1.2,0));
      return {obj:g,radius:5.5,height:10};
    };

    const waterTower=()=>{
      const g=new e.Group(),metal=mat(steel),tank=mat(0x8d6e63),dk=mat(0x3e2723);
      for(const[x,z]of[[-3,-3],[3,-3],[-3,3],[3,3]]) g.add(cyl(.25,.4,12,6,metal,x,6,z));
      for(const y of[4,8]) g.add(box(6.4,.2,.2,metal,0,y,-3)),g.add(box(6.4,.2,.2,metal,0,y,3)),g.add(box(.2,.2,6.4,metal,-3,y,0)),g.add(box(.2,.2,6.4,metal,3,y,0));
      g.add(cyl(4.2,4.4,4.8,14,tank,0,15,0));
      g.add(cone(4.6,2.2,14,mat(0x5d4037),0,18.5,0));
      g.add(cyl(4.5,4.5,.2,14,dk,0,19.7,0));
      for(const y of[13,15,17]) g.add(mesh(geo('TorusGeometry',4.3,.12,4,16),metal,0,y,0,Math.PI/2));
      const sm=signMesh('BORDER','#5a626d','#f5f0e0',5.8,1.8,!0);sm.position.set(0,15,4.35);g.add(sm);
      return {obj:g,radius:6,height:20};
    };

    const wallSegment=()=>{
      const g=new e.Group(),steelM=mat(0x6b7280),rustM=mat(rust),dk=mat(0x374151);
      g.add(box(48,9,.7,steelM,0,4.5,0));
      for(let k=0;k<25;k++) g.add(box(.55,9.2,.85,k%3?steelM:rustM,-23+k*1.92,4.6,.05));
      g.add(box(48,.8,1.2,dk,0,9.1,0));
      g.add(box(9,1.2,5,dk,-15,10,0));
      for(const x of[-18.5,-11.5]) g.add(box(.5,10,.5,steelM,x,5,0));
      g.add(box(1.2,1.4,.8,mat(0xffd54f,{emissive:0x8a5a00}),-15,10.9,2.4));
      g.add(cyl(.1,.12,5,4,steelM,-15,13,0));
      g.add(box(6,5,4,dk,-15,14.5,0));
      g.add(box(6.8,.5,4.6,steelM,-15,17.3,0));
      for(const x of[-17,-13]) g.add(sph(.4,mat(0xfff59d,{emissive:0xfff59d}),x,12.5,2.2));
      for(let k=0;k<5;k++) g.add(sph(.3,mat(0x6d4c41),-20+k*2.5,1.2,2.8));
      return {obj:g,radius:25,height:18};
    };

    const mission=()=>{
      const g=new e.Group(),wallM=mat(wht),trim=mat(adobeD),roof=mat(0xb35c2e),dk=mat(0x3e2723),gold=mat(0xc9a227);
      g.add(box(18,13,26,wallM,0,6.5,0));
      g.add(box(19,1,27,trim,0,13,0));
      for(let k=0;k<3;k++) g.add(box(5,1.2,26.2,roof,0,13.8+k*1.1,0));
      g.add(box(8,22,8,wallM,0,11,15));
      g.add(box(9,1,9,trim,0,22,15));
      g.add(cone(5.5,7,4,roof,0,26,15,Math.PI/4));
      g.add(box(1.2,4,1.2,wallM,0,31,15));
      g.add(box(3,.5,.5,trim,0,31.5,15));
      g.add(archGroup(4,7,1.1,dk,.5));
      g.children[g.children.length-1].position.set(0,0,13.15);
      for(const x of[-5,5]) g.add(archGroup(2.4,4.4,1,dk,.35)),g.children[g.children.length-1].position.set(x,.1,13.15);
      for(const y of[16,18.5,21]){
        g.add(cyl(.5,.55,.9,8,gold,0,y,18.8));
        g.add(cyl(.4,.4,.15,8,dk,0,y-.45,18.8));
      }
      for(const[x,z]of[[-8,10],[8,10],[-8,-10],[8,-10]]) g.add(box(1.2,1.6,.15,dk,x,4.5,z));
      g.add(box(30,.8,1.2,trim,0,.4,0));
      for(let k=0;k<8;k++) g.add(box(2.2,3,.7,wallM,-14+k*4,1.9,-15));
      return {obj:g,radius:16,height:33};
    };

    const mesa=()=>{
      const g=new e.Group();
      g.add(cyl(50,85,80,7,mat(0xa85a3a),0,40,0));
      g.add(cyl(42,52,55,7,mat(0xbf7048),0,105,0));
      g.add(cyl(38,43,18,7,mat(0xd18a5b),0,140,0));
      g.add(cyl(36,36,.5,7,mat(0xc97f50),0,149,0));
      for(let k=0;k<6;k++) g.add(mesh(geo('ConeGeometry',4+k,10+k*2,5),mat(0xa85a3a),-30+k*12,150,10));
      return {obj:g,radius:85,height:155};
    };

    const billboard=(text='BIENVENIDOS',bg='#e6d3b3',fg='#b35c2e')=>()=>{
      const g=new e.Group(),woodM=mat(0x6d4c41),frame=mat(0x5d4037);
      for(const x of[-3.6,3.6]) g.add(box(.4,8,.4,woodM,x,4,0));
      g.add(box(10.5,5,.4,frame,0,8,0));
      const sm=signMesh(text,bg,fg,9.6,4.2);sm.position.set(0,8,.25);g.add(sm);
      for(const x of[-3.2,-1.1,1.1,3.2]) g.add(sph(.2,mat(0xffd54f,{emissive:0x8a5a00}),x,10.4,.4));
      return {obj:g,radius:6,height:11};
    };

    distant(mesa,-135,700,1.1);
    distant(mesa,105,850,.8);
    landmark(mission,.17,1,1.1);
    landmark(wallSegment,.55,-1,1.1);
    landmark(skull,.78,1,1.6);
    landmark(mission,.9,1,.75,{sky:!0});

    exhibit(saguaro,8,{scaleMin:1.2,scaleMax:1.6});
    exhibit(skull,5,{scaleMin:1.2,scaleMax:1.5});
    exhibit(tacoTruck,4,{scaleMin:1.05,scaleMax:1.3});
    exhibit(pinata,5,{scaleMin:1.2,scaleMax:1.6});
    exhibit(mariachi,4,{scaleMin:1.05,scaleMax:1.3});
    exhibit(wallSegment,2,{scaleMin:.55,scaleMax:.7});

    nearby(saguaro,14,{scaleMin:1,scaleMax:1.4});
    nearby(prickly,12,{scaleMin:1.1,scaleMax:1.5});
    nearby(hacienda,8,{minGap:10});
    nearby(pinata,7);
    nearby(tacoTruck,7);
    nearby(mariachi,6);
    nearby(oilPump,6);
    nearby(waterTower,6);
    nearby(billboard('BIENVENIDOS'),5,{minGap:10});
    nearby(billboard('TACOS','#b35c2e','#ffd54f'),5,{minGap:10});
    nearby(billboard('SUNSET','#e76f51','#fff3d6'),4,{minGap:10});

    scatterParts([
      {geo:geo('DodecahedronGeometry',.7,0),mat:mat(0x8d6e63),y:.25},
      {geo:geo('ConeGeometry',.35,1.1,5),mat:mat(0x6b8e23),y:.55}
    ],350,{min:14,max:660,radius:1.3,height:1.4,smin:.6,smax:1.5});
    scatterParts([{geo:geo('DodecahedronGeometry',.55,0),mat:mat(0xa1887f),y:.2}],250,{min:12,max:640,radius:1,height:1,smin:.5,smax:1.4});
    scatterParts([{geo:geo('IcosahedronGeometry',.8,0),mat:mat(0x8d6e63,{wireframe:!0}),y:.7}],90,{min:20,max:600,radius:1.2,height:1.5,smin:.7,smax:1.3});

    roadside(['mx','usa','mx'],{pole:0x8d6e63,topper:(x,y,z)=>sph(.24,mat(turq,{emissive:0x004d40}),x,y,z)});
    bunting([0x006847,0xffffff,0xce1126,0x2a9d8f,0xf4a261],44);
  }

  // ===== FINAL МАТУШКА =====
  if(key==='finalmatushka'){
    const snow=0xf5fbff,ice=0xa8d8ea,iceD=0x5fb6d9,brick=0x8e2f2f,brickD=0x5e1f1f,krem=0x2f6b4f,gold=0xe0b040,goldB=0xffd54f,oniG=0xd4a017,oniGreen=0x2e7d32,oniRed=0xc62828,oniBlue=0x1565c0,birchC=0xf1f0e8,blk=0x222222,steel=0x4a4f57,red=0xc62828,brown=0x6b4f39,bearC=0x5d4037;

    const church=()=>{
      const g=new e.Group(),wallM=mat(snow),trim=mat(oniRed),goldM=mat(gold),dk=mat(0x37474f);
      g.add(box(8,8,8,wallM,0,4,0));
      g.add(box(8.8,.8,8.8,trim,0,8.2,0));
      g.add(cyl(2.8,3.2,3,8,wallM,0,10,0));
      g.add(box(1.6,2.6,.2,dk,0,3,4.05));
      for(const x of[-2.4,2.4]) g.add(box(1.3,2,.2,mat(0x90caf9,{emissive:0x0d47a1}),x,4,4.05));
      g.add(onion(2.9,5.4,goldM));
      g.children[g.children.length-1].position.y=11.5;
      g.add(cyl(.12,.18,2,5,goldM,0,17,0));
      g.add(box(1.6,.12,.12,goldM,0,17.8,0));
      g.add(box(.12,1.4,.12,goldM,0,18.1,0));
      for(const[x,z]of[[-4,-4],[4,-4],[-4,4],[4,4]]) g.add(box(1.2,1.2,1.2,trim,x,8.8,z));
      return {obj:g,radius:5,height:18.5};
    };

    const birch=()=>{
      const g=new e.Group(),trunk=mat(birchC),band=mat(blk),fol=mat(0xf2b705),fol2=mat(0x9ccc65);
      g.add(cyl(.5,.85,17,7,trunk,0,8.5,0));
      for(let k=0;k<6;k++) g.add(box(1.15,.22,.22,band,0,2.8+k*2.4,0));
      for(const[x,z,rx,rz]of[[-1,0,-.5,0],[1,0,.5,0],[0,-1,.4,-.4],[-.5,.7,.35,.5]]){
        g.add(mesh(geo('CylinderGeometry',.2,.35,5,5),trunk,x,15,z,rx,0,rz));
      }
      for(const[x,y,z,r]of[[0,17,0,4.8],[-1.5,19,.8,3.4],[1.8,19.4,-.6,3.2],[0,21.4,1,2.2]]){
        g.add(sph(r,fol,x,y,z,1.12,.92,1.12));
      }
      for(const[x,y,z,r]of[[2.3,15.5,1.8,2.1],[-2,16,-1.6,1.9]]){
        g.add(sph(r,fol2,x,y,z,1.1,.85,1.1));
      }
      return {obj:g,radius:7,height:23};
    };

    const pine=()=>{
      const g=new e.Group(),leaf=mat(0x1b5e20),leaf2=mat(0x2e7d32),snowM=mat(snow);
      for(let k=0;k<3;k++){
        const y=4+k*4,rr=5.2-k*1.25;
        g.add(cone(rr,5.5,8,leaf,0,y,0));
        g.add(cone(rr*.82,2.1,8,snowM,0,y+2.2,0));
      }
      g.add(cyl(.45,.6,4,6,mat(brown),0,2,0));
      g.add(cone(1.4,2.6,7,snowM,0,15.5,0));
      return {obj:g,radius:5.5,height:17};
    };

    const matryoshka=(bodyCol=0xd81b60,scarfCol=0xe0b040)=>{
      const g=new e.Group(),body=mat(bodyCol),scarf=mat(scarfCol),face=mat(0xfff3e0),dk=mat(0x3e2723),pink=mat(0xf48fb1);
      const pts=[[0,0],[2.4,0],[2.9,1],[3,2.4],[2.7,3.8],[2.2,5],[1.9,5.8],[2,6.5],[1.8,7.2],[1.3,7.8],[.7,8.2],[0,8.4]];
      g.add(mesh(new e.LatheGeometry(pts.map(([x,y])=>new e.Vector2(x,y)),14),body));
      g.add(sph(2.2,scarf,0,7.1,-.2,1,.7,1));
      g.add(cyl(.2,.3,.8,5,scarf,0,8.5,0));
      g.add(sph(.5,scarf,0,8.9,0));
      g.add(sph(1.35,face,0,5.9,2.05,1,1.15,.25));
      for(const s of[-1,1]){
        g.add(sph(.19,dk,s*.5,6.1,2.42));
        g.add(sph(.12,mat(0xffffff),s*.5+.05,6.16,2.56));
        g.add(sph(.28,pink,s*.85,5.6,2.35,1,.55,.25));
      }
      g.add(sph(.18,mat(0xc62828),0,5.45,2.44,1.4,.6,.25));
      g.add(cyl(1.2,1.5,2.4,12,mat(0xffd54f),0,2.6,0));
      g.add(sph(.35,mat(0xe91e63),0,3.3,2.6));
      for(let k=0;k<5;k++){const an=k*Math.PI*2/5;g.add(sph(.28,mat(0xffffff),Math.cos(an)*.8,3.3+Math.sin(an)*.8,2.55))}
      g.add(sph(.4,mat(0xffffff),0,2,2.75));
      return {obj:g,radius:3.3,height:9};
    };

    const samovar=()=>{
      const g=new e.Group(),goldM=mat(gold,{emissive:0x3e2a00}),chrome=mat(0xcfd8dc);
      g.add(cyl(1.8,2.4,.5,12,chrome,0,.25,0));
      g.add(mesh(new e.LatheGeometry([[0,0],[1.7,0],[2.1,.7],[2.4,1.8],[2.2,3.4],[1.8,4.5],[1.2,5],[.7,5.2],[0,5.3]].map(([x,y])=>new e.Vector2(x*1.2,y*1.1)),14),goldM));
      g.add(cyl(.8,.8,.5,10,chrome,0,5.8,0));
      g.add(cyl(.55,.65,2,8,goldM,0,7,0));
      g.add(mesh(geo('CylinderGeometry',.15,.3,1.6,6),goldM,1.9,3.6,0,0,0,-.5));
      g.add(mesh(geo('TorusGeometry',1.3,.16,5,14,Math.PI),chrome,-1.7,3.2,0,0,0,Math.PI/2));
      g.add(mesh(geo('TorusGeometry',1.3,.16,5,14,Math.PI),chrome,1.7,3.2,0,0,0,-Math.PI/2));
      g.add(sph(1,chrome,0,8.7,0));
      g.add(cyl(.3,.4,.6,8,chrome,0,9.6,0));
      for(let k=0;k<4;k++) g.add(sph(.3+k*.07,mat(0xffffff,{transparent:!0,opacity:.35}),-.2+k*.15,6.8+k*.6,1.8));
      return {obj:g,radius:3.5,height:10.5};
    };

    const tank=()=>{
      const g=new e.Group(),green=mat(0x4e5d3a),dark=mat(0x2f3a24),steelM=mat(steel),redM=mat(red);
      g.add(box(10,2.6,5,green,0,2.2,0));
      for(const z of[-2.7,2.7]){
        g.add(box(10.4,2.2,1.1,dark,0,1.5,z));
        for(let k=0;k<5;k++) g.add(cyl(.7,.7,.25,10,mat(0x212121),-4+k*2,1.2,z));
      }
      g.add(cyl(2.3,2.7,1.8,10,green,0,4.5,0));
      g.add(mesh(geo('CylinderGeometry',.32,.42,7,6),green,0,4.9,3.2,Math.PI/2,0,0));
      g.add(mesh(geo('CylinderGeometry',.55,.55,.5,8),steelM,0,4.9,6.9,Math.PI/2,0,0));
      g.add(mesh(starGeo(.55,.25,5,.12),redM,0,5.7,0));
      g.add(cyl(.06,.08,2.6,4,steelM,-1.3,6.2,-1));
      return {obj:g,radius:6,height:6.5};
    };

    const truck=()=>{
      const g=new e.Group(),green=mat(0x4e5d3a),canvas=mat(0x6e7d51),dk=mat(0x2f3a24),glass=mat(0x90caf9,{transparent:!0,opacity:.55});
      g.add(box(3.4,3.2,3.4,green,-3.2,2.2,0));
      g.add(box(3.1,1.4,3.5,glass,-3.2,3.2,0));
      g.add(box(7,3,4,canvas,.8,2.6,0));
      for(const x of[-4.3,-1.4,2.6])for(const z of[-1.8,1.8]){
        g.add(mesh(geo('CylinderGeometry',1,1,.55,10),dk,x,1,z,0,0,Math.PI/2));
        g.add(mesh(geo('CylinderGeometry',.42,.42,.6,8),mat(0xb0bec5),x,1,z,0,0,Math.PI/2));
      }
      for(const z of[-1.2,1.2]) g.add(sph(.3,mat(0xfff59d,{emissive:0xfff59d}),-4.95,2.4,z));
      g.add(box(7.2,.3,4.2,dk,0,1,0));
      return {obj:g,radius:6,height:6.5};
    };

    const crystal=()=>{
      const g=new e.Group(),m=mat(ice,{transparent:!0,opacity:.78,emissive:0x0a4b5e});
      for(const[x,z,h,s]of[[0,0,7,1],[-1.4,1,4,.7],[1.5,.6,5,.8],[-.5,-1.4,3.5,.6],[1,-1.8,2.8,.5]]){
        const c=mesh(geo('OctahedronGeometry',1,0),m,x,h/2,z);
        c.scale.set(s,h/2,s);g.add(c);
      }
      g.add(cyl(2.2,2.6,.35,9,mat(0xdff6ff),0,.15,0));
      return {obj:g,radius:3,height:8};
    };

    const snowman=()=>{
      const g=new e.Group(),snowM=mat(snow),coal=mat(blk),carrot=mat(0xff6f00),hat=mat(0x5d4037),scarf=mat(red);
      g.add(sph(1.8,snowM,0,1.8,0));
      g.add(sph(1.35,snowM,0,4.2,0));
      g.add(sph(1.05,snowM,0,6.2,0));
      for(const s of[-1,1]) g.add(sph(.16,coal,s*.38,6.5,.9));
      g.add(mesh(geo('ConeGeometry',.25,1.2,6),carrot,0,6.2,1.35,Math.PI/2,0,0));
      for(let k=0;k<3;k++) g.add(sph(.12,coal,0,3.5+k*.45,.92));
      g.add(mesh(geo('TorusGeometry',1.1,.22,5,12),scarf,0,5.3,0,Math.PI/2));
      g.add(cyl(1.05,1.15,.6,10,hat,0,7.15,0));
      g.add(box(1.8,.16,1.2,hat,0,6.9,0));
      for(const s of[-1,1]) g.add(mesh(geo('CylinderGeometry',.1,.14,2.8,5),mat(0x5d4037),s*1.6,4.2,0,0,0,s*.8));
      return {obj:g,radius:2.5,height:8};
    };

    const bear=()=>{
      const g=new e.Group(),fur=mat(bearC),dk=mat(0x3e2723),tan=mat(0x8d6e63);
      g.add(sph(2,3.2,0,3.2,0,1.1,1.4,.9));
      g.add(sph(1.4,fur,0,6.4,0));
      g.add(sph(.5,tan,0,6.2,.9,.9,.7,.7));
      g.add(sph(.18,dk,0,6.4,1.45));
      for(const s of[-1,1]){
        g.add(sph(.5,fur,s*.9,7,0));
        g.add(sph(.24,tan,s*.9,7,.2));
        g.add(sph(.2,dk,s*.4,6.7,.8));
        g.add(mesh(geo('CylinderGeometry',.5,.65,3,7),fur,s*1.3,3.8,0,0,0,s*.3));
        g.add(sph(.55,fur,s*1.9,3.2,.4));
        g.add(mesh(geo('CylinderGeometry',.55,.65,2.2,7),fur,s*.8,1.1,0,0,0,s*.08));
      }
      g.add(sph(.7,fur,0,2.8,-1.6));
      return {obj:g,radius:3.5,height:8};
    };

    const balalaika=()=>{
      const g=new e.Group(),woodM=mat(0xc98a3a),dk=mat(0x5d4037),str=mat(0xf5f5f5);
      const shape=new e.Shape();shape.moveTo(-2.2,0);shape.lineTo(2.2,0);shape.lineTo(0,5);shape.closePath();
      const body=new e.Mesh(new e.ExtrudeGeometry(shape,{depth:.5,bevelEnabled:!1}),woodM);body.position.y=1.2;g.add(body);
      g.add(box(.55,4.2,.25,dk,0,8,0));
      g.add(box(.8,1.2,.3,dk,0,10.1,0));
      for(const x of[-.18,0,.18]) g.add(box(.04,6,.04,str,x,6.8,.3));
      for(let k=0;k<3;k++) g.add(sph(.12,mat(0xffd54f),-1+k*1,2,0));
      g.add(mesh(geo('CylinderGeometry',.15,.2,2.2,5),dk,-2.4,2,0,0,0,.4));
      return {obj:g,radius:3.5,height:11};
    };

    const banner=()=>{
      const g=new e.Group(),pole=mat(steel),redM=mat(red),goldM=mat(gold);
      for(const x of[-4,4]) g.add(cyl(.18,.24,9,6,pole,x,4.5,0));
      g.add(box(8.6,.2,.2,pole,0,8.8,0));
      g.add(box(7.6,3.4,.15,redM,0,6.9,0));
      const sm=signMesh('Матушка','#c62828','#ffd54f',7,2.8,!0);sm.position.set(0,6.9,.12);g.add(sm);
      const st=new e.Mesh(starGeo(.65,.3,5,.14),goldM);st.position.set(0,9.2,.1);g.add(st);
      return {obj:g,radius:5,height:10};
    };

    const stBasil=()=>{
      const g=new e.Group(),white=mat(0xf5f0e0),brickM=mat(brick),goldM=mat(gold),greenM=mat(oniGreen),redM=mat(oniRed),blueM=mat(oniBlue);
      g.add(box(16,10,16,white,0,5,0));
      g.add(box(16.8,1.2,16.8,brickM,0,10.6,0));
      g.add(cyl(5.4,6,8,8,brickM,0,12,0));
      g.add(cyl(5.8,6.2,.8,8,white,0,16.4,0));
      g.add(cone(6.4,10,8,greenM,0,21.8,0));
      g.add(cyl(3.2,3.6,3,8,white,0,27.5,0));
      g.add(onion(3.6,7,goldM,12));
      g.children[g.children.length-1].position.y=29;
      g.add(cyl(.16,.22,2,5,goldM,0,37,0));
      g.add(box(1.5,.14,.14,goldM,0,37.9,0));
      g.add(box(.14,1.3,.14,goldM,0,38.1,0));
      const cols=[goldM,greenM,redM,blueM,goldM,greenM,redM,blueM];
      for(let k=0;k<8;k++){
        const an=k*Math.PI/4,rr=k%2?5.6:8.2;
        const x=Math.cos(an)*rr,z=Math.sin(an)*rr;
        const h=15+((k*3)%7);
        g.add(cyl(1.4,1.7,h,8,white,x,h/2,z));
        g.add(cyl(1.8,2,.5,8,brickM,x,h+.2,z));
        g.add(onion(1.7,3.6,cols[k],10));
        g.children[g.children.length-1].position.set(x,h+2.1,z);
        g.add(cyl(.08,.12,1.2,4,goldM,x,h+5.5,z));
      }
      for(let k=0;k<4;k++) g.add(archGroup(2.8,4.4,1,mat(0x37474f),.35)),g.children[g.children.length-1].position.set(-5+k*3.3,.2,8.05);
      for(let k=0;k<8;k++) g.add(box(.7,.7,.7,cols[k],-6+k*1.7,10.7,8.1));
      return {obj:g,radius:19,height:38};
    };

    const kremlin=()=>{
      const g=new e.Group(),brickM=mat(brick),dk=mat(brickD),greenM=mat(krem),goldM=mat(gold),white=mat(0xf5f0e0);
      g.add(box(12,28,12,brickM,0,14,0));
      for(const y of[6,14,22]) g.add(box(12.8,.7,12.8,white,0,y,0));
      g.add(archGroup(5,7,13,mat(0x2b1a1a),.6));
      g.children[g.children.length-1].position.set(0,0,0);
      g.add(box(14,2,14,dk,0,29,0));
      g.add(cone(10,12,4,greenM,0,36,0,Math.PI/4));
      g.add(cyl(.3,.4,3,6,goldM,0,43,0));
      const st=new e.Mesh(starGeo(1.2,.55,5,.25),mat(goldB,{emissive:0x6b4a00}));st.position.set(0,45.5,0);g.add(st);
      g.add(mesh(geo('CylinderGeometry',2.4,2.4,.3,14),white,0,26,6.1,Math.PI/2,0,0));
      g.add(mesh(geo('CylinderGeometry',2.3,2.3,.32,14),mat(0x263238),0,26,6.25,Math.PI/2,0,0));
      g.add(box(.12,1.6,.12,blk,0,26,6.4));
      g.add(box(1,.12,.1,blk,0,26,6.4));
      for(const[x,z]of[[-6.5,-6.5],[6.5,-6.5],[-6.5,6.5],[6.5,6.5]]) g.add(box(1.5,3,1.5,brickM,x,31,z));
      return {obj:g,radius:10,height:47};
    };

    const matushkaColossus=()=>{
      const g=new e.Group(),stone=mat(0xb0bec5),goldM=mat(gold,{emissive:0x3e2a00}),redM=mat(0xc62828),white=mat(0xf5f0e0),dk=mat(0x3e2723);
      g.add(box(16,2,16,mat(0x455a64),0,1,0));
      g.add(box(12,4,12,stone,0,4,0));
      g.add(box(10,1,10,mat(0x78909c),0,6.5,0));
      const doll=matryoshka(0xc62828,0xffd54f);
      doll.obj.scale.setScalar(3.6);doll.obj.position.y=7;g.add(doll.obj);
      g.add(sph(.7,mat(0xff3d81,{emissive:0xff3d81}),0,7+3.6*5.6,3.6*2.5));
      for(const x of[-6,6]){
        g.add(cyl(.25,.35,10,5,mat(steel),x,10,-5));
        g.add(sph(.6,mat(0xfff59d,{emissive:0xfff59d}),x,15.2,-5));
        g.add(mesh(geo('ConeGeometry',1.8,5,7),mat(0x80deea,{transparent:!0,opacity:.35}),x,18,-5,Math.PI,0,0));
      }
      return {obj:g,radius:13,height:42};
    };

    const icePalace=()=>{
      const g=new e.Group(),m=mat(ice,{transparent:!0,opacity:.8,emissive:0x0a4b5e}),m2=mat(0xdff6ff,{transparent:!0,opacity:.9});
      g.add(box(18,2,14,m,0,1,0));
      g.add(box(14,10,10,m,0,7,-1));
      g.add(box(10,8,8,m2,0,16,0));
      g.add(cone(7,12,8,m,0,26,0));
      for(const[x,z,h]of[[-7,4,14],[7,4,16],[-7,-5,12],[7,-5,13]]){
        g.add(cyl(1.2,1.6,h,6,m,x,h/2,z));
        g.add(cone(2.4,5,6,m2,x,h+2.5,z));
      }
      g.add(archGroup(4,6,1.2,m2,.5));g.children[g.children.length-1].position.set(0,.2,6.05);
      g.add(cyl(2,2.4,.3,8,m2,0,1.2,10));
      return {obj:g,radius:14,height:32};
    };

    const kremlinWall=()=>{
      const g=new e.Group(),brickM=mat(brick),dk=mat(brickD),greenM=mat(krem);
      g.add(box(80,12,3,brickM,0,6,0));
      for(let k=0;k<20;k++) g.add(box(3.6,2.6,3.6,dk,-38+k*4,13.2,0));
      for(const x of[-30,0,30]){
        g.add(box(9,24,9,brickM,x,12,0));
        g.add(cone(7,8,4,greenM,x,28,0,Math.PI/4));
        g.add(cyl(.25,.35,2.4,5,mat(gold),x,33,0));
      }
      return {obj:g,radius:45,height:36};
    };

    const frozenLake=()=>{
      const g=new e.Group(),m=mat(0xbfe9f5,{transparent:!0,opacity:.82,emissive:0x0a4b5e});
      const lake=new e.Mesh(geo('CircleGeometry',18,22),m);lake.rotation.x=-Math.PI/2;lake.position.y=.14;g.add(lake);
      for(let k=0;k<7;k++){
        const an=k*Math.PI*2/7,rr=4+rng()*9;
        g.add(box(4+rng()*7,.05,.16,mat(0xdff6ff),Math.cos(an)*rr,.2,Math.sin(an)*rr,0,rng()*3,0));
      }
      for(let k=0;k<10;k++){
        const an=k*Math.PI*2/10,rr=18.5+rng()*2;
        g.add(mesh(geo('OctahedronGeometry',.8+rng()*1,0),m,Math.cos(an)*rr,.6,Math.sin(an)*rr,0,rng()*3,0));
      }
      return {obj:g,radius:20,height:3};
    };

    const stacks=()=>{
      const g=new e.Group(),brickM=mat(0x6d4c41),smoke=mat(0xb0bec5,{transparent:!0,opacity:.35});
      for(const[x,h]of[[-6,26],[0,34],[6,22]]){
        g.add(cyl(1.4,2.4,h,8,brickM,x,h/2,0));
        g.add(mesh(geo('TorusGeometry',1.5,.18,4,12),mat(0x3e2723),x,h-1,0,Math.PI/2));
        for(let k=0;k<4;k++) g.add(sph(2.2+k*.6,smoke,x+.6+k*.4,h+2+k*2.2,0));
      }
      g.add(box(22,4,10,mat(0x455a64),0,2,0));
      return {obj:g,radius:14,height:40};
    };

    distant(kremlinWall,-125,640,1.2);
    distant(stacks,110,780,1.1);
    landmark(stBasil,.16,1,1.1);
    landmark(kremlin,.5,-1,1.1);
    landmark(matushkaColossus,.7,1,1.15,{sky:!0});
    landmark(icePalace,.88,-1,.95,{sky:!0});
    landmark(frozenLake,.4,1,.9);

    const doll=(bodyCol,scarfCol)=>()=>matryoshka(bodyCol,scarfCol);
    exhibit(doll(0xc62828,0xffd54f),5,{scaleMin:1.8,scaleMax:2.4});
    exhibit(doll(0x1565c0,0xffffff),3,{scaleMin:1.8,scaleMax:2.2});
    exhibit(doll(0x2e7d32,0xffd54f),3,{scaleMin:1.8,scaleMax:2.2});
    exhibit(samovar,5,{scaleMin:1.3,scaleMax:1.7});
    exhibit(crystal,6,{scaleMin:1.2,scaleMax:1.8});
    exhibit(pine,6,{scaleMin:1,scaleMax:1.3});
    exhibit(bear,5,{scaleMin:1.2,scaleMax:1.6});
    exhibit(balalaika,3,{scaleMin:1.1,scaleMax:1.4});

    nearby(birch,14);
    nearby(pine,14);
    nearby(church,7);
    nearby(doll(0xd81b60,0xffd54f),8,{scaleMin:1.4,scaleMax:2});
    nearby(doll(0x6a1b9a,0xffd54f),6,{scaleMin:1.4,scaleMax:1.9});
    nearby(samovar,8);
    nearby(tank,7,{scaleMin:1,scaleMax:1.25});
    nearby(truck,8,{scaleMin:1,scaleMax:1.25});
    nearby(crystal,9);
    nearby(snowman,7);
    nearby(bear,7);
    nearby(balalaika,6);
    nearby(banner,7,{minGap:10});

    scatterParts([
      {geo:geo('CylinderGeometry',.45,.65,10,7),mat:mat(birchC),y:5},
      {geo:geo('BoxGeometry',.95,.22,.95),mat:mat(blk),y:2.4},
      {geo:geo('BoxGeometry',.95,.22,.95),mat:mat(blk),y:5.4},
      {geo:geo('BoxGeometry',.95,.22,.95),mat:mat(blk),y:8.1},
      {geo:geo('SphereGeometry',3.6,9,7),mat:mat(0xf2b705),y:11,sy:1.15},
      {geo:geo('SphereGeometry',2.5,8,6),mat:mat(0xd99a06),y:14.2,sy:1.1},
      {geo:geo('SphereGeometry',1.8,7,5),mat:mat(0x9ccc65),y:8.6,x:2.1,z:1.4}
    ],420,{min:18,max:660,radius:2,height:16,smin:.7,smax:1.4});
    scatterParts([
      {geo:geo('SphereGeometry',1.6,8,6),mat:mat(snow),y:.2,sy:.35},
      {geo:geo('SphereGeometry',1.1,7,5),mat:mat(snow),y:.1,x:1.4,sy:.4}
    ],460,{min:14,max:640,radius:1.8,height:1,smin:.6,smax:1.5});
    scatterParts([{geo:geo('OctahedronGeometry',.9,0),mat:mat(ice,{transparent:!0,opacity:.8,emissive:0x0a4b5e}),y:.5}],220,{min:14,max:600,radius:1.2,height:1.6,smin:.5,smax:1.2});

    roadside(['ru','ru','ru'],{pole:0x8d6e63,topper:(x,y,z)=>{
      const st=new e.Mesh(starGeo(.32,.14,5,.12),mat(goldB,{emissive:0x6b4a00}));st.position.set(x,y,z);return st;
    }});
    bunting([0xffffff,0x0039a6,0xd52b1e,0xffd54f,0xffffff],42);
  }

  return root;
}
