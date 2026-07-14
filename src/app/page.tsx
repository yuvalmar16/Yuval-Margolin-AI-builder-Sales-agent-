"use client";

import Link from "next/link";
import { motion } from "framer-motion";

const workflowSteps = [
  "Describe the assistant",
  "Preview the generated flow",
  "Refine with chat",
  "Approve the sandbox launch",
];

const navLinks = ["Product", "Resources", "Company"];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f6f4fd] text-zinc-900">
      <div className="flex items-center justify-center gap-2 bg-violet-600 px-4 py-2 text-center text-sm font-medium text-white">
        <span aria-hidden>✦</span>
        Chat-built, approval-gated AI voice agents for outbound sales
      </div>

      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-10">
        <div className="flex items-center gap-1.5 text-xl font-semibold tracking-tight text-zinc-950">
          Yuval Margolin Alta AI builder agent
                   
          <span className="text-violet-500" aria-hidden>
            ✦
          </span>

        </div>

        <nav className="hidden items-center gap-8 text-sm text-zinc-600 md:flex">
          {navLinks.map((link) => (
            <span key={link} className="cursor-default">
              {link}
            </span>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-zinc-600 sm:inline">Log in</span>
          <Link
            href="/builder"
            className="rounded-full bg-zinc-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800"
          >
            Try the builder
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 pb-20 lg:px-10">
        <div className="relative overflow-hidden rounded-[28px] border border-zinc-200 bg-white shadow-sm">
          <div
            aria-hidden
            className="absolute inset-0 opacity-40"
            style={{
              backgroundImage:
                "radial-gradient(circle, rgba(124,77,255,0.14) 1px, transparent 1px)",
              backgroundSize: "28px 28px",
            }}
          />
          <div
            aria-hidden
            className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-gradient-to-br from-violet-300 to-pink-200 opacity-50 blur-3xl"
          />

          <div className="relative grid gap-10 px-6 py-14 sm:px-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:px-14 lg:py-20">
            <div className="space-y-8">
              <div className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-3 py-1 text-sm text-zinc-600 shadow-sm">
                AI Voice Agent Builder
              </div>

              <div className="space-y-4">
                <h1 className="max-w-3xl text-5xl font-semibold tracking-tight text-zinc-950 sm:text-6xl">
                  Build a voice AI that sells, qualifies, and books meetings.
                </h1>
                <p className="max-w-2xl text-lg leading-8 text-zinc-500">
                  Describe the assistant in plain English. The builder turns it into a
                  structured workflow, previews the call logic, and lets you refine it
                  through chat.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  href="/builder"
                  className="rounded-full bg-zinc-950 px-5 py-3 text-sm font-medium text-white transition hover:scale-[1.01] hover:bg-zinc-800"
                >
                  Try the builder demo
                </Link>
                <Link
                  href="/builder"
                  className="rounded-full border border-zinc-300 bg-white px-5 py-3 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50"
                >
                  View workflow preview
                </Link>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {workflowSteps.map((step, index) => (
                  <motion.div
                    key={step}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.08, duration: 0.35 }}
                    className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-700 shadow-sm"
                  >
                    <div className="mb-2 text-xs uppercase tracking-[0.2em] text-violet-500">
                      Step {index + 1}
                    </div>
                    {step}
                  </motion.div>
                ))}
              </div>
            </div>

            <div className="rounded-[24px] border border-zinc-200 bg-white p-5 shadow-xl shadow-zinc-200/60">
              <div className="rounded-[18px] border border-zinc-100 bg-zinc-50 p-4">
                <div className="mb-4 flex items-center justify-between text-xs text-zinc-500">
                  <span>Builder Preview</span>
                  <span>Draft v1</span>
                </div>

                <div className="space-y-3">
                  <div className="rounded-2xl border border-zinc-200 bg-white p-3 text-sm text-zinc-700">
                    <div className="text-xs uppercase tracking-[0.2em] text-zinc-400">
                      Prompt
                    </div>
                    <p className="mt-2">
                      Create an outbound sales assistant that qualifies leads and books
                      meetings on weekdays only.
                    </p>
                  </div>

                  <div className="rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-800">
                    <div className="text-xs uppercase tracking-[0.2em] text-emerald-600">
                      Generated assistant
                    </div>
                    <p className="mt-2">
                      Friendly tone, budget qualification, business-hours guardrails,
                      meeting booking rules, CRM sync status.
                    </p>
                  </div>

                  <div className="rounded-2xl bg-violet-50 p-3 text-sm text-violet-800">
                    <div className="text-xs uppercase tracking-[0.2em] text-violet-600">
                      Approved actions
                    </div>
                    <p className="mt-2">
                      Qualify leads, book meetings, update CRM outcome, and preserve a
                      safe approval boundary before launch.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
