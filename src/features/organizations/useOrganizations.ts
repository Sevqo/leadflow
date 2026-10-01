import { useCallback, useEffect, useRef, useState } from 'react'
import { createOrganization, listOrganizations } from '../../services/organizations'
import type { OrganizationSummary } from '../../services/organizations'

const activeOrgKey=(userId:string)=>`nexara-active-organization:${userId}`

export function useOrganizations(userId:string|undefined,enabled:boolean){
  const [organizations,setOrganizations]=useState<OrganizationSummary[]>([])
  const [activeId,setActiveIdState]=useState<string|null>(null)
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
      setActiveIdState(()=>{
        const stored=localStorage.getItem(activeOrgKey(userId))
        const next=rows.some(row=>row.id===stored)?stored:rows.length===1?rows[0].id:null
        if(next)localStorage.setItem(activeOrgKey(userId),next);else localStorage.removeItem(activeOrgKey(userId))
        return next
      })
    }catch(reason){if(request===requestVersion.current)setError(reason instanceof Error?reason.message:'Unable to load workspaces.')}
    finally{if(request===requestVersion.current){setLoadedFor(userId);setLoading(false)}}
  },[enabled,userId])
  useEffect(()=>{void refresh()},[refresh])
  const setActiveId=(id:string)=>{if(userId&&organizations.some(row=>row.id===id)){localStorage.setItem(activeOrgKey(userId),id);setActiveIdState(id)}}
  const create=async(name:string)=>{const id=await createOrganization(name);await refresh();if(userId)localStorage.setItem(activeOrgKey(userId),id);setActiveIdState(id);return id}
  const sessionPending=Boolean(enabled&&userId&&loadedFor!==userId)
  return {organizations,activeOrganization:organizations.find(row=>row.id===activeId)??null,activeId,loading:loading||sessionPending,error,refresh,setActiveId,create}
}
