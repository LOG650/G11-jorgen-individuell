"use client";

import type { VoyageResponse } from "../lib/types";
import CostSummary from "./CostSummary";
import ServiceBreakdown from "./ServiceBreakdown";
import PortDetails from "./PortDetails";

export default function ResultsPanel({ result }: { result: VoyageResponse }) {
  return (
    <div className="space-y-6">
      <CostSummary result={result} />
      <ServiceBreakdown result={result} />
      <PortDetails result={result} />
    </div>
  );
}
