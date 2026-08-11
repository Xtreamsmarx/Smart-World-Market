/* script.js — MID-0033 */

// ── Particle canvas ──
(function(){
  const cv=document.getElementById('c'), ctx=cv.getContext('2d');
  let W=0,H=0,pts=[];
  function resize(){
    W=cv.width=window.innerWidth;
    H=cv.height=Math.max(window.innerHeight,cv.parentElement.clientHeight||0);
  }
  function init(){
    pts=Array.from({length:70},()=>({
      x:Math.random()*W,y:Math.random()*H,
      r:Math.random()*1.8+.5,
      vx:(Math.random()-.5)*.35,vy:(Math.random()-.5)*.35,
      hue:200+Math.random()*80
    }));
  }
  function draw(){
    ctx.clearRect(0,0,W,H);
    for(let i=0;i<pts.length;i++){
      for(let j=i+1;j<pts.length;j++){
        const dx=pts[i].x-pts[j].x,dy=pts[i].y-pts[j].y,d=Math.hypot(dx,dy);
        if(d<130){
          ctx.beginPath();ctx.moveTo(pts[i].x,pts[i].y);ctx.lineTo(pts[j].x,pts[j].y);
          ctx.strokeStyle=`hsla(${pts[i].hue},85%,68%,${(1-d/130)*.4})`;
          ctx.lineWidth=.65;ctx.stroke();
        }
      }
      ctx.beginPath();ctx.arc(pts[i].x,pts[i].y,pts[i].r,0,Math.PI*2);
      ctx.fillStyle=`hsl(${pts[i].hue},85%,68%)`;ctx.fill();
      pts[i].x+=pts[i].vx;pts[i].y+=pts[i].vy;
      if(pts[i].x<0||pts[i].x>W)pts[i].vx*=-1;
      if(pts[i].y<0||pts[i].y>H)pts[i].vy*=-1;
    }
    requestAnimationFrame(draw);
  }
  window.addEventListener('resize',()=>{resize();init();});
  requestAnimationFrame(()=>requestAnimationFrame(()=>{resize();init();draw();}));
})();

// ── Sound ──
const SPEECH_TEXT = 'MedScan AI. AI dermatology scanner for skin condition analysis. Category: Healthcare AI. Price: 349.0 dollars per monthly. Accuracy: 94.2%.';
let _speaking=false;

function toggleSpeak(){
  const btn=document.getElementById('sound-btn');
  if(_speaking){
    speechSynthesis.cancel();_speaking=false;
    btn.innerHTML='🔊 Listen';btn.classList.remove('playing');return;
  }
  if(!('speechSynthesis' in window)){alert('TTS not supported in this browser.');return;}
  const u=new SpeechSynthesisUtterance(SPEECH_TEXT);
  u.rate=0.92;u.pitch=1.05;
  u.onstart=()=>{
    _speaking=true;btn.classList.add('playing');
    btn.innerHTML='⏹ Stop <span class="wave"><span></span><span></span><span></span><span></span><span></span></span>';
  };
  u.onend=u.onerror=()=>{_speaking=false;btn.classList.remove('playing');btn.innerHTML='🔊 Listen';};
  speechSynthesis.speak(u);
}

// ── Buy button ──
function goBuy(){window.location.href='/payment/MID-0033';}

// ── Animate on scroll ──
const observer=new IntersectionObserver(entries=>{
  entries.forEach(e=>{if(e.isIntersecting)e.target.classList.add('afu')});
},{threshold:.15});
document.querySelectorAll('.stat-box,.sec,.seller-card,.buy-section').forEach(el=>{
  el.style.opacity=0;observer.observe(el);
});
