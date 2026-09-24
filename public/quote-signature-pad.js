(function(){
'use strict';
window.PoolShedSignature={
 createState:()=>({method:'typed',text:'',strokes:[]}),
 markup:()=>`<fieldset class="pc-signing"><legend>Your signature</legend>
 <p id="pcSignatureHelp">Type your signature or draw it using your mouse, finger or pen.</p>
 <div class="pc-signature-methods" role="group" aria-label="Signature method">
 <button type="button" data-signature-method="typed" aria-pressed="true">Type signature</button>
 <button type="button" data-signature-method="drawn" aria-pressed="false">Draw signature</button></div>
 <div id="pcTypedSignature"><label for="pcSignatureText">Type your full name to sign</label><input id="pcSignatureText" autocomplete="off" maxlength="200" placeholder="Your full name"><span class="pc-signature-caption">Signature preview</span><div class="pc-signature-box" id="pcSignaturePreview" aria-live="polite">Your signature</div></div>
 <div id="pcDrawnSignature" hidden><canvas id="pcSignatureCanvas" width="960" height="300" aria-label="Draw your signature. You can also use the Type signature button." aria-describedby="pcSignatureHelp"></canvas><div class="pc-signature-tools"><span id="pcSignatureStatus" role="status">Draw inside the box</span><button type="button" id="pcClearSignature">Clear signature</button></div></div>
 <p class="pc-signature-caption">Your signature will be saved with this proposal when you accept.</p></fieldset>`,
 bind(state){
  const canvas=document.getElementById('pcSignatureCanvas');if(!canvas)return;
  const ctx=canvas.getContext('2d'),input=document.getElementById('pcSignatureText'),status=document.getElementById('pcSignatureStatus');
  let stroke=null,pointerId=null;
  function paint(){if(!ctx)return;ctx.clearRect(0,0,canvas.width,canvas.height);ctx.strokeStyle='#24332d';ctx.lineWidth=3;ctx.lineCap='round';ctx.lineJoin='round';state.strokes.forEach(points=>{ctx.beginPath();points.forEach(([x,y],i)=>{if(i)ctx.lineTo(x*canvas.width,y*canvas.height);else ctx.moveTo(x*canvas.width,y*canvas.height)});ctx.stroke()})}
  function sync(){document.getElementById('pcTypedSignature').hidden=state.method!=='typed';document.getElementById('pcDrawnSignature').hidden=state.method!=='drawn';document.querySelectorAll('[data-signature-method]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.signatureMethod===state.method)));input.value=state.text;document.getElementById('pcSignaturePreview').textContent=state.text.trim()||'Your signature';paint()}
  document.querySelectorAll('[data-signature-method]').forEach(b=>b.onclick=()=>{state.method=b.dataset.signatureMethod;sync();if(state.method==='typed')input.focus()});
  input.oninput=()=>{state.text=input.value;document.getElementById('pcSignaturePreview').textContent=state.text.trim()||'Your signature'};
  document.getElementById('pcClearSignature').onclick=()=>{state.strokes=[];stroke=null;pointerId=null;paint();status.textContent='Signature cleared. Draw inside the box.'};
  const point=e=>{const r=canvas.getBoundingClientRect();return [Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))].map(n=>Math.round(n*10000)/10000)};
  const count=()=>state.strokes.reduce((n,s)=>n+s.length,0);
  canvas.onpointerdown=e=>{if(e.button!==0||pointerId!==null)return;e.preventDefault();if(state.strokes.length>=100||count()>=3000){status.textContent='Signature limit reached. Clear and sign again.';return}pointerId=e.pointerId;canvas.setPointerCapture(e.pointerId);stroke=[point(e)];state.strokes.push(stroke)};
  canvas.onpointermove=e=>{if(e.pointerId!==pointerId||!stroke)return;e.preventDefault();if(count()>=3000){status.textContent='Signature limit reached. Clear and sign again.';return}const p=point(e),last=stroke[stroke.length-1];if(Math.hypot(p[0]-last[0],p[1]-last[1])<.001)return;stroke.push(p);paint();status.textContent='Signature captured. Clear to sign again.'};
  function finish(e){if(e.pointerId!==pointerId)return;stroke=null;pointerId=null;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId)}
  canvas.onpointerup=finish;canvas.onpointercancel=finish;canvas.onlostpointercapture=finish;
  sync();
 },
 value(state){
  if(state.method==='typed'){const text=state.text.trim();if(text.length<2||text.length>200)throw Error('Type your full name in the signature box.');return {method:'typed',text}}
  let distance=0;state.strokes.forEach(s=>s.forEach((p,i)=>{if(i)distance+=Math.hypot(p[0]-s[i-1][0],p[1]-s[i-1][1])}));
  if(distance<.01)throw Error('Draw your signature in the box, or choose Type signature.');
  return {method:'drawn',strokes:state.strokes.map(s=>s.map(p=>p.slice()))};
 }
};
})();
