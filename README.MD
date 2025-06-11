# Matrix QA Test Runner

<div align="center">

<!-- Logo placeholder - Replace with your hosted logo -->
<img src="https://github.com/user-attachments/assets/a6dfe1bd-fe1f-4c3e-84c7-e422430e094a" alt="logo" width="150"/>


<!-- Alternative: Use a simple text-based logo -->
<!--
<div style="font-family: 'Courier New', monospace; color: #00ff00; font-size: 24px; font-weight: bold; background: #000; padding: 20px; border-radius: 10px;">
🧠⚡ MATRIX QA<br/>
&nbsp;&nbsp;&nbsp;TEST RUNNER
</div>
-->

[![Matrix QA Test Runner](https://img.shields.io/badge/Matrix-QA%20Test%20Runner-00ff00?style=for-the-badge&logo=matrix&logoColor=00ff00)](https://tooncraftai.com/)

<p align="center">
  <a href="https://fastapi.tiangolo.com" target="_blank"><img src="https://img.shields.io/badge/FastAPI-000000?style=for-the-badge&logo=fastapi&logoColor=00FF00" alt="FastAPI"></a>
  <a href="https://www.python.org" target="_blank"><img src="https://img.shields.io/badge/python-3.12+-000000?style=for-the-badge&logo=python&logoColor=00FF00" alt="Python"></a>
  <a href="https://www.mongodb.com" target="_blank"><img src="https://img.shields.io/badge/MongoDB-000000?style=for-the-badge&logo=mongodb&logoColor=00FF00" alt="MongoDB"></a>
  <a href="https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API" target="_blank"><img src="https://img.shields.io/badge/WebSocket-Real--time-000000?style=for-the-badge&logo=websocket&logoColor=00FF00" alt="WebSocket"></a>
  <a href="https://owasp.org" target="_blank"><img src="https://img.shields.io/badge/Security-Testing-000000?style=for-the-badge&logo=lock&logoColor=00FF00" alt="Security"></a>
  <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank"><img src="https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-000000?style=for-the-badge&logoColor=00FF00" alt="License"></a>
</p>

**AI-Powered Browser Automation, QA Testing & Security Assessment Platform**

*Harness the power of multiple AI providers to automate web testing and security assessments with real-time monitoring and comprehensive reporting.*

[Features](#features) • [Installation](#installation) • [Configuration](#configuration) • [Usage](#usage) • [Security Testing](#security-testing) • [API](#api-documentation) • [Contributing](#contributing)

</div>

---

## 🚀 Overview

Matrix QA Test Runner is a cutting-edge, AI-powered testing platform designed to revolutionize quality assurance and security testing workflows. Built with a Matrix-themed interface, it combines the power of multiple AI providers with intelligent browser automation to deliver comprehensive testing solutions including advanced security vulnerability assessments.


**Powered by [Browser-Use](https://browser-use.com/)** - The platform leverages the browser-use agent technology as its core automation engine, integrated seamlessly into the backend with custom modifications to store execution results and screenshots directly in MongoDB for comprehensive test tracking and analysis.

### 🎯 Key Highlights

- **Multi-AI Integration**: Support for Claude, GPT, DeepSeek, and more
- **Security Testing Suite**: 100+ predefined security tests for web vulnerabilities
- **Real-time Monitoring**: Live browser screenshots and execution tracking
- **JIRA Integration**: Seamless ticket management and automation
- **Video Recording**: Capture test executions for analysis
- **Enterprise Ready**: JWT authentication, role-based access, and MongoDB persistence

---

## ✨ Features

### 🤖 **AI-Powered Testing**
- **Multiple AI Providers**: Anthropic Claude, OpenAI GPT, DeepSeek, Mistral AI, Google Gemini
- **Intelligent Test Generation**: Natural language instructions converted to automated actions
- **Smart Error Handling**: AI-driven debugging and recovery mechanisms

### 🛡️ **Security Testing Suite**
- **100+ Security Tests**: Comprehensive vulnerability assessments including:
  - **SQL Injection Testing**: Database injection vulnerability detection
  - **Cross-Site Scripting (XSS)**: Reflected, stored, and DOM-based XSS testing
  - **CSRF Token Validation**: Cross-Site Request Forgery protection testing
  - **Authentication & Session Management**: Login security and session handling
  - **Directory Traversal**: Path traversal and file inclusion vulnerabilities
  - **Clickjacking Testing**: Frame protection and UI redressing attacks
- **Severity Classification**: High, Medium, Low risk categorization
- **Target URL Configuration**: Dynamic target specification for security assessments
- **Category Filtering**: Organized by vulnerability types and testing methods
- **One-Click Execution**: Automated security test deployment

### 🖥️ **Real-time Monitoring**
- **Live Screenshots**: WebSocket-powered real-time browser viewing
- **Video Recording**: MP4/GIF capture of test executions with FFmpeg support
- **Progress Tracking**: Step-by-step execution monitoring with detailed logs

### 🔐 **Enterprise Security**
- **JWT Authentication**: Secure token-based authentication system
- **Role-based Access**: Admin and user permission levels
- **API Key Management**: Encrypted storage of AI provider credentials

### 📊 **Comprehensive Reporting**
- **Execution History**: Detailed test run archives with searchable metadata
- **Video Attachments**: Link recordings to specific test executions
- **Security Reports**: Vulnerability assessment results and recommendations
- **Export Capabilities**: Download results and videos for offline analysis

### 🎫 **JIRA Integration**
- **Ticket Automation**: Execute tests directly from JIRA tickets
- **Label-based Filtering**: Automatic detection of automation-ready tickets
- **Security Issue Tracking**: Link security findings to JIRA issues
- **Seamless Workflow**: Bridge between issue tracking and test execution

### ⚙️ **Advanced Configuration**
- **Video Settings**: Configurable resolution, quality, and frame rates
- **API Configuration**: Per-model API key management
- **Security Test Management**: Custom test definitions and modifications
- **User Management**: Admin panel for user creation and management

### 🤖 **Browser-Use Integration**
- **Core Automation Engine**: Built on [Browser-Use](https://browser-use.com/) technology
- **MongoDB Integration**: Custom modifications to store execution results in database
- **Real-time Updates**: Enhanced WebSocket communication for live test monitoring
- **Screenshot Persistence**: Automatic capture and storage of browser screenshots
- **Multi-AI Support**: Compatible with multiple AI providers through Browser-Use framework

---

## 🛠️ Installation

### Prerequisites

- **Python 3.12.3**
- **MongoDB 4.0+**
- **Node.js 14+** (for frontend dependencies)
- **FFmpeg** (optional, for MP4 video recording)

### Quick Start

1. **Clone the Repository**
   ```bash
   git clone https://github.com/yourusername/qa-remote-browser.git
   cd qa-remote-browser
   ```

2. **Set Up Python Environment**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

3. **Install Browser Dependencies**
   ```bash
   # Install browser-use package (modified version included for MongoDB integration)
   cd browser_use_mod/browser-use
   pip install -e .
   cd ../..
   
   # Install Playwright browsers
   playwright install
   ```

4. **Install Node.js Dependencies** (if needed)
   ```bash
   npm install
   ```

5. **Configure Environment Variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

6. **Start the Application**
   ```bash
   python main.py
   ```

7. **Access the Application**
   - Open your browser to `http://localhost:8000`
   - Default credentials: `admin` / `admin`

---

## ⚙️ Configuration

### Environment Variables

Create a `.env` file in the root directory:

```bash
# Database Configuration
MONGO_URI=mongodb://localhost:27017/matrix_qa
JWT_SECRET=your_jwt_secret_key_here
ENCRYPTION_KEY=your_32_character_encryption_key

# API Keys (Optional - can be set in UI)
ANTHROPIC_API_KEY=sk-ant-your-key-here
OPENAI_API_KEY=sk-your-openai-key-here
DEEPSEEK_API_KEY=your-deepseek-key-here

# JIRA Integration (Optional)
JIRA_URL=https://your-company.atlassian.net
JIRA_USERNAME=your-email@company.com
JIRA_API_TOKEN=your-jira-api-token
JIRA_AUTOMATION_LABELS=qa-automation,matrix-test,automated-test

# Server Configuration
PORT=8000
API_KEY=qa_secret_key
```

### MongoDB Setup

1. **Install MongoDB**
   ```bash
   # Ubuntu/Debian
   sudo apt-get install mongodb
   
   # macOS
   brew install mongodb-community
   
   # Or use Docker
   docker run -d -p 27017:27017 --name mongodb mongo:latest
   ```

2. **Verify Connection**
   ```bash
   mongosh mongodb://localhost:27017/matrix_qa
   ```

### Security Tests Configuration

Security tests can be configured in JSON files within the `backend/hacking/` directory. Each test should follow this structure:

```json
{
  "key": "HACK-XXX",
  "summary": "Test Name",
  "description": "Brief description of the test",
  "category": "Vulnerability Category",
  "severity": "High|Medium|Low",
  "testing_type": "Type of Assessment",
  "target": "Target System/Component",
  "instructions": "Detailed testing instructions..."
}
```

### JIRA Integration Setup

1. **Generate API Token**
   - Go to [Atlassian Account Settings](https://id.atlassian.com/manage-profile/security/api-tokens)
   - Create new API token
   - Add to environment variables

2. **Configure Automation Labels**
   - Set `JIRA_AUTOMATION_LABELS` with comma-separated labels
   - Tickets with these labels will appear in the automation interface

---

## 🎮 Usage

### Getting Started

1. **Login**
   - Access the Matrix-themed login interface
   - Use default credentials: `admin` / `admin`
   - Create additional users via the admin panel

2. **Configure API Settings**
   - Click the "CONFIG" button in the control panel
   - Add your AI provider API keys
   - Test connections to ensure proper setup

3. **Run Your First Test**
   ```
   Navigate to https://example.com and verify the page title contains "Example"
   ```

### AI Provider Configuration

#### Anthropic Claude
```bash
# API Key format: sk-ant-...
ANTHROPIC_API_KEY=sk-ant-api03-your-key-here
```

#### OpenAI
```bash
# API Key format: sk-...
OPENAI_API_KEY=sk-your-openai-key-here
```

#### DeepSeek
```bash
# API Key from DeepSeek platform
DEEPSEEK_API_KEY=your-deepseek-key-here
```

### Video Recording

1. **Enable Recording**
   - Go to CONFIG → VIDEO SETTINGS
   - Enable "VIDEO RECORDING"
   - Configure resolution and quality

2. **View Recordings**
   - Access EXECUTION HISTORY
   - Download videos from completed test runs
   - Supports both MP4 (with FFmpeg) and GIF formats

### JIRA Integration

1. **View Automation Tickets**
   - Click "JIRA TICKETS" button
   - Browse tickets marked with automation labels
   - Filter by status and search terms

2. **Execute from JIRA**
   - Select a ticket from the list
   - Click "🚀 Execute Test"
   - Instructions are automatically loaded and executed

---

## 🛡️ Security Testing

### Overview

The Matrix QA Test Runner includes a comprehensive security testing suite with over 100 predefined security tests covering major web application vulnerabilities. These tests are designed to help identify common security issues in web applications.

### Security Test Categories

#### **Input Validation**
- **SQL Injection Testing**: Database injection vulnerability detection
- **Cross-Site Scripting (XSS)**: Reflected, stored, and DOM-based XSS
- **Directory Traversal**: Path traversal and file inclusion vulnerabilities

#### **Authentication & Session Management**
- **Login Security Testing**: Password policies and account lockout mechanisms
- **Session Management**: Cookie security and session handling
- **CSRF Token Validation**: Cross-Site Request Forgery protection

#### **UI Security**
- **Clickjacking Testing**: Frame protection and UI redressing attacks
- **Content Security Policy**: CSP header validation and bypass testing

### Using Security Tests

1. **Access Security Testing Interface**
   - Click the "🛡️ SECURITY TESTS" button in the main control panel
   - The security testing modal will open with available tests

2. **Configure Target**
   - Enter the target URL in the "Target URL" field
   - Ensure the URL includes the protocol (https:// or http://)

3. **Browse and Filter Tests**
   - **Search**: Use the search box to find specific tests
   - **Category Filter**: Filter by vulnerability categories
   - **Severity Filter**: Filter by risk levels (High, Medium, Low)

4. **Execute Security Tests**
   - Click on a test to expand its details
   - Review the test description and instructions
   - Click "🛡️ Execute Security Test" to run the assessment
   - The test instructions will be automatically loaded into the main execution interface

### Available Security Tests

| Test ID | Summary | Category | Severity |
|---------|---------|----------|----------|
| HACK-001 | SQL Injection Testing | Input Validation | High |
| HACK-002 | Cross-Site Scripting (XSS) Testing | Input Validation | High |
| HACK-003 | CSRF Token Validation Testing | Authentication & Session Management | Medium |
| HACK-005 | Authentication and Session Management Testing | Authentication & Session Management | High |
| HACK-006 | Directory Traversal Testing | Input Validation | High |
| HACK-014 | Clickjacking Vulnerability Testing | Clickjacking Testing | Medium |

### Security Test Execution

When you execute a security test:

1. **Automatic Configuration**: The target URL and test instructions are automatically configured
2. **AI-Powered Execution**: The selected AI provider performs the security assessment
3. **Real-time Monitoring**: Watch the security testing process in real-time
4. **Detailed Reporting**: Receive comprehensive results including vulnerability findings
5. **Video Recording**: Optional recording of the security testing session

### Security Testing Best Practices

- **Authorization**: Only test applications you own or have explicit permission to test
- **Controlled Environment**: Prefer testing in development or staging environments
- **Documentation**: Keep detailed records of security test results
- **Remediation**: Address identified vulnerabilities promptly
- **Regular Testing**: Implement security testing as part of your regular QA process

### Custom Security Tests

You can add custom security tests by creating JSON files in the `backend/hacking/` directory. Follow the existing test format and restart the application to load new tests.

---

## 📡 API Documentation

### Authentication

All API endpoints require authentication via JWT token or API key.

#### Login
```http
POST /api/auth/authenticate
Content-Type: application/json

{
  "username": "admin",
  "password": "admin"
}
```

#### Headers for Authenticated Requests
```http
Authorization: Bearer <jwt_token>
# OR
X-API-Key: qa_secret_key
```

### Core Endpoints

#### Create Test Session
```http
POST /sessions
X-API-Key: qa_secret_key

Response:
{
  "session_id": "uuid-string",
  "status": "created"
}
```

#### Execute Test
```http
POST /sessions/{session_id}/tasks
Authorization: Bearer <token>
Content-Type: application/json

{
  "instructions": "Navigate to google.com and search for 'AI testing'",
  "browser_visible": true,
  "api_provider": "anthropic",
  "api_model": "claude-3-5-sonnet-20240620",
  "use_default_key": true
}
```

#### Get Execution History
```http
GET /api/history
Authorization: Bearer <token>

Response:
{
  "success": true,
  "history": [
    {
      "_id": "...",
      "title": "Test execution",
      "content": "Results...",
      "timestamp": "2024-01-01T12:00:00Z",
      "model": "anthropic/claude-3-5-sonnet"
    }
  ]
}
```

### Security Testing Endpoints

#### Get Available Security Tests
```http
GET /hacking/tests
Authorization: Bearer <token>

Response:
{
  "success": true,
  "tests": [...],
  "total": 100,
  "message": "Retrieved 100 security tests",
  "source": "json_files"
}
```

#### Get Specific Security Test
```http
GET /hacking/tests/{test_key}
Authorization: Bearer <token>

Response:
{
  "success": true,
  "test": {
    "key": "HACK-001",
    "summary": "SQL Injection Testing",
    "category": "Input Validation",
    "severity": "High",
    "instructions": "..."
  },
  "message": "Retrieved security test HACK-001"
}
```

#### Execute Security Test
```http
POST /hacking/execute-test/{test_key}
Authorization: Bearer <token>

Response:
{
  "success": true,
  "test_key": "HACK-001",
  "instructions": "Formatted test instructions...",
  "test_info": {
    "summary": "SQL Injection Testing",
    "category": "Input Validation",
    "severity": "High"
  }
}
```

#### Reload Security Tests (Admin Only)
```http
POST /hacking/reload-tests
Authorization: Bearer <admin_token>

Response:
{
  "success": true,
  "tests_count": 100,
  "message": "Successfully reloaded 100 security tests"
}
```

### WebSocket Endpoints

#### Real-time Updates
```javascript
const socket = new WebSocket('ws://localhost:8000/ws/{session_id}');

// Message types:
// - session_status
// - task_update
// - task_complete
// - task_error
// - recording_status
```

#### Live Screenshots
```javascript
const screenshotSocket = new WebSocket('ws://localhost:8000/ws/screenshot/{session_id}');

// Receives base64-encoded screenshots in real-time
```

---

## 🏗️ Architecture

### Backend Components

- **FastAPI**: RESTful API and WebSocket server
- **[Browser-Use Agent](https://browser-use.com/)**: Core AI-powered browser automation engine (modified version)
  - Custom integration with MongoDB for result persistence
  - Enhanced screenshot capture and storage capabilities  
  - Real-time execution tracking and WebSocket communication
- **MongoDB**: Document storage for users, history, and videos
- **Motor**: Async MongoDB driver
- **JWT**: Token-based authentication
- **Cryptography**: API key encryption
- **Security Testing Engine**: Vulnerability assessment framework
- **FFmpeg**: Video processing (optional)

### Frontend Components

- **Vanilla JavaScript**: No framework dependencies
- **WebSocket**: Real-time communication
- **Bootstrap**: UI components and grid system
- **Matrix Theme**: Custom CSS with retro-futuristic styling
- **Security Testing Interface**: Dedicated security assessment UI

### File Structure

```
qa-remote-browser/
├── main.py                    # Application entry point
├── config.py                  # Configuration management
├── mongodb_config.py          # Database configuration
├── auth.py                    # Authentication logic
├── .env                       # Environment variables
├── requirements.txt           # Python dependencies
├── matrix_users.json          # User data storage
├── package.json               # Node.js dependencies
├── package-lock.json          # Node.js lock file
├── backend/                   # Backend application code
│   ├── hacking/              # Security test definitions
│   │   ├── hack-001.json     # SQL Injection tests
│   │   ├── hack-002.json     # XSS tests
│   │   └── ...               # Additional security tests
│   ├── models/               # Data models
│   │   ├── __init__.py
│   │   └── schemas.py        # Pydantic schemas
│   ├── mongo_routes/         # MongoDB-specific routes
│   │   ├── __init__.py
│   │   ├── auth_routes.py    # MongoDB authentication routes
│   │   └── history_routes.py # Execution history routes
│   ├── routes/               # API route handlers
│   │   ├── __init__.py
│   │   ├── hacking_routes.py # Security testing endpoints
│   │   ├── jira_routes.py    # JIRA integration endpoints
│   │   ├── session_routes.py # Session management
│   │   ├── task_routes.py    # Task execution endpoints
│   │   ├── video_routes.py   # Video recording endpoints
│   │   └── websocket_routes.py # WebSocket handlers
│   ├── services/             # Business logic services
│   │   ├── __init__.py
│   │   ├── ai_providers.py   # AI provider integrations
│   │   ├── jira_service.py   # JIRA service logic
│   │   ├── screenshot.py     # Screenshot capture service
│   │   ├── test_runner.py    # Test execution engine
│   │   └── video_recorder.py # Video recording service
│   └── utils/               # Utility functions
│       ├── __init__.py
│       └── helpers.py       # Helper functions
├── browser_use_mod/          # Modified browser-use package
│   └── browser-use/         # Browser automation library
├── frontend/                 # Static web files
│   ├── index.html           # Main application interface
│   ├── css/
│   │   └── matrix-style.css # Matrix-themed styling
│   └── js/
│       ├── hacking-manager.js # Security testing frontend
│       ├── jira-manager.js  # JIRA integration frontend
│       └── matrix-app.js    # Main application logic
├── venv/                    # Python virtual environment
```

---

## 🤝 Contributing

We welcome contributions from the community! Here's how you can help:

### Development Setup

1. **Fork the Repository**
   ```bash
   git clone https://github.com/yourusername/qa-remote-browser.git
   cd qa-remote-browser
   ```

2. **Create Feature Branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```

3. **Set Up Development Environment**
   ```bash
   python -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   
   # Install modified browser-use package
   cd browser_use_mod/browser-use
   pip install -e .
   cd ../..
   
   # Install Node.js dependencies
   npm install
   
   # Install development dependencies (if available)
   pip install -r requirements-dev.txt  # Development dependencies
   ```

4. **Run Tests**
   ```bash
   pytest backend/tests/  # Run backend tests
   ```

### Contribution Guidelines

- **Code Style**: Follow PEP 8 for Python, ESLint for JavaScript
- **Testing**: Add tests for new features
- **Documentation**: Update README and docstrings
- **Commits**: Use conventional commit messages
- **Security**: Follow secure coding practices for security testing features

### Areas for Contribution

- 🔧 **New AI Providers**: Add support for additional AI services
- 🛡️ **Security Tests**: Contribute new vulnerability assessment tests
- 🎨 **UI Improvements**: Enhance the Matrix-themed interface
- 📊 **Reporting Features**: Advanced analytics and dashboards
- 🧪 **Testing Framework**: Unit and integration test coverage
- 📖 **Documentation**: Tutorials and advanced usage guides
- 🔒 **Security Enhancements**: Additional security testing capabilities

---

## 📄 License

This project is licensed under the Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License - see the [LICENSE](LICENSE.MD) file for details.

### License Summary

- ✅ **Personal Use**: Use for personal projects and learning
- ✅ **Educational Use**: Use in educational institutions
- ✅ **Research**: Use for academic and research purposes
- ✅ **Security Research**: Use for ethical security testing and research
- ✅ **Modification**: Modify and adapt the code
- ✅ **Sharing**: Share with others under the same license
- ❌ **Commercial Use**: Cannot be used for commercial purposes
- ⚠️ **Attribution**: Must credit the original authors
- ⚠️ **Responsible Use**: Security testing features must be used ethically and legally

### Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License

Copyright (c) 2025 Matrix QA Test Runner

You are free to:
- **Share** — copy and redistribute the material in any medium or format
- **Adapt** — remix, transform, and build upon the material

Under the following terms:
- **Attribution** — You must give appropriate credit, provide a link to the license, and indicate if changes were made.
- **NonCommercial** — You may not use the material for commercial purposes.
- **ShareAlike** — If you remix, transform, or build upon the material, you must distribute your contributions under the same license as the original.

**No additional restrictions** — You may not apply legal terms or technological measures that legally restrict others from doing anything the license permits.

### Third-Party Components

This project incorporates [browser-use](https://github.com/browser-use/browser-use) by Gregor Zunic, licensed under the MIT License.

For commercial licensing options, please contact the project maintainers.

---

## ⚠️ Security Testing Disclaimer

**IMPORTANT**: The security testing features in this application are intended for:

- **Authorized Testing Only**: Only test applications you own or have explicit written permission to test
- **Educational Purposes**: Learning about web application security vulnerabilities
- **Development Environment Testing**: Use in controlled development/staging environments
- **Ethical Security Research**: Responsible disclosure of security vulnerabilities

**DO NOT USE FOR**:
- Testing applications without proper authorization
- Malicious attacks or unauthorized penetration testing
- Illegal activities or unethical hacking
- Production systems without proper approval

The developers of this tool are not responsible for any misuse or damage caused by inappropriate use of the security testing features. Users are solely responsible for ensuring they have proper authorization before conducting any security tests.

---

## 🙏 Acknowledgments

- **[Browser-Use](https://browser-use.com/)** by **[WarmShao](https://github.com/WarmShao)**: The core AI-powered browser automation technology that makes this platform possible. Our implementation includes custom modifications for MongoDB integration and enhanced result tracking.
- **FastAPI Community**: For the excellent async web framework that powers our backend
- **OWASP**: For security testing methodologies and vulnerability assessment best practices
- **Matrix Franchise**: Inspiration for the iconic green-on-black aesthetic and "digital rain" theme
- **MongoDB Team**: For the robust document database that stores our execution results and user data

---

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/qa-remote-browser/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/qa-remote-browser/discussions)
- **Documentation**: [Wiki](https://github.com/yourusername/qa-remote-browser/wiki)
- **Security Reports**: Please report security vulnerabilities responsibly through private channels

---
