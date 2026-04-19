"use client";

import { useEffect, useState } from "react";
import type { HealthResponse } from "../../lib/types";
import { fetchHealth } from "../../lib/api";

export default function About() {
  const [health, setHealth] = useState<HealthResponse | null>(null);

  useEffect(() => {
    fetchHealth().then(setHealth).catch(() => {});
  }, []);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">About NautiCost</h1>

      <div className="space-y-6">
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">What is NautiCost?</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            NautiCost is a machine learning-based tool that estimates voyage costs for superyacht
            agency services. It predicts the total cost of a port call based on yacht specifications
            (gross tonnage, length, beam, draft), destination, timing, and historical data from
            past voyages.
          </p>
        </section>

        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">How It Works</h2>
          <div className="text-sm text-gray-600 leading-relaxed space-y-3">
            <p>
              The prediction model is an ensemble of two gradient boosting models (LightGBM + CatBoost)
              trained on historical transaction data. For each voyage estimate, the system:
            </p>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>Generates expected transactions based on port-specific service templates</li>
              <li>Predicts the cost of each transaction using 26 engineered features</li>
              <li>Weights predictions by transaction probability</li>
              <li>Calibrates against historical voyage-level cost distributions</li>
              <li>Aggregates across ports weighted by traffic patterns</li>
            </ol>
          </div>
        </section>

        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Service Categories</h2>
          <div className="text-sm text-gray-600 leading-relaxed">
            <p className="mb-3">Costs are broken down into these categories:</p>
            <ul className="space-y-1.5">
              <li><span className="font-medium text-gray-900">Port Marina</span> &mdash; Port dues, pilot fees, mooring, NOx tax</li>
              <li><span className="font-medium text-gray-900">Agency Services</span> &mdash; Customs clearance, purchasing, courier, storage</li>
              <li><span className="font-medium text-gray-900">Hospitality</span> &mdash; Transfers, tours, car rental, guides</li>
              <li><span className="font-medium text-gray-900">Provisioning</span> &mdash; Food and supplies for the yacht</li>
              <li><span className="font-medium text-gray-900">Technical Services</span> &mdash; Repairs, technicians, diver services</li>
              <li><span className="font-medium text-gray-900">Bunkering</span> &mdash; Fuel and lube oil</li>
              <li><span className="font-medium text-gray-900">Agency Fee</span> &mdash; Agency service fees</li>
            </ul>
          </div>
        </section>

        {health && (
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Model Info</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-gray-500 text-xs">Training Data</p>
                <p className="font-semibold text-gray-900">{health.trained_on_rows.toLocaleString()} rows</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-gray-500 text-xs">Features</p>
                <p className="font-semibold text-gray-900">{health.model_features}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-gray-500 text-xs">Ensemble Weight</p>
                <p className="font-semibold text-gray-900">
                  {(health.ensemble_weight * 100).toFixed(0)}% LGB / {((1 - health.ensemble_weight) * 100).toFixed(0)}% CB
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-gray-500 text-xs">Status</p>
                <p className="font-semibold text-green-600">Online</p>
              </div>
            </div>
          </section>
        )}

        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Data &amp; Limitations</h2>
          <div className="text-sm text-gray-600 leading-relaxed space-y-2">
            <p>
              The model is trained on 1,626 historical transactions from 2020-2025 across
              Norway, Sweden, and Denmark.
            </p>
            <p>
              <span className="font-medium text-gray-900">Important:</span> Cost estimates are
              predictions based on historical patterns. Actual costs may differ significantly,
              especially for provisioning and bunkering where costs depend on what is ordered
              rather than yacht specifications.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
