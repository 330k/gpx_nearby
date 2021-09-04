#!/bin/bash

file=data/yahoo_merge.json

cat json/0205001/*.json | jq '.Feature | select(. != null)' | jq -s 'flatten' > $file

sed -i -e 's/セブン‐イレブン/セブンイレブン/g' $file
sed -i -e 's/セブン−イレブン/セブンイレブン/g' $file
sed -i -e 's/セブン—イレブン/セブンイレブン/g' $file
sed -i -e 's/セブン イレブン/セブンイレブン/g' $file
sed -i -e 's/セブンーイレブン/セブンイレブン/g' $file
sed -i -e 's/セブン・イレブン/セブンイレブン/g' $file
sed -i -e 's/セブン-イレブン/セブンイレブン/g' $file
sed -i -e 's/　//g' $file

cat $file | jq 'reverse | unique_by(.Name)' > data/yahoo_merge_dedup.json

echo -n 'data=' > /home/kei/Documents/GitHub/gpx_along/data/yahoo.js
cat data/yahoo_merge_dedup.json | jq '[ .[] | { id: .Id, name : .Name, lat: (.Geometry.Coordinates | split(","))[1] | tonumber, lon: (.Geometry.Coordinates | split(","))[0] | tonumber } ]' >> /home/kei/Documents/GitHub/gpx_along/data/yahoo.js

