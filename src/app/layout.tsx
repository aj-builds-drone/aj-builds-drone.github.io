import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

const siteUrl = "https://ajayadesign.github.io/aj-builds-drone";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "AJ Builds Drone | UAV Systems Contractor — Austin, TX",
    template: "%s | AJ Builds Drone",
  },
  description:
    "FAA Part 107 certified drone contractor & Sr. FPGA Engineer. Custom UAV builds, PX4/ArduPilot integration, computer vision, SLAM, aerial cinematography, and FPGA-based embedded systems. Austin TX — operating globally.",
  keywords: [
    "drone contractor Austin TX",
    "UAV systems engineer",
    "PX4 developer",
    "ArduPilot integrator",
    "ROS2 drone",
    "computer vision SLAM",
    "Gazebo simulation",
    "custom drone build",
    "FAA Part 107 pilot",
    "FPGA embedded systems",
    "aerial photography Austin",
    "NXP HoverGames",
    "STM32 flight controller",
    "drone cinematography",
    "research drone prototyping",
  ],
  authors: [{ name: "Ajaya Dahal", url: "https://ajayadahal.github.io" }],
  creator: "Ajaya Dahal",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "AJ Builds Drone",
    title: "AJ Builds Drone | UAV Systems Contractor",
    description:
      "FAA Part 107 certified. Custom UAV builds, PX4 integration, computer vision, FPGA embedded systems, and aerial cinematography. From simulation to maiden flight.",
    images: [
      {
        url: `${siteUrl}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "AJ Builds Drone — UAV Systems Contractor",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "AJ Builds Drone | UAV Systems Contractor",
    description:
      "FAA Part 107 certified. Custom UAV builds, PX4, FPGA, aerial cinematography. Austin TX — operating globally.",
    images: [`${siteUrl}/og-image.png`],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: siteUrl,
  },
  icons: {
    icon: `${siteUrl}/favicon.svg`,
  },
};

// JSON-LD structured data
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "ProfessionalService",
      "@id": `${siteUrl}/#business`,
      name: "AJ Builds Drone",
      url: siteUrl,
      description:
        "Professional UAV systems contractor offering custom drone builds, FPGA integration, computer vision, and aerial cinematography.",
      areaServed: "Worldwide",
      address: {
        "@type": "PostalAddress",
        addressLocality: "Austin",
        addressRegion: "TX",
        addressCountry: "US",
      },
      founder: {
        "@type": "Person",
        name: "Ajaya Dahal",
        jobTitle: "UAV Systems Contractor & Sr. FPGA Engineer",
        url: "https://ajayadahal.github.io",
        sameAs: [
          "https://www.linkedin.com/in/ajaya-dahal-137b94108/",
          "https://www.youtube.com/@ajayadahal6160",
          "https://github.com/ajayadahal",
          "https://www.hackster.io/ajaya",
        ],
        hasCredential: [
          {
            "@type": "EducationalOccupationalCredential",
            credentialCategory: "license",
            name: "FAA Part 107 Remote Pilot Certificate",
          },
          {
            "@type": "EducationalOccupationalCredential",
            credentialCategory: "degree",
            name: "M.S. Electrical & Computer Engineering",
            recognizedBy: {
              "@type": "CollegeOrUniversity",
              name: "Mississippi State University",
            },
          },
        ],
        knowsAbout: [
          "Unmanned Aerial Vehicles",
          "PX4 Autopilot",
          "FPGA Design",
          "Embedded Systems",
          "Computer Vision",
          "ROS2",
          "Aerial Cinematography",
        ],
      },
      serviceType: [
        "Custom UAV Hardware Integration",
        "Computer Vision & SLAM",
        "Digital Twin & Gazebo Simulation",
        "FPGA & Embedded Systems",
        "Aerial Photography & Videography",
        "Research Platform Prototyping",
      ],
    },
    {
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
      url: siteUrl,
      name: "AJ Builds Drone",
      publisher: { "@id": `${siteUrl}/#business` },
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} antialiased bg-background text-foreground`}
      >
        <a href="#main" className="skip-to-content">
          SKIP TO CONTENT
        </a>
        <div className="scanline-overlay" aria-hidden="true" />
        <Navbar />
        <main id="main" className="min-h-screen">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
