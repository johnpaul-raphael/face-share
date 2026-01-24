// This file is machine-generated - edit with care!

'use server';

/**
 * @fileOverview Generates a suggested prompt for creating a face profile with high-quality, diverse images.
 *
 * - generateFaceProfilePrompt - A function that generates the prompt.
 * - GenerateFaceProfilePromptInput - The input type for the generateFaceProfilePrompt function.
 * - GenerateFaceProfilePromptOutput - The return type for the generateFaceProfilePrompt function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateFaceProfilePromptInputSchema = z.object({
  description: z
    .string()
    .describe('A text description of the user to generate a face profile for.'),
});
export type GenerateFaceProfilePromptInput = z.infer<
  typeof GenerateFaceProfilePromptInputSchema
>;

const GenerateFaceProfilePromptOutputSchema = z.object({
  prompt: z
    .string()
    .describe(
      'A suggested prompt for generating a face profile with high-quality, diverse images.'
    ),
});
export type GenerateFaceProfilePromptOutput = z.infer<
  typeof GenerateFaceProfilePromptOutputSchema
>;

export async function generateFaceProfilePrompt(
  input: GenerateFaceProfilePromptInput
): Promise<GenerateFaceProfilePromptOutput> {
  return generateFaceProfilePromptFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateFaceProfilePrompt',
  input: {schema: GenerateFaceProfilePromptInputSchema},
  output: {schema: GenerateFaceProfilePromptOutputSchema},
  prompt: `You are an AI assistant that generates prompts for creating face profiles. Based on the description of the user, generate a prompt that will generate high-quality, diverse images for the face profile. Description: {{{description}}}`,
});

const generateFaceProfilePromptFlow = ai.defineFlow(
  {
    name: 'generateFaceProfilePromptFlow',
    inputSchema: GenerateFaceProfilePromptInputSchema,
    outputSchema: GenerateFaceProfilePromptOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
