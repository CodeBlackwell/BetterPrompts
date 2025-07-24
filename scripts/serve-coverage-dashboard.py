#!/usr/bin/env python3
"""
Serve the coverage dashboard with live updates
"""

import http.server
import socketserver
import os
import json
import threading
import time
from pathlib import Path
import subprocess
import argparse
import shutil

class CoverageDashboardHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        self.coverage_dir = Path.cwd() / ".coverage"
        super().__init__(*args, **kwargs)
    
    def do_GET(self):
        if self.path == '/coverage.json':
            self.serve_coverage_json()
        elif self.path == '/coverage-report.md':
            self.serve_coverage_report()
        elif self.path == '/':
            self.serve_dashboard()
        else:
            super().do_GET()
    
    def serve_coverage_json(self):
        """Serve the latest coverage JSON data"""
        json_file = self.coverage_dir / "coverage.json"
        
        if json_file.exists():
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Cache-Control', 'no-cache')
            self.end_headers()
            
            with open(json_file, 'rb') as f:
                self.wfile.write(f.read())
        else:
            self.send_error(404, "Coverage data not found")
    
    def serve_coverage_report(self):
        """Serve the coverage markdown report"""
        report_file = self.coverage_dir / "COVERAGE.md"
        
        if report_file.exists():
            self.send_response(200)
            self.send_header('Content-type', 'text/markdown')
            self.end_headers()
            
            with open(report_file, 'rb') as f:
                self.wfile.write(f.read())
        else:
            self.send_error(404, "Coverage report not found")
    
    def serve_dashboard(self):
        """Serve the dashboard HTML"""
        dashboard_file = Path(__file__).parent / "coverage-dashboard.html"
        
        if dashboard_file.exists():
            self.send_response(200)
            self.send_header('Content-type', 'text/html')
            self.end_headers()
            
            with open(dashboard_file, 'rb') as f:
                self.wfile.write(f.read())
        else:
            self.send_error(404, "Dashboard not found")
    
    def log_message(self, format, *args):
        """Custom log message format"""
        if '/coverage.json' not in args[0]:  # Don't log JSON polling
            print(f"[{self.log_date_time_string()}] {format % args}")


class CoverageWatcher:
    """Watch for coverage file changes and regenerate reports"""
    
    def __init__(self, project_root):
        self.project_root = Path(project_root)
        self.running = False
        self.thread = None
    
    def start(self):
        """Start watching for changes"""
        self.running = True
        self.thread = threading.Thread(target=self._watch_loop)
        self.thread.daemon = True
        self.thread.start()
        print("📁 Started watching for coverage file changes...")
    
    def stop(self):
        """Stop watching"""
        self.running = False
        if self.thread:
            self.thread.join()
    
    def _watch_loop(self):
        """Main watch loop"""
        coverage_files = {
            'go': ['coverage.out'],
            'python': ['coverage.xml', '.coverage'],
            'javascript': ['lcov.info', 'coverage-summary.json']
        }
        
        last_update = {}
        
        while self.running:
            updated = False
            
            # Check all service directories
            for service_type, patterns in coverage_files.items():
                for root, dirs, files in os.walk(self.project_root):
                    # Skip unwanted directories
                    if any(skip in root for skip in ['node_modules', '.git', '__pycache__', '.coverage']):
                        continue
                    
                    for pattern in patterns:
                        if pattern in files:
                            file_path = Path(root) / pattern
                            mtime = file_path.stat().st_mtime
                            
                            if file_path not in last_update or last_update[file_path] < mtime:
                                last_update[file_path] = mtime
                                updated = True
            
            if updated:
                print("🔄 Coverage files updated, regenerating reports...")
                self._regenerate_reports()
            
            time.sleep(5)  # Check every 5 seconds
    
    def _regenerate_reports(self):
        """Regenerate coverage reports"""
        try:
            # Run the coverage aggregator
            aggregator_script = self.project_root / "scripts" / "coverage-aggregator.py"
            coverage_dir = self.project_root / ".coverage"
            coverage_dir.mkdir(exist_ok=True)
            
            # Generate JSON report
            subprocess.run([
                "python3", str(aggregator_script),
                "--format", "json",
                "--output", str(coverage_dir / "coverage.json"),
                "--project-root", str(self.project_root)
            ], capture_output=True)
            
            # Generate Markdown report
            subprocess.run([
                "python3", str(aggregator_script),
                "--format", "markdown",
                "--output", str(coverage_dir / "COVERAGE.md"),
                "--project-root", str(self.project_root)
            ], capture_output=True)
            
            print("✅ Coverage reports regenerated successfully")
            
        except Exception as e:
            print(f"❌ Error regenerating reports: {e}")


def main():
    parser = argparse.ArgumentParser(description="Serve BetterPrompts coverage dashboard")
    parser.add_argument("--port", type=int, default=8080, help="Port to serve on (default: 8080)")
    parser.add_argument("--host", default="localhost", help="Host to bind to (default: localhost)")
    parser.add_argument("--no-watch", action="store_true", help="Disable file watching")
    parser.add_argument("--open", action="store_true", help="Open browser automatically")
    
    args = parser.parse_args()
    
    # Get project root
    project_root = Path(__file__).parent.parent
    os.chdir(project_root)
    
    # Generate initial reports
    print("📊 Generating initial coverage reports...")
    coverage_dir = project_root / ".coverage"
    coverage_dir.mkdir(exist_ok=True)
    
    aggregator_script = project_root / "scripts" / "coverage-aggregator.py"
    if aggregator_script.exists():
        subprocess.run([
            "python3", str(aggregator_script),
            "--format", "json",
            "--output", str(coverage_dir / "coverage.json")
        ])
        subprocess.run([
            "python3", str(aggregator_script),
            "--format", "markdown",
            "--output", str(coverage_dir / "COVERAGE.md")
        ])
    
    # Start file watcher
    watcher = None
    if not args.no_watch:
        watcher = CoverageWatcher(project_root)
        watcher.start()
    
    # Start HTTP server
    Handler = CoverageDashboardHandler
    
    try:
        with socketserver.TCPServer((args.host, args.port), Handler) as httpd:
            url = f"http://{args.host}:{args.port}"
            print(f"\n🚀 Coverage dashboard running at: {url}")
            print("Press Ctrl+C to stop\n")
            
            # Open browser if requested
            if args.open:
                import webbrowser
                webbrowser.open(url)
            
            httpd.serve_forever()
            
    except KeyboardInterrupt:
        print("\n👋 Shutting down...")
        if watcher:
            watcher.stop()
        print("Goodbye!")
    except Exception as e:
        print(f"❌ Error: {e}")
        if watcher:
            watcher.stop()


if __name__ == "__main__":
    main()