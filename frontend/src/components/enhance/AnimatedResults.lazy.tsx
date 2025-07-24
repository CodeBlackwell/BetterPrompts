import dynamic from 'next/dynamic'

// Lazy load framer-motion components
export const AnimatedResults = dynamic(
  () => import('framer-motion').then(mod => {
    // Create a component that uses framer-motion
    const Component = ({ children, ...props }: any) => {
      const { motion } = mod;
      return (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          {...props}
        >
          {children}
        </motion.div>
      );
    };
    return Component;
  }),
  {
    ssr: false,
    loading: () => <div className="animate-pulse h-32 bg-gray-100 rounded"></div>,
  }
);

// Export other motion components as needed
export const AnimatedCard = dynamic(
  () => import('framer-motion').then(mod => {
    const Component = ({ children, ...props }: any) => {
      const { motion } = mod;
      return (
        <motion.div
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: "spring", stiffness: 300 }}
          {...props}
        >
          {children}
        </motion.div>
      );
    };
    return Component;
  }),
  { ssr: false }
);