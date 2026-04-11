// Copyright 2026 SupraWall Contributors
// SPDX-License-Identifier: Apache-2.0

import axios from 'axios';

interface SupraWallConfig {
  apiKey: string;
  apiUrl?: string;
}

interface PolicyCheckRequest {
  agentRole?: string;
  toolName: string;
  args: Record<string, unknown>;
  sessionId?: string;
}

interface ApprovalRequest {
  toolName: string;
  args: Record<string, unknown>;
  reason: string;
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
}

interface AuditLogRequest {
  action: string;
  toolName?: string;
  args?: Record<string, unknown>;
  outcome: 'allowed' | 'denied' | 'approved';
}

class SupraWallMCP {
  private config: SupraWallConfig;
  private readonly DEFAULT_API_URL = 'https://www.supra-wall.com/api/v1/evaluate';
  private readonly DEFAULT_DASHBOARD_URL = 'https://www.supra-wall.com';
  
  constructor(config: SupraWallConfig) {
    this.config = {
      apiUrl: config.apiUrl || this.DEFAULT_API_URL,
      apiKey: config.apiKey
    };
  }
  
  private async requestWithRetry(url: string, data: any, retries = 3): Promise<any> {
    let lastError: any;
    for (let i = 0; i < retries; i++) {
        try {
            const response = await axios.post(url, data, {
                headers: {
                    'Authorization': `Bearer ${this.config.apiKey}`,
                    'Content-Type': 'application/json',
                    'x-suprawall-framework': 'mcp'
                },
                timeout: 3000 // 3s timeout
            });
            return response.data;
        } catch (error: any) {
            lastError = error;
            // Only retry on network errors or 5xx
            if (error.response && error.response.status < 500) {
                throw error;
            }
            if (i < retries - 1) {
                const delay = Math.pow(2, i) * 200; // 200ms, 400ms, 800ms
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    throw lastError;
  }
  
  async checkPolicy(request: PolicyCheckRequest) {
    if (this.config.apiKey.startsWith('sw_test_') || this.config.apiKey.startsWith('ag_test_')) {
      return {
        decision: 'ALLOW',
        reason: 'Test mode bypass',
        risk_score: 0,
        approval_required: false
      };
    }
    try {
      const data = await this.requestWithRetry(
        this.config.apiUrl!,
        {
          agentId: request.agentRole || 'mcp_agent',
          toolName: request.toolName,
          arguments: request.args, // Standardized key
          sessionId: request.sessionId,
        }
      );
      
      return {
        decision: data.decision,
        reason: data.reason,
        risk_score: data.risk_score || 0,
        requestId: data.requestId,
        approval_required: data.decision === 'REQUIRE_APPROVAL',
        branding: data.branding
      };
    } catch (error: unknown) {
      console.error('SupraWall policy check failed after retries:', error instanceof Error ? error.message : String(error));
      // Security: Default to DENY on API failure (Fail-Closed)
      return {
        decision: 'DENY',
        reason: 'SupraWall Safety Layer unreachable (Fail-Closed for Security)',
        risk_score: 100,
        approval_required: false
      };
    }
  }

  async requestApproval(request: ApprovalRequest) {
    try {
      const data = await this.requestWithRetry(
        this.config.apiUrl!,
        {
          toolName: request.toolName,
          arguments: request.args, // Standardized key
          forceApproval: true,
          reason: request.reason
        }
      );
      
      const requestId = data.requestId;
      return {
        requestId: requestId,
        status: data.decision === 'REQUIRE_APPROVAL' ? 'pending' : 'decided',
        dashboard_url: `${this.DEFAULT_DASHBOARD_URL}/dashboard/approvals`
      };
    } catch (error: unknown) {
      console.error('SupraWall approval request failed:', error instanceof Error ? error.message : String(error));
      throw new Error('Failed to request approval');
    }
  }

  async logAction(request: AuditLogRequest) {
    try {
      await this.requestWithRetry(
        this.config.apiUrl!,
        {
          toolName: request.toolName || request.action,
          arguments: request.args ?? {}, // Standardized key
          logOnly: true,
          outcome: request.outcome
        }
      );
      return { success: true };
    } catch (error: unknown) {
      console.error('SupraWall audit log failed:', error instanceof Error ? error.message : String(error));
      return { success: false };
    }
  }
}

// MCP Plugin exports
export default async function initialize(config: SupraWallConfig) {
  const suprawall = new SupraWallMCP(config);
  
  return {
    name: 'suprawall',
    version: '1.2.0', // Updated version
    tools: {
      check_policy: suprawall.checkPolicy.bind(suprawall),
      request_approval: suprawall.requestApproval.bind(suprawall),
      log_action: suprawall.logAction.bind(suprawall)
    }
  };
}
