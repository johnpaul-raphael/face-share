'use server';

/**
 * @fileOverview This flow suggests possible recipients for low-confidence face matches in photos.
 *
 * - suggestRecipientsForLowConfidenceMatches - A function that suggests potential recipients for a photo with low-confidence face matches.
 * - SuggestRecipientsInput - The input type for the suggestRecipientsForLowConfidenceMatches function.
 * - SuggestRecipientsOutput - The output type for the suggestRecipientsForLowConfidenceMatches function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestRecipientsInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      'A photo with low-confidence face matches, as a data URI that must include a MIME type and use Base64 encoding. Expected format: \'data:<mimetype>;base64,<encoded_data>\'.' 
    ),
  eventParticipants: z.array(z.string()).describe('List of event participant names.'),
});
export type SuggestRecipientsInput = z.infer<typeof SuggestRecipientsInputSchema>;

const SuggestRecipientsOutputSchema = z.object({
  suggestedRecipients: z
    .array(z.string())
    .describe('Suggested recipients for the photo based on facial similarity and event participation.'),
});
export type SuggestRecipientsOutput = z.infer<typeof SuggestRecipientsOutputSchema>;

export async function suggestRecipientsForLowConfidenceMatches(
  input: SuggestRecipientsInput
): Promise<SuggestRecipientsOutput> {
  return suggestRecipientsFlow(input);
}

const suggestRecipientsPrompt = ai.definePrompt({
  name: 'suggestRecipientsPrompt',
  input: {schema: SuggestRecipientsInputSchema},
  output: {schema: SuggestRecipientsOutputSchema},
  prompt: `You are an AI assistant helping an event owner review low-confidence face matches in photos.

  Given a photo and a list of event participants, suggest possible recipients for the photo based on facial similarity.
  Only suggest recipients that are in the list of event participants.

  Photo: {{media url=photoDataUri}}
  Event Participants: {{eventParticipants}}

  Consider these factors when suggesting recipients:
  - Facial similarity between the people in the photo and the event participants.
  - Contextual information about the event and the participants.
  - The likelihood that a participant is present in the photo.

  Output the suggested recipients as a list of names.
  `,
});

const suggestRecipientsFlow = ai.defineFlow(
  {
    name: 'suggestRecipientsFlow',
    inputSchema: SuggestRecipientsInputSchema,
    outputSchema: SuggestRecipientsOutputSchema,
  },
  async input => {
    const {output} = await suggestRecipientsPrompt(input);
    return output!;
  }
);
