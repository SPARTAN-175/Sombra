const C=document.querySelector("#game"),X=C.getContext("2d"),T=24,MW=44,MH=28;
let levels=[],L=null,selected=0,mode="move",paused=false,won=false,missionTimer=0,last=0;
let squad=[],enemies=[],shots=[],effects=[],objectiveDone=false,extracting=false;
const $=s=>document.querySelector(s),missionEl=$("#mission"),stateEl=$("#state"),objectiveEl=$("#objective"),squadEl=$("#squad"),modal=$("#modal");
const names=[["ALFA","FUSILERO"],["BRAVO","FRANCTIRADOR"],["CHARLIE","MÉDICO"],["DELTA","EXPLORADOR"]];
fetch("levels.json").then(r=>r.json()).then(d=>{levels=d.levels;load(+localStorage.getItem("sombra_level")||1);requestAnimationFrame(loop)});
function ctr(p){return{x:(p.x+.5)*T,y:(p.y+.5)*T}}
function walk(x,y){return x>=0&&y>=0&&x<MW&&y<MH&&L.grid[y][x]==="."}
function nearestFree(tx,ty){for(let r=0;r<8;r++)for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++)if(walk(tx+dx,ty+dy))return{x:tx+dx,y:ty+dy};return{x:tx,y:ty}}
function load(n){
 n=Math.max(1,Math.min(200,n));L=levels[n-1];selected=0;mode="move";paused=false;won=false;objectiveDone=false;extracting=false;shots=[];effects=[];
 const s=ctr(L.start);
 squad=names.map((a,i)=>({id:i,name:a[0],role:a[1],x:s.x+(i%2)*15,y:s.y+Math.floor(i/2)*15,hp:100,alive:true,target:null,cover:false,stealth:false}));
 enemies=L.enemies.map((e,i)=>{let p=ctr(nearestFree(e.x,e.y));return{id:i,x:p.x,y:p.y,hp:e.hp,alive:true,cd:0,alert:false}});
 missionEl.textContent=String(n).padStart(3,"0");stateEl.textContent="INICIO";
 objectiveEl.innerHTML="<b>"+L.type+"</b><br>"+L.briefing;
 modal.style.display="none";renderSquad();
}
function renderSquad(){
 squadEl.innerHTML=squad.map((o,i)=>`<button class="operator ${i===selected?"sel ":""}${!o.alive?"dead":""}" data-i="${i}"><span class="num">${i+1}</span><b>${o.name}</b><span>${o.role}</span><div class="bar"><i style="width:${Math.max(0,o.hp)}%"></i></div></button>`).join("");
 squadEl.querySelectorAll(".operator").forEach(b=>b.onclick=()=>{selected=+b.dataset.i;renderSquad()});
}
function setMode(m){mode=m;document.querySelectorAll(".cmd[data-mode]").forEach(b=>b.classList.toggle("active",b.dataset.mode===m));}
document.querySelectorAll(".cmd[data-mode]").forEach(b=>b.onclick=()=>setMode(b.dataset.mode));
$("#execute").onclick=()=>paused=!paused;
$("#retry").onclick=()=>load(L.id);
$("#next").onclick=()=>{if(L.id<200)load(L.id+1)};
$("#full").onclick=async()=>{try{await document.documentElement.requestFullscreen();screen.orientation?.lock?.("landscape").catch(()=>{})}catch(e){}};
addEventListener("pointerdown",()=>{if(!document.fullscreenElement)$("#full").style.display="block"},{once:true});

function canvasPoint(e){
 const r=C.getBoundingClientRect();
 return{x:(e.clientX-r.left)*C.width/r.width,y:(e.clientY-r.top)*C.height/r.height};
}
C.addEventListener("pointerdown",e=>{
 if(won||paused)return;
 const q=canvasPoint(e),cell={x:Math.floor(q.x/T),y:Math.floor(q.y/T)};
 if(mode==="attack"){
   const en=enemies.find(a=>a.alive&&Math.hypot(a.x-q.x,a.y-q.y)<28);
   if(en) squad[selected].target=en.id;
   else squad[selected].target=null;
 }else if(walk(cell.x,cell.y)){
   squad[selected].target={x:q.x,y:q.y};
   if(mode==="cover")squad[selected].cover=true;
   if(mode==="stealth")squad[selected].stealth=true;
   if(mode==="hold")squad[selected].target=null;
 }
});

function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}
function lineWalk(a,b){
 const n=Math.ceil(dist(a,b)/8);
 for(let i=0;i<=n;i++){let t=i/n||0,x=a.x+(b.x-a.x)*t,y=a.y+(b.y-a.y)*t;if(!walk(Math.floor(x/T),Math.floor(y/T)))return false}
 return true;
}
function moveOp(o,dt){
 if(!o.alive||!o.target)return;
 let tx=o.target.x,ty=o.target.y;
 if(typeof o.target==="number"){const e=enemies.find(e=>e.id===o.target&&e.alive);if(!e){o.target=null;return}tx=e.x;ty=e.y}
 let dx=tx-o.x,dy=ty-o.y,d=Math.hypot(dx,dy);
 if(d<5){o.target=null;return}
 const sp=o.stealth?42:68;o.x+=dx/d*sp*dt;o.y+=dy/d*sp*dt;
 if(!walk(Math.floor(o.x/T),Math.floor(o.y/T))){o.x-=dx/d*sp*dt;o.y-=dy/d*sp*dt;o.target=null}
}
function squadFire(o,dt){
 if(!o.alive||o.target===null)return;
 let e=enemies.find(e=>e.id===o.target&&e.alive);if(!e)return;
 if(dist(o,e)<230&&lineWalk(o,e)){o.cd=(o.cd||0)-dt;if(o.cd<=0){o.cd=.42;shots.push({x:o.x,y:o.y,tx:e.x,ty:e.y,friend:true,target:e.id,t:0});}}
}
function enemyAI(e,dt){
 if(!e.alive)return;
 let living=squad.filter(o=>o.alive),target=living.sort((a,b)=>dist(a,e)-dist(b,e))[0];if(!target)return;
 const d=dist(e,target);
 if(d<255&&lineWalk(e,target)){e.alert=true;e.cd-=dt;if(e.cd<=0){e.cd=1.25;shots.push({x:e.x,y:e.y,tx:target.x,ty:target.y,friend:false,target:target.id,t:0});}}
 else if(d<380){e.x+=(target.x-e.x)/d*22*dt;e.y+=(target.y-e.y)/d*22*dt}
}
function updateShots(dt){
 for(let s of shots){
  s.t+=dt;
  if(s.t>.28){if(s.friend){let e=enemies.find(e=>e.id===s.target&&e.alive);if(e){e.hp-=38;if(e.hp<=0){e.alive=false;effects.push({x:e.x,y:e.y,t:0,type:"hit"})}}}
   else {let o=squad.find(o=>o.id===s.target&&o.alive);if(o){let dmg=o.cover?7:12;o.hp-=dmg;if(o.hp<=0){o.hp=0;o.alive=false}}}
   s.dead=true;
  }
 }
 shots=shots.filter(s=>!s.dead);
}
function updateObjective(){
 const o=ctr(L.objective), alive=squad.filter(x=>x.alive);
 if(!objectiveDone && alive.some(x=>dist(x,o)<25) && (L.type!=="INTERDICTION" || enemies.every(e=>!e.alive))){
  objectiveDone=true;stateEl.textContent="OBJETIVO";effects.push({x:o.x,y:o.y,t:0,type:"objective"});navigator.vibrate?.([30,40,30]);
 }
 const ex=ctr(L.extract);
 if(objectiveDone && alive.length && alive.every(x=>dist(x,ex)<34)){won=true;stateEl.textContent="COMPLETA";modal.style.display="grid";$("#resultTitle").textContent="MISIÓN CUMPLIDA";$("#resultText").textContent=`${L.name} completada. Equipo extraído con ${alive.length}/4 operadores.`;if(L.id<200)localStorage.setItem("sombra_level",L.id+1);navigator.vibrate?.([40,50,80])}
 if(alive.length===0&&!won){won=true;stateEl.textContent="FALLIDA";modal.style.display="grid";$("#resultTitle").textContent="MISIÓN FALLIDA";$("#resultText").textContent="El equipo fue neutralizado. Revisa la ruta y vuelve a intentarlo.";}}
function draw(){
 X.clearRect(0,0,C.width,C.height);
 // terrain
 for(let y=0;y<MH;y++)for(let x=0;x<MW;x++){let px=x*T,py=y*T;
  X.fillStyle=L.grid[y][x]==="#"?"#0a1018":((x+y)%2?"#111a22":"#101820");X.fillRect(px,py,T,T);
  if(L.grid[y][x]==="#"){X.strokeStyle="#111e2b";X.strokeRect(px+.5,py+.5,T-1,T-1)}
 }
 // cover
 for(const c of L.cover){X.fillStyle="#303a43";X.fillRect(c.x*T+4,c.y*T+5,T-8,T-9);X.strokeStyle="#4a5965";X.strokeRect(c.x*T+4,c.y*T+5,T-8,T-9)}
 // objective/extraction
 const ob=ctr(L.objective),ex=ctr(L.extract);
 X.beginPath();X.arc(ob.x,ob.y,objectiveDone?13:11,0,7);X.strokeStyle=objectiveDone?"#64d8b8":"#e5b85f";X.lineWidth=3;X.stroke();X.fillStyle=objectiveDone?"#64d8b8":"#e5b85f";X.font="900 8px system-ui";X.textAlign="center";X.fillText("OBJ",ob.x,ob.y+25);
 X.beginPath();X.arc(ex.x,ex.y,12,0,7);X.strokeStyle=objectiveDone?"#65d4ff":"#425366";X.lineWidth=3;X.stroke();X.fillStyle="#65d4ff";X.fillText("EXTR",ex.x,ex.y+24);
 // enemies
 for(const e of enemies)if(e.alive){X.beginPath();X.arc(e.x,e.y,9,0,7);X.fillStyle=e.alert?"#e24f62":"#9c3e4c";X.fill();X.fillStyle="#ff8998";X.font="900 8px system-ui";X.fillText("×",e.x,e.y+3)}
 // paths
 for(const o of squad)if(o.alive&&o.target&&typeof o.target!=="number"){X.setLineDash([5,5]);X.strokeStyle="#6bd6bc66";X.beginPath();X.moveTo(o.x,o.y);X.lineTo(o.target.x,o.target.y);X.stroke();X.setLineDash([])}
 // squad
 for(const o of squad)if(o.alive){let sel=squad[selected]===o;X.beginPath();X.arc(o.x,o.y,15,0,7);X.strokeStyle=sel?"#70e0c2":"#4d9c8d";X.lineWidth=sel?3:2;X.stroke();X.beginPath();X.arc(o.x,o.y,8,0,7);X.fillStyle="#dfe9f1";X.fill();X.fillStyle="#8ff1d6";X.font="900 8px system-ui";X.fillText(o.name[0],o.x,o.y+3)}
 // shots
 for(const s of shots){X.strokeStyle=s.friend?"#f5d47c":"#ff6d7f";X.lineWidth=2;X.beginPath();X.moveTo(s.x,s.y);X.lineTo(s.tx,s.ty);X.stroke()}
 // effects
 for(const a of effects){a.t+=.016;X.beginPath();X.arc(a.x,a.y,10+a.t*50,0,7);X.strokeStyle=a.type==="objective"?"#65e0c1":"#ff7080";X.globalAlpha=Math.max(0,1-a.t*2);X.stroke();X.globalAlpha=1}
 effects=effects.filter(a=>a.t<.6);
}
function loop(t){let dt=Math.min((t-last)/1000,.04);last=t;if(!paused&&!won){missionTimer+=dt;squad.forEach(o=>{moveOp(o,dt);if(mode==="attack"||o.target!==null)squadFire(o,dt)});enemies.forEach(e=>enemyAI(e,dt));updateShots(dt);updateObjective();renderSquad()}draw();requestAnimationFrame(loop)}
