-- Delivery work reuses the existing Tasks table instead of creating a second
-- task implementation. A task may belong to a project or retain its CRM lead.
alter table public.tasks add column project_id uuid;
alter table public.tasks add constraint tasks_project_same_organization
  foreign key (organization_id,project_id)
  references public.agency_projects(organization_id,id)
  on delete set null (project_id);
create index tasks_project_status_due_idx on public.tasks(organization_id,project_id,status,due_at)
  where project_id is not null;
