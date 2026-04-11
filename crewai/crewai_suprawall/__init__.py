# Copyright 2026 SupraWall Contributors
# SPDX-License-Identifier: Apache-2.0

import os
import requests
from typing import List, Any, Optional

def with_suprawall(tools: List[Any], api_key: Optional[str] = None) -> List[Any]:
    """
    Wraps existing CrewAI (LangChain) tools with suprawall evaluation.
    CrewAI uses LangChain's BaseTool under the hood.
    """
    key = api_key or os.environ.get("SUPRAWALL_API_KEY")
    if not key:
        raise ValueError("SUPRAWALL_API_KEY is required")
        
    api_url = os.environ.get("SUPRAWALL_API_URL", "https://www.supra-wall.com/api/v1/evaluate")
    
    # Test mode: sw_test_ or ag_test_ keys skip evaluation
    if key.startswith("sw_test_") or key.startswith("ag_test_"):
        return tools

    secured_tools = []
    
    for tool in tools:
        original_run = getattr(tool, "_run", None)
        original_arun = getattr(tool, "_arun", None)
        
        if not original_run and not original_arun:
            secured_tools.append(tool)
            continue

        def _evaluate_action(tool_name, combined_args):
            last_err = None
            for i in range(3):
                try:
                    res = requests.post(api_url, json={
                        "agentId": "crewai_agent",
                        "toolName": tool_name,
                        "arguments": combined_args
                    }, headers={
                        "Authorization": f"Bearer {key}",
                        "x-suprawall-framework": "crewai"
                    }, timeout=3.0)
                    
                    if res.status_code == 200:
                        decision = res.json().get("decision")
                        if decision == "DENY":
                            return False, f"Action blocked by SupraWall Security: Tool '{tool_name}' is explicitly denied."
                        elif decision == "REQUIRE_APPROVAL":
                            return False, f"Action blocked by SupraWall: Tool '{tool_name}' requires human approval."
                        return True, None
                    elif 400 <= res.status_code < 500:
                        return False, f"SupraWall API Error ({res.status_code}): Failing Closed."
                except requests.exceptions.RequestException as e:
                    last_err = e
                    if i < 2:
                        import time
                        time.sleep(2**i * 0.2)
                        continue
            return False, f"SupraWall Unreachable after retries ({str(last_err)}): Failing Closed."

        if original_run:
            def secure_run(*args, tool_name=tool.name, _original_func=original_run, **kwargs):
                combined_args = {"args": args, "kwargs": kwargs} if args else kwargs
                success, error_msg = _evaluate_action(tool_name, combined_args)
                if not success:
                    return error_msg
                return _original_func(*args, **kwargs)
            tool._run = secure_run

        if original_arun:
            async def secure_arun(*args, tool_name=tool.name, _original_func=original_arun, **kwargs):
                combined_args = {"args": args, "kwargs": kwargs} if args else kwargs
                # Note: evaluation is currently synchronous; in a full async environment 
                # this should be moved to an async requests library like httpx.
                success, error_msg = _evaluate_action(tool_name, combined_args)
                if not success:
                    return error_msg
                return await _original_func(*args, **kwargs)
            tool._arun = secure_arun

        secured_tools.append(tool)
        
    return secured_tools
