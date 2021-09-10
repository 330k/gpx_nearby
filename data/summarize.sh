#!/bin/bash

BASEDIR=$(dirname $0)
OUTPUT=$BASEDIR/summary.js

echo -n 'summary({' > $OUTPUT

echo -n '"セブンイレブン":' >> $OUTPUT
cat yahoo_0205001.json | jq '[.[] | select(.name | test("セブン.*イレブン"))] | length' >> $OUTPUT

echo -n ',"ファミリーマート":' >> $OUTPUT
cat yahoo_0205001.json | jq '[.[] | select(.name | test("ファミリーマート"))] | length' >> $OUTPUT

echo -n ',"ローソン":' >> $OUTPUT
cat yahoo_0205001.json | jq '[.[] | select(.name | test("ローソン"))] | length' >> $OUTPUT

echo -n ',"セイコーマート":' >> $OUTPUT
cat yahoo_0205001.json | jq '[.[] | select(.name | test("セイコーマート"))] | length' >> $OUTPUT

echo -n ',"ミニストップ":' >> $OUTPUT
cat yahoo_0205001.json | jq '[.[] | select(.name | test("ミニストップ"))] | length' >> $OUTPUT

echo '})' >> $OUTPUT
