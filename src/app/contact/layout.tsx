import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Request a Quote — Drone Engineering Services",
  description:
    "Get a free quote for custom drone builds, computer vision, Gazebo simulation, or FPGA integration. FAA Part 107 certified. Responses within 24 hours. Austin TX — global operations.",
  alternates: {
    canonical: "https://aj-builds-drone.github.io/contact/",
  },
  openGraph: {
    title: "Request a Quote | AJ Builds Drone",
    description:
      "Submit your drone project requirements and get a preliminary scope assessment within 24 hours. Custom UAV builds, simulation, FPGA & more.",
    url: "https://aj-builds-drone.github.io/contact/",
    siteName: "AJ Builds Drone",
    type: "website",
    images: [{ url: "/og-contact.jpg", width: 1200, height: 630, alt: "AJ Builds Drone — Request a Quote" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Request a Quote | AJ Builds Drone",
    description: "Get a free drone engineering quote within 24 hours. Custom builds, CV, simulation, FPGA.",
    images: ["/og-contact.jpg"],
  },
};

export default function ContactLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
