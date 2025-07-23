import axios from 'axios';
import { FeedbackData } from '@/components/feedback/FeedbackDialog';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost/api/v1';

export interface FeedbackResponse {
  id: string;
  prompt_history_id: string;
  rating?: number;
  feedback_type: string;
  created_at: string;
  message: string;
}

export interface TechniqueEffectivenessRequest {
  technique: string;
  intent?: string;
  complexity?: string;
  period_days?: number;
}

export interface TechniqueEffectivenessResponse {
  technique: string;
  intent?: string;
  complexity?: string;
  effectiveness_score?: number;
  average_rating?: number;
  positive_ratio?: number;
  negative_ratio?: number;
  confidence: 'low' | 'medium' | 'high';
  sample_size: number;
  period_days: number;
  last_updated: string;
}

/**
 * Submit feedback for an enhanced prompt
 */
export async function submitFeedback(feedback: FeedbackData): Promise<FeedbackResponse> {
  try {
    const response = await axios.post<FeedbackResponse>(
      `${API_BASE_URL}/feedback`,
      feedback,
      {
        headers: {
          'Content-Type': 'application/json',
          // Auth token would be included here if using axios interceptors
        },
        withCredentials: true,
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error submitting feedback:', error);
    throw error;
  }
}

/**
 * Get existing feedback for a prompt history entry
 */
export async function getFeedback(promptHistoryId: string): Promise<FeedbackResponse | null> {
  try {
    const response = await axios.get<FeedbackResponse>(
      `${API_BASE_URL}/feedback/${promptHistoryId}`,
      {
        withCredentials: true,
      }
    );
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return null;
    }
    console.error('Error getting feedback:', error);
    throw error;
  }
}

/**
 * Get technique effectiveness metrics
 */
export async function getTechniqueEffectiveness(
  request: TechniqueEffectivenessRequest
): Promise<TechniqueEffectivenessResponse> {
  try {
    const response = await axios.post<TechniqueEffectivenessResponse>(
      `${API_BASE_URL}/feedback/effectiveness`,
      request,
      {
        headers: {
          'Content-Type': 'application/json',
        },
        withCredentials: true,
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error getting technique effectiveness:', error);
    throw error;
  }
}

/**
 * Get effectiveness metrics for all techniques
 */
export async function getAllTechniqueEffectiveness(
  intent?: string,
  complexity?: string,
  periodDays: number = 30
): Promise<TechniqueEffectivenessResponse[]> {
  const techniques = [
    'chain_of_thought',
    'tree_of_thoughts',
    'few_shot',
    'zero_shot',
    'role_play',
    'step_by_step',
    'structured_output',
    'emotional_appeal',
    'constraints',
    'analogical',
    'self_consistency',
    'react'
  ];

  try {
    const promises = techniques.map(technique =>
      getTechniqueEffectiveness({
        technique,
        intent,
        complexity,
        period_days: periodDays
      })
    );

    const results = await Promise.allSettled(promises);
    
    return results
      .filter((result): result is PromiseFulfilledResult<TechniqueEffectivenessResponse> => 
        result.status === 'fulfilled'
      )
      .map(result => result.value);
  } catch (error) {
    console.error('Error getting all technique effectiveness:', error);
    throw error;
  }
}