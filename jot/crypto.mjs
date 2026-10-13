const encoder=new TextEncoder(),decoder=new TextDecoder();
const ITERATIONS=220000;
const b64=bytes=>{let s='';for(const b of bytes)s+=String.fromCharCode(b);return btoa(s)};
const unb64=value=>{const s=atob(value),out=new Uint8Array(s.length);for(let i=0;i<s.length;i++)out[i]=s.charCodeAt(i);return out};

export async function deriveKey(password,salt){
  const material=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2',salt:typeof salt==='string'?unb64(salt):salt,iterations:ITERATIONS,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}

export async function seal(key,value){
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const plain=encoder.encode(JSON.stringify(value));
  const data=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,plain));
  return {iv:b64(iv),data:b64(data)};
}

export async function open(key,packet){
  const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(packet.iv)},key,unb64(packet.data));
  return JSON.parse(decoder.decode(plain));
}

export async function createVaultMeta(username,password){
  const salt=crypto.getRandomValues(new Uint8Array(16));
  const key=await deriveKey(password,salt);
  const verifier=await seal(key,{ok:'reynoso-jot-v1'});
  return {meta:{version:1,username:String(username).trim(),salt:b64(salt),verifier,createdAt:Date.now()},key};
}

export async function unlockVault(meta,username,password){
  if(!meta||String(username).trim()!==meta.username)throw new Error('Usuario o contraseña incorrectos.');
  const key=await deriveKey(password,meta.salt);
  try{const proof=await open(key,meta.verifier);if(proof?.ok!=='reynoso-jot-v1')throw new Error();}
  catch{throw new Error('Usuario o contraseña incorrectos.');}
  return key;
}
