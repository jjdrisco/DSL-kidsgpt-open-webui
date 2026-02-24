#!/usr/bin/env python3
"""Utility for turning a JSON array of scenarios into individual text files.

Each element of the input JSON array is expected to be a dict that
contains at least a prompt field ("child_prompt" or "prompt") and
an associated response ("model_response" or "assistant_response").

The script writes one .txt file per scenario into a directory of your
choice.  The files are named by the scenario's `persona_id` if present
or by a numeric index otherwise.  Within each file the prompt and the
response are separated by two newlines.

Example usage:

    python scripts/export_scenarios.py \
        -i scenarios/pilot_scenarios.json \
        -o /tmp/pilot-txt

"""

import argparse
import json
import os
import sys


def _get_prompt(item: dict) -> str:
    for key in ("child_prompt", "prompt"):
        if key in item:
            return item[key]
    return ""


def _get_response(item: dict) -> str:
    for key in ("model_response", "assistant_response", "response"):
        if key in item:
            return item[key]
    return ""


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Export each scenario in a JSON file to its own text file."
    )
    parser.add_argument(
        "-i",
        "--input",
        required=True,
        help="Path to the JSON file containing an array of scenarios.",
    )
    parser.add_argument(
        "-o",
        "--output-dir",
        required=True,
        help="Directory in which to write the .txt files.",
    )
    args = parser.parse_args()

    try:
        with open(args.input, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as e:
        print(f"Failed to read or parse {args.input}: {e}", file=sys.stderr)
        sys.exit(1)

    if not isinstance(data, list):
        print("Input JSON is not an array", file=sys.stderr)
        sys.exit(1)

    os.makedirs(args.output_dir, exist_ok=True)

    for idx, item in enumerate(data, start=1):
        pid = item.get("persona_id") or f"{idx:03d}"
        prompt = _get_prompt(item).strip()
        resp = _get_response(item).strip()

        outpath = os.path.join(args.output_dir, f"{pid}.txt")
        with open(outpath, "w", encoding="utf-8") as out:
            out.write(prompt)
            out.write("\n\n")
            out.write(resp)

    print(f"Wrote {len(data)} files to {args.output_dir}")


if __name__ == "__main__":
    main()
