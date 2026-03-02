"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { SectionHeader } from "@/components/HUDElements";

const FORMSUBMIT_URL =
  "https://formsubmit.co/ajax/9dc23f5c5eb6fba941487190ff80294b";

const serviceOptions = [
  "Custom Hardware Integration",
  "Computer Vision & SLAM",
  "Digital Twin & Gazebo Simulation",
  "FPGA & Embedded Systems",
  "Aerial Photography & Videography",
  "Research Platform Prototyping",
  "Curriculum Development Support",
  "Competition Team Consulting",
  "Other (describe in message)",
];

const budgetRanges = [
  "< $5,000",
  "$5,000 – $15,000",
  "$15,000 – $50,000",
  "$50,000+",
  "To be determined",
];

const timelineOptions = [
  "< 1 month",
  "1 – 3 months",
  "3 – 6 months",
  "6+ months",
  "Ongoing retainer",
];

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: "",
    org: "",
    email: "",
    service: "",
    budget: "",
    timeline: "",
    message: "",
  });
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle"
  );
  const [refId, setRefId] = useState("");

  function handleChange(
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");

    const ref = "RFQ-" + Date.now().toString(36).toUpperCase();
    setRefId(ref);

    // Build FormSubmit payload
    const payload = new FormData();
    payload.append("name", formData.name);
    payload.append("email", formData.email);
    payload.append("organization", formData.org);
    payload.append("service", formData.service);
    payload.append("budget", formData.budget);
    payload.append("timeline", formData.timeline);
    payload.append("message", formData.message);
    payload.append(
      "_subject",
      `Drone RFQ: ${formData.service || "General Inquiry"} [${ref}]`
    );
    payload.append("_captcha", "false");
    payload.append("_template", "box");

    try {
      const res = await fetch(FORMSUBMIT_URL, {
        method: "POST",
        headers: { Accept: "application/json" },
        body: payload,
      });
      if (!res.ok) throw new Error(`Status ${res.status}`);
      setStatus("sent");
    } catch (err) {
      console.error("[RFQ] FormSubmit failed:", err);
      setStatus("error");
    }
  }

  return (
    <div className="pt-24 pb-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Page Header */}
        <div className="mb-6">
          <div className="font-mono text-xs tracking-[0.3em] text-accent-green mb-4">
            ▸ SECURE CHANNEL OPEN
          </div>
          <SectionHeader
            code="RFQ"
            title="REQUEST FOR QUOTE"
            as="h1"
            subtitle="Submit your project requirements. All inquiries receive a response within 24 hours with a preliminary scope assessment."
          />
        </div>

        {status === "sent" ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="osd-card rounded-lg p-12 text-center hud-corners"
          >
            <div className="w-16 h-16 border-2 border-accent-green rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-accent-green text-2xl">✓</span>
            </div>
            <h2 className="font-mono text-xl font-bold tracking-wider mb-3">
              TRANSMISSION RECEIVED
            </h2>
            <p className="text-text-secondary max-w-md mx-auto mb-4 text-base leading-relaxed">
              Thank you for contacting AJ Builds Drone! Your RFQ has been logged
              and a confirmation has been sent to{" "}
              <strong className="text-foreground">{formData.email}</strong>.
              Expect a preliminary scope assessment within 24 hours.
            </p>
            <p className="font-mono text-xs text-accent-green tracking-widest">
              REF: {refId}
            </p>
          </motion.div>
        ) : (
          <motion.form
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            onSubmit={handleSubmit}
            className="osd-card rounded-lg overflow-hidden hud-corners"
          >
            {/* Form Header */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-border-dim bg-elevated/50">
              <span className="font-mono text-xs tracking-widest text-text-secondary">
                RFQ//SUBMISSION_FORM
              </span>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-accent-green pulse-green" />
                <span className="font-mono text-xs text-accent-green tracking-wider">
                  READY
                </span>
              </div>
            </div>

            <div className="p-6 md:p-8 space-y-6">
              {/* Contact Info Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block font-mono text-xs tracking-widest text-accent-orange mb-2">
                    // FULL NAME *
                  </label>
                  <input
                    type="text"
                    name="name"
                    required
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full bg-background border border-border-dim rounded px-4 py-3 font-mono text-sm text-foreground placeholder:text-text-secondary/50 focus:outline-none focus:border-accent-orange transition-colors"
                    placeholder="Enter your name"
                  />
                </div>
                <div>
                  <label className="block font-mono text-xs tracking-widest text-accent-orange mb-2">
                    // ORGANIZATION
                  </label>
                  <input
                    type="text"
                    name="org"
                    value={formData.org}
                    onChange={handleChange}
                    className="w-full bg-background border border-border-dim rounded px-4 py-3 font-mono text-sm text-foreground placeholder:text-text-secondary/50 focus:outline-none focus:border-accent-orange transition-colors"
                    placeholder="University / Company"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block font-mono text-xs tracking-widest text-accent-orange mb-2">
                  // EMAIL ADDRESS *
                </label>
                <input
                  type="email"
                  name="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full bg-background border border-border-dim rounded px-4 py-3 font-mono text-sm text-foreground placeholder:text-text-secondary/50 focus:outline-none focus:border-accent-orange transition-colors"
                  placeholder="you@organization.edu"
                />
              </div>

              {/* Service / Budget / Timeline Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block font-mono text-xs tracking-widest text-accent-orange mb-2">
                    // SERVICE REQUIRED *
                  </label>
                  <select
                    name="service"
                    required
                    aria-label="Service required"
                    value={formData.service}
                    onChange={handleChange}
                    className="w-full bg-background border border-border-dim rounded px-4 py-3 font-mono text-sm text-foreground focus:outline-none focus:border-accent-orange transition-colors appearance-none cursor-pointer"
                  >
                    <option value="">Select service…</option>
                    {serviceOptions.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-mono text-xs tracking-widest text-accent-orange mb-2">
                    // BUDGET RANGE
                  </label>
                  <select
                    name="budget"
                    aria-label="Budget range"
                    value={formData.budget}
                    onChange={handleChange}
                    className="w-full bg-background border border-border-dim rounded px-4 py-3 font-mono text-sm text-foreground focus:outline-none focus:border-accent-orange transition-colors appearance-none cursor-pointer"
                  >
                    <option value="">Select range…</option>
                    {budgetRanges.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-mono text-xs tracking-widest text-accent-orange mb-2">
                    // TIMELINE
                  </label>
                  <select
                    name="timeline"
                    aria-label="Timeline"
                    value={formData.timeline}
                    onChange={handleChange}
                    className="w-full bg-background border border-border-dim rounded px-4 py-3 font-mono text-sm text-foreground focus:outline-none focus:border-accent-orange transition-colors appearance-none cursor-pointer"
                  >
                    <option value="">Select timeline…</option>
                    {timelineOptions.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Message */}
              <div>
                <label className="block font-mono text-xs tracking-widest text-accent-orange mb-2">
                  // PROJECT DESCRIPTION *
                </label>
                <textarea
                  name="message"
                  required
                  rows={6}
                  value={formData.message}
                  onChange={handleChange}
                  className="w-full bg-background border border-border-dim rounded px-4 py-3 font-mono text-sm text-foreground placeholder:text-text-secondary/50 focus:outline-none focus:border-accent-orange transition-colors resize-none"
                  placeholder="Describe your project requirements, target platform, operating environment, payload needs, autonomy level..."
                />
              </div>

              {/* Error message */}
              {status === "error" && (
                <div className="bg-accent-red/10 border border-accent-red/30 rounded px-4 py-3">
                  <p className="font-mono text-sm text-accent-red">
                    ⚠ TRANSMISSION FAILED — Please try again or email directly
                    at ajayadesign@gmail.com
                  </p>
                </div>
              )}

              {/* Submit */}
              <div className="flex items-center justify-between pt-4 border-t border-border-dim">
                <p className="font-mono text-xs text-text-secondary tracking-wider">
                  * REQUIRED FIELDS
                </p>
                <button
                  type="submit"
                  disabled={status === "sending"}
                  className="btn-glitch inline-flex items-center gap-2 px-8 py-3 bg-accent-orange text-black font-mono text-sm tracking-widest font-bold rounded hover:bg-accent-orange/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {status === "sending" ? (
                    <>
                      <svg
                        className="w-4 h-4 animate-spin"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      TRANSMITTING…
                    </>
                  ) : (
                    <>▶ TRANSMIT RFQ</>
                  )}
                </button>
              </div>
            </div>
          </motion.form>
        )}

        {/* Contact Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
          {[
            {
              label: "EMAIL",
              value: "ajayadesign@gmail.com",
              icon: "✉",
            },
            {
              label: "LOCATION",
              value: "AUSTIN, TX — GLOBAL OPS",
              icon: "◈",
            },
            {
              label: "STATUS",
              value: "ACCEPTING CONTRACTS",
              icon: "◉",
              accent: true,
            },
          ].map((card) => (
            <div
              key={card.label}
              className="bg-surface border border-border-dim rounded-lg px-5 py-4 flex items-center gap-4"
            >
              <span className="text-xl">{card.icon}</span>
              <div>
                <span className="block font-mono text-xs text-text-secondary tracking-widest">
                  {card.label}
                </span>
                <span
                  className={`block font-mono text-sm tracking-wider ${
                    card.accent ? "text-accent-green" : "text-foreground"
                  }`}
                >
                  {card.value}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
