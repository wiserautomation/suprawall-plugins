# 🛡️ SupraWall Plugins Monorepo

**The Industry-Standard Deterministic Security Layer for AI Agents.**

SupraWall solves the "trust" problem in generative AI by providing a zero-knowledge, deterministic security layer between LLMs and your production systems. Unlike probabilistic security models, SupraWall enforces strict business policies and forensic-grade threat detection before an agentic action even reaches your API.

[Official Website](https://www.supra-wall.com) | [Main Repository](https://github.com/wiserautomation/SupraWall) | [Documentation](https://docs.supra-wall.com)

---

## 🏛️ Project Vision

SupraWall (formerly AgentGate) was built to bridge the gap between high-velocity AI experimentation and enterprise security compliance. Our goal is to empower developers to ship autonomous agentic fleets without the risk of Prompt Injection, PII data leakage, or uncontrolled tool execution.

This monorepo serves as the official distribution hub for all SupraWall plugins and framework integrations.

---

## 📦 Plugin Directory

### 🚀 Core Platform Integrations
- **[Dify Plugin](./suprawall-security)**: Explicit security guardrails for Dify Workflows. Detects SQLi, XSS, and Prompt Injection natively within your Dify environment.
- **[MCP Claude Server](./mcp-plugin)**: Official implementation of the Model Context Protocol (MCP). Enables SupraWall security policies directly within Anthropic Claude Desktop and Claude-powered agents.
- **[OpenClaw Extension](./openclaw)**: Native security middleware for the OpenClaw agent runtime.

### 🧱 Framework Security Middleware
Seamless "Zero-Trust" wrappers for the industry's leading AI agent frameworks:
- **[AutoGen Integration](./autogen)**: Secure protection for Microsoft AutoGen multi-agent topologies.
- **[CrewAI Integration](./crewai)**: Deterministic policy enforcement for CrewAI processes and agents.
- **[LangChain (Python & TS)](./langchain-py)**: Security interceptors for LangChain chains, tools, and executors.
- **[LlamaIndex Integration](./llama-index)**: Secure guardrails for RAG pipelines and tool-based retrieval.
- **[Vercel AI SDK Integration](./vercel-ai)**: One-line security additions for projects built on the Vercel AI SDK.

---

## 🚦 Quick Start

### For Dify Marketplace Users
We represent the most robust security option on the [Dify Marketplace](https://cloud.dify.ai/plugins). To install manually during the initial review phase, use the pre-packaged `.difypkg` found in the `suprawall-security` directory.

### For Claude Desktop Users
Add SupraWall to your `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "suprawall": {
      "command": "npx",
      "args": ["-y", "@suprawall/mcp-plugin"]
    }
  }
}
```

---

## 🛡️ Security Architecture
SupraWall is built on three core pillars:
1. **Detection**: Real-time identification of adversarial intent (Prompt Injection, SQLi, Jailbreaks).
2. **Scrubbing**: Automatic removal of PII (Names, Emails, Keys) before data leaves your environment.
3. **Enforcement**: Strict policy-based execution—if a tool call doesn't match your rule, it's blocked.

---

## 📄 License
Licensed under the [Apache License 2.0](./LICENSE).

&copy; 2026 WiserAutomation. Agency. All rights reserved. Registered in the Dify and Anthropic Marketplaces.
