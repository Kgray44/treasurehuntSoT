"use client";

import { gsap } from "gsap";
import { CustomEase } from "gsap/CustomEase";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";
import { Flip } from "gsap/Flip";
import { MotionPathPlugin } from "gsap/MotionPathPlugin";
import { MorphSVGPlugin } from "gsap/MorphSVGPlugin";
import { SplitText } from "gsap/SplitText";

gsap.registerPlugin(CustomEase, DrawSVGPlugin, Flip, MotionPathPlugin, MorphSVGPlugin, SplitText);
if (!gsap.parseEase("forever-settle")) CustomEase.create("forever-settle", "M0,0 C0.16,0.86 0.24,1 1,1");

export { CustomEase, DrawSVGPlugin, Flip, gsap, MotionPathPlugin, MorphSVGPlugin, SplitText };
