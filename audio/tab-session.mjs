// A duplicated tab may inherit sessionStorage. Probe live peers before cleaning its scope.
export async function openTabSession(){
  const key='reynoso-audio-lab-session',instance=crypto.randomUUID();let scope=instance;
  try{scope=sessionStorage.getItem(key)||scope;}catch{}
  let channel;
  if(typeof BroadcastChannel==='function'){
    channel=new BroadcastChannel('reynoso-audio-lab-tabs-v1');
    channel.onmessage=({data})=>{
      if(data?.kind==='probe'&&data.scope===scope&&data.instance!==instance)channel.postMessage({kind:'in-use',scope,target:data.instance});
      if(data?.kind==='in-use'&&data.target===instance&&data.scope===scope)scope=instance;
    };
    channel.postMessage({kind:'probe',scope,instance});await new Promise(resolve=>setTimeout(resolve,150));
  }else{
    // No reliable live-tab probe: don't reuse/clean a possibly inherited scope.
    scope=instance;
  }
  try{sessionStorage.setItem(key,scope);}catch{}
  return {scope,close:()=>channel?.close()};
}
