#!/bin/bash

# Run Critical Path E2E Tests
echo "=================================="
echo "BetterPrompts Critical Path Tests"
echo "=================================="

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check if services are running
echo -e "\n${YELLOW}Checking service availability...${NC}"

services=(
    "localhost:80:API Gateway"
    "localhost:8080:TorchServe"
    "localhost:8001:Intent Classifier"
    "localhost:8002:Technique Selector"
    "localhost:8003:Prompt Generator"
)

all_healthy=true
for service in "${services[@]}"; do
    IFS=':' read -r host port name <<< "$service"
    if nc -z "$host" "$port" 2>/dev/null; then
        echo -e "${GREEN}✓ $name is running on port $port${NC}"
    else
        echo -e "${RED}✗ $name is not accessible on port $port${NC}"
        all_healthy=false
    fi
done

if [ "$all_healthy" = false ]; then
    echo -e "\n${RED}Some services are not running. Please ensure all services are up.${NC}"
    echo "Run: docker compose up -d"
    exit 1
fi

# Create Python test script for easier testing
cat > test_critical_paths.py << 'EOF'
import requests
import json
import time
from datetime import datetime

BASE_URL = "http://localhost/api/v1"

def test_health_endpoints():
    """Test all service health endpoints"""
    print("\n1. Testing Health Endpoints")
    print("-" * 40)
    
    endpoints = [
        ("API Gateway", f"{BASE_URL}/health"),
        ("TorchServe", "http://localhost:8080/ping"),
        ("Intent Classifier", "http://localhost:8001/health"),
        ("Technique Selector", "http://localhost:8002/health"),
        ("Prompt Generator", "http://localhost:8003/health"),
    ]
    
    all_healthy = True
    for name, url in endpoints:
        try:
            resp = requests.get(url, timeout=5)
            if resp.status_code == 200:
                print(f"✓ {name}: Healthy")
            else:
                print(f"✗ {name}: Unhealthy (status: {resp.status_code})")
                all_healthy = False
        except Exception as e:
            print(f"✗ {name}: Failed ({str(e)})")
            all_healthy = False
    
    return all_healthy

def test_enhancement_flow():
    """Test the complete enhancement flow"""
    print("\n2. Testing Enhancement Flow")
    print("-" * 40)
    
    test_cases = [
        {
            "name": "Code Generation",
            "input": "Write a Python function to calculate fibonacci numbers",
            "check_enhanced": True
        },
        {
            "name": "Question Answering",
            "input": "What is the difference between AI and machine learning?",
            "check_enhanced": True
        },
        {
            "name": "Creative Writing",
            "input": "Write a haiku about programming",
            "check_enhanced": True
        }
    ]
    
    all_passed = True
    for test in test_cases:
        try:
            resp = requests.post(
                f"{BASE_URL}/enhance",
                json={"text": test["input"]},
                timeout=10
            )
            
            if resp.status_code == 200:
                data = resp.json()
                
                # Check required fields
                has_intent = "intent" in data and data["intent"]
                has_techniques = "techniques" in data and len(data["techniques"]) > 0
                is_enhanced = data.get("enhanced", False)
                
                if has_intent and has_techniques and is_enhanced:
                    print(f"✓ {test['name']}: Success")
                    print(f"  - Intent: {data['intent']}")
                    print(f"  - Techniques: {', '.join(data['techniques'])}")
                    print(f"  - Processing time: {data.get('processing_time_ms', 'N/A')}ms")
                else:
                    print(f"✗ {test['name']}: Missing required fields")
                    all_passed = False
            else:
                print(f"✗ {test['name']}: Failed (status: {resp.status_code})")
                all_passed = False
                
        except Exception as e:
            print(f"✗ {test['name']}: Error ({str(e)})")
            all_passed = False
    
    return all_passed

def test_performance():
    """Test performance requirements"""
    print("\n3. Testing Performance Requirements")
    print("-" * 40)
    
    iterations = 20
    response_times = []
    
    for i in range(iterations):
        start = time.time()
        try:
            resp = requests.post(
                f"{BASE_URL}/enhance",
                json={"text": "Quick performance test"},
                timeout=5
            )
            if resp.status_code == 200:
                elapsed = (time.time() - start) * 1000  # Convert to ms
                response_times.append(elapsed)
        except:
            pass
    
    if response_times:
        response_times.sort()
        p95_index = int(len(response_times) * 0.95)
        p95_time = response_times[p95_index - 1] if p95_index > 0 else response_times[0]
        avg_time = sum(response_times) / len(response_times)
        
        print(f"Completed {len(response_times)}/{iterations} requests")
        print(f"Average response time: {avg_time:.2f}ms")
        print(f"P95 response time: {p95_time:.2f}ms")
        
        if p95_time < 200:
            print("✓ Performance: P95 < 200ms target")
            return True
        else:
            print("✗ Performance: P95 exceeds 200ms target")
            return False
    else:
        print("✗ Performance: No successful requests")
        return False

def test_error_handling():
    """Test error handling"""
    print("\n4. Testing Error Handling")
    print("-" * 40)
    
    test_cases = [
        {
            "name": "Empty request",
            "payload": {},
            "expected_status": 422
        },
        {
            "name": "Missing text field",
            "payload": {"wrong_field": "test"},
            "expected_status": 422
        },
        {
            "name": "Empty text",
            "payload": {"text": ""},
            "expected_status": 422
        }
    ]
    
    all_passed = True
    for test in test_cases:
        try:
            resp = requests.post(
                f"{BASE_URL}/enhance",
                json=test["payload"],
                timeout=5
            )
            
            if resp.status_code == test["expected_status"]:
                print(f"✓ {test['name']}: Correctly returned {resp.status_code}")
            else:
                print(f"✗ {test['name']}: Expected {test['expected_status']}, got {resp.status_code}")
                all_passed = False
                
        except Exception as e:
            print(f"✗ {test['name']}: Error ({str(e)})")
            all_passed = False
    
    return all_passed

def main():
    """Run all tests"""
    print(f"\nRunning BetterPrompts Critical Path Tests")
    print(f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 50)
    
    results = {
        "Health Checks": test_health_endpoints(),
        "Enhancement Flow": test_enhancement_flow(),
        "Performance": test_performance(),
        "Error Handling": test_error_handling()
    }
    
    print("\n" + "=" * 50)
    print("TEST SUMMARY")
    print("=" * 50)
    
    total_tests = len(results)
    passed_tests = sum(1 for passed in results.values() if passed)
    
    for test_name, passed in results.items():
        status = "PASSED" if passed else "FAILED"
        symbol = "✓" if passed else "✗"
        print(f"{symbol} {test_name}: {status}")
    
    print(f"\nTotal: {passed_tests}/{total_tests} tests passed")
    
    if passed_tests == total_tests:
        print("\n✅ All critical path tests passed!")
        return 0
    else:
        print(f"\n❌ {total_tests - passed_tests} tests failed")
        return 1

if __name__ == "__main__":
    exit(main())
EOF

# Run the Python tests
echo -e "\n${YELLOW}Running critical path tests...${NC}"
python3 test_critical_paths.py
test_result=$?

# Clean up
rm -f test_critical_paths.py

# Final result
echo
if [ $test_result -eq 0 ]; then
    echo -e "${GREEN}✅ All critical path tests passed!${NC}"
else
    echo -e "${RED}❌ Some tests failed. Please check the output above.${NC}"
fi

exit $test_result