#!/usr/bin/env python3
"""
BetterPrompts E2E Test Runner CLI

A unified command-line interface for running and reporting on any phase or category
of E2E tests in the BetterPrompts testing suite.

Usage:
    run-tests.py [OPTIONS] [PHASES...]
    run-tests.py --list-phases
    run-tests.py --list-categories
    
Examples:
    run-tests.py                          # Run all tests
    run-tests.py 1 2 3                    # Run phases 1, 2, and 3
    run-tests.py --category security      # Run all security tests
    run-tests.py --phase 5 --browser chrome  # Run phase 5 on Chrome only
    run-tests.py --report-only            # Generate reports from existing results
"""

import argparse
import json
import os
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Optional, Tuple
import shutil
import tempfile

# Test phase metadata
PHASE_METADATA = {
    1: {
        "name": "Anonymous Enhancement",
        "category": "core",
        "tests": ["us-001-anonymous-enhancement.spec.ts"],
        "description": "Core enhancement functionality for non-authenticated users"
    },
    2: {
        "name": "User Registration", 
        "category": "auth",
        "tests": ["us-012-user-registration.spec.ts"],
        "description": "User registration and email verification workflows"
    },
    3: {
        "name": "Login & Session Management",
        "category": "auth", 
        "tests": ["us-013-login-session.spec.ts"],
        "description": "Authentication and session persistence"
    },
    4: {
        "name": "Authentication & History",
        "category": "features",
        "tests": ["us-002-007-auth-enhancement-history.spec.ts"],
        "description": "Authenticated features and history tracking"
    },
    5: {
        "name": "Technique Education",
        "category": "features",
        "tests": ["us-006-technique-education.spec.ts"],
        "description": "Educational content and technique guidance"
    },
    6: {
        "name": "Batch Processing",
        "category": "features",
        "tests": ["us-003-batch-processing.spec.ts"],
        "description": "Bulk prompt enhancement capabilities"
    },
    7: {
        "name": "API Integration",
        "category": "api",
        "tests": ["us-004-api-integration.spec.ts"],
        "description": "Developer API and SDK functionality"
    },
    8: {
        "name": "Performance & Monitoring",
        "category": "performance",
        "tests": ["us-005-performance-metrics.spec.ts"],
        "description": "Performance metrics and admin dashboards"
    },
    9: {
        "name": "Input Validation",
        "category": "security",
        "tests": ["ec-01-05-input-validation.spec.ts"],
        "description": "Comprehensive input validation and edge cases"
    },
    10: {
        "name": "Rate Limiting",
        "category": "api",
        "tests": ["us-015-rate-limiting.spec.ts"],
        "description": "API rate limiting and concurrent access"
    },
    11: {
        "name": "Security Testing",
        "category": "security",
        "tests": ["ss-01-sql-injection.spec.ts", "ss-02-xss-protection.spec.ts"],
        "description": "Security vulnerability assessment"
    },
    12: {
        "name": "Mobile & Accessibility",
        "category": "accessibility",
        "tests": ["us-019-mobile-experience.spec.ts", "us-020-accessibility.spec.ts"],
        "description": "Mobile experience and WCAG compliance"
    },
    13: {
        "name": "End-to-End Journeys",
        "category": "integration",
        "tests": ["journeys/*.spec.ts"],
        "description": "Complete user journeys across personas"
    }
}

# Categories mapping
CATEGORIES = {
    "core": [1],
    "auth": [2, 3],
    "features": [4, 5, 6],
    "api": [7, 10],
    "performance": [8],
    "security": [9, 11],
    "accessibility": [12],
    "integration": [13]
}


class TestRunner:
    """Main test runner class"""
    
    def __init__(self, base_dir: Path):
        self.base_dir = base_dir
        self.results_dir = base_dir / "artifacts" / "test-results"
        self.reports_dir = base_dir / "artifacts" / "reports"
        self.start_time = None
        self.end_time = None
        
    def run_phase(self, phase: int, options: Dict) -> Tuple[bool, Dict]:
        """Run tests for a specific phase"""
        phase_info = PHASE_METADATA.get(phase)
        if not phase_info:
            return False, {"error": f"Phase {phase} not found"}
            
        print(f"\n{'='*60}")
        print(f"Running Phase {phase}: {phase_info['name']}")
        print(f"Category: {phase_info['category']}")
        print(f"Description: {phase_info['description']}")
        print(f"{'='*60}\n")
        
        phase_dir = self.base_dir / f"phase{phase}"
        if not phase_dir.exists():
            # Try frontend directory for some phases
            phase_dir = self.base_dir / "frontend"
            if not phase_dir.exists():
                return False, {"error": f"Phase directory not found: phase{phase}"}
        
        # Build playwright command
        cmd = ["npx", "playwright", "test"]
        
        # Add test files
        for test in phase_info["tests"]:
            if "*" in test:
                # Handle wildcard patterns
                cmd.append(test)
            else:
                cmd.append(f"tests/{test}")
        
        # Add browser option
        if options.get("browser"):
            cmd.extend(["--project", options["browser"]])
            
        # Add other options
        if options.get("headed"):
            cmd.append("--headed")
            
        if options.get("debug"):
            cmd.append("--debug")
            
        if options.get("workers"):
            cmd.extend(["--workers", str(options["workers"])])
            
        # Run tests
        start = time.time()
        result = subprocess.run(
            cmd,
            cwd=phase_dir,
            capture_output=True,
            text=True
        )
        duration = time.time() - start
        
        # Parse results
        success = result.returncode == 0
        output = result.stdout + result.stderr
        
        # Extract test counts from output
        passed = failed = skipped = 0
        for line in output.split('\n'):
            if "passed" in line and "failed" in line:
                # Parse playwright output
                import re
                numbers = re.findall(r'\d+', line)
                if len(numbers) >= 2:
                    passed = int(numbers[0])
                    failed = int(numbers[1])
                    if len(numbers) > 2:
                        skipped = int(numbers[2])
        
        return success, {
            "phase": phase,
            "name": phase_info["name"],
            "success": success,
            "duration": duration,
            "passed": passed,
            "failed": failed,
            "skipped": skipped,
            "output": output if options.get("verbose") else ""
        }
    
    def run_phases(self, phases: List[int], options: Dict) -> Dict:
        """Run multiple phases and collect results"""
        self.start_time = datetime.now()
        results = {
            "start_time": self.start_time.isoformat(),
            "phases": {},
            "summary": {
                "total_phases": len(phases),
                "passed_phases": 0,
                "failed_phases": 0,
                "total_tests": 0,
                "passed_tests": 0,
                "failed_tests": 0,
                "skipped_tests": 0,
                "total_duration": 0
            }
        }
        
        for phase in phases:
            success, phase_result = self.run_phase(phase, options)
            results["phases"][phase] = phase_result
            
            # Update summary
            if success:
                results["summary"]["passed_phases"] += 1
            else:
                results["summary"]["failed_phases"] += 1
                
            results["summary"]["total_tests"] += phase_result.get("passed", 0) + phase_result.get("failed", 0)
            results["summary"]["passed_tests"] += phase_result.get("passed", 0)
            results["summary"]["failed_tests"] += phase_result.get("failed", 0)
            results["summary"]["skipped_tests"] += phase_result.get("skipped", 0)
            results["summary"]["total_duration"] += phase_result.get("duration", 0)
        
        self.end_time = datetime.now()
        results["end_time"] = self.end_time.isoformat()
        results["summary"]["execution_time"] = (self.end_time - self.start_time).total_seconds()
        
        return results
    
    def generate_report(self, results: Dict, format: str = "console") -> str:
        """Generate test report in specified format"""
        if format == "console":
            return self._console_report(results)
        elif format == "json":
            return json.dumps(results, indent=2)
        elif format == "html":
            return self._html_report(results)
        elif format == "markdown":
            return self._markdown_report(results)
        else:
            return self._console_report(results)
    
    def _console_report(self, results: Dict) -> str:
        """Generate console-friendly report"""
        report = []
        report.append("\n" + "="*80)
        report.append("BetterPrompts E2E Test Results")
        report.append("="*80)
        report.append(f"Start Time: {results['start_time']}")
        report.append(f"End Time: {results['end_time']}")
        report.append(f"Total Duration: {results['summary']['execution_time']:.2f}s")
        report.append("")
        
        # Phase results
        report.append("Phase Results:")
        report.append("-"*80)
        for phase_num, phase_data in results["phases"].items():
            status = "✅ PASSED" if phase_data["success"] else "❌ FAILED"
            report.append(f"Phase {phase_num}: {phase_data['name']} - {status}")
            report.append(f"  Tests: {phase_data.get('passed', 0)} passed, {phase_data.get('failed', 0)} failed")
            report.append(f"  Duration: {phase_data.get('duration', 0):.2f}s")
            report.append("")
        
        # Summary
        summary = results["summary"]
        report.append("Summary:")
        report.append("-"*80)
        report.append(f"Total Phases: {summary['total_phases']} ({summary['passed_phases']} passed, {summary['failed_phases']} failed)")
        report.append(f"Total Tests: {summary['total_tests']} ({summary['passed_tests']} passed, {summary['failed_tests']} failed, {summary['skipped_tests']} skipped)")
        report.append(f"Success Rate: {(summary['passed_tests'] / summary['total_tests'] * 100) if summary['total_tests'] > 0 else 0:.1f}%")
        report.append("="*80)
        
        return "\n".join(report)
    
    def _markdown_report(self, results: Dict) -> str:
        """Generate markdown report"""
        report = []
        report.append("# BetterPrompts E2E Test Report")
        report.append("")
        report.append(f"**Generated**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        report.append(f"**Duration**: {results['summary']['execution_time']:.2f}s")
        report.append("")
        
        # Summary table
        report.append("## Summary")
        report.append("")
        report.append("| Metric | Value |")
        report.append("|--------|-------|")
        summary = results["summary"]
        report.append(f"| Total Phases | {summary['total_phases']} |")
        report.append(f"| Passed Phases | {summary['passed_phases']} |")
        report.append(f"| Failed Phases | {summary['failed_phases']} |")
        report.append(f"| Total Tests | {summary['total_tests']} |")
        report.append(f"| Passed Tests | {summary['passed_tests']} |")
        report.append(f"| Failed Tests | {summary['failed_tests']} |")
        report.append(f"| Success Rate | {(summary['passed_tests'] / summary['total_tests'] * 100) if summary['total_tests'] > 0 else 0:.1f}% |")
        report.append("")
        
        # Phase details
        report.append("## Phase Results")
        report.append("")
        for phase_num, phase_data in results["phases"].items():
            status = "✅" if phase_data["success"] else "❌"
            report.append(f"### Phase {phase_num}: {phase_data['name']} {status}")
            report.append("")
            report.append(f"- **Status**: {'PASSED' if phase_data['success'] else 'FAILED'}")
            report.append(f"- **Tests**: {phase_data.get('passed', 0)} passed, {phase_data.get('failed', 0)} failed")
            report.append(f"- **Duration**: {phase_data.get('duration', 0):.2f}s")
            report.append("")
        
        return "\n".join(report)
    
    def _html_report(self, results: Dict) -> str:
        """Generate HTML report"""
        html = f"""
<!DOCTYPE html>
<html>
<head>
    <title>BetterPrompts E2E Test Report</title>
    <style>
        body {{ font-family: Arial, sans-serif; margin: 20px; }}
        .header {{ background: #f0f0f0; padding: 20px; border-radius: 5px; }}
        .summary {{ margin: 20px 0; }}
        .phase {{ margin: 15px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }}
        .passed {{ background: #d4edda; }}
        .failed {{ background: #f8d7da; }}
        table {{ border-collapse: collapse; width: 100%; }}
        th, td {{ border: 1px solid #ddd; padding: 8px; text-align: left; }}
        th {{ background: #f0f0f0; }}
    </style>
</head>
<body>
    <div class="header">
        <h1>BetterPrompts E2E Test Report</h1>
        <p>Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
        <p>Duration: {results['summary']['execution_time']:.2f}s</p>
    </div>
    
    <div class="summary">
        <h2>Summary</h2>
        <table>
            <tr><th>Metric</th><th>Value</th></tr>
            <tr><td>Total Phases</td><td>{results['summary']['total_phases']}</td></tr>
            <tr><td>Passed Phases</td><td>{results['summary']['passed_phases']}</td></tr>
            <tr><td>Failed Phases</td><td>{results['summary']['failed_phases']}</td></tr>
            <tr><td>Total Tests</td><td>{results['summary']['total_tests']}</td></tr>
            <tr><td>Passed Tests</td><td>{results['summary']['passed_tests']}</td></tr>
            <tr><td>Failed Tests</td><td>{results['summary']['failed_tests']}</td></tr>
            <tr><td>Success Rate</td><td>{(results['summary']['passed_tests'] / results['summary']['total_tests'] * 100) if results['summary']['total_tests'] > 0 else 0:.1f}%</td></tr>
        </table>
    </div>
    
    <h2>Phase Results</h2>
"""
        
        for phase_num, phase_data in results["phases"].items():
            status_class = "passed" if phase_data["success"] else "failed"
            html += f"""
    <div class="phase {status_class}">
        <h3>Phase {phase_num}: {phase_data['name']}</h3>
        <p><strong>Status:</strong> {'PASSED' if phase_data['success'] else 'FAILED'}</p>
        <p><strong>Tests:</strong> {phase_data.get('passed', 0)} passed, {phase_data.get('failed', 0)} failed</p>
        <p><strong>Duration:</strong> {phase_data.get('duration', 0):.2f}s</p>
    </div>
"""
        
        html += """
</body>
</html>
"""
        return html


def main():
    """Main CLI entry point"""
    parser = argparse.ArgumentParser(
        description="BetterPrompts E2E Test Runner",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  run-tests.py                     # Run all tests
  run-tests.py 1 2 3               # Run phases 1, 2, and 3
  run-tests.py --category security # Run all security tests
  run-tests.py --report-format html --output report.html
        """
    )
    
    # Phase selection
    parser.add_argument("phases", nargs="*", type=int, help="Phase numbers to run (e.g., 1 2 3)")
    parser.add_argument("--all", action="store_true", help="Run all phases")
    parser.add_argument("--category", choices=list(CATEGORIES.keys()), help="Run all phases in a category")
    
    # Test options
    parser.add_argument("--browser", choices=["chromium", "firefox", "webkit"], help="Browser to use")
    parser.add_argument("--headed", action="store_true", help="Run tests in headed mode")
    parser.add_argument("--debug", action="store_true", help="Run tests in debug mode")
    parser.add_argument("--workers", type=int, help="Number of parallel workers")
    
    # Reporting options
    parser.add_argument("--report-format", choices=["console", "json", "html", "markdown"], 
                       default="console", help="Report format")
    parser.add_argument("--output", help="Output file for report")
    parser.add_argument("--report-only", action="store_true", help="Generate report from existing results")
    parser.add_argument("--verbose", action="store_true", help="Include test output in results")
    
    # Utility options
    parser.add_argument("--list-phases", action="store_true", help="List all available phases")
    parser.add_argument("--list-categories", action="store_true", help="List all categories")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be run without executing")
    
    args = parser.parse_args()
    
    # Handle utility commands
    if args.list_phases:
        print("\nAvailable Test Phases:")
        print("="*80)
        for phase, info in PHASE_METADATA.items():
            print(f"Phase {phase}: {info['name']}")
            print(f"  Category: {info['category']}")
            print(f"  Description: {info['description']}")
            print()
        return 0
    
    if args.list_categories:
        print("\nAvailable Categories:")
        print("="*80)
        for category, phases in CATEGORIES.items():
            phase_names = [f"{p}: {PHASE_METADATA[p]['name']}" for p in phases]
            print(f"{category}:")
            for name in phase_names:
                print(f"  - {name}")
            print()
        return 0
    
    # Determine which phases to run
    phases_to_run = []
    if args.all:
        phases_to_run = list(PHASE_METADATA.keys())
    elif args.category:
        phases_to_run = CATEGORIES[args.category]
    elif args.phases:
        phases_to_run = args.phases
    else:
        # Default to all phases if nothing specified
        phases_to_run = list(PHASE_METADATA.keys())
    
    # Validate phases
    invalid_phases = [p for p in phases_to_run if p not in PHASE_METADATA]
    if invalid_phases:
        print(f"Error: Invalid phase numbers: {invalid_phases}")
        return 1
    
    # Dry run
    if args.dry_run:
        print("\nDry Run - Would execute:")
        print("="*80)
        for phase in phases_to_run:
            info = PHASE_METADATA[phase]
            print(f"Phase {phase}: {info['name']} ({info['category']})")
        print(f"\nTotal phases: {len(phases_to_run)}")
        return 0
    
    # Initialize runner
    base_dir = Path(__file__).parent
    runner = TestRunner(base_dir)
    
    # Run tests or generate report
    if args.report_only:
        # Load existing results
        results_file = base_dir / "artifacts" / "test-results" / "latest-results.json"
        if not results_file.exists():
            print("Error: No results file found. Run tests first.")
            return 1
        with open(results_file) as f:
            results = json.load(f)
    else:
        # Run tests
        print(f"\nRunning {len(phases_to_run)} phases...")
        options = {
            "browser": args.browser,
            "headed": args.headed,
            "debug": args.debug,
            "workers": args.workers,
            "verbose": args.verbose
        }
        results = runner.run_phases(phases_to_run, options)
        
        # Save results
        results_file = base_dir / "artifacts" / "test-results" / "latest-results.json"
        results_file.parent.mkdir(parents=True, exist_ok=True)
        with open(results_file, "w") as f:
            json.dump(results, f, indent=2)
    
    # Generate report
    report = runner.generate_report(results, args.report_format)
    
    # Output report
    if args.output:
        with open(args.output, "w") as f:
            f.write(report)
        print(f"\nReport saved to: {args.output}")
    else:
        print(report)
    
    # Exit with appropriate code
    return 0 if results["summary"]["failed_phases"] == 0 else 1


if __name__ == "__main__":
    sys.exit(main())