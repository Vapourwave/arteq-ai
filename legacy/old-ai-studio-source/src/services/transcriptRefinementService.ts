export interface RefinementResult {
  cleanTranscript: string;
  routingText: string;
  language: string;
  meaningPreserved: boolean;
  uncertaintyDetected: boolean;
}

export const refineTranscript = async (rawTranscript: string): Promise<RefinementResult> => {
  const response = await fetch('/api/refine-transcript', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transcript: rawTranscript }),
  });

  if (!response.ok) {
    throw new Error('Failed to refine transcript');
  }

  const result = await response.json();
  
  if (!result.success || !result.data) {
    throw new Error('Invalid response format');
  }

  return result.data as RefinementResult;
};
export interface TranscriptQualityResult {
  qualityStatus: 'CLEAR' | 'REVIEW' | 'INSUFFICIENT';
  qualityScore: number;
  issues: string[];
  requiresReview: boolean;
  reviewReason: string | null;
}

export const checkTranscriptQuality = async (rawTranscript: string, cleanTranscript: string): Promise<TranscriptQualityResult> => {
  try {
    const response = await fetch('/api/check-transcript-quality', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawTranscript, cleanTranscript }),
    });

    if (!response.ok) {
      throw new Error('Failed to check transcript quality');
    }

    const result = await response.json();
    if (!result.success || !result.data) {
      throw new Error('Invalid response format');
    }

    return result.data as TranscriptQualityResult;
  } catch (error) {
    console.error('Quality check error:', error);
    // Fallback if API fails
    return {
      qualityStatus: 'REVIEW',
      qualityScore: 0,
      issues: [],
      requiresReview: true,
      reviewReason: 'Please review the transcript before continuing.',
    };
  }
};
