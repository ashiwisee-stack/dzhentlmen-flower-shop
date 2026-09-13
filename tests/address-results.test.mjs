import test from 'node:test';
import assert from 'node:assert/strict';
import { splitAddress, uniqueAddresses } from '../lib/address-results.ts';

test('house numbers stay separate from street names, including numbered streets', () => {
  assert.deepEqual(splitAddress('Екатеринбург, ул. Краснолесья, 95'), {street:'Краснолесья',houseNumber:'95'});
  assert.deepEqual(splitAddress('8 Марта 12А'), {street:'8 Марта',houseNumber:'12А'});
  assert.deepEqual(splitAddress('8 Марта'), {street:'8 Марта',houseNumber:''});
});

test('duplicate street segments collapse and wrong houses are not offered as exact matches', () => {
  const street={label:'Екатеринбург, улица Тестовая',coordinates:[56.83,60.59],precision:'street'};
  const same={...street,label:'Екатеринбург, ул. Тестовая',coordinates:[56.84,60.59]};
  const wrong={...street,label:'Екатеринбург, улица Тестовая, 96',precision:'house',houseNumber:'96'};
  const exact={...wrong,label:'Екатеринбург, улица Тестовая, 95',houseNumber:'95'};
  assert.deepEqual(uniqueAddresses([street,same,wrong], '95'), [street]);
  assert.deepEqual(uniqueAddresses([street,same,wrong,exact,{...exact,coordinates:[56.831,60.59]}], '95'), [exact]);
});
