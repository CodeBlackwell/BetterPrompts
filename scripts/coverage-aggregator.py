#!/usr/bin/env python3
"""
Unified Coverage Aggregator for BetterPrompts
Aggregates test coverage from Go, Python, and TypeScript/JavaScript services
"""

import json
import os
import sys
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Dict, List, Tuple
import subprocess
import argparse

class CoverageAggregator:
    def __init__(self, project_root: Path):
        self.project_root = project_root
        self.coverage_data = {}
        self.total_lines = 0
        self.covered_lines = 0
        
    def collect_go_coverage(self, service_path: Path, service_name: str) -> Dict:
        """Collect coverage from Go services using go tool cover"""
        coverage_file = service_path / "coverage.out"
        
        if not coverage_file.exists():
            print(f"⚠️  No coverage file found for {service_name}")
            return {"error": "No coverage file"}
            
        try:
            # Parse go coverage data
            result = subprocess.run(
                ["go", "tool", "cover", "-func", str(coverage_file)],
                cwd=service_path,
                capture_output=True,
                text=True
            )
            
            if result.returncode != 0:
                return {"error": f"Failed to parse coverage: {result.stderr}"}
                
            # Extract total coverage from last line
            lines = result.stdout.strip().split('\n')
            if lines:
                total_line = lines[-1]
                if "total:" in total_line:
                    coverage_percent = float(total_line.split()[-1].rstrip('%'))
                    
                    # Get line counts
                    lines_result = subprocess.run(
                        ["go", "tool", "cover", "-html", str(coverage_file), "-o", "/dev/null"],
                        cwd=service_path,
                        capture_output=True,
                        text=True
                    )
                    
                    return {
                        "coverage": coverage_percent,
                        "language": "Go",
                        "file": str(coverage_file)
                    }
                    
        except Exception as e:
            return {"error": str(e)}
            
        return {"error": "Failed to parse coverage"}
        
    def collect_python_coverage(self, service_path: Path, service_name: str) -> Dict:
        """Collect coverage from Python services using coverage.xml"""
        coverage_file = service_path / "coverage.xml"
        
        if not coverage_file.exists():
            print(f"⚠️  No coverage file found for {service_name}")
            return {"error": "No coverage file"}
            
        try:
            tree = ET.parse(coverage_file)
            root = tree.getroot()
            
            # Extract coverage percentage
            coverage_percent = float(root.attrib.get('line-rate', 0)) * 100
            
            # Extract line counts
            lines_covered = int(root.attrib.get('lines-covered', 0))
            lines_valid = int(root.attrib.get('lines-valid', 0))
            
            return {
                "coverage": coverage_percent,
                "lines_covered": lines_covered,
                "lines_total": lines_valid,
                "language": "Python",
                "file": str(coverage_file)
            }
            
        except Exception as e:
            return {"error": str(e)}
            
    def collect_javascript_coverage(self, service_path: Path, service_name: str) -> Dict:
        """Collect coverage from JavaScript/TypeScript services using lcov.info"""
        # Look for coverage in standard locations
        coverage_paths = [
            service_path / "coverage" / "lcov.info",
            service_path / "coverage" / "lcov-report" / "lcov.info",
            service_path / ".nyc_output" / "lcov.info"
        ]
        
        coverage_file = None
        for path in coverage_paths:
            if path.exists():
                coverage_file = path
                break
                
        if not coverage_file:
            # Try to find coverage-summary.json as alternative
            summary_path = service_path / "coverage" / "coverage-summary.json"
            if summary_path.exists():
                return self._parse_coverage_summary(summary_path)
            
            print(f"⚠️  No coverage file found for {service_name}")
            return {"error": "No coverage file"}
            
        try:
            with open(coverage_file, 'r') as f:
                content = f.read()
                
            # Parse LCOV format
            lines_found = 0
            lines_hit = 0
            
            for line in content.split('\n'):
                if line.startswith('LF:'):
                    lines_found += int(line.split(':')[1])
                elif line.startswith('LH:'):
                    lines_hit += int(line.split(':')[1])
                    
            if lines_found > 0:
                coverage_percent = (lines_hit / lines_found) * 100
                
                return {
                    "coverage": coverage_percent,
                    "lines_covered": lines_hit,
                    "lines_total": lines_found,
                    "language": "TypeScript/JavaScript",
                    "file": str(coverage_file)
                }
                
        except Exception as e:
            return {"error": str(e)}
            
        return {"error": "Failed to parse coverage"}
        
    def _parse_coverage_summary(self, summary_path: Path) -> Dict:
        """Parse coverage from coverage-summary.json"""
        try:
            with open(summary_path, 'r') as f:
                data = json.load(f)
                
            total = data.get('total', {})
            lines = total.get('lines', {})
            
            if lines:
                return {
                    "coverage": lines.get('pct', 0),
                    "lines_covered": lines.get('covered', 0),
                    "lines_total": lines.get('total', 0),
                    "language": "TypeScript/JavaScript",
                    "file": str(summary_path)
                }
                
        except Exception as e:
            return {"error": str(e)}
            
        return {"error": "Failed to parse coverage summary"}
        
    def collect_all_coverage(self) -> Dict[str, Dict]:
        """Collect coverage from all services"""
        services = {
            # Go services
            "api-gateway": (self.project_root / "backend/services/api-gateway", "go"),
            "technique-selector": (self.project_root / "backend/services/technique-selector", "go"),
            
            # Python services
            "intent-classifier": (self.project_root / "backend/services/intent-classifier", "python"),
            "prompt-generator": (self.project_root / "backend/services/prompt-generator", "python"),
            
            # TypeScript/JavaScript
            "frontend": (self.project_root / "frontend", "javascript"),
        }
        
        for service_name, (service_path, language) in services.items():
            if not service_path.exists():
                self.coverage_data[service_name] = {"error": "Service path not found"}
                continue
                
            if language == "go":
                self.coverage_data[service_name] = self.collect_go_coverage(service_path, service_name)
            elif language == "python":
                self.coverage_data[service_name] = self.collect_python_coverage(service_path, service_name)
            elif language == "javascript":
                self.coverage_data[service_name] = self.collect_javascript_coverage(service_path, service_name)
                
        return self.coverage_data
        
    def calculate_total_coverage(self) -> Tuple[float, int, int]:
        """Calculate weighted total coverage across all services"""
        total_lines = 0
        covered_lines = 0
        
        for service_name, data in self.coverage_data.items():
            if "error" not in data:
                if "lines_total" in data and "lines_covered" in data:
                    total_lines += data["lines_total"]
                    covered_lines += data["lines_covered"]
                elif "coverage" in data:
                    # Estimate lines for services without detailed data
                    # This is a rough estimate based on typical service size
                    estimated_lines = 1000  # Default estimate
                    if service_name == "frontend":
                        estimated_lines = 3000
                    elif service_name in ["api-gateway", "technique-selector"]:
                        estimated_lines = 1500
                        
                    total_lines += estimated_lines
                    covered_lines += int(estimated_lines * data["coverage"] / 100)
                    
        if total_lines > 0:
            total_coverage = (covered_lines / total_lines) * 100
        else:
            total_coverage = 0
            
        return total_coverage, covered_lines, total_lines
        
    def generate_report(self, output_format: str = "text") -> str:
        """Generate coverage report in specified format"""
        total_coverage, covered_lines, total_lines = self.calculate_total_coverage()
        
        if output_format == "json":
            report_data = {
                "total_coverage": round(total_coverage, 2),
                "total_lines": total_lines,
                "covered_lines": covered_lines,
                "services": self.coverage_data,
                "summary": {
                    "go_services": [],
                    "python_services": [],
                    "javascript_services": []
                }
            }
            
            for service, data in self.coverage_data.items():
                if "error" not in data:
                    if data.get("language") == "Go":
                        report_data["summary"]["go_services"].append({
                            "name": service,
                            "coverage": data.get("coverage", 0)
                        })
                    elif data.get("language") == "Python":
                        report_data["summary"]["python_services"].append({
                            "name": service,
                            "coverage": data.get("coverage", 0)
                        })
                    elif "JavaScript" in data.get("language", ""):
                        report_data["summary"]["javascript_services"].append({
                            "name": service,
                            "coverage": data.get("coverage", 0)
                        })
                        
            return json.dumps(report_data, indent=2)
            
        elif output_format == "markdown":
            report = ["# BetterPrompts Coverage Report\n"]
            report.append(f"**Total Coverage: {total_coverage:.1f}%** ({covered_lines:,}/{total_lines:,} lines)\n")
            report.append("## Service Coverage\n")
            report.append("| Service | Language | Coverage | Status |")
            report.append("|---------|----------|----------|---------|")
            
            for service, data in sorted(self.coverage_data.items()):
                if "error" in data:
                    report.append(f"| {service} | - | - | ❌ {data['error']} |")
                else:
                    coverage = data.get('coverage', 0)
                    language = data.get('language', 'Unknown')
                    status = "✅" if coverage >= 80 else "⚠️" if coverage >= 60 else "❌"
                    report.append(f"| {service} | {language} | {coverage:.1f}% | {status} |")
                    
            return "\n".join(report)
            
        else:  # text format
            report = ["=" * 60]
            report.append("BetterPrompts Coverage Report".center(60))
            report.append("=" * 60)
            report.append(f"\nTotal Coverage: {total_coverage:.1f}% ({covered_lines:,}/{total_lines:,} lines)")
            report.append("\nService Coverage:")
            report.append("-" * 60)
            
            for service, data in sorted(self.coverage_data.items()):
                if "error" in data:
                    report.append(f"{service:20} | {'ERROR':>10} | {data['error']}")
                else:
                    coverage = data.get('coverage', 0)
                    language = data.get('language', 'Unknown')
                    status = "PASS" if coverage >= 80 else "WARN" if coverage >= 60 else "FAIL"
                    report.append(f"{service:20} | {coverage:>6.1f}% | {language:15} | {status}")
                    
            report.append("-" * 60)
            return "\n".join(report)
            
    def generate_badge_data(self) -> Dict:
        """Generate data for coverage badges"""
        total_coverage, _, _ = self.calculate_total_coverage()
        
        badges = {
            "total": {
                "label": "coverage",
                "message": f"{total_coverage:.1f}%",
                "color": self._get_badge_color(total_coverage)
            },
            "services": {}
        }
        
        for service, data in self.coverage_data.items():
            if "error" not in data:
                coverage = data.get('coverage', 0)
                badges["services"][service] = {
                    "label": f"coverage-{service}",
                    "message": f"{coverage:.1f}%",
                    "color": self._get_badge_color(coverage)
                }
                
        return badges
        
    def _get_badge_color(self, coverage: float) -> str:
        """Get badge color based on coverage percentage"""
        if coverage >= 80:
            return "brightgreen"
        elif coverage >= 60:
            return "yellow"
        else:
            return "red"


def main():
    parser = argparse.ArgumentParser(description="Aggregate test coverage across all BetterPrompts services")
    parser.add_argument("--format", choices=["text", "json", "markdown"], default="text",
                        help="Output format for the report")
    parser.add_argument("--output", help="Output file (default: stdout)")
    parser.add_argument("--badges", action="store_true", help="Generate badge data")
    parser.add_argument("--project-root", default=".", help="Project root directory")
    
    args = parser.parse_args()
    
    project_root = Path(args.project_root).resolve()
    aggregator = CoverageAggregator(project_root)
    
    print("🔍 Collecting coverage data from all services...\n", file=sys.stderr)
    aggregator.collect_all_coverage()
    
    if args.badges:
        badges = aggregator.generate_badge_data()
        output = json.dumps(badges, indent=2)
    else:
        output = aggregator.generate_report(args.format)
        
    if args.output:
        with open(args.output, 'w') as f:
            f.write(output)
        print(f"✅ Report written to {args.output}", file=sys.stderr)
    else:
        print(output)


if __name__ == "__main__":
    main()