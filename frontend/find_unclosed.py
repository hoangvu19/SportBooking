with open('src/i18n/translations.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

depth = 0
in_vi = False
vi_depth = 0
problem_lines = []

for i, line in enumerate(lines, 1):
    # Track when we enter vi object
    if 'vi: {' in line:
        in_vi = True
        vi_depth = depth + 1
    
    # Count braces
    open_count = line.count('{')
    close_count = line.count('}')
    
    depth += open_count - close_count
    
    # Check for problems in vi section
    if in_vi and depth < vi_depth:
        problem_lines.append(f"Line {i}: depth dropped below vi level ({depth} < {vi_depth})")
        problem_lines.append(f"  Content: {line.strip()[:80]}")
        in_vi = False  # We left vi
    
    if depth < 0:
        problem_lines.append(f"Line {i}: negative depth {depth}")
        problem_lines.append(f"  Content: {line.strip()[:80]}")

print(f"Final depth: {depth}")
print(f"Expected: 0")
print(f"\nProblems found: {len(problem_lines)}")
for p in problem_lines[:10]:
    print(p)
