import unittest
from unittest.mock import patch, MagicMock
from langchain_suprawall.callbacks import SupraWallCallbackHandler

class TestSupraWallCallbackHandler(unittest.TestCase):
    def test_init_fails_without_api_key(self):
        with patch.dict('os.environ', {}, clear=True):
            with self.assertRaises(ValueError):
                SupraWallCallbackHandler(api_key=None)

    def test_test_mode_bypass(self):
        handler = SupraWallCallbackHandler(api_key="sw_test_123")
        # Should return None (bypass) without calling network
        result = handler.on_tool_start({"name": "test_tool"}, "input")
        self.assertIsNone(result)

    @patch('requests.post')
    def test_on_tool_start_deny(self, mock_post):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"decision": "DENY", "reason": "Policy violation"}
        mock_post.return_value = mock_resp
        
        handler = SupraWallCallbackHandler(api_key="sw_real_key")
        with self.assertRaises(PermissionError) as cm:
            handler.on_tool_start({"name": "test_tool"}, "input")
        
        self.assertTrue("Blocked" in str(cm.exception))

if __name__ == '__main__':
    unittest.main()
