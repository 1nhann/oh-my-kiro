# Implementation Plan: Web Penetration Testing

## Overview

This implementation plan uses Dynamic Task syntax with iteration support to create a flexible penetration testing workflow. It includes:
- Multiple entry points for different scan types
- Loop/retries for failed tool executions
- Polling for target availability
- Conditional branching based on results

## Tasks

### Phase 1: Entry Points and Target Validation

- [ ]^ 1. Quick Scan (Reconnaissance + Basic Scan)
  - [ ] 1.1 Use execute_code: Initialize state with target_url, scan_type = 'quick', retry_count = 0
  - [ ] 1.2 Use execute_code: Validate target URL format, perform basic connectivity check
  - _Requirements: 1.1_
  - [ ]? 1.3 Jump to 4 (Reconnaissance Phase)

- [ ]^ 2. Full Audit (Complete Penetration Test)
  - [ ] 2.1 Use execute_code: Initialize state with target_url, scan_type = 'full', retry_count = 0
  - [ ] 2.2 Use execute_code: Validate target URL format, perform basic connectivity check
  - _Requirements: 1.1_
  - [ ]? 2.3 Jump to 4 (Reconnaissance Phase)

- [ ]^ 3. Authenticated Scan (With Credentials)
  - [ ] 3.1 Use execute_code: Initialize state with target_url, scan_type = 'auth', retry_count = 0
  - [ ] 3.2 Use execute_code: Validate target URL format, perform basic connectivity check
  - _Requirements: 1.1, 3.1_
  - [ ]? 3.3 Jump to 7 (Authentication Check)

### Phase 2: Reconnaissance

- [ ]? 4. Reconnaissance Phase (Convergence Point)
  - [ ] 4.1 Use execute_code: Perform DNS resolution check, store in state
  - [ ] 4.2 Use execute_code: Run whatweb or Wappalyzer for technology detection
  - [ ] 4.3 Use execute_code: Store detected technologies in state
  - _Requirements: 1.2, 1.3_
  - [ ]? 4.4 If scan_type == 'quick', jump to 6; if scan_type == 'full' or 'auth', jump to 5

- [ ] 5. Subdomain Enumeration (Full Audit Only)
  - [ ] 5.1 Use execute_code: Run subfinder or amass for subdomain discovery
  - [ ] 5.2 Use execute_code: Test discovered subdomains for web services
  - _Requirements: 1.4_
  - [ ]? 5.3 Jump to 8

### Phase 3: Vulnerability Scanning with Retry Loop

- [ ] 6. Run Basic Scanner (Quick Scan Mode) - Iteration Anchor
  - [ ] 6.1 Use execute_code: Run nuclei with basic templates
  - [ ] 6.2 Use execute_code: Store results in findings array
  - _Requirements: 2.1, 2.5_
  - [ ]? 6.3 On tool failure, retry up to 3 times; if success, jump to 9; if max retries, continue with partial results

- [ ] 8. Run Full Scanner Suite (Full Audit Mode) - Iteration Anchor
  - [ ] 8.1 Use execute_code: Initialize tool_success flags for each scanner
  - [ ] 8.2 Use execute_code: Run nuclei CVE scan, record success/failure
  - [ ] 8.3 On nuclei failure, set nuclei_retry = true, jump to 8.2 (max 3 retries)
  - [ ] 8.4 Use execute_code: Run SQLMap injection test
  - [ ] 8.5 On SQLMap failure, log warning and continue
  - [ ] 8.6 Use execute_code: Run XSSer cross-site scripting test
  - [ ] 8.7 On XSSer failure, log warning and continue
  - [ ] 8.8 Use execute_code: Run ffuf directory enumeration
  - [ ] 8.9 On ffuf failure, log warning and continue
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_
  - [ ]? 8.10 Wait for all tools, then jump to 9

### Phase 4: Authentication Handling

- [ ]? 7. Judge Authentication Required (Decision Node)
  - [ ] 7.1 Use execute_code: Read auth_required from state
  - [ ]? 7.2 If auth_required == true AND auth_token not set, jump to 10; otherwise jump to 9

- [ ] 10. Handle Authentication - Loop Anchor
  - [ ] 10.1 Use execute_code: Prompt for credentials
  - [ ] 10.2 Use execute_code: Attempt authentication, set auth_token or auth_failed
  - _Requirements: 3.2, 3.3_
  - [ ]? 10.3 If auth_failed == true, retry up to 2 times; if auth success, jump to 11; if max retries, log error and continue

- [ ] 11. Authenticated Scanning (After Auth Success)
  - [ ] 11.1 Use execute_code: Run authenticated scans with session token
  - [ ] 11.2 Use execute_code: Store authenticated findings
  - _Requirements: 3.4_
  - [ ]? 11.3 Jump to 12

### Phase 5: Target Health Check (Loop for Unresponsive Targets)

- [ ] 12. Check Target Health - Iteration Anchor
  - [ ] 12.1 Use execute_code: Send HTTP health check to target
  - [ ]? 12.2 If target responsive (HTTP 200-399), jump to 13; if target timeout/5xx, increment health_check_count
  - [ ]? 12.3 If health_check_count < 3, wait 10s and jump to 12.1; if health_check_count >= 3, jump to 14

- [ ]$ 14. Terminal: Target Unresponsive
  - [ ] 14.1 Use execute_code: Generate partial results with available findings
  - [ ] 14.2 Use execute_code: Recommend manual verification
  - _Requirements: 5.4_

### Phase 6: Results Aggregation

- [ ] 13. Aggregate Results
  - [ ] 13.1 Use execute_code: Merge all findings from scanners
  - [ ] 13.2 Use execute_code: Deduplicate findings by URL + vulnerability type
  - [ ] 13.3 Use execute_code: Count by severity, store in state
  - [ ] 13.4 Use execute_code: Generate summary JSON
  - _Requirements: 4.1, 4.2, 4.3_
  - [ ]? 13.5 Jump to 15

### Phase 7: Results Analysis and Reporting

- [ ]? 15. Judge Findings (Terminal Decision)
  - [ ] 15.1 Use execute_code: Read severity counts from state
  - [ ]? 15.2 If critical > 0, jump to 16; if high > 0, jump to 17; if medium > 0, jump to 18; if low/info only, jump to 19; if findings.length == 0, jump to 20

### Phase 8: Terminal Outcomes

- [ ]$ 16. Terminal: Critical Vulnerabilities Found
  - [ ] 16.1 Use execute_code: Generate critical findings report with full details
  - [ ] 16.2 Use execute_code: Output immediate remediation recommendations
  - [ ] 16.3 Use execute_code: Export report to JSON/HTML format
  - _Requirements: 4.4, 4.5_
  - [ ] 16.4 Status: CRITICAL - Stop testing and address immediately

- [ ]$ 17. Terminal: High Vulnerabilities Found
  - [ ] 17.1 Use execute_code: Generate findings report with high severity items
  - [ ] 17.2 Use execute_code: Output detailed remediation guidance
  - [ ] 17.3 Use execute_code: Export report to JSON/HTML format
  - _Requirements: 4.4, 4.5_
  - [ ] 17.4 Status: HIGH - Priority remediation required

- [ ]$ 18. Terminal: Medium/Low Issues Found
  - [ ] 18.1 Use execute_code: Generate findings report categorized by severity
  - [ ] 18.2 Use execute_code: Output standard recommendations
  - [ ] 18.3 Use execute_code: Export report to JSON/HTML format
  - _Requirements: 4.4_
  - [ ] 18.4 Status: MEDIUM/LOW - Schedule remediation

- [ ]$ 19. Terminal: Only Informational Findings
  - [ ] 19.1 Use execute_code: Generate informational report
  - [ ] 19.2 Use execute_code: Output best practices recommendations
  - _Requirements: 4.4_
  - [ ] 19.3 Status: INFO - Review for potential improvements

- [ ]$ 20. Terminal: No Vulnerabilities Found
  - [ ] 20.1 Use execute_code: Generate clean bill of health report
  - [ ] 20.2 Use execute_code: Recommend regular scanning schedule
  - [ ] 20.3 Status: CLEAN - Continue monitoring

## Iteration Support (Loops)

### Retry Pattern for Scanner Tools
- Each scanner tool (nuclei, sqlmap, XSSer, ffuf) has retry logic
- Status format tracks completion: `[ ]` → `[x]` → `[x2]` → `[x3]`
- After 3 failed attempts, continue with remaining tools

### Polling Pattern for Target Health
- Health check loop runs up to 3 times
- 10 second wait between checks
- Continues scanning if target recovers, terminates if still down

### Authentication Retry Pattern
- Up to 2 authentication retry attempts
- Logs warning on each failure
- Continues with unauthenticated scan after max retries

## State Management Reference

| Variable | Type | Description |
|----------|------|-------------|
| target_url | string | The target web application URL |
| scan_type | string | 'quick', 'full', or 'auth' |
| auth_required | boolean | Whether authentication is needed |
| auth_token | string | Session token after successful auth |
| auth_failed | boolean | Flag if authentication failed |
| retry_count | number | Current retry count for tool execution |
| health_check_count | number | Number of target health checks performed |
| technologies | array | Detected web technologies |
| findings | array | All vulnerability findings |
| critical_count | number | Count of critical findings |
| high_count | number | Count of high findings |
| medium_count | number | Count of medium findings |
| low_count | number | Count of low findings |
| info_count | number | Count of informational findings |
| nuclei_retry | boolean | Flag for nuclei retry state |
| scan_complete | boolean | Flag indicating scan phase complete |

## Safety Controls

- Rate limiting: 1 request per second for active scanning
- Tool timeout: 30 minutes per scanner execution
- Retry limits: Max 3 retries per tool, max 2 for auth
- Health check polling: 3 attempts with 10s wait between
- Pause capability: User can pause at any judgment node
- Audit logging: All actions logged to penetration-test-audit.log

## Task Syntax Legend

| Marker | Type | Description |
|--------|------|-------------|
| `[ ]^` | Start | Optional entry point - choose one to begin |
| `[ ]` | Regular | Standard implementation task |
| `[ ]?` | Judgment | Branch point - routes to different tasks |
| `[ ]$` | Terminal | Execution ends here |
| Iteration suffix | Retry | Shows completion count (e.g., `[x2]`) |

## Workflow Flowchart

```
         ┌──────────┐
         │ Entry    │ ←── 1. Quick / 2. Full / 3. Auth
         └────┬─────┘
              │
              ▼
         ┌──────────┐
         │ Recon    │ ──→ Technology detection
         └────┬─────┘
              │
       ┌──────┴──────┐
       │             │
   ┌───▼───┐     ┌───▼───┐
   │ Quick │     │ Full  │ ──→ Subdomain enum
   │ Scan  │     │ Scan  │
   └───┬───┘     └───┬───┘
       │             │
       └──────┬──────┘
              │
              ▼
       ┌──────────────┐
       │ Tool Execute │ ←── With retry loop (max 3)
       │    (Loop)    │
       └──────┬───────┘
              │
              ▼
       ┌──────────────┐
       │ Target OK?   │ ←── Health check loop
       │   (Loop)     │
       └──────┬───────┘
              │
              ▼
       ┌──────────────┐
       │   Aggregate  │
       │   Results    │
       └──────┬───────┘
              │
              ▼
       ┌──────────────┐
       │   Judge      │ ──→ Critical/High/Medium/Low/Info/Clean
       │  Findings    │
       └──────────────┘
              │
       ┌──────┴──────┐
       │             │
   ┌───▼───┐    ┌────▼────┐
   │ Term- │    │ Terminal│
   │ inal  │    │ Outputs │
   └───────┘    └─────────┘
```