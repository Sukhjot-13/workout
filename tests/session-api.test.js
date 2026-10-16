import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { getDatabase } from "@/lib/mongodb";
import { GET, POST } from "../app/api/session/route.js";
import { PROGRAM_VERSION } from "../lib/program.js";

vi.mock("@/lib/mongodb",()=>({getDatabase:vi.fn()}));
const payload={date:"2026-10-15",day:"day1",items:{"day1:incline-db-press":{sets:{1:{weight:"22.5",reps:"10",done:true}}}},programVersion:PROGRAM_VERSION};
function request(body) { return new Request("http://localhost/api/session",{method:"POST",body:JSON.stringify(body)}); }
beforeEach(()=>vi.clearAllMocks());
afterEach(()=>vi.restoreAllMocks());

describe("workout API boundaries",()=>{
  it("rejects injected or impossible dates before accessing the database",async()=>{
    expect((await POST(request({...payload,date:{$ne:null}}))).status).toBe(400);
    expect((await POST(request({...payload,date:"2026-02-30"}))).status).toBe(400);
    expect((await GET(new Request("http://localhost/api/session?date=oops&day=day1"))).status).toBe(400);
    expect(getDatabase).not.toHaveBeenCalled();
  });
  it("validates and stores a new program snapshot using normalized numbers",async()=>{
    const updateOne=vi.fn().mockResolvedValue({}),collection=vi.fn().mockReturnValue({updateOne});
    getDatabase.mockResolvedValue({collection});
    const response=await POST(request(payload));
    expect(await response.json()).toMatchObject({success:true,mongoConnected:true});
    expect(updateOne).toHaveBeenCalledWith({date:payload.date,day:payload.day},{$set:{date:payload.date,day:payload.day,items:{"day1:incline-db-press":{sets:{1:{weight:22.5,reps:10,done:true}}}},programVersion:3,updatedAt:expect.any(Date)}},{upsert:true});
  });
  it("deletes only the selected session when it is cleared",async()=>{
    const deleteOne=vi.fn().mockResolvedValue({});getDatabase.mockResolvedValue({collection:()=>({deleteOne})});
    expect((await (await POST(request({...payload,items:{}}))).json()).deleted).toBe(true);
    expect(deleteOne).toHaveBeenCalledWith({date:payload.date,day:payload.day});
  });
  it("reports local-only mode without claiming a cloud save",async()=>{
    getDatabase.mockResolvedValue(null);
    expect(await (await POST(request(payload))).json()).toMatchObject({success:false,mongoConnected:false});
    expect(await (await GET(new Request("http://localhost/api/session?date=2026-10-15&day=day1"))).json()).toMatchObject({source:"local-only",mongoConnected:false});
  });
  it("reads the selected cloud session, including its program version",async()=>{
    const findOne=vi.fn().mockResolvedValue({...payload,updatedAt:"2026-10-15T12:00:00Z"});
    getDatabase.mockResolvedValue({collection:()=>({findOne})});
    const data=await (await GET(new Request("http://localhost/api/session?date=2026-10-15&day=day1"))).json();
    expect(data).toMatchObject({items:payload.items,programVersion:3,mongoConnected:true});
    expect(findOne).toHaveBeenCalledWith({date:payload.date,day:payload.day});
  });
  it("returns fixed errors on a database failure without exposing driver details",async()=>{
    vi.spyOn(console,"error").mockImplementation(()=>{});getDatabase.mockRejectedValue(new Error("private database topology"));
    const response=await POST(request(payload));expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("private database");
  });
});
