import {expect,test} from '@playwright/test'

const modules=['Overview','Inbox','Leads','Pipeline','Tasks','Contacts','Team','Team Chat','Automations','AI Assistant','Knowledge','Analytics','Integrations','Billing']

test('every desktop workspace module opens without a runtime crash',async({page})=>{
  const errors:string[]=[]
  page.on('pageerror',error=>errors.push(error.message))
  await page.goto('/#app')
  await page.evaluate(()=>sessionStorage.setItem('nexara-demo-mode','true'))
  await page.reload()
  for(const module of modules){
    await page.locator('.sidebar nav').getByRole('button',{name:module,exact:true}).click()
    await expect(page.getByRole('heading',{level:1}).first()).toBeVisible()
    await expect(page.locator('.fatal-error')).toHaveCount(0)
  }
  await page.locator('.sidebar-bottom').getByRole('button',{name:'Settings'}).click()
  await expect(page.getByRole('heading',{name:'Settings'})).toBeVisible()
  await page.locator('.sidebar-bottom').getByRole('button',{name:'Help'}).click()
  await expect(page.getByRole('heading',{name:'Help centre'})).toBeVisible()
  expect(errors).toEqual([])
})
