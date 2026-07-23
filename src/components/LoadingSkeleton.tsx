import React from 'react';

export const LoadingSkeleton: React.FC = () => {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Top Banner Skeleton */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-5 h-24 flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-5 w-48 bg-slate-200 rounded-md" />
          <div className="h-3 w-72 bg-slate-100 rounded-md" />
        </div>
        <div className="h-10 w-32 bg-slate-200 rounded-lg" />
      </div>

      {/* Cards Grid Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white border border-slate-200/90 rounded-xl p-4 h-28 space-y-3">
            <div className="flex justify-between items-center">
              <div className="h-3 w-20 bg-slate-200 rounded" />
              <div className="w-8 h-8 bg-slate-100 rounded-lg" />
            </div>
            <div className="h-6 w-32 bg-slate-300 rounded" />
            <div className="h-3 w-24 bg-slate-100 rounded" />
          </div>
        ))}
      </div>

      {/* Table Skeleton */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-4 space-y-3">
        <div className="h-10 bg-slate-100 rounded-lg w-full" />
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-12 bg-slate-50 rounded-lg w-full" />
        ))}
      </div>
    </div>
  );
};
