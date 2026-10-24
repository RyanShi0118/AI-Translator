export const LANGUAGES = [
  'English',
  'Simplified Chinese',
  'Traditional Chinese',
  'Japanese',
  'Korean',
  'German',
  'French',
  'Spanish',
  'Portuguese',
  'Italian',
  'Russian',
  'Arabic',
] as const;

export const TONES = ['Professional', 'Casual', 'Academic', 'Concise', 'Technical'] as const;

export type Tone = (typeof TONES)[number];

export type ProviderId = 'deepseek' | 'openai' | 'siliconflow' | 'openrouter' | 'custom';

export interface ProviderPreset {
  id: ProviderId;
  label: string;
  baseUrl: string;
  model: string;
  /** Whether the Base URL field is editable for this preset. */
  editableBaseUrl: boolean;
  keyUrl?: string;
}

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: 'deepseek',
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    editableBaseUrl: false,
    keyUrl: 'https://platform.deepseek.com/api_keys',
  },
  {
    id: 'openai',
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    editableBaseUrl: false,
    keyUrl: 'https://platform.openai.com/api-keys',
  },
  {
    id: 'siliconflow',
    label: 'SiliconFlow',
    baseUrl: 'https://api.siliconflow.cn/v1',
    model: 'deepseek-ai/DeepSeek-V3',
    editableBaseUrl: true,
    keyUrl: 'https://cloud.siliconflow.cn/account/ak',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'deepseek/deepseek-chat',
    editableBaseUrl: true,
    keyUrl: 'https://openrouter.ai/keys',
  },
  {
    id: 'custom',
    label: 'Custom (OpenAI-compatible)',
    baseUrl: '',
    model: '',
    editableBaseUrl: true,
  },
];

export const PORT_NAME = 'refine-translate-stream';
