import test from 'node:test';
import assert from 'node:assert/strict';
import {judge,remaining,MIN_REACTION_MS} from '../lib/timing.mjs';
test('ignore pre-zero touches; accept zero and all post-zero touches',()=>{
 const deadline=10000;
 assert.equal(MIN_REACTION_MS,0);
 for(const elapsed of [-10000,-1,-0.001])assert.deepEqual(judge(deadline,deadline+elapsed),{kind:'ignored'});
 for(const elapsed of [0,0.999,1,99,100,100.999,101,153.8])assert.deepEqual(judge(deadline,deadline+elapsed),{kind:'success',ms:Math.floor(elapsed)});
});
test('ignored touches do not shift the deadline',()=>{
 const deadline=10000;
 for(const at of [0,5000,9999])assert.equal(judge(deadline,at).kind,'ignored');
 assert.deepEqual(judge(deadline,10000),{kind:'success',ms:0});
});
test('countdown reaches zero at the deadline',()=>{
 assert.equal(remaining(10000,0),10);assert.equal(remaining(10000,1250),9);
 assert.equal(remaining(10000,9999),1);assert.equal(remaining(10000,10000),0);
 assert.equal(remaining(10000,10050),0);assert.equal(remaining(10000,12000),0);
});
