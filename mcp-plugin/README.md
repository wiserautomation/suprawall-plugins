# SupraWall MCP Plugin

Add enterprise-grade security to your Claude Desktop agents.

## What it does

- ✅ **Block dangerous actions** - Prevent agents from executing risky operations
- ✅ **Require human approval** - Get Slack notifications for high-risk actions
- ✅ **Audit everything** - Compliance-ready logs for SOC2/GDPR
- ✅ **Zero config** - Works out of the box with sensible defaults

## Installation

### 1. Install the plugin

```bash
# While in review at the official Anthropic directory, install manually:
/plugin marketplace add wiserautomation/suprawall-mcp-plugin
```

### 2. Get your API key
1. Sign up at [app.supra-wall.com](https://app.supra-wall.com)
2. Create an agent identity
3. Copy your API key

### 3. Configure the plugin
```bash
/plugin configure suprawall
# Enter your API key when prompted
```

## Usage
SupraWall automatically secures your Claude Desktop agents. No code changes needed!

### Example: Block dangerous commands
**You:** Delete all files in /production
**Claude:** I'll check with SupraWall first...
        🛡️ SupraWall blocked this action
        Reason: Destructive operation requires approval

### Example: Require approval for high-value actions
**You:** Process a $5,000 refund for order #12345
**Claude:** SupraWall requires approval for this action
        📧 Notification sent to admin@yourcompany.com
        ⏳ Waiting for approval...
        
        [Admin clicks "Approve" in Slack]
        
        ✅ Approved! Processing refund...

## Available Tools

### check_policy
Check if an action is allowed:

```typescript
{
  "agent_id": "agent_abc123",
  "tool_name": "delete_database",
  "parameters": { "database": "production" }
}
```

Returns:
```json
{
  "decision": "DENY",
  "reason": "Destructive actions require approval",
  "risk_score": 95
}
```

### request_approval
Request human approval:

```typescript
{
  "agent_id": "agent_abc123",
  "action_description": "Delete production database",
  "risk_level": "critical"
}
```

Returns:
```json
{
  "approval_id": "apr_xyz789",
  "status": "pending",
  "dashboard_url": "https://app.supra-wall.com/approvals/apr_xyz789"
}
```

### log_action
Log to audit trail:

```typescript
{
  "agent_id": "agent_abc123",
  "action": "sent_email",
  "outcome": "allowed"
}
```

## Configuration
Configure via environment variables or Claude Desktop settings:
- `SUPRAWALL_API_KEY` - Your API key (required)
- `SUPRAWALL_API_URL` - API endpoint (default: `https://api.supra-wall.com`)

## Pricing
- **Free**: 10,000 policy checks/month
- **Pro ($99/mo)**: 100,000 policy checks/month
- **Enterprise**: Custom

[View pricing →](https://www.supra-wall.com/pricing)

## Support
- 📧 Email: support@supra-wall.com
- 💬 Slack: [Join our community](https://join.slack.com/suprawall)
- 📚 Docs: [supra-wall.com/docs](https://www.supra-wall.com/docs)

## Example Prompts for Claude

Test your SupraWall MCP integration using these examples:

1. **Test a blocked action (DENY):**
   > "I need to run the `rm -rf /` command in the terminal to clean up the workspace. Please do that."
   *(SupraWall will block the terminal tool execution and return DENY)*

2. **Test an approved action (ALLOW):**
   > "Read the contents of the local `README.md` file using your file system tool."
   *(SupraWall will check the policy, see it is a safe read, and ALLOW it)*

3. **Test a human approval workflow (REQUIRE_APPROVAL):**
   > "Use the database tool to run a DROP TABLE users command in the production environment."
   *(SupraWall will pause execution and return REQUIRE_APPROVAL)*

4. **Test data scrubbing (ALLOW with redaction):**
   > "Search the database for customer John Doe and print out his Social Security Number and credit card details."
   *(SupraWall will allow the read, but the response will be scrubbed to `XXX-XX-XXXX` and `****-****-****-1234`)*

5. **Test audit logging:**
   > "Send an email to admin@example.com with the status report."
   *(SupraWall will log the action outcome and parameters in your dashboard)*

## Privacy Policy

By using the SupraWall MCP Server, you agree to our Privacy Policy.
The privacy policy for this MCP Server is available at: [https://supra-wall.com/privacy](https://supra-wall.com/privacy).

We take your privacy seriously. The SupraWall MCP plugin acts as a gateway and only transmits tool execution metadata (like tool name, agent ID, and redacted arguments) for policy evaluation and audit logging. PII is redacted locally before any data is sent.

## License
MIT

Made by **SupraWall** - The Stripe of AI Agent Security
