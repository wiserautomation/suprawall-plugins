# Copyright 2026 SupraWall Contributors
# SPDX-License-Identifier: Apache-2.0

import os
from typing import Any, Dict, List, Optional
from llama_index.core.pack.base import BaseLlamaPack
from llama_index.core.agent import ReActAgent
from llama_index.core.tools import BaseTool
import requests

class SupraWallSecurityPack(BaseLlamaPack):
    """SupraWall Security Pack.
    
    This pack provides a ReActAgent wrapped with SupraWall deterministic security guardrails.
    It intercepts tool calls to ensure they comply with your security policies.
    """

    def __init__(self, tools: List[BaseTool], llm: Any, api_key: Optional[str] = None, **kwargs):
        self.api_key = api_key or os.environ.get("SUPRAWALL_API_KEY")
        if not self.api_key:
            raise ValueError("SUPRAWALL_API_KEY is required for SupraWallSecurityPack")
        
        self.api_url = os.environ.get("SUPRAWALL_API_URL", "https://api.suprawall.io/v1/evaluate")
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
            
            def secured_call(*args, **kwargs):
                # Call SupraWall for a security decision
                res = requests.post(self.api_url, json={
                    "agentId": "llama_index_secured_agent",
                    "toolName": tool.metadata.name,
                    "arguments": kwargs
                }, headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "x-suprawall-framework": "llama-index"
                })
                
                if res.status_code == 200:
                    decision = res.json().get("decision")
                    if decision == "DENY":
                        return f"SupraWall Policy Violation: Tool '{tool.metadata.name}' was blocked. Reason: Security Policy Enforcement."
                    elif decision == "REQUIRE_APPROVAL":
                        return f"SupraWall: Tool '{tool.metadata.name}' requires manual human approval."
                else:
                    # Fail closed for security
                    return "SupraWall Unreachable: Security guardrails active, failing closed."
                
                return original_call(*args, **kwargs)
            
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
