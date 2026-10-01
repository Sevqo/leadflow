import {adminClient,requireSecret} from '../_shared/supabase.ts'

const headers=(origin:string)=>({'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'content-type','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Content-Type':'application/json','Vary':'Origin'})
const response=(origin:string,body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:headers(origin)})
const hex=(bytes:ArrayBuffer)=>[...new Uint8Array(bytes)].map(value=>value.toString(16).padStart(2,'0')).join('')
Deno.serve(async request=>{
  const origin=request.headers.get('origin')??''
  if(request.method==='OPTIONS')return new Response(null,{headers:headers(origin)})
  if(!['GET','POST'].includes(request.method))return response(origin,{error:'Method not allowed'},405)
  try{
    const admin=adminClient()
    if(request.method==='GET'){
      const widgetKey=new URL(request.url).searchParams.get('widgetKey')
      if(!widgetKey)return response(origin,{error:'Widget key is required.'},400)
      const {data:config}=await admin.from('widget_configs').select('brand_name,welcome_message,primary_color,allowed_origins').eq('public_key',widgetKey).eq('enabled',true).single()
      if(!config||!config.allowed_origins.includes(origin))return response(origin,{error:'Widget origin is not allowed.'},403)
      return response(origin,{brandName:config.brand_name,welcomeMessage:config.welcome_message,primaryColor:config.primary_color})
    }
    const body=await request.json() as {widgetKey?:string;name?:string;email?:string;message?:string;website?:string}
    if(body.website)return response(origin,{received:true})
    if(!body.widgetKey||!body.name?.trim()||!/^\S+@\S+\.\S+$/.test(body.email??'')||!body.message?.trim())return response(origin,{error:'Complete the required fields.'},400)
    const {data:config}=await admin.from('widget_configs').select('*').eq('public_key',body.widgetKey).eq('enabled',true).single()
    if(!config||!config.allowed_origins.includes(origin))return response(origin,{error:'Widget origin is not allowed.'},403)
    const email=body.email!.trim().toLowerCase(),name=body.name.trim(),message=body.message.trim().slice(0,3000)
    const ip=request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()??'unknown',secret=Deno.env.get('INQUIRY_HASH_SECRET')??requireSecret('SUPABASE_SERVICE_ROLE_KEY'),ipHash=hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`${secret}:${ip}`))),since=new Date(Date.now()-3600000).toISOString()
    const {count}=await admin.from('website_inquiries').select('id',{count:'exact',head:true}).eq('ip_hash',ipHash).gte('created_at',since)
    if((count??0)>=5)return response(origin,{error:'Too many requests. Please try again later.'},429)
    await admin.from('website_inquiries').insert({inquiry_type:'DEMO',name,email,interest:'Website widget',message,ip_hash:ipHash,user_agent:request.headers.get('user-agent')?.slice(0,500)??null})
    let {data:contact}=await admin.from('contacts').select('*').eq('organization_id',config.organization_id).eq('email',email).maybeSingle()
    if(!contact){const result=await admin.from('contacts').insert({organization_id:config.organization_id,name,email,tags:['Website widget']}).select().single();if(result.error)throw result.error;contact=result.data}
    let {data:lead}=await admin.from('leads').select('*').eq('organization_id',config.organization_id).eq('contact_id',contact.id).is('archived_at',null).maybeSingle()
    if(!lead){const result=await admin.from('leads').insert({organization_id:config.organization_id,contact_id:contact.id,interest:message.slice(0,240),source:'Website widget',stage:'NEW',score:35,next_action:'Review widget enquiry'}).select().single();if(result.error)throw result.error;lead=result.data}
    const {data:conversation,error:conversationError}=await admin.from('conversations').insert({organization_id:config.organization_id,contact_id:contact.id,channel:'WEBSITE',status:'OPEN',handling_mode:'AI',last_message_at:new Date().toISOString()}).select().single();if(conversationError)throw conversationError
    await admin.from('messages').insert({organization_id:config.organization_id,conversation_id:conversation.id,sender_type:'CUSTOMER',body:message})
    let reply='Thanks — your enquiry was received. Our team will follow up.'
    const apiKey=Deno.env.get('OPENAI_API_KEY')
    const [{data:aiConfig},{data:knowledge}]=await Promise.all([admin.from('ai_configs').select('*').eq('organization_id',config.organization_id).maybeSingle(),admin.from('knowledge_items').select('title,content').eq('organization_id',config.organization_id).eq('status','ACTIVE').limit(8)])
    if(apiKey&&aiConfig?.enabled){
      const provider=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},body:JSON.stringify({model:Deno.env.get('OPENAI_MODEL')??'gpt-4o-mini',input:[{role:'system',content:`You are ${aiConfig.assistant_name}. ${aiConfig.role_description}. Use only the approved knowledge below. Never promise prices, availability, or privileged actions not in the content. Ask one concise qualification question when useful.\n\n${(knowledge??[]).map(item=>`${item.title}: ${item.content}`).join('\n').slice(0,12000)}`},{role:'user',content:message}],max_output_tokens:220})})
      if(provider.ok){const payload=await provider.json() as {output?:Array<{content?:Array<{type?:string;text?:string}>}>};reply=payload.output?.flatMap(item=>item.content??[]).find(item=>item.type==='output_text')?.text?.trim()||reply}
    }
    await admin.from('messages').insert({organization_id:config.organization_id,conversation_id:conversation.id,sender_type:'AI',body:reply})
    await admin.from('conversations').update({last_message_at:new Date().toISOString()}).eq('id',conversation.id)
    await admin.from('analytics_events').insert({organization_id:config.organization_id,event_name:'conversation_started',entity_type:'conversation',entity_id:conversation.id,properties:{channel:'WEBSITE_WIDGET',lead_id:lead.id}})
    return response(origin,{received:true,reply},201)
  }catch{return response(origin,{error:'Unable to save your enquiry.'},500)}
})
