#!/bin/bash

# Script to upload all documents to the Vector Store
# Make sure you're in the project root directory

echo "🚀 Uploading all documents to Vector Store..."
echo "=============================================="

# Upload CSV data
if [ -f "./data/qa.csv" ]; then
    echo "📄 Uploading Q&A CSV data..."
    npx ts-node scripts/add-files-with-credentials.ts ./data/qa.csv
    echo ""
fi

# Upload all Word documents
if [ -d "./documents" ]; then
    echo "📄 Uploading Word documents..."
    npx ts-node scripts/add-files-with-credentials.ts ./documents/*.docx
    echo ""
fi

# Upload any other data files
if [ -f "./data/qa.jsonl" ]; then
    echo "📄 Uploading JSONL data..."
    npx ts-node scripts/add-files-with-credentials.ts ./data/qa.jsonl
    echo ""
fi

echo "✅ All documents uploaded successfully!"
echo "Note: It may take a few minutes for the files to be fully processed and searchable."
