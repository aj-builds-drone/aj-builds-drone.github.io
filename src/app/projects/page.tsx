import { getProjects } from "@/lib/getProjects";
import ProjectGrid from "@/components/ProjectGrid";
import { SectionHeader } from "@/components/HUDElements";

export const metadata = {
  title: "The Hangar — UAV Portfolio | Custom Drone Builds",
  description:
    "Portfolio of custom UAV builds: STM32 Return-to-Home drone, NXP HoverGames entries, PX4 simulations, aerial cinematography, and 3D-printed RC aircraft. Full BOM & software stack included. By Ajaya Dahal, Austin TX.",
  alternates: {
    canonical: "https://aj-builds-drone.github.io/projects/",
  },
  openGraph: {
    title: "The Hangar — UAV Portfolio | AJ Builds Drone",
    description: "Custom drone builds with full bill of materials and software stack breakdowns. STM32 drones, NXP HoverGames, PX4 simulation, aerial cinematography.",
    url: "https://aj-builds-drone.github.io/projects/",
    siteName: "AJ Builds Drone",
    type: "website",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "AJ Builds Drone — UAV Portfolio" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "The Hangar — UAV Portfolio | AJ Builds Drone",
    description: "Custom drone builds with full BOM & software stack. STM32, NXP HoverGames, PX4, aerial cinematography.",
    images: ["/og-image.png"],
  },
};

export default async function ProjectsPage() {
  const projects = await getProjects();

  return (
    <div className="pt-24 pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Page Header */}
        <div className="mb-6">
          <div className="font-mono text-[10px] tracking-[0.3em] text-accent-green mb-4">
            ▸ SECURE DATALINK ESTABLISHED
          </div>
          <SectionHeader
            code="HGR"
            title="THE HANGAR"
            as="h1"
            subtitle="Complete portfolio of UAV platforms, research projects, and simulation environments. Each entry includes a full bill of materials and software stack breakdown."
          />
        </div>

        {/* Interactive filter + grid */}
        <ProjectGrid projects={projects} />

        {/* Data Source Note */}
        <div className="mt-12 pt-6 border-t border-border-dim text-center">
          <p className="font-mono text-[10px] text-text-secondary tracking-widest">
            DATA SOURCE: REMOTE GITHUB RAW // FALLBACK: LOCAL CACHE //
            LAST_SYNC: BUILD_TIME
          </p>
        </div>
      </div>
    </div>
  );
}
