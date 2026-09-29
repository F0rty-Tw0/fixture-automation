import type { AiAvailability } from '../../workbench/common/ai-fill.type.ts';

export const AI_AVAILABILITY_LABELS: Record<AiAvailability, string> = {
  available: 'Ready',
  downloadable: 'Model not downloaded yet',
  downloading: 'Downloading the model',
  unavailable: 'Not available in this browser'
};
