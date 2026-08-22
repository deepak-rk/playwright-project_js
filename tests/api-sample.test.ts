import { expect, test } from '@playwright/test';
// api test
test('api title-test', async ({ request }) => {
    const url = 'https://reqres.in';
    const path = '/api/users/3';
    var res = await request.get(url + path);
    const jsonRes:any = await res.text();
    console.log(jsonRes);
    // var flatMap = await flatten(jsonRes);
    jsonRes.map(o =>
        Object.keys(o).reduce((acc, k) => {
          acc['dv_' + k] = o[k].display_value;
          acc[k] = o[k].value;
          return acc;
        }, {})
      );
    // console.log(flatMap);

})



  
  