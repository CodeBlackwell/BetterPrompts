import dynamic from 'next/dynamic'

// Lazy load the TechniqueSelector component
export const TechniqueSelector = dynamic(
  () => import('./TechniqueSelector').then(mod => mod.default),
  {
    loading: () => (
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-32 mb-4"></div>
        <div className="space-y-2">
          <div className="h-12 bg-gray-100 rounded"></div>
          <div className="h-12 bg-gray-100 rounded"></div>
          <div className="h-12 bg-gray-100 rounded"></div>
        </div>
      </div>
    ),
    ssr: false,
  }
)