# Design Document: Web Application Penetration Testing

## Overview

This document defines a dynamic penetration testing workflow that:
- Supports multiple entry points based on user input
- Uses conditional branching for authentication handling
- Supports iteration/loops for retry logic and target health checks
- Aggregates results from multiple open-source security tools
- Provides clear terminal outcomes based on findings

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Entry Points                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ Quick Scan  │  │ Full Audit  │  │ Auth Scan   │         │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘         │
└─────────┼────────────────┼────────────────┼─────────────────┘
          │                │                │
          ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────┐
│              Reconnaissance Phase                            │
│  - Target validation                                         │
│  - Technology detection                                      │
│  - Subdomain enumeration                                     │
└─────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│              Authentication Decision                          │
│  ┌─────────────────────────────────────────────────────┐    │
│  │         ? Judge Authentication Required              │    │
│  │   If yes → Collect credentials → Authenticate        │    │
│  │   If no  → Skip to scanning                          │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│              Vulnerability Scanning (With Loop)              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │   For each tool: retry up to 3 times on failure     │    │
│  │   - Nuclei CVE scanning (retryable)                  │    │
│  │   - SQL injection testing                            │    │
│  │   - XSS testing                                      │    │
│  │   - Directory enumeration                            │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│              Target Health Check (Loop)                      │
│  ┌─────────────────────────────────────────────────────┐    │
│  │   ? Judge: Is target responsive?                     │    │
│  │   If yes → Continue scanning                         │    │
│  │   If no  → Retry up to 3 times (10s wait between)   │    │
│  │   If still down → Generate partial report            │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│              Results Analysis                                 │
│  - Aggregate findings                                        │
│  - Categorize by severity                                    │
│  - Generate report                                           │
└─────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│              Terminal Outcomes                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ Critical    │  │ Vulnerabili-│  │ No Issues   │         │
│  │ Found       │  │ ties Found  │  │ Found       │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

## Iteration Support (Loops)

### Retry Loop Pattern
- **Scanner Tools**: Each tool (nuclei, sqlmap, XSSer, ffuf) has retry logic with max 3 attempts
- **Status Tracking**: Uses completion count suffix (e.g., `[x2]` for 2nd completion)
- **Graceful Degradation**: If tool fails after max retries, continues with remaining tools

### Polling Loop Pattern
- **Target Health Check**: Checks if target is responsive every 10 seconds
- **Max Attempts**: Up to 3 health checks before marking target as unresponsive
- **Partial Results**: Generates report with available findings if target goes down

### Authentication Retry Pattern
- **Max 2 Attempts**: Authentication can be retried up to 2 times
- **Fallback**: If auth fails after max retries, continues with unauthenticated scan

## Components and Interfaces

### Target Input
- `target_url`: The web application URL to test
- `auth_required`: Boolean flag for authentication
- `auth_credentials`: Optional username/password or token

### Scanner Tools
- **nuclei**: CVE and vulnerability scanner
- **sqlmap**: SQL injection detection
- **XSSer**: Cross-site scripting detection
- **ffuf/gobuster**: Directory and file enumeration

### Results Storage
- `findings`: Array of vulnerability objects
- `severity`: Enum (critical, high, medium, low, info)
- `evidence`: Proof of concept data
- `recommendation`: Remediation guidance

## Data Models

### Vulnerability Finding
```typescript
interface Finding {
  id: string
  title: string
  severity: "critical" | "high" | "medium" | "low" | "info"
  tool: string
  url: string
  evidence: string
  description: string
  recommendation: string
  timestamp: Date
}
```

### Scan Results
```typescript
interface ScanResults {
  target: string
  startTime: Date
  endTime: Date
  findings: Finding[]
  criticalCount: number
  highCount: number
  mediumCount: number
  lowCount: number
  infoCount: number
}
```

## Correctness Properties

This workflow is operational in nature. Key correctness properties include:

Property 1: Target Validation
*For any* provided target URL, the system MUST validate that the URL is reachable before proceeding with scanning
**Validates: Requirements 1.1**

Property 2: Complete Tool Execution
*For any* scan initiated, all selected tools MUST complete execution (or timeout gracefully) regardless of individual tool failures
**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

Property 3: Authentication State Preservation
*For any* successful authentication, the session MUST be preserved for subsequent authenticated scans
**Validates: Requirements 3.2, 3.3**

Property 4: Results Aggregation
*For any* completed scans, findings from all tools MUST be aggregated and deduplicated
**Validates: Requirements 4.1**

Property 5: Severity Classification
*For any* finding, the severity MUST be correctly classified and counted
**Validates: Requirements 4.2**

## Dynamic Task Workflow

### Entry Points

```
- [ ]^ 1. Quick Scan (Recon + Basic Scan)
- [ ]^ 2. Full Audit (Complete penetration test)
- [ ]^ 3. Authenticated Scan (With credentials)
```

### Task Structure

```markdown
# Web Penetration Testing Workflow

## Tasks

- [ ]^ 1. Quick Scan (Recon + Basic Scan)
  - [ ] 1.1 Use execute_code to validate target URL and store in state
  - [ ] 1.2 Use execute_code to store scan_type = 'quick'
  - [ ]? 1.3 Jump to Reconnaissance Phase

- [ ]^ 2. Full Audit (Complete penetration test)
  - [ ] 2.1 Use execute_code to validate target URL and store in state
  - [ ] 2.2 Use execute_code to store scan_type = 'full'
  - [ ]? 2.3 Jump to Reconnaissance Phase

- [ ]^ 3. Authenticated Scan (With credentials)
  - [ ] 3.1 Use execute_code to validate target URL and store in state
  - [ ] 3.2 Use execute_code to store scan_type = 'auth'
  - [ ]? 3.3 Jump to Authentication Check

- [ ]? 4. Judge Scan Type (Convergence Point)
  - [ ] 4.1 Read scan_type from execute_code
  - [ ]? 4.2 If scan_type == 'quick', jump to 6; if 'full' or 'auth', jump to 5

- [ ] 5. Run Full Scanner Suite
  - [ ] 5.1 Run nuclei vulnerability scan
  - [ ] 5.2 Run SQLMap SQL injection test
  - [ ] 5.3 Run XSSer cross-site scripting test
  - [ ] 5.4 Run ffuf directory enumeration
  - [ ]? 5.5 Jump to 7

- [ ] 6. Run Basic Scanner
  - [ ] 6.1 Run nuclei basic scan only
  - [ ]? 6.2 Jump to 7

- [ ]? 7. Judge Authentication Required
  - [ ] 7.1 Read auth_required from execute_code
  - [ ]? 7.2 If auth required and not authenticated, jump to 8; if no auth or already authenticated, jump to 9

- [ ] 8. Handle Authentication
  - [ ] 8.1 Prompt user for credentials if needed
  - [ ] 8.2 Attempt authentication
  - [ ] 8.3 Store auth token in execute_code
  - [ ]? 8.4 If auth failed, log warning and continue; jump to 9

- [ ] 9. Aggregate Results
  - [ ] 9.1 Collect findings from all scanners
  - [ ] 9.2 Categorize by severity
  - [ ] 9.3 Generate summary report

- [ ]? 10. Judge Findings
  - [ ] 10.1 Read finding counts from execute_code
  - [ ]? 10.2 If critical > 0, jump to 11; if high > 0, jump to 12; if medium > 0, jump to 13; if only low/info, jump to 14; if none, jump to 15

- [ ]$ 11. Terminal: Critical Vulnerabilities Found
  - [ ] 11.1 Generate critical findings report
  - [ ] 11.2 Provide immediate remediation recommendations
  - [ ] 11.3 Recommend stopping further testing

- [ ]$ 12. Terminal: High Vulnerabilities Found
  - [ ] 12.1 Generate findings report with high severity items
  - [ ] 12.2 Provide detailed remediation guidance

- [ ]$ 13. Terminal: Medium/Low Issues Found
  - [ ] 13.1 Generate findings report
  - [ ] 13.2 Provide standard recommendations

- [ ]$ 14. Terminal: Only Informational Findings
  - [ ] 14.1 Generate informational report
  - [ ] 14.2 No immediate action required

- [ ]$ 15. Terminal: No Vulnerabilities Found
  - [ ] 15.1 Generate clean bill of health report
  - [ ] 15.2 Recommend regular scanning schedule
```

## Error Handling

1. **Target Unreachable**: Log error, prompt for valid URL, allow retry
2. **Tool Execution Failure**: Log error, continue with remaining tools, report partial results
3. **Authentication Failure**: Log warning, continue with unauthenticated scan
4. **Rate Limiting Detected**: Automatic pause, wait and retry with reduced frequency
5. **Scan Timeout**: Save partial results, provide resume capability

## Testing Strategy

Due to the operational nature of this workflow:
- Integration tests verify the workflow logic
- Each tool execution is validated independently
- Mock targets are used for testing scan logic
- Results parsing is validated against known vulnerability formats