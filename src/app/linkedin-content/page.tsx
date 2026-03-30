"use client";

import { useState } from "react";
import { motion } from "framer-motion";

type Category = "All" | "Research" | "Technical" | "Personal" | "Engagement";

interface Template {
  id: number;
  title: string;
  category: Category;
  hook: string;
  body: string;
  cta: string;
  hashtags: string[];
}

const templates: Template[] = [
  {
    id: 1,
    title: "Research Spotlight",
    category: "Research",
    hook: "Just published: [paper topic]. Here's what we found about [drone application]... 🔬",
    body: `We spent 6 months collecting aerial data across [X] sites.

The results surprised even us.

[Key finding #1] — this alone changes how we think about [application area].

[Key finding #2] — and this has massive implications for [field].

The raw data? Over [X] TB of multispectral imagery processed through our custom pipeline.

What made this possible wasn't just the drone — it was the integration between [sensor], [software], and a repeatable flight protocol that any research team can adopt.

Full paper link in comments 👇`,
    cta: "What research questions could aerial data answer in YOUR field? Drop them below — I read every comment.",
    hashtags: ["#DroneResearch", "#UAV", "#RemoteSensing", "#AcademicTwitter", "#DataScience", "#AerialSurvey", "#ResearchMethods"],
  },
  {
    id: 2,
    title: "Before/After",
    category: "Technical",
    hook: "This bridge inspection used to take 3 days. With drones: 20 minutes. Here's the data... 🌉",
    body: `Before:
→ 3-day road closure
→ $15,000 in equipment rental
→ 4-person crew with rope access certification
→ Still missed 30% of the underside

After:
→ 20-minute autonomous flight
→ Sub-centimeter imagery of EVERY surface
→ AI-flagged crack detection
→ Zero road closure needed

The university's civil engineering department couldn't believe the cost comparison.

Traditional inspection: $15,000+
Drone inspection: $2,500
Savings per bridge: $12,500

Multiply that across 47 bridges in their study area.

That's $587,500 in savings. Per inspection cycle.`,
    cta: "If you're still doing infrastructure inspections the old way, let's talk. Link in bio for a free assessment.",
    hashtags: ["#DroneInspection", "#Infrastructure", "#CivilEngineering", "#BridgeInspection", "#UAV", "#CostSavings", "#Engineering"],
  },
  {
    id: 3,
    title: "Grant Win",
    category: "Research",
    hook: "Just received NSF funding for [project]. If you're writing a drone integration proposal, here's what reviewers look for... 💰",
    body: `After reviewing 50+ grant proposals that include drone components, I've noticed a pattern.

The ones that get funded do 3 things differently:

1️⃣ They quantify the ROI vs. traditional methods
   — Not "drones are faster." Instead: "Reduces survey time from 240 person-hours to 8, freeing 97% of field time for analysis."

2️⃣ They address FAA compliance upfront
   — Reviewers want to know you've thought about airspace, COAs, and Part 107 requirements. A 2-paragraph compliance section works wonders.

3️⃣ They include a data management plan specific to aerial data
   — TB-scale imagery needs a real pipeline. Show you've planned for storage, processing, and archival.

The proposals that DON'T get funded? They treat drones as a cool gadget, not a research instrument.`,
    cta: "Writing a grant that includes drone operations? DM me — I review 3 proposals per month for free.",
    hashtags: ["#NSF", "#GrantWriting", "#ResearchFunding", "#DroneResearch", "#AcademicLife", "#STEM", "#UniversityResearch"],
  },
  {
    id: 4,
    title: "Behind the Scenes",
    category: "Personal",
    hook: "What a day of drone data collection actually looks like (spoiler: it's 10% flying, 90% data processing)... 📊",
    body: `5:30 AM — Alarm goes off. Early flights = best light conditions.

6:15 AM — On-site. Wind check: 8 mph. ✅ Humidity: 65%. ✅ Airspace: cleared via LAANC.

6:30 AM — Pre-flight checklist. Firmware current. Batteries charged. Sensors calibrated. GCPs placed and surveyed.

7:00 AM — First flight. 22 minutes of automated grid pattern. Swap battery. Second flight.

8:00 AM — Flying done. Now the REAL work begins.

8:30 AM — Transfer 127 GB of raw imagery. Start stitching pipeline.

10:00 AM — QC check on orthomosaic. One strip has poor overlap. Flag for re-flight.

11:00 AM — NDVI processing. Anomaly detection. Classification.

2:00 PM — Report generation. Maps, statistics, recommendations.

5:00 PM — Deliverables sent. 10 hours of work. 44 minutes of actual flying.

This is what "drone services" really means. The aircraft is 10% of the value.`,
    cta: "Want to see the full workflow? I'm documenting our entire process on my site → link in bio.",
    hashtags: ["#BehindTheScenes", "#DroneLife", "#DataProcessing", "#RemoteSensing", "#DayInTheLife", "#UAVOperator", "#Part107"],
  },
  {
    id: 5,
    title: "Hot Take",
    category: "Engagement",
    hook: "Unpopular opinion: Most university drone programs are wasting money on the wrong hardware. Here's why... 🔥",
    body: `I've consulted with 20+ university drone labs.

The #1 mistake? Buying a $30K enterprise drone when a $2K platform would do 90% of their research.

Here's the truth most vendors won't tell you:

→ A DJI Mavic 3M does 80% of what a Matrice 350 does for agricultural research
→ Most labs fly <50 hours/year — they don't need industrial durability  
→ The $28K difference? Better spent on sensors, software, and student training

When SHOULD you go enterprise?
✅ BVLOS operations
✅ Heavy payload sensors (LiDAR, hyperspectral)
✅ Harsh environment deployments
✅ Regulatory requirements demanding redundancy

For everything else? Start small. Prove the concept. Scale up when the data justifies it.

I've seen too many $50K drones collecting dust because the PI who bought it graduated.`,
    cta: "Agree? Disagree? I want to hear from drone program managers — what's YOUR biggest equipment mistake?",
    hashtags: ["#HotTake", "#DroneIndustry", "#UniversityResearch", "#UAV", "#ResearchEquipment", "#HigherEd", "#DroneProgram"],
  },
  {
    id: 6,
    title: "Tutorial",
    category: "Technical",
    hook: "How to get your Part 107 drone license in 2 weeks (step by step for researchers)... 📋",
    body: `I've helped 15+ graduate students pass their Part 107.

Here's the exact study plan:

📅 Week 1: Knowledge
Day 1-2: Airspace classification (this is 30% of the test)
Day 3-4: Weather theory & METAR/TAF reading
Day 5-6: Regulations & waivers
Day 7: Loading & performance

📅 Week 2: Practice
Day 8-9: Full practice tests (aim for 90%+)
Day 10-11: Review weak areas
Day 12: Final practice test
Day 13: REST (seriously, don't cram)
Day 14: Test day

🔑 Key resources (all free):
→ FAA's own study guide (surprisingly good)
→ 3DR's sectional chart tutorial
→ RemotePilot101 practice tests

💡 Pro tips:
→ The sectional chart questions are free points if you practice
→ METAR decoding seems hard but follows a simple pattern
→ Don't overthink the weather questions — they want practical knowledge

Pass rate with this method: 100% (15/15 students).`,
    cta: "Studying for Part 107? Drop a 🙋 and I'll send you my free cheat sheet.",
    hashtags: ["#Part107", "#DroneLicense", "#FAA", "#Tutorial", "#DroneTraining", "#RemotePilot", "#STEM", "#GradSchool"],
  },
  {
    id: 7,
    title: "Case Study",
    category: "Research",
    hook: "We helped [university] reduce their field survey costs by 90%. Here's exactly how... 📉",
    body: `The problem:
A geology department was spending $200K/year on traditional topographic surveys. Manual GPS points. Hired surveyors. Weeks of fieldwork per site.

Our solution:
→ Drone-based photogrammetry with RTK positioning
→ Automated flight planning for consistent coverage
→ Custom processing pipeline: raw images → DEM → contour maps in 4 hours

The numbers:

| Metric | Before | After |
|--------|--------|-------|
| Cost per survey | $8,000 | $800 |
| Time per site | 5 days | 3 hours |
| Points per survey | 500 | 50,000,000 |
| Repeat frequency | 2x/year | Monthly |

The best part? Graduate students now run the surveys independently.

We trained 4 students in 2 days. They've completed 30+ surveys since.

Total first-year savings: $180,000
ROI on drone investment: 1,200%`,
    cta: "Want the full case study with methodology details? Comment 'SURVEY' and I'll send it over.",
    hashtags: ["#CaseStudy", "#DroneMapping", "#Photogrammetry", "#UniversityResearch", "#ROI", "#Surveying", "#GIS"],
  },
  {
    id: 8,
    title: "Industry Trend",
    category: "Technical",
    hook: "3 drone technology trends that will change research in 2026... 🚀",
    body: `I've been tracking drone tech for 8 years. These 3 shifts are going to be massive:

1️⃣ Edge AI on the drone itself
No more "fly, land, process." New chips (like NVIDIA Jetson Orin Nano) enable real-time object detection, crop classification, and anomaly flagging IN FLIGHT. Your drone tells you what it found before it lands.

2️⃣ Mesh networking for swarm operations
Multiple drones covering a 10,000-acre site simultaneously, sharing data in real-time, auto-adjusting flight paths based on what the other drones are finding. The FAA is closer to approving multi-drone ops than most people realize.

3️⃣ Standardized data formats (finally)
The lack of interoperability between drone platforms has been a nightmare. New OGC standards for aerial survey data mean your DJI data will play nice with your senseFly data will play nice with your custom build data. One pipeline to rule them all.

The common thread? Drones are becoming research INSTRUMENTS, not just cameras that fly.`,
    cta: "Which trend are you most excited about? I'm betting on #1 — edge AI changes everything.",
    hashtags: ["#DroneTech", "#FutureTech", "#AI", "#EdgeComputing", "#DroneIndustry", "#Innovation", "#Research2026"],
  },
  {
    id: 9,
    title: "Personal Story",
    category: "Personal",
    hook: "From FPGA engineer at AMD to running drone operations for universities. Here's what I learned... 🛤️",
    body: `3 years ago I was designing chips at AMD.

Great job. Great team. But something was missing.

I kept building drones on weekends. Custom frames. Custom flight controllers. Spending vacation days at drone meetups.

One day a professor friend asked: "Can you fly a drone over our research site?"

That single flight turned into a contract.
That contract turned into a business.
That business now serves universities across Texas.

What I learned:

→ Engineering skills transfer. FPGA timing analysis → flight controller optimization. Same mindset, different domain.

→ The best business ideas come from solving YOUR OWN problems. I built tools I wished existed.

→ University researchers are the most underserved market in drones. They need technical partners, not just pilots.

→ Leaving a "safe" job is terrifying. But staying in the wrong one is worse.

The AMD experience wasn't wasted — it's my competitive advantage. I think about drones like an engineer, not just an operator.`,
    cta: "Ever made a career pivot that scared you? I'd love to hear your story in the comments.",
    hashtags: ["#CareerChange", "#Entrepreneurship", "#DroneLife", "#Engineering", "#StartupStory", "#FPGA", "#TechCareers"],
  },
  {
    id: 10,
    title: "Engagement Bait",
    category: "Engagement",
    hook: "What's the biggest challenge you face with drone data collection? (Wrong answers only) 😂",
    body: `I'll start:

"The drone gained sentience and now demands a salary"

"My PI thinks 'drone data' means I personally fly over campus taking selfies"

"The FAA called. They want to know why I filed a flight plan for Mars"

"Processed 2TB of imagery. Computer caught fire. Data survived. Computer did not."

"Client asked for 'a few aerial photos.' Delivered 47,000 images and a 3D model. They wanted 5 JPEGs."

OK but seriously — drone data collection challenges are REAL:

→ Weather delays that blow your timeline
→ Storage costs that blow your budget  
→ Processing times that blow your mind
→ Regulations that blow your... patience

The industry doesn't talk about this stuff enough.`,
    cta: "Your turn — drop your best (worst?) drone data collection challenge below. Wrong answers encouraged. Right answers also accepted. 👇",
    hashtags: ["#DroneLife", "#DataCollection", "#ResearchProblems", "#AcademicHumor", "#UAV", "#WrongAnswersOnly"],
  },
];

const categories: Category[] = ["All", "Research", "Technical", "Personal", "Engagement"];

const categoryColors: Record<Category, string> = {
  All: "border-accent-green text-accent-green",
  Research: "border-blue-400 text-blue-400",
  Technical: "border-accent-orange text-accent-orange",
  Personal: "border-purple-400 text-purple-400",
  Engagement: "border-pink-400 text-pink-400",
};

function copyToClipboard(template: Template) {
  const text = `${template.hook}\n\n${template.body}\n\n${template.cta}\n\n${template.hashtags.join(" ")}`;
  navigator.clipboard.writeText(text);
}

export default function LinkedInContentPage() {
  const [filter, setFilter] = useState<Category>("All");
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const filtered = filter === "All" ? templates : templates.filter((t) => t.category === filter);

  const handleCopy = (template: Template) => {
    copyToClipboard(template);
    setCopiedId(template.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <main className="min-h-screen bg-background pt-24 pb-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12"
        >
          <div className="font-mono text-xs text-accent-green tracking-widest mb-2">
            [SYS::CONTENT_ENGINE] — LINKEDIN TEMPLATES v1.0
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-text-primary mb-4">
            LinkedIn Content <span className="text-accent-orange">Templates</span>
          </h1>
          <p className="text-text-secondary max-w-2xl">
            10 battle-tested LinkedIn post templates optimized for engagement in the drone / research / university space. 
            One-click copy, ready to customize and post.
          </p>
        </motion.div>

        {/* Category Filters */}
        <div className="flex flex-wrap gap-2 mb-8">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`font-mono text-xs px-4 py-2 border rounded transition-all ${
                filter === cat
                  ? `${categoryColors[cat]} bg-white/5`
                  : "border-border-dim text-text-muted hover:border-border-bright hover:text-text-secondary"
              }`}
            >
              {cat.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Template Cards */}
        <div className="grid gap-6">
          {filtered.map((template, i) => (
            <motion.div
              key={template.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="border border-border-dim rounded-lg bg-surface/50 overflow-hidden hover:border-border-bright transition-colors"
            >
              {/* Card Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-border-dim">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-accent-green">[{String(template.id).padStart(2, "0")}]</span>
                  <h2 className="font-semibold text-text-primary">{template.title}</h2>
                  <span className={`font-mono text-[10px] px-2 py-0.5 border rounded ${categoryColors[template.category]}`}>
                    {template.category.toUpperCase()}
                  </span>
                </div>
                <button
                  onClick={() => handleCopy(template)}
                  className={`font-mono text-xs px-4 py-2 border rounded transition-all ${
                    copiedId === template.id
                      ? "border-accent-green text-accent-green bg-accent-green/10"
                      : "border-accent-orange text-accent-orange hover:bg-accent-orange/10"
                  }`}
                >
                  {copiedId === template.id ? "✓ COPIED" : "⎘ COPY"}
                </button>
              </div>

              {/* Card Body */}
              <div className="px-6 py-5 space-y-4">
                {/* Hook */}
                <div>
                  <div className="font-mono text-[10px] text-accent-orange tracking-widest mb-1">HOOK</div>
                  <p className="text-text-primary font-semibold text-lg leading-relaxed">{template.hook}</p>
                </div>

                {/* Body Preview */}
                <div>
                  <div className="font-mono text-[10px] text-text-muted tracking-widest mb-1">BODY</div>
                  <pre className="text-text-secondary text-sm whitespace-pre-wrap font-sans leading-relaxed max-h-48 overflow-y-auto scrollbar-thin">
                    {template.body}
                  </pre>
                </div>

                {/* CTA */}
                <div>
                  <div className="font-mono text-[10px] text-accent-green tracking-widest mb-1">CALL TO ACTION</div>
                  <p className="text-text-primary text-sm">{template.cta}</p>
                </div>

                {/* Hashtags */}
                <div className="flex flex-wrap gap-2 pt-2 border-t border-border-dim">
                  {template.hashtags.map((tag) => (
                    <span key={tag} className="font-mono text-[11px] text-blue-400/80">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </main>
  );
}
