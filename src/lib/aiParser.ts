import OpenAI from 'openai';
import type { OMData } from '@/types';

function getOpenAIClient() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

const SYSTEM_PROMPT = `You are a commercial real estate analyst. From this OM text, output ONLY JSON. Include:
- address: full street, city, state, zip (clean, guess if partial)
- price: number | null
- capRate: number | null
- noi: number | null
- sqFt: number | null
- yearBuilt: number | null
- zoning: string | null
- tenants: string[] (e.g., ["Popeyes", "Dollar General"])
- propertyType: 'stnl' | 'mf' | 'retail' | 'office' | 'industrial' | 'other'
- saleOrLease: 'for-sale' | 'for-lease' (guess from keywords like 'available', 'lease rate')
- slug: string – format: '{saleOrLease}/{propertyType}-{brand-or-address-city-state-initials}'
  - Brand: use main tenant name if obvious (e.g., 'popeyes' lowercase)
  - Fallback: address-city-state initials (lowercase, dashes, no zip, e.g., '123-main-st-nyc-ny')
- highlights: string[] (5-10 bullets, key selling points)
Ignore fluff. Use null for missing. No extra text.`;

export async function parseOM(rawText: string, notes?: string): Promise<OMData> {
  const userContent = notes
    ? `OM Text:\n${rawText}\n\nUser Notes:\n${notes}`
    : `OM Text:\n${rawText}`;

  const response = await getOpenAIClient().chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userContent },
    ],
    temperature: 0.1,
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('No response from OpenAI');

  const parsed: OMData = JSON.parse(content);
  return parsed;
}
