export type Capability='RESEARCH'|'ENRICHMENT'|'EMAIL_VALIDATION'|'MAILBOX'|'CALENDAR'

const settings:Record<Capability,{url:string;key:string}>={
  RESEARCH:{url:'OUTBOUND_RESEARCH_API_URL',key:'OUTBOUND_RESEARCH_API_KEY'},
  ENRICHMENT:{url:'OUTBOUND_ENRICHMENT_API_URL',key:'OUTBOUND_ENRICHMENT_API_KEY'},
  EMAIL_VALIDATION:{url:'OUTBOUND_EMAIL_VALIDATION_API_URL',key:'OUTBOUND_EMAIL_VALIDATION_API_KEY'},
  MAILBOX:{url:'OUTBOUND_MAILBOX_API_URL',key:'OUTBOUND_MAILBOX_API_KEY'},
  CALENDAR:{url:'OUTBOUND_CALENDAR_API_URL',key:'OUTBOUND_CALENDAR_API_KEY'},
}

export function adapterFor(capability:Capability){
  const names=settings[capability],url=Deno.env.get(names.url)?.replace(/\/$/,'')??'',key=Deno.env.get(names.key)??''
  if(!url||!key)throw new Error(`${capability} provider setup is required.`)
  if(!/^https:\/\//i.test(url))throw new Error(`${names.url} must use HTTPS.`)
  return {url,key}
}

export async function signedAdapterRequest(capability:Capability,path:string,payload:unknown){
  const {url,key}=adapterFor(capability)
  const response=await fetch(`${url}${path}`,{method:'POST',headers:{'content-type':'application/json','authorization':`Bearer ${key}`,'user-agent':'Sevqo-LeadFlow/1.0'},body:JSON.stringify(payload),signal:AbortSignal.timeout(25000)})
  const text=await response.text()
  let body:Record<string,unknown>={};try{body=text?JSON.parse(text):{}}catch{body={message:text.slice(0,500)}}
  if(!response.ok)throw new Error(typeof body.error==='string'?body.error:`Provider returned HTTP ${response.status}.`)
  return body
}
