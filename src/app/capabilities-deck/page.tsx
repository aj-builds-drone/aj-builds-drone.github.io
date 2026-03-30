import { getProjects } from "@/lib/getProjects";

export const metadata = {
  title: "Capabilities Deck — AJ Builds Drone",
  robots: "noindex",
};

export default async function CapabilitiesDeckPage() {
  const projects = await getProjects();
  const featured = projects.slice(0, 3);

  return (
    <div className="min-h-screen bg-white text-gray-900 print:text-black">
      <style
        dangerouslySetInnerHTML={{ __html: `
          @media print {
            nav, footer, .no-print { display: none !important; }
            body { background: white !important; }
            @page { margin: 0.5in; size: letter; }
          }
          .deck-page {
            max-width: 8.5in;
            margin: 0 auto;
            padding: 2rem;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;
          }
          .deck-page h1, .deck-page h2, .deck-page h3 { font-family: inherit; }
        ` }}
      />

      <div className="deck-page">
        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-gray-900 pb-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">AJ BUILDS DRONE</h1>
            <p className="text-sm text-gray-600 mt-1">
              Custom UAV Platforms for Academic Research &amp; Industrial Inspection
            </p>
          </div>
          <div className="text-right text-xs text-gray-500">
            <div>aj-builds-drone.github.io</div>
            <div>FAA Part 107 Certified</div>
            <div className="mt-1 inline-block border border-green-700 text-green-700 px-2 py-0.5 rounded text-[10px] font-bold">
              ✓ PART 107
            </div>
          </div>
        </div>

        {/* Services */}
        <h2 className="text-lg font-bold mb-4 tracking-wider">SERVICES</h2>
        <div className="grid grid-cols-2 gap-4 mb-8">
          {[
            { icon: "⬡", title: "Custom UAV Data Pipelines", desc: "Sensor → Cloud → Analysis. Multispectral, LiDAR, thermal." },
            { icon: "◈", title: "Automated Flight Planning", desc: "Survey grids, terrain-following, multi-battery missions." },
            { icon: "◉", title: "Computer Vision Integration", desc: "Crop analysis, defect detection, environmental monitoring." },
            { icon: "▣", title: "Research Proposal Support", desc: "Equipment specs, BOMs, and budget justifications for grants." },
          ].map((s) => (
            <div key={s.title} className="border border-gray-300 rounded p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{s.icon}</span>
                <h3 className="text-sm font-bold">{s.title}</h3>
              </div>
              <p className="text-xs text-gray-600">{s.desc}</p>
            </div>
          ))}
        </div>

        {/* Example Builds */}
        <h2 className="text-lg font-bold mb-4 tracking-wider">EXAMPLE BUILDS</h2>
        <div className="grid grid-cols-3 gap-4 mb-8">
          {featured.map((p) => (
            <div key={p.id} className="border border-gray-300 rounded p-3">
              <h3 className="text-xs font-bold mb-2 leading-tight">{p.title}</h3>
              <p className="text-[10px] text-gray-600 mb-2">{p.subtitle}</p>
              <div className="space-y-0.5">
                {Object.entries(p.specs || {}).slice(0, 4).map(([k, v]) => (
                  <div key={k} className="text-[10px]">
                    <span className="text-gray-500">{k}:</span>{" "}
                    <span className="font-medium">{v}</span>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {p.softwareStack?.slice(0, 3).map((s) => (
                  <span
                    key={s}
                    className="text-[9px] bg-gray-100 border border-gray-200 rounded px-1.5 py-0.5"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Research Areas */}
        <h2 className="text-lg font-bold mb-4 tracking-wider">RESEARCH AREAS</h2>
        <div className="flex flex-wrap gap-3 mb-8">
          {[
            "Environmental Monitoring",
            "Agricultural Survey",
            "Infrastructure Inspection",
            "Search & Rescue",
            "Geological Mapping",
          ].map((area) => (
            <span
              key={area}
              className="text-xs border border-gray-400 rounded-full px-3 py-1"
            >
              {area}
            </span>
          ))}
        </div>

        {/* Footer */}
        <div className="border-t-2 border-gray-900 pt-4 mt-auto flex items-center justify-between">
          <div className="text-xs text-gray-600">
            <div className="font-bold text-gray-900">Get a Quote</div>
            <div>aj-builds-drone.github.io/services/ai-automation</div>
            <div>Quotes starting at $2,500 for research platforms</div>
          </div>
          <div className="text-right text-[10px] text-gray-400">
            <div>Austin, TX — Available Nationwide</div>
            <div>FAA Part 107 • PX4 • ROS2 • Computer Vision</div>
          </div>
        </div>
      </div>
    </div>
  );
}
