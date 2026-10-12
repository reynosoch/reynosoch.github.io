import {Rect,FabricImage,classRegistry,filters,Canvas2dFilterBackend,setFilterBackend} from '../vendor/fabric-7.4.0.mjs';
setFilterBackend(new Canvas2dFilterBackend());
export class Region extends Rect {
  static type='ShotRegion';
  constructor(options={}){super({...options,fill:'transparent',strokeWidth:0,objectCaching:false,lockRotation:true,lockScalingFlip:true});this.effect=options.effect||'redact';this.shotKind=this.effect;if(this.effect==='redact')this.opacity=1;for(const key of ['sourceX','sourceY','sourceWidth','sourceHeight'])this[key]=options[key];}
  toObject(properties=[]){return {...super.toObject([...properties,'effect','sourceX','sourceY','sourceWidth','sourceHeight']),effect:this.effect};}
  _render(ctx){
    const image=this.canvas?.backgroundImage?.getElement();if(!image)return;
    const w=this.width,h=this.height,x=Math.max(0,this.effect==='magnify'?this.sourceX??this.left:this.left),y=Math.max(0,this.effect==='magnify'?this.sourceY??this.top:this.top),sw=Math.min(this.effect==='magnify'?this.sourceWidth??w:w*Math.abs(this.scaleX),image.naturalWidth-x),sh=Math.min(this.effect==='magnify'?this.sourceHeight??h:h*Math.abs(this.scaleY),image.naturalHeight-y);if(sw<=0||sh<=0)return;
    const privacy=this.effect==='magnify'?this.canvas.getObjects().filter(o=>['blur','pixelate','redact'].includes(o.shotKind)):[];const key=[x,y,w,h,this.scaleX,this.scaleY,this.effect,JSON.stringify(privacy.map(o=>[o.left,o.top,o.width,o.height,o.scaleX,o.scaleY,o.opacity,o.effect]))].join(',');
    if(this.effect==='spotlight'){
      const left=-x/this.scaleX-w/2,top=-y/this.scaleY-h/2;ctx.fillStyle='#0009';ctx.beginPath();ctx.rect(left,top,image.naturalWidth/this.scaleX,image.naturalHeight/this.scaleY);ctx.rect(-w/2,-h/2,w,h);ctx.fill('evenodd');return;
    }
    if(this.effect==='redact'){ctx.fillStyle='#101014';ctx.fillRect(-w/2,-h/2,w,h);return;}
    if(this._cacheKey!==key){
      const c=document.createElement('canvas');c.width=Math.ceil(sw);c.height=Math.ceil(sh);const cc=c.getContext('2d');cc.drawImage(image,x,y,sw,sh,0,0,c.width,c.height);if(this.effect==='magnify'){cc.save();cc.translate(-x,-y);for(const region of privacy)region.render(cc);cc.restore();}
      if(this.effect==='blur'){const img=new FabricImage(c);img.filters=[new filters.Blur({blur:.65})];img.applyFilters();this._pixels=img.getElement();}
      else if(this.effect==='pixelate'){const small=document.createElement('canvas');small.width=Math.max(1,Math.ceil(sw/16));small.height=Math.max(1,Math.ceil(sh/16));small.getContext('2d').drawImage(c,0,0,small.width,small.height);cc.imageSmoothingEnabled=false;cc.clearRect(0,0,c.width,c.height);cc.drawImage(small,0,0,c.width,c.height);this._pixels=c;}
      else this._pixels=c;
      this._cacheKey=key;
    }
    if(this.effect==='magnify'){ctx.save();ctx.beginPath();ctx.arc(0,0,Math.min(w,h)/2,0,Math.PI*2);ctx.clip();ctx.drawImage(this._pixels,-w,-h,w*2,h*2);ctx.restore();ctx.strokeStyle='#ff9b4a';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,Math.min(w,h)/2,0,Math.PI*2);ctx.stroke();}
    else ctx.drawImage(this._pixels,-w/2,-h/2,w,h);
  }
}
classRegistry.setClass(Region);
