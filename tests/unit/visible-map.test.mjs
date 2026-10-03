import assert from "node:assert/strict";
import test from "node:test";
import { observeVisibleMap } from "../../app/lib/visible-map.ts";

test("folded maps wait for positive dimensions and do not resize again while hidden",()=>{
  const previous=globalThis.ResizeObserver;
  let notify, disconnected=false;
  globalThis.ResizeObserver=class { constructor(callback){notify=callback;} observe(){} disconnect(){disconnected=true;} };
  try {
    const host={clientWidth:0,clientHeight:0};let calls=0;
    const dispose=observeVisibleMap(host,()=>calls++);
    notify();assert.equal(calls,0);
    host.clientWidth=390;host.clientHeight=300;notify();assert.equal(calls,1);
    host.clientWidth=0;notify();assert.equal(calls,1);
    host.clientWidth=390;host.clientHeight=0;notify();assert.equal(calls,1);
    host.clientHeight=300;notify();assert.equal(calls,2);
    dispose();notify();assert.equal(calls,2);assert.equal(disconnected,true);
  } finally {globalThis.ResizeObserver=previous;}
});
