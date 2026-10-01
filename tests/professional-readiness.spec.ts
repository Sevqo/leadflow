import {expect,test} from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

test.beforeEach(async({page})=>{
  await page.goto('/#app')
  await page.evaluate(()=>{sessionStorage.setItem('nexara-demo-mode','true');localStorage.removeItem('nexara-demo-modules-v1');localStorage.removeItem('nexara-demo-workspace-v2')})
  await page.reload()
})

test('overview shows a performance graph and the configured username',async({page})=>{
  await expect(page.getByRole('heading',{name:'Performance over time'})).toBeVisible()
  await expect(page.getByRole('img',{name:/bar performance graph showing/i})).toBeVisible()
  await page.getByRole('button',{name:'Line',exact:true}).click()
  await expect(page.getByRole('img',{name:/line performance graph showing/i})).toBeVisible()
  await page.locator('.sidebar-bottom').getByRole('button',{name:'Settings'}).click()
  await page.getByLabel('Username').fill('agency.owner')
  await page.getByRole('button',{name:'Save changes'}).click()
  await page.locator('.sidebar nav').getByRole('button',{name:'Overview'}).click()
  await expect(page.getByRole('heading',{name:'Good morning, agency.owner'})).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading',{name:'Good morning, agency.owner'})).toBeVisible()
})

test('pipeline autopilot advances matching new leads and creates accountable work',async({page})=>{
  await page.locator('.sidebar nav').getByRole('button',{name:'Automations'}).click()
  await expect(page.getByText('Active workflows run automatically')).toBeVisible()
  await page.getByRole('button',{name:'Playbook library'}).click()
  const template=page.locator('article').filter({hasText:'Pipeline autopilot'})
  await template.getByRole('button',{name:'Use playbook'}).click()
  await page.getByRole('button',{name:'Save and activate'}).click()
  await page.locator('.sidebar nav').getByRole('button',{name:'Leads'}).click()
  await page.getByRole('button',{name:'Add lead'}).click()
  const dialog=page.getByRole('dialog',{name:'Add a lead'})
  await dialog.getByLabel('Full name').fill('Automated Prospect')
  await dialog.getByLabel('Interest').fill('Agency growth system')
  await dialog.getByLabel('Lead score').fill('82')
  await dialog.getByRole('button',{name:'Create lead'}).click()
  await page.getByRole('button',{name:'Close profile'}).click()
  await expect(page.getByLabel('Stage for Automated Prospect')).toHaveValue('Qualified')
  await page.locator('.sidebar nav').getByRole('button',{name:'Tasks'}).click()
  await expect(page.getByText('Complete the next pipeline action')).toBeVisible()
})

test('workspace typography is larger and active navigation has no side glow',async({page})=>{
  const nav=page.locator('.sidebar nav').getByRole('button',{name:'Overview'})
  const style=await nav.evaluate(element=>{const value=getComputedStyle(element);return {fontSize:value.fontSize,boxShadow:value.boxShadow,borderLeft:value.borderLeftWidth}})
  expect(Number.parseFloat(style.fontSize)).toBeGreaterThanOrEqual(16)
  expect(style.boxShadow).toBe('none')
  expect(style.borderLeft).toBe('0px')
})

test('profile and automation production contracts are secure and auditable',()=>{
  const root=process.cwd()
  const migration=fs.readFileSync(path.join(root,'supabase/migrations/0016_profile_pipeline_readiness.sql'),'utf8')
  const runner=fs.readFileSync(path.join(root,'supabase/functions/automation-run/index.ts'),'utf8')
  const organizations=fs.readFileSync(path.join(root,'src/features/organizations/useOrganizations.ts'),'utf8')
  expect(migration).toContain('profiles_username_unique')
  expect(migration).toContain('auth.uid()')
  expect(migration).toContain("'advance_stage'")
  expect(runner).toContain("config.type==='advance_stage'")
  expect(runner).toContain("activity_type:'STAGE_CHANGED'")
  expect(runner).toContain("event_type:'automation_stage_changed'")
  expect(organizations).toContain('loadedFor!==userId')
  expect(organizations).toContain('loading:loading||sessionPending')
})
