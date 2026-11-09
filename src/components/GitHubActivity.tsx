"use client";

/* ── GitHub Activity Heatmap ──
   Real contribution calendar (github-contributions-api.jogruber.de serves
   GitHub's public calendar with CORS) + the latest public push per repo. */

import { useState, useEffect } from "react";
import { motion } from "framer-motion";

interface ContributionDay {
  date: string;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
}

interface RepoPush {
  repo: string;
  branch: string;
  date: string;
  sha: string;
  url: string;
}

interface GitHubEvent {
  type: string;
  repo: { name: string };
  payload: { ref?: string; head?: string };
  created_at: string;
}

const GITHUB_USERNAME = "ajayadahal";

function daysAgo(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  return days === 0 ? "today" : days === 1 ? "1d ago" : `${days}d ago`;
}

const LEVEL_COLORS = [
  "#161b22", // 0: none
  "#0e4429", // 1: low
  "#006d32", // 2: medium
  "#26a641", // 3: high
  "#39d353", // 4: very high
];

export default function GitHubActivity() {
  const [contributions, setContributions] = useState<ContributionDay[]>([]);
  const [totalContributions, setTotalContributions] = useState<number | null>(null);
  const [calendarFailed, setCalendarFailed] = useState(false);
  const [pushes, setPushes] = useState<RepoPush[]>([]);
  const [pushesFailed, setPushesFailed] = useState(false);

  useEffect(() => {
    fetch(`https://github-contributions-api.jogruber.de/v4/${GITHUB_USERNAME}?y=last`)
      .then((res) => {
        if (!res.ok) throw new Error(`calendar ${res.status}`);
        return res.json() as Promise<{ total: { lastYear: number }; contributions: ContributionDay[] }>;
      })
      .then((data) => {
        setContributions(data.contributions);
        setTotalContributions(data.total.lastYear);
      })
      .catch(() => setCalendarFailed(true));

    // Push events no longer carry commit messages, so list repo, branch and head commit.
    fetch(`https://api.github.com/users/${GITHUB_USERNAME}/events/public?per_page=100`, { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error(`events ${res.status}`);
        return res.json() as Promise<GitHubEvent[]>;
      })
      .then((events) => {
        const latest = new Map<string, RepoPush>();
        for (const e of events) {
          if (e.type !== "PushEvent" || !e.payload.head || latest.has(e.repo.name)) continue;
          latest.set(e.repo.name, {
            repo: e.repo.name.split("/")[1] || e.repo.name,
            branch: (e.payload.ref ?? "").replace("refs/heads/", ""),
            date: daysAgo(e.created_at),
            sha: e.payload.head.slice(0, 7),
            url: `https://github.com/${e.repo.name}/commit/${e.payload.head}`,
          });
        }
        if (latest.size === 0) throw new Error("no public pushes");
        setPushes([...latest.values()].slice(0, 5));
      })
      .catch(() => setPushesFailed(true));
  }, []);

  // Build the heatmap grid (52 weeks x 7 days)
  const weeks: ContributionDay[][] = [];
  for (let i = 0; i < contributions.length; i += 7) {
    weeks.push(contributions.slice(i, i + 7));
  }

  return (
    <section className="py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          className="mb-12"
        >
          <div className="flex items-center gap-3 mb-2">
            <span className="font-mono text-xs text-accent-orange tracking-widest">[GIT]</span>
            <div className="h-px flex-1 bg-gradient-to-r from-accent-orange/50 to-transparent" />
          </div>
          <h2 className="font-mono text-2xl md:text-3xl font-bold tracking-wider">
            COMMIT LOG
          </h2>
          <p className="mt-2 text-text-secondary text-sm">
            {totalContributions === null
              ? "Public activity from GitHub."
              : `Live from GitHub — ${totalContributions.toLocaleString()} contributions in the last year.`}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="grid grid-cols-1 lg:grid-cols-3 gap-6"
        >
          {/* Heatmap */}
          <div className="lg:col-span-2 border border-border-dim bg-surface rounded-lg p-4 md:p-6 hud-corners overflow-x-auto" tabIndex={0} role="img" aria-label="GitHub contribution heatmap showing activity over the last year">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-1.5 h-1.5 bg-accent-green rounded-full pulse-green" />
              <span className="font-mono text-[10px] tracking-widest text-accent-green">
                CONTRIBUTION HEATMAP
              </span>
            </div>

            {calendarFailed && (
              <p className="font-mono text-xs text-text-secondary mb-3">
                The contribution calendar didn&apos;t load. It&apos;s on the GitHub profile.
              </p>
            )}

            {/* Grid */}
            <div className="flex gap-[3px] min-w-[700px]">
              {weeks.map((week, wi) => (
                <div key={wi} className="flex flex-col gap-[3px]">
                  {week.map((day, di) => (
                    <div
                      key={`${wi}-${di}`}
                      className="w-[11px] h-[11px] rounded-sm"
                      style={{ backgroundColor: LEVEL_COLORS[day.level] }}
                      title={`${day.date}: ${day.count} contributions`}
                    />
                  ))}
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className="flex items-center justify-end gap-2 mt-3 font-mono text-[9px] text-text-secondary">
              <span>Less</span>
              {LEVEL_COLORS.map((color, i) => (
                <div key={i} className="w-[11px] h-[11px] rounded-sm" style={{ backgroundColor: color }} />
              ))}
              <span>More</span>
            </div>
          </div>

          {/* Recent commits */}
          <div className="border border-border-dim bg-surface rounded-lg p-4 md:p-6 hud-corners">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-1.5 h-1.5 bg-accent-orange rounded-full" />
              <span className="font-mono text-[10px] tracking-widest text-accent-orange">
                RECENT PUSHES
              </span>
            </div>

            <div className="space-y-4">
              {pushesFailed && (
                <p className="font-mono text-xs text-text-secondary leading-relaxed">
                  GitHub isn&apos;t answering right now. The full history is on the profile.
                </p>
              )}
              {pushes.map((push) => (
                <div key={push.repo} className="border-b border-border-dim pb-3 last:border-0 last:pb-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-[10px] text-accent-cyan bg-accent-cyan/10 px-1.5 py-0.5 rounded">
                      {push.repo}
                    </span>
                    <span className="font-mono text-[9px] text-text-secondary ml-auto">{push.date}</span>
                  </div>
                  <p className="font-mono text-xs text-text-secondary leading-relaxed truncate">
                    pushed to {push.branch}
                  </p>
                  <a
                    href={push.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-[9px] text-accent-green hover:text-foreground transition-colors"
                  >
                    {push.sha}
                  </a>
                </div>
              ))}
            </div>

            <a
              href={`https://github.com/${GITHUB_USERNAME}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 font-mono text-[10px] tracking-widest text-accent-orange hover:text-foreground transition-colors"
            >
              VIEW ON GITHUB →
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
