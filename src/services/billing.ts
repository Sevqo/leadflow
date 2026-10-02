import type {SubscriptionRow} from '../types/database'
import {requireSupabase,throwServiceError} from './api'
export type BillingPlan='STARTER'|'GROWTH'|'PRO'
export type BillingUsage={members:number;monthlyLeads:number;activeAutomations:number;knowledgeItems:number}
export const planLimits:Record<BillingPlan,{members:number;monthlyLeads:number;activeAutomations:number;knowledgeItems:number;users:number;automations:number}>={STARTER:{members:2,monthlyLeads:100,activeAutomations:3,knowledgeItems:25,users:2,automations:3},GROWTH:{members:5,monthlyLeads:500,activeAutomations:15,knowledgeItems:250,users:5,automations:15},PRO:{members:25,monthlyLeads:5000,activeAutomations:100,knowledgeItems:2500,users:25,automations:100}}
export function isWithinLimit(plan:BillingPlan,resource:keyof typeof planLimits.STARTER,current:number){return current<planLimits[plan][resource]}
export async function getSubscription(organizationId:string):Promise<SubscriptionRow|null>{const {data,error}=await requireSupabase().from('subscriptions').select('*').eq('organization_id',organizationId).maybeSingle();if(error)throwServiceError(error,'Unable to load billing.');return data}
export async function getBillingUsage(organizationId:string):Promise<BillingUsage>{
  const client=requireSupabase(),monthStart=new Date();monthStart.setUTCDate(1);monthStart.setUTCHours(0,0,0,0)
  const results=await Promise.all([
    client.from('organization_members').select('user_id',{count:'exact',head:true}).eq('organization_id',organizationId),
    client.from('leads').select('id',{count:'exact',head:true}).eq('organization_id',organizationId).gte('created_at',monthStart.toISOString()),
    client.from('automations').select('id',{count:'exact',head:true}).eq('organization_id',organizationId).eq('status','ACTIVE'),
    client.from('knowledge_items').select('id',{count:'exact',head:true}).eq('organization_id',organizationId).neq('status','ARCHIVED'),
  ])
  const failed=results.find(result=>result.error);if(failed?.error)throwServiceError(failed.error,'Unable to load plan usage.')
  return {members:results[0].count??0,monthlyLeads:results[1].count??0,activeAutomations:results[2].count??0,knowledgeItems:results[3].count??0}
}
async function billing(body:Record<string,unknown>){const {data,error}=await requireSupabase().functions.invoke('billing',{body});if(error)throwServiceError(error,'Unable to open billing.');if(!data?.url)throw new Error('Billing provider did not return a destination.');window.location.assign(data.url)}
export const startCheckout=(organizationId:string,plan:BillingPlan)=>billing({action:'checkout',organizationId,plan})
export const openBillingPortal=(organizationId:string)=>billing({action:'portal',organizationId})
