#!/usr/bin/env python3
"""
Direct parser for PostgreSQL custom format dumps.
This is a workaround for version compatibility issues.
"""

import struct
import sys
from pathlib import Path

def parse_pgdump_header(f):
    """Parse PGDMP header."""
    # Read header
    header = f.read(5)
    if header != b'PGDMP':
        return None
    
    # Read version (should be at offset 5)
    version_bytes = f.read(4)
    version = struct.unpack('>I', version_bytes)[0]
    
    # Read more header info
    # Format: PGDMP, version (4 bytes), timestamp (8 bytes), etc.
    return {
        'version': version,
        'header': header
    }

def find_table_data_in_binary(dump_file):
    """Try to find table data markers in binary dump."""
    print(f"Attempting to parse binary dump: {dump_file}")
    
    with open(dump_file, 'rb') as f:
        # Read header
        header_info = parse_pgdump_header(f)
        if header_info:
            print(f"Dump version: {header_info['version']}")
            print("Note: This version may not be fully supported.")
        
        # Try to find text data (COPY statements, table names)
        f.seek(0)
        content = f.read()
        
        # Look for table names in the binary
        # PostgreSQL dumps often have readable table names even in binary format
        text_sections = []
        current_text = b''
        
        for i, byte in enumerate(content):
            if 32 <= byte <= 126:  # Printable ASCII
                current_text += bytes([byte])
            else:
                if len(current_text) > 10:  # Meaningful text
                    text_sections.append((i - len(current_text), current_text))
                current_text = b''
        
        # Look for table-related strings
        table_names = set()
        for pos, text in text_sections:
            text_str = text.decode('ascii', errors='ignore')
            # Look for CREATE TABLE or COPY statements
            if 'CREATE TABLE' in text_str or 'COPY' in text_str:
                # Try to extract table name
                import re
                matches = re.findall(r'["\'](\w+)["\']', text_str)
                table_names.update(matches)
        
        return list(table_names)

if __name__ == "__main__":
    dump_file = Path("heroku_psql_181025.dump")
    if dump_file.exists():
        tables = find_table_data_in_binary(dump_file)
        print(f"\nFound potential table names: {tables}")
    else:
        print(f"Dump file not found: {dump_file}")
