import re

with open('src/i18n/translations.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Find vi section
vi_match = re.search(r'vi:\s*\{', content)
if not vi_match:
    print("Could not find vi object")
    exit(1)

vi_start = vi_match.end() - 1  # Include the opening brace

# Find all top-level keys in vi
lines = content.splitlines()
vi_line = content[:vi_match.start()].count('\n') + 1

# Track depth for each line after vi starts
in_vi_section = False
current_key = None
key_start_depth = None
problems = []

depth = 0
for i, line in enumerate(lines, 1):
    if i < vi_line:
        continue
    
    # Check for top-level key (4 spaces indent)
    top_key_match = re.match(r'^    (\w+):\s*\{', line)
    if top_key_match and i > vi_line:
        if current_key and key_start_depth is not None:
            if depth != key_start_depth:
                problems.append(f"{current_key} (line {key_start_line}): unclosed! Expected depth {key_start_depth}, got {depth}")
        current_key = top_key_match.group(1)
        key_start_line = i
        key_start_depth = depth
    
    # Count braces on this line
    open_count = line.count('{')
    close_count = line.count('}')
    depth += open_count - close_count
    
    # Check if we're closing vi
    if re.match(r'^\s*\},\s*$', line) and i > vi_line + 10:  # Likely closing vi
        if current_key:
            if depth -1 != key_start_depth:  # -1 because this line has a closing brace
                problems.append(f"{current_key} (line {key_start_line}): unclosed before vi closes! Expected depth {key_start_depth}, got {depth-1}")
        break

print(f"Problems found:")
for p in problems:
    print(p)
