import { SectionHeader } from "@/components/HUDElements";
import ResearchMatcher from "@/components/ResearchMatcher";
import VideoBackground from "@/components/VideoBackground";

export const metadata = {
  title: "Research Collaboration Matcher — AJ Builds Drone",
  description:
    "Find drone capabilities that match your research needs. Interactive tool for professors and researchers in computer vision, SLAM, agricultural sensing, LiDAR mapping, and more.",
  alternates: {
    canonical: "https://aj-builds-drone.github.io/research-match/",
  },
  openGraph: {
    title: "Research Collaboration Matcher | AJ Builds Drone",
    description:
      "Match your research area with drone capabilities. Computer vision, SLAM, agricultural sensing, LiDAR, and more.",
    url: "https://aj-builds-drone.github.io/research-match/",
    siteName: "AJ Builds Drone",
    type: "website",
  },
};

export default function ResearchMatchPage() {
  return (
    <main className="min-h-screen">
      {/* Hero */}
      <section className="relative pt-32 pb-16 overflow-hidden">
        <VideoBackground />
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeader
            code="RCM"
            title="RESEARCH COLLABORATION MATCHER"
            subtitle="Select your research areas to discover matching drone capabilities and collaboration opportunities. Built for professors, PIs, and research teams exploring aerial robotics integration."
            as="h1"
          />
        </div>
      </section>

      {/* Matcher Tool */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ResearchMatcher />
        </div>
      </section>
    </main>
  );
}
