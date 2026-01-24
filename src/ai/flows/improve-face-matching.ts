'use server';

/**
 * @fileOverview Flow for evaluating and improving face matching accuracy.
 *
 * - evaluateFaceMatch - Evaluates the accuracy of a face match.
 * - EvaluateFaceMatchInput - Input type for the evaluateFaceMatch function.
 * - EvaluateFaceMatchOutput - Return type for the evaluateFaceMatch function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const EvaluateFaceMatchInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo containing faces, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  faceId: z.string().describe('The ID of the face detected in the photo.'),
  matchedUserId: z.string().describe('The ID of the user the face was matched to.'),
  confidence: z.number().describe('The confidence score of the face match.'),
});
export type EvaluateFaceMatchInput = z.infer<typeof EvaluateFaceMatchInputSchema>;

const EvaluateFaceMatchOutputSchema = z.object({
  evaluation: z.string().describe('The evaluation of the face match accuracy.'),
  suggestions: z.string().describe('Suggestions for improving face matching accuracy.'),
});
export type EvaluateFaceMatchOutput = z.infer<typeof EvaluateFaceMatchOutputSchema>;

export async function evaluateFaceMatch(input: EvaluateFaceMatchInput): Promise<EvaluateFaceMatchOutput> {
  return evaluateFaceMatchFlow(input);
}

const prompt = ai.definePrompt({
  name: 'evaluateFaceMatchPrompt',
  input: {schema: EvaluateFaceMatchInputSchema},
  output: {schema: EvaluateFaceMatchOutputSchema},
  prompt: `You are an expert in evaluating the accuracy of face matching results.

You are provided with a photo, a face ID detected in the photo, the user ID the face was matched to, and the confidence score of the match.

Your task is to evaluate the accuracy of the face match and provide suggestions for improving face matching accuracy.

Photo: {{media url=photoDataUri}}
Face ID: {{{faceId}}}
Matched User ID: {{{matchedUserId}}}
Confidence: {{{confidence}}}

Evaluate the accuracy of the face match and provide suggestions for improving face matching accuracy, considering factors such as lighting, angle, and image quality.

Evaluation:
{{{evaluation}}}

Suggestions:
{{{suggestions}}}`,
});

const evaluateFaceMatchFlow = ai.defineFlow(
  {
    name: 'evaluateFaceMatchFlow',
    inputSchema: EvaluateFaceMatchInputSchema,
    outputSchema: EvaluateFaceMatchOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
