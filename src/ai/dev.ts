import { config } from 'dotenv';
config();

import '@/ai/flows/generate-face-profile-prompt.ts';
import '@/ai/flows/suggest-recipients-for-low-confidence-matches.ts';
import '@/ai/flows/improve-face-matching.ts';