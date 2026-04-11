import unittest
from unittest.mock import patch, MagicMock
import os
from autogen_suprawall import with_suprawall

class TestAutoGenSupraWall(unittest.TestCase):
    def test_init_fails_without_api_key(self):
        with patch.dict('os.environ', {}, clear=True):
            def my_tool(): pass
            with self.assertRaises(ValueError):
                with_suprawall(my_tool, api_key=None)

    def test_test_mode_bypass(self):
        def my_tool(): return "success"
        # Using a test key should return the original function (no wrapper)
        wrapped = with_suprawall(my_tool, api_key="sw_test_123")
        self.assertEqual(wrapped(), "success")
        self.assertEqual(wrapped, my_tool)

    @patch('requests.post')
    def test_evaluate_deny(self, mock_post):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"decision": "DENY"}
        mock_post.return_value = mock_resp
        
        def my_tool(): return "success"
        wrapped = with_suprawall(my_tool, api_key="sw_real_key")
        
        result = wrapped()
        self.assertTrue("Policy Violation" in result)

if __name__ == '__main__':
    unittest.main()
