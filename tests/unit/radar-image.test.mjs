import assert from "node:assert/strict";
import test from "node:test";
import { watchRadarImage } from "../../app/lib/radar-image.ts";

function imageStub(element={complete:false,naturalWidth:0}) {
  const listeners=new Map();
  return {
    on:(event,callback)=>listeners.set(event,callback),
    off:(event,callback)=>{if(listeners.get(event)===callback)listeners.delete(event);},
    getElement:()=>element,
    emit:event=>listeners.get(event)?.(),
    listenerCount:()=>listeners.size,
  };
}

test("a cached radar image that loads during mounting does not leave playback waiting",()=>{
  const image=imageStub();let ready=0,errors=0;
  const dispose=watchRadarImage(image,()=>image.emit("load"),()=>ready++,()=>errors++);
  assert.equal(ready,1);assert.equal(errors,0);assert.equal(image.listenerCount(),0);
  dispose();
});

test("a decoded cached image is accepted even when no new load event is emitted",()=>{
  const image=imageStub({complete:true,naturalWidth:2706});let ready=0;
  const dispose=watchRadarImage(image,()=>{},()=>ready++,()=>assert.fail("cached image rejected"));
  assert.equal(ready,1);dispose();
});

test("failed images report one error and ignore late load events",()=>{
  const image=imageStub();let ready=0,errors=0;
  const dispose=watchRadarImage(image,()=>{},()=>ready++,()=>errors++);
  image.emit("error");image.emit("load");image.emit("error");
  assert.equal(errors,1);assert.equal(ready,0);assert.equal(image.listenerCount(),0);dispose();
});

test("images that never finish stop waiting at the timeout",context=>{
  context.mock.timers.enable({apis:["setTimeout"]});
  const image=imageStub();let errors=0;
  const dispose=watchRadarImage(image,()=>{},()=>assert.fail("incomplete image accepted"),()=>errors++,15000);
  context.mock.timers.tick(14999);assert.equal(errors,0);
  context.mock.timers.tick(1);assert.equal(errors,1);dispose();
});

test("switching frames cancels pending callbacks and timers",context=>{
  context.mock.timers.enable({apis:["setTimeout"]});
  const image=imageStub();let calls=0;
  const dispose=watchRadarImage(image,()=>{},()=>calls++,()=>calls++);
  dispose();image.emit("load");image.emit("error");context.mock.timers.tick(20000);
  assert.equal(calls,0);assert.equal(image.listenerCount(),0);
});
