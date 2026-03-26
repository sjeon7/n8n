import { randomUUID } from 'node:crypto';
import { ChatOpenAI, type ChatOpenAIFields, type ClientOptions } from '@langchain/openai';
import pick from 'lodash/pick';
import {
	NodeConnectionTypes,
	type INodeType,
	type INodeTypeDescription,
	type ISupplyDataFunctions,
	type SupplyData,
} from 'n8n-workflow';

import {
	makeN8nLlmFailedAttemptHandler,
	N8nLlmTracing,
	getProxyAgent,
	getConnectionHintNoticeField,
} from '@n8n/ai-utilities';
import { openAiFailedAttemptHandler } from '../../vendors/OpenAi/helpers/error-handling';
import type { CustomModelOptions } from './types';

// ── Fixed Configuration (edit these values) ─────────────────────────────
const FIXED_BASE_URL = 'https://your-api-endpoint.example.com/v1';
const FIXED_API_KEY = 'your-api-key-here';
const FIXED_MODEL_NAME = 'your-model-name';
const FIXED_HEADERS: Record<string, string> = {
	'X-Custom-Header-1': 'fixed-value-1',
	'X-Custom-Header-2': 'fixed-value-2',
	'X-Custom-Header-3': 'fixed-value-3',
	'X-Custom-Header-4': 'fixed-value-4',
};

export class LmChatOpenAiCustom implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Custom OpenAI Chat Model',
		name: 'lmChatOpenAiCustom',
		icon: { light: 'file:openAiLight.svg', dark: 'file:openAiLight.dark.svg' },
		group: ['transform'],
		version: [1],
		description:
			'OpenAI-compatible Chat Model with custom headers and UUID support, for use with AI Agent nodes',
		defaults: {
			name: 'Custom OpenAI Chat Model',
		},
		codex: {
			categories: ['AI'],
			subcategories: {
				AI: ['Language Models', 'Root Nodes'],
				'Language Models': ['Chat Models (Recommended)'],
			},
		},

		inputs: [],
		outputs: [NodeConnectionTypes.AiLanguageModel],
		outputNames: ['Model'],

		// No credential required — API key is configured directly on the node
		credentials: [],

		properties: [
			getConnectionHintNoticeField([NodeConnectionTypes.AiChain, NodeConnectionTypes.AiAgent]),

			// ── Options ──────────────────────────────────────────────────
			{
				displayName: 'Options',
				name: 'options',
				placeholder: 'Add Option',
				description: 'Additional options to configure the model',
				type: 'collection',
				default: {},
				options: [
					{
						displayName: 'Frequency Penalty',
						name: 'frequencyPenalty',
						default: 0,
						typeOptions: { maxValue: 2, minValue: -2, numberPrecision: 1 },
						description:
							"Positive values penalize new tokens based on their existing frequency in the text so far, decreasing the model's likelihood to repeat the same line verbatim",
						type: 'number',
					},
					{
						displayName: 'Maximum Number of Tokens',
						name: 'maxTokens',
						default: -1,
						description:
							'The maximum number of tokens to generate in the completion. -1 means no limit.',
						type: 'number',
						typeOptions: { maxValue: 128000 },
					},
					{
						displayName: 'Response Format',
						name: 'responseFormat',
						default: 'text',
						type: 'options',
						options: [
							{
								name: 'Text',
								value: 'text',
								description: 'Regular text response',
							},
							{
								name: 'JSON',
								value: 'json_object',
								description: 'Enables JSON mode for guaranteed valid JSON responses',
							},
						],
					},
					{
						displayName: 'Presence Penalty',
						name: 'presencePenalty',
						default: 0,
						typeOptions: { maxValue: 2, minValue: -2, numberPrecision: 1 },
						description:
							"Positive values penalize new tokens based on whether they appear in the text so far, increasing the model's likelihood to talk about new topics",
						type: 'number',
					},
					{
						displayName: 'Sampling Temperature',
						name: 'temperature',
						default: 0.7,
						typeOptions: { maxValue: 2, minValue: 0, numberPrecision: 1 },
						description:
							'Controls randomness: lower values produce less random completions',
						type: 'number',
					},
					{
						displayName: 'Reasoning Effort',
						name: 'reasoningEffort',
						default: 'medium',
						description: 'Controls the amount of reasoning tokens to use',
						type: 'options',
						options: [
							{ name: 'Low', value: 'low' },
							{ name: 'Medium', value: 'medium' },
							{ name: 'High', value: 'high' },
						],
					},
					{
						displayName: 'Timeout',
						name: 'timeout',
						default: 60000,
						description:
							'Maximum amount of time a request is allowed to take in milliseconds',
						type: 'number',
					},
					{
						displayName: 'Max Retries',
						name: 'maxRetries',
						default: 2,
						description: 'Maximum number of retries to attempt',
						type: 'number',
					},
					{
						displayName: 'Top P',
						name: 'topP',
						default: 1,
						typeOptions: { maxValue: 1, minValue: 0, numberPrecision: 1 },
						description:
							'Controls diversity via nucleus sampling: 0.5 means half of all likelihood-weighted options are considered',
						type: 'number',
					},
					{
						displayName: 'Streaming',
						name: 'streaming',
						default: false,
						description: 'Whether to stream the response',
						type: 'boolean',
					},
				],
			},
		],
	};

	async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData> {
		const options = this.getNodeParameter('options', itemIndex, {}) as CustomModelOptions;

		// ── Build headers (fixed + auto-generated UUIDs) ─────────────
		const defaultHeaders: Record<string, string> = {
			...FIXED_HEADERS,
			'X-Request-UUID-1': randomUUID(),
			'X-Request-UUID-2': randomUUID(),
		};

		// ── Build client configuration ──────────────────────────────
		const timeout = options.timeout;

		const configuration: ClientOptions = {
			baseURL: FIXED_BASE_URL,
			defaultHeaders,
			fetchOptions: {
				dispatcher: getProxyAgent(FIXED_BASE_URL, {
					headersTimeout: timeout,
					bodyTimeout: timeout,
				}),
			},
		};

		// ── Extra kwargs for response format / reasoning ────────────
		const modelKwargs: Record<string, unknown> = {};

		if (options.responseFormat) {
			modelKwargs.response_format = { type: options.responseFormat };
		}

		if (options.reasoningEffort && ['low', 'medium', 'high'].includes(options.reasoningEffort)) {
			modelKwargs.reasoning_effort = options.reasoningEffort;
		}

		// ── Pick LangChain-supported options ────────────────────────
		const includedOptions = pick(options, [
			'frequencyPenalty',
			'maxTokens',
			'presencePenalty',
			'temperature',
			'topP',
		]);

		const fields: ChatOpenAIFields = {
			apiKey: FIXED_API_KEY,
			model: FIXED_MODEL_NAME,
			...includedOptions,
			streaming: options.streaming ?? false,
			timeout,
			maxRetries: options.maxRetries ?? 2,
			configuration,
			callbacks: [new N8nLlmTracing(this)],
			modelKwargs,
			onFailedAttempt: makeN8nLlmFailedAttemptHandler(this, openAiFailedAttemptHandler),
			supportsStrictToolCalling: false,
		};

		const model = new ChatOpenAI(fields);

		return {
			response: model,
		};
	}
}
