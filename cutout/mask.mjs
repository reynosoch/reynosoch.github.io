// Deterministic matte refinement; called in a worker, never on the UI thread.
export function backgroundColor(rgba,w,h){
 const samples=[];let edgeCount=0,clearCount=0;const step=Math.max(1,Math.floor(Math.max(w,h)/128));
 const add=(x,y)=>{let i=(y*w+x)*4;edgeCount++;if(rgba[i+3]<8)clearCount++;if(rgba[i+3]>240)samples.push([rgba[i],rgba[i+1],rgba[i+2]]);};
 for(let x=0;x<w;x+=step){add(x,0);add(x,h-1);}for(let y=0;y<h;y+=step){add(0,y);add(w-1,y);}
 if(clearCount/edgeCount>.95)return {color:[255,255,255],solid:false,transparent:true};
 if(samples.length<8)return {color:[255,255,255],solid:false};
 const buckets=new Map();for(const c of samples){const key=c.map(v=>v>>4).join(',');const group=buckets.get(key)||[];group.push(c);buckets.set(key,group);}
 const group=[...buckets.values()].sort((a,b)=>b.length-a.length)[0];const color=[0,1,2].map(k=>Math.round(group.reduce((s,c)=>s+c[k],0)/group.length));
 const near=samples.filter(c=>Math.max(...c.map((v,k)=>Math.abs(v-color[k])))<24).length;
 return {color,solid:near/samples.length>.9};
}
export function colorMask(rgba,color,tolerance=25){
 const a=new Uint8Array(rgba.length/4);for(let p=0;p<a.length;p++){const i=p*4;const d=Math.max(Math.abs(rgba[i]-color[0]),Math.abs(rgba[i+1]-color[1]),Math.abs(rgba[i+2]-color[2]));a[p]=Math.round(Math.max(0,Math.min(1,(d-tolerance)/22))*255);}return a;
}
function blur(a,w,h,r){
 if(!r)return a;const temp=new Float32Array(a.length),out=new Uint8Array(a.length),n=2*r+1;
 for(let y=0;y<h;y++){let sum=0;for(let k=-r;k<=r;k++)sum+=a[y*w+Math.max(0,Math.min(w-1,k))];for(let x=0;x<w;x++){temp[y*w+x]=sum/n;sum+=a[y*w+Math.min(w-1,x+r+1)]-a[y*w+Math.max(0,x-r)];}}
 for(let x=0;x<w;x++){let sum=0;for(let k=-r;k<=r;k++)sum+=temp[Math.max(0,Math.min(h-1,k))*w+x];for(let y=0;y<h;y++){out[y*w+x]=Math.round(sum/n);sum+=temp[Math.min(h-1,y+r+1)*w+x]-temp[Math.max(0,y-r)*w+x];}}return out;
}
export function cleanup(a,w,h,limit){
 if(!limit)return a;const seen=new Uint8Array(a.length),q=new Uint32Array(a.length);
 for(let i=0;i<a.length;i++){if(seen[i]||a[i]<24)continue;let head=0,tail=1;q[0]=i;seen[i]=1;while(head<tail){const p=q[head++],x=p%w;for(const n of [x?p-1:-1,x<w-1?p+1:-1,p>=w?p-w:-1,p+w<a.length?p+w:-1])if(n>=0&&!seen[n]&&a[n]>=24){seen[n]=1;q[tail++]=n;}}if(tail<=limit)for(let k=0;k<tail;k++)a[q[k]]=0;}return a;
}
export function refine(rgba,base,w,h,settings,bg){
 let a=new Uint8Array(base);const shift=(settings.strength-50)*1.2;
 for(let i=0;i<a.length;i++)if(a[i]>0&&a[i]<255)a[i]=Math.max(0,Math.min(255,(a[i]-shift)*255/(255-2*shift)));
 a=cleanup(a,w,h,settings.cleanup);a=blur(a,w,h,settings.softness);
 if(settings.preset==='logo')for(let i=0;i<a.length;i++)a[i]=Math.max(0,Math.min(255,(a[i]-40)*255/175));
 const out=new Uint8ClampedArray(rgba);
 for(let p=0;p<a.length;p++){const i=p*4,alpha=a[p]/255;out[i+3]=Math.round(a[p]*rgba[i+3]/255);if(settings.halo&&alpha>.02&&alpha<.98){const mix=Math.min(.95,(1-alpha)*settings.halo/100);for(let k=0;k<3;k++)out[i+k]=Math.max(0,Math.min(255,(rgba[i+k]-bg[k]*mix)/(1-mix)));}}
 return out;
}
