import unittest
from unittest.mock import MagicMock, patch
import os

# Mock llama_index modules
import sys
sys.modules['llama_index'] = MagicMock()
sys.modules['llama_index.core'] = MagicMock()
sys.modules['llama_index.core.pack'] = MagicMock()
sys.modules['llama_index.core.pack.base'] = MagicMock()
sys.modules['llama_index.core.agent'] = MagicMock()
sys.modules['llama_index.core.tools'] = MagicMock()

from llama_index_suprawall.base import SupraWallSecurityPack

class TestLlamaIndexSupraWall(unittest.TestCase):
    def setUp(self):
        self.mock_llm = MagicMock()
        self.mock_tool = MagicMock()
        self.mock_tool.metadata.name = "test_tool"

    def test_init_fails_without_api_key(self):
        with patch.dict('os.environ', {}, clear=True):
            with self.assertRaises(ValueError):
                SupraWallSecurityPack(tools=[self.mock_tool], llm=self.mock_llm, api_key=None)

    def test_test_mode_bypass(self):
        pack = SupraWallSecurityPack(
            tools=[self.mock_tool], 
            llm=self.mock_llm, 
            api_key="sw_test_123"
        )
        # In test mode, it should just assign tools and agent without wrapping
        self.assertEqual(pack.secured_tools, [self.mock_tool])

    @patch('requests.post')
    def test_secured_call_deny(self, mock_post):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"decision": "DENY"}
        mock_post.return_value = mock_resp

        pack = SupraWallSecurityPack(
            tools=[self.mock_tool], 
            llm=self.mock_llm, 
            api_key="sw_real_key"
        )
        
        # Get the wrapped call
        secured_tool = pack.secured_tools[0]
        result = secured_tool.__call__()
        
        self.assertTrue("Policy Violation" in result)

if __name__ == '__main__':
    unittest.main()
