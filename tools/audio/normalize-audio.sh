#!/bin/bash
# A utility script to normalize audio loudness for pinball sound assets using ffmpeg.
# Usage: ./normalize-audio.sh input.wav output.wav

if ! command -v ffmpeg &> /dev/null; then
  echo "ffmpeg not found. Please install ffmpeg to normalize audio."
  exit 1
fi

INPUT_FILE=$1
OUTPUT_FILE=$2

if [ -z "$INPUT_FILE" ] || [ -z "$OUTPUT_FILE" ]; then
  echo "Usage: $0 <input_file> <output_file>"
  exit 1
fi

ffmpeg -i "$INPUT_FILE" -af loudnorm=I=-16:TP=-1.5:LRA=11 "$OUTPUT_FILE" -y
echo "Audio normalized: $OUTPUT_FILE"
