import {Canvas,FabricImage,FabricObject,Rect,Ellipse,Circle,Line,Triangle,Group,Textbox,FabricText,PencilBrush,Point,util} from '../vendor/fabric-7.4.0.mjs';
import {Region} from './regions.mjs';
import {History,clampCrop} from './history.mjs';
import {loadImage} from '../media/files.mjs';
FabricObject.customProperties=['shotId','shotKind'];
const base={originX:'left',originY:'top',cornerColor:'#ff9b4a',cornerStrokeColor:'#25160b',borderColor:'#ff9b4a',transparentCorners:false,cornerSize:11,touchCornerSize:26,strokeUniform:true};
export class Editor {
 constructor(element,stage,{change,selection,view,tool,copyImage,error}={}){
  this.stage=stage;this.callbacks={change,selection,view,tool,copyImage,error};this.style={color:'#ff4d4f',width:4,head:18,fontSize:28,opacity:1,bold:true,fill:false,align:'left'};this.tool='arrow';this.doc=null;this.loading=false;
  this.canvas=new Canvas(element,{enablePointerEvents:true,preserveObjectStacking:true,selection:false,stopContextMenu:false,fireRightClick:false,renderOnAddRemove:false});
  this.canvas.on('mouse:down',e=>this.down(e));this.canvas.on('mouse:move',e=>this.move(e));this.canvas.on('mouse:up',e=>this.up(e));
  this.canvas.on('after:render',()=>{if(this.viewportPending){this.viewportPending=false;this.callbacks.view?.(this.canvas.getZoom());}});
  this.canvas.on('object:modified',()=>this.commit());this.canvas.on('text:editing:exited',()=>this.commit());
  this.canvas.on('path:created',({path})=>{path.set({...base,shotId:crypto.randomUUID(),shotKind:this.tool});this.commit();});
  for(const event of ['selection:created','selection:updated','selection:cleared'])this.canvas.on(event,()=>this.callbacks.selection?.());
  this.canvas.on('mouse:wheel',({e})=>this.trackpad(e));
  new ResizeObserver(()=>this.resize()).observe(stage);this.resize();this.touch();this.mouseShortcuts();this.pointerTools();
 }
 resize(){const r=this.stage.getBoundingClientRect();this.canvas.setDimensions({width:Math.max(100,r.width-2),height:Math.max(100,r.height-2)});if(this.doc&&!this.gesture)this.fit();}
 async open(doc){if(this.loading)return false;this.loading=true;this.doc=doc;this.draw=null;this.canvas.discardActiveObject();this.canvas.clear();try{const image=await loadImage(doc.blob);this.canvas.backgroundImage=new FabricImage(image,{...base,selectable:false,evented:false});await this.restore(doc.state||{objects:[],crop:null,notes:{}});doc.history??=new History();if(!doc.history.states.length)doc.history.push(this.snapshot());this.fit();this.setTool(this.tool);return true;}finally{this.loading=false;}}
 snapshot(){return {objects:this.canvas.getObjects().filter(o=>o!==this.cropBox).map(o=>o.toObject(['shotId','shotKind'])),crop:this.doc?.crop||null,notes:{...this.doc?.notes}};}
 async restore(state){this.restoring=true;try{for(const o of [...this.canvas.getObjects()])this.canvas.remove(o);const objects=await util.enlivenObjects(state.objects||[]);for(const o of objects)this.canvas.add(o);this.doc.crop=state.crop;this.doc.notes={...state.notes};this.cropBox=null;this.clip();this.renumber();this.canvas.requestRenderAll();this.callbacks.selection?.();}finally{this.restoring=false;}}
 clip(){this.canvas.clipPath=this.doc?.crop?new Rect({...this.doc.crop,...base,absolutePositioned:true,fill:'#000',strokeWidth:0}):undefined;}
 commit(){if(!this.doc||this.restoring||this.loading)return;this.renumber();this.doc.state=this.snapshot();this.doc.history.push(this.doc.state);this.doc.dirty=true;this.canvas.requestRenderAll();this.callbacks.change?.();}
 renumber(){this.markers().forEach((o,i)=>{o.getObjects()[1].set({text:String(i+1)});o.dirty=true;});}
 markers(){return this.canvas.getObjects().filter(o=>o.shotKind==='number');}
 async undo(){const s=this.doc?.history.undo();if(s){await this.restore(s);this.doc.state=this.snapshot();this.callbacks.change?.();}}
 async redo(){const s=this.doc?.history.redo();if(s){await this.restore(s);this.doc.state=this.snapshot();this.callbacks.change?.();}}
 setTool(tool){this.cancelDraw();this.tool=tool;this.canvas.discardActiveObject();this.canvas.isDrawingMode=['pencil','highlight'].includes(tool);this.canvas.selection=tool==='select';this.canvas.skipTargetFind=tool!=='select';this.canvas.defaultCursor=tool==='pan'?'grab':tool==='erase'?'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2724%27 height=%2724%27%3E%3Ccircle cx=%2712%27 cy=%2712%27 r=%279%27 fill=%27%23ffffff15%27 stroke=%27%23000%27 stroke-width=%273%27/%3E%3Ccircle cx=%2712%27 cy=%2712%27 r=%279%27 fill=%27none%27 stroke=%27%23ff9b4a%27/%3E%3C/svg%3E") 12 12, crosshair':tool==='select'?'default':'crosshair';this.canvas.getObjects().forEach(o=>o.set({selectable:tool==='select',evented:tool==='select'}));if(this.canvas.isDrawingMode){const b=new PencilBrush(this.canvas);b.color=this.style.color+(tool==='highlight'?'55':'');b.width=tool==='highlight'?this.style.width*5:this.style.width;b.decimate=.6;this.canvas.freeDrawingBrush=b;}this.canvas.requestRenderAll();this.callbacks.tool?.(tool);}
 // Fabric coalesces requestRenderAll into one animation frame. Its automatic
 // viewport redraw is disabled with renderOnAddRemove, so every path opts in here.
 requestViewportRender(){this.viewportPending=true;this.canvas.requestRenderAll();}
 setViewport(viewport){
  if(!Array.isArray(viewport)||viewport.length!==6||!viewport.every(Number.isFinite)||viewport[0]<=0||viewport[3]<=0)return;
  this.canvas.setViewportTransform([...viewport]);this.requestViewportRender();
 }
 fit(){
  if(!this.doc)return;
  const b=this.doc.crop||{left:0,top:0,width:this.doc.width,height:this.doc.height};
  const z=Math.min((this.canvas.width-36)/b.width,(this.canvas.height-36)/b.height,1);
  this.setViewport([z,0,0,z,(this.canvas.width-b.width*z)/2-b.left*z,(this.canvas.height-b.height*z)/2-b.top*z]);
 }
 zoom(factor,point=new Point(this.canvas.width/2,this.canvas.height/2)){
  if(!Number.isFinite(factor)||factor<=0)return;
  this.zoomAt(this.canvas.getZoom()*factor,point);
 }
 zoomAt(value,point=new Point(this.canvas.width/2,this.canvas.height/2)){
  if(!this.doc||!Number.isFinite(value)||value<=0||!Number.isFinite(point.x)||!Number.isFinite(point.y))return;
  this.canvas.zoomToPoint(point,Math.max(.03,Math.min(8,value)));this.requestViewportRender();
 }
 panBy(x,y){
  if(!this.doc||!Number.isFinite(x)||!Number.isFinite(y))return;
  const v=[...this.canvas.viewportTransform];v[4]+=x;v[5]+=y;this.setViewport(v);
 }
 trackpad(e){
  if(!this.doc||this.canvas.getActiveObject()?.isEditing)return;
  e.preventDefault();e.stopPropagation();
  const unit=e.deltaMode===1?16:e.deltaMode===2?this.canvas.height:1,zooming=e.ctrlKey||e.metaKey;
  const r=this.canvas.upperCanvasEl.getBoundingClientRect(),point=new Point(e.clientX-r.left,e.clientY-r.top);
  const dx=Math.max(-240,Math.min(240,e.deltaX*unit)),dy=Math.max(-240,Math.min(240,e.deltaY*unit));
  if(!this.wheelGesture||this.wheelGesture.zooming!==zooming){
   if(this.wheelGesture)this.flushTrackpad();
   this.wheelGesture={zooming,dx:0,dy:0,point};
  }
  const g=this.wheelGesture;g.dx+=dx;g.dy+=dy;g.point=point;
  if(!this.wheelFrame)this.wheelFrame=requestAnimationFrame(()=>{this.wheelFrame=0;this.flushTrackpad();});
 }
 flushTrackpad(){
  const g=this.wheelGesture;if(!g)return;this.wheelGesture=null;
  if(g.zooming){
   const zoomDelta=Math.max(-220,Math.min(220,g.dy));
   this.zoom(Math.exp(-.0015*zoomDelta),g.point);
   const lateral=Math.max(-180,Math.min(180,g.dx));
   if(Math.abs(lateral)>.05)this.panBy(-lateral,0);
  }else{
   const x=Math.max(-360,Math.min(360,g.dx)),y=Math.max(-360,Math.min(360,g.dy));
   this.panBy(-x,-y);
  }
 }

 point(e){const p=e.scenePoint||this.canvas.getScenePoint(e.e);return {x:Math.max(0,Math.min(this.doc.width,p.x)),y:Math.max(0,Math.min(this.doc.height,p.y))};}
 down(e){if(!this.doc||this.loading||this.gesture||e.e.button>0)return;if(this.tool==='select'||this.tool==='erase'||this.canvas.isDrawingMode)return;if(this.tool==='pan'||e.e.altKey){this.pan={x:e.e.clientX,y:e.e.clientY};return;}const p=this.point(e);if(e.e.pointerType==='touch'&&['text','number'].includes(this.tool)){this.touchClick={scenePoint:new Point(p.x,p.y),e:{button:0,pointerType:'deferred-touch'}};return;}if(this.tool==='text'){const text=new Textbox('Escribe aquí',{...base,left:p.x,top:p.y,width:260,fontSize:this.style.fontSize,fontWeight:this.style.bold?'bold':'normal',fill:this.style.color,textAlign:this.style.align,backgroundColor:this.style.fill?'#ffffffd9':'',shotId:crypto.randomUUID(),shotKind:'text'});this.canvas.add(text);this.setTool('select');this.canvas.setActiveObject(text);text.enterEditing();text.selectAll();this.commit();return;}
  if(this.tool==='number'){const group=new Group([new Circle({radius:21,fill:this.style.color,stroke:'#ffffff',strokeWidth:2,originX:'center',originY:'center',left:0,top:0}),new FabricText(String(this.markers().length+1),{fontSize:23,fontWeight:'bold',fill:['#ffffff','#ffe066'].includes(this.style.color)?'#101014':'#fff',originX:'center',originY:'center',left:0,top:0})],{...base,left:p.x-21,top:p.y-21,shotId:crypto.randomUUID(),shotKind:'number'});this.canvas.add(group);this.doc.notes[group.shotId]='';this.commit();this.callbacks.selection?.(group.shotId);return;}
  this.draw={start:p,end:p,tool:this.tool};
 }
 move(e){if(this.gesture)return;if(this.pan){this.panBy(e.e.clientX-this.pan.x,e.e.clientY-this.pan.y);this.pan={x:e.e.clientX,y:e.e.clientY};return;}if(!this.draw||this.gesture)return;this.draw.end=this.point(e);if(this.draw.object)this.canvas.remove(this.draw.object);const o=this.shape(this.draw);this.draw.object=o;this.canvas.add(o);this.canvas.requestRenderAll();}
 shape({start:a,end:b,tool}){const s=this.style,left=Math.min(a.x,b.x),top=Math.min(a.y,b.y),width=Math.max(1,Math.abs(b.x-a.x)),height=Math.max(1,Math.abs(b.y-a.y)),props={...base,left,top,width,height,stroke:s.color,strokeWidth:s.width,fill:s.fill?s.color+'33':'transparent',opacity:s.opacity,selectable:false,evented:false,shotId:crypto.randomUUID(),shotKind:tool};
  if(tool==='arrow'){const angle=Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI;return new Group([new Line([a.x,a.y,b.x,b.y],{stroke:s.color,strokeWidth:s.width,strokeLineCap:'round'}),new Triangle({left:b.x,top:b.y,originX:'center',originY:'center',width:s.head,height:s.head*1.3,angle:angle+90,fill:s.color})],{...base,opacity:s.opacity,selectable:false,evented:false,shotId:props.shotId,shotKind:tool});}
  if(['line','underline'].includes(tool))return new Line([a.x,a.y,b.x,tool==='underline'?a.y:b.y],{...props,left:undefined,top:undefined,strokeLineCap:'round'});
  if(tool==='ellipse')return new Ellipse({...props,rx:width/2,ry:height/2});
  if(['blur','pixelate','redact','magnify','spotlight'].includes(tool))return new Rect({...props,fill:tool==='redact'?'#101014':'#88888833'});
  return new Rect({...props,fill:tool==='crop'?'#ff9b4a22':props.fill,stroke:tool==='crop'?'#ff9b4a':s.color,strokeDashArray:tool==='crop'?[8,5]:undefined});
 }
 up(event){if(this.gesture||event?.e.button>0)return;if(this.touchClick){const click=this.touchClick;this.touchClick=null;this.down(click);return;}if(this.pan){this.pan=null;return;}if(!this.draw)return;const d=this.draw;this.draw=null;if(!d.object||Math.hypot(d.end.x-d.start.x,d.end.y-d.start.y)<4){if(d.object)this.canvas.remove(d.object);return;}if(d.tool==='crop'){if(this.cropBox)this.canvas.remove(this.cropBox);this.cropBox=d.object;this.setTool('select');this.canvas.setActiveObject(this.cropBox);this.callbacks.change?.();return;}
  if(['blur','pixelate','redact','magnify','spotlight'].includes(d.tool)){this.canvas.remove(d.object);const region=new Region({...d.object.toObject(),effect:d.tool,...d.tool==='magnify'?{sourceX:d.object.left,sourceY:d.object.top,sourceWidth:d.object.width,sourceHeight:d.object.height}:{},shotId:d.object.shotId,shotKind:d.tool});this.canvas.add(region);}
  this.commit();
 }
 applyCrop(){if(!this.cropBox)return;const o=this.cropBox;this.doc.crop=clampCrop({left:o.left,top:o.top,width:o.width*o.scaleX,height:o.height*o.scaleY},this.doc.width,this.doc.height);this.canvas.remove(o);this.cropBox=null;this.canvas.discardActiveObject();this.clip();this.commit();this.fit();}
 cancelCrop(){if(this.cropBox)this.canvas.remove(this.cropBox);this.cropBox=null;this.canvas.discardActiveObject();this.canvas.requestRenderAll();this.callbacks.change?.();}
 cancelDraw(){
  if(this.navPointer){this.canvas.isDrawingMode=this.navPointer.wasDrawing;this.canvas.setCursor(this.navPointer.cursor);this.navPointer=null;}
  if(this.erasing){const e=this.erasing;this.erasing=null;for(const o of [...this.canvas.getObjects()])this.canvas.remove(o);for(const o of e.objects)this.canvas.add(o);this.doc.notes={...e.notes};this.renumber();this.canvas.requestRenderAll();this.callbacks.selection?.();}
  if(this.draw?.object)this.canvas.remove(this.draw.object);this.draw=null;this.pan=null;this.touchClick=null;}
 remove(){const objects=this.canvas.getActiveObjects();for(const o of objects){if(o===this.cropBox){this.cancelCrop();continue;}this.canvas.remove(o);delete this.doc.notes[o.shotId];}this.canvas.discardActiveObject();this.commit();}
 async duplicate(){const objects=this.canvas.getActiveObjects();for(const object of objects){if(object===this.cropBox)continue;const clone=await object.clone(['shotId','shotKind']);clone.set({left:object.left+24,top:object.top+24,shotId:crypto.randomUUID()});if(clone.shotKind==='number')this.doc.notes[clone.shotId]=this.doc.notes[object.shotId]||'';this.canvas.add(clone);this.canvas.setActiveObject(clone);}this.commit();}
 select(id){const o=this.canvas.getObjects().find(o=>o.shotId===id);if(o){this.setTool('select');this.canvas.setActiveObject(o);this.canvas.requestRenderAll();this.callbacks.selection?.();}}
 changeStyle(style){Object.assign(this.style,style);const o=this.canvas.getActiveObject();if(o&&o!==this.cropBox&&o.type!=='activeSelection'){
  if(o.shotKind==='text')o.set({fill:this.style.color,fontSize:this.style.fontSize,fontWeight:this.style.bold?'bold':'normal',textAlign:this.style.align,backgroundColor:this.style.fill?'#ffffffd9':''});
  else if(o.shotKind==='number'){o.getObjects()[0].set({fill:this.style.color});o.getObjects()[1].set({fill:['#ffffff','#ffe066'].includes(this.style.color)?'#101014':'#fff'});o.dirty=true;}
  else if(o.shotKind==='arrow'){for(const child of o.getObjects())child.set(child.type.toLowerCase()==='triangle'?{fill:this.style.color,width:this.style.head,height:this.style.head*1.3}:{stroke:this.style.color,strokeWidth:this.style.width});o.dirty=true;}
  else if(!['blur','pixelate','redact','magnify','spotlight'].includes(o.shotKind))o.set({stroke:this.style.color,strokeWidth:this.style.width,fill:this.style.fill?this.style.color+'33':'transparent'});
  o.set({opacity:o.shotKind==='redact'?1:this.style.opacity});o.setCoords();this.commit();
 }if(this.canvas.isDrawingMode){this.canvas.freeDrawingBrush.color=this.style.color+(this.tool==='highlight'?'55':'');this.canvas.freeDrawingBrush.width=this.tool==='highlight'?this.style.width*5:this.style.width;}}
 pointerTools(){
  const el=this.canvas.upperCanvasEl;
  document.addEventListener('pointerdown',e=>{
   if(e.target!==el||e.button!==0||!this.doc||this.loading||this.gesture||this.canvas.getActiveObject()?.isEditing)return;
   if((e.ctrlKey||e.metaKey)&&e.pointerType!=='touch'){
    e.preventDefault();e.stopImmediatePropagation();this.cancelDraw();
    this.navPointer={id:e.pointerId,x:e.clientX,y:e.clientY,wasDrawing:this.canvas.isDrawingMode,cursor:el.style.cursor};
    this.canvas.isDrawingMode=false;this.canvas.setCursor('grabbing');
   }else if(this.tool==='erase'){
    e.preventDefault();e.stopImmediatePropagation();if(this.erasing)return;
    this.erasing={id:e.pointerId,objects:[...this.canvas.getObjects()],notes:{...this.doc.notes},changed:false,last:null};
    this.eraseAt(e);
   }
  },{capture:true,passive:false});
  document.addEventListener('pointermove',e=>{
   if(this.navPointer?.id===e.pointerId){
    e.preventDefault();e.stopImmediatePropagation();const p=this.navPointer;
    this.panBy(e.clientX-p.x,e.clientY-p.y);p.x=e.clientX;p.y=e.clientY;
   }else if(this.erasing?.id===e.pointerId&&!this.gesture){e.preventDefault();e.stopImmediatePropagation();this.eraseAt(e);}
  },{capture:true,passive:false});
  const finish=e=>{
   if(this.navPointer?.id===e.pointerId){this.canvas.isDrawingMode=this.navPointer.wasDrawing;this.canvas.setCursor(this.navPointer.cursor);this.navPointer=null;}
   if(this.erasing?.id!==e.pointerId)return;
   if(e.type==='pointercancel'){this.cancelDraw();return;}
   this.eraseAt(e);const changed=this.erasing.changed;this.erasing=null;if(changed)this.commit();
  };
  document.addEventListener('pointerup',finish,true);document.addEventListener('pointercancel',finish,true);
  window.addEventListener('blur',()=>{this.cancelDraw();this.canvas.requestRenderAll();});
 }
 eraseAt(event){
  const stroke=this.erasing;if(!stroke)return;
  const r=this.canvas.upperCanvasEl.getBoundingClientRect(),end={x:event.clientX-r.left,y:event.clientY-r.top},start=stroke.last||end;
  let removed=false;
  const steps=Math.max(1,Math.ceil(Math.hypot(end.x-start.x,end.y-start.y)/8)),radius=8,c=this.canvas,previousTolerance=c.targetFindTolerance;
  c.setTargetFindTolerance(radius);
  try{
   for(let i=1;i<=steps;i++){
    const x=start.x+(end.x-start.x)*i/steps,y=start.y+(end.y-start.y)*i/steps,v=c.viewportTransform;
    if(x<0||y<0||x>=c.width||y>=c.height)continue;
    const crop=this.doc.crop,sx=(x-v[4])/v[0],sy=(y-v[5])/v[3];
    if(crop&&(sx<crop.left||sy<crop.top||sx>crop.left+crop.width||sy>crop.top+crop.height))continue;
    for(const object of [...c.getObjects()].reverse()){
     if(object===this.cropBox)continue;
     const b=object.getBoundingRect(),left=b.left*v[0]+v[4],top=b.top*v[3]+v[5];
     if(x<left-radius||x>left+b.width*v[0]+radius||y<top-radius||y>top+b.height*v[3]+radius)continue;
     // Fabric pixel testing preserves hollow shapes and spaces between strokes.
     if(object.shotKind!=='spotlight'&&c.isTargetTransparent(object,x,y))continue;
     c.remove(object);delete this.doc.notes[object.shotId];stroke.changed=true;removed=true;
    }
   }
  }finally{c.setTargetFindTolerance(previousTolerance);}
  stroke.last=end;if(removed){this.renumber();c.requestRenderAll();this.callbacks.selection?.();}
 }
 mouseShortcuts(){
  const el=this.canvas.upperCanvasEl;
  const allowed=()=>this.doc&&!this.loading&&!this.gesture&&!this.canvas.getActiveObject()?.isEditing&&!document.activeElement?.matches('input,textarea,select,[contenteditable=true]');
  el.addEventListener('pointerdown',e=>{
   this.mouseContextSuppressed=false;
   if(e.pointerType!=='mouse'||e.button!==2||!allowed())return;
   e.preventDefault();e.stopImmediatePropagation();this.mouseContextSuppressed=true;
   if(this.rightHeld)return;this.rightHeld=true;
   if(e.ctrlKey||e.metaKey)this.callbacks.copyImage?.();
   else this.undo().catch(error=>this.callbacks.error?.(error));
  },true);
  document.addEventListener('pointerup',e=>{if(e.button===2)this.rightHeld=false;},true);
  document.addEventListener('pointercancel',()=>{this.rightHeld=false;},true);
  el.addEventListener('contextmenu',e=>{
   if(e.button===2&&e.pointerType!=='touch'&&this.mouseContextSuppressed&&allowed())e.preventDefault();
  },true);
 }
 // Fabric 7.4 installs pointerup handlers for drags, but not pointercancel.
 // Revert an interrupted transform and let its up handler release those listeners.
 cancelTouchInteraction(e){
  this.cancelDraw();this.canvas.isDrawingMode=false;this.canvas._isCurrentlyDrawing=false;
  this.canvas.clearContext(this.canvas.contextTop);
  const transform=this.canvas._currentTransform;
  if(transform){transform.target.set(transform.original);transform.target.setCoords();transform.actionPerformed=false;this.canvas.endCurrentTransform(e);}
  this.canvas.requestRenderAll();
 }
 touch(){
  const pointers=new Map(),el=this.canvas.upperCanvasEl;let start;
  const position=e=>({x:e.clientX,y:e.clientY});
  // Listen in document capture: Fabric moves its own pointer handlers from the
  // canvas to document during a drag. Only pointers started on this canvas count.
  document.addEventListener('pointerdown',e=>{
   if(e.pointerType!=='touch'||e.target!==el||!this.doc)return;
   pointers.set(e.pointerId,position(e));
   if(pointers.size<2)return;
   e.preventDefault();e.stopImmediatePropagation();
   if(this.gesture)return;
   this.gesture=true;this.cancelTouchInteraction(e);
   const [a,b]=[...pointers.values()];
   start={distance:Math.max(1,Math.hypot(b.x-a.x,b.y-a.y)),x:(a.x+b.x)/2,y:(a.y+b.y)/2,zoom:this.canvas.getZoom(),viewport:[...this.canvas.viewportTransform]};
  },{capture:true,passive:false});
  document.addEventListener('pointermove',e=>{
   if(!pointers.has(e.pointerId))return;
   pointers.set(e.pointerId,position(e));
   if(!this.gesture)return;
   e.preventDefault();e.stopImmediatePropagation();
   if(pointers.size<2||!start)return;
   const [a,b]=[...pointers.values()],distance=Math.hypot(b.x-a.x,b.y-a.y),rect=el.getBoundingClientRect();
   this.canvas.setViewportTransform([...start.viewport]);
   this.canvas.zoomToPoint(new Point(start.x-rect.left,start.y-rect.top),Math.max(.03,Math.min(8,start.zoom*distance/start.distance)));
   const v=[...this.canvas.viewportTransform];v[4]+=(a.x+b.x)/2-start.x;v[5]+=(a.y+b.y)/2-start.y;
   this.setViewport(v);
  },{capture:true,passive:false});
  const finish=e=>{
   if(!pointers.has(e.pointerId))return;
   pointers.delete(e.pointerId);
   if(e.type==='pointercancel'){this.cancelTouchInteraction(e);this.canvas._onMouseUp(e);if(!this.gesture)queueMicrotask(()=>this.setTool(this.tool));}
   if(!this.gesture||pointers.size)return;
   // Let Fabric receive the final up/cancel and detach its drag listeners first.
   queueMicrotask(()=>{this.gesture=false;start=null;this.setTool(this.tool);});
  };
  document.addEventListener('pointerup',finish,true);
  document.addEventListener('pointercancel',finish,true);
 }
}
