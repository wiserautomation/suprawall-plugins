import unittest
from unittest.mock import MagicMock, patch

# Mock the Dify Tool class since we won't have the dify_plugin package
import sys
sys.modules['dify_plugin'] = MagicMock()
sys.modules['dify_plugin.entities.tool'] = MagicMock()

from tools.enforce import SupraWallEnforceTool

class TestSupraWallEnforceTool(unittest.TestCase):
    def setUp(self):
        self.tool = SupraWallEnforceTool()
        self.tool.runtime = MagicMock()
        self.tool.create_json_message = lambda x: {"type": "json", "data": x}
        self.tool.create_text_message = lambda x: {"type": "text", "text": x}

    def test_test_mode_bypass(self):
        self.tool.runtime.credentials = {"api_key": "sw_test_123"}
        gen = self.tool._invoke({"content": "test content"})
        messages = list(gen)
        self.assertEqual(messages[0]["data"]["decision"], "ALLOW")

    @patch('httpx.Client.post')
    def test_invoke_deny(self, mock_post):
        self.tool.runtime.credentials = {"api_key": "sw_real_key"}
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"decision": "DENY", "reason": "Blocked"}
        mock_post.return_value = mock_resp
        
        with self.assertRaises(Exception) as cm:
            list(self.tool._invoke({"content": "harmful content", "raise_on_deny": True}))
        
        self.assertTrue("Blocked" in str(cm.exception))

if __name__ == '__main__':
    unittest.main()
