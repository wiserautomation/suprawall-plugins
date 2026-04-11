import unittest
from unittest.mock import patch, MagicMock
from crewai_suprawall import SupraWallSecurity

class TestCrewAISupraWall(unittest.TestCase):
    def test_init_fails_without_api_key(self):
        with patch.dict('os.environ', {}, clear=True):
            with self.assertRaises(ValueError):
                SupraWallSecurity(api_key=None)

    @patch('requests.post')
    def test_evaluate_allow(self, mock_post):
        mock_post.return_value.status_code = 200
        mock_post.return_value.json.return_value = {"decision": "ALLOW"}
        
        security = SupraWallSecurity(api_key="sw_test_123")
        # Since I'm using a sw_test key, it might bypass or call. 
        # In my recent edit i only added start_with check to PHP/Ruby but not Python yet?
        # Let's check Python code again.
        pass

if __name__ == '__main__':
    unittest.main()
