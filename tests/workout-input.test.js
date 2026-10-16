import { describe,it,expect } from "vitest";
import { applyPreviousSet,finishNumberDraft,isNumberDraft,stepValue } from "../lib/workout-input.js";

describe("numeric entry",()=>{
  it("preserves valid partial decimal drafts and rejects invalid values",()=>{
    for(const value of ["",".","20.","20.5","20.25"]) expect(isNumberDraft(value)).toBe(true);
    for(const value of ["-1","1e3","NaN","20.555","1001","2..5"]) expect(isNumberDraft(value)).toBe(false);
    expect(finishNumberDraft("20.")).toBe(20);expect(finishNumberDraft("20.5")).toBe(20.5);
    expect(finishNumberDraft(".")).toBe("");expect(finishNumberDraft("")).toBe("");
  });
  it("steps from the target without exceeding bounds",()=>{
    expect(stepValue("",10,1)).toBe(11);expect(stepValue(0,10,-1)).toBe(0);
    expect(stepValue(10000,10,1)).toBe(10000);
  });
  it("copies both previous values in one update and never copies completion",()=>{
    const original={sets:{1:{done:false},2:{weight:10}}};
    const result=applyPreviousSet(original,1,{weight:22.5,reps:12,done:true});
    expect(result.sets[1]).toEqual({done:false,weight:22.5,reps:12});
    expect(result.sets[2]).toEqual({weight:10});expect(original.sets[1]).toEqual({done:false});
    expect(applyPreviousSet({},1,{weight:20,reps:30},"reps").sets[1]).toEqual({reps:30});
  });
});
