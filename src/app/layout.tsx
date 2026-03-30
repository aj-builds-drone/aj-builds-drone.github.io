import Script from "next/script";
import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ClientOverlays from "@/components/ClientOverlays";

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

const siteUrl = "https://aj-builds-drone.github.io";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "AJ Builds Drone | Custom UAV Systems Contractor — Austin, TX",
    template: "%s | AJ Builds Drone",
  },
  description:
    "FAA Part 107 certified drone contractor & Sr. FPGA Engineer. Custom UAV builds, PX4/ArduPilot integration, computer vision & SLAM, Gazebo simulation, aerial cinematography, and FPGA-based embedded systems. Austin TX — operating globally. Request a free quote today.",
  keywords: [
    "drone contractor Austin TX",
    "custom drone builder",
    "UAV systems engineer",
    "PX4 developer",
    "ArduPilot integrator",
    "ROS2 drone developer",
    "computer vision SLAM drone",
    "Gazebo simulation UAV",
    "custom drone build service",
    "FAA Part 107 certified pilot",
    "FPGA embedded systems engineer",
    "aerial photography Austin Texas",
    "drone cinematography services",
    "research drone prototyping",
    "university drone lab setup",
    "NXP HoverGames",
    "STM32 flight controller",
    "drone consulting services",
    "autonomous UAV development",
    "hire drone engineer",
  ],
  authors: [{ name: "Ajaya Dahal", url: "https://ajayadahal.github.io" }],
  creator: "Ajaya Dahal",
  publisher: "AJ Builds Drone",
  category: "Technology",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "AJ Builds Drone",
    title: "AJ Builds Drone | Custom UAV Systems Contractor — Austin, TX",
    description:
      "FAA Part 107 certified. Custom UAV builds, PX4 integration, computer vision & SLAM, FPGA embedded systems, and aerial cinematography. From simulation to maiden flight. Get a free quote.",
    images: [
      {
        url: "/og-home.jpg",
        width: 1200,
        height: 630,
        alt: "AJ Builds Drone — Custom UAV Systems Contractor, Austin TX",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "AJ Builds Drone | Custom UAV Systems Contractor",
    description:
      "FAA Part 107 certified. Custom UAV builds, PX4, FPGA, aerial cinematography. Austin TX — operating globally.",
    images: ["/og-home.jpg"],
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
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
  verification: {
    google: "J-Ig1JWNUfSvaqwT4jU-zAmoVk3K8OTGa4V8nf3LJ4w",
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
      logo: `${siteUrl}/og-image.png`,
      image: `${siteUrl}/og-image.png`,
      description:
        "Professional UAV systems contractor offering custom drone builds, FPGA integration, computer vision & SLAM, Gazebo simulation, and aerial cinematography. FAA Part 107 certified. Austin TX — operating globally.",
      areaServed: {
        "@type": "Place",
        name: "Worldwide",
      },
      address: {
        "@type": "PostalAddress",
        addressLocality: "Austin",
        addressRegion: "TX",
        addressCountry: "US",
      },
      priceRange: "$$",
      email: "ajayadesign@gmail.com",
      founder: { "@id": `${siteUrl}/#person` },
      serviceType: [
        "Custom UAV Hardware Integration",
        "Computer Vision & SLAM Development",
        "Digital Twin & Gazebo Simulation",
        "FPGA & Embedded Systems Design",
        "Aerial Photography & Videography",
        "Research Platform Prototyping",
        "University Drone Lab Setup",
        "Competition Team Consulting",
      ],
      hasOfferCatalog: {
        "@type": "OfferCatalog",
        name: "Drone Engineering Services",
        itemListElement: [
          {
            "@type": "Offer",
            itemOffered: {
              "@type": "Service",
              name: "Custom Hardware Integration",
              description: "Complete UAV platform builds from component selection through maiden flight certification.",
            },
          },
          {
            "@type": "Offer",
            itemOffered: {
              "@type": "Service",
              name: "Computer Vision & SLAM",
              description: "Visual perception pipelines for autonomous operation in GPS-denied environments.",
            },
          },
          {
            "@type": "Offer",
            itemOffered: {
              "@type": "Service",
              name: "Gazebo Simulation & Digital Twin",
              description: "High-fidelity simulation environments for safe, repeatable testing of autonomous flight algorithms.",
            },
          },
          {
            "@type": "Offer",
            itemOffered: {
              "@type": "Service",
              name: "FPGA & Embedded Systems",
              description: "Custom FPGA and embedded system design for high-speed data processing and real-time control.",
            },
          },
          {
            "@type": "Offer",
            itemOffered: {
              "@type": "Service",
              name: "Aerial Photography & Videography",
              description: "FAA Part 107 certified professional aerial cinematography for real estate, events, and construction.",
            },
          },
        ],
      },
    },
    {
      "@type": "Person",
      "@id": `${siteUrl}/#person`,
      name: "Ajaya Dahal",
      jobTitle: "UAV Systems Contractor & Sr. FPGA Engineer",
      url: "https://ajayadahal.github.io",
      sameAs: [
        "https://www.linkedin.com/in/ajaya-dahal-137b94108/",
        "https://www.youtube.com/@ajayadahal6160",
        "https://github.com/ajayadahal",
        "https://www.hackster.io/ajayadahal",
        "https://scholar.google.com/citations?user=86hOknYAAAAJ&hl=en&oi=ao",
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
        "ArduPilot",
        "FPGA Design",
        "Embedded Systems",
        "Computer Vision",
        "SLAM Navigation",
        "ROS2",
        "Gazebo Simulation",
        "Aerial Cinematography",
        "SystemVerilog",
        "PCB Design",
      ],
    },
    {
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
      url: siteUrl,
      name: "AJ Builds Drone",
      description: "Custom UAV systems contractor — from simulation to maiden flight.",
      publisher: { "@id": `${siteUrl}/#business` },
    },
    {
      "@type": "BreadcrumbList",
      "@id": `${siteUrl}/#breadcrumb`,
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
        { "@type": "ListItem", position: 2, name: "Projects", item: `${siteUrl}/projects/` },
        { "@type": "ListItem", position: 3, name: "Services", item: `${siteUrl}/services/` },
        { "@type": "ListItem", position: 4, name: "Contact", item: `${siteUrl}/contact/` },
      ],
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
        <link rel="dns-prefetch" href="https://api.github.com" />
        <link rel="preconnect" href="https://api.github.com" crossOrigin="anonymous" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {/* Google Analytics 4 */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"
          strategy="afterInteractive"
        />
        <Script id="ga4-init" strategy="afterInteractive">
          {`window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-XXXXXXXXXX');`}
        </Script>

        {/* Microsoft Clarity */}
        <Script id="clarity-init" strategy="afterInteractive">
          {`(function(c,l,a,r,i,t,y){
              c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
              t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
              y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
            })(window, document, "clarity", "script", "CLARITY_PROJECT_ID");`}
        </Script>
      </head>
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} antialiased bg-background text-foreground`}
      >
        <a href="#main" className="skip-to-content">
          SKIP TO CONTENT
        </a>
        <div className="scanline-overlay" aria-hidden="true" />
        <ClientOverlays />
        <Navbar />
        <main id="main" className="min-h-screen">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
