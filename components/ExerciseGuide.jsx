"use client";

import { useState } from "react";
import Image from "next/image";
import Modal from "./Modal";
import { getExerciseGuide } from "@/lib/exercise-guides";

export default function ExerciseGuide({ item, onClose }) {
  const guide = getExerciseGuide(item.guideId);
  const [imageState, setImageState] = useState("loading");
  if (!guide) return null;
  return <Modal title={item.name} onClose={onClose} className="exercise-guide-dialog">
    <p className="guide-prescription">{item.prescription} <span>· {item.note}</span></p>
    <div className="guide-layout">
      <div className="guide-visual">
        <div className="guide-illustration" style={{ aspectRatio: `${guide.width} / ${guide.height}` }} aria-busy={imageState === "loading"}>
          {imageState !== "error" && <Image src={guide.image} alt={`${guide.title}: illustrated starting position and movement`}
            width={guide.width} height={guide.height} unoptimized className={`guide-image ${imageState === "loaded" ? "loaded" : ""}`}
            onLoad={() => setImageState("loaded")} onError={() => setImageState("error")} />}
          {imageState === "loading" && <span className="image-placeholder" role="status">Loading illustration…</span>}
          {imageState === "error" && <span className="image-placeholder" role="status">Illustration unavailable. The instructions are below.</span>}
        </div>
        <p className="illustration-caption">Start → movement → controlled return</p>
      </div>
      <div className="guide-cues">
        <span className="eyebrow">FORM GUIDE</span>
        <h3>Set up. Move with control.</h3>
        <p>{guide.instruction}</p>
        <div className="guide-tip"><strong>Keep in mind</strong><p>{guide.cue}</p></div>
        {/side|leg|arm|foot|direction/.test(item.target || item.prescription) && <p className="muted">The prescription is per side where indicated. Finish both sides before checking off a set.</p>}
        {guide.reference && <a href={guide.reference} target="_blank" rel="noreferrer" className="technique-link">Technique reference ↗</a>}
      </div>
    </div>
  </Modal>;
}
