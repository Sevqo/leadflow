import {errorResponse,json,readJson} from '../_shared/http.ts'
import {adminClient,requireSecret,requireUser} from '../_shared/supabase.ts'

type GraphResponse={messages?:Array<{id?:string}>;error?:{message?:string}}

Deno.serve(async request=>{
  if(request.method==='OPTIONS')return new Response('ok',{headers:{'Access-Control-Allow-Origin':Deno.env.get('APP_ORIGIN')??'http://localhost:5173','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'}})
  if(request.method!=='POST')return json({error:'Method not allowed.'},405,{Allow:'POST'})
  try{
    const {client,user}=await requireUser(request)
    const {conversationId,text}=await readJson<{conversationId?:string;text?:string}>(request,16_000)
    if(!conversationId||!/^[0-9a-f-]{36}$/i.test(conversationId))throw new Error('A valid conversationId is required.')
    const body=text?.trim()
    if(!body||body.length>8000)throw new Error('Message text must contain between 1 and 8,000 characters.')
    const {data:conversation,error:conversationError}=await client.from('conversations').select('id,organization_id,contact_id,channel').eq('id',conversationId).single()
    if(conversationError||!conversation)throw new Error('Conversation not found or access denied.')
    if(conversation.channel!=='WHATSAPP'||!conversation.contact_id)throw new Error('This conversation is not connected to WhatsApp.')
    const [{data:contact,error:contactError},{data:integration,error:integrationError}]=await Promise.all([
      client.from('contacts').select('phone').eq('id',conversation.contact_id).eq('organization_id',conversation.organization_id).single(),
      client.from('integrations').select('public_config,status').eq('organization_id',conversation.organization_id).eq('provider','WHATSAPP').single(),
    ])
    if(contactError||!contact?.phone)throw new Error('The contact has no WhatsApp phone number.')
    if(integrationError||integration?.status!=='CONNECTED')throw new Error('WhatsApp is not connected for this workspace.')
    const phoneNumberId=String((integration.public_config as Record<string,unknown>)?.phone_number_id??'')
    if(!/^\d+$/.test(phoneNumberId))throw new Error('WhatsApp phone number configuration is invalid.')
    const recipient=contact.phone.replace(/\D/g,'')
    if(!/^\d{7,20}$/.test(recipient))throw new Error('The contact phone number is invalid.')
    const apiVersion=requireSecret('WHATSAPP_GRAPH_API_VERSION')
    const graph=await fetch(`https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,{method:'POST',headers:{Authorization:`Bearer ${requireSecret('WHATSAPP_ACCESS_TOKEN')}`,'Content-Type':'application/json'},body:JSON.stringify({messaging_product:'whatsapp',recipient_type:'individual',to:recipient,type:'text',text:{preview_url:false,body}})})
    const result=await graph.json() as GraphResponse
    if(!graph.ok)throw new Error(`WhatsApp delivery failed (${graph.status}): ${result.error?.message??'provider rejected the message'}`)
    const externalId=result.messages?.[0]?.id
    if(!externalId)throw new Error('WhatsApp accepted the request without a message ID.')
    const sentAt=new Date().toISOString()
    const admin=adminClient()
    const {data:message,error:messageError}=await admin.from('messages').insert({organization_id:conversation.organization_id,conversation_id:conversation.id,sender_type:'HUMAN',sender_id:user.id,body,external_id:externalId,created_at:sentAt}).select().single()
    if(messageError)throw new Error('Message was sent but could not be added to conversation history.')
    await Promise.all([
      client.from('conversations').update({last_message_at:sentAt,updated_at:sentAt,assigned_to:user.id,status:'OPEN',handling_mode:'HUMAN'}).eq('id',conversation.id).eq('organization_id',conversation.organization_id),
      admin.from('audit_events').insert({organization_id:conversation.organization_id,actor_id:user.id,event_type:'whatsapp_message_sent',entity_type:'conversation',entity_id:conversation.id,metadata:{message_id:message.id,external_id:externalId}}),
    ])
    return json({message})
  }catch(reason){return errorResponse(reason,'Unable to send the WhatsApp message.')}
})
