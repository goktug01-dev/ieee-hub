import { deliveryId, fingerprint, millis, openSource, roleKeys } from '../mail/core.mjs';

export function safeEndpoint(value) {
  try { const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password&&!url.port
    && ['fcm.googleapis.com','updates.push.services.mozilla.com','web.push.apple.com'].includes(url.hostname); } catch {return false;}
}
export function pushEligible(kind,source,uid,access,device,now=Date.now()) {
  if(!openSource(kind,source)||!device?.[kind==='petition'?'petitions':'tasks']||!safeEndpoint(device.endpoint))return false;
  if(kind==='task')return source.assigneeUid===uid;
  return source.ownerUid!==uid&&roleKeys(source).some(key=>millis(access?.roleKeys?.[key])>now)
    &&(source.visibleTo??[]).some(token=>(access?.tokens??[]).includes(token));
}
export async function processPush({store,send,publicKey,dryRun=true,now=()=>Date.now()}) {
  const summary={mode:dryRun?'dry-run':'live',result:'ok',sent:0,skipped:0,uncertain:0,errorCode:''};
  try {
    const settings=await store.settings(),config=await store.pushConfig();
    if(!settings?.enabled||!config?.enabled){summary.result='disabled';return summary;}
    if(config.publicKey!==publicKey)throw new Error('key-mismatch');
    let attempts=0;
    for(const signal of await store.signals(settings.maxPerRun)) {
      const source=await store.source(signal);
      if(!openSource(signal.kind,source)){summary.skipped++;if(!dryRun)await store.finishSignal(signal,'processed');continue;}
      const key=fingerprint(signal.kind,signal.sourceId,source);
      let pending=false,blocked=false;
      const candidates=await store.candidates(signal.kind,source);
      if(!candidates.length&&now()-millis(signal.queuedAt)<86400000)pending=true;
      for(const candidate of candidates) {
        const devices=await store.pushDevices(candidate.uid);
        if(!devices.length&&now()-millis(signal.queuedAt)<86400000)pending=true;
        for(const device of devices) {
          if(attempts>=settings.maxPerRun){pending=true;break;}
          const current=await store.source(signal), cfg=await store.pushConfig();
          if(!cfg?.enabled||cfg.publicKey!==publicKey)throw new Error('settings-changed');
          if(!openSource(signal.kind,current)||fingerprint(signal.kind,signal.sourceId,current)!==key){pending=true;break;}
          const actual=await store.pushDevice(candidate.uid,device.id);
          const access=signal.kind==='petition'?await store.pushAccess(candidate.uid):null;
          if(actual?.publicKey!==publicKey||!pushEligible(signal.kind,current,candidate.uid,access,actual,now())){summary.skipped++;continue;}
          const id=deliveryId(`${key}:${device.id}`,candidate.uid), previous=await store.delivery(id);
          if(previous?.state==='sent'||previous?.state==='skipped'){summary.skipped++;continue;}
          if(['sending','uncertain'].includes(previous?.state)){blocked=true;summary.uncertain++;continue;}
          if(previous&&millis(previous.nextAttemptAt)>now()){pending=true;continue;}
          if(dryRun){summary.skipped++;continue;}
          const claim=await store.claim(id,{signalId:signal.id,recipientUid:candidate.uid,fingerprint:`${key}:${device.id}`},{...settings,publicKey},now());
          if(!claim){pending=true;continue;}
          attempts++;
          try {
            // Kilit ekranına kişi adı, görev/dilekçe başlığı veya içerik gönderilmez.
            await send(actual,JSON.stringify({kind:signal.kind,tag:id}));
            await store.record(id,{...claim,state:'sent',errorCode:''});summary.sent++;
          } catch(error) {
            const status=Number(error?.statusCode);
            if([400,401,403,404,410].includes(status)) {
              await store.record(id,{...claim,state:'skipped',errorCode:'push-rejected'});summary.skipped++;
            } else if(status===429||status>=500) {
              await store.record(id,{...claim,state:'failed',errorCode:'push-temporary',nextAttemptAt:now()+1800000});pending=true;
            } else {
              await store.record(id,{...claim,state:'uncertain',errorCode:'push-uncertain'});summary.uncertain++;blocked=true;
            }
          }
        }
      }
      if(!dryRun)await store.finishSignal(signal,pending?'pending':blocked?'blocked':'processed',now()+1800000);
    }
  }catch{summary.result='error';summary.errorCode='push-worker-failed';}
  finally{await store.health(summary);}
  return summary;
}
