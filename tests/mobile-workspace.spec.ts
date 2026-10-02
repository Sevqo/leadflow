import {expect,test} from '@playwright/test'

test.beforeEach(async({page})=>{
  await page.setViewportSize({width:390,height:740})
  await page.goto('/#app')
  await page.evaluate(()=>{sessionStorage.setItem('nexara-demo-mode','true');localStorage.removeItem('nexara-demo-modules-v1');localStorage.removeItem('nexara-demo-workspace-v2')})
  await page.reload()
})

async function openPage(page:import('@playwright/test').Page,name:string,bottom=false){
  const toggle=page.getByRole('button',{name:'Open navigation'})
  if(await toggle.isVisible())await toggle.click()
  const drawer=page.getByLabel('Workspace navigation')
  const button=bottom?drawer.locator('.sidebar-bottom').getByRole('button',{name,exact:true}):drawer.locator('nav').getByRole('button',{name,exact:true})
  await button.scrollIntoViewIfNeeded()
  await button.click()
}

test('mobile workspace drawer scrolls independently to settings',async({page})=>{
  await page.getByRole('button',{name:'Open navigation'}).click()
  const drawer=page.getByLabel('Workspace navigation')
  const initialPageScroll=await page.evaluate(()=>scrollY)
  await drawer.evaluate(element=>element.scrollTop=element.scrollHeight)
  expect(await drawer.evaluate(element=>element.scrollTop)).toBeGreaterThan(0)
  expect(await page.evaluate(()=>scrollY)).toBe(initialPageScroll)
  await expect(drawer.locator('.sidebar-bottom').getByRole('button',{name:'Settings'})).toBeVisible()
  await drawer.locator('.sidebar-bottom').getByRole('button',{name:'Settings'}).click()
  await expect(page.getByRole('heading',{name:'Settings'})).toBeVisible()
})

test('mobile inbox exposes the conversation list and switches threads',async({page})=>{
  await openPage(page,'Inbox')
  const list=page.locator('.conversation-list')
  await expect(list).toBeVisible()
  await expect(list.locator('.conversation')).toHaveCount(3)
  await list.getByRole('button',{name:/Aisha Njeri/}).click()
  await expect(page.locator('.conversation-main')).toContainText('Aisha Njeri')
  await page.getByRole('button',{name:'Back to conversations'}).click()
  await list.getByRole('button',{name:/Brian Otieno/}).click()
  await expect(page.locator('.conversation-main')).toContainText('Brian Otieno')
})

test('team roster and automation tabs fit phone and desktop layouts',async({page})=>{
  await openPage(page,'Team')
  await expect(page.locator('.team-row')).toHaveCount(3)
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy()
  const teamDisplay=await page.locator('.team-row').first().evaluate(element=>getComputedStyle(element).display)
  expect(teamDisplay).toBe('grid')
  await openPage(page,'Automations')
  const tabs=page.locator('.automation-tabs')
  await expect(tabs).toBeVisible()
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy()
  await tabs.getByRole('button',{name:'Playbook library'}).click()
  await expect(page.getByRole('heading',{name:'Pipeline autopilot'})).toBeVisible()
  await page.setViewportSize({width:1440,height:900})
  await openPage(page,'Team')
  const width=await page.locator('.team-list').evaluate(element=>element.getBoundingClientRect().width)
  expect(width).toBeLessThanOrEqual(981)
})

test('every workspace module avoids document-level phone overflow',async({page})=>{
  test.setTimeout(90_000)
  const modules=['Overview','Inbox','Leads','Pipeline','Tasks','Contacts','Team','Team Chat','Automations','AI Assistant','Knowledge','Analytics','Integrations','Outbound','Clients','Projects','Systems','AI Agents','Approvals','Operations','Costs','Activity','Billing']
  for(const width of [320,390,430]){
    await page.setViewportSize({width,height:740})
    for(const name of modules){
      await openPage(page,name)
      await page.waitForTimeout(60)
      const metrics=await page.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,viewport:innerWidth}))
      expect(metrics.scrollWidth,`${name} widened the ${width}px document to ${metrics.scrollWidth}px`).toBeLessThanOrEqual(metrics.viewport)
    }
  }
  await openPage(page,'Settings',true)
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy()
  await openPage(page,'Help',true)
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy()
})

test('overview uses compact two-column metrics and touch-sized controls',async({page})=>{
  const metrics=page.locator('.metric-grid .metric')
  await expect(metrics).toHaveCount(4)
  const boxes=await metrics.evaluateAll(items=>items.map(item=>{const box=item.getBoundingClientRect();return {width:box.width,height:box.height}}))
  expect(boxes[0].width).toBeLessThan(190)
  expect(Math.max(...boxes.map(box=>box.height))).toBeLessThanOrEqual(125)
  const topbar=await page.locator('.topbar').evaluate(element=>element.getBoundingClientRect().height)
  expect(topbar).toBeLessThanOrEqual(62)
})
