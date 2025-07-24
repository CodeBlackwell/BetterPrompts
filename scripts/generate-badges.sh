#!/bin/bash
# Generate coverage badges for BetterPrompts

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Project root
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BADGES_DIR="$PROJECT_ROOT/badges"
COVERAGE_DATA_FILE="$PROJECT_ROOT/.coverage/coverage-data.json"

echo -e "${BLUE}🛡️  Generating coverage badges for BetterPrompts${NC}"

# Create directories
mkdir -p "$BADGES_DIR"
mkdir -p "$(dirname "$COVERAGE_DATA_FILE")"

# Generate coverage data
echo -e "${YELLOW}📊 Collecting coverage data...${NC}"
python3 "$PROJECT_ROOT/scripts/coverage-aggregator.py" --format json --badges > "$COVERAGE_DATA_FILE"

# Function to create badge URL
create_badge_url() {
    local label=$1
    local message=$2
    local color=$3
    # URL encode spaces
    label="${label// /%20}"
    message="${message// /%20}"
    echo "https://img.shields.io/badge/${label}-${message}-${color}"
}

# Function to download badge
download_badge() {
    local name=$1
    local url=$2
    local output="$BADGES_DIR/${name}.svg"
    
    echo "  📥 Downloading ${name} badge..."
    curl -s "$url" -o "$output"
    
    if [ -f "$output" ]; then
        echo -e "  ${GREEN}✅ ${name} badge created${NC}"
    else
        echo -e "  ❌ Failed to create ${name} badge"
        return 1
    fi
}

# Parse JSON and generate badges
if [ -f "$COVERAGE_DATA_FILE" ]; then
    # Extract total coverage
    TOTAL_COVERAGE=$(jq -r '.total.message' "$COVERAGE_DATA_FILE")
    TOTAL_COLOR=$(jq -r '.total.color' "$COVERAGE_DATA_FILE")
    
    # Generate total coverage badge
    echo -e "${YELLOW}🏷️  Creating badges...${NC}"
    TOTAL_URL=$(create_badge_url "coverage" "$TOTAL_COVERAGE" "$TOTAL_COLOR")
    download_badge "coverage-total" "$TOTAL_URL"
    
    # Generate service-specific badges
    SERVICES=$(jq -r '.services | keys[]' "$COVERAGE_DATA_FILE")
    
    for service in $SERVICES; do
        SERVICE_COVERAGE=$(jq -r ".services.\"$service\".message" "$COVERAGE_DATA_FILE")
        SERVICE_COLOR=$(jq -r ".services.\"$service\".color" "$COVERAGE_DATA_FILE")
        
        if [ "$SERVICE_COVERAGE" != "null" ]; then
            SERVICE_URL=$(create_badge_url "${service}" "$SERVICE_COVERAGE" "$SERVICE_COLOR")
            download_badge "coverage-${service}" "$SERVICE_URL"
        fi
    done
    
    # Generate language-specific badges (Go, Python, TypeScript)
    echo -e "${YELLOW}🔤 Creating language badges...${NC}"
    
    # This would require additional parsing from the aggregator
    # For now, we'll create placeholders
    
    echo -e "${GREEN}✨ Badge generation complete!${NC}"
    echo -e "${BLUE}📁 Badges saved to: $BADGES_DIR${NC}"
    
    # Display badge markdown
    echo -e "\n${YELLOW}📝 Add these to your README.md:${NC}\n"
    echo "![Total Coverage](./badges/coverage-total.svg)"
    echo ""
    echo "### Service Coverage"
    for service in $SERVICES; do
        echo "![${service} Coverage](./badges/coverage-${service}.svg)"
    done
else
    echo -e "❌ Failed to generate coverage data"
    exit 1
fi