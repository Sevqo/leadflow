import {requireSupabase,ServiceError,throwServiceError} from './api'
import type {TeamMessageRow,TeamRoomRow,TeamRoomMemberRow} from '../types/database'

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

export async function listTeamRooms(organizationId:string):Promise<TeamRoomRow[]>{
  const {data,error}=await requireSupabase().from('team_rooms').select('*').eq('organization_id',organizationId).order('created_at')
  if(error)throwServiceError(error,'Unable to load team conversations.');return data??[]
}
export async function listRoomMembers(organizationId:string):Promise<TeamRoomMemberRow[]>{
  const {data,error}=await requireSupabase().from('team_room_members').select('*').eq('organization_id',organizationId)
  if(error)throwServiceError(error,'Unable to load conversation members.');return data??[]
}
export async function roomUnreadCounts(organizationId:string):Promise<Record<string,number>>{
  const {data,error}=await requireSupabase().rpc('team_room_unread_counts',{target_org:organizationId})
  if(error)throwServiceError(error,'Unable to load unread counts.')
  return Object.fromEntries((data??[]).map(item=>[item.room_id,Number(item.unread_count)]))
}
export async function createTeamChannel(organizationId:string,name:string,userId:string):Promise<TeamRoomRow>{
  const {data,error}=await requireSupabase().from('team_rooms').insert({organization_id:organizationId,kind:'CHANNEL',name:name.trim().toLowerCase().replaceAll(/[^a-z0-9-]/g,'-'),created_by:userId}).select().single()
  if(error)throwServiceError(error,'Unable to create channel.');return data
}
export async function openTeamDirect(organizationId:string,userId:string):Promise<TeamRoomRow>{
  const {data,error}=await requireSupabase().rpc('open_team_direct',{target_org:organizationId,target_user:userId})
  if(error)throwServiceError(error,'Unable to open direct message.');return data
}
export async function listRoomMessages(organizationId:string,roomId:string,before?:string):Promise<TeamMessageRow[]>{
  let query=requireSupabase().from('team_messages').select('*').eq('organization_id',organizationId).eq('room_id',roomId).order('created_at',{ascending:false}).limit(50)
  if(before)query=query.lt('created_at',before)
  const {data,error}=await query
  if(error)throwServiceError(error,'Unable to load messages.');return [...(data??[])].reverse()
}
export async function sendRoomMessage(organizationId:string,roomId:string,body:string,replyTo:string|null=null):Promise<TeamMessageRow>{
  const {data,error}=await requireSupabase().rpc('send_team_room_message',{target_org:organizationId,target_room:roomId,message_body:body,target_reply:replyTo})
  if(error?.message.includes('please wait before sending another message'))throw new ServiceError('RATE_LIMIT','Please wait a moment before sending another message.')
  if(error)throwServiceError(error,'Unable to send message.');return data
}
export async function markRoomRead(organizationId:string,roomId:string,userId:string){
  const db=requireSupabase()
  const {data,error}=await db.from('team_room_members').update({last_read_at:new Date().toISOString()}).eq('organization_id',organizationId).eq('room_id',roomId).eq('user_id',userId).select('room_id')
  if(error)throwServiceError(error,'Unable to mark room read.')
  if(!data?.length){const result=await db.from('team_room_members').insert({organization_id:organizationId,room_id:roomId,user_id:userId,last_read_at:new Date().toISOString()});if(result.error)throwServiceError(result.error,'Unable to mark room read.')}
}
export async function editTeamMessage(organizationId:string,messageId:string,body:string){
  const {data,error}=await requireSupabase().rpc('edit_team_message',{target_org:organizationId,target_message:messageId,next_body:body})
  if(error)throwServiceError(error,'Unable to edit message.');return data
}
export async function deleteTeamMessage(organizationId:string,messageId:string){
  const {data,error}=await requireSupabase().rpc('delete_team_message',{target_org:organizationId,target_message:messageId})
  if(error)throwServiceError(error,'Unable to delete message.');return data
}
