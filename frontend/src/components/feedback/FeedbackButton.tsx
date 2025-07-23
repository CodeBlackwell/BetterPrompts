'use client';

import React, { useState } from 'react';
import { MessageSquare, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FeedbackDialog, FeedbackData } from './FeedbackDialog';
import { toast } from '@/components/ui/use-toast';
import { submitFeedback } from '@/lib/api/feedback';

interface FeedbackButtonProps {
  promptHistoryId: string;
  techniques: string[];
  className?: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg';
}

export const FeedbackButton: React.FC<FeedbackButtonProps> = ({
  promptHistoryId,
  techniques,
  className,
  variant = 'outline',
  size = 'default'
}) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [hasSubmittedFeedback, setHasSubmittedFeedback] = useState(false);

  const handleSubmitFeedback = async (feedback: FeedbackData) => {
    try {
      await submitFeedback(feedback);
      setHasSubmittedFeedback(true);
      toast({
        title: "Thank you for your feedback!",
        description: "Your feedback helps us improve our service.",
      });
    } catch (error) {
      console.error('Error submitting feedback:', error);
      toast({
        title: "Error",
        description: "Failed to submit feedback. Please try again.",
        variant: "destructive",
      });
      throw error;
    }
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={() => setIsDialogOpen(true)}
        className={className}
        disabled={hasSubmittedFeedback}
      >
        {hasSubmittedFeedback ? (
          <>
            <Star className="w-4 h-4 mr-2 fill-current" />
            Feedback Submitted
          </>
        ) : (
          <>
            <MessageSquare className="w-4 h-4 mr-2" />
            Give Feedback
          </>
        )}
      </Button>

      <FeedbackDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        promptHistoryId={promptHistoryId}
        techniques={techniques}
        onSubmit={handleSubmitFeedback}
      />
    </>
  );
};

// Quick feedback component (inline star rating)
export const QuickFeedback: React.FC<{
  promptHistoryId: string;
  onSubmit?: (rating: number) => void;
}> = ({ promptHistoryId, onSubmit }) => {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [submitted, setSubmitted] = useState(false);

  const handleRating = async (value: number) => {
    setRating(value);
    setSubmitted(true);
    
    try {
      await submitFeedback({
        prompt_history_id: promptHistoryId,
        rating: value,
        feedback_type: 'rating'
      });
      
      if (onSubmit) {
        onSubmit(value);
      }
      
      toast({
        title: "Thanks for rating!",
        description: `You rated this ${value} out of 5 stars.`,
      });
    } catch (error) {
      console.error('Error submitting rating:', error);
      setSubmitted(false);
      setRating(0);
    }
  };

  if (submitted) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
        <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
        <span>Rated {rating}/5</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-600 dark:text-gray-400">Rate:</span>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            onClick={() => handleRating(star)}
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(0)}
            className="transition-all duration-200 transform hover:scale-110"
            aria-label={`Rate ${star} out of 5 stars`}
          >
            <Star
              className={`w-4 h-4 transition-colors duration-200 ${
                (hover || rating) >= star
                  ? "fill-yellow-400 text-yellow-400"
                  : "text-gray-300"
              }`}
            />
          </button>
        ))}
      </div>
    </div>
  );
};