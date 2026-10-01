import {requireSupabase,ServiceError,throwServiceError} from './api'
import type {TeamMessageRow} from '../types/database'

export async function listTeamMessages(organizationId:string,before?:string):Promise<TeamMessageRow[]>{
  let query=requireSupabase().from('team_messages').select('*').eq('organization_id',organizationId).order('created_at',{ascending:false}).limit(50)
  if(before)query=query.lt('created_at',before)
  const {data,error}=await query
  if(error)throwServiceError(error,'Unable to load team messages.')
  return [...(data??[])].reverse()
}

export async function sendTeamMessage(organizationId:string,body:string):Promise<TeamMessageRow>{
  const {data,error}=await requireSupabase().rpc('send_team_message',{target_org:organizationId,message_body:body})
  if(error?.message.includes('please wait before sending another message'))throw new ServiceError('RATE_LIMIT','Please wait a moment before sending another message.')
  if(error)throwServiceError(error,'Unable to send team message.')
  return data
}

export async function markTeamChatRead(organizationId:string,userId:string){
  const {error}=await requireSupabase().from('team_chat_reads').upsert({organization_id:organizationId,user_id:userId,last_read_at:new Date().toISOString()},{onConflict:'organization_id,user_id'})
  if(error)throwServiceError(error,'Unable to mark team chat read.')
}
