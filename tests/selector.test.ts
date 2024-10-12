// @ts-check
import { test, expect } from '@playwright/test';
import assert from 'assert';

test('sample locator', async ({ page }) => {
  await page.goto('https://saucedemo.com/');
  var items = ['Sauce Labs Bolt T-Shirt','Sauce Labs Fleece Jacket'];
  await page.locator("id=user-name").fill("standard_user");
  await page.locator("id=password").fill("secret_sauce");
  await page.locator("id=login-button").click();
  for (let index = 0; index < items.length; index++) {
    console.log("clicking on item ",items[index]);
    await page.locator("//*[text()='"+items[index]+"']/ancestor::*[@class='inventory_item_description']/descendant::button").click();
    
  }
  const cart = "//*[@class='shopping_cart_badge']";
  var numberOfItems = await page.locator(cart).textContent();
  console.log(numberOfItems);
  expect(items.length,numberOfItems?.toString());
  await page.locator("//*[@class='shopping_cart_link']").click();

  
  var elements =  await page.locator("//*[@class='inventory_item_name']");
  
  console.log("elementsaa ", await elements.count());
  console.log("elements size "+typeof elements);
  
  const itemss = page.locator("//*[@class='inventory_item_name']");
  for (let i = 0; i < await itemss.count(); i++) {
   let a = await itemss.nth(i).textContent();
   expect(items[i]).toBe(a);
  //  console.log(a);
  }
  
  
  // await page.pause();


  // Expect a title "to contain" a substring.

});


