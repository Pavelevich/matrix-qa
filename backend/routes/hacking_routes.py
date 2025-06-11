import os
import json
import logging
from typing import List, Dict, Any
from fastapi import APIRouter, HTTPException, Depends
from auth import verify_access_jwt

router = APIRouter(prefix="/hacking", tags=["hacking"])
logger = logging.getLogger("hacking-routes")


class HackingTestsService:
    def __init__(self):

        self.hacking_tests_dir = self._find_hacking_directory()
        self.tests_cache = None
        self.load_tests()

    def _find_hacking_directory(self):
        """Find the hacking directory using multiple strategies"""
        possible_paths = [

            os.path.join(os.path.dirname(__file__), "..", "hacking"),

            os.path.join(os.path.dirname(__file__), "..", "..", "hacking"),

            os.path.join(os.path.dirname(os.path.dirname(__file__)), "hacking"),

            os.path.join(os.getcwd(), "hacking"),
            os.path.join(os.getcwd(), "backend", "hacking"),

            "/home/ch/qa-server/qa-remote-browser/backend/hacking",
        ]

        for path in possible_paths:
            abs_path = os.path.abspath(path)
            logger.info(f"Checking hacking directory path: {abs_path}")
            if os.path.exists(abs_path) and os.path.isdir(abs_path):
                logger.info(f"Found hacking directory at: {abs_path}")
                return abs_path

        fallback_path = os.path.abspath(possible_paths[0])
        logger.warning(f"No hacking directory found, using fallback: {fallback_path}")
        return fallback_path

    def load_tests(self):
        """Load security tests from JSON files in the hacking directory"""
        self.tests_cache = []

        try:
            logger.info(f"Attempting to load tests from: {self.hacking_tests_dir}")

            if not os.path.exists(self.hacking_tests_dir):
                logger.warning(f"Hacking tests directory not found: {self.hacking_tests_dir}")
                logger.info("Available directories in parent:")
                parent_dir = os.path.dirname(self.hacking_tests_dir)
                if os.path.exists(parent_dir):
                    for item in os.listdir(parent_dir):
                        item_path = os.path.join(parent_dir, item)
                        if os.path.isdir(item_path):
                            logger.info(f"  Directory: {item}")

                self.tests_cache = self._get_default_tests()
                return


            logger.info(f"Directory contents: {os.listdir(self.hacking_tests_dir)}")

            json_files = [f for f in os.listdir(self.hacking_tests_dir) if f.endswith('.json')]
            logger.info(f"Found JSON files: {json_files}")

            for filename in json_files:
                file_path = os.path.join(self.hacking_tests_dir, filename)
                try:
                    logger.info(f"Loading test file: {file_path}")


                    if not os.access(file_path, os.R_OK):
                        logger.error(f"No read permission for file: {file_path}")
                        continue

                    with open(file_path, 'r', encoding='utf-8') as f:
                        test_data = json.load(f)
                        if self._validate_test_format(test_data):
                            self.tests_cache.append(test_data)
                            logger.info(f"Successfully loaded test: {test_data.get('key', 'Unknown')}")
                        else:
                            logger.warning(f"Invalid test format in {filename}")
                            logger.info(
                                f"Test data keys: {list(test_data.keys()) if isinstance(test_data, dict) else 'Not a dict'}")

                except Exception as e:
                    logger.error(f"Error loading test file {filename}: {str(e)}")

            if not self.tests_cache:
                logger.warning("No valid tests found in JSON files, using default tests")
                self.tests_cache = self._get_default_tests()
            else:
                logger.info(f"Successfully loaded {len(self.tests_cache)} tests from JSON files")

        except Exception as e:
            logger.error(f"Error loading hacking tests: {str(e)}")
            logger.exception("Full exception details:")
            self.tests_cache = self._get_default_tests()

    def _validate_test_format(self, test_data: Dict[str, Any]) -> bool:
        """Validate that a test has the required fields"""
        required_fields = ['key', 'summary', 'description', 'category', 'severity', 'instructions']
        missing_fields = [field for field in required_fields if field not in test_data]

        if missing_fields:
            logger.warning(f"Test validation failed. Missing fields: {missing_fields}")
            return False

        return True

    def _get_default_tests(self) -> List[Dict[str, Any]]:
        """Return default hardcoded security tests"""
        logger.info("Using default hardcoded tests")
        return [
            {
                "key": "HACK-005",
                "summary": "Authentication and Session Management Testing",
                "description": "Test login functionality for security weaknesses",
                "category": "Authentication & Session Management",
                "severity": "High",
                "testing_type": "Security Assessment",
                "target": "Authentication systems",
                "instructions": "Navigate to the target website's login page. Test the following authentication security aspects: 1) Password policy - try creating accounts with weak passwords like '123', 'password', 'admin' 2) Account lockout - attempt 10+ failed login attempts with username 'admin' and random passwords 3) Common credentials - try combinations like admin/admin, admin/password, user/user, test/test 4) Session testing - after successful login, check if session cookies are secure by examining browser developer tools (F12) -> Application -> Cookies. 5) Password reset - if available, test the password reset functionality for information disclosure. 6) Brute force protection - test if there are any rate limiting mechanisms. Document any successful logins, weak password acceptance, or security misconfigurations."
            },
            {
                "key": "HACK-014",
                "summary": "Clickjacking Vulnerability Testing",
                "description": "Test for clickjacking vulnerabilities and frame protection",
                "category": "Clickjacking Testing",
                "severity": "Medium",
                "testing_type": "UI Security Assessment",
                "target": "Frame protection mechanisms",
                "instructions": "Navigate to the target website and test for clickjacking vulnerabilities: 1) Check X-Frame-Options header in browser developer tools (F12) -> Network tab 2) Create a test iframe by opening browser console and executing: var iframe = document.createElement('iframe'); iframe.src = 'https://target-site.com'; iframe.style.width='100%'; iframe.style.height='500px'; document.body.appendChild(iframe); 3) Check if the site loads in the iframe 4) Test Content Security Policy frame-ancestors directive 5) Try embedding login pages in iframes to test if authentication forms are protected 6) Test different frame options like frame-src and child-src in CSP 7) Create a simple HTML page that attempts to frame the target site. Document whether the site can be embedded in frames, which could allow clickjacking attacks where attackers overlay invisible frames to trick users into clicking malicious links."
            },
            {
                "key": "HACK-001",
                "summary": "SQL Injection Testing",
                "description": "Test for SQL injection vulnerabilities in input fields",
                "category": "Input Validation",
                "severity": "High",
                "testing_type": "Injection Testing",
                "target": "Database interactions",
                "instructions": "Navigate to the target website and test for SQL injection vulnerabilities: 1) Identify input fields (login forms, search boxes, contact forms, URL parameters) 2) Test basic SQL injection payloads: ' OR '1'='1' --, admin'-- , ' UNION SELECT NULL-- , '; DROP TABLE users-- 3) Test numeric injection: 1 OR 1=1, 1' OR '1'='1 4) Test time-based blind SQL injection: '; WAITFOR DELAY '00:00:05'-- , ' OR (SELECT SLEEP(5))-- 5) Check for error messages that reveal database information 6) Test URL parameters by adding ' or \" characters 7) Use browser developer tools to inspect responses for database errors or unusual behavior. Document any successful injections, error messages, or suspicious responses that indicate SQL injection vulnerabilities."
            },
            {
                "key": "HACK-002",
                "summary": "Cross-Site Scripting (XSS) Testing",
                "description": "Test for XSS vulnerabilities in user input fields",
                "category": "Input Validation",
                "severity": "High",
                "testing_type": "Injection Testing",
                "target": "User input processing",
                "instructions": "Navigate to the target website and test for XSS vulnerabilities: 1) Identify all input fields (forms, search boxes, comments, profile fields) 2) Test basic XSS payloads: <script>alert('XSS')</script>, <img src=x onerror=alert('XSS')>, <svg onload=alert('XSS')> 3) Test reflected XSS in URL parameters: ?search=<script>alert('XSS')</script> 4) Test stored XSS by submitting payloads in forms that save data 5) Test DOM-based XSS by manipulating URL fragments 6) Use payload variations: \"><script>alert('XSS')</script>, javascript:alert('XSS'), <iframe src=javascript:alert('XSS')> 7) Check if the payloads execute or are reflected in the page source 8) Test filter bypasses with encoding or obfuscation. Document any successful XSS execution, reflected inputs, or filter bypass techniques that work."
            },
            {
                "key": "HACK-003",
                "summary": "CSRF Token Validation Testing",
                "description": "Test Cross-Site Request Forgery protection mechanisms",
                "category": "Authentication & Session Management",
                "severity": "Medium",
                "testing_type": "CSRF Testing",
                "target": "Form submissions",
                "instructions": "Navigate to the target website and test CSRF protection: 1) Log into the application and identify forms that perform sensitive actions (password change, profile update, money transfer, etc.) 2) Use browser developer tools (F12) -> Network tab to capture form submissions 3) Look for CSRF tokens in forms or headers 4) Test CSRF protection by: a) Removing CSRF tokens from requests, b) Using old/expired CSRF tokens, c) Using CSRF tokens from different user sessions, d) Testing if CSRF tokens are validated server-side 5) Create a simple HTML page with a form that submits to the target application without CSRF tokens 6) Test if the application accepts requests without proper CSRF validation 7) Check if anti-CSRF measures like SameSite cookies are implemented. Document any successful CSRF attacks or missing protection mechanisms."
            },
            {
                "key": "HACK-006",
                "summary": "Directory Traversal Testing",
                "description": "Test for directory traversal vulnerabilities in file operations",
                "category": "Input Validation",
                "severity": "High",
                "testing_type": "Path Traversal Testing",
                "target": "File handling mechanisms",
                "instructions": "Navigate to the target website and test for directory traversal vulnerabilities: 1) Identify file download, upload, or include functionality 2) Test path traversal payloads in file parameters: ../../../etc/passwd, ..\\..\\..\\windows\\system32\\drivers\\etc\\hosts, ....//....//....//etc/passwd 3) Test URL-encoded versions: %2e%2e%2f, %2e%2e%5c 4) Test double encoding: %252e%252e%252f 5) Look for file inclusion in URL parameters like ?file=, ?page=, ?include= 6) Test local file inclusion: ?file=../../../etc/passwd, ?page=../../../../windows/win.ini 7) Test for remote file inclusion if applicable 8) Use browser developer tools to check responses for system files or error messages. Document any successful file access, system information disclosure, or path traversal bypasses."
            }
        ]

    def get_tests(self) -> List[Dict[str, Any]]:
        """Get all available security tests"""
        if self.tests_cache is None:
            self.load_tests()
        return self.tests_cache

    def get_test_by_key(self, test_key: str) -> Dict[str, Any]:
        """Get a specific test by its key"""
        tests = self.get_tests()
        for test in tests:
            if test.get('key') == test_key:
                return test
        return None

    def reload_tests(self):
        """Reload tests from disk"""
        self.load_tests()

    def get_debug_info(self) -> Dict[str, Any]:
        """Get debug information about the service state"""
        return {
            "hacking_tests_dir": self.hacking_tests_dir,
            "directory_exists": os.path.exists(self.hacking_tests_dir),
            "directory_readable": os.access(self.hacking_tests_dir, os.R_OK) if os.path.exists(
                self.hacking_tests_dir) else False,
            "tests_count": len(self.tests_cache) if self.tests_cache else 0,
            "working_directory": os.getcwd(),
            "file_location": __file__,
            "directory_contents": os.listdir(self.hacking_tests_dir) if os.path.exists(self.hacking_tests_dir) else [],
        }



hacking_service = HackingTestsService()


@router.get("/debug")
async def get_debug_info(auth_data: dict = Depends(verify_access_jwt)):

    try:
        debug_info = hacking_service.get_debug_info()
        return {
            "success": True,
            "debug_info": debug_info
        }
    except Exception as e:
        logger.error(f"Error getting debug info: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error getting debug info: {str(e)}"
        )


@router.get("/tests")
async def get_hacking_tests(auth_data: dict = Depends(verify_access_jwt)):

    try:
        tests = hacking_service.get_tests()


        source = "default"
        if os.path.exists(hacking_service.hacking_tests_dir):
            json_files = [f for f in os.listdir(hacking_service.hacking_tests_dir) if f.endswith('.json')]
            if json_files:
                source = "json_files"

        return {
            "success": True,
            "tests": tests,
            "total": len(tests),
            "message": f"Retrieved {len(tests)} security tests",
            "source": source
        }

    except Exception as e:
        logger.error(f"Error retrieving hacking tests: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error retrieving security tests: {str(e)}"
        )


@router.get("/tests/{test_key}")
async def get_hacking_test(test_key: str, auth_data: dict = Depends(verify_access_jwt)):

    try:
        test = hacking_service.get_test_by_key(test_key)

        if not test:
            raise HTTPException(
                status_code=404,
                detail=f"Security test with key '{test_key}' not found"
            )

        return {
            "success": True,
            "test": test,
            "message": f"Retrieved security test {test_key}"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving hacking test {test_key}: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error retrieving security test: {str(e)}"
        )


@router.post("/execute-test/{test_key}")
async def execute_hacking_test(test_key: str, auth_data: dict = Depends(verify_access_jwt)):

    try:
        test = hacking_service.get_test_by_key(test_key)

        if not test:
            raise HTTPException(
                status_code=404,
                detail=f"Security test with key '{test_key}' not found"
            )


        formatted_instructions = f"""SECURITY TEST: {test['summary']}
CATEGORY: {test['category']}
SEVERITY: {test['severity']}
TARGET: {test['target']}

DESCRIPTION:
{test['description']}

TESTING INSTRUCTIONS:
{test['instructions']}

NOTE: Remember to replace any placeholder URLs with the actual target URL before execution."""

        return {
            "success": True,
            "test_key": test_key,
            "instructions": formatted_instructions,
            "test_info": {
                "summary": test['summary'],
                "category": test['category'],
                "severity": test['severity'],
                "target": test['target']
            },
            "message": f"Security test {test_key} prepared for execution"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error preparing hacking test {test_key}: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error preparing security test: {str(e)}"
        )


@router.post("/reload-tests")
async def reload_hacking_tests(auth_data: dict = Depends(verify_access_jwt)):  # ← LÍNEA CRÍTICA

    try:

        if auth_data.get("type") == "jwt" and auth_data.get("role") != "admin":
            raise HTTPException(
                status_code=403,
                detail="Admin access required to reload tests"
            )

        hacking_service.reload_tests()
        tests = hacking_service.get_tests()

        return {
            "success": True,
            "tests_count": len(tests),
            "message": f"Successfully reloaded {len(tests)} security tests"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error reloading hacking tests: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error reloading security tests: {str(e)}"
        )