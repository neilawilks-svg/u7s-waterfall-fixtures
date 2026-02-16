import React from 'react';
import { MapPin, X, ZoomIn, ZoomOut } from '../icons';

export default function SitePlanModal({ showSitePlan, setShowSitePlan, sitePlanZoom, setSitePlanZoom }) {
  if (!showSitePlan) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setShowSitePlan(false)} style={{touchAction: 'none'}}>
      <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()} onTouchMove={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-[#7c1229] text-white rounded-t-xl">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <MapPin size={20} />
            Site Plan
          </h2>
          <button onClick={() => setShowSitePlan(false)} className="p-1 hover:bg-white/20 rounded-lg transition-colors" aria-label="Close site plan">
            <X size={24} />
          </button>
        </div>
        <div className="overflow-auto" style={{WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain', touchAction: 'pan-x pan-y'}}>
          <img src="/site-plan.png" alt="Site plan showing 16 pitches in a 4x4 grid, colour-coded by zone A through H" style={{width: `${sitePlanZoom * 100}%`, height: 'auto', display: 'block'}} draggable="false" />
        </div>
        <div className="p-3 bg-gray-50 border-t border-gray-200 flex items-center justify-center gap-3">
          <button onClick={() => setSitePlanZoom(z => Math.max(1, z - 0.5))} className="p-1.5 rounded-lg bg-gray-200 hover:bg-gray-300 transition-colors disabled:opacity-40" disabled={sitePlanZoom <= 1} aria-label="Zoom out">
            <ZoomOut size={18} />
          </button>
          <span className="text-sm text-gray-500 min-w-[3rem] text-center">{Math.round(sitePlanZoom * 100)}%</span>
          <button onClick={() => setSitePlanZoom(z => Math.min(3, z + 0.5))} className="p-1.5 rounded-lg bg-gray-200 hover:bg-gray-300 transition-colors disabled:opacity-40" disabled={sitePlanZoom >= 3} aria-label="Zoom in">
            <ZoomIn size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
