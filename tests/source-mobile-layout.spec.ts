import {expect,test} from '@playwright/test'

test('source dialogs keep their actions reachable in a short phone viewport',async({page})=>{
  await page.setViewportSize({width:390,height:420})
  await page.goto('/#app')
  await page.addStyleTag({url:'/src/features/integrations/source-connectors.css'})
  for(const kind of ['source-dialog','credential-dialog']){
    await page.evaluate(dialogKind=>{
      document.querySelector('.source-modal-backdrop')?.remove()
      const overlay=document.createElement('div')
      overlay.className='modal-backdrop source-modal-backdrop'
      overlay.innerHTML=`<section class="modal ${dialogKind}"><div class="modal-head"><h2>Connect a customer platform</h2></div><div class="source-form"><label>Platform<select><option>Instagram</option></select></label><label>Source name<input value="Campaign" /></label></div><div style="height:520px"></div><div class="modal-actions"><button class="btn primary">Finish setup</button></div></section>`
      document.body.append(overlay)
    },kind)
    const dialog=page.locator(`.${kind}`)
    expect(await dialog.evaluate(element=>element.scrollHeight>element.clientHeight)).toBe(true)
    await dialog.evaluate(element=>{element.scrollTop=element.scrollHeight})
    const action=await dialog.getByRole('button',{name:'Finish setup'}).boundingBox()
    const bounds=await dialog.boundingBox()
    expect(action).not.toBeNull()
    expect(bounds).not.toBeNull()
    expect(action!.y+action!.height).toBeLessThanOrEqual(bounds!.y+bounds!.height+1)
    expect(bounds!.height).toBeLessThanOrEqual(420)
  }
})
