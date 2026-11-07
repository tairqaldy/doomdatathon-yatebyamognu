#!/usr/bin/env bash
# Creates the shared issue labels once (AGENTS.md §4.1). Needs: gh auth login
set -e
mk() { gh label create "$1" --color "$2" --description "$3" --force >/dev/null && echo "label: $1"; }
mk "lane:a" "3586EA" "Frontend / UX"
mk "lane:b" "6A788A" "Backend / Data"
mk "lane:c" "00B323" "AI / Evaluation"
mk "lane:d" "FFA700" "Product / Research / Pitch"
mk "P0" "EE5555" "Breaks the demo or a must-have"
mk "P1" "F9B000" "Needed for the defense"
mk "P2" "B2BCC8" "Nice to have"
mk "blocked" "323335" "Waiting on something"
mk "contract-change" "7D8DEE" "Changes a shape in docs/CONTRACTS.md"
mk "design" "1CCC9E" "Design system / UI"
mk "research" "C6DCFF" "Research task"
for l in a b c d; do mk "needs:lane-$l" "DFF5EC" "Cross-lane request for lane $l"; done
