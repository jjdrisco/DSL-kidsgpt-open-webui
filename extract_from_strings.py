#!/usr/bin/env python3
"""
Extract table data from PostgreSQL dump using strings output.
This works around version compatibility issues.
"""

import re
import json
import pandas as pd
from pathlib import Path
import subprocess

def extract_tables_from_strings(dump_file):
    """Extract table data from dump using strings command."""
    print(f"Extracting data from {dump_file}...")
    
    # Run strings command
    result = subprocess.run(
        ['strings', str(dump_file)],
        capture_output=True,
        text=True
    )
    
    content = result.stdout
    
    # Find all COPY statements
    copy_pattern = r'COPY "public"\.\"(\w+)"\s*\(([^)]+)\)\s+FROM stdin;'
    copy_matches = list(re.finditer(copy_pattern, content))
    
    print(f"Found {len(copy_matches)} COPY statements")
    
    tables_data = {}
    
    for i, copy_match in enumerate(copy_matches):
        table_name = copy_match.group(1)
        columns_str = copy_match.group(2)
        columns = [col.strip().strip('"') for col in columns_str.split(',')]
        
        print(f"  Processing {table_name}...")
        
        # Find the data section - look for tab-separated lines after COPY
        start_pos = copy_match.end()
        
        # Find next COPY or end
        if i + 1 < len(copy_matches):
            end_pos = copy_matches[i + 1].start()
        else:
            end_pos = len(content)
        
        # Extract potential data lines (tab-separated values)
        data_section = content[start_pos:end_pos]
        
        # Look for lines that look like data (have tabs and reasonable length)
        rows = []
        lines = data_section.split('\n')
        
        for line in lines[:1000]:  # Limit to first 1000 lines per table for now
            line = line.strip()
            if not line or line.startswith('--') or 'COPY' in line or 'CREATE' in line:
                continue
            
            # Check if line has tabs (likely data)
            if '\t' in line:
                values = line.split('\t')
                if len(values) == len(columns):
                    row = {}
                    for col, val in zip(columns, values):
                        if val == '\\N' or val == '':
                            row[col] = None
                        else:
                            # Try to parse JSON
                            if val.startswith('{') or val.startswith('['):
                                try:
                                    row[col] = json.loads(val)
                                except:
                                    row[col] = val
                            else:
                                row[col] = val
                    rows.append(row)
        
        if rows:
            tables_data[table_name] = pd.DataFrame(rows)
            print(f"    ✓ Extracted {len(rows)} rows")
        else:
            print(f"    ✗ No data found")
    
    return tables_data

if __name__ == "__main__":
    dump_file = Path("heroku_psql_181025.dump")
    if dump_file.exists():
        tables = extract_tables_from_strings(dump_file)
        
        # Save to CSV
        output_dir = Path("data_exports")
        output_dir.mkdir(exist_ok=True)
        
        for table_name, df in tables.items():
            csv_file = output_dir / f"{table_name}.csv"
            df.to_csv(csv_file, index=False)
            print(f"Saved {table_name} to {csv_file}")
    else:
        print(f"Dump file not found: {dump_file}")
