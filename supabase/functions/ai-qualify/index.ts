import {errorResponse,json,readJson} from '../_shared/http.ts'
import {adminClient,requireSecret,requireUser} from '../_shared/supabase.ts'

type Qualification={summary:string;score:number;scoreReasons:string[];answers:Record<string,string>;nextAction:'FOLLOW_UP'|'HUMAN_HANDOFF'|'ASK_QUESTION'|'NONE'}
type OpenAIResponse={output?:Array<{content?:Array<{type?:string;text?:string}>}>}

const schema={
  type:'object',additionalProperties:false,
  properties:{
    summary:{type:'string'},score:{type:'integer',minimum:0,maximum:100},scoreReasons:{type:'array',items:{type:'string'}},
    answers:{type:'object',additionalProperties:false,properties:{interest:{type:'string'},budget:{type:'string'},location:{type:'string'},timeline:{type:'string'}},required:['interest','budget','location','timeline']},nextAction:{type:'string',enum:['FOLLOW_UP','HUMAN_HANDOFF','ASK_QUESTION','NONE']},
  },
  required:['summary','score','scoreReasons','answers','nextAction'],
}

function outputText(response:OpenAIResponse){
  for(const item of response.output??[])for(const content of item.content??[])if(content.type==='output_text'&&content.text)return content.text
  throw new Error('AI provider returned no structured output.')
}

Deno.serve(async request=>{
  if(request.method==='OPTIONS')return new Response('ok',{headers:{'Access-Control-Allow-Origin':Deno.env.get('APP_ORIGIN')??'http://localhost:5173','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'}})
  if(request.method!=='POST')return json({error:'Method not allowed.'},405,{Allow:'POST'})
  try{
    const {client,user}=await requireUser(request)
    const {conversationId}=await readJson<{conversationId?:string}>(request)
    if(!conversationId||!/^[0-9a-f-]{36}$/i.test(conversationId))throw new Error('A valid conversationId is required.')
    const {data:conversation,error:conversationError}=await client.from('conversations').select('id,organization_id,contact_id').eq('id',conversationId).single()
    if(conversationError||!conversation)throw new Error('Conversation not found or access denied.')
    const [{data:messages,error:messageError},{data:config}]=await Promise.all([
      client.from('messages').select('sender_type,body,created_at').eq('conversation_id',conversationId).eq('is_internal_note',false).order('created_at',{ascending:true}).limit(40),
      client.from('ai_configs').select('custom_instructions,qualification_fields').eq('organization_id',conversation.organization_id).maybeSingle(),
    ])
    if(messageError)throw new Error('Unable to load conversation messages.')
    if(!messages?.length)throw new Error('Conversation has no messages to qualify.')

    const transcript=messages.map(message=>`${message.sender_type}: ${message.body}`).join('\n').slice(-24_000)
    const providerResponse=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${requireSecret('OPENAI_API_KEY')}`,'Content-Type':'application/json'},body:JSON.stringify({
      model:Deno.env.get('OPENAI_MODEL')??'gpt-4o-mini',
      input:[
        {role:'system',content:config?.custom_instructions||'Qualify this sales conversation. Use only facts present in the transcript. If information is missing, leave the answer empty and recommend ASK_QUESTION.'},
        {role:'user',content:`Qualification fields: ${JSON.stringify(config?.qualification_fields??['interest','budget','location','timeline'])}\n\nConversation:\n${transcript}`},
      ],
      text:{format:{type:'json_schema',name:'lead_qualification',strict:true,schema}},max_output_tokens:800,
    })})
    if(!providerResponse.ok)throw new Error(`AI provider request failed (${providerResponse.status}).`)
    const qualification=JSON.parse(outputText(await providerResponse.json() as OpenAIResponse)) as Qualification
    const admin=adminClient()
    if(conversation.contact_id){
      const {data:lead}=await admin.from('leads').select('id').eq('organization_id',conversation.organization_id).eq('contact_id',conversation.contact_id).is('archived_at',null).order('created_at',{ascending:false}).limit(1).maybeSingle()
      if(lead){
        const handoffScore=75
        const {error:updateError}=await admin.from('leads').update({score:qualification.score,qualification,next_action:qualification.score>=handoffScore?'Human follow-up recommended':qualification.nextAction.replaceAll('_',' ').toLowerCase(),updated_at:new Date().toISOString()}).eq('id',lead.id).eq('organization_id',conversation.organization_id)
        if(updateError)throw new Error('Qualification completed but the lead could not be updated.')
        await admin.from('audit_events').insert({organization_id:conversation.organization_id,actor_id:user.id,event_type:'conversation_qualified',entity_type:'conversation',entity_id:conversation.id,metadata:{lead_id:lead.id,score:qualification.score}})
      }
    }
    return json({qualification})
  }catch(reason){return errorResponse(reason,'Unable to qualify the conversation.')}
})
