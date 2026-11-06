import test from 'node:test';
import assert from 'node:assert/strict';
import {judge,remaining,MIN_REACTION_MS} from '../lib/timing.mjs';
test('ignore inputs before zero and below 101ms; accept the exact 101ms boundary',()=>{
 const deadline=10000;
 assert.equal(MIN_REACTION_MS,101);
 for(const elapsed of [-10000,-1,0,1,99,100,100.999])assert.deepEqual(judge(deadline,deadline+elapsed),{kind:'ignored'});
 assert.deepEqual(judge(deadline,10101),{kind:'success',ms:101});
 assert.deepEqual(judge(deadline,10101.999),{kind:'success',ms:101});
 assert.deepEqual(judge(deadline,10153.8),{kind:'success',ms:153});
});
test('repeated ignored touches do not shift the record origin',()=>{
 const deadline=10000;
 for(const at of [0,5000,9999,10000,10099,10100])assert.equal(judge(deadline,at).kind,'ignored');
 assert.deepEqual(judge(deadline,10235),{kind:'success',ms:235});
});
test('countdown stays at zero during the minimum recognition interval',()=>{
 assert.equal(remaining(10000,0),10);assert.equal(remaining(10000,1250),9);
 assert.equal(remaining(10000,9999),1);assert.equal(remaining(10000,10000),0);
 assert.equal(remaining(10000,10050),0);assert.equal(remaining(10000,12000),0);
});
