import {useState} from 'react'
import type {AgencyAiAgentRow,AgencyProjectRow} from '../../types/database'
import {updateAgencyAgent,updateAgencyProject} from '../../services/agency'

function dateInput(value:string|null){return value?new Date(value).toISOString().slice(0,10):''}

export function ProjectEditor({project,organizationId,onSaved}:{project:AgencyProjectRow;organizationId:string;onSaved:()=>Promise<void>}){
  const [editing,setEditing]=useState(false)
  const [description,setDescription]=useState(project.description??'')
  const [dueDate,setDueDate]=useState(dateInput(project.due_at))
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const cancel=()=>{setDescription(project.description??'');setDueDate(dateInput(project.due_at));setError('');setEditing(false)}
  if(!editing)return <div className="agency-editor"><span>Target date: {project.due_at?new Date(project.due_at).toLocaleDateString():'Not set'}</span><button className="btn secondary" onClick={()=>setEditing(true)}>Edit plan</button></div>
  return <form className="agency-inline-form" onSubmit={event=>{event.preventDefault();setBusy(true);setError('');void updateAgencyProject(organizationId,project.id,{description:description.trim()||null,due_at:dueDate?new Date(`${dueDate}T12:00:00.000Z`).toISOString():null}).then(onSaved).then(()=>setEditing(false)).catch(reason=>setError(reason instanceof Error?reason.message:'Unable to update project.')).finally(()=>setBusy(false))}}>
    <label>Delivery plan<textarea value={description} onChange={event=>setDescription(event.target.value)} maxLength={4000}/></label>
    <label>Target date<input type="date" value={dueDate} onChange={event=>setDueDate(event.target.value)}/></label>
    {error&&<p role="alert" className="agency-error">{error}</p>}
    <div className="agency-card-actions"><button className="btn secondary" type="button" onClick={cancel}>Cancel</button><button className="btn primary" disabled={busy}>{busy?'Saving…':'Save plan'}</button></div>
  </form>
}

export function AgentEditor({agent,organizationId,onSaved}:{agent:AgencyAiAgentRow;organizationId:string;onSaved:()=>Promise<void>}){
  const [editing,setEditing]=useState(false)
  const [instructions,setInstructions]=useState(agent.instructions)
  const [guardrails,setGuardrails]=useState(agent.guardrails)
  const [humanApproval,setHumanApproval]=useState(agent.human_approval_required)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const cancel=()=>{setInstructions(agent.instructions);setGuardrails(agent.guardrails);setHumanApproval(agent.human_approval_required);setError('');setEditing(false)}
  if(!editing)return <button className="btn secondary" onClick={()=>setEditing(true)}>Edit configuration</button>
  return <form className="agency-inline-form" onSubmit={event=>{event.preventDefault();setBusy(true);setError('');void updateAgencyAgent(organizationId,agent.id,{instructions:instructions.trim(),guardrails:guardrails.trim(),human_approval_required:humanApproval}).then(onSaved).then(()=>setEditing(false)).catch(reason=>setError(reason instanceof Error?reason.message:'Unable to update agent configuration.')).finally(()=>setBusy(false))}}>
    <label>Instructions<textarea value={instructions} onChange={event=>setInstructions(event.target.value)} maxLength={8000} placeholder="Scope, allowed tasks, and expected output"/></label>
    <label>Guardrails<textarea value={guardrails} onChange={event=>setGuardrails(event.target.value)} maxLength={4000} placeholder="Escalation rules and prohibited actions"/></label>
    <label className="agency-check"><input type="checkbox" checked={humanApproval} onChange={event=>setHumanApproval(event.target.checked)}/> Require human approval for privileged actions</label>
    {error&&<p role="alert" className="agency-error">{error}</p>}
    <div className="agency-card-actions"><button className="btn secondary" type="button" onClick={cancel}>Cancel</button><button className="btn primary" disabled={busy}>{busy?'Saving…':'Save configuration'}</button></div>
  </form>
}
