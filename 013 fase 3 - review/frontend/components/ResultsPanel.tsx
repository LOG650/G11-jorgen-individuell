"use client";

import type { VoyageResponse } from "../lib/types";
import CostSummary from "./CostSummary";
import ServiceBreakdown from "./ServiceBreakdown";

export default function ResultsPanel({ result }: { result: VoyageResponse }) {
  return (
    <div className="space-y-6">
      <CostSummary result={result} />
      <ServiceBreakdown result={result} />
    </div>
  );
}
