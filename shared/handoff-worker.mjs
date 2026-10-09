// Materialize an OPFS-backed snapshot before acknowledging the sender. A structured
// clone alone becomes unreadable if Audio Lab deletes its backing temporary file.
const PREFIX='reynoso-transcribe-handoff-';
onmessage=async({data})=>{let sync=null,root=null,name=null;try{
  const file=data.file,parts=[];let written=0;
  if(navigator.storage?.getDirectory){const quota=await navigator.storage.estimate().catch(()=>({}));if(quota.quota&&file.size>quota.quota-(quota.usage||0))throw new Error('No hay espacio temporal para recibir el WAV. Descárgalo desde Audio Lab.');
    try{root=await navigator.storage.getDirectory();name=PREFIX+crypto.randomUUID()+'.wav';const handle=await root.getFileHandle(name,{create:true});sync=await handle.createSyncAccessHandle();}
    catch(error){try{sync?.close();if(name)await root?.removeEntry(name);}catch{}sync=null;name=null;if(error.name==='QuotaExceededError')throw error;}
  }
  if(!sync&&file.size>160*1024*1024)throw new Error('Sin almacenamiento temporal, la transferencia admite hasta 160 MB. Descarga el WAV y selecciónalo directamente.');
  for(let at=0;at<file.size;at+=2*1024*1024){const bytes=new Uint8Array(await file.slice(at,at+2*1024*1024).arrayBuffer());if(sync){const count=sync.write(bytes,{at});if(count!==bytes.length)throw new Error('Copia temporal incompleta.');}else parts.push(bytes);written+=bytes.length;postMessage({type:'progress',percent:written/file.size*100});}
  let blob;if(sync){sync.flush();sync.close();sync=null;blob=await(await root.getFileHandle(name)).getFile();}else blob=new Blob(parts,{type:'audio/wav'});
  postMessage({type:'ready',blob,tempName:name});
}catch(error){try{sync?.close();if(root&&name)await root.removeEntry(name);}catch{}postMessage({type:'error',message:error.message});}};
