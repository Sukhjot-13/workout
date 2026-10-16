// @vitest-environment jsdom
import React, { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SetTracker from "../components/SetTracker.jsx";
import ExerciseGuide from "../components/ExerciseGuide.jsx";
import { PROGRAM } from "../lib/program.js";

vi.mock("next/image", () => ({ default: ({ unoptimized, ...props }) => { void unoptimized; return React.createElement("img", props); } }));
const press=PROGRAM.day1.sections[1].items[1];
function Entry({initial={},exercise=press,previous}) {
  const [saved,setSaved]=useState(initial);
  return <SetTracker item={exercise} saved={saved} previous={previous} weightUnit="kg" onUpdate={setSaved} />;
}
function GuideTrigger() {
  const [open,setOpen]=useState(false);
  return <><button onClick={()=>setOpen(true)}>Show form</button>{open && <ExerciseGuide item={press} onClose={()=>setOpen(false)} />}</>;
}
beforeEach(()=>{
  HTMLDialogElement.prototype.showModal=function(){this.setAttribute("open","");};
  HTMLDialogElement.prototype.close=function(){this.removeAttribute("open");};
});
afterEach(cleanup);

describe("usable set entry",()=>{
  it("accepts decimal weights while typing and fills empty weights without filling reps",async()=>{
    const user=userEvent.setup(); render(<Entry />);
    const weight=screen.getByLabelText(`${press.name} weight, set 1, in kg`);
    await user.type(weight,"20.5");
    expect(weight.value).toBe("20.5");
    await user.tab();
    expect(screen.getByLabelText(`${press.name} weight, set 2, in kg`).value).toBe("20.5");
    expect(screen.getByLabelText(`${press.name} reps, set 1`).value).toBe("");
  });
  it("does not overwrite completed or independently adjusted later sets",async()=>{
    const user=userEvent.setup();render(<Entry initial={{sets:{2:{weight:18,done:true},3:{weight:25}}}} />);
    await user.type(screen.getByLabelText(`${press.name} weight, set 1, in kg`),"20");
    expect(screen.getByLabelText(`${press.name} weight, set 2, in kg`).value).toBe("18");
    expect(screen.getByLabelText(`${press.name} weight, set 3, in kg`).value).toBe("25");
  });
  it("marks only the tapped set and fills its suggested reps",async()=>{
    const user=userEvent.setup();render(<Entry />);
    await user.click(screen.getByRole("button",{name:`Mark ${press.name} set 3 complete`}));
    expect(screen.getByRole("button",{name:`Mark ${press.name} set 1 complete`}).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByRole("button",{name:`Mark ${press.name} set 2 complete`}).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByRole("button",{name:`Mark ${press.name} set 3 incomplete`}).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByLabelText(`${press.name} reps, set 3`).value).toBe("10");
  });
  it("copies previous weight and reps atomically",async()=>{
    const user=userEvent.setup(),onUpdate=vi.fn();
    render(<SetTracker item={press} saved={{}} previous={{sets:{1:{weight:22.5,reps:12,done:true}}}} weightUnit="kg" onUpdate={onUpdate} />);
    await user.click(screen.getByRole("button",{name:/Use last: 22.5kg × 12 reps/}));
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate.mock.calls[0][0]({}).sets[1]).toEqual({weight:22.5,reps:12});
  });
  it("retains a removed set so Add set can undo an accidental removal",async()=>{
    const user=userEvent.setup();render(<Entry initial={{sets:{3:{weight:25,reps:12}}}} />);
    await user.click(screen.getByRole("button",{name:/Remove set/}));
    expect(screen.queryByLabelText(`${press.name} reps, set 3`)).toBeNull();
    await user.click(screen.getByRole("button",{name:/Add set/}));
    expect(screen.getByLabelText(`${press.name} reps, set 3`).value).toBe("12");
  });
  it("shows seconds for holds and omits unnecessary weight fields",()=>{
    const hold=PROGRAM.day2.sections[3].items.find((item)=>item.id==="side-plank");
    render(<Entry exercise={hold} />);
    expect(screen.getByText("Seconds")).toBeTruthy();expect(screen.queryByLabelText(/weight, set/)).toBeNull();
  });
});

describe("individual form guide",()=>{
  it("returns keyboard focus to the guide trigger after closing",async()=>{
    const user=userEvent.setup();render(<GuideTrigger />);
    const trigger=screen.getByRole("button",{name:"Show form"});
    await user.click(trigger);await user.click(screen.getByRole("button",{name:"Close dialog"}));
    expect(document.activeElement).toBe(trigger);
  });
  it("loads one exercise image only after the guide mounts",()=>{
    const {rerender}=render(<div />); expect(screen.queryByRole("img")).toBeNull();
    const onClose=vi.fn();rerender(<ExerciseGuide item={press} onClose={onClose} />);
    const picture=screen.getByRole("img");
    expect(picture.getAttribute("src")).toBe("/exercise-guides/incline-db-press.webp");
    expect(screen.getByRole("status").textContent).toContain("Loading illustration");
    fireEvent.load(picture);expect(screen.queryByRole("status")).toBeNull();
    fireEvent.click(screen.getByRole("button",{name:"Close dialog"}));expect(onClose).toHaveBeenCalledTimes(1);
  });
  it("keeps instructions available when the image fails and handles Escape",()=>{
    const onClose=vi.fn();render(<ExerciseGuide item={press} onClose={onClose} />);
    fireEvent.error(screen.getByRole("img"));expect(screen.getByRole("status").textContent).toContain("Illustration unavailable");
    expect(screen.getByText("Set up. Move with control.")).toBeTruthy();
    fireEvent(screen.getByRole("dialog"),new Event("cancel",{cancelable:true}));expect(onClose).toHaveBeenCalledTimes(1);
  });
});
