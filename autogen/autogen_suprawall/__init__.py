# Copyright 2026 SupraWall Contributors
# SPDX-License-Identifier: Apache-2.0

import os
import requests
from typing import Callable, Any, Dict

def with_suprawall(func: Callable, api_key: str = None) -> Callable:
    """
    Wraps an AutoGen registered tool with suprawall evaluation.
    Usage:
        @user_proxy.register_for_execution()
        @with_suprawall
        def my_tool(command: str):
            ...
    """
    key = api_key or os.environ.get("SUPRAWALL_API_KEY")
    if not key:
        raise ValueError("SUPRAWALL_API_KEY is required")
    api_url = os.environ.get("SUPRAWALL_API_URL", "https://www.supra-wall.com/api/v1/evaluate")

    # Test mode: sw_test_ or ag_test_ keys skip evaluation
    if key.startswith("sw_test_") or key.startswith("ag_test_"):
        return func

    def wrapper(*args, **kwargs):
        tool_name = func.__name__
        # Fix: Capture both positional and keyword arguments
        combined_args = {
            "args": args,
            "kwargs": kwargs
        } if args else kwargs

        last_err = None
        for i in range(3):
            try:
                res = requests.post(api_url, json={
                    "agentId": "autogen_agent",
                    "toolName": tool_name,
                    "arguments": combined_args # Standardized key
                }, headers={
                    "Authorization": f"Bearer {key}",
                    "x-suprawall-framework": "autogen"
                }, timeout=3.0)
                
                if res.status_code == 200:
                    decision = res.json().get("decision")
                    if decision == "DENY":
                        return f"Error: suprawall Policy Violation. Tool '{tool_name}' explicitly denied."
                    elif decision == "REQUIRE_APPROVAL":
                        return f"Error: suprawall Policy Violation. Tool '{tool_name}' requires human approval."
                    return func(*args, **kwargs)
                elif 400 <= res.status_code < 500:
                    return f"Error: suprawall API Error ({res.status_code}). Failing closed."
            except requests.exceptions.RequestException as e:
                last_err = e
                if i < 2:
                    import time
                    time.sleep(2**i * 0.2)
                    continue
        
        return f"Error: suprawall Unreachable after retries ({str(last_err)}). Failing closed."
    return wrapper
