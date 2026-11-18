import { test, expect } from '@playwright/test';

test('alteration preview, profile and demo fitting request persist', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', {name:'Picture the possibilities.'})).toBeVisible();
  await expect(page.locator('.before img')).toHaveJSProperty('naturalWidth', 1536);
  await page.getByRole('button', {name:'Keep original',exact:true}).click();
  await expect(page.locator('.after')).toHaveClass(/original/);
  await page.getByRole('button', {name:'Knee length',exact:true}).click();
  await page.getByRole('button', {name:'Proposed look',exact:true}).click();
  await expect(page.locator('.before')).toBeHidden();
  await page.getByRole('button', {name:'Side by side',exact:true}).click();
  await page.locator('#open-profile').click();
  await page.getByLabel('Customer name').fill('Alex Demo');
  await page.getByRole('button', {name:'Save sample profile'}).click();
  await page.locator('#notes').fill('Please preserve the hem details.');
  await page.getByRole('button', {name:'Review fitting request'}).click();
  await expect(page.locator('#request-content')).toContainText('Alex Demo');
  await expect(page.locator('#request-content')).toContainText('Please preserve the hem details.');
  await page.getByRole('button', {name:'Save demo request'}).click();
  await page.getByRole('button', {name:'View my requests'}).click();
  await expect(page.locator('#requests-list')).toContainText('Alex Demo');
  await page.reload();
  await page.locator('[data-page="requests"]').first().click();
  await expect(page.locator('#requests-list')).toContainText('Please preserve the hem details.');
  await page.getByRole('button', {name:'Remove demo request'}).click();
  await expect(page.locator('#requests-list')).toContainText('Every great fit starts with an idea.');
  expect(errors).toEqual([]);
});

test('wardrobe upload, activity filters, edit, mannequin outfit and reload', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', {name:'My wardrobe',exact:true}).click();
  await expect(page.locator('.wardrobe-item')).toHaveCount(4);
  await page.getByRole('button', {name:'Work',exact:true}).click();
  await expect(page.locator('.wardrobe-item')).toHaveCount(1);
  await page.getByRole('button', {name:'All',exact:true}).click();
  await page.getByRole('button', {name:'Add clothing',exact:false}).click();
  await page.locator('#garment-files').setInputFiles('public/images/skirt-comparison.png');
  await page.getByLabel('Item name (one photo) / collection name (multiple)').fill('My uploaded skirt');
  await page.getByLabel('Type',{exact:true}).selectOption('bottom');
  await page.getByLabel('Activity',{exact:true}).selectOption('Work');
  await page.getByRole('button', {name:'Add to my wardrobe'}).click();
  const card = page.locator('.wardrobe-item').filter({has:page.getByRole('heading',{name:'My uploaded skirt',exact:true})});
  await expect(card).toBeVisible();
  await card.getByRole('button', {name:'Add to outfit'}).click();
  await page.locator('.wardrobe-item').filter({hasText:'Cream everyday tee'}).getByRole('button',{name:'Add to outfit'}).click();
  await expect(page.locator('.outfit-piece')).toHaveCount(2);
  await page.getByLabel('Outfit name',{exact:true}).fill('Studio day');
  await page.getByRole('button', {name:'Save outfit',exact:false}).click();
  await expect(page.locator('#saved-outfits')).toContainText('Studio day');
  await page.reload();
  await page.getByRole('button', {name:'My wardrobe',exact:true}).click();
  await expect(page.locator('.wardrobe-item')).toHaveCount(5);
  await page.getByRole('button', {name:'Open outfit'}).click();
  await expect(page.locator('.outfit-piece')).toHaveCount(2);
  await card.getByRole('button', {name:'Edit details'}).click();
  await page.getByLabel('Item name',{exact:true}).fill('Renamed skirt');
  await page.getByRole('button',{name:'Save item',exact:true}).click();
  await expect(page.locator('#outfit-slots')).toContainText('Renamed skirt');
  await page.getByRole('button', {name:'Remove Renamed skirt',exact:true}).click();
  await expect(page.locator('.wardrobe-item')).toHaveCount(4);
  await expect(page.locator('.outfit-piece')).toHaveCount(1);
});

test('phone layout has no horizontal overflow and navigation works', async ({ page }) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto('/');
  await expect(page.locator('.preview-panel')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({path:'test-results/mobile.png',fullPage:true});
  await page.getByRole('button',{name:'My wardrobe',exact:true}).click();
  await expect(page.locator('.wardrobe-item')).toHaveCount(4);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('drag clothing onto mannequin, replace a piece, save and clear a look', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', {name:'My wardrobe',exact:true}).click();
  const tee = page.locator('[data-drag-item="sample-top"]');
  const shirt = page.locator('[data-drag-item="sample-work"]');
  const trousers = page.locator('[data-drag-item="sample-bottom"]');
  const board = page.locator('#outfit-drop-zone');
  await expect(tee.locator('img')).toHaveJSProperty('complete',true);
  expect(await tee.locator('img').evaluate(img=>img.naturalWidth)).toBeGreaterThan(0);
  // Put both source and destination in view before the mouse button is held.
  await board.scrollIntoViewIfNeeded();
  await tee.dragTo(board);
  await expect(page.locator('#outfit-slots')).toContainText('Cream everyday tee');
  await trousers.dragTo(board);
  await expect(page.locator('.outfit-piece')).toHaveCount(2);
  await shirt.dragTo(board);
  await expect(page.locator('.outfit-piece')).toHaveCount(2);
  await expect(page.locator('#outfit-slots')).toContainText('Studio work shirt');
  await expect(page.locator('#outfit-slots')).not.toContainText('Cream everyday tee');
  await expect(board).not.toHaveClass(/drag-over|drag-ready/);
  await page.getByLabel('Outfit name',{exact:true}).fill('Dragged work outfit');
  await page.getByRole('button', {name:'Save outfit',exact:false}).click();
  await page.getByRole('button', {name:'Clear outfit board',exact:true}).click();
  await expect(page.locator('.outfit-piece')).toHaveCount(0);
  await page.reload();
  await page.getByRole('button', {name:'My wardrobe',exact:true}).click();
  await page.getByRole('button', {name:'Open outfit',exact:true}).click();
  await expect(page.locator('.outfit-piece')).toHaveCount(2);
  await expect(page.locator('#outfit-slots')).toContainText('Studio work shirt');
});

test('existing sample photos update without losing edited details or uploaded clothing', async ({page}) => {
  await page.goto('/');
  await page.getByRole('button',{name:'My wardrobe',exact:true}).click();
  await expect(page.locator('.wardrobe-item')).toHaveCount(4);
  await page.evaluate(async () => {
    const db = await new Promise((resolve,reject)=> { const request=indexedDB.open('craftndetail-wardrobe',1);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error); });
    await new Promise((resolve,reject)=> {
      const transaction=db.transaction('items','readwrite');const store=transaction.objectStore('items');
      store.put({id:'sample-top',name:'My renamed tee',category:'top',activity:'Work',image:'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>'});
      store.put({id:'customer-upload',name:'Personal uploaded shirt',category:'top',activity:'Everyday',image:'data:image/png;base64,upload-placeholder'});
      transaction.oncomplete=resolve;transaction.onerror=()=>reject(transaction.error);
    });
    db.close();
  });
  await page.reload();
  await page.getByRole('button',{name:'My wardrobe',exact:true}).click();
  await expect(page.locator('.wardrobe-item')).toHaveCount(5);
  const tee=page.locator('.wardrobe-item').filter({hasText:'My renamed tee'});
  await expect(tee).toContainText('Work');
  await expect(tee.locator('img')).not.toHaveAttribute('src',/^data:image\/svg/);
  await expect(page.locator('.wardrobe-item').filter({hasText:'Personal uploaded shirt'}).locator('img')).toHaveAttribute('src','data:image/png;base64,upload-placeholder');
});
