"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";

interface Prospect {
  id: string;
  name: string;
  email: string;
  organization: string;
  department?: string;
  researchAreas: string[];
  matchingCapabilities: string[];
  score: number;
  tier: string;
}

interface EmailDraft {
  subject: string;
  body: string;
}

function generateEmail(prospect: Prospect): EmailDraft {
  const capabilities = prospect.matchingCapabilities.slice(0, 3).join(", ");
  const researchFocus = prospect.researchAreas[0] || "your research";

  return {
    subject: `Drone Data Collection Support for ${prospect.organization} — ${researchFocus}`,
    body: `Hi ${prospect.name.split(" ")[0]},

I came across your work in ${researchFocus} at ${prospect.organization}${prospect.department ? ` (${prospect.department})` : ""} and wanted to reach out.

We specialize in helping university research teams integrate drone-based data collection into their workflows. Based on your focus areas, I think our capabilities in ${capabilities} could significantly accelerate your fieldwork.

A few quick wins we've delivered for similar programs:
• 90% reduction in field survey time (see our case study: aj-builds-drone.github.io/case-studies)
• Publication-ready datasets with sub-centimeter accuracy
• Grant budget templates specifically for drone integration (aj-builds-drone.github.io/grant-calculator)

I'd love to do a quick 15-minute call to understand your current data collection workflow and see if there's a fit.

Would next Tuesday or Thursday work for a brief chat?

Best,
AJ
AJ Builds Drone | Custom UAV Systems
aj-builds-drone.github.io
FAA Part 107 Certified | Austin, TX`,
  };
}

// Mock data for when API is unavailable
const mockProspects: Prospect[] = [
  {
    id: "1",
    name: "Dr. Sarah Chen",
    email: "s.chen@university.edu",
    organization: "UT Austin",
    department: "Civil Engineering",
    researchAreas: ["Infrastructure Inspection", "Structural Health Monitoring"],
    matchingCapabilities: ["Bridge Inspection", "Photogrammetry", "3D Modeling"],
    score: 95,
    tier: "hot",
  },
  {
    id: "2",
    name: "Prof. James Walker",
    email: "j.walker@tamu.edu",
    organization: "Texas A&M",
    department: "Agricultural Sciences",
    researchAreas: ["Precision Agriculture", "Crop Monitoring"],
    matchingCapabilities: ["Multispectral Imaging", "NDVI Analysis", "Automated Flight Planning"],
    score: 92,
    tier: "hot",
  },
  {
    id: "3",
    name: "Dr. Maria Rodriguez",
    email: "m.rodriguez@utsa.edu",
    organization: "UT San Antonio",
    department: "Environmental Science",
    researchAreas: ["Wetland Mapping", "Habitat Assessment"],
    matchingCapabilities: ["LiDAR Surveys", "Orthomosaic Generation", "GIS Integration"],
    score: 88,
    tier: "hot",
  },
];

export default function EmailPreviewPage() {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedEmails, setEditedEmails] = useState<Record<string, EmailDraft>>({});
  const [statuses, setStatuses] = useState<Record<string, "pending" | "approved" | "skipped">>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProspects() {
      try {
        const res = await fetch("http://localhost:3002/outreach/top-prospects?tier=hot&limit=10");
        if (!res.ok) throw new Error("API unavailable");
        const data = await res.json();
        setProspects(data.prospects || data);
        setError(null);
      } catch {
        setProspects(mockProspects);
        setError("API unavailable — showing mock data for preview");
      } finally {
        setLoading(false);
      }
    }
    fetchProspects();
  }, []);

  const getEmail = (prospect: Prospect): EmailDraft => {
    return editedEmails[prospect.id] || generateEmail(prospect);
  };

  const handleApprove = (id: string) => {
    setStatuses((s) => ({ ...s, [id]: "approved" }));
    // In production, this would POST to the outreach API
  };

  const handleSkip = (id: string) => {
    setStatuses((s) => ({ ...s, [id]: "skipped" }));
  };

  const handleEdit = (id: string) => {
    const prospect = prospects.find((p) => p.id === id);
    if (!prospect) return;
    if (!editedEmails[id]) {
      setEditedEmails((e) => ({ ...e, [id]: generateEmail(prospect) }));
    }
    setEditingId(editingId === id ? null : id);
  };

  return (
    <main className="min-h-screen bg-background pt-24 pb-16">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="font-mono text-xs text-accent-orange tracking-widest">
              [SYS::OUTREACH_ADMIN] — EMAIL PREVIEW
            </div>
            <span className="font-mono text-[10px] px-2 py-0.5 border border-red-500/50 text-red-400 rounded">
              ADMIN ONLY
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-text-primary mb-4">
            Email <span className="text-accent-orange">Personalization</span> Preview
          </h1>
          <p className="text-text-secondary max-w-2xl">
            Review and approve personalized outreach emails for top-tier prospects.
            Each email is auto-generated based on research match data.
          </p>
        </motion.div>

        {error && (
          <div className="font-mono text-xs text-yellow-400 border border-yellow-400/30 bg-yellow-400/5 rounded px-4 py-3 mb-6">
            ⚠ {error}
          </div>
        )}

        {/* Stats Bar */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: "TOTAL PROSPECTS", value: prospects.length, color: "text-accent-green" },
            { label: "APPROVED", value: Object.values(statuses).filter((s) => s === "approved").length, color: "text-blue-400" },
            { label: "SKIPPED", value: Object.values(statuses).filter((s) => s === "skipped").length, color: "text-text-muted" },
          ].map((stat) => (
            <div key={stat.label} className="border border-border-dim rounded-lg p-4 bg-surface/50 text-center">
              <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
              <div className="font-mono text-[10px] text-text-muted tracking-widest mt-1">{stat.label}</div>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-20 font-mono text-text-muted text-sm">
            <div className="animate-pulse">Loading prospects...</div>
          </div>
        ) : (
          <div className="space-y-6">
            {prospects.map((prospect, i) => {
              const email = getEmail(prospect);
              const status = statuses[prospect.id];
              const isEditing = editingId === prospect.id;

              return (
                <motion.div
                  key={prospect.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={`border rounded-lg overflow-hidden transition-colors ${
                    status === "approved"
                      ? "border-accent-green/50 bg-accent-green/5"
                      : status === "skipped"
                      ? "border-border-dim bg-surface/20 opacity-60"
                      : "border-border-dim bg-surface/50 hover:border-border-bright"
                  }`}
                >
                  {/* Prospect Header */}
                  <div className="px-6 py-4 border-b border-border-dim flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <h2 className="font-semibold text-text-primary">{prospect.name}</h2>
                        <span className="font-mono text-[10px] px-2 py-0.5 border border-accent-orange/50 text-accent-orange rounded">
                          SCORE: {prospect.score}
                        </span>
                        {status && (
                          <span
                            className={`font-mono text-[10px] px-2 py-0.5 border rounded ${
                              status === "approved"
                                ? "border-accent-green/50 text-accent-green"
                                : "border-text-muted/50 text-text-muted"
                            }`}
                          >
                            {status.toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="font-mono text-xs text-text-secondary">
                        {prospect.organization}
                        {prospect.department && ` — ${prospect.department}`}
                      </div>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {prospect.researchAreas.map((area) => (
                          <span
                            key={area}
                            className="font-mono text-[10px] px-2 py-0.5 bg-blue-400/10 text-blue-400 rounded"
                          >
                            {area}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 ml-4">
                      {prospect.matchingCapabilities.map((cap) => (
                        <span
                          key={cap}
                          className="font-mono text-[10px] px-2 py-0.5 border border-accent-green/30 text-accent-green rounded"
                        >
                          {cap}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Email Preview */}
                  <div className="px-6 py-4">
                    <div className="font-mono text-[10px] text-text-muted tracking-widest mb-2">EMAIL PREVIEW</div>
                    <div className="border border-border-dim rounded bg-background/50 p-4">
                      <div className="text-xs text-text-muted mb-1 font-mono">Subject:</div>
                      {isEditing ? (
                        <input
                          className="w-full bg-surface border border-border-bright rounded px-2 py-1 text-sm text-text-primary mb-3 font-mono"
                          value={editedEmails[prospect.id]?.subject || email.subject}
                          onChange={(e) =>
                            setEditedEmails((prev) => ({
                              ...prev,
                              [prospect.id]: { ...getEmail(prospect), subject: e.target.value },
                            }))
                          }
                        />
                      ) : (
                        <div className="text-sm font-semibold text-text-primary mb-3">{email.subject}</div>
                      )}

                      <div className="text-xs text-text-muted mb-1 font-mono">Body:</div>
                      {isEditing ? (
                        <textarea
                          className="w-full bg-surface border border-border-bright rounded px-3 py-2 text-sm text-text-secondary font-mono min-h-[300px]"
                          value={editedEmails[prospect.id]?.body || email.body}
                          onChange={(e) =>
                            setEditedEmails((prev) => ({
                              ...prev,
                              [prospect.id]: { ...getEmail(prospect), body: e.target.value },
                            }))
                          }
                        />
                      ) : (
                        <pre className="text-sm text-text-secondary whitespace-pre-wrap font-sans leading-relaxed">
                          {email.body}
                        </pre>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  {!status && (
                    <div className="px-6 py-4 border-t border-border-dim flex gap-3">
                      <button
                        onClick={() => handleApprove(prospect.id)}
                        className="font-mono text-xs px-5 py-2.5 border border-accent-green text-accent-green rounded hover:bg-accent-green/10 transition-colors"
                      >
                        ✓ APPROVE & SEND
                      </button>
                      <button
                        onClick={() => handleEdit(prospect.id)}
                        className="font-mono text-xs px-5 py-2.5 border border-accent-orange text-accent-orange rounded hover:bg-accent-orange/10 transition-colors"
                      >
                        ✎ {isEditing ? "DONE EDITING" : "EDIT"}
                      </button>
                      <button
                        onClick={() => handleSkip(prospect.id)}
                        className="font-mono text-xs px-5 py-2.5 border border-border-bright text-text-muted rounded hover:bg-surface transition-colors"
                      >
                        ⊘ SKIP
                      </button>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
