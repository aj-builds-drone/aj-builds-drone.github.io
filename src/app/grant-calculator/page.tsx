import { SectionHeader } from "@/components/HUDElements";
import GrantBudgetCalculator from "@/components/GrantBudgetCalculator";
import VideoBackground from "@/components/VideoBackground";

export const metadata = {
  title: "Grant Budget Calculator — AJ Builds Drone",
  description:
    "Estimate drone integration costs for your research grant proposal. Interactive calculator for NSF, USDA, DOE, and other funding agencies. Download a budget estimate for your application.",
  alternates: {
    canonical: "https://aj-builds-drone.github.io/grant-calculator/",
  },
  openGraph: {
    title: "Grant Budget Calculator | AJ Builds Drone",
    description:
      "Estimate drone costs for grant proposals. Interactive calculator with downloadable budget estimates.",
    url: "https://aj-builds-drone.github.io/grant-calculator/",
    siteName: "AJ Builds Drone",
    type: "website",
  },
};

export default function GrantCalculatorPage() {
  return (
    <main className="min-h-screen">
      {/* Hero */}
      <section className="relative pt-32 pb-16 overflow-hidden">
        <VideoBackground />
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeader
            code="GBC"
            title="GRANT BUDGET CALCULATOR"
            subtitle="Estimate drone integration costs for your research grant proposal. Configure mission parameters, sensors, and duration to generate a budget you can paste directly into your NSF, USDA, or DOE application."
            as="h1"
          />
        </div>
      </section>

      {/* Calculator */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <GrantBudgetCalculator />
        </div>
      </section>
    </main>
  );
}
