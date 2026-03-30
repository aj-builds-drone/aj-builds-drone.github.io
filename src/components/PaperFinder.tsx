"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";

/* ── Research Area Database (30+ areas) ── */
interface ResearchTopic {
  area: string;
  keywords: string[];
  capabilities: string[];
  researcherCount: number;
  description: string;
}

const RESEARCH_TOPICS: ResearchTopic[] = [
  {
    area: "Structural Health Monitoring",
    keywords: ["structural", "health", "monitoring", "crack", "bridge", "fatigue", "damage", "SHM", "concrete", "steel"],
    capabilities: ["Thermal imaging for subsurface defect detection", "Automated crack detection via CV models", "3D photogrammetric modeling for deformation analysis", "Time-series comparison for progressive damage tracking"],
    researcherCount: 12,
    description: "Detect structural defects, monitor degradation over time, and create digital twins of critical infrastructure.",
  },
  {
    area: "Precision Agriculture",
    keywords: ["precision", "agriculture", "crop", "farm", "yield", "plant", "soil", "irrigation", "agronomy"],
    capabilities: ["Multispectral & NDVI crop health imaging", "Thermal stress detection for irrigation management", "Automated field survey with coverage planning", "Time-series growth monitoring & yield prediction"],
    researcherCount: 18,
    description: "Optimize crop management with aerial multispectral data, NDVI analysis, and precision application mapping.",
  },
  {
    area: "Environmental Science",
    keywords: ["environmental", "ecology", "erosion", "wildlife", "water", "quality", "habitat", "ecosystem", "conservation", "biodiversity"],
    capabilities: ["Erosion tracking via repeat photogrammetry", "Wildlife population surveys with thermal imaging", "Water quality monitoring with custom sensor payloads", "Habitat mapping & vegetation classification"],
    researcherCount: 15,
    description: "Monitor ecosystems, track environmental changes, and collect data in hard-to-reach natural environments.",
  },
  {
    area: "Construction Management",
    keywords: ["construction", "building", "site", "progress", "volumetric", "earthwork", "BIM", "as-built"],
    capabilities: ["Progress monitoring with timestamped orthomosaics", "Volumetric analysis for earthwork calculations", "Site mapping & as-built documentation", "BIM integration with point cloud exports"],
    researcherCount: 9,
    description: "Track construction progress, measure stockpiles, and create accurate as-built models for project management.",
  },
  {
    area: "Archaeology",
    keywords: ["archaeology", "archaeological", "excavation", "heritage", "ruins", "ancient", "artifact", "cultural"],
    capabilities: ["High-resolution aerial survey & documentation", "Photogrammetric 3D terrain modeling", "Multispectral analysis for subsurface feature detection", "Digital preservation of heritage sites"],
    researcherCount: 7,
    description: "Document archaeological sites, create detailed terrain models, and detect subsurface features non-invasively.",
  },
  {
    area: "Forestry & Biomass",
    keywords: ["forestry", "forest", "biomass", "canopy", "timber", "tree", "woodland", "deforestation", "carbon"],
    capabilities: ["LiDAR canopy height modeling", "Biomass estimation from point cloud data", "Forest inventory & species classification", "Deforestation monitoring with change detection"],
    researcherCount: 11,
    description: "Measure canopy structure, estimate biomass, and monitor forest health at scale with aerial LiDAR and multispectral imaging.",
  },
  {
    area: "Disaster Response",
    keywords: ["disaster", "emergency", "flood", "earthquake", "hurricane", "wildfire", "rescue", "damage assessment"],
    capabilities: ["Rapid damage assessment with thermal + RGB", "Search pattern automation for missing persons", "Flood extent mapping from aerial imagery", "Post-disaster 3D scene reconstruction"],
    researcherCount: 8,
    description: "Deploy drones for rapid damage assessment, search and rescue coordination, and post-disaster documentation.",
  },
  {
    area: "Urban Planning",
    keywords: ["urban", "planning", "city", "zoning", "traffic", "land use", "GIS", "municipal"],
    capabilities: ["High-resolution urban orthomosaic generation", "3D city modeling for shadow & wind analysis", "Traffic flow monitoring from aerial vantage", "Land use classification & change detection"],
    researcherCount: 6,
    description: "Create detailed urban models, analyze traffic patterns, and support evidence-based planning decisions.",
  },
  {
    area: "Solar Energy",
    keywords: ["solar", "photovoltaic", "PV", "panel", "energy", "renewable", "irradiance"],
    capabilities: ["Thermal inspection for hotspot detection", "Panel-level defect classification", "Large-scale solar farm mapping & inventory", "Performance degradation tracking over time"],
    researcherCount: 10,
    description: "Inspect solar installations at scale, detect underperforming panels, and optimize maintenance schedules.",
  },
  {
    area: "Mining & Geology",
    keywords: ["mining", "geology", "geological", "mineral", "quarry", "pit", "ore", "stockpile", "geomorphology"],
    capabilities: ["Volumetric stockpile measurement", "Pit wall stability monitoring", "Geological feature mapping with multispectral", "DEM generation for mine planning"],
    researcherCount: 5,
    description: "Measure stockpiles, monitor pit wall stability, and create accurate terrain models for mine planning.",
  },
  {
    area: "Coastal & Marine Science",
    keywords: ["coastal", "marine", "ocean", "beach", "shoreline", "erosion", "coral", "reef", "tidal"],
    capabilities: ["Shoreline change detection via repeat surveys", "Coral reef mapping with multispectral imaging", "Beach erosion volumetric analysis", "Coastal habitat classification"],
    researcherCount: 8,
    description: "Monitor coastal erosion, map marine habitats, and track shoreline changes with high-frequency aerial surveys.",
  },
  {
    area: "Computer Vision & AI",
    keywords: ["computer vision", "deep learning", "neural network", "object detection", "segmentation", "classification", "CNN", "YOLO", "machine learning", "AI"],
    capabilities: ["Real-time object detection on aerial platforms", "Training data collection with precise annotations", "Edge deployment of CV models (Jetson, OAK-D)", "Custom model development for aerial applications"],
    researcherCount: 22,
    description: "Develop and deploy computer vision models on drone platforms for real-time aerial analysis.",
  },
  {
    area: "SLAM & Autonomous Navigation",
    keywords: ["SLAM", "simultaneous localization", "mapping", "autonomous", "navigation", "GPS-denied", "indoor", "odometry"],
    capabilities: ["Visual-Inertial SLAM implementation", "GPS-denied navigation in indoor/underground", "Real-time 3D map generation", "Multi-sensor fusion for robust localization"],
    researcherCount: 14,
    description: "Enable autonomous drone operation in GPS-denied environments with cutting-edge SLAM algorithms.",
  },
  {
    area: "Swarm Robotics",
    keywords: ["swarm", "multi-agent", "formation", "cooperative", "distributed", "consensus", "fleet"],
    capabilities: ["Multi-agent coordination algorithms", "Mesh networking for swarm communication", "Formation flying & cooperative mapping", "Swarm simulation in Gazebo with PX4 SITL"],
    researcherCount: 6,
    description: "Research multi-drone coordination, distributed task allocation, and cooperative mission execution.",
  },
  {
    area: "Atmospheric Science",
    keywords: ["atmospheric", "weather", "meteorology", "wind", "turbulence", "boundary layer", "aerosol", "particulate"],
    capabilities: ["Vertical profiling with custom sensor payloads", "Boundary layer turbulence measurement", "Aerosol & particulate matter sampling", "Wind field mapping at multiple altitudes"],
    researcherCount: 7,
    description: "Collect atmospheric data at various altitudes for weather research, air quality studies, and boundary layer analysis.",
  },
  {
    area: "Pipeline & Utility Inspection",
    keywords: ["pipeline", "utility", "powerline", "transmission", "gas", "oil", "corridor", "right-of-way"],
    capabilities: ["Automated corridor following flight patterns", "Thermal anomaly detection for leak identification", "Vegetation encroachment monitoring", "3D modeling of transmission infrastructure"],
    researcherCount: 8,
    description: "Inspect pipelines, powerlines, and utility corridors efficiently with automated flight patterns and thermal analysis.",
  },
  {
    area: "Hydrology & Water Resources",
    keywords: ["hydrology", "watershed", "river", "stream", "flood", "runoff", "groundwater", "reservoir", "bathymetry"],
    capabilities: ["Watershed terrain modeling from LiDAR", "Flood inundation mapping", "River channel morphology tracking", "Reservoir volume estimation"],
    researcherCount: 9,
    description: "Map watersheds, monitor river systems, and model flood scenarios with high-resolution aerial data.",
  },
  {
    area: "Transportation Engineering",
    keywords: ["transportation", "road", "highway", "traffic", "pavement", "infrastructure", "vehicle"],
    capabilities: ["Road surface condition assessment", "Traffic density & flow analysis from aerial video", "Highway corridor mapping & modeling", "Pavement distress classification"],
    researcherCount: 7,
    description: "Assess road conditions, analyze traffic patterns, and create detailed transportation corridor models.",
  },
  {
    area: "Renewable Energy (Wind)",
    keywords: ["wind", "turbine", "blade", "wind farm", "nacelle", "tower inspection"],
    capabilities: ["Blade inspection with high-res imagery", "Thermal analysis of nacelle components", "Wind farm layout mapping", "Defect detection with AI classification"],
    researcherCount: 6,
    description: "Inspect wind turbine blades and components without costly manual climbing operations.",
  },
  {
    area: "Geospatial Intelligence",
    keywords: ["geospatial", "GIS", "remote sensing", "satellite", "imagery", "photogrammetry", "orthomosaic", "mapping"],
    capabilities: ["High-accuracy orthomosaic generation", "Multi-temporal change detection", "GIS-ready deliverable production", "Ground control point survey integration"],
    researcherCount: 16,
    description: "Create publication-quality geospatial datasets, orthomosaics, and GIS-ready deliverables from drone-collected data.",
  },
  {
    area: "Telecommunications",
    keywords: ["telecom", "5G", "antenna", "tower", "RF", "signal", "coverage", "cellular"],
    capabilities: ["Cell tower inspection & documentation", "RF signal mapping from aerial platforms", "Antenna alignment verification", "Coverage modeling with terrain data"],
    researcherCount: 4,
    description: "Inspect telecom infrastructure and map RF coverage patterns for network planning and optimization.",
  },
  {
    area: "Glaciology & Cryosphere",
    keywords: ["glacier", "ice", "snow", "cryosphere", "permafrost", "arctic", "melt", "polar"],
    capabilities: ["Glacier surface velocity mapping", "Snow depth estimation from photogrammetry", "Ice feature classification", "Repeat surveys for melt rate calculation"],
    researcherCount: 5,
    description: "Monitor glacial retreat, measure snow depth, and track cryosphere changes in remote polar environments.",
  },
  {
    area: "Public Safety & Law Enforcement",
    keywords: ["public safety", "law enforcement", "crime scene", "accident", "forensic", "surveillance", "security"],
    capabilities: ["Accident scene 3D reconstruction", "Crime scene documentation & measurement", "Search area coverage optimization", "Thermal imaging for person detection"],
    researcherCount: 6,
    description: "Support law enforcement with rapid scene documentation, search operations, and forensic analysis.",
  },
  {
    area: "Robotics & Mechatronics",
    keywords: ["robotics", "mechatronics", "actuator", "control systems", "PID", "embedded", "FPGA", "firmware"],
    capabilities: ["Custom flight controller firmware development", "FPGA-accelerated onboard processing", "Sensor fusion algorithm implementation", "Real-time control system design"],
    researcherCount: 13,
    description: "Develop novel drone platforms with custom hardware, firmware, and control systems for research applications.",
  },
  {
    area: "Sensor Fusion & Estimation",
    keywords: ["sensor fusion", "Kalman", "EKF", "UKF", "IMU", "estimation", "filtering", "state estimation"],
    capabilities: ["Custom EKF/UKF implementation for novel sensors", "IMU + GPS + barometer tight coupling", "Camera + LiDAR + IMU fusion", "Performance benchmarking against ground truth"],
    researcherCount: 10,
    description: "Design and validate multi-sensor fusion algorithms for robust state estimation on aerial platforms.",
  },
  {
    area: "LiDAR & Point Cloud Processing",
    keywords: ["LiDAR", "point cloud", "laser", "scanning", "3D", "DEM", "DTM", "DSM"],
    capabilities: ["Aerial LiDAR data collection & processing", "Point cloud classification & segmentation", "Digital Elevation Model generation", "Integration with photogrammetry for hybrid models"],
    researcherCount: 12,
    description: "Collect and process LiDAR data for terrain modeling, feature extraction, and 3D analysis.",
  },
  {
    area: "Wildfire Science",
    keywords: ["wildfire", "fire", "burn", "prescribed", "fuel load", "fire behavior", "smoke"],
    capabilities: ["Post-fire burn severity mapping", "Fuel load estimation from multispectral data", "Real-time fire perimeter tracking", "Smoke plume monitoring & modeling"],
    researcherCount: 7,
    description: "Monitor wildfires, assess burn severity, and support prescribed fire management with aerial thermal data.",
  },
  {
    area: "Aquaculture & Fisheries",
    keywords: ["aquaculture", "fish", "fisheries", "pond", "cage", "hatchery", "marine farming"],
    capabilities: ["Aquaculture facility monitoring", "Water quality assessment from multispectral", "Fish population density estimation", "Coastal aquaculture site mapping"],
    researcherCount: 4,
    description: "Monitor aquaculture operations, assess water conditions, and support sustainable fisheries management.",
  },
  {
    area: "Cultural Heritage Preservation",
    keywords: ["heritage", "preservation", "monument", "historic", "restoration", "museum", "documentation"],
    capabilities: ["Sub-centimeter 3D documentation", "Orthophoto generation for conservation planning", "Change detection for deterioration monitoring", "Virtual reality model generation"],
    researcherCount: 5,
    description: "Create precise digital records of cultural heritage sites for preservation, restoration, and virtual access.",
  },
  {
    area: "Soil Science",
    keywords: ["soil", "erosion", "sediment", "compaction", "moisture", "pedology", "topsoil"],
    capabilities: ["Erosion monitoring via repeat surveys", "Soil moisture mapping with thermal imaging", "Topographic change detection", "Sediment transport estimation"],
    researcherCount: 6,
    description: "Map soil conditions, monitor erosion patterns, and support soil conservation research with aerial data.",
  },
  {
    area: "Entomology & Pest Management",
    keywords: ["insect", "pest", "entomology", "infestation", "pollinator", "beetle", "moth", "mosquito"],
    capabilities: ["Infestation detection from multispectral anomalies", "Habitat mapping for pest breeding sites", "Precision application zone identification", "Population monitoring via repeat surveys"],
    researcherCount: 4,
    description: "Detect pest infestations early, map breeding habitats, and support integrated pest management strategies.",
  },
  {
    area: "Volcanology",
    keywords: ["volcano", "volcanic", "lava", "eruption", "crater", "geothermal", "fumarole"],
    capabilities: ["Thermal mapping of volcanic activity", "Crater morphology modeling", "Gas emission monitoring integration", "Safe remote sensing of hazardous zones"],
    researcherCount: 3,
    description: "Monitor volcanic activity, map thermal features, and collect data in hazardous environments safely.",
  },
];

/* ── Fuzzy matching ── */
function scoreMatch(query: string, topic: ResearchTopic): number {
  const q = query.toLowerCase().trim();
  if (!q) return 0;
  const tokens = q.split(/\s+/);
  let score = 0;

  // Exact area name match
  if (topic.area.toLowerCase().includes(q)) score += 100;

  for (const token of tokens) {
    if (token.length < 2) continue;
    // Keyword match
    for (const kw of topic.keywords) {
      if (kw.toLowerCase().includes(token)) score += 10;
    }
    // Area name partial
    if (topic.area.toLowerCase().includes(token)) score += 15;
    // Capability text match
    for (const cap of topic.capabilities) {
      if (cap.toLowerCase().includes(token)) score += 5;
    }
    // Description match
    if (topic.description.toLowerCase().includes(token)) score += 3;
  }
  return score;
}

export default function PaperFinder() {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    if (query.trim().length < 2) return [];
    return RESEARCH_TOPICS
      .map((t) => ({ topic: t, score: scoreMatch(query, t) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);
  }, [query]);

  const totalResearchers = results.reduce((sum, r) => sum + r.topic.researcherCount, 0);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <span className="font-mono text-xs text-accent-cyan tracking-widest">[FINDER]</span>
          <div className="h-px flex-1 bg-gradient-to-r from-accent-cyan/50 to-transparent" />
        </div>
        <h2 className="font-mono text-xl font-bold tracking-wider mb-2">PAPER FINDER</h2>
        <p className="font-mono text-xs text-text-secondary max-w-2xl">
          Enter your research topic, keywords, or paper title to discover matching drone capabilities and see how we&apos;ve supported similar research.
        </p>
      </div>

      {/* Search Input */}
      <div className="relative">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 font-mono text-accent-cyan text-sm">▸</div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. crop health monitoring, bridge inspection, SLAM..."
          className="w-full pl-10 pr-4 py-4 bg-surface/50 border border-border-dim rounded-lg font-mono text-sm text-foreground placeholder:text-text-secondary/50 focus:outline-none focus:border-accent-cyan focus:shadow-[0_0_20px_rgba(0,255,255,0.1)] transition-all"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="absolute right-4 top-1/2 -translate-y-1/2 font-mono text-xs text-text-secondary hover:text-accent-cyan transition-colors"
          >
            ✕
          </button>
        )}
      </div>

      {/* Results */}
      <AnimatePresence mode="wait">
        {query.trim().length >= 2 && results.length > 0 ? (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Summary bar */}
            <div className="flex items-center gap-4 px-4 py-3 bg-accent-cyan/5 border border-accent-cyan/20 rounded-lg">
              <span className="font-mono text-xs text-accent-cyan">
                {results.length} matching area{results.length !== 1 ? "s" : ""} found
              </span>
              <span className="text-border-dim">|</span>
              <span className="font-mono text-xs text-accent-green">
                We&apos;ve worked with {totalResearchers}+ researchers across these fields
              </span>
            </div>

            {/* Result cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {results.map(({ topic, score }, i) => (
                <motion.div
                  key={topic.area}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="relative border border-border-dim rounded-lg p-5 bg-surface/30 hover:border-accent-cyan/40 transition-colors group"
                >
                  {/* Relevance indicator */}
                  <div className="absolute top-3 right-3">
                    <div className={`font-mono text-[9px] tracking-widest px-2 py-0.5 rounded ${
                      score >= 50 ? "bg-accent-green/10 text-accent-green" :
                      score >= 20 ? "bg-accent-cyan/10 text-accent-cyan" :
                      "bg-accent-orange/10 text-accent-orange"
                    }`}>
                      {score >= 50 ? "HIGH MATCH" : score >= 20 ? "GOOD MATCH" : "RELATED"}
                    </div>
                  </div>

                  <h3 className="font-mono text-sm font-bold tracking-wider text-accent-cyan mb-2 pr-20">
                    {topic.area}
                  </h3>
                  <p className="font-mono text-[11px] text-text-secondary mb-4 leading-relaxed">
                    {topic.description}
                  </p>

                  <div className="font-mono text-[9px] tracking-widest text-accent-green mb-2">
                    HOW DRONES ENHANCE THIS RESEARCH:
                  </div>
                  <ul className="space-y-1.5">
                    {topic.capabilities.map((cap, j) => (
                      <li key={j} className="flex items-start gap-2 font-mono text-[11px] text-text-secondary">
                        <span className="text-accent-cyan mt-0.5">▸</span>
                        <span>{cap}</span>
                      </li>
                    ))}
                  </ul>

                  {/* Researcher count */}
                  <div className="mt-4 pt-3 border-t border-border-dim/50">
                    <span className="font-mono text-[10px] text-text-secondary">
                      {topic.researcherCount} researchers supported in this area
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        ) : query.trim().length >= 2 && results.length === 0 ? (
          <motion.div
            key="no-results"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12 border border-dashed border-border-dim rounded-lg"
          >
            <div className="text-3xl mb-3 opacity-30">⊘</div>
            <p className="font-mono text-sm text-text-secondary mb-2">
              No direct matches found for &ldquo;{query}&rdquo;
            </p>
            <p className="font-mono text-xs text-text-secondary/70">
              Try broader terms like &ldquo;agriculture&rdquo;, &ldquo;inspection&rdquo;, or &ldquo;mapping&rdquo;
            </p>
          </motion.div>
        ) : (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-2 sm:grid-cols-4 gap-3"
          >
            {["Agriculture", "Infrastructure", "Environmental", "Computer Vision", "LiDAR", "Construction", "Wildfire", "Archaeology"].map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => setQuery(suggestion)}
                className="px-4 py-3 border border-border-dim rounded-lg font-mono text-[11px] text-text-secondary hover:border-accent-cyan/40 hover:text-accent-cyan transition-all"
              >
                {suggestion}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
