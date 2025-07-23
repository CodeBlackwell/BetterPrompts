import { motion } from 'framer-motion'
import { Check, Info } from 'lucide-react'
import * as Tooltip from '@radix-ui/react-tooltip'
import { cn } from '@/lib/utils'
import { VisuallyHidden } from '@/components/ui/accessibility'

interface TechniqueCardProps {
  technique: {
    id: string
    name: string
    description: string
    confidence: number
  }
  isSelected: boolean
  onClick: () => void
}

export default function TechniqueCard({ technique, isSelected, onClick }: TechniqueCardProps) {
  return (
    <Tooltip.Provider>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <button
              onClick={onClick}
              className={cn(
                "relative w-full rounded-lg border p-3 sm:p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
                isSelected
                  ? "border-blue-500 bg-blue-50 shadow-md"
                  : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
              )}
              aria-pressed={isSelected}
              aria-label={`${technique.name} technique. ${technique.description}. Confidence: ${Math.round(technique.confidence * 100)}%`}
            >
            {/* Selection indicator */}
            {isSelected && (
              <div className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 text-white">
                <Check className="h-4 w-4" />
              </div>
            )}

            {/* Content */}
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold text-gray-900 text-sm sm:text-base">
                {technique.name}
              </h3>
              <Info className="h-4 w-4 text-gray-400 flex-shrink-0 sm:hidden" aria-hidden="true" />
            </div>
            <p className="mt-1 mb-3 text-xs sm:text-sm text-gray-600 line-clamp-2">
              {technique.description}
            </p>

            {/* Confidence indicator */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Confidence:</span>
              <div className="flex-1 h-1.5 sm:h-2 bg-gray-200 rounded-full overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(technique.confidence * 100)}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${technique.confidence * 100}%` }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                  style={{ height: '100%' }}
                >
                  <div className={cn(
                    "h-full rounded-full",
                    technique.confidence > 0.8
                      ? "bg-green-500"
                      : technique.confidence > 0.6
                      ? "bg-yellow-500"
                      : "bg-red-500"
                  )} />
                </motion.div>
              </div>
              <span className="text-xs font-medium text-gray-700 tabular-nums">
                {Math.round(technique.confidence * 100)}%
              </span>
              <VisuallyHidden>
                {technique.confidence > 0.8 ? 'High' : technique.confidence > 0.6 ? 'Medium' : 'Low'} confidence
              </VisuallyHidden>
            </div>
            </button>
          </motion.div>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            className="max-w-xs rounded-lg bg-gray-900 px-4 py-3 text-sm text-white shadow-lg"
            sideOffset={5}
          >
            <p className="mb-2 font-medium">{technique.name}</p>
            <p className="text-gray-300">{technique.description}</p>
            <p className="mt-2 text-xs text-gray-400">
              Click to select this technique for your prompt enhancement
            </p>
            <Tooltip.Arrow className="fill-gray-900" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  )
}