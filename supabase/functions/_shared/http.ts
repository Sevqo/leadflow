export const corsHeaders={
  'Access-Control-Allow-Origin':Deno.env.get('APP_ORIGIN')??'http://localhost:5173',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type, x-leadflow-source-key, x-nexara-source-key',
  'Access-Control-Allow-Methods':'POST, OPTIONS',
  'Vary':'Origin',
}

export function json(body:unknown,status=200,extra:HeadersInit={}){
  return new Response(JSON.stringify(body),{status,headers:{...corsHeaders,'Content-Type':'application/json','Cache-Control':'no-store',...extra}})
}

export function errorResponse(reason:unknown,fallback='Request failed.'){
  const message=reason instanceof Error?reason.message:fallback
  const status=/not authenticated|authorization/i.test(message)?401:/not found/i.test(message)?404:400
  return json({error:message},status)
}

export async function readJson<T>(request:Request,maxBytes=64_000):Promise<T>{
  const contentLength=Number(request.headers.get('content-length')??0)
  if(contentLength>maxBytes)throw new Error('Request body is too large.')
  const text=await request.text()
  if(new TextEncoder().encode(text).length>maxBytes)throw new Error('Request body is too large.')
  try{return JSON.parse(text) as T}catch{throw new Error('Request body must be valid JSON.')}
}
