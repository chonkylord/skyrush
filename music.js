const t=t=>440*Math.pow(2,(t-69)/12);

export class Music{
  constructor(t,e){
    this.ctx=t;
    this.out=t.createGain();
    this.out.gain.value=0;
    const n=t.createDynamicsCompressor();
    n.threshold.value=-18;
    n.ratio.value=4;
    this.out.connect(n);
    n.connect(e);
    const s=t.sampleRate;
    this.noise=t.createBuffer(1,s,t.sampleRate);
    const i=this.noise.getChannelData(0);
    for(let t=0;t<s;t++)i[t]=2*Math.random()-1;
    this.timer=null;
    this.style=null;
    this.level=.5;
    this.drones=[];
  }

  play(t){
    if(this.name===t&&this.timer)return;
    this.stop(!0);
    this.name=t;
    this.style=STYLES[t];
    if(this.style){
      this.step=0;
      this.bar=0;
      this.loop=0;
      this.next=this.ctx.currentTime+.12;
      this.out.gain.cancelScheduledValues(this.ctx.currentTime);
      this.out.gain.setTargetAtTime(this.level*(this.style.gain||1),this.ctx.currentTime,.3);
      this.style.start&&this.style.start(this);
      this.timer=setInterval(()=>this._tick(),25);
    }
  }

  stop(t=!1){
    if(this.timer)clearInterval(this.timer);
    this.timer=null;
    const e=this.ctx.currentTime;
    for(const t of this.drones){
      try{
        t.g.gain.setTargetAtTime(0,e,.1);
        t.o.stop(e+.6);
      }catch{}
    }
    this.drones=[];
    t||this.out.gain.setTargetAtTime(0,e,.2);
    this.name=null;
  }

  setLevel(t){
    this.level=t;
    this.timer&&this.out.gain.setTargetAtTime(t*(this.style&&this.style.gain||1),this.ctx.currentTime,.15);
  }

  _tick(){
    const t=this.style,e=60/t.bpm/4;
    for(;this.next<this.ctx.currentTime+.15;){
      const n=this.step%2?e*(t.swing||0):0;
      t.step(this,this.bar,this.step,this.next+n,e);
      this.step++;
      if(this.step>=16){
        this.step=0;
        this.bar++;
        if(this.bar>=t.bars){
          this.bar=0;
          this.loop++;
        }
      }
      this.next+=e;
    }
  }

  _env(t,e,n,s,i,c=1e-4){
    t.gain.setValueAtTime(1e-4,e);
    t.gain.exponentialRampToValueAtTime(s,e+n);
    t.gain.exponentialRampToValueAtTime(Math.max(c,1e-4),e+n+i);
  }

  _osc(t,e,n,s){
    const i=this.ctx.createOscillator();
    i.type=t;
    i.frequency.setValueAtTime(e,n);
    i.start(n);
    i.stop(s);
    return i;
  }

  _noiseSrc(t,e){
    const n=this.ctx.createBufferSource();
    n.buffer=this.noise;
    n.loop=!0;
    n.start(t,.5*Math.random());
    n.stop(e);
    return n;
  }

  _sat(amount=2.4){
    const w=this.ctx.createWaveShaper();
    const curve=new Float32Array(256);
    for(let i=0;i<256;i++){
      const x=i/128-1;
      curve[i]=Math.tanh(amount*x);
    }
    w.curve=curve;
    return w;
  }

  kick(t,e=1,n=150,s=45){
    const i=this._osc('sine',n,t,t+.4);
    i.frequency.exponentialRampToValueAtTime(s,t+.12);
    const c=this.ctx.createGain();
    this._env(c,t,.003,.9*e,.3);
    i.connect(c);
    c.connect(this.out);
  }

  snare(t,e=1){
    const n=this._noiseSrc(t,t+.25),s=this.ctx.createBiquadFilter();
    s.type='bandpass';s.frequency.value=1800;s.Q.value=.8;
    const i=this.ctx.createGain();
    this._env(i,t,.002,.45*e,.16);
    n.connect(s);s.connect(i);i.connect(this.out);
    const c=this._osc('triangle',210,t,t+.15),o=this.ctx.createGain();
    this._env(o,t,.002,.25*e,.08);
    c.connect(o);o.connect(this.out);
  }

  clap(t,e=1){
    for(let n=0;n<3;n++){
      const s=t+.011*n,i=this._noiseSrc(s,s+.2),c=this.ctx.createBiquadFilter();
      c.type='bandpass';c.frequency.value=1200;c.Q.value=1.4;
      const o=this.ctx.createGain();
      this._env(o,s,.002,.3*e,2===n?.14:.02);
      i.connect(c);c.connect(o);o.connect(this.out);
    }
  }

  hat(t,e=1,n=!1){
    const s=this._noiseSrc(t,t+(n?.3:.08)),i=this.ctx.createBiquadFilter();
    i.type='highpass';i.frequency.value=7e3;
    const c=this.ctx.createGain();
    this._env(c,t,.001,.16*e,n?.25:.045);
    s.connect(i);i.connect(c);c.connect(this.out);
  }

  shaker(t,e=1){
    const n=this._noiseSrc(t,t+.12),s=this.ctx.createBiquadFilter();
    s.type='bandpass';s.frequency.value=6e3;s.Q.value=1.2;
    const i=this.ctx.createGain();
    this._env(i,t,.012,.11*e,.07);
    n.connect(s);s.connect(i);i.connect(this.out);
  }

  wood(t,e=1,n=900){
    const s=this._osc('sine',n,t,t+.12),i=this.ctx.createGain();
    this._env(i,t,.001,.25*e,.07);
    s.connect(i);i.connect(this.out);
  }

  bass(e,n,s,i=1){
    const c=this._osc('sawtooth',t(n),e,e+s+.1),o=this._osc('square',t(n-12),e,e+s+.1),a=this.ctx.createBiquadFilter();
    a.type='lowpass';a.Q.value=6;a.frequency.setValueAtTime(1400,e);
    a.frequency.exponentialRampToValueAtTime(260,e+.15);
    const h=this.ctx.createGain();
    this._env(h,e,.005,.32*i,s,.02);
    const r=this.ctx.createGain();r.gain.value=.35;
    c.connect(a);o.connect(r);r.connect(a);a.connect(h);h.connect(this.out);
  }

  pluck(e,n,s=.18,i=1,c='triangle',o=3e3){
    const a=this._osc(c,t(n),e,e+s+.1),h=this.ctx.createBiquadFilter();
    h.type='lowpass';h.frequency.setValueAtTime(o,e);
    h.frequency.exponentialRampToValueAtTime(600,e+s);
    const r=this.ctx.createGain();
    this._env(r,e,.002,.2*i,s);
    a.connect(h);h.connect(r);r.connect(this.out);
  }

  accordion(e,n,s,i=1){
    const c=this.ctx.createBiquadFilter();
    c.type='lowpass';c.frequency.value=2200;
    const o=this.ctx.createGain();
    o.gain.setValueAtTime(1e-4,e);
    o.gain.linearRampToValueAtTime(.06*i,e+.06);
    o.gain.setValueAtTime(.06*i,e+s-.05);
    o.gain.linearRampToValueAtTime(1e-4,e+s);
    const a=this._osc('sine',5.5,e,e+s),h=this.ctx.createGain();
    h.gain.value=.012*i;
    a.connect(h);h.connect(o.gain);
    for(const i of n)for(const n of[-6,6]){
      const o=this._osc('square',t(i),e,e+s);
      o.detune.value=n;o.connect(c);
    }
    c.connect(o);o.connect(this.out);
  }

  pad(e,n,s,i=1){
    const c=this.ctx.createBiquadFilter();
    c.type='lowpass';c.frequency.value=1100;
    const o=this.ctx.createGain();
    o.gain.setValueAtTime(1e-4,e);
    o.gain.linearRampToValueAtTime(.035*i,e+.25);
    o.gain.setValueAtTime(.035*i,e+s-.2);
    o.gain.linearRampToValueAtTime(1e-4,e+s);
    for(const i of n)for(const n of[-8,8]){
      const o=this._osc('sawtooth',t(i),e,e+s);
      o.detune.value=n;o.connect(c);
    }
    c.connect(o);o.connect(this.out);
  }

  piano(e,n,s=1,i=.45){
    for(const c of n){
      const n=this._osc('triangle',t(c),e,e+i+.1),o=this._osc('sine',2*t(c),e,e+i+.1),a=this.ctx.createGain();
      this._env(a,e,.003,.07*s,i);
      const h=this.ctx.createGain();h.gain.value=.3;
      n.connect(a);o.connect(h);h.connect(a);a.connect(this.out);
    }
  }

  logdrum(e,n,s,i=1,c=null){
    const o=t(n),a=this._osc('sine',c?t(c):1.35*o,e,e+s+.2);
    a.frequency.exponentialRampToValueAtTime(o,e+(c?.12:.05));
    const h=this._sat(2.2);
    const l=this.ctx.createGain();
    this._env(l,e,.004,.55*i,s+.1);
    a.connect(h);h.connect(l);l.connect(this.out);
  }

  whistle(e,n,s,i=1){
    const c=this._osc('sine',.985*t(n),e,e+s+.05);
    c.frequency.exponentialRampToValueAtTime(t(n),e+.04);
    const o=this._osc('sine',6,e,e+s+.05),a=this.ctx.createGain();
    a.gain.value=.012*t(n);
    o.connect(a);a.connect(c.frequency);
    const h=this.ctx.createGain();
    h.gain.setValueAtTime(1e-4,e);
    h.gain.linearRampToValueAtTime(.09*i,e+.02);
    h.gain.setValueAtTime(.09*i,e+.8*s);
    h.gain.linearRampToValueAtTime(1e-4,e+s);
    c.connect(h);h.connect(this.out);
  }

  tabla(t,e,n=1){
    if('ge'===e||'dha'===e||'dhin'===e){
      const e=this._osc('sine',95,t,t+.45);
      e.frequency.exponentialRampToValueAtTime(70,t+.08);
      e.frequency.exponentialRampToValueAtTime(88,t+.35);
      const s=this.ctx.createGain();
      this._env(s,t,.003,.55*n,.38);
      e.connect(s);s.connect(this.out);
    }
    if('ge'!==e){
      const s='ti'===e?760:'dhin'===e?600:520;
      for(const[i,c]of[[1,.22],[2.02,.1],[3.01,.05]]){
        const o=this._osc('sine',s*i,t,t+.3),a=this.ctx.createGain();
        this._env(a,t,.002,c*n,'ti'===e?.07:.22);
        o.connect(a);a.connect(this.out);
      }
      const i=this._noiseSrc(t,t+.03),c=this.ctx.createBiquadFilter();
      c.type='highpass';c.frequency.value=3e3;
      const o=this.ctx.createGain();
      this._env(o,t,.001,.08*n,.02);
      i.connect(c);c.connect(o);o.connect(this.out);
    }
  }

  sitar(e,n,s,i=null,c=1){
    const o=t(n),a=this._osc('sawtooth',i?t(i):o,e,e+s+.6);
    i&&a.frequency.setTargetAtTime(o,e+.05,.07);
    const h=this.ctx.createBiquadFilter();
    h.type='peaking';h.frequency.value=2400;h.Q.value=6;h.gain.value=10;
    const r=this.ctx.createBiquadFilter();
    r.type='lowpass';r.frequency.setValueAtTime(5e3,e);
    r.frequency.exponentialRampToValueAtTime(900,e+s+.4);
    const l=this.ctx.createGain();
    this._env(l,e,.003,.11*c,s+.5);
    a.connect(h);h.connect(r);r.connect(l);l.connect(this.out);
  }

  drone(e,n=1){
    const s=this.ctx.currentTime;
    for(const i of e){
      const e=this.ctx.createOscillator();
      e.type='sawtooth';e.frequency.value=t(i);
      const c=this.ctx.createBiquadFilter();
      c.type='lowpass';c.frequency.value=700;
      const o=this.ctx.createGain();
      o.gain.setValueAtTime(1e-4,s);
      o.gain.linearRampToValueAtTime(.025*n,s+1.5);
      e.connect(c);c.connect(o);o.connect(this.out);
      e.start(s);
      this.drones.push({o:e,g:o});
    }
  }

  cowbell(e,n,s=.22,i=1){
    const f=t(n);
    const o1=this._osc('square',f,e,e+s+.08);
    const o2=this._osc('square',1.483*f,e,e+s+.08);
    const g2=this.ctx.createGain();g2.gain.value=.7;
    const bp=this.ctx.createBiquadFilter();
    bp.type='bandpass';bp.frequency.value=Math.max(850,Math.min(2400,1.45*f));bp.Q.value=2;
    const sat=this._sat(2.8);
    const amp=this.ctx.createGain();
    this._env(amp,e,.002,.24*i,s);
    o1.connect(bp);o2.connect(g2);g2.connect(bp);
    bp.connect(sat);sat.connect(amp);amp.connect(this.out);
  }

  sub808(e,n,s=.35,i=1,slide=null){
    const f=t(n);
    const o1=this._osc('sine',2.1*f,e,e+s+.15);
    o1.frequency.exponentialRampToValueAtTime(f,e+.045);
    if(slide)o1.frequency.exponentialRampToValueAtTime(t(slide),e+Math.max(.08,s));
    const o2=this._osc('triangle',f,e,e+s+.15);
    if(slide)o2.frequency.exponentialRampToValueAtTime(t(slide),e+Math.max(.08,s));
    const g2=this.ctx.createGain();g2.gain.value=.35;
    const sat=this._sat(3.4);
    const lp=this.ctx.createBiquadFilter();
    lp.type='lowpass';lp.frequency.setValueAtTime(480,e);
    lp.frequency.exponentialRampToValueAtTime(160,e+s);
    const amp=this.ctx.createGain();
    this._env(amp,e,.004,.62*i,s,.01);
    o1.connect(sat);o2.connect(g2);g2.connect(sat);
    sat.connect(lp);lp.connect(amp);amp.connect(this.out);
  }

  lead(e,n,s=.25,i=1,cutoff=4200){
    const f=t(n);
    const o1=this._osc('sawtooth',f,e,e+s+.08);o1.detune.value=-7;
    const o2=this._osc('sawtooth',f,e,e+s+.08);o2.detune.value=7;
    const vib=this._osc('sine',5.5,e,e+s+.08);
    const vg=this.ctx.createGain();vg.gain.value=.006*f;
    vib.connect(vg);vg.connect(o1.frequency);vg.connect(o2.frequency);
    const lp=this.ctx.createBiquadFilter();
    lp.type='lowpass';lp.Q.value=2.5;
    lp.frequency.setValueAtTime(cutoff,e);
    lp.frequency.exponentialRampToValueAtTime(Math.max(900,.4*cutoff),e+s);
    const amp=this.ctx.createGain();
    this._env(amp,e,.006,.11*i,s);
    o1.connect(lp);o2.connect(lp);lp.connect(amp);amp.connect(this.out);
  }

  brass(e,n,s=.28,i=1){
    const lp=this.ctx.createBiquadFilter();
    lp.type='lowpass';lp.Q.value=1.8;
    lp.frequency.setValueAtTime(2800,e);
    lp.frequency.exponentialRampToValueAtTime(950,e+s);
    const amp=this.ctx.createGain();
    this._env(amp,e,.01,.085*i,s);
    for(const m of n)for(const d of[-5,5]){
      const o=this._osc('sawtooth',t(m),e,e+s+.06);
      o.detune.value=d;o.connect(lp);
    }
    lp.connect(amp);amp.connect(this.out);
  }

  guitar(e,n,s=.28,i=1){
    const f=t(n);
    const o1=this._osc('triangle',f,e,e+s+.15);
    const o2=this._osc('sawtooth',f,e,e+s+.15);
    const g2=this.ctx.createGain();g2.gain.value=.32;
    const lp=this.ctx.createBiquadFilter();
    lp.type='lowpass';
    lp.frequency.setValueAtTime(3400,e);
    lp.frequency.exponentialRampToValueAtTime(700,e+Math.min(.22,s));
    const amp=this.ctx.createGain();
    this._env(amp,e,.002,.24*i,s+.06);
    o1.connect(lp);o2.connect(g2);g2.connect(lp);
    lp.connect(amp);amp.connect(this.out);
  }
}

const e=(t,e,n)=>{
  for(const s of t)s[0]===e&&n(s);
};

export const STYLES={
  russian:{
    bpm:112,bars:4,swing:.12,gain:1,
    chords:[[57,60,64],[57,62,65],[56,59,64],[57,60,64]],
    roots:[45,50,40,45],
    trem:[[69,72,76],[69,74,77],[68,71,76],[69,72,76]],
    melody:[
      [[0,76,2],[2,81,2],[4,80,1],[5,81,1],[6,83,2],[8,81,2],[10,80,2],[12,76,4]],
      [[0,77,2],[2,74,2],[4,77,2],[6,81,2],[8,79,1],[9,77,1],[10,76,2],[12,74,4]],
      [[0,71,2],[2,76,2],[4,80,2],[6,83,2],[8,80,1],[9,81,1],[10,80,1],[11,76,1],[12,74,2],[14,71,2]],
      [[0,72,2],[2,76,1],[3,74,1],[4,72,2],[6,71,2],[8,69,6],[14,64,1],[15,68,1]]
    ],
    step(t,n,s,i,c){
      const o=this;
      [0,6,8,11].includes(s)&&t.kick(i,0===s?1:.8);
      4!==s&&12!==s||t.snare(i,1);
      15===s&&t.snare(i,.3);
      t.hat(i,s%2?.5:.9,14===s);
      const a=o.roots[n];
      e([[0,a,2],[3,a+12,1],[6,a,1],[8,a,1],[10,a+7,1],[11,a+12,1],[13,a+7,1],[14,a+10-(2===n?2:0),1]],s,e=>t.bass(i,e[1],e[2]*c*.9,1));
      t.loop%2==0?s%4==2&&t.accordion(i,o.chords[n],1.6*c,.9):0===s&&t.accordion(i,o.chords[n],16*c,.7);
      if(t.loop%2==0&&(s<3||s>=8&&s<11)){
        const e=o.trem[n][(s>>1)%3];
        t.pluck(i,e,.09,.8,'sawtooth',4200);
        t.pluck(i+c/2,e,.09,.6,'sawtooth',4200);
      }
      t.loop%4==1&&e(o.melody[n],s,e=>{
        t.pluck(i,e[1],.12+e[2]*c*.4,1.1,'sawtooth',5e3);
        e[2]>1&&t.pluck(i+c/2,e[1],.1,.7,'sawtooth',4e3);
      });
      t.loop%4==3&&e(o.melody[n],s,e=>t.accordion(i,[e[1]],e[2]*c*.95,1.4));
    }
  },

  indian:{
    bpm:92,bars:4,swing:0,gain:1.25,
    start(t){t.drone([38,45],1)},
    tabla:[
      [[0,'dha'],[2,'dhin'],[3,'na'],[4,'dhin'],[6,'dha'],[8,'dha'],[10,'dhin'],[11,'na'],[12,'dhin'],[14,'dha'],[15,'ti']],
      [[0,'dha'],[2,'dhin'],[4,'dhin'],[6,'dha'],[7,'ti'],[8,'na'],[10,'tin'],[12,'tin'],[13,'ti'],[14,'na'],[15,'ge']]
    ],
    melody:[
      [[0,62,2],[2,63,1],[3,66,1],[4,67,2],[6,69,4,67],[10,70,1],[11,69,1],[12,67,2],[14,66,2]],
      [[0,63,4,66],[4,62,4],[8,69,2],[10,70,2],[12,73,2],[14,74,2]],
      [[0,75,2,74],[2,74,2],[4,73,1],[5,74,1],[6,70,2],[8,69,4],[12,67,1],[13,69,1],[14,70,2]],
      [[0,69,2],[2,67,2],[4,66,2],[6,63,2],[8,62,8,63]]
    ],
    step(t,n,s,i,c){
      e([[0,57],[4,62],[8,62],[12,50]],s,e=>t.pluck(i,e[1],1.1,.6,'sawtooth',2e3));
      e(this.tabla[n%2],s,e=>{
        const n='tin'===e[1]?'na':e[1];
        t.tabla(i,n,'ti'===e[1]?.6:1);
      });
      t.loop>0&&e(this.melody[n],s,e=>t.sitar(i,e[1]+(t.loop%3==2?-12:0),e[2]*c,e[3]?e[3]+(t.loop%3==2?-12:0):null,1));
      t.loop%3==1&&s%2==1&&t.sitar(i,74,.4*c,null,.35);
    }
  },

  safrica:{
    bpm:113,bars:4,swing:.08,gain:.4,
    chords:[[56,60,63,67],[61,65,68,72],[58,62,63,67],[60,63,67,68]],
    roots:[41,46,39,44],
    whistle:[
      [[0,84,2],[2,82,1],[3,80,1],[4,77,2],[7,80,1],[8,82,2],[10,84,2],[12,87,3]],
      [[0,84,2],[2,82,2],[4,80,2],[6,77,2],[8,75,2],[10,77,6]],
      [[0,72,1],[1,75,1],[2,77,2],[4,80,2],[6,82,2],[8,84,1],[9,82,1],[10,80,2],[12,77,4]],
      [[0,80,2],[2,77,2],[4,75,2],[6,72,2],[8,77,8]]
    ],
    step(t,n,s,i,c){
      const o=this;
      s%4==0&&t.kick(i,.9,120,42);
      t.shaker(i,s%4==2?1:.55);
      [3,6,11,14].includes(s)&&t.wood(i,.9,14===s?1150:880);
      8===s&&t.clap(i,.7);
      const a=o.roots[n];
      e([[2,a,2],[5,a,2],[7,a+7,2,a+3],[10,a+12,2,a+15],[13,a,3]],s,e=>t.logdrum(i,e[1],e[2]*c,1,e[3]||null));
      [2,7,10,15].includes(s)&&t.piano(i,o.chords[n],2===s?1:.7,.35);
      0===s&&t.pad(i,o.chords[n].map(t=>t-12),16*c,.8);
      t.loop%2==1&&e(o.whistle[n],s,e=>t.whistle(i,e[1],e[2]*c,1));
    }
  },

  meadow:{
    bpm:124,bars:4,swing:.04,gain:.72,
    roots:[48,43,45,41],
    chords:[[60,64,67,71],[55,59,62,67],[57,60,64,67],[53,57,60,64]],
    melody:[
      [[0,72,2],[2,76,2],[4,79,3],[7,76,1],[8,79,2],[10,84,2],[12,83,2],[14,79,2]],
      [[0,79,2],[2,74,2],[4,76,2],[6,74,2],[8,71,2],[10,74,2],[12,79,4]],
      [[0,76,2],[2,79,2],[4,81,3],[7,79,1],[8,76,2],[10,72,2],[12,76,2],[14,79,2]],
      [[0,77,2],[2,76,2],[4,72,2],[6,69,2],[8,72,2],[10,74,2],[12,76,4]]
    ],
    step(t,n,s,i,c){
      const o=this,a=o.roots[n];
      s%4==0&&t.kick(i,.95,145,46);
      (4===s||12===s)&&(t.snare(i,.8),t.clap(i,.45));
      if(s%2==0)t.hat(i,s%4==2?.85:.45,s%4==2);
      else if(t.loop%2==1)t.hat(i,.3,!1);
      e([[0,a,2],[2,a+12,1],[4,a,2],[6,a+12,1],[8,a,2],[10,a+7,2],[12,a+12,2],[14,a+7,2]],s,e=>t.bass(i,e[1],e[2]*c*.85,.82));
      [0,6,10].includes(s)&&t.piano(i,o.chords[n],0===s?1.1:.75,.38);
      0===s&&t.pad(i,o.chords[n].map(x=>x-12),16*c,.85);
      t.loop%2==0?e(o.melody[n],s,e=>t.lead(i,e[1],e[2]*c*.9,.9,4600)):e(o.melody[n],s,e=>t.pluck(i,e[1],e[2]*c*.8,.9,'triangle',3800));
    }
  },

  canyon:{
    bpm:136,bars:4,swing:.06,gain:.9,
    roots:[50,50,46,45],
    chords:[[62,65,69],[62,67,70],[58,62,65],[57,61,64]],
    melody:[
      [[0,74,2],[2,77,2],[4,81,2],[6,77,2],[8,79,1],[9,81,1],[10,79,2],[12,77,2],[14,76,2]],
      [[0,74,2],[2,79,2],[4,82,2],[6,81,2],[8,79,2],[10,77,2],[12,76,2],[14,74,2]],
      [[0,70,2],[2,74,2],[4,77,2],[6,82,2],[8,81,2],[10,79,2],[12,77,2],[14,74,2]],
      [[0,73,2],[2,76,2],[4,79,2],[6,81,2],[8,76,2],[10,73,2],[12,69,4]]
    ],
    step(t,n,s,i,c){
      const o=this,a=o.roots[n];
      [0,4,8,12].includes(s)&&t.kick(i,s%8==0?1:.85,155,48);
      [2,6,10,14].includes(s)&&t.snare(i,.72);
      15===s&&t.snare(i,.35);
      t.hat(i,s%2?.4:.85,14===s);
      e([[0,a,2],[2,a+12,1],[4,a+7,2],[6,a+12,1],[8,a,2],[10,a+12,1],[12,a+7,2],[14,a+10,2]],s,e=>t.bass(i,e[1],e[2]*c*.82,.95));
      if(s%4==2)t.accordion(i,o.chords[n],1.5*c,.95);
      if(t.loop%2==1&&s%2==0){
        const p=o.chords[n][(s>>1)%3]+12;
        t.pluck(i,p,.08,.75,'sawtooth',4400);
        t.pluck(i+c/2,p,.08,.55,'sawtooth',4200);
      }
      e(o.melody[n],s,e=>{
        t.loop%2==0?t.pluck(i,e[1],e[2]*c*.7,1,'sawtooth',4800):t.accordion(i,[e[1]],e[2]*c*.9,1.25);
      });
    }
  },

  gymbros:{
    bpm:130,bars:4,swing:0,gain:.78,
    roots:[40,48,43,47],
    chords:[[52,55,59,64],[60,64,67,72],[55,59,62,67],[59,63,66,71]],
    melody:[
      [[0,76,2],[2,76,1],[3,79,1],[4,83,3],[7,81,1],[8,79,2],[10,76,2],[12,74,2],[14,76,2]],
      [[0,72,2],[2,76,2],[4,79,3],[7,76,1],[8,84,2],[10,83,2],[12,79,4]],
      [[0,79,2],[2,79,1],[3,83,1],[4,86,3],[7,83,1],[8,81,2],[10,79,2],[12,76,2],[14,74,2]],
      [[0,75,2],[2,78,2],[4,83,2],[6,81,2],[8,79,2],[10,78,2],[12,76,4]]
    ],
    step(t,n,s,i,c){
      const o=this,a=o.roots[n];
      s%4==0&&t.kick(i,1.05,165,44);
      (4===s||12===s)&&(t.snare(i,1),t.clap(i,.8));
      t.hat(i,s%4==2?.9:.45,s%4==2);
      t.bass(i,s%4==2?a+12:a,.78*c,s%4==0?.95:.7);
      [0,6,12].includes(s)&&t.brass(i,o.chords[n],s===12?2.8*c:1.8*c,1);
      if(t.loop%2==1||n>=2)e(o.melody[n],s,e=>t.lead(i,e[1],e[2]*c*.95,1.05,5200));
    }
  },

  border:{
    bpm:118,bars:4,swing:.09,gain:.78,
    roots:[40,41,43,41],
    chords:[[52,56,59,64],[53,57,60,65],[55,59,62,67],[53,57,60,64]],
    melody:[
      [[0,76,2],[2,77,1],[3,80,1],[4,81,2],[6,80,2],[8,77,2],[10,76,2],[12,74,2],[14,76,2]],
      [[0,77,2],[2,80,2],[4,81,3],[7,80,1],[8,77,2],[10,76,2],[12,77,4]],
      [[0,79,2],[2,81,1],[3,83,1],[4,84,2],[6,83,2],[8,81,2],[10,79,2],[12,77,2],[14,76,2]],
      [[0,77,2],[2,76,2],[4,74,2],[6,72,2],[8,76,4],[12,71,4]]
    ],
    step(t,n,s,i,c){
      const o=this,a=o.roots[n];
      [0,6,8,14].includes(s)&&t.kick(i,0===s||8===s?.95:.7,135,45);
      (4===s||12===s)&&t.snare(i,.75);
      t.shaker(i,s%4==2?.9:.5);
      [3,6,10,14].includes(s)&&t.wood(i,.75,10===s?1080:840);
      e([[0,a,3],[3,a+7,2],[6,a+12,2],[8,a,3],[11,a+7,2],[14,a+12,2]],s,e=>t.bass(i,e[1],e[2]*c*.85,.8));
      e([[0,0],[2,1],[3,2],[6,3],[8,0],[10,2],[12,1],[14,3]],s,e=>{
        const ch=o.chords[n];
        t.guitar(i,ch[e[1]%ch.length]+12,1.6*c,.9);
      });
      t.loop%2==0?e(o.melody[n],s,e=>t.brass(i,[e[1],e[1]-4],e[2]*c*.9,.95)):e(o.melody[n],s,e=>t.whistle(i,e[1],e[2]*c*.95,1.05));
    }
  },

  russian_phonk:{
    bpm:134,bars:4,swing:0,gain:.48,
    roots:[43,43,39,41],
    chords:[[55,58,62],[55,60,63],[51,55,58],[53,56,60]],
    cowbells:[
      [[0,67,2],[2,70,2],[4,72,2],[6,73,2],[8,72,2],[10,70,2],[12,67,2],[14,66,2]],
      [[0,67,2],[2,70,2],[4,74,2],[6,75,2],[8,74,2],[10,72,2],[12,70,2],[14,67,2]],
      [[0,63,2],[2,67,2],[4,70,2],[6,72,2],[8,70,2],[10,67,2],[12,63,2],[14,62,2]],
      [[0,65,2],[2,67,2],[4,70,2],[6,74,2],[8,72,2],[10,70,2],[12,66,2],[14,62,2]]
    ],
    step(t,n,s,i,c){
      const o=this,a=o.roots[n];
      [0,3,6,10,12].includes(s)&&t.kick(i,0===s||12===s?1.1:.88,165,42);
      if(4===s||12===s){
        t.clap(i,1.05);
        t.snare(i,.75);
      }
      t.hat(i,s%4==2?.85:.5,14===s);
      if((1===n||3===n)&&(7===s||14===s||15===s)){
        t.hat(i+c/3,.45,!1);
        t.hat(i+2*c/3,.55,!1);
      }
      e([[0,a,3],[3,a,2],[6,a+12,2,a],[10,a+7,2],[12,a,3,3===n?a-5:null]],s,e=>t.sub808(i,e[1],e[2]*c*.95,1,e[3]||null));
      e(o.cowbells[n],s,e=>{
        t.cowbell(i,e[1],e[2]*c*.85,1.05);
        if(t.loop%2==1)t.cowbell(i,e[1]+12,e[2]*c*.7,.55);
      });
      if(t.loop%2==1&&0===s)t.accordion(i,o.chords[n],15*c,.75);
      if(t.loop%4>=2&&s%4==2)t.pluck(i,o.chords[n][2]+12,.14,.65,'sawtooth',4200);
    }
  }
};
