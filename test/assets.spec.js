/* eslint-env jest */
import { createLocalVue } from 'vue-test-utils';
import Vuex from 'vuex';
import assets from '../src/modules/assets.js';

jest.mock('../src/services/__mocks__/assets.js');
const Assets = require('../src/services/assets.js');
// import Assets from '../src/services/assets.js';



const localVue = createLocalVue();
localVue.use(Vuex);

const store = new Vuex.Store({
  modules: {
    assets
  }
});

beforeAll(() => {
  Assets.asyncMethod = jest.fn();
});
// beforeAll(done => {
  
// });

describe('assets module', () => {
  it('test test', done => {
    done();
  });

  it('api mock works', async () => {
    const result = await Assets.fetch([1, 2]);
    expect(result[0].name).toEqual('bts');
  });
});
