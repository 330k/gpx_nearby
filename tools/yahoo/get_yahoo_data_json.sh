#!/bin/bash

APPID=dj00aiZpPUd3ZmhXWkMyUURqcSZzPWNvbnN1bWVyc2VjcmV0Jng9ODA-
#GENRE=0205001 #コンビニ
GENRE=0307003 #道の駅

mkdir -p json/${GENRE}

cat yahoo_coords.tsv | while read i
do
  arr=(${i})
  lat1=${arr[0]}
  lon1=${arr[1]}
  lat2=$((${lat1} + 1))
  lon2=$((${lon1} + 1))
  start=1
  filepath=json/${GENRE}/yahoo_${lon1}_${lat1}_${start}.json
  
  if [[ -s $filepath ]]; then
    continue
  fi
  
  curl "https://map.yahooapis.jp/search/local/V1/localSearch?appid=${APPID}&bbox=${lon1},${lat1},${lon2},${lat2}&gc=${GENRE}&detail=simple&results=100&start=${start}&output=json" > $filepath 2>/dev/null
  
  total=$(cat $filepath | jq '.ResultInfo.Total')
  
  echo "lat1: ${lat1}, lon1: ${lon1}, total: ${total}"
  
  while [[ $((${start} + 100)) -lt $total ]]
  do
    start=$((${start} + 100))
    filepath=json/${GENRE}/yahoo_${lon1}_${lat1}_${start}.json
    echo "start: ${start}"
    curl "https://map.yahooapis.jp/search/local/V1/localSearch?appid=${APPID}&bbox=${lon1},${lat1},${lon2},${lat2}&gc=${GENRE}&detail=simple&results=100&start=${start}&output=json" > $filepath 2>/dev/null
  done
  
  #break
done
