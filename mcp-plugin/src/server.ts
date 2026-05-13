// Copyright 2026 SupraWall Contributors
// SPDX-License-Identifier: Apache-2.0

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const API_KEY = process.env.SUPRAWALL_API_KEY;
const API_URL = process.env.SUPRAWALL_API_URL || 'https://www.supra-wall.com/api/v1';

if (!API_KEY) {
    console.error('Error: SUPRAWALL_API_KEY environment variable is required.');
    process.exit(1);
}

const server = new Server(
    {
        name: 'suprawall-mcp',
        version: '1.0.0',
    },
    {
        capabilities: {
            tools: {},
        },
    }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: 'check_policy',
                description: "Use this tool BEFORE executing any sensitive or potentially dangerous action. It checks if the intended action complies with the organization's security policies. Input the action and context. It returns ALLOW, DENY, or REQUIRE_APPROVAL.",
                inputSchema: {
                    type: 'object',
                    properties: {
                        action: { type: 'string', description: 'The name or type of action to evaluate (e.g., delete_database)' },
                        context: { type: 'object', description: 'Parameters or context for the action' },
                    },
                    required: ['action'],
                },
                // Anthropic MCP tool safety annotations
                annotations: {
                    readOnlyHint: true,
                    destructiveHint: false,
                    idempotentHint: true,
                    openWorldHint: false
                }
            },
            {
                name: 'request_approval',
                description: 'Use this tool when check_policy returns REQUIRE_APPROVAL or when you suspect an action is highly sensitive. It pauses your workflow to ask a human operator for permission via Slack/Email.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        action: { type: 'string', description: 'The action requesting approval' },
                        reason: { type: 'string', description: 'Explanation for why the human should approve this' },
                        urgency: { type: 'string', enum: ['low', 'medium', 'high'], description: 'Urgency level for approval' },
                    },
                    required: ['action', 'reason'],
                },
                annotations: {
                    readOnlyHint: false,
                    destructiveHint: false,
                    idempotentHint: false,
                    openWorldHint: false
                }
            },
            {
                name: 'log_action',
                description: 'Use this tool to record significant actions to the secure audit trail. Call this AFTER successfully performing an action, or when an action fails due to policy violations.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        action: { type: 'string', description: 'The action that was performed' },
                        outcome: { type: 'string', enum: ['allowed', 'denied', 'approved'], description: 'The outcome of the action' },
                    },
                    required: ['action', 'outcome'],
                },
                annotations: {
                    readOnlyHint: false,
                    destructiveHint: false,
                    idempotentHint: false,
                    openWorldHint: false
                }
            },
        ],
    };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
        switch (name) {
            case 'check_policy': {
                const response = await axios.post(`${API_URL}/evaluate`, {
                    apiKey: API_KEY,
                    toolName: args?.action,
                    args: args?.context || {},
                    source: "mcp-claude"
                });
                return { content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }] };
            }

            case 'request_approval': {
                const response = await axios.post(`${API_URL}/evaluate`, {
                    apiKey: API_KEY,
                    forceApproval: true,
                    toolName: args?.action,
                    args: {
                        ...(args?.context || {}),
                        reason: args?.reason,
                        urgency: args?.urgency
                    },
                    source: "mcp-claude"
                });
                return { content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }] };
            }

            case 'log_action': {
                const response = await axios.post(`${API_URL}/evaluate`, {
                    apiKey: API_KEY,
                    toolName: args?.action,
                    args: {},
                    logOnly: true,
                    outcome: args?.outcome,
                    source: "mcp-claude"
                });
                return { content: [{ type: 'text', text: JSON.stringify({ success: true }, null, 2) }] };
            }

            default:
                throw new Error(`Unknown tool: ${name}`);
        }
    } catch (error: any) {
        const errorDetail = error.response?.data || error.message;
        return {
            isError: true,
            content: [{ type: 'text', text: JSON.stringify(errorDetail, null, 2) }],
        };
    }
});

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('SupraWall MCP server running on stdio');
}

main().catch((error) => {
    console.error('Fatal error in main():', error);
    process.exit(1);
});
