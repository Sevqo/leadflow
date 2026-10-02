import {errorResponse,json} from '../_shared/http.ts'
import {adminClient,requireSecret} from '../_shared/supabase.ts'

const hex=(bytes:ArrayBuffer)=>Array.from(new Uint8Array(bytes)).map(value=>value.toString(16).padStart(2,'0')).join('')
const safeEqual=(a:string,b:string)=>{if(a.length!==b.length)return false;let mismatch=0;for(let index=0;index<a.length;index++)mismatch|=a.charCodeAt(index)^b.charCodeAt(index);return mismatch===0}
Deno.serve(async request=>{
  if(request.method!=='POST')return json({error:'Method not allowed.'},405)
  try{
    const raw=await request.text(),signature=(request.headers.get('x-leadflow-signature')??'').replace(/^sha256=/,'')
    const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(requireSecret('OUTBOUND_WEBHOOK_SECRET')),{name:'HMAC',hash:'SHA-256'},false,['sign'])
    const expected=hex(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(raw)))
    if(!safeEqual(signature,expected))return json({error:'Invalid signature.'},401)
    const body=JSON.parse(raw) as {workspaceId:string;provider:string;eventId:string;eventType:string;messageId?:string;email?:string;occurredAt?:string;data?:Record<string,unknown>}
    if(!body.workspaceId||!body.provider||!body.eventId||!body.eventType)throw new Error('Webhook identity fields are required.')
    const admin=adminClient(),type=body.eventType.toUpperCase(),now=body.occurredAt??new Date().toISOString()
    const inserted=await admin.from('outbound_provider_events').insert({organization_id:body.workspaceId,capability:type==='MEETING_BOOKED'?'CALENDAR':'MAILBOX',provider_name:body.provider,external_id:body.eventId,event_type:type,payload:body.data??{}})
    if(inserted.error?.code==='23505')return json({accepted:true,duplicate:true})
    if(inserted.error)throw inserted.error
    if(body.messageId){
      const status=({DELIVERED:'DELIVERED',REPLIED:'REPLIED',BOUNCED:'BOUNCED',COMPLAINED:'COMPLAINED',UNSUBSCRIBED:'UNSUBSCRIBED'} as Record<string,string>)[type]
      if(status)await admin.from('outbound_message_deliveries').update({status,...(type==='DELIVERED'?{delivered_at:now}:{}),...(type==='REPLIED'?{replied_at:now}:{}),...(type==='BOUNCED'?{bounced_at:now}:{})}).eq('organization_id',body.workspaceId).eq('provider_message_id',body.messageId)
    }
    if(body.email&&['BOUNCED','COMPLAINED','UNSUBSCRIBED'].includes(type))await admin.from('outbound_suppressions').upsert({organization_id:body.workspaceId,email:body.email.trim().toLowerCase(),reason:type==='COMPLAINED'?'COMPLAINT':type==='UNSUBSCRIBED'?'UNSUBSCRIBED':'BOUNCED',source:body.provider},{onConflict:'organization_id,email'})
    return json({accepted:true})
  }catch(reason){return errorResponse(reason,'Unable to process outbound provider event.')}
})
