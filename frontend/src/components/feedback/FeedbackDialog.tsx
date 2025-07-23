'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, X, ThumbsUp, ThumbsDown, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface FeedbackDialogProps {
  isOpen: boolean;
  onClose: () => void;
  promptHistoryId: string;
  techniques: string[];
  onSubmit: (feedback: FeedbackData) => Promise<void>;
}

export interface FeedbackData {
  prompt_history_id: string;
  rating?: number;
  feedback_type: 'rating' | 'positive' | 'negative' | 'suggestion';
  feedback_text?: string;
  technique_ratings?: Record<string, number>;
  most_helpful_technique?: string;
  least_helpful_technique?: string;
}

const StarRating: React.FC<{
  value: number;
  onChange: (value: number) => void;
  size?: 'sm' | 'md' | 'lg';
}> = ({ value, onChange, size = 'md' }) => {
  const [hover, setHover] = useState(0);
  
  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  };

  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(0)}
          className="transition-all duration-200 transform hover:scale-110"
          aria-label={`Rate ${star} out of 5 stars`}
        >
          <Star
            className={cn(
              sizes[size],
              "transition-colors duration-200",
              (hover || value) >= star
                ? "fill-yellow-400 text-yellow-400"
                : "text-gray-300"
            )}
          />
        </button>
      ))}
    </div>
  );
};

export const FeedbackDialog: React.FC<FeedbackDialogProps> = ({
  isOpen,
  onClose,
  promptHistoryId,
  techniques,
  onSubmit
}) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [overallRating, setOverallRating] = useState(0);
  const [feedbackType, setFeedbackType] = useState<FeedbackData['feedback_type']>('rating');
  const [feedbackText, setFeedbackText] = useState('');
  const [techniqueRatings, setTechniqueRatings] = useState<Record<string, number>>({});
  const [mostHelpful, setMostHelpful] = useState('');
  const [leastHelpful, setLeastHelpful] = useState('');

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const feedbackData: FeedbackData = {
        prompt_history_id: promptHistoryId,
        rating: overallRating,
        feedback_type: feedbackType,
        feedback_text: feedbackText || undefined,
        technique_ratings: Object.keys(techniqueRatings).length > 0 ? techniqueRatings : undefined,
        most_helpful_technique: mostHelpful || undefined,
        least_helpful_technique: leastHelpful || undefined
      };
      
      await onSubmit(feedbackData);
      onClose();
    } catch (error) {
      console.error('Error submitting feedback:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setStep(1);
    setOverallRating(0);
    setFeedbackType('rating');
    setFeedbackText('');
    setTechniqueRatings({});
    setMostHelpful('');
    setLeastHelpful('');
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50"
            onClick={handleClose}
          />
          
          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 flex items-center justify-center z-50 p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <Card className="w-full max-w-lg bg-white dark:bg-gray-900 p-6 relative">
              {/* Close button */}
              <button
                onClick={handleClose}
                className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Step 1: Overall Rating */}
              {step === 1 && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-6"
                >
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                      How was your experience?
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400">
                      Your feedback helps us improve our prompt enhancement service
                    </p>
                  </div>

                  <div className="flex flex-col items-center space-y-4">
                    <StarRating
                      value={overallRating}
                      onChange={setOverallRating}
                      size="lg"
                    />
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {overallRating === 0 && "Rate your overall experience"}
                      {overallRating === 1 && "Very Poor"}
                      {overallRating === 2 && "Poor"}
                      {overallRating === 3 && "Average"}
                      {overallRating === 4 && "Good"}
                      {overallRating === 5 && "Excellent"}
                    </p>
                  </div>

                  <div className="flex gap-2 justify-center">
                    <button
                      onClick={() => setFeedbackType('positive')}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors",
                        feedbackType === 'positive'
                          ? "bg-green-50 border-green-300 text-green-700 dark:bg-green-900/20 dark:border-green-700 dark:text-green-400"
                          : "border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800"
                      )}
                    >
                      <ThumbsUp className="w-4 h-4" />
                      Positive
                    </button>
                    <button
                      onClick={() => setFeedbackType('negative')}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors",
                        feedbackType === 'negative'
                          ? "bg-red-50 border-red-300 text-red-700 dark:bg-red-900/20 dark:border-red-700 dark:text-red-400"
                          : "border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800"
                      )}
                    >
                      <ThumbsDown className="w-4 h-4" />
                      Negative
                    </button>
                    <button
                      onClick={() => setFeedbackType('suggestion')}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors",
                        feedbackType === 'suggestion'
                          ? "bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-900/20 dark:border-blue-700 dark:text-blue-400"
                          : "border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800"
                      )}
                    >
                      <MessageSquare className="w-4 h-4" />
                      Suggestion
                    </button>
                  </div>

                  <div className="flex justify-between">
                    <Button variant="outline" onClick={handleClose}>
                      Skip
                    </Button>
                    <Button 
                      onClick={() => setStep(2)}
                      disabled={overallRating === 0}
                    >
                      Next
                    </Button>
                  </div>
                </motion.div>
              )}

              {/* Step 2: Technique Ratings */}
              {step === 2 && techniques.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-6"
                >
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                      Rate the techniques used
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400">
                      How helpful was each technique?
                    </p>
                  </div>

                  <div className="space-y-4 max-h-60 overflow-y-auto">
                    {techniques.map((technique) => (
                      <div key={technique} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-medium">
                            {technique.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </Label>
                          <StarRating
                            value={techniqueRatings[technique] || 0}
                            onChange={(value) => setTechniqueRatings({
                              ...techniqueRatings,
                              [technique]: value
                            })}
                            size="sm"
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="most-helpful" className="text-sm">
                        Most helpful technique
                      </Label>
                      <select
                        id="most-helpful"
                        value={mostHelpful}
                        onChange={(e) => setMostHelpful(e.target.value)}
                        className="w-full mt-1 px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                      >
                        <option value="">Select a technique</option>
                        {techniques.map((technique) => (
                          <option key={technique} value={technique}>
                            {technique.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    <div>
                      <Label htmlFor="least-helpful" className="text-sm">
                        Least helpful technique
                      </Label>
                      <select
                        id="least-helpful"
                        value={leastHelpful}
                        onChange={(e) => setLeastHelpful(e.target.value)}
                        className="w-full mt-1 px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                      >
                        <option value="">Select a technique</option>
                        {techniques.map((technique) => (
                          <option key={technique} value={technique}>
                            {technique.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-between">
                    <Button variant="outline" onClick={() => setStep(1)}>
                      Back
                    </Button>
                    <Button onClick={() => setStep(3)}>
                      Next
                    </Button>
                  </div>
                </motion.div>
              )}

              {/* Step 3: Written Feedback */}
              {step === (techniques.length > 0 ? 3 : 2) && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-6"
                >
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                      Any additional feedback?
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400">
                      Tell us more about your experience (optional)
                    </p>
                  </div>

                  <textarea
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                    placeholder="Share your thoughts, suggestions, or report any issues..."
                    className="w-full h-32 px-4 py-3 border rounded-lg resize-none bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    maxLength={1000}
                  />
                  
                  <p className="text-xs text-gray-500 text-right">
                    {feedbackText.length}/1000 characters
                  </p>

                  <div className="flex justify-between">
                    <Button 
                      variant="outline" 
                      onClick={() => setStep(techniques.length > 0 ? 2 : 1)}
                    >
                      Back
                    </Button>
                    <Button onClick={handleSubmit} disabled={loading}>
                      {loading ? 'Submitting...' : 'Submit Feedback'}
                    </Button>
                  </div>
                </motion.div>
              )}
            </Card>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};