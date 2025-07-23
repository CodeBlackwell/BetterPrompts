import Image from 'next/image'
import { useState } from 'react'
import { cn } from '@/lib/utils'

interface OptimizedImageProps {
  src: string
  alt: string
  width?: number
  height?: number
  className?: string
  priority?: boolean
  quality?: number
  placeholder?: 'blur' | 'empty'
  blurDataURL?: string
  onLoadingComplete?: () => void
  fill?: boolean
  sizes?: string
  style?: React.CSSProperties
}

export default function OptimizedImage({
  src,
  alt,
  width,
  height,
  className,
  priority = false,
  quality = 75,
  placeholder = 'blur',
  blurDataURL,
  onLoadingComplete,
  fill = false,
  sizes,
  style,
}: OptimizedImageProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(false)

  // Generate a simple blur placeholder if none provided
  const defaultBlurDataURL = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWEREiMxUf/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q=='

  const handleLoadingComplete = () => {
    setIsLoading(false)
    onLoadingComplete?.()
  }

  if (error) {
    return (
      <div 
        className={cn(
          "flex items-center justify-center bg-gray-100 text-gray-400",
          className
        )}
        style={{ width, height, ...style }}
      >
        <span className="text-sm">Failed to load image</span>
      </div>
    )
  }

  return (
    <div className={cn("relative overflow-hidden", className)} style={style}>
      {isLoading && (
        <div className="absolute inset-0 animate-pulse bg-gray-200" />
      )}
      
      {fill ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes || '100vw'}
          quality={quality}
          priority={priority}
          placeholder={placeholder}
          blurDataURL={blurDataURL || defaultBlurDataURL}
          onLoadingComplete={handleLoadingComplete}
          onError={() => setError(true)}
          className={cn(
            "object-cover",
            isLoading && "opacity-0",
            !isLoading && "opacity-100 transition-opacity duration-300"
          )}
        />
      ) : (
        <Image
          src={src}
          alt={alt}
          width={width || 0}
          height={height || 0}
          quality={quality}
          priority={priority}
          placeholder={placeholder}
          blurDataURL={blurDataURL || defaultBlurDataURL}
          onLoadingComplete={handleLoadingComplete}
          onError={() => setError(true)}
          className={cn(
            isLoading && "opacity-0",
            !isLoading && "opacity-100 transition-opacity duration-300"
          )}
        />
      )}
    </div>
  )
}

// Utility component for responsive images
export function ResponsiveImage({
  src,
  alt,
  aspectRatio = '16/9',
  className,
  priority = false,
  quality = 75,
}: {
  src: string
  alt: string
  aspectRatio?: string
  className?: string
  priority?: boolean
  quality?: number
}) {
  return (
    <div 
      className={cn("relative w-full overflow-hidden", className)}
      style={{ aspectRatio }}
    >
      <OptimizedImage
        src={src}
        alt={alt}
        fill
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        priority={priority}
        quality={quality}
      />
    </div>
  )
}