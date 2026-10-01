import { useCallback, useEffect, useRef, useState } from 'react'
import { createOrganization, listOrganizations } from '../../services/organizations'
import type { OrganizationSummary } from '../../services/organizations'

const ACTIVE_ORG_KEY='nexara-active-organization'

export function useOrganizations(userId:string|undefined,enabled:boolean){
  const [organizations,setOrganizations]=useState<OrganizationSummary[]>([])
  const [activeId,setActiveIdState]=useState(()=>localStorage.getItem(ACTIVE_ORG_KEY))
  const [loading,setLoading]=useState(Boolean(enabled&&userId))
  const [loadedFor,setLoadedFor]=useState<string|null>(null)
  const [error,setError]=useState('')
  const requestVersion=useRef(0)
  const refresh=useCallback(async()=>{
    const request=++requestVersion.current
    if(!enabled||!userId){setOrganizations([]);setLoadedFor(null);setLoading(false);return}
    setLoading(true);setError('')
    try{
      const rows=await listOrganizations()
      if(request!==requestVersion.current)return
      setOrganizations(rows)
      setActiveIdState(current=>{
        const next=rows.some(row=>row.id===current)?current:rows[0]?.id??null
        if(next)localStorage.setItem(ACTIVE_ORG_KEY,next);else localStorage.removeItem(ACTIVE_ORG_KEY)
        return next
      })
    }catch(reason){if(request===requestVersion.current)setError(reason instanceof Error?reason.message:'Unable to load workspaces.')}
    finally{if(request===requestVersion.current){setLoadedFor(userId);setLoading(false)}}
  },[enabled,userId])
  useEffect(()=>{void refresh()},[refresh])
  const setActiveId=(id:string)=>{if(organizations.some(row=>row.id===id)){localStorage.setItem(ACTIVE_ORG_KEY,id);setActiveIdState(id)}}
  const create=async(name:string)=>{const id=await createOrganization(name);await refresh();localStorage.setItem(ACTIVE_ORG_KEY,id);setActiveIdState(id);return id}
  const sessionPending=Boolean(enabled&&userId&&loadedFor!==userId)
  return {organizations,activeOrganization:organizations.find(row=>row.id===activeId)??null,activeId,loading:loading||sessionPending,error,refresh,setActiveId,create}
}
