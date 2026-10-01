import {useCallback,useEffect,useState} from 'react'
import {completeTask,createTask,listProjectTasks} from '../../services/tasks'
import type {TaskRow} from '../../types/database'
import './project-tasks.css'

export function ProjectTasks({organizationId,projectId,canManage}:{organizationId:string;projectId:string;canManage:boolean}){
  const [tasks,setTasks]=useState<TaskRow[]>([]),[title,setTitle]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('')
  const refresh=useCallback(async()=>{
    try{setTasks(await listProjectTasks(organizationId,projectId));setError('')}
    catch(reason){setError(reason instanceof Error?reason.message:'Unable to load project tasks.')}
  },[organizationId,projectId])
  useEffect(()=>{void refresh()},[refresh])
  const add=async()=>{
    if(!canManage||!title.trim()||busy)return
    setBusy(true);setError('')
    try{await createTask(organizationId,{title:title.trim(),description:'',priority:'NORMAL',dueAt:null,leadId:null,assignedTo:null,projectId});setTitle('');await refresh()}
    catch(reason){setError(reason instanceof Error?reason.message:'Unable to create project task.')}
    finally{setBusy(false)}
  }
  const finish=async(taskId:string)=>{
    setBusy(true);setError('')
    try{await completeTask(taskId,organizationId);await refresh()}
    catch(reason){setError(reason instanceof Error?reason.message:'Unable to complete task.')}
    finally{setBusy(false)}
  }
  return <section className="project-tasks" aria-label="Project tasks">
    <h3>Tasks <span>{tasks.filter(task=>task.status==='OPEN').length} open</span></h3>
    {error&&<p className="project-tasks-error" role="alert">{error} <button onClick={()=>void refresh()}>Retry</button></p>}
    {tasks.map(task=><div className="project-task" key={task.id}><div><strong>{task.title}</strong><small>{task.status.toLowerCase()} · {task.priority.toLowerCase()}{task.due_at?` · due ${new Date(task.due_at).toLocaleDateString()}`:''}</small></div>{canManage&&task.status==='OPEN'&&<button disabled={busy} onClick={()=>void finish(task.id)}>Complete</button>}</div>)}
    {!tasks.length&&!error&&<p className="project-tasks-empty">No tasks linked to this project.</p>}
    {canManage&&<form onSubmit={event=>{event.preventDefault();void add()}}><label htmlFor={`project-task-${projectId}`}>New task</label><div><input id={`project-task-${projectId}`} value={title} onChange={event=>setTitle(event.target.value)} maxLength={160} placeholder="What needs doing?" required/><button disabled={busy||!title.trim()}>{busy?'Saving…':'Add task'}</button></div></form>}
  </section>
}
