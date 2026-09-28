import {expect,test} from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

test.beforeEach(async({page})=>{
  await page.goto('/#app')
  await page.evaluate(()=>{
    sessionStorage.setItem('nexara-demo-mode','true')
    localStorage.removeItem('nexara-demo-modules-v1')
    localStorage.removeItem('nexara-demo-workspace-v2')
    localStorage.removeItem('nexara-setup-dismissed:demo')
  })
  await page.reload()
})

test('overview exposes actionable launch readiness',async({page})=>{
  await expect(page.getByText('Launch readiness')).toBeVisible()
  await expect(page.getByRole('heading',{name:'Finish your workspace'})).toBeVisible()
  await expect(page.getByLabel('5 of 7 launch checks complete')).toBeVisible()
  await expect(page.locator('.setup-items').getByText('Ready')).toHaveCount(5)
  await expect(page.getByRole('button',{name:/Configure AI assistant/})).toBeVisible()
  await expect(page.getByRole('button',{name:/Activate an automation/})).toBeVisible()
})

test('lead profile provides a real decision brief without placeholder copy',async({page})=>{
  await page.locator('.sidebar nav').getByRole('button',{name:'Leads'}).click()
  await page.getByRole('button',{name:/James Mwangi/}).click()
  const dialog=page.getByRole('dialog',{name:/James Mwangi/})
  await expect(dialog.getByRole('heading',{name:'Decision brief'})).toBeVisible()
  await expect(dialog.getByText('RECOMMENDED NEXT MOVE')).toBeVisible()
  await expect(dialog).toContainText('Conversation-based AI qualification is available from the Inbox.')
  await expect(dialog).not.toContainText('will use conversation history when the AI provider is configured')
})

test('production readiness service verifies every live launch dependency',()=>{
  const root=process.cwd()
  const service=fs.readFileSync(path.join(root,'src/services/readiness.ts'),'utf8')
  const boundary=fs.readFileSync(path.join(root,'src/ErrorBoundary.tsx'),'utf8')
  for(const table of ['organizations','knowledge_items','automations','ai_configs','integrations','lead_sources','widget_configs','organization_members'])expect(service).toContain(`from('${table}')`)
  expect(service).toContain('throwServiceError')
  expect(boundary).toContain('componentDidCatch')
  expect(boundary).toContain('Reload workspace')
})
