# Copyright 2026 SupraWall Contributors
# SPDX-License-Identifier: Apache-2.0

import os
from typing import Any, Dict, List, Optional
from llama_index.core.pack.base import BaseLlamaPack
from llama_index.core.agent import ReActAgent
from llama_index.core.tools import BaseTool
import requests
import time

class SupraWallSecurityPack(BaseLlamaPack):
    """SupraWall Security Pack.
    
    This pack provides a ReActAgent wrapped with SupraWall deterministic security guardrails.
    It intercepts tool calls to ensure they comply with your security policies.
    """

    def __init__(self, tools: List[BaseTool], llm: Any, api_key: Optional[str] = None, **kwargs):
        self.api_key = api_key or os.environ.get("SUPRAWALL_API_KEY")
        if not self.api_key:
            raise ValueError("SUPRAWALL_API_KEY is required for SupraWallSecurityPack")
        
        self.api_url = os.environ.get("SUPRAWALL_API_URL", "https://www.supra-wall.com/api/v1/evaluate")
        
        # Test mode: sw_test_ or ag_test_ keys skip evaluation
        if self.api_key.startswith("sw_test_") or self.api_key.startswith("ag_test_"):
             self.secured_tools = tools
             self.agent = ReActAgent.from_tools(tools, llm=llm, **kwargs)
             return
        self.tools = tools
        self.llm = llm
        self.kwargs = kwargs
        
        # Initialize the secured agent
        self.secured_tools = self._wrap_tools(tools)
        self.agent = ReActAgent.from_tools(self.secured_tools, llm=llm, **kwargs)

    def _wrap_tools(self, tools: List[BaseTool]) -> List[BaseTool]:
        """Wrap LlamaIndex tools with SupraWall security logic."""
        secured_tools = []
        for tool in tools:
            # We wrap the call method of the tool
            original_call = tool.__call__
            tool_name = tool.metadata.name

            # SECURITY: Use default parameter binding to capture tool_name and original_call
            # at definition time, not at call time. This prevents the late-binding closure bug
            # where all wrappers end up using the last tool's metadata and original_call.
            def secured_call(*args, tool_name=tool_name, original_func=original_call, **kwargs):
                # Fix: Capture both positional and keyword arguments
                combined_args = {
                    "args": args,
                    "kwargs": kwargs
                } if args else kwargs

                res = None
                last_error = None
                for i in range(3):
                    try:
                        # Call SupraWall for a security decision
                        res = requests.post(self.api_url, json={
                            "agentId": "llama_index_secured_agent",
                            "toolName": tool_name,
                            "arguments": combined_args # Standardized key
                        }, headers={
                            "Authorization": f"Bearer {self.api_key}",
                            "x-suprawall-framework": "llama-index"
                        }, timeout=3.0)
                        
                        if res.status_code == 200:
                            break
                        elif 400 <= res.status_code < 500:
                            return f"SupraWall API Error ({res.status_code}): Security guardrails active, failing closed."
                    except requests.exceptions.RequestException as e:
                        last_error = e
                        if i == 2: # Last try
                            return f"SupraWall Request Timeout/Failure after retries ({str(last_error)}): Security guardrails active, failing closed."
                    
                    time.sleep(2**i * 0.2) # 0.2s, 0.4s, 0.8s backoff
                
                if res and res.status_code == 200:
                    decision_data = res.json()
                    decision = decision_data.get("decision")
                    if decision == "DENY":
                        reason = decision_data.get("reason", "Security Policy Enforcement")
                        return f"SupraWall Policy Violation: Tool '{tool_name}' was blocked. Reason: {reason}"
                    elif decision == "REQUIRE_APPROVAL":
                        return f"SupraWall: Tool '{tool_name}' requires manual human approval."
                else:
                    # Fail closed for security
                    return "SupraWall Unreachable: Security guardrails active, failing closed."

                return original_func(*args, **kwargs)

            tool.__call__ = secured_call
            secured_tools.append(tool)
        return secured_tools

    def get_modules(self) -> Dict[str, Any]:
        """Get modules."""
        return {
            "agent": self.agent,
            "llm": self.llm,
            "tools": self.secured_tools
        }

    def run(self, *args: Any, **kwargs: Any) -> Any:
        """Run the agent."""
        return self.agent.chat(*args, **kwargs)
