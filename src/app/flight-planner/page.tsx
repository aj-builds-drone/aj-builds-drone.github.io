import type { Metadata } from "next";
import FlightPlanner from "@/components/FlightPlanner/FlightPlanner";

export const metadata: Metadata = {
  title: "Flight Planner — Interactive Mission Demo",
  description:
    "Plan a drone data collection mission interactively. Draw your survey area, adjust altitude, overlap, and speed — see flight time, battery swaps, and data volume in real time.",
  alternates: { canonical: "https://aj-builds-drone.github.io/flight-planner/" },
  openGraph: {
    title: "Interactive Flight Planner | AJ Builds Drone",
    description:
      "Visual drone mission planner — draw survey areas, calculate flight time, passes, and data volume.",
    url: "https://aj-builds-drone.github.io/flight-planner/",
    siteName: "AJ Builds Drone",
    type: "website",
  },
};

export default function FlightPlannerPage() {
  return (
    <main className="min-h-screen bg-dark-bg pt-20">
      <FlightPlanner />
    </main>
  );
}
